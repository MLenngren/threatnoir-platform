// Endpoint: /extract-iocs
// Option (a) (LEN-1882): reuse the summarize-article prompt and parsing, then
// return only iocs + entities. Keep this prompt file as a stable import point.

export { STABLE_INSTRUCTIONS, CATEGORIES } from './summarize-article.js'
