// IMPORTANT: Keep these module-level constants byte-stable across calls.
// Any per-call non-determinism in the cached prompt prefix will destroy cache hits.

export const STABLE_INSTRUCTIONS = `Is this text about a specific cybersecurity event, vulnerability, threat, tool release, data breach, malware campaign, or other actionable security intelligence?

- YES: specific security event or actionable intel
- NO: personal opinions, jokes, memes, job posts, self-promotion, generic advice, or off-topic content

Reply with ONLY "YES" or "NO".`
