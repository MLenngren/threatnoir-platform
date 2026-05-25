"""AI cost logging for Python scripts (LEN-1700).

Mirrors server/utils/aiUsage.ts:logAiCall() + server/utils/aiPricing.ts.

Writes best-effort per-call rows into Supabase table `ai_call_log` via PostgREST.
Logging failures must never break the caller.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any, Mapping
from urllib import request as urllib_request


_PRICING_USD_PER_MTOK: dict[str, dict[str, float]] = {
    # Claude Haiku 4.5
    "claude-haiku-4-5-20251001": {"input": 1, "output": 5, "cacheRead": 0.1, "cacheWrite": 1.25},
    # Claude Sonnet 4
    "claude-sonnet-4-20250514": {"input": 3, "output": 15, "cacheRead": 0.3, "cacheWrite": 3.75},
    # Claude Opus 4
    "claude-opus-4-20250514": {"input": 15, "output": 75, "cacheRead": 1.5, "cacheWrite": 18.75},
}


def _normalize_model_key(model: str) -> str | None:
    if model in _PRICING_USD_PER_MTOK:
        return model

    # Be tolerant to callers passing model aliases without the date suffix.
    if model == "claude-haiku-4-5" or model.startswith("claude-haiku-4-5-"):
        return "claude-haiku-4-5-20251001"
    if model == "claude-sonnet-4" or model.startswith("claude-sonnet-4-"):
        return "claude-sonnet-4-20250514"

    # IMPORTANT: do not treat Opus 4.5/4.6/4.7 as Opus 4 (pricing differs).
    if model == "claude-opus-4" or (
        model.startswith("claude-opus-4-")
        and not model.startswith("claude-opus-4-5")
        and not model.startswith("claude-opus-4-6")
        and not model.startswith("claude-opus-4-7")
    ):
        return "claude-opus-4-20250514"

    return None


def compute_cost_micro_cents(model: str, usage: Mapping[str, Any]) -> int:
    """Return estimated cost in micro-cents ($1e-6) for a single Anthropic call."""

    key = _normalize_model_key(str(model or ""))
    if not key:
        return 0
    pricing = _PRICING_USD_PER_MTOK[key]

    def _tok(name: str) -> int:
        try:
            raw = usage.get(name, 0)
        except Exception:
            raw = 0
        try:
            n = int(round(float(raw or 0)))
        except Exception:
            n = 0
        return max(0, n)

    input_tokens = _tok("input_tokens")
    output_tokens = _tok("output_tokens")
    cache_read_tokens = _tok("cache_read_input_tokens")
    cache_write_tokens = _tok("cache_creation_input_tokens")

    raw = (
        input_tokens * float(pricing["input"])
        + output_tokens * float(pricing["output"])
        + cache_read_tokens * float(pricing["cacheRead"])
        + cache_write_tokens * float(pricing["cacheWrite"])
    )
    return max(0, int(round(raw)))


def _usage_from_response(response: Any) -> dict[str, int]:
    usage_raw: Any = None
    if response is None:
        usage_raw = None
    elif hasattr(response, "usage"):
        usage_raw = getattr(response, "usage", None)
    elif isinstance(response, Mapping):
        usage_raw = response.get("usage")

    def _read(obj: Any, key: str) -> int:
        v: Any = 0
        if obj is None:
            v = 0
        elif isinstance(obj, Mapping):
            v = obj.get(key, 0)
        else:
            v = getattr(obj, key, 0)
        try:
            return max(0, int(round(float(v or 0))))
        except Exception:
            return 0

    # Mirror server/utils/aiUsage.ts normalization (required usage shape).
    return {
        "input_tokens": _read(usage_raw, "input_tokens"),
        "output_tokens": _read(usage_raw, "output_tokens"),
        "cache_read_input_tokens": _read(usage_raw, "cache_read_input_tokens"),
        "cache_creation_input_tokens": _read(usage_raw, "cache_creation_input_tokens"),
    }


def log_ai_call(
    *,
    pipeline: str,
    model: str,
    response: Any,
    duration_ms: int | None = None,
    status: str = "success",
    metadata: dict[str, Any] | None = None,
) -> None:
    """Best-effort insert into `ai_call_log`. Never raises."""

    usage = _usage_from_response(response)
    cost_micro_cents = compute_cost_micro_cents(model, usage)

    supabase_url = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
    service_key = (os.environ.get("SUPABASE_SERVICE_KEY") or "").strip()
    if not supabase_url or not service_key:
        # Intentionally quiet in normal runs; but keep a breadcrumb on stderr.
        print(
            "[log_ai_call] missing SUPABASE_URL/SUPABASE_SERVICE_KEY; skipping ai_call_log insert",
            file=sys.stderr,
        )
        return

    row = {
        "pipeline": str(pipeline or "").strip(),
        "model": str(model or "").strip(),
        "input_tokens": usage["input_tokens"],
        "output_tokens": usage["output_tokens"],
        "cached_input_tokens": usage["cache_read_input_tokens"],
        "cache_creation_tokens": usage["cache_creation_input_tokens"],
        "cost_micro_cents": int(cost_micro_cents),
        "duration_ms": int(duration_ms) if duration_ms is not None else None,
        "status": str(status or "success"),
        "metadata": metadata if isinstance(metadata, dict) else None,
    }

    try:
        body = json.dumps(row, ensure_ascii=False).encode("utf-8")
        req = urllib_request.Request(
            f"{supabase_url}/rest/v1/ai_call_log",
            data=body,
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Prefer": "return=minimal",
            },
            method="POST",
        )
        with urllib_request.urlopen(req, timeout=10) as _resp:
            _resp.read()
    except Exception as exc:
        print(f"[log_ai_call] failed inserting ai_call_log: {exc}", file=sys.stderr)


if __name__ == "__main__":  # pragma: no cover
    # Tiny sanity: keep in sync with ticket's required assertion.
    assert (
        compute_cost_micro_cents(
            "claude-haiku-4-5-20251001", {"input_tokens": 1000, "output_tokens": 500}
        )
        == 3500
    )
