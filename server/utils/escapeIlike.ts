// Escape special characters for Supabase/PostgREST ILIKE patterns.
// In Postgres LIKE/ILIKE, `%` and `_` are wildcards. `\` is the escape character.
export function escapeIlike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&')
}

