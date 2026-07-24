import { useState, useRef, useMemo, useEffect } from 'react'
import { Upload, MapPin, Check } from 'lucide-react'
import lottie from 'lottie-web'
import loadingAnimation from '../assets/lottie/landing-construccion.json'
import Button from '../shared/Button'
import Card from '../shared/Card'
import { Input, Textarea } from '../shared/Input'
import Select from '../shared/Select'
import { CATALOGO_TIPOS_SOLICITUD, JUNTAS_AUXILIARES } from '../core/constants'
import { crearSolicitud } from '../lib/solicitud'
import type { SolicitudFormData, SolicitudErrors } from '../types/solicitud'
import MapaPin from './MapaPin'
import MapaTramo from './MapaTramo'

function validarCURP(curp: string): boolean {
  return /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/.test(curp)
}

function validarForm(data: SolicitudFormData): SolicitudErrors {
  const errors: SolicitudErrors = {}

  if (!data.nombre_solicitante.trim())
    errors.nombre_solicitante = 'El nombre es obligatorio'
  if (!data.curp.trim()) errors.curp = 'El CURP es obligatorio'
  else if (!validarCURP(data.curp.toUpperCase()))
    errors.curp = 'CURP inválido. Debe tener 18 caracteres.'
  if (!data.telefono.trim()) errors.telefono = 'El teléfono es obligatorio'
  else if (!/^\d{10}$/.test(data.telefono))
    errors.telefono = 'El teléfono debe tener 10 dígitos'
  if (!data.correo.trim()) errors.correo = 'El correo es obligatorio'
  else if (!/\S+@\S+\.\S+/.test(data.correo))
    errors.correo = 'Correo inválido'
  if (!data.aviso_privacidad_aceptado)
    errors.aviso_privacidad_aceptado = 'Debes aceptar el aviso de privacidad'
  if (!data.tipo_solicitud) errors.tipo_solicitud = 'Selecciona un tipo de obra'
  if (!data.colonia) errors.colonia = 'Selecciona una colonia'
  if (!data.junta_auxiliar) errors.junta_auxiliar = 'Selecciona una junta auxiliar'
  if (!data.latitud || !data.longitud)
    errors.latitud = 'Debes seleccionar una ubicación en el mapa'

  return errors
}

export default function SolicitudForm() {
  const [form, setForm] = useState<SolicitudFormData>({
    nombre_solicitante: '',
    curp: '',
    telefono: '',
    correo: '',
    aviso_privacidad_aceptado: false,
    tipo_solicitud: '',
    colonia: '',
    junta_auxiliar: '',
    latitud: '',
    longitud: '',
    tramo_lat_ini: '',
    tramo_lng_ini: '',
    tramo_lat_fin: '',
    tramo_lng_fin: '',
    descripcion: '',
    archivos: [],
  })

  const [errors, setErrors] = useState<SolicitudErrors>({})
  const [submittedOnce, setSubmittedOnce] = useState(false)
  const [showLottie, setShowLottie] = useState(false)
  const [resultado, setResultado] = useState<{ folio?: string; error?: string; advertencia?: string } | null>(null)
  const [showMapaPin, setShowMapaPin] = useState(false)
  const [showMapaTramo, setShowMapaTramo] = useState(false)
  const [extraColonias, setExtraColonias] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const lottieRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showLottie || !lottieRef.current) return
    const anim = lottie.loadAnimation({
      container: lottieRef.current,
      animationData: loadingAnimation,
      loop: true,
      autoplay: true,
    })
    return () => anim.destroy()
  }, [showLottie])

  const coloniasOptions = useMemo(() => {
    const seen = new Set<string>()
    const all = [...extraColonias, 'Centro', 'San Francisco', 'La Paz', 'Guadalupe', 'San Miguel', 'San Antonio', 'San Juan', 'Santa Anita']
    return all.filter(c => {
      if (seen.has(c.toLowerCase())) return false
      seen.add(c.toLowerCase())
      return true
    })
  }, [extraColonias])

  const handleMapTramoConfirm = (data: { lat_ini: number; lng_ini: number; lat_fin: number; lng_fin: number }) => {
    set('tramo_lat_ini', String(data.lat_ini))
    set('tramo_lng_ini', String(data.lng_ini))
    set('tramo_lat_fin', String(data.lat_fin))
    set('tramo_lng_fin', String(data.lng_fin))
    setShowMapaTramo(false)
  }

  const handleMapConfirm = (data: { lat: number; lng: number; colonia: string; junta_auxiliar: string }) => {
    set('latitud', String(data.lat))
    set('longitud', String(data.lng))
    if (data.colonia) {
      set('colonia', data.colonia)
      setExtraColonias(prev => prev.includes(data.colonia) ? prev : [...prev, data.colonia])
    }
    if (data.junta_auxiliar) set('junta_auxiliar', data.junta_auxiliar)
    setShowMapaPin(false)
  }

  const set = (field: keyof SolicitudFormData, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validarForm(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setSubmittedOnce(true)
    setShowLottie(true)
    setResultado(null)

    const res = await crearSolicitud({
      ...form,
      curp: form.curp.toUpperCase(),
      nombre_solicitante: form.nombre_solicitante.trim(),
    })

    await new Promise(r => setTimeout(r, 3000))
    setShowLottie(false)

    if (res.error) {
      setResultado({ error: res.error })
      setSubmittedOnce(false)
    } else {
      setResultado({ folio: res.data?.folio_unico, advertencia: res.advertencia })
      setForm({
        nombre_solicitante: '',
        curp: '',
        telefono: '',
        correo: '',
        aviso_privacidad_aceptado: false,
        tipo_solicitud: '',
        colonia: '',
        junta_auxiliar: '',
        latitud: '',
        longitud: '',
        tramo_lat_ini: '',
        tramo_lng_ini: '',
        tramo_lat_fin: '',
        tramo_lng_fin: '',
        descripcion: '',
        archivos: [],
      })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    set('archivos', files)
  }

  if (resultado?.folio) {
    return (
      <Card title="Solicitud registrada">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-lg font-semibold text-guinda">
            ¡Solicitud registrada con éxito!
          </p>
          <p className="text-gray-institutional/70">
            Tu número de folio es:
          </p>
          <p className="rounded-xl bg-guinda/5 px-6 py-3 text-2xl font-bold tracking-wider text-guinda">
            {resultado.folio}
          </p>
          <p className="text-xs text-gray-institutional/50">
            Pronto recibirás tu acuse en tu correo electrónico.
          </p>
          {resultado.advertencia && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              {resultado.advertencia}
            </div>
          )}
          <Button onClick={() => { setResultado(null); setSubmittedOnce(false) }}>
            Nueva solicitud
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {showLottie && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-white">
          <div ref={lottieRef} className="w-64" />
          <p className="text-sm text-gray-institutional/60">Registrando tu solicitud...</p>
        </div>
      )}

      {resultado?.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {resultado.error}
        </div>
      )}

      <Card title="Datos del solicitante">
        <div className="flex flex-col gap-4">
          <Input
            label="Nombre completo"
            value={form.nombre_solicitante}
            onChange={(e) => set('nombre_solicitante', e.target.value)}
            error={errors.nombre_solicitante}
            placeholder="Juan Pérez García"
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="CURP"
              value={form.curp}
              onChange={(e) => set('curp', e.target.value.toUpperCase())}
              error={errors.curp}
              placeholder="PEGJ900101HDFRRN01"
              maxLength={18}
            />
            <Input
              label="Teléfono"
              type="tel"
              value={form.telefono}
              onChange={(e) => set('telefono', e.target.value.replace(/\D/g, ''))}
              error={errors.telefono}
              placeholder="2221234567"
              maxLength={10}
            />
          </div>
          <Input
            label="Correo electrónico"
            type="email"
            value={form.correo}
            onChange={(e) => set('correo', e.target.value)}
            error={errors.correo}
            placeholder="correo@ejemplo.com"
          />
        </div>
      </Card>

      <Card title="Datos de la obra">
        <div className="flex flex-col gap-4">
          <Select
            label="Tipo de obra"
            options={CATALOGO_TIPOS_SOLICITUD}
            value={form.tipo_solicitud}
            onChange={(e) => set('tipo_solicitud', e.target.value)}
            error={errors.tipo_solicitud}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Colonia"
              options={coloniasOptions}
              value={form.colonia}
              error={errors.colonia}
              disabled
            />
            <Select
              label="Junta auxiliar"
              options={JUNTAS_AUXILIARES}
              value={form.junta_auxiliar}
              error={errors.junta_auxiliar}
              disabled
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-institutional">
              Ubicación
            </label>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-xl border-2 border-alabaster-dark/30 bg-alabaster/30 p-4">
                <MapPin className="h-5 w-5 shrink-0 text-guinda" />
                <span className="text-sm text-gray-institutional/70">
                  {form.latitud && form.longitud
                    ? `${form.latitud}, ${form.longitud}`
                    : 'Presiona para marcar un punto en el mapa'}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="ml-auto shrink-0"
                  aria-label="Abrir mapa para colocar marcador"
                  onClick={() => setShowMapaPin(true)}
                >
                  <MapPin className="mr-1 h-4 w-4" />
                  Punto
                </Button>
              </div>
              {errors.latitud && (
                <p className="mt-1 text-xs text-red-500">{errors.latitud}</p>
              )}
              <div className="flex items-center gap-3 rounded-xl border-2 border-alabaster-dark/30 bg-alabaster/30 p-4">
                <MapPin className="h-5 w-5 shrink-0 text-guinda" />
                <span className="text-sm text-gray-institutional/70">
                  {form.tramo_lat_ini
                    ? `${form.tramo_lat_ini}, ${form.tramo_lng_ini} → ${form.tramo_lat_fin}, ${form.tramo_lng_fin}`
                    : 'Presiona para dibujar un tramo en la calle'}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="ml-auto shrink-0"
                  aria-label="Abrir mapa para dibujar tramo"
                  onClick={() => setShowMapaTramo(true)}
                >
                  <MapPin className="mr-1 h-4 w-4" />
                  Tramo
                </Button>
              </div>
            </div>
          </div>

          <Textarea
            label="Descripción del problema"
            value={form.descripcion}
            onChange={(e) => set('descripcion', e.target.value)}
            placeholder="Describe el problema o la necesidad de la obra..."
            rows={3}
          />
        </div>
      </Card>

      <Card title="Evidencia (opcional)">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-institutional/60">
            Sube fotos o un PDF como evidencia. Máximo 500 KB por archivo. Las
            solicitudes con evidencia reciben mayor prioridad.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            onChange={handleFileChange}
            className="hidden"
            aria-label="Seleccionar archivos de evidencia"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {form.archivos.length > 0
              ? `${form.archivos.length} archivo(s) seleccionado(s)`
              : 'Seleccionar archivos'}
          </Button>
          {form.archivos.length > 0 && (
            <ul className="text-xs text-gray-institutional/60">
              {form.archivos.map((f, i) => (
                <li key={i}>{f.name}</li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={form.aviso_privacidad_aceptado}
            onChange={(e) => set('aviso_privacidad_aceptado', e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-guinda focus:ring-guinda"
            aria-label="Acepto el aviso de privacidad"
          />
          <span className="text-sm text-gray-institutional">
            He leído y acepto el{' '}
            <a href="#" className="text-guinda underline hover:no-underline">
              Aviso de Privacidad
            </a>{' '}
            y el tratamiento de mis datos personales para la gestión de la
            solicitud.
          </span>
        </label>
        {errors.aviso_privacidad_aceptado && (
          <p className="mt-1 text-xs text-red-500">
            {errors.aviso_privacidad_aceptado}
          </p>
        )}
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={submittedOnce}>
          {submittedOnce ? 'Enviando...' : 'Enviar solicitud'}
        </Button>
      </div>
      {showMapaPin && (
        <MapaPin
          onConfirm={handleMapConfirm}
          onClose={() => setShowMapaPin(false)}
          initialLat={form.latitud}
          initialLng={form.longitud}
        />
      )}
      {showMapaTramo && (
        <MapaTramo
          onConfirm={handleMapTramoConfirm}
          onClose={() => setShowMapaTramo(false)}
        />
      )}
    </form>
  )
}
