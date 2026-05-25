import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import mock_open, patch


# Allow importing sibling scripts (generate.py / generate_dialogue.py)
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import generate as podcast_generate  # noqa: E402
import generate_dialogue as podcast_dialogue  # noqa: E402


class TestStockholmTimezone(unittest.TestCase):
    def test_today_in_stockholm_crosses_midnight_from_utc(self) -> None:
        # 23:30 UTC is 00:30 in Stockholm during winter time (next day).
        now_utc = datetime(2026, 1, 6, 23, 30, tzinfo=timezone.utc)
        self.assertNotEqual(
            podcast_generate._today_in_stockholm(now_utc), now_utc.date()
        )
        self.assertEqual(
            podcast_generate._today_in_stockholm(now_utc).isoformat(), "2026-01-07"
        )

    def test_schedule_context_uses_stockholm_anchor_tz(self) -> None:
        dt = podcast_dialogue._stockholm_anchor_dt("2026-01-07")
        self.assertEqual(getattr(dt.tzinfo, "key", None), "Europe/Stockholm")
        ctx = podcast_dialogue._build_schedule_context("2026-01-07", "morning")
        self.assertEqual(ctx["day_of_week"], dt.strftime("%A"))

    def test_get_events_for_date_uses_weekday_rules(self) -> None:
        # 2026-01-13 is the 2nd Tuesday of Jan 2026 (day 13).
        calendar = {
            "computed": [
                {
                    "rule": "second_tuesday",
                    "name": "Patch Tuesday (2nd Tuesday)",
                    "category": "security",
                }
            ]
        }

        with (
            patch.object(podcast_dialogue.Path, "exists", return_value=True),
            patch("generate_dialogue.open", mock_open(read_data=json.dumps(calendar))),
        ):
            events = podcast_dialogue.get_events_for_date("2026-01-13")
        self.assertIn("Patch Tuesday (2nd Tuesday)", events)


if __name__ == "__main__":
    raise SystemExit(unittest.main())
