import { useToast } from '../state/toast'

/** Rendered once, in the layout. Pages call useToast().show(message). */
export function Toast() {
  const { message } = useToast()
  if (!message) return null
  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  )
}

export default Toast
