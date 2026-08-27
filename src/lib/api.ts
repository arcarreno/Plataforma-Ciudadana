/**
 * src/lib/api.ts — Cliente HTTP central de la Plataforma Ciudadana
 *
 * ÚNICO lugar donde se hace fetch en toda la app. Todo lo demás
 * (servidor.ts, solicitud.ts, auth.ts, etc.) importa { api } de aquí.
 * Si cambia la URL del túnel, headers o manejo de errores, solo se toca
 * este archivo. Usa fetch nativo (sin axios) y genéricos <T> para tipar.
 */

// URL base del backend FastAPI (Vite la incrusta en BUILD-TIME desde .env)
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/**
 * Error personalizado para distinguir en los catch:
 * - isNetwork=true  -> caída de red / túnel caído (backend.ts hace fallback a Supabase)
 * - status=401      -> credenciales malas
 * - status>=500     -> error del servidor
 */
export class ApiError extends Error {
  status: number // Código HTTP (0 = sin respuesta, fallo de red)
  isNetwork: boolean // true si fetch lanzó excepción

  constructor(message: string, status: number = 0, isNetwork = false) {
    super(message)
    this.status = status
    this.isNetwork = isNetwork
  }
}

/**
 * Normaliza el mensaje de error que devuelve FastAPI.
 * Soporta 3 formatos: {detail:"..."}, {data:{...}} o texto/HTML plano.
 * Corta a 300 chars para no inundar toasts con HTML gigante.
 */
function leerDetalle(res: Response): Promise<string> {
  // Leemos como texto primero para no crashear si es HTML
  return res.text().then(t => {
    try {
      const j = JSON.parse(t) as { detail?: string; data?: unknown }
      // FastAPI estándar: {detail:"CURP inválida"}
      if (typeof j.detail === 'string') return j.detail
      // Algunos endpoints devuelven {data:{...}}
      if (j.data) return JSON.stringify(j.data).slice(0, 300)
    } catch {
      /* no era JSON válido */
    }
    // Fallback: texto plano cortado
    return t.slice(0, 300)
  })
}

/**
 * Wrapper genérico para peticiones JSON (GET, POST, PUT, PATCH, DELETE).
 * @param path - Ruta relativa (ej: "/api/solicitudes?q=ST")
 * @param options - Opciones de fetch (method, body, headers extra)
 * @returns Promise<T> tipado según el genérico
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response
  try {
    // fetch a API_URL + path con headers por defecto
    res = await fetch(`${API_URL}${path}`, {
      ...options, // El llamante puede sobreescribir method/body/headers
      headers: {
        'Content-Type': 'application/json', // Por defecto JSON
        'ngrok-skip-browser-warning': 'true', // Evita página intermedia de Cloudflare/ngrok
        ...options?.headers, // Headers del llamante pisan los de arriba
      },
    })
  } catch {
    // Fallo de red (sin internet, DNS, túnel caído) -> sin status
    throw new ApiError('No se pudo conectar con el servidor', 0, true)
  }
  // Error HTTP (400, 401, 404, 500...) -> extraemos detalle y lanzamos ApiError tipado
  if (!res.ok) {
    const detalle = await leerDetalle(res)
    throw new ApiError(`API error ${res.status}: ${detalle}`, res.status)
  }
  // 200-299 -> JSON tipado como T
  return res.json() as Promise<T>
}

/**
 * Wrapper especial para multipart/form-data (subida de archivos).
 * NO manda 'Content-Type': el navegador genera el boundary automáticamente.
 * Usado solo en lib/solicitud.ts -> crearSolicitud() con FormData + fotos.
 */
export async function postForm<T>(path: string, form: FormData): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      body: form, // FormData con campos + archivos
      headers: {
        'ngrok-skip-browser-warning': 'true', // Solo ngrok, sin Content-Type
      },
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

/**
 * Fachada pública tipada — lo que importan todos los demás archivos.
 * Azúcar sobre request() para no repetir JSON.stringify y method.
 */
export const api = {
  // GET: solo path + options opcionales
  get: <T>(path: string, options?: RequestInit) => request<T>(path, options),
  // POST: serializa data a JSON automáticamente
  post: <T>(path: string, data: unknown, options?: RequestInit) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data), ...options }),
  // PUT: reemplazo completo
  put: <T>(path: string, data: unknown, options?: RequestInit) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(data), ...options }),
  // PATCH: actualización parcial (ej: estatus)
  patch: <T>(path: string, data: unknown, options?: RequestInit) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data), ...options }),
  // DELETE: borrado
  delete: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { method: 'DELETE', ...options }),
}

/**
 * Construye URL completa para evidencias del ciudadano.
 * Normaliza "evidencias/ST0001/foto.jpg" o "ST0001/foto.jpg" -> API_URL/api/evidencias/ST0001/foto.jpg
 * Usa encodeURIComponent para soportar espacios, #, & en nombres.
 */
export function urlEvidencia(ruta: string): string {
  // Quitamos prefijo "evidencias/" si viene (normalización)
  const limpia = ruta.replace(/^evidencias\//, '')
  // Separamos folio del resto (soporta subcarpetas: folio/sub/archivo.jpg)
  const [folio, ...resto] = limpia.split('/')
  const archivo = resto.join('/')
  // Validación defensiva: si falta folio o archivo, no construimos URL rota
  if (!folio || !archivo) return ruta
  return `${API_URL}/api/evidencias/${encodeURIComponent(folio)}/${encodeURIComponent(archivo)}`
}

/**
 * Construye URL completa para fotos de visitas supervisadas (DGPP en campo).
 * Ruta en BD: "123/foto.jpg" o "visitas_fotos/123/foto.jpg" -> /api/visitas/fotos/123/foto.jpg
 */
export function urlFotoVisita(ruta: string): string {
  // Quitamos prefijo "visitas_fotos/" si viene
  const limpia = ruta.replace(/^visitas_fotos\//, '')
  // Separamos visitaId del nombre (soporta subcarpetas)
  const [visitaId, ...resto] = limpia.split('/')
  const archivo = resto.join('/')
  if (!visitaId || !archivo) return ruta
  return `${API_URL}/api/visitas/fotos/${encodeURIComponent(visitaId)}/${encodeURIComponent(archivo)}`
}
