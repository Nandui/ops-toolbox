/**
 * fetchWithTimeout — a drop-in fetch that aborts after `timeoutMs` so a slow or
 * hanging endpoint surfaces as an error instead of an indefinite spinner.
 *
 * Throws a DOMException with name "AbortError" on timeout (same as a manual
 * AbortController), so callers can detect it and show a "timed out" message.
 * Any AbortSignal passed in via `init.signal` is still respected.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 12000,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  // Forward an externally-provided signal so either can abort the request.
  if (init.signal) {
    if (init.signal.aborted) controller.abort()
    else init.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

/** True when an error is an abort/timeout from fetchWithTimeout. */
export function isTimeoutError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/** A human-friendly message for a failed load, distinguishing timeouts. */
export function loadErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (isTimeoutError(err)) return 'The server took too long to respond. Please try again.'
  if (err instanceof Error) return err.message
  return fallback
}
