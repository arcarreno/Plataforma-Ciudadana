/**
 * @file chat.ts
 * @description Cliente de mensajería entre usuarios logueados y paquetes de fichas.
 * REST via `api` (FastAPI) + WebSocket en tiempo real con reconexión automática.
 * La URL del WS se deriva de `API_URL` (http→ws, https→wss) para seguir al túnel.
 *
 * @uso Chats.tsx (conectarChat + REST), ModalEnviarFichas (paquetes), Paquetes.tsx.
 */
import { api, API_URL } from './api'

/** Perfil mínimo de otro usuario para chatear o enviarle fichas. */
export interface ChatUsuario {
  /** PK en usuarios_app. */
  id: number
  /** Username único. */
  username: string
  /** Nombres y apellidos (pueden venir vacíos). */
  nombres: string
  apellidos: string
  /** Rol (admin, DGPP, revisor, diputado...). */
  rol: string
}

/** Conversación 1 a 1 con último mensaje y no leídos. */
export interface Conversacion {
  /** PK de la conversación. */
  id: number
  /** ID del otro participante. */
  otro_id: number
  username: string
  nombres: string
  apellidos: string
  rol: string
  /** Texto del último mensaje (null si vacía). */
  ultimo: string | null
  ultimo_fecha: string | null
  /** Mensajes suyos sin leer. */
  no_leidos: number
}

/** Mensaje individual del hilo. */
export interface Mensaje {
  id: number
  remitente_id: number
  texto: string
  leido: boolean
  fecha: string
}

/** Eventos que empuja el servidor por WS. */
export type EventoChat =
  | { tipo: 'mensaje'; conversacion_id: number; id: number; remitente_id: number; texto: string; fecha: string }
  | { tipo: 'ok'; id: number; conversacion_id: number; fecha: string }
  | { tipo: 'paquete'; paquete_id: number; de?: string; total?: number; es_respuesta?: boolean }

/** Resumen de paquete recibido/enviado. */
export interface PaqueteResumen {
  id: number
  remitente?: string
  remitente_id?: number
  destinatario?: string
  destinatario_id?: number
  fecha: string
  leido: boolean
  total: number
  /** Solo en respuestas: paquete original que se contestó. */
  paquete_origen_id?: number | null
}

/** Helpers de auth: header Bearer si hay token. */
function auth(token?: string) {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
}

/** Usuarios activos excepto uno mismo (para chatear o enviar fichas). */
export function listarUsuariosChat(token?: string): Promise<{ data: ChatUsuario[] }> {
  return api.get<{ data: ChatUsuario[] }>('/api/chats/usuarios', auth(token))
}

/** Conversaciones propias ordenadas por actividad. */
export function listarConversaciones(token?: string): Promise<{ data: Conversacion[] }> {
  return api.get<{ data: Conversacion[] }>('/api/chats/conversaciones', auth(token))
}

/** Hilo de mensajes (marca como leídos los suyos). */
export function listarMensajes(convId: number, token?: string): Promise<{ data: Mensaje[] }> {
  return api.get<{ data: Mensaje[] }>(`/api/chats/conversaciones/${convId}/mensajes`, auth(token))
}

/** Envío por HTTP (respaldo cuando el WS está caído). */
export function enviarMensajeHttp(
  destinatarioId: number,
  texto: string,
  token?: string
): Promise<{ data: { id: number; conversacion_id: number; fecha: string } }> {
  return api.post('/api/chats/enviar', { destinatario_id: destinatarioId, texto }, auth(token))
}

/** Crea un paquete de fichas para otro usuario. */
export function crearPaquete(
  destinatarioId: number,
  solicitudIds: number[],
  token?: string
): Promise<{ data: { id: number; fecha: string; total: number } }> {
  return api.post('/api/paquetes', { destinatario_id: destinatarioId, solicitud_ids: solicitudIds }, auth(token))
}

/** Paquetes recibidos (con cuenta y badge de nuevo). */
export function paquetesRecibidos(token?: string): Promise<{ data: PaqueteResumen[] }> {
  return api.get<{ data: PaqueteResumen[] }>('/api/paquetes/recibidos', auth(token))
}

/** Paquetes enviados por mí (sin respuestas: esas viven en la otra pestaña). */
export function paquetesEnviados(token?: string): Promise<{ data: PaqueteResumen[] }> {
  return api.get<{ data: PaqueteResumen[] }>('/api/paquetes/enviados', auth(token))
}

/** Respuestas a mis paquetes (las contestó el destinatario). */
export function respuestasRecibidas(token?: string): Promise<{ data: PaqueteResumen[] }> {
  return api.get<{ data: PaqueteResumen[] }>('/api/paquetes/respuestas', auth(token))
}

/**
 * Responde un paquete recibido con el checklist contestado.
 * @param pid - Paquete original (debo ser su destinatario).
 * @param aceptadasIds - IDs aceptados (subset de las fichas del paquete).
 */
export function responderPaquete(
  pid: number,
  aceptadasIds: number[],
  token?: string
): Promise<{ data: { id: number; fecha: string; total: number; aceptadas: number } }> {
  return api.post(`/api/paquetes/${pid}/responder`, { aceptadas_ids: aceptadasIds }, auth(token))
}

/**
 * Abre el WebSocket de chats con reconexión automática (backoff, máx 6 intentos).
 * @param token - JWT de sesión (va en query, el WS no manda headers).
 * @param onEvento - Callback por cada evento (mensaje/ok/paquete).
 * @param onEstado - Callback opcional (true = conectado).
 * @returns Controles: `enviar` (false si no hay conexión) y `cerrar`.
 */
export function conectarChat(
  token: string,
  onEvento: (ev: EventoChat) => void,
  onEstado?: (conectado: boolean) => void
): { enviar: (destinatarioId: number, texto: string) => boolean; cerrar: () => void } {
  const base = API_URL.replace(/^http/, 'ws')
  const url = `${base}/api/chats/ws?token=${encodeURIComponent(token)}`
  let cerrado = false
  let intentos = 0
  let ws: WebSocket | null = null
  let timer: number | undefined

  const conectar = () => {
    if (cerrado) return
    try {
      ws = new WebSocket(url)
    } catch {
      reintentar()
      return
    }
    ws.onopen = () => {
      intentos = 0
      onEstado?.(true)
    }
    ws.onmessage = (e) => {
      try {
        onEvento(JSON.parse(e.data) as EventoChat)
      } catch {
        /* mensaje no JSON: se ignora */
      }
    }
    ws.onclose = () => {
      onEstado?.(false)
      reintentar()
    }
    ws.onerror = () => {
      try { ws?.close() } catch { /* ya cerrado */ }
    }
  }

  const reintentar = () => {
    if (cerrado || intentos >= 6) return
    intentos += 1
    window.clearTimeout(timer)
    timer = window.setTimeout(conectar, Math.min(3000 * intentos, 15000))
  }

  conectar()
  return {
    /** Envía por WS; false si no hay conexión (usar HTTP de respaldo). */
    enviar: (destinatarioId: number, texto: string) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return false
      try {
        ws.send(JSON.stringify({ destinatario_id: destinatarioId, texto }))
        return true
      } catch {
        return false
      }
    },
    /** Desconecta definitivamente (desmontar o logout). */
    cerrar: () => {
      cerrado = true
      window.clearTimeout(timer)
      try { ws?.close() } catch { /* ya cerrado */ }
    },
  }
}
