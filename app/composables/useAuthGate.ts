export function useAuthGate() {
  const user = useSupabaseUser()
  const authenticated = computed(() => !!user.value)
  return { authenticated, user }
}

