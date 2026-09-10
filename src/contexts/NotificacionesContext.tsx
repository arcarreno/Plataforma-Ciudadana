/**
 * @file NotificacionesContext.tsx
 * @description
 * Centro global de notificaciones de la plataforma. Es el ÚNICO dueño de la
 * conexión WebSocket de chats (una sola por sesión) y expone:
 * - Contadores de no leídos (chats + paquetes) para badges en Header/drawer.
 * - Toasts sileo ante mensaje o paquete nuevo cuando el hilo no está abierto.
 * - `fallo`: distingue "vacío real" de "sin conexión / sesión degradada",
 *   para que Chats/Paquetes muestren banner en vez de un vacío engañoso.
 * - `enviarMensaje` por WS (con respaldo HTTP en el llamante).
 * - Registro best-effort de Web Push (silencioso si el backend aún no lo soporta).
 *
 * Detección de sesión degradada: si el token es sintético `respaldo-...`
 * (fallback Supabase), FastAPI rechaza chats/paquetes → `fallo='respaldo'`.
 *
 * @uso Envolver Routes en App.tsx (dentro de AuthProvider). Consumir con `useNotificaciones`.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { sileo } from 'sileo'
import { useAuth } from './AuthContext'
import { getToken } from '../lib/auth'
import { ApiError } from '../lib/api'
import { conectarChat, listarConversaciones, paquetesRecibidos, respuestasRecibidas, type EventoChat } from '../lib/chat'
import { registrarPush } from '../lib/push'

/** Causa del fallo de lectura (para banners): ninguno = todo sano. */
export type FalloConexion = 'ninguno' | 'respaldo' | 'auth' | 'red'

/** Mensaje entrante por WS (hilo abierto). */
export interface MensajeVivo {
  id: number
  conversacion_id: number
  remitente_id: number
  texto: string
  fecha: string
}

/** Valor expuesto por el contexto. */
interface NotificacionesValor {
  /** Suma de no_leídos en conversaciones. */
  chatsNuevos: number
  /** Paquetes recibidos sin leer. */
  paquetesNuevos: number
  /** WS conectado (tiempo real). */
  conectado: boolean
  /** Fallo de lectura para banners (ver tipo). */
  fallo: FalloConexion
  /** Envía por WS; false si no hay conexión (usar HTTP de respaldo). */
  enviarMensaje: (destinatarioId: number, texto: string) => boolean
  /** Suscribe el hilo abierto: sus mensajes llegan aquí sin toast. */
  suscribirHilo: (convId: number | null, onMensaje: (m: MensajeVivo) => void) => () => void
  /** Relee contadores (tras abrir hilo, enviar, etc.). */
  refrescar: () => void
}

const NotificacionesContext = createContext<NotificacionesValor | null>(null)

/** Estilo base de toasts de notificación (fondo blanco, título guinda). */
function toastNotificacion(kind: 'info' | 'success', title: string, description: string) {
  const base = {
    title,
    description,
    fill: '#ffffff',
    duration: 6000,
    autopilot: true,
    styles: {
      title: 'text-guinda text-sm font-semibold text-center',
      description: 'text-xs text-center text-gray-700',
    },
  }
  if (kind === 'success') sileo.success(base)
  else sileo.info(base)
}

/** Clasifica un error de lectura en FalloConexion. */
function clasificar(err: unknown): FalloConexion {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) return 'auth'
    if (err.isNetwork || err.status >= 500 || err.status === 0) return 'red'
    return 'red'
  }
  // Respuesta no-JSON (ej. index.html si /api no existe en ese host) = backend inalcanzable.
  return 'red'
}

export function NotificacionesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const token = getToken() ?? undefined
  const esRespaldo = token?.startsWith('respaldo-') ?? false

  const [chatsNuevos, setChatsNuevos] = useState(0)
  const [paquetesNuevos, setPaquetesNuevos] = useState(0)
  const [conectado, setConectado] = useState(false)
  const [fallo, setFallo] = useState<FalloConexion>('ninguno')

  const chatCtl = useRef<ReturnType<typeof conectarChat> | null>(null)
  /** Conversación abierta en la página Chats (sus mensajes no generan toast). */
  const hiloAbiertoRef = useRef<number | null>(null)
  /** Handler del hilo abierto (lo pone Chats vía suscribirHilo). */
  const hiloHandlerRef = useRef<((m: MensajeVivo) => void) | null>(null)
  /** Último directorio de conversaciones (para nombrar al remitente en el toast). */
  const nombresRef = useRef<Map<number, string>>(new Map())

  /** Relee contadores de no leídos; clasifica el fallo si la lectura falla. */
  const refrescar = useCallback(() => {
    const t = getToken() ?? undefined
    if (!user || !t) {
      setChatsNuevos(0)
      setPaquetesNuevos(0)
      setFallo('ninguno')
      return
    }
    if (t.startsWith('respaldo-')) {
      // Sesión de respaldo: FastAPI va a rechazar todo con 401; no spamear la red.
      setFallo('respaldo')
      return
    }
    Promise.all([
      listarConversaciones(t).then((r) => r.data ?? []),
      paquetesRecibidos(t).then((r) => r.data ?? []),
      respuestasRecibidas(t).then((r) => r.data ?? []),
    ]).then(
      ([convs, paqs, resps]) => {
        setChatsNuevos(convs.reduce((a, c) => a + (c.no_leidos ?? 0), 0))
        setPaquetesNuevos(paqs.filter((p) => !p.leido).length + resps.filter((p) => !p.leido).length)
        const nombres = new Map<number, string>()
        for (const c of convs) {
          const n = `${c.nombres ?? ''} ${c.apellidos ?? ''}`.trim()
          nombres.set(c.id, n || c.username)
        }
        nombresRef.current = nombres
        setFallo('ninguno')
      },
      (err) => setFallo(clasificar(err)),
    )
  }, [user])

  // Carga inicial + refresco periódico de contadores (30s).
  useEffect(() => {
    if (!user) return
    void refrescar()
    const id = window.setInterval(() => void refrescar(), 30000)
    return () => window.clearInterval(id)
  }, [user, token, refrescar])

  // WebSocket único de la sesión: toasts si el hilo no está abierto.
  useEffect(() => {
    if (!user || !token || esRespaldo) {
      setConectado(false)
      return
    }
    const ctl = conectarChat(
      token,
      (ev: EventoChat) => {
        if (ev.tipo === 'mensaje') {
          if (hiloAbiertoRef.current === ev.conversacion_id) {
            hiloHandlerRef.current?.({
              id: ev.id,
              conversacion_id: ev.conversacion_id,
              remitente_id: ev.remitente_id,
              texto: ev.texto,
              fecha: ev.fecha,
            })
            void refrescar()
          } else {
            const quien = nombresRef.current.get(ev.conversacion_id) ?? 'un usuario'
            toastNotificacion('info', 'Nuevo mensaje', `${quien}: ${ev.texto.slice(0, 90)}${ev.texto.length > 90 ? '…' : ''}`)
            void refrescar()
          }
        } else if (ev.tipo === 'paquete') {
          if (ev.es_respuesta) {
            toastNotificacion('success', 'Respuesta de paquete recibida', `De ${ev.de ?? 'un usuario'} (${ev.total ?? 0} fichas). Revísala en Paquetes → Respuestas.`)
          } else {
            toastNotificacion('success', 'Paquete de fichas recibido', `De ${ev.de ?? 'un usuario'} (${ev.total ?? 0}). Revísalo en Paquetes.`)
          }
          void refrescar()
        }
      },
      setConectado,
    )
    chatCtl.current = ctl
    return () => {
      ctl.cerrar()
      chatCtl.current = null
    }
  }, [user, token, esRespaldo, refrescar])

  // Registro Web Push (una vez por sesión; silencioso si no aplica).
  useEffect(() => {
    if (!user || !token || esRespaldo) return
    void registrarPush(token)
  }, [user, token, esRespaldo])

  const enviarMensaje = useCallback((destinatarioId: number, texto: string): boolean => {
    return chatCtl.current?.enviar(destinatarioId, texto) ?? false
  }, [])

  const suscribirHilo = useCallback((convId: number | null, onMensaje: (m: MensajeVivo) => void) => {
    hiloAbiertoRef.current = convId
    hiloHandlerRef.current = onMensaje
    return () => {
      hiloAbiertoRef.current = null
      hiloHandlerRef.current = null
    }
  }, [])

  const valor = useMemo<NotificacionesValor>(
    () => ({ chatsNuevos, paquetesNuevos, conectado, fallo, enviarMensaje, suscribirHilo, refrescar }),
    [chatsNuevos, paquetesNuevos, conectado, fallo, enviarMensaje, suscribirHilo, refrescar],
  )

  return <NotificacionesContext.Provider value={valor}>{children}</NotificacionesContext.Provider>
}

/** Hook de consumo. Debe usarse dentro de NotificacionesProvider. */
export function useNotificaciones(): NotificacionesValor {
  const ctx = useContext(NotificacionesContext)
  if (!ctx) throw new Error('useNotificaciones debe usarse dentro de NotificacionesProvider')
  return ctx
}
