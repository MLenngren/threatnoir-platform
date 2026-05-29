# ThreatNoir Skill for Claude Code

Query ThreatNoir's threat intelligence database directly from Claude Code.

## Installation

1. Copy the `skill.md` file to your Claude Code skills directory:

```bash
mkdir -p ~/.claude/skills/threatnoir
cp skill.md ~/.claude/skills/threatnoir/skill.md
```

2. That's it. Claude Code will auto-detect the skill.

## What it does

- **IOC lookup** — search IPs, domains, hashes, CVEs, MITRE ATT&CK IDs
- **Security articles** — search curated cybersecurity news
- **Focus items** — see what to patch/prioritize right now
- **Weekly roundups** — get the week's security summary
- **Awareness lessons** — learn from past incidents

## Example prompts

- "Look up CVE-2024-3400 on ThreatNoir"
- "What are the active focus items on ThreatNoir?"
- "Search ThreatNoir for any IOCs related to log4j"
- "What happened in security this week?"

## Higher rate limits

The free tier allows 10 IOC searches per hour. For higher limits, create a free API key at https://threatnoir.com/settings.

## Alternative: MCP Server

For deeper integration, use the ThreatNoir MCP server instead:

```json
{
  "mcpServers": {
    "threatnoir": {
      "command": "npx",
      "args": ["-y", "threatnoir-mcp-iocs"],
      "env": {
        "THREATNOIR_API_KEY": "tn_live_your_key_here"
      }
    }
  }
}
```

More info: https://threatnoir.com/developer
