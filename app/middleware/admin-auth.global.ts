export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) return
  const user = useSupabaseUser()
  if (user.value && user.value.app_metadata?.role === 'admin') return

  const supabase = useSupabaseClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user || data.user.app_metadata?.role !== 'admin') {
    return navigateTo(`/auth/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
