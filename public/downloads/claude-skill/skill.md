# ThreatNoir IOC & Threat Intelligence Lookup

Search ThreatNoir's curated cybersecurity database for IOCs, articles, focus items, weekly roundups, and awareness lessons.

Use this skill when the user mentions IPs, domains, hashes, CVEs, MITRE ATT&CK techniques, or asks about threat indicators, recent vulnerabilities, or security news.

## Usage

### Search IOCs (indicators of compromise)

When the user asks about a specific indicator (IP, domain, hash, CVE):

```
WebFetch https://threatnoir.com/api/v1/iocs?q={query}&type={type}
```

Types: `ip`, `domain`, `hash_md5`, `hash_sha1`, `hash_sha256`, `url`, `cve`, `mitre_attack`, `email`, `malware`

Example: `https://threatnoir.com/api/v1/iocs?q=CVE-2024-3400&type=cve`

### List recent IOCs

```
WebFetch https://threatnoir.com/api/v1/iocs?limit=20
```

### Search articles

When the user asks about recent security news or a specific topic:

```
WebFetch https://threatnoir.com/api/v1/articles?q={query}&limit=10
```

### Active focus items (advisories)

When the user asks what to patch or prioritize right now:

```
WebFetch https://threatnoir.com/api/v1/focus?limit=5
```

Filter by severity: `https://threatnoir.com/api/v1/focus?severity=critical`

### Weekly roundups

For a summary of the week's security news:

```
WebFetch https://threatnoir.com/api/v1/weekly?limit=3
```

### Awareness lessons

When the user wants to learn from past incidents:

```
WebFetch https://threatnoir.com/api/v1/awareness?q={topic}&limit=5
```

## Rate Limits

- Without API key: 10 searches/hour, 10 results max
- With API key: 100 searches/min, 50 results max
- Listing (no search query): 30 req/min

For higher limits, get a free API key at https://threatnoir.com/settings and add the header:
`Authorization: Bearer tn_live_your_key_here`

## Response Format

All endpoints return JSON with `{items: [...], hasMore: boolean, nextOffset: number}`.

IOC items include: `type`, `value`, `context`, and linked `article` with title and URL.
