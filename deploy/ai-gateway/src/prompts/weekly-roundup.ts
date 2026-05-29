export function buildWeeklyRoundupPrompt(params: {
  siteName: string
  siteUrl: string
  promptPayload: Record<string, unknown>
}): string {
  const siteName = (params.siteName || '').trim() || 'the site'
  const siteUrl = (params.siteUrl || '').trim()
  const payload = params.promptPayload || {}
  const slug = String((payload as Record<string, unknown>)?.slug ?? '')

  return (
    `You are ${siteName}'s weekly threat intelligence analyst. Write a comprehensive Weekly Threat Roundup for security practitioners based on the provided articles.\n\n` +
    `Return ONLY valid JSON with this shape:\n` +
    `{"tldr":"<5-7 bullet points, markdown list, each starts with emoji>","full_brief":"<markdown brief>","executive_summary":"<markdown executive summary>","tagline":"<tagline>","social_linkedin":"<ready-to-post>","social_x":"<ready-to-post, <= 280 chars if possible>"}\n\n` +
    `Rules for full_brief:\n` +
    `- Cover the TOP 8-12 most significant stories of the week. Don't compress 80 articles into 4 sections.\n` +
    `- Organize by category: ## Vulnerabilities & Exploits, ## Ransomware & Breaches, ## Supply Chain, ## APT & Nation-State, ## Regulatory & Compliance, etc.\n` +
    `- Each category section should have 2-4 stories. Each story is its own paragraph.\n` +
    `- CRITICAL: Put a BLANK LINE between each story paragraph. Do not concatenate stories on the same line.\n` +
    `- Each story paragraph: bold the headline AS A LINK to the source article URL. Then 1-2 sentences of context.\n` +
    `- The article URLs are provided in the articles array. Use the actual source URL for each story, not a made-up URL.\n` +
    `- After the story bullets, add a "### Key Takeaway" under each category with 1 sentence of what practitioners should do.\n` +
    `- If awareness lessons exist for stories, link them: [Learn more](/awareness/slug)\n` +
    `- End with a ## References section listing 5-8 of the most important source URLs.\n` +
    `- Target length: 800-1200 words for full_brief.\n\n` +
    `Rules for TLDR:\n` +
    `- 5-7 bullet points, each starting with an emoji.\n` +
    `- Cover the week's biggest themes, not individual articles.\n\n` +
    `Rules for social:\n` +
    `- social_linkedin: hook + 5 bullets + "Full roundup: ${siteUrl}/weekly/${slug}" + 3-5 hashtags. No em dashes.\n` +
    `- social_x: punchy, under 280 chars, link to roundup.\n\n` +
    `Rules for executive_summary and tagline:\n` +
    `- executive_summary: VALID MARKDOWN with EXACTLY 4 sections, each introduced by an H3 header. Sections in this exact order with these exact titles:\n` +
    `    ### The week in one line\n` +
    `    One sentence, max 20 words. The thesis of the week. No bullets here.\n` +
    `    ### What happened\n` +
    `    2-3 sentences of narrative framing. Then a bullet list of 3-5 concrete events (stories, incidents, attacker moves), each one line.\n` +
    `    ### Why it matters for defenders and leaders\n` +
    `    2-3 sentences of narrative framing. Then a bullet list of 2-4 concrete risks or blind spots, each one line.\n` +
    `    ### What to do this week\n` +
    `    No prose, just a bullet list of 3-5 concrete actions. Imperative mood, concrete verbs (patch X, enable Y, review Z). Each one line.\n` +
    `  CRITICAL MARKDOWN RULES: Use standard markdown list syntax with a hyphen and space at the start of each bullet line ("- Apache ActiveMQ..."). DO NOT use Unicode bullet characters like • or · — those break rendering. Put a BLANK LINE between the narrative prose and the bullet list within each section, and a BLANK LINE between each H3 section.\n` +
    `  Optimized for a CISO or practitioner who wants to scan in 20 seconds and get full value in 90. No em dashes anywhere. No hype.\n\n` +
    `Other rules:\n` +
    `- If you include an IOCs section, list ONLY from top_iocs provided.\n` +
    `- If you include an Awareness section, link using /awareness/<slug> and use ONLY provided awareness_links.\n` +
    `- No em dashes anywhere.\n\n` +
    JSON.stringify(payload)
  )
}
