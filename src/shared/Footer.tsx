/**
 * @file Footer.tsx
 * @description Pie de página institucional. Muestra el slogan/imagen clickeable
 * que funciona como acceso al panel de administración: si ya hay sesión redirige
 * a `/admin`, si no abre el `LoginModal`. Incluye mosaico decorativo, leyenda
 * "Plataforma Ciudadana para Solicitar Obras Públicas" y copyright con año dinámico.
 * Gestiona el estado `loginOpen` para controlar el modal y usa `key={String(loginOpen)}`
 * para forzar remount y reset del formulario al reabrir.
 *
 * @uso Renderizado por `Layout` como footer global, debajo del `<main>`.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import slogan from '../assets/slogan.svg'
import mosaico from '../assets/mosaico.svg'
import LoginModal from './LoginModal'
import { useAuth } from '../contexts/AuthContext'

/**
 * Componente Footer — pie de página con acceso a login y branding.
 */
export default function Footer() {
  // Usuario autenticado (null si no hay sesión)
  const { user } = useAuth()
  const navigate = useNavigate()
  /** Controla si el modal de login está visible. */
  const [loginOpen, setLoginOpen] = useState(false)

  return (
    <footer className="border-t border-alabaster-dark/50 bg-white/50 backdrop-blur-sm">
      {/* Modal de inicio de sesión — key fuerza remount al alternar open para limpiar estado interno */}
      <LoginModal key={String(loginOpen)} open={loginOpen} onClose={() => setLoginOpen(false)} />
      <div className="mx-auto max-w-[1400px] px-4 py-8 text-center md:px-8 lg:px-12">
        <div className="flex flex-col items-center gap-3">
          {/* Imagen slogan clickeable: si hay sesión va a /admin, si no abre login */}
          <button
            type="button"
            onClick={() => {
              if (user) { navigate('/admin'); return }
              setLoginOpen(true)
            }}
            className="transition-opacity hover:opacity-80"
            title={user ? `Admin: ${user.username}` : 'Iniciar sesión'}
          >
            <img src={slogan} alt="Iniciar sesión" className="w-[210px] h-auto" />
          </button>
          {/* Mosaico decorativo institucional */}
          <img src={mosaico} alt="" className="contrast-mosaico w-auto h-auto" />
          {/* Leyenda descriptiva de la plataforma */}
          <p className="text-xs text-gray-institutional/70">
            Plataforma Ciudadana para Solicitar Obras Públicas
          </p>
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-institutional/50">
          <span className="h-3 w-px bg-alabaster-dark" />
          {/* Año dinámico para copyright */}
          <span>Todos los derechos reservados &copy; {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  )
}
