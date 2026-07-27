import { useState, useRef, useEffect } from 'react'
import { Upload, MapPin, Check, Navigation } from 'lucide-react'
import lottie from 'lottie-web'
import loadingAnimation from '../assets/lottie/landing-construccion.json'
import Button from '../shared/Button'
import Card from '../shared/Card'
import { Input, Textarea } from '../shared/Input'
import Select from '../shared/Select'
import { TIPOS_OBRA_NOMBRES, RANKING_PUNTOS_CARGO_PUBLICO } from '../core/constants'
import { crearSolicitud } from '../lib/solicitud'
import type { SolicitudFormData, SolicitudErrors } from '../types/solicitud'
import MapaCombinado from './MapaCombinado'
import AvisoPrivacidad from '../shared/AvisoPrivacidad'

function validarCURP(curp: string): boolean {
  return /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/.test(curp)
}

function validarForm(data: SolicitudFormData, omitirCurp?: boolean): SolicitudErrors {
  const errors: SolicitudErrors = {}

  if (!data.nombre_solicitante.trim())
    errors.nombre_solicitante = 'El nombre es obligatorio'
  if (!omitirCurp) {
    if (!data.curp.trim()) errors.curp = 'El CURP es obligatorio'
    else if (!validarCURP(data.curp.toUpperCase()))
      errors.curp = 'CURP inválido. Debe tener 18 caracteres.'
  }
  if (!data.telefono.trim()) errors.telefono = 'El teléfono es obligatorio'
  else if (!/^\d{10}$/.test(data.telefono))
    errors.telefono = 'El teléfono debe tener 10 dígitos'
  if (!data.correo.trim()) errors.correo = 'El correo es obligatorio'
  else if (!/\S+@\S+\.\S+/.test(data.correo))
    errors.correo = 'Correo inválido'
  if (!data.aviso_privacidad_aceptado)
    errors.aviso_privacidad_aceptado = 'Debes aceptar el aviso de privacidad'
  if (!data.tipo_solicitud) errors.tipo_solicitud = 'Selecciona un tipo de obra'
  if (!data.colonia) errors.colonia = 'Debes marcar una ubicación en el mapa'
  if (!data.junta_auxiliar) errors.junta_auxiliar = 'Debes marcar una ubicación en el mapa'
  if (!data.latitud || !data.longitud)
    errors.latitud = 'Debes seleccionar una ubicación en el mapa'

  return errors
}

interface SolicitudFormProps {
  omitirCurp?: boolean
  nombrePrefilled?: string
}

export default function SolicitudForm({ omitirCurp, nombrePrefilled }: SolicitudFormProps = {}) {
  const [form, setForm] = useState<SolicitudFormData>({
    nombre_solicitante: nombrePrefilled ?? '',
    curp: '',
    telefono: '',
    correo: '',
    aviso_privacidad_aceptado: false,
    tipo_solicitud: '',
    colonia: '',
    junta_auxiliar: '',
    calle: '',
    entre_calles: '',
    zona_zap: false,
    cobertura_agua: false,
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
  const [showMapaCombinado, setShowMapaCombinado] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [showAviso, setShowAviso] = useState(false)
  const [tramoData, setTramoData] = useState<{
    distancia_m: number; ancho_calle_m: number
    escuelas_cercanas: string[]; iglesias_cercanas: string[]; transportes_cercanos: string[]
    puntos: { lat: number; lng: number }[]
  } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const lottieRef = useRef<HTMLDivElement>(null)
  const [fileErrors, setFileErrors] = useState<string[]>([])

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

  const handleMapCombinadoConfirm = (data: import('./MapaCombinado').MapaCombinadoResult) => {
    const { pin, tramo } = data
    set('latitud', String(pin.lat))
    set('longitud', String(pin.lng))
    if (pin.colonia) set('colonia', pin.colonia)
    if (pin.junta_auxiliar) set('junta_auxiliar', pin.junta_auxiliar)
    if (pin.calle) set('calle', pin.calle)
    if (pin.entre_calles) set('entre_calles', pin.entre_calles)
    set('zona_zap', pin.zona_zap)
    set('cobertura_agua', pin.cobertura_agua)

    if (tramo) {
      set('tramo_lat_ini', String(tramo.lat_ini))
      set('tramo_lng_ini', String(tramo.lng_ini))
      set('tramo_lat_fin', String(tramo.lat_fin))
      set('tramo_lng_fin', String(tramo.lng_fin))
      setTramoData({
        distancia_m: tramo.distancia_m,
        ancho_calle_m: tramo.ancho_calle_m,
        escuelas_cercanas: tramo.escuelas_cercanas,
        iglesias_cercanas: tramo.iglesias_cercanas,
        transportes_cercanos: tramo.transportes_cercanos,
        puntos: tramo.puntos,
      })
    }
    setShowMapaCombinado(false)
  }

  const set = (field: keyof SolicitudFormData, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validarForm(form, omitirCurp)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setSubmittedOnce(true)
    setShowLottie(true)
    setResultado(null)

    const res = await crearSolicitud(
      {
        ...form,
        curp: omitirCurp ? 'SIN CURP' : form.curp.toUpperCase(),
        nombre_solicitante: form.nombre_solicitante.trim(),
      },
      omitirCurp ? RANKING_PUNTOS_CARGO_PUBLICO : undefined,
      tramoData ?? undefined
    )

    await new Promise(r => setTimeout(r, 3000))
    setShowLottie(false)

    if (res.error) {
      setResultado({ error: res.error })
      setSubmittedOnce(false)
    } else {
      setResultado({ folio: res.data?.folio_unico, advertencia: res.advertencia })
      setTramoData(null)
      setForm({
        nombre_solicitante: '',
        curp: '',
        telefono: '',
        correo: '',
        aviso_privacidad_aceptado: false,
        tipo_solicitud: '',
        colonia: '',
        junta_auxiliar: '',
        calle: '',
        entre_calles: '',
        zona_zap: false,
        cobertura_agua: false,
        latitud: '',
        longitud: '',
        tramo_lat_ini: '',
        tramo_lng_ini: '',
        tramo_lat_fin: '',
        tramo_lng_fin: '',
        descripcion: '',
        archivos: [],
      })
      setFileErrors([])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    const valid: File[] = []
    const errors: string[] = []
    for (const f of selected) {
      if (f.size > 500 * 1024) {
        errors.push(`"${f.name}" excede 500 KB`)
      } else {
        valid.push(f)
      }
    }
    set('archivos', valid)
    setFileErrors(errors)
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

  const inlineMap = showMapaCombinado

  return (
    <>
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="mx-auto w-full max-w-2xl">
          <Card title="Datos del solicitante">
            <div className="flex flex-col gap-4">
              <Input
                label="Nombre completo"
                value={form.nombre_solicitante}
                onChange={(e) => set('nombre_solicitante', e.target.value)}
                error={errors.nombre_solicitante}
                placeholder="Juan Pérez García"
                readOnly={!!nombrePrefilled}
                tabIndex={nombrePrefilled ? -1 : undefined}
                className={nombrePrefilled ? 'cursor-default opacity-80' : undefined}
              />
              <div className="grid gap-4 md:grid-cols-2">
                {!omitirCurp && (
                  <Input
                    label="CURP"
                    value={form.curp}
                    onChange={(e) => set('curp', e.target.value.toUpperCase())}
                    error={errors.curp}
                    placeholder="PEGJ900101HDFRRN01"
                    maxLength={18}
                  />
                )}
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
        </div>

        <div className={`md:flex ${inlineMap ? 'md:gap-6' : ''}`}>
          <div className={`transition-all duration-500 ease-in-out min-w-0 ${inlineMap ? 'md:w-[55%]' : 'mx-auto w-full max-w-2xl'}`}>
            <Card title="Datos de la obra">
              <div className="flex flex-col gap-4">
                <Select
                  label="Tipo de obra"
                  options={TIPOS_OBRA_NOMBRES}
                  value={form.tipo_solicitud}
                  onChange={(e) => set('tipo_solicitud', e.target.value)}
                  error={errors.tipo_solicitud}
                />

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
                        aria-label="Abrir mapa"
                        onClick={() => setShowMapaCombinado(true)}
                      >
                        <MapPin className="mr-1 h-4 w-4" />
                        {form.tramo_lat_ini ? 'Editar' : 'Mapa'}
                      </Button>
                    </div>
                    {errors.latitud && (
                      <p className="mt-1 text-xs text-red-500">{errors.latitud}</p>
                    )}
                    {form.tramo_lat_ini && (
                      <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                        Tramo: {form.tramo_lat_ini}, {form.tramo_lng_ini} → {form.tramo_lat_fin}, {form.tramo_lng_fin}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-institutional">
                      Colonia
                    </label>
                    <div
                      className="w-full cursor-pointer rounded-xl border-2 border-alabaster-dark bg-alabaster/50 px-4 py-3 text-sm text-gray-institutional/70 transition-all duration-200 hover:border-guinda/30"
                      onClick={() => setShowInfoModal(true)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowInfoModal(true) }}
                    >
                      {form.colonia || 'Esperando datos'}
                    </div>
                    {errors.colonia && <p className="text-xs text-red-500">{errors.colonia}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-institutional">
                      Junta auxiliar
                    </label>
                    <div
                      className="w-full cursor-pointer rounded-xl border-2 border-alabaster-dark bg-alabaster/50 px-4 py-3 text-sm text-gray-institutional/70 transition-all duration-200 hover:border-guinda/30"
                      onClick={() => setShowInfoModal(true)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowInfoModal(true) }}
                    >
                      {form.junta_auxiliar || 'Esperando datos'}
                    </div>
                    {errors.junta_auxiliar && <p className="text-xs text-red-500">{errors.junta_auxiliar}</p>}
                  </div>
                </div>

                {(form.calle || form.entre_calles) && (
                  <div className="rounded-xl border border-alabaster-dark/30 bg-alabaster/30 p-3">
                    {form.calle && (
                      <div className="flex items-center gap-2 text-sm">
                        <Navigation className="h-4 w-4 shrink-0 text-guinda" />
                        <span className="font-medium text-gray-institutional">{form.calle}</span>
                      </div>
                    )}
                    {form.entre_calles && (
                      <div className="flex items-center gap-2 pl-6 text-xs text-gray-institutional/60">
                        {form.entre_calles}
                      </div>
                    )}
                  </div>
                )}

                <Textarea
                  label="Descripción del problema"
                  value={form.descripcion}
                  onChange={(e) => set('descripcion', e.target.value)}
                  placeholder="Describe el problema o la necesidad de la obra..."
                  rows={3}
                />
              </div>
            </Card>
          </div>

          <div className={`hidden md:block transition-all duration-500 ease-in-out relative z-20 min-w-0 ${inlineMap ? 'md:max-w-[45%] md:opacity-100' : 'md:max-w-0 md:opacity-0 md:overflow-hidden'}`}>
            <div className="h-full w-[500px] md:w-full" style={{ isolation: 'isolate' }}>
              <MapaCombinado
                inline
                onConfirm={handleMapCombinadoConfirm}
                onClose={() => setShowMapaCombinado(false)}
                initialLat={form.latitud}
                initialLng={form.longitud}
              />
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-2xl">
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
                    <li key={i}>{f.name} <span className="text-gray-institutional/40">({(f.size / 1024).toFixed(0)} KB)</span></li>
                  ))}
                </ul>
              )}
              {fileErrors.length > 0 && (
                <ul className="text-xs text-red-500">
                  {fileErrors.map((err, i) => (
                    <li key={i}>{err}</li>
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
                <button
                  type="button"
                  className="cursor-pointer text-guinda underline hover:no-underline"
                  onClick={() => setShowAviso(true)}
                >
                  Aviso de Privacidad
                </button>{' '}
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
              {submittedOnce ? 'Enviando' : 'Enviar solicitud'}
            </Button>
          </div>
        </div>
      </form>

      {showMapaCombinado && (
        <div className="md:hidden">
          <MapaCombinado
            onConfirm={handleMapCombinadoConfirm}
            onClose={() => setShowMapaCombinado(false)}
            initialLat={form.latitud}
            initialLng={form.longitud}
          />
        </div>
      )}
      {showInfoModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-3 text-lg font-semibold text-gray-institutional">
              Datos automáticos
            </h3>
            <p className="text-sm leading-relaxed text-gray-institutional/70">
              Al ubicar el punto en el mapa, los datos de colonia y junta auxiliar
              se extraen automáticamente de nuestra base de datos. Pueden haber
              variaciones en la delimitación, pero al tener las coordenadas
              exactas podremos llegar a tu calle lo más pronto posible.
            </p>
            <button
              className="mt-4 w-full rounded-xl bg-guinda px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-guinda/90"
              onClick={() => setShowInfoModal(false)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {showAviso && <AvisoPrivacidad onClose={() => setShowAviso(false)} />}
    </>
  )
}
