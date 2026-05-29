export const CATEGORIES = ['AI Security', 'Network Security', 'Cloud Security', 'Compliance', 'Incident Response', 'Best Practices', 'Threat Intel']

export function buildTagResourcePrompt(categories: string[]): string {
  const list = (categories || []).join(', ')
  return `Analyze this security resource image. Return JSON only, no markdown:
{
  "title": "short descriptive title for this resource",
  "description": "1-2 sentence technical summary of what this resource covers",
  "category": "one of: ${list}",
  "tags": ["tag1", "tag2", "tag3"] (3-5 relevant lowercase tags)
}`
}
