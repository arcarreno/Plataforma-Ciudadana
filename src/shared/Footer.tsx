import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import slogan from '../assets/slogan.svg'
import mosaico from '../assets/mosaico.svg'
import LoginModal from './LoginModal'
import { useAuth } from '../contexts/AuthContext'

export default function Footer() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loginOpen, setLoginOpen] = useState(false)

  return (
    <footer className="border-t border-alabaster-dark/50 bg-white/50 backdrop-blur-sm">
      <LoginModal key={String(loginOpen)} open={loginOpen} onClose={() => setLoginOpen(false)} />
      <div className="mx-auto max-w-[1400px] px-4 py-8 text-center md:px-8 lg:px-12">
        <div className="flex flex-col items-center gap-3">
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
          <img src={mosaico} alt="" className="contrast-mosaico w-auto h-auto" />
          <p className="text-xs text-gray-institutional/70">
            Plataforma Ciudadana para Solicitar Obras Públicas
          </p>
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-institutional/50">
          <span className="h-3 w-px bg-alabaster-dark" />
          <span>Todos los derechos reservados &copy; {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  )
}
