/**
 * @file ContenidoAcceso.tsx
 * @description Contenido de acceso (sin contenedor ni portal): tres modos
 * - `login`: correo (o usuario legacy) + contraseña -> `iniciarSesion`.
 * - `registro`: solo correos institucionales (`@diputados.gob.mx`,
 *   `@congresodepuebla.mx`, `@ayuntamientopuebla.gob.mx`, `@senado.gob.mx`).
 *   Crea el pendiente, envía correo de verificación y entra en modo `revisa`.
 * - `revisa`: "revisa tu correo" + polling cada 3s a `estadoRegistro`. Cuando
 *   el token se verifica en OTRO dispositivo (el teléfono), esta misma vista
 *   abre `PasswordSetupModal` sin recargar (plus asíncrono). Si el otro lado
 *   completó primero (`usado`), muestra aviso para iniciar sesión.
 *
 * Lo usan `LoginModal` (dentro de card + portal) y la página `/iniciar-sesion`
 * (directo, sin card). Al autenticar llama `onAutenticado` y el padre decide
 * (cerrar modal o navegar); cada montaje parte de estados frescos.
 */

import { useEffect, useRef, useState } from 'react'
import { LogIn, Lock, User, Mail, MailCheck, UserPlus, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  iniciarRegistro,
  estadoRegistro,
  verificarRegistro,
  dominioDe,
  esDominioPermitido,
  pideNombreManual,
  rolParaEmail,
  DOMINIO_DIRECTORIO,
  DOMINIOS_INFO,
  type RegistroVerificado,
} from '../lib/registro'
import {
  buscarEnDirectorioLocal,
  type EntradaDirectorioLocal,
} from '../data/directorios'
import PasswordSetupModal, { etiquetaRol } from './PasswordSetupModal'
import logoSemovinfra from '../assets/Logo_Semovinfra.jpg'

/** Props del contenido de acceso. */
interface ContenidoAccesoProps {
  /** Se llama al autenticar con éxito (cerrar modal o navegar, según el padre). */
  onAutenticado: () => void
}

type Modo = 'login' | 'registro' | 'revisa'

/**
 * Polling del estado del token (modo `revisa`).
 * Componente separado para no reiniciar el intervalo en cada render del padre.
 */
function PollingEstado({ token, onVerificado, onUsado }: {
  token: string
  onVerificado: () => void
  onUsado: () => void
}) {
  const verificadoRef = useRef(onVerificado)
  const usadoRef = useRef(onUsado)
  verificadoRef.current = onVerificado
  usadoRef.current = onUsado
  useEffect(() => {
    if (!token) return
    let vivo = true
    const id = window.setInterval(async () => {
      const res = await estadoRegistro(token)
      if (!vivo || res.error || !res.data) return
      if (res.data.usado) {
        window.clearInterval(id)
        if (vivo) usadoRef.current()
        return
      }
      if (res.data.verificado) {
        window.clearInterval(id)
        if (vivo) verificadoRef.current()
      }
    }, 3000)
    return () => {
      vivo = false
      window.clearInterval(id)
    }
  }, [token])
  return null
}

export default function ContenidoAcceso({ onAutenticado }: ContenidoAccesoProps) {
  const { iniciarSesion, establecerSesion } = useAuth()
  const [modo, setModo] = useState<Modo>('login')

  // --- login ---
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // --- registro ---
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [regError, setRegError] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [token, setToken] = useState('')
  const [rolNuevo, setRolNuevo] = useState('')
  const [hallazgo, setHallazgo] = useState<EntradaDirectorioLocal | null>(null)
  const [dirBuscado, setDirBuscado] = useState(false)
  const [verDominios, setVerDominios] = useState(false)

  // --- modal de contraseña (abierto aquí por polling o en /verificar) ---
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwdDatos, setPwdDatos] = useState<RegistroVerificado | null>(null)
  const [pwdGenero, setPwdGenero] = useState<string | undefined>(undefined)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Ingresa usuario y contraseña')
      return
    }
    setLoading(true)
    setError('')
    try {
      const err = await iniciarSesion(username.trim(), password)
      if (err) {
        setError(err)
        setLoading(false)
        return
      }
      onAutenticado()
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setLoading(false)
    }
  }

  /** Búsqueda local instantánea en el directorio embebido (sin red). */
  const buscarDirectorio = (correo: string) => {
    const dom = dominioDe(correo)
    const tipo = DOMINIO_DIRECTORIO[dom]
    setHallazgo(null)
    setDirBuscado(false)
    if (!tipo) return
    setHallazgo(buscarEnDirectorioLocal(tipo, correo))
    setDirBuscado(true)
  }

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault()
    const correo = email.trim().toLowerCase()
    if (!correo) {
      setRegError('Escribe tu correo institucional')
      return
    }
    if (!esDominioPermitido(correo)) {
      setRegError('Únicamente aceptamos correos institucionales. Revisa abajo la lista de dominios.')
      setVerDominios(true)
      return
    }
    if (pideNombreManual(correo) && nombre.trim().length < 3) {
      setRegError('Escribe tu nombre completo')
      return
    }
    setRegLoading(true)
    setRegError('')
    const res = await iniciarRegistro(correo, pideNombreManual(correo) ? nombre.trim() : '')
    setRegLoading(false)
    if (res.error || !res.data) {
      setRegError(res.error || 'No se pudo iniciar el registro')
      return
    }
    setToken(res.data.token)
    setRolNuevo(res.data.rol)
    setModo('revisa')
  }

  /** Abre el modal de contraseña con datos frescos de verificación. */
  const abrirPassword = async (tok: string) => {
    const res = await verificarRegistro(tok)
    if (res.error || !res.data) return
    setPwdDatos(res.data)
    const tipo = res.data.rol === 'legislador' ? 'legisladores'
      : res.data.rol === 'diputado' ? 'diputados'
      : res.data.rol === 'senador' ? 'senadores' : null
    if (tipo) {
      const hit = buscarEnDirectorioLocal(tipo, res.data.email)
      const g = hit?.genero
      if (typeof g === 'string') setPwdGenero(g)
    }
    setPwdOpen(true)
  }

  const dominioActual = dominioDe(email)
  const mostrarNombre = pideNombreManual(email)
  const mostrarHintDir = esDominioPermitido(email) && DOMINIO_DIRECTORIO[dominioActual]

  return (
    <>
      {modo === 'revisa' && token && (
        <PollingEstado
          token={token}
          onVerificado={() => void abrirPassword(token)}
          onUsado={() => {
            setRegError('Esta cuenta ya completó su registro en otro dispositivo. Inicia sesión.')
            setModo('login')
            setToken('')
          }}
        />
      )}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center">
          <img src={logoSemovinfra} alt="Semovinfra" className="h-14 w-14 rounded-full object-cover" />
        </div>
        <h2 className="text-lg font-semibold text-guinda">
          {modo === 'login' ? 'Iniciar sesión' : modo === 'registro' ? 'Crear cuenta' : 'Revisa tu correo'}
        </h2>
        <p className="mt-1 text-xs text-gray-institutional/60">
          {modo === 'login' && 'Acceso al panel de administración'}
          {modo === 'registro' && 'Solo correos institucionales'}
          {modo === 'revisa' && `Enviamos un enlace a ${email}`}
        </p>
      </div>

      {modo === 'login' && (
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl bg-alabaster/30 px-4">
            <User className="h-5 w-5 shrink-0 text-gray-institutional/50" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Correo electrónico"
              autoFocus
              autoComplete="username"
              className="w-full rounded-xl bg-transparent py-3 text-sm text-gray-institutional outline-none placeholder:text-gray-institutional/30 focus:ring-2 focus:ring-guinda"
            />
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-alabaster/30 px-4">
            <Lock className="h-5 w-5 shrink-0 text-gray-institutional/50" />
            <input
              type={verPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              autoComplete="current-password"
              className="w-full rounded-xl bg-transparent py-3 text-sm text-gray-institutional outline-none placeholder:text-gray-institutional/30 focus:ring-2 focus:ring-guinda"
            />
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="shrink-0 rounded-lg p-1 text-gray-institutional/50 transition-colors hover:text-guinda"
            >
              {verPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-guinda px-6 py-3 text-sm font-medium text-white shadow-button transition-all duration-200 hover:brightness-110 active:brightness-90 disabled:opacity-50"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {loading ? 'Entrando' : 'Entrar'}
          </button>
          <button
            type="button"
            onClick={() => { setError(''); setModo('registro') }}
            className="mx-auto flex items-center gap-1.5 text-xs font-medium text-guinda hover:underline"
          >
            <UserPlus className="h-3.5 w-3.5" />
            ¿No tienes cuenta? Regístrate
          </button>
        </form>
      )}

      {modo === 'registro' && (
        <form onSubmit={handleRegistro} className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl bg-alabaster/30 px-4">
            <Mail className="h-5 w-5 shrink-0 text-gray-institutional/50" />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                const v = e.target.value
                setEmail(v)
                setRegError('')
                // Búsqueda local instantánea mientras escribe (sin red)
                if (esDominioPermitido(v) && DOMINIO_DIRECTORIO[dominioDe(v)]) {
                  buscarDirectorio(v.trim().toLowerCase())
                } else {
                  setHallazgo(null)
                  setDirBuscado(false)
                }
              }}
              placeholder="correo@institucion.gob.mx"
              autoFocus
              autoComplete="email"
              className="w-full rounded-xl bg-transparent py-3 text-sm text-gray-institutional outline-none placeholder:text-gray-institutional/30 focus:ring-2 focus:ring-guinda"
            />
          </div>

          {email.trim() && !esDominioPermitido(email) && (
            <div className="rounded-xl bg-alabaster/30 px-4 py-3 text-xs text-gray-institutional">
              <p>
                Únicamente aceptamos <strong className="text-guinda">correos institucionales</strong>.
              </p>
              <button
                type="button"
                onClick={() => setVerDominios((v) => !v)}
                className="mt-1 font-medium text-guinda hover:underline"
              >
                {verDominios
                  ? 'Ocultar lista de dominios'
                  : 'Presiona aquí para ver la lista de dominios con los que te podrías registrar'}
              </button>
              {verDominios && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {DOMINIOS_INFO.map((d) => (
                    <li
                      key={d.dominio}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
                    >
                      <span className="font-mono text-[11px] text-gray-institutional">@{d.dominio}</span>
                      <span className="rounded-md bg-guinda/10 px-2 py-0.5 text-[11px] font-semibold text-guinda">
                        {etiquetaRol(d.rol)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {email.trim() && esDominioPermitido(email) && (
            <p className="rounded-xl bg-guinda/5 px-4 py-2 text-xs text-guinda">
              {mostrarHintDir && dirBuscado && hallazgo ? (
                <>
                  {(typeof hallazgo.genero === 'string' && hallazgo.genero === 'mujer'
                    ? 'Bienvenida'
                    : typeof hallazgo.genero === 'string' && hallazgo.genero === 'hombre'
                      ? 'Bienvenido'
                      : 'Bienvenido/a')}{' '}
                  {etiquetaRol(
                    rolParaEmail(email),
                    typeof hallazgo.genero === 'string' ? hallazgo.genero : undefined,
                  )}{' '}
                  <strong>{String(hallazgo.nombre)}</strong>
                </>
              ) : (
                <>
                  Te registrarás como <strong>{rolParaEmail(email)}</strong>
                </>
              )}
            </p>
          )}

          {mostrarNombre && (
            <div className="flex items-center gap-3 rounded-xl bg-alabaster/30 px-4">
              <User className="h-5 w-5 shrink-0 text-gray-institutional/50" />
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre completo"
                autoComplete="name"
                className="w-full rounded-xl bg-transparent py-3 text-sm text-gray-institutional outline-none placeholder:text-gray-institutional/30 focus:ring-2 focus:ring-guinda"
              />
            </div>
          )}

          {regError && <p className="text-xs text-red-500">{regError}</p>}
          <button
            type="submit"
            disabled={regLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-guinda px-6 py-3 text-sm font-medium text-white shadow-button transition-all duration-200 hover:brightness-110 active:brightness-90 disabled:opacity-50"
          >
            {regLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {regLoading ? 'Enviando…' : 'Enviar enlace de verificación'}
          </button>
          <button
            type="button"
            onClick={() => { setRegError(''); setModo('login') }}
            className="mx-auto text-xs font-medium text-guinda hover:underline"
          >
            ¿Ya tienes cuenta? Entra
          </button>
        </form>
      )}

      {modo === 'revisa' && (
        <div className="flex flex-col items-center gap-3 text-center">
          <MailCheck className="h-10 w-10 text-guinda" />
          <p className="text-sm text-gray-institutional">
            Te enviamos un enlace de verificación a <strong className="text-guinda">{email}</strong>.
            Ábrelo en este u otro dispositivo: esta ventana detectará la verificación sola.
          </p>
          {regError && <p className="text-xs text-red-500">{regError}</p>}
          <div className="flex items-center gap-2 text-xs text-gray-institutional/60">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-guinda/30 border-t-guinda" />
            Esperando verificación…
          </div>
          <button
            type="button"
            onClick={() => { setToken(''); setModo('registro') }}
            className="mx-auto text-xs font-medium text-guinda hover:underline"
          >
            Usar otro correo
          </button>
        </div>
      )}

      {pwdDatos && (
        <PasswordSetupModal
          open={pwdOpen}
          token={token}
          email={pwdDatos.email}
          rol={pwdDatos.rol || rolNuevo}
          nombreSugerido={pwdDatos.nombre_sugerido}
          enDirectorio={pwdDatos.en_directorio}
          genero={pwdGenero}
          onDone={(sesion) => {
            establecerSesion(
              {
                id: sesion.id,
                username: sesion.username,
                email: sesion.email,
                rol: sesion.rol as 'admin' | 'revisor' | 'diputado' | 'senador' | 'legislador',
                nombres: sesion.nombres,
                apellidos: sesion.apellidos,
              },
              sesion.token,
            )
            onAutenticado()
          }}
          onUsado={() => {
            setPwdOpen(false)
            setRegError('Esta cuenta ya completó su registro en otro dispositivo. Inicia sesión.')
            setModo('login')
            setToken('')
          }}
          onClose={() => setPwdOpen(false)}
        />
      )}
    </>
  )
}
