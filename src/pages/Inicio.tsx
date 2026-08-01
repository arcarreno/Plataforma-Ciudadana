import { useEffect, useState, useRef } from 'react'
import { useSpring } from 'framer-motion'
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
    desc: 'Señala exactamente el lugar usando el mapa interactivo.',
  },
  {
    icon: FileText,
    title: 'Acuse y Ficha',
    desc: 'Recibe tus comprobante por correo y descárgalo al instante.',
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
    desc: 'Recibe tu comprobante con folio y ficha técnica por correo y descárgalo.',
  },
]

const MQ_DESKTOP = '(min-width: 768px)'

export default function Inicio() {
  const { user } = useAuth()
  const esCargo = user && esCargoPublico(user.rol)

  const [activePos, setActivePos] = useState(-1)
  const [rippleActive, setRippleActive] = useState(false)
  const [esMovil, setEsMovil] = useState(() => !window.matchMedia(MQ_DESKTOP).matches)
  const dispRef = useRef<SVGFEDisplacementMapElement>(null)
  const rippleScale = useSpring(3, { stiffness: 180, damping: 15 })

  useEffect(() => {
    const mq = window.matchMedia(MQ_DESKTOP)
    const onChange = () => setEsMovil(!mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (esMovil) return
    return rippleScale.on('change', (v) => {
      dispRef.current?.setAttribute('scale', String(v))
    })
  }, [rippleScale, esMovil])

  useEffect(() => {
    if (esMovil) return
    rippleScale.set(rippleActive ? 28 : 3)
  }, [rippleActive, rippleScale, esMovil])

  useEffect(() => {
    if (esMovil) return
    let pos = 0
    let timer: number

    const tick = () => {
      setActivePos(pos)
      pos++
      if (pos > 10) pos = 0
    timer = window.setTimeout(tick, 300)
    }

    timer = window.setTimeout(tick, 800)
    return () => clearTimeout(timer)
  }, [esMovil])

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
        {!esMovil && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <filter id="mosaico-ripple" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence id="mosaico-noise" type="fractalNoise" baseFrequency="0.008" numOctaves="2" result="wave">
                  <animate attributeName="baseFrequency" values="0.006;0.010;0.006" dur="8s" repeatCount="indefinite" />
                </feTurbulence>
                <feDisplacementMap ref={dispRef} in="SourceGraphic" in2="wave" scale="3" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
          </svg>
        )}
        <div
          className="contrast-mosaico-bg pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url(${mosaico})`,
            backgroundRepeat: 'repeat',
            backgroundPosition: 'calc(50% - 0.6mm) center',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, rgba(0,0,0,0.85) 25%, rgba(0,0,0,0.5) 50%, transparent 75%)',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 0%, rgba(0,0,0,0.85) 25%, rgba(0,0,0,0.5) 50%, transparent 75%)',
            ...(esMovil ? {} : { filter: 'url(#mosaico-ripple)' }),
          }}
        />
        <div
          className="relative z-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4"
          onMouseEnter={() => setRippleActive(true)}
          onMouseLeave={() => setRippleActive(false)}
        >
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

      <section className="overflow-hidden py-4">
        <h2 className="text-center text-2xl font-bold tracking-tight text-guinda">
          ¿Cómo funciona?
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-gray-institutional/70">
          Tres pasos simples para realizar tu solicitud
        </p>

        {/* Desktop — animated */}
        <div className="mt-10 hidden items-start justify-center md:flex">
          <div className="flex flex-col items-center">
            <span className={`step-num ${activePos === 0 ? 'step-bounce bg-guinda text-white shadow-[0_0_30px_12px_rgba(125,36,71,0.3)]' : 'bg-guinda/5 text-guinda'}`}>
              {steps[0].number}
            </span>
            <h3 className="mt-4 font-semibold text-guinda">{steps[0].title}</h3>
            <p className="mt-1.5 max-w-48 text-center text-sm leading-relaxed text-gray-institutional/70">{steps[0].desc}</p>
          </div>
          <div className="connector relative mx-2 mt-8 flex w-32 items-center xl:mx-4 xl:w-44">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-guinda/20" />
            <div className="relative flex w-full justify-evenly">
              {[1,2,3,4].map((d) => (
                <div key={d} className={activePos === d ? 'dot-active' : 'dot-base'} />
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className={`step-num ${activePos === 5 ? 'step-bounce bg-guinda text-white shadow-[0_0_30px_12px_rgba(125,36,71,0.3)]' : 'bg-guinda/5 text-guinda'}`}>
              {steps[1].number}
            </span>
            <h3 className="mt-4 font-semibold text-guinda">{steps[1].title}</h3>
            <p className="mt-1.5 max-w-48 text-center text-sm leading-relaxed text-gray-institutional/70">{steps[1].desc}</p>
          </div>
          <div className="connector relative mx-2 mt-8 flex w-32 items-center xl:mx-4 xl:w-44">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-guinda/20" />
            <div className="relative flex w-full justify-evenly">
              {[6,7,8,9].map((d) => (
                <div key={d} className={activePos === d ? 'dot-active' : 'dot-base'} />
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className={`step-num ${activePos === 10 ? 'step-bounce bg-guinda text-white shadow-[0_0_30px_12px_rgba(125,36,71,0.3)]' : 'bg-guinda/5 text-guinda'}`}>
              {steps[2].number}
            </span>
            <h3 className="mt-4 font-semibold text-guinda">{steps[2].title}</h3>
            <p className="mt-1.5 max-w-48 text-center text-sm leading-relaxed text-gray-institutional/70">{steps[2].desc}</p>
          </div>
        </div>

        {/* Mobile — static grid */}
        <div className="mt-8 grid gap-8 md:hidden">
          {steps.map((step) => (
            <div key={step.number} className="flex flex-col items-center text-center">
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
