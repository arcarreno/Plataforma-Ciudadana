export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  isNetwork: boolean
  constructor(message: string, status: number = 0, isNetwork = false) {
    super(message)
    this.status = status
    this.isNetwork = isNetwork
  }
}

function leerDetalle(res: Response): Promise<string> {
  return res.text().then(t => {
    try {
      const j = JSON.parse(t) as { detail?: string; data?: unknown }
      if (typeof j.detail === 'string') return j.detail
      if (j.data) return JSON.stringify(j.data).slice(0, 300)
    } catch {
      /* no json */
    }
    return t.slice(0, 300)
  })
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true', ...options?.headers },
      ...options,
    })
  } catch {
    throw new ApiError('No se pudo conectar con el servidor', 0, true)
  }
  if (!res.ok) {
    const detalle = await leerDetalle(res)
    throw new ApiError(`API error ${res.status}: ${detalle}`, res.status)
  }
  return res.json() as Promise<T>
}

export async function postForm<T>(path: string, form: FormData): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      body: form,
      headers: { 'ngrok-skip-browser-warning': 'true' },
    })
  } catch {
    throw new ApiError('No se pudo conectar con el servidor', 0, true)
  }
  if (!res.ok) {
    const detalle = await leerDetalle(res)
    throw new ApiError(`API error ${res.status}: ${detalle}`, res.status)
  }
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string, options?: RequestInit) => request<T>(path, options),
  post: <T>(path: string, data: unknown, options?: RequestInit) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data), ...options }),
  put: <T>(path: string, data: unknown, options?: RequestInit) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(data), ...options }),
  patch: <T>(path: string, data: unknown, options?: RequestInit) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data), ...options }),
  delete: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { method: 'DELETE', ...options }),
}

export function urlEvidencia(ruta: string): string {
  // rutas locales: "folio/archivo" (el backend las guarda sin prefijo evidencias/)
  const limpia = ruta.replace(/^evidencias\//, '')
  const [folio, ...resto] = limpia.split('/')
  const archivo = resto.join('/')
  if (!folio || !archivo) return ruta
  return `${API_URL}/api/evidencias/${encodeURIComponent(folio)}/${encodeURIComponent(archivo)}`
}
