/**
 * @file PasswordSetupModal.tsx
 * @description Modal para crear la contraseña tras verificar el correo institucional.
 * Se usa en dos lugares: la ruta `/verificar?token=` (dispositivo que abrió el
 * enlace) y el flujo de registro en `LoginModal` (la computadora detecta vía
 * polling que el token ya se verificó y abre este mismo modal: plus asíncrono).
 *
 * Diseño pedido:
 * - Encabezado guinda arriba, mitad inferior blanca con efecto entrecortado
 *   (zigzag vía `clip-path`) y logo de Semovinfra centrado a caballo del corte.
 * - Saludo "Bienvenido/a {Rol} {nombre}" con el nombre del directorio; si el
 *   correo no está en el directorio, pide el nombre en un campo.
 * - 2 recuadros: contraseña + confirmar. Checklist en vivo de reglas:
 *   cumplida -> verde institucional `#41504D`, pendiente -> `#6f1728`.
 * - Al guardar llama `completarRegistro` (single-use en servidor) y devuelve
 *   la sesión para auto-login.
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Lock, User, X, Eye, EyeOff } from 'lucide-react'
import {
  completarRegistro,
  reglasCumplidas,
  REGLAS_PASSWORD,
  type ReglaPassword,
} from '../lib/registro'
import logoSemovinfra from '../assets/Logo_Semovinfra.jpg'

/** Etiqueta de rol con género cuando se conoce, o forma neutra a/b. */
export function etiquetaRol(rol: string, genero?: string): string {
  const base: Record<string, [string, string]> = {
    diputado: ['Diputado', 'Diputada'],
    senador: ['Senador', 'Senadora'],
    legislador: ['Legislador', 'Legisladora'],
    revisor: ['Revisor', 'Revisora'],
    admin: ['Administrador', 'Administradora'],
  }
  const par = base[rol]
  if (!par) return rol
  if (genero === 'mujer') return par[1]
  if (genero === 'hombre') return par[0]
  return `${par[0]}/a`
}

interface PasswordSetupModalProps {
  /** Visible o no (si false no se monta). */
  open: boolean
  /** Token de verificación ya validado. */
  token: string
  /** Correo verificado (solo lectura, informativo). */
  email: string
  /** Rol derivado del dominio. */
  rol: string
  /** Nombre del directorio, o '' si no está listado. */
  nombreSugerido: string
  /** Si el correo está en el directorio (nombre bloqueado). */
  enDirectorio: boolean
  /** Género del directorio para el saludo (opcional). */
  genero?: string
  /** Al completar: recibe sesión (token, id, username, email, rol, nombres, apellidos). */
  onDone: (sesion: { token: string; id: number; username: string; email: string; rol: string; nombres: string; apellidos: string }) => void
  /** Si el token ya fue usado en otro dispositivo (410): el padre muestra login. */
  onUsado: () => void
  /** Cierre voluntario (X). */
  onClose: () => void
}

export default function PasswordSetupModal({
  open, token, email, rol, nombreSugerido, enDirectorio, genero, onDone, onUsado, onClose,
}: PasswordSetupModalProps) {
  const [nombre, setNombre] = useState(nombreSugerido)
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const cumplidas = reglasCumplidas(password)
  const coincide = password.length > 0 && password === confirmar
  const todoOk = cumplidas.length === REGLAS_PASSWORD.length && coincide
  const nombreOk = enDirectorio || nombre.trim().length >= 3

  const saludo = genero === 'mujer' ? 'Bienvenida' : genero === 'hombre' ? 'Bienvenido' : 'Te damos la bienvenida'

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombreOk) {
      setError('Escribe tu nombre completo')
      return
    }
    if (!todoOk) {
      setError('Revisa los requisitos de la contraseña')
      return
    }
    setLoading(true)
    setError('')
    const res = await completarRegistro(token, password, enDirectorio ? '' : nombre.trim())
    setLoading(false)
    if (res.error) {
      if (res.status === 410) {
        onUsado()
        return
      }
      setError(res.error)
      return
    }
    if (res.data) onDone(res.data)
  }

  const itemRegla = (clave: ReglaPassword, etiqueta: string, ok: boolean) => (
    <li key={clave} className="flex items-center gap-2 text-xs font-medium" style={{ color: ok ? '#41504D' : '#6f1728' }}>
      <span
        className="flex h-4 w-4 items-center justify-center rounded-full"
        style={{ backgroundColor: ok ? '#41504D' : 'transparent', border: `1.5px solid ${ok ? '#41504D' : '#6f1728'}` }}
      >
        {ok ? <Check className="h-3 w-3 text-white" /> : <X className="h-3 w-3" style={{ color: '#6f1728' }} />}
      </span>
      {etiqueta}
    </li>
  )

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-xl p-1.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Encabezado guinda con corte entrecortado */}
        <div className="bg-guinda px-6 pb-10 pt-6 text-center">
          <h2 className="text-lg font-semibold text-white">Crea tu contraseña</h2>
          <p className="mt-1 text-xs text-white/70">{email}</p>
        </div>
        {/* Zigzag blanco sobre el guinda (efecto entrecortado) */}
        <div
          aria-hidden="true"
          className="-mt-5 h-6 bg-white"
          style={{
            clipPath:
              'polygon(0 100%, 0 60%, 4% 20%, 8% 60%, 12% 20%, 16% 60%, 20% 20%, 24% 60%, 28% 20%, 32% 60%, 36% 20%, 40% 60%, 44% 20%, 48% 60%, 52% 20%, 56% 60%, 60% 20%, 64% 60%, 68% 20%, 72% 60%, 76% 20%, 80% 60%, 84% 20%, 88% 60%, 92% 20%, 96% 60%, 100% 20%, 100% 100%)',
          }}
        />
        {/* Logo a caballo del corte */}
        <div className="-mt-9 mb-2 flex justify-center">
          <img
            src={logoSemovinfra}
            alt="Semovinfra"
            className="h-16 w-16 rounded-full border-4 border-white object-cover shadow-lg"
          />
        </div>

        <form onSubmit={guardar} className="flex flex-col gap-4 px-6 pb-6">
          <p className="text-center text-sm text-gray-institutional">
            {saludo} <strong className="text-guinda">{etiquetaRol(rol, genero)}</strong>
            {(enDirectorio ? nombreSugerido : nombre.trim()) && (
              <> <strong className="text-guinda">{enDirectorio ? nombreSugerido : nombre.trim()}</strong></>
            )}
          </p>

          {/* Nombre solo si NO está en el directorio */}
          {!enDirectorio && (
            <div className="flex items-center gap-3 rounded-xl bg-alabaster/30 px-4">
              <User className="h-5 w-5 shrink-0 text-gray-institutional/50" />
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre completo"
                autoFocus
                className="w-full rounded-xl bg-transparent py-3 text-sm text-gray-institutional outline-none placeholder:text-gray-institutional/30 focus:ring-2 focus:ring-guinda"
              />
            </div>
          )}

          {/* Contraseña */}
          <div className="flex items-center gap-3 rounded-xl bg-alabaster/30 px-4">
            <Lock className="h-5 w-5 shrink-0 text-gray-institutional/50" />
            <input
              type={verPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              autoComplete="new-password"
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

          {/* Confirmar */}
          <div className="flex items-center gap-3 rounded-xl bg-alabaster/30 px-4">
            <Lock className="h-5 w-5 shrink-0 text-gray-institutional/50" />
            <input
              type={verPassword ? 'text' : 'password'}
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="Confirma tu contraseña"
              autoComplete="new-password"
              className="w-full rounded-xl bg-transparent py-3 text-sm text-gray-institutional outline-none placeholder:text-gray-institutional/30 focus:ring-2 focus:ring-guinda"
            />
          </div>

          {/* Checklist en vivo */}
          <ul className="flex flex-col gap-1.5 rounded-xl bg-alabaster/30 px-4 py-3">
            {REGLAS_PASSWORD.map((r) => itemRegla(r.clave, r.etiqueta, cumplidas.includes(r.clave)))}
            <li className="flex items-center gap-2 text-xs font-medium" style={{ color: coincide ? '#41504D' : '#6f1728' }}>
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full"
                style={{ backgroundColor: coincide ? '#41504D' : 'transparent', border: `1.5px solid ${coincide ? '#41504D' : '#6f1728'}` }}
              >
                {coincide ? <Check className="h-3 w-3 text-white" /> : <X className="h-3 w-3" style={{ color: '#6f1728' }} />}
              </span>
              Ambas contraseñas coinciden
            </li>
          </ul>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || !todoOk || !nombreOk}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-guinda px-6 py-3 text-sm font-medium text-white shadow-button transition-all duration-200 hover:brightness-110 active:brightness-90 disabled:opacity-50"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {loading ? 'Guardando…' : 'Guardar y entrar'}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  )
}
