export default defineNuxtPlugin(async () => {
  // Detect Supabase auth tokens in URL hash and establish session
  if (!import.meta.client) return

  const hash = window.location.hash
  if (!hash || !hash.includes('access_token=')) return

  const supabase = useSupabaseClient()

  // Parse the hash params
  const params = new URLSearchParams(hash.replace('#', ''))
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')

  if (accessToken && refreshToken) {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    })

    // Redirect away from the hash URL (so it doesn't re-run on refresh).
    // Keep legacy admin flow (/confirm → /admin), but preserve auth flows under /auth/*.
    const path = window.location.pathname
    const search = window.location.search
    const destination = path === '/confirm' ? '/admin' : `${path}${search}`
    window.location.replace(destination)
  }
})
