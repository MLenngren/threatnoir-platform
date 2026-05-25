import { useSupabaseAdmin } from './supabase'

export type AuditLogEntry = {
  user_id?: string | null
  action: string
  resource_type: string
  resource_id?: string | null
  details?: Record<string, unknown> | null
}

/**
 * Best-effort audit logging for admin mutations.
 *
 * Notes:
 * - Uses a service-role Supabase client (bypasses RLS) to ensure writes succeed.
 * - Never throws; failures should not block admin actions.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = useSupabaseAdmin()

    const payload = {
      user_id: entry.user_id ?? null,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id ?? null,
      details: entry.details ?? null,
      created_at: new Date().toISOString()
    }

    const { error } = await supabase.from('audit_log').insert(payload)
    if (error) {
      console.warn('[audit_log] insert failed:', error.message)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[audit_log] unexpected failure:', msg)
  }
}

