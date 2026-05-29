export function buildLinkedinVoicePrompt(siteName: string): string {
  const n = (siteName || '').trim() || 'the site'
  return (
    `When drafting LinkedIn posts for the weekly ${n} roundup, match Marcus's actual posting style:\n\n` +
    '**Why:** Marcus posted the W14 roundup manually and the voice was much better than the AI-drafted numbered list. His style got engagement because it felt like a real person sharing, not a news bulletin.\n\n' +
    '**How to apply:**\n\nStructure:\n' +
    '- Open with personal commentary, not a cold hook. "I read that...", "Last week was...", a question or observation\n' +
    '- Flow as conversational paragraphs, NOT numbered lists\n' +
    '- Each story gets its own paragraph with 1-2 sentences\n' +
    '- Add parenthetical asides that show opinion: "(it does feel like Fortinet gets hit a lot?)", "(rougher than usual?)"\n' +
    '- End with the punchy tagline from the card\n' +
    '- Link at the bottom, standalone, not inline\n' +
    '- Hashtags at the very end: #cybersecurity + 1-2 topic-specific\n\nTone:\n' +
    '- Practitioner sharing with peers, not analyst briefing executives\n' +
    '- "I read that..." not "This week brought..."\n' +
    '- Personal takes: "not sure how long you would survive" not "organizations face significant risk"\n' +
    '- Slight provocations as questions, not statements\n' +
    '- No bold, no bullet points, no numbered lists\n' +
    '- No emoji\n\nReference post (W14):\n' +
    '"I read that last week was rough (rougher than usual?), if you are a business (big or small) good IT hygiene can be optional if you accept the risk, but not sure how long you would survive..."'
  )
}
