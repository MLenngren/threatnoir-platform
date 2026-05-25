type ToastKind = 'success' | 'error' | 'info'

type ToastState = {
  open: boolean
  message: string
  kind: ToastKind
}

const state = reactive<ToastState>({
  open: false,
  message: '',
  kind: 'success'
})

let timer: ReturnType<typeof setTimeout> | null = null

function show(message: string, kind: ToastKind = 'success') {
  if (!import.meta.client) return

  state.message = String(message || '').trim()
  state.kind = kind
  state.open = true

  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    state.open = false
    timer = null
  }, 2500)
}

export function useToast() {
  return { state, show }
}
