export function buildLinkedinMidweekUserPrompt(
  siteUrl: string,
  article: { title: string; slug: string; ai_summary: string | null }
): string {
  const title = (article?.title || '').trim()
  const slug = (article?.slug || '').trim()
  const summary = (article?.ai_summary || '').trim()
  const link = `${(siteUrl || '').trim()}/article/${slug}`

  return `Write a LinkedIn insight post about this security article. Share your personal take as a practitioner — what it means, why it matters, what teams should do.

Title: ${title}
Summary: ${summary}

End with the link standalone on its own line: ${link}
Add #cybersecurity and 1-2 relevant hashtags at the very end.

Keep it 150-200 words. Conversational paragraphs, not lists.`
}
