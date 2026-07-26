import { Link } from 'react-router-dom'
import { ClipboardList, MapPin, FileText, Shield } from 'lucide-react'
import Button from '../shared/Button'
import Card from '../shared/Card'
import { useAuth } from '../contexts/AuthContext'
import { nombreCompleto, esCargoPublico } from '../types/auth'
import logoSemovinfra from '../assets/Logo_Semovinfra.jpg'
import mosaico from '../assets/elemento-Mosaico.svg'

const features = [
  {
    icon: ClipboardList,
    title: 'Solicita obras',
    desc: 'Reporta la necesidad de una obra pública en tu colonia de forma rápida y sencilla.',
  },
  {
    icon: MapPin,
    title: 'Ubicación en mapa',
    desc: 'Señala exactamente el lugar usando el mapa interactivo, sin escribir coordenadas.',
  },
  {
    icon: FileText,
    title: 'Acuse con QR',
    desc: 'Recibe tu comprobante con código QR por correo y descárgalo al instante.',
  },
  {
    icon: Shield,
    title: 'Seguimiento',
    desc: 'Consulta el estatus de tu solicitud con tu número de folio en cualquier momento.',
  },
]

const steps = [
  {
    number: '01',
    title: 'Registro',
    desc: 'Llena el formulario con tus datos y selecciona la ubicación en el mapa.',
  },
  {
    number: '02',
    title: 'Evidencia',
    desc: 'Sube fotos o un PDF como evidencia para fortalecer tu solicitud.',
  },
  {
    number: '03',
    title: 'Acuse',
    desc: 'Recibe tu comprobante con folio y código QR por correo y descárgalo.',
  },
]

export default function Inicio() {
  const { user } = useAuth()
  const esCargo = user && esCargoPublico(user.rol)

  return (
    <div className="flex flex-col gap-12 py-4 md:py-8">
      {esCargo && (
        <section className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-guinda md:text-4xl">
            Bienvenido {nombreCompleto(user)}
          </h1>
        </section>
      )}

      <section className="text-center">
        <div className="mx-auto mb-6 h-20 w-20 overflow-hidden rounded-full shadow-button">
          <img
            src={logoSemovinfra}
            alt="Semovinfra"
            className="h-full w-full object-cover"
          />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-guinda md:text-5xl">
          Plataforma Ciudadana
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-gray-institutional/80">
          Solicita obras públicas para tu colonia de manera fácil, rápida y transparente
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link to="/nueva-solicitud">
            <Button size="lg">
              <ClipboardList className="mr-2 h-5 w-5" />
              Nueva Solicitud
            </Button>
          </Link>
          <Link to="/consultar-folio">
            <Button variant="secondary" size="lg">
              <FileText className="mr-2 h-5 w-5" />
              Consultar Folio
            </Button>
          </Link>
        </div>
      </section>

      <section className="relative -mx-4 py-8 md:-mx-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url(${mosaico})`,
            backgroundRepeat: 'repeat',
            backgroundPosition: 'center',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, rgba(0,0,0,0.85) 25%, rgba(0,0,0,0.5) 50%, transparent 75%)',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, rgba(0,0,0,0.85) 25%, rgba(0,0,0,0.5) 50%, transparent 75%)',
          }}
        />
        <div className="relative z-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <Card key={f.title} hover>
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-guinda/10">
                <f.icon className="h-6 w-6 text-guinda" aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-guinda">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-institutional/70">
                {f.desc}
              </p>
            </div>
          </Card>
        ))}
        </div>
      </section>

      <section>
        <h2 className="text-center text-2xl font-bold tracking-tight text-guinda">
          ¿Cómo funciona?
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-gray-institutional/70">
          Tres pasos simples para realizar tu solicitud
        </p>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.number} className="relative text-center">
              {i < steps.length - 1 && (
                <div className="absolute right-0 top-8 hidden h-px w-[calc(50%-2rem)] bg-gradient-to-r from-guinda/20 to-guinda/40 md:block" />
              )}
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-guinda/5 text-xl font-bold text-guinda">
                {step.number}
              </span>
              <h3 className="mt-4 font-semibold text-guinda">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-institutional/70">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
