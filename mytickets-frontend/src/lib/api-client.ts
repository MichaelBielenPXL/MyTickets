export class ApiError extends Error {
  status: number
  /** The JSON the server sent with the error, for the few screens that show more than the message. */
  body: Record<string, unknown>

  constructor(status: number, message: string, body: Record<string, unknown>) {
    super(message)
    this.status = status
    this.body = body
  }
}

function fallbackMessage(status: number) {
  if (status === 401) return 'Please sign in.'
  if (status === 429) return 'Too many attempts. Wait a minute and try again.'
  return `Something went wrong (${status}).`
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  // Files travel as a form; everything else as JSON.
  const isForm = body instanceof FormData
  let response: Response
  try {
    response = await fetch(`/api${url}`, {
      method,
      headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError(0, 'No connection. Check your internet and try again.', {})
  }

  const text = await response.text()
  let data: unknown = undefined
  try {
    data = text ? JSON.parse(text) : undefined
  } catch {
    // Not JSON: an error page from a proxy, for example. Handled below by status.
  }

  if (!response.ok) {
    const record = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
    const message = typeof record.error === 'string' ? record.error : fallbackMessage(response.status)
    throw new ApiError(response.status, message, record)
  }
  return data as T
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body: unknown = {}) => request<T>('POST', url, body),
  put: <T>(url: string, body: unknown = {}) => request<T>('PUT', url, body),
  delete: <T>(url: string) => request<T>('DELETE', url),
  /** Sends one file under the field name the server expects (`file`). */
  upload: <T>(url: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return request<T>('POST', url, form)
  },
}
