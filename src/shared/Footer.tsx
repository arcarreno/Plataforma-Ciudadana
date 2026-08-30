/**
 * @file Footer.tsx
 * @description Pie de página institucional. Mantiene el estilo guinda/alabaster y añade
 * 4 bloques: Contacto SEMOVINFRA, Legal, Sitios de interés y Ayuda rápida, más redes
 * y barra final con Municipio 2024–2027. El slogan sigue siendo acceso a login (/admin).
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone } from 'lucide-react'

// Iconos oficiales del Ayuntamiento (pueblacapital.gob.mx/images/pages/general/iconos/)
const IconoFacebook = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="M12,0C5.37,0,0,5.37,0,12s5.37,12,12,12,12-5.37,12-12S18.63,0,12,0ZM15,8h-1.35c-.54,0-.65.22-.65.78v1.22h2l-.21,2h-1.79v7h-3v-7h-2v-2h2v-2.31c0-1.77.93-2.69,3.03-2.69h1.97v3Z"/></svg>
)
const IconoX = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="m12.41,11.45c-1.11-1.51-2.12-3.08-3.28-4.59-.03-.07-.1-.1-.2-.1h-1.41s-.2,0-.1.1c.61.81,1.11,1.61,1.77,2.47,1.82,2.62,3.68,5.3,5.5,7.92.07.07.13.1.2.1h1.6s0-.1-.1-.2c-1.31-1.92-2.62-3.78-3.98-5.7Z" /><path d="m12,0C5.37,0,0,5.37,0,12s5.37,12,12,12,12-5.37,12-12S18.63,0,12,0Zm5.9,18.05h-3.38c-.07,0-.13-.03-.2-.1-1.01-1.51-2.02-2.93-3.08-4.49h-.1c-1.31,1.51-2.52,3.08-3.88,4.49l-.05.1h-.91l.1-.1c1.41-1.71,2.93-3.38,4.39-5.09.1-.1,0-.2,0-.2,0,.1-3.18-4.49-4.69-6.71h3.38c.07,0,.13.03.2.1,1.01,1.41,2.93,4.29,2.93,4.29h.1c1.21-1.41,2.42-2.82,3.68-4.29.07-.07.13-.1.2-.1h.91l-.1.1c-1.41,1.61-2.82,3.28-4.19,4.89-.07.07-.07.13,0,.2,1.31,1.92,2.62,3.88,3.98,5.8.2.3.5.71.71,1.01v.1Z" /></svg>
)
const IconoInstagram = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="M14.83,6.3c-.74-.03-.96-.04-2.83-.04s-2.09,0-2.83.04c-1.9.09-2.78.99-2.87,2.87-.03.74-.04.96-.04,2.83s0,2.09.04,2.83c.09,1.88.97,2.78,2.87,2.87.74.03.96.04,2.83.04s2.09,0,2.83-.04c1.9-.09,2.78-.99,2.87-2.87.03-.74.04-.96.04-2.83s0-2.09-.04-2.83c-.09-1.88-.97-2.78-2.87-2.87ZM12,15.6c-1.98,0-3.6-1.61-3.6-3.6s1.61-3.59,3.6-3.59,3.6,1.61,3.6,3.59-1.61,3.6-3.6,3.6ZM15.74,9.1c-.46,0-.84-.38-.84-.84s.38-.84.84-.84.84.38.84.84-.38.84-.84.84ZM14.33,12c0,1.29-1.05,2.33-2.33,2.33s-2.33-1.04-2.33-2.33,1.05-2.33,2.33-2.33,2.33,1.04,2.33,2.33ZM12,0C5.37,0,0,5.37,0,12s5.37,12,12,12,12-5.37,12-12S18.63,0,12,0ZM18.96,14.89c-.11,2.55-1.53,3.95-4.07,4.07-.75.03-.99.04-2.89.04s-2.14,0-2.89-.04c-2.54-.12-3.95-1.53-4.07-4.07-.03-.75-.04-.98-.04-2.89s0-2.14.04-2.89c.12-2.54,1.53-3.95,4.07-4.07.75-.03.98-.04,2.89-.04s2.14,0,2.89.04c2.54.12,3.96,1.53,4.07,4.07.03.75.04.98.04,2.89s0,2.14-.04,2.89Z"/></svg>
)
const IconoYouTube = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="M12,0C5.37,0,0,5.37,0,12s5.37,12,12,12,12-5.37,12-12S18.63,0,12,0ZM16.44,16.89c-2.1.14-6.78.14-8.88,0-2.28-.16-2.54-1.27-2.56-4.89.02-3.63.28-4.74,2.56-4.89,2.1-.14,6.78-.14,8.88,0,2.28.16,2.54,1.27,2.56,4.89-.02,3.63-.28,4.74-2.56,4.89ZM10,9.66l4.92,2.34-4.92,2.35v-4.68Z"/></svg>
)
import slogan from '../assets/slogan.svg'
import mosaico from '../assets/mosaico.svg'
import LoginModal from './LoginModal'
import AvisoPrivacidad from './AvisoPrivacidad'
import { useAuth } from '../contexts/AuthContext'

export default function Footer() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loginOpen, setLoginOpen] = useState(false)
  const [avisoOpen, setAvisoOpen] = useState(false)
  const [terminosOpen, setTerminosOpen] = useState(false)
  const [cookiesOpen, setCookiesOpen] = useState(false)

  return (
    <footer className="border-t border-alabaster-dark/50 bg-white/50 backdrop-blur-sm">
      <LoginModal key={String(loginOpen)} open={loginOpen} onClose={() => setLoginOpen(false)} />
      {avisoOpen && <AvisoPrivacidad onClose={() => setAvisoOpen(false)} />}

      {/* Modales simples para Términos y Cookies (reutilizan estilo Aviso) */}
      {terminosOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={() => setTerminosOpen(false)}>
          <div className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onClick={e => e.stopPropagation()}>
            <h2 className="mb-4 text-xl font-bold text-guinda">Términos y Condiciones</h2>
            <div className="space-y-3 text-sm leading-relaxed text-gray-institutional/80">
              <p>Al utilizar la Plataforma Ciudadana de SEMOVINFRA aceptas los términos publicados en el modal de consentimiento (Paso 2). Incluyen uso legítimo, veracidad, protección de datos, conductas prohibidas y medidas por mal uso o intentos de intrusión (suspensión temporal o definitiva con derecho a revisión ante Transparencia).</p>
              <p>Para revisión de un bloqueo acude a la Unidad de Transparencia del Municipio de Puebla.</p>
            </div>
            <button className="mt-6 w-full rounded-xl bg-guinda px-4 py-3 text-sm font-semibold text-white hover:bg-guinda/90" onClick={() => setTerminosOpen(false)}>Cerrar</button>
          </div>
        </div>
      )}
      {cookiesOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={() => setCookiesOpen(false)}>
          <div className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onClick={e => e.stopPropagation()}>
            <h2 className="mb-4 text-xl font-bold text-guinda">Aviso de Cookies</h2>
            <div className="space-y-3 text-sm leading-relaxed text-gray-institutional/80">
              <p>Usamos cookies necesarias (sesión, seguridad, mapa), de preferencias (tamaño de letra, contraste) y analíticas anónimas. Al continuar aceptas su uso. Puedes borrarlas en tu navegador.</p>
            </div>
            <button className="mt-6 w-full rounded-xl bg-guinda px-4 py-3 text-sm font-semibold text-white hover:bg-guinda/90" onClick={() => setCookiesOpen(false)}>Cerrar</button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8 lg:px-12">
        {/* Slogan primero */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <button type="button" onClick={() => { if (user) navigate('/admin'); else setLoginOpen(true)}} className="transition-opacity hover:opacity-80" title={user ? `Admin: ${user.username}` : 'Iniciar sesión'}>
            <img src={slogan} alt="Iniciar sesión" className="w-[260px] h-auto" />
          </button>
          <img src={mosaico} alt="" className="contrast-mosaico w-auto h-auto" />
          <p className="text-xs text-gray-institutional/70">Plataforma Ciudadana para Solicitar Obras Públicas</p>
        </div>

        {/* Grid 4 columnas */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* 1. Contacto SEMOVINFRA */}
          <div>
            <h3 className="mb-3 text-sm font-bold tracking-wide text-guinda">Secretaría de Movilidad e Infraestructura</h3>
            <p className="text-xs leading-relaxed text-gray-institutional/70">
              Prolongación Reforma 3308<br />
              Col. Amor, CP 72140<br />
              Puebla, Pue.
            </p>
            <p className="mt-3 text-xs text-gray-institutional/70">
              Tel. <a href="tel:+522223034400" className="text-guinda hover:underline">222 303 44 00</a><br />
              <a href="mailto:movilidad@ayuntamientopuebla.gob.mx" className="text-guinda hover:underline">movilidad@ayuntamientopuebla.gob.mx</a>
            </p>
            <p className="mt-2 text-xs text-gray-institutional/50">Tel. central Ayuntamiento: 222 309 44 00</p>
          </div>

          {/* 2. Legal */}
          <div>
            <h3 className="mb-3 text-sm font-bold tracking-wide text-guinda">Legal</h3>
            <ul className="space-y-2 text-xs">
              <li><button onClick={() => setAvisoOpen(true)} className="text-left text-gray-institutional/70 hover:text-guinda hover:underline">Aviso de Privacidad</button></li>
              <li><button onClick={() => setTerminosOpen(true)} className="text-left text-gray-institutional/70 hover:text-guinda hover:underline">Términos y Condiciones</button></li>
              <li><button onClick={() => setCookiesOpen(true)} className="text-left text-gray-institutional/70 hover:text-guinda hover:underline">Aviso de Cookies</button></li>
              <li><a href="https://gobiernodelaciudad.pueblacapital.gob.mx/" target="_blank" rel="noopener noreferrer" className="text-gray-institutional/70 hover:text-guinda hover:underline">Transparencia</a></li>
            </ul>
          </div>

          {/* 3. Sitios de interés */}
          <div>
            <h3 className="mb-3 text-sm font-bold tracking-wide text-guinda">Sitios de interés</h3>
            <ul className="space-y-2 text-xs">
              <li><a href="https://www.pueblacapital.gob.mx/" target="_blank" rel="noopener noreferrer" className="text-gray-institutional/70 hover:text-guinda hover:underline">Ayuntamiento de Puebla</a></li>
              <li><a href="https://www.gob.mx/" target="_blank" rel="noopener noreferrer" className="text-gray-institutional/70 hover:text-guinda hover:underline">Gobierno Federal</a></li>
              <li><a href="https://www.puebla.gob.mx/" target="_blank" rel="noopener noreferrer" className="text-gray-institutional/70 hover:text-guinda hover:underline">Gobierno del Estado de Puebla</a></li>
              <li><a href="https://www.gob.mx/curp/" target="_blank" rel="noopener noreferrer" className="text-gray-institutional/70 hover:text-guinda hover:underline">Consulta tu CURP</a></li>
            </ul>
          </div>

          {/* 4. Ayuda rápida + Redes */}
          <div>
            <h3 className="mb-3 text-sm font-bold tracking-wide text-guinda">Ayuda rápida</h3>
            <ul className="space-y-2 text-xs">
              <li><a href="tel:072" className="flex items-center gap-2 text-gray-institutional/70 hover:text-guinda"><Phone className="h-3.5 w-3.5" /> 072 — Baches / Luminarias</a></li>
              <li><a href="tel:089" className="flex items-center gap-2 text-gray-institutional/70 hover:text-guinda"><Phone className="h-3.5 w-3.5" /> 089 — Denuncia anónima</a></li>
              <li><a href="tel:911" className="flex items-center gap-2 text-gray-institutional/70 hover:text-guinda"><Phone className="h-3.5 w-3.5" /> 911 — Emergencias</a></li>
            </ul>
            <div className="mt-4 flex gap-3">
              <a href="https://www.facebook.com/p/Secretar%C3%ADa-de-Movilidad-e-Infraestructura-100064666872852" target="_blank" rel="noopener noreferrer" aria-label="Facebook Secretaría de Movilidad e Infraestructura" className="flex h-8 w-8 items-center justify-center rounded-full border border-alabaster-dark text-gray-institutional/60 hover:border-guinda hover:text-guinda"><IconoFacebook /></a>
              <a href="https://x.com/PueblaAyto" target="_blank" rel="noopener noreferrer" aria-label="X Secretaría de Movilidad e Infraestructura" className="flex h-8 w-8 items-center justify-center rounded-full border border-alabaster-dark text-gray-institutional/60 hover:border-guinda hover:text-guinda"><IconoX /></a>
              <a href="https://www.instagram.com/pueblagobiernodelaciudad/" target="_blank" rel="noopener noreferrer" aria-label="Instagram Secretaría de Movilidad e Infraestructura" className="flex h-8 w-8 items-center justify-center rounded-full border border-alabaster-dark text-gray-institutional/60 hover:border-guinda hover:text-guinda"><IconoInstagram /></a>
              <a href="https://www.youtube.com/@AyuntamientodePueblaAyto" target="_blank" rel="noopener noreferrer" aria-label="YouTube Secretaría de Movilidad e Infraestructura" className="flex h-8 w-8 items-center justify-center rounded-full border border-alabaster-dark text-gray-institutional/60 hover:border-guinda hover:text-guinda"><IconoYouTube /></a>
            </div>
          </div>
        </div>

        {/* Leyenda + mosaico (slogan ya está arriba) */}
        <div className="mt-8 flex flex-col items-center gap-2 border-t border-alabaster-dark/30 pt-6">
          <img src={mosaico} alt="" className="contrast-mosaico w-auto h-auto" />
          <p className="text-xs text-gray-institutional/50">Municipio de Puebla — Gobierno Municipal 2024–2027</p>
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-institutional/50">
          <span>Todos los derechos reservados &copy; {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  )
}
