import slogan from '../assets/slogan.svg'
import mosaico from '../assets/mosaico.svg'

export default function Footer() {
  return (
    <footer className="border-t border-alabaster-dark/50 bg-white/50 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 py-8 text-center md:px-6">
        <div className="flex flex-col items-center gap-3">
          <img src={slogan} alt="" className="w-[210px] h-auto" />
          <img src={mosaico} alt="" className="w-auto h-auto" />
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
