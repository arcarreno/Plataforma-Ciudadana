import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, useMap, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import { X, MapPin, Ruler, Eye, EyeOff, Layers, User, Phone, Mail, FileWarning, School, Church, Bus, FileText, Loader2, Navigation, Maximize2, Minimize2, Globe, Map, Pencil, Send, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Solicitud } from '../types/solicitud'
import { ESTATUS_OPCIONES, CATALOGO_TIPOS_OBRA } from '../core/constants'
import type { EstatusFase } from '../core/constants'
import { esCargoPublico } from '../types/auth'
import Card from '../shared/Card'
import Button from '../shared/Button'
import { cargarCapas, detectarPunto } from './detectar-ubicacion'
import type { DeteccionPunto, CapasGeoJSON } from './detectar-ubicacion'
import { consultarSIGED } from '../lib/consultarSIGED'
import type { SigedEscuela } from '../lib/consultarSIGED'
import VistaOficioEditable from './VistaOficioEditable'
import VistaFichaEditable from './VistaFichaEditable'

interface SolicitudDetailProps {
  solicitud: Solicitud
  onClose: () => void
  onEstatusChange?: (nuevo: EstatusFase) => void
  onNavigate?: (solicitud: Solicitud) => void
  userRole?: string
}

const icon = L.divIcon({
  className: '',
  html: '<svg viewBox="0 0 32 48" width="24" height="36" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.16 0 0 7.16 0 16c0 10.6 12.8 26.6 14.6 28.8.6.8 1.8.8 2.4 0C18.8 42.6 32 26.6 32 16 32 7.16 24.84 0 16 0z" fill="#7D2447"/><circle cx="16" cy="16" r="10" fill="white" opacity="0.9"/><circle cx="16" cy="16" r="8" fill="#7D2447"/></svg>',
  iconSize: [24, 36],
  iconAnchor: [12, 36],
})

const marker1 = L.divIcon({
  className: 'flex items-center justify-center',
  html: '<div style="width:20px;height:20px;border-radius:50%;background:#7d2447;color:white;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">1</div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

const marker2 = L.divIcon({
  className: 'flex items-center justify-center',
  html: '<div style="width:20px;height:20px;border-radius:50%;background:#7d2447;color:white;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">2</div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

const COLONIA_STYLE = {
  color: '#7d2447',
  weight: 2,
  fillColor: '#7d2447',
  fillOpacity: 0.08,
}

const JUNTA_STYLE = {
  color: '#2c6b2f',
  weight: 3,
  fillColor: '#2c6b2f',
  fillOpacity: 0.05,
}

const ZONA_ZAP_STYLE = {
  color: '#b8860b',
  weight: 2,
  fillColor: '#b8860b',
  fillOpacity: 0.06,
}

function parseList(items?: string[]): string[] {
  return (items || []).join(', ').split(',').map(s => s.trim()).filter(Boolean)
}

function shortRoute(r: string): string {
  const idx = r.search(/\s+-\s+/)
  return idx > 0 ? r.slice(0, idx).trim() : r.trim()
}

function DetailMarker({ position, icon }: { position: L.LatLngExpression; icon: L.DivIcon }) {
  const map = useMap()
  useEffect(() => {
    const m = L.marker(position, { icon }).addTo(map)
    return () => { m.remove() }
  }, [map, position, icon])
  return null
}

export default function SolicitudDetail({ solicitud, onClose, onEstatusChange, onNavigate, userRole }: SolicitudDetailProps) {
  const s = solicitud
  const hasTramo = s.tramo_lat_ini && s.tramo_lng_ini && s.tramo_lat_fin && s.tramo_lng_fin
  const [detection, setDetection] = useState<DeteccionPunto | null>(null)
  const [tramoFullscreen, setTramoFullscreen] = useState(false)
  const [ubicacionFullscreen, setUbicacionFullscreen] = useState(false)
  const [satelliteUbicacion, setSatelliteUbicacion] = useState(false)
  const [satelliteTramo, setSatelliteTramo] = useState(false)
  const [capas, setCapas] = useState<CapasGeoJSON | null>(null)
  const [showLayersUbicacion, setShowLayersUbicacion] = useState(false)
  const [showLayersTramo, setShowLayersTramo] = useState(false)

  const calleInfo = s.calle || s.entre_calles
    ? { calle: s.calle || '', entreCalles: s.entre_calles || '' }
    : null
  const [sigedCct, setSigedCct] = useState('')
  const [sigedData, setSigedData] = useState<SigedEscuela | null>(null)
  const [sigedLoading, setSigedLoading] = useState(false)
  const [sigedError, setSigedError] = useState<string | null>(null)
  const [vecinos, setVecinos] = useState<{ id_solicitud: number; folio_unico: string; distancia_m: number }[]>([])
  const [vecinosLoading, setVecinosLoading] = useState(false)
  const [documentTab, setDocumentTab] = useState<'oficio' | 'ficha' | 'enviar' | null>(null)
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [emailEnviado, setEmailEnviado] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  useEffect(() => {
    cargarCapas().then(c => {
      setCapas(c)
      setDetection(detectarPunto(s.latitud, s.longitud, c))
    })
  }, [s.latitud, s.longitud])

  useEffect(() => {
    if (sigedCct.length !== 10) {
      setSigedData(null)
      setSigedError(null)
      return
    }
    let cancelled = false
    setSigedLoading(true)
    setSigedError(null)
    const timer = setTimeout(async () => {
      const { data, error } = await consultarSIGED(sigedCct)
      if (cancelled) return
      if (error) {
        setSigedError(error)
        setSigedData(null)
      } else if (data) {
        setSigedData(data)
        setSigedError(null)
      }
      setSigedLoading(false)
    }, 500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [sigedCct])

  useEffect(() => {
    if (s.peso_ranking !== 12 || !s.id_solicitud) {
      setVecinos([])
      return
    }
    setVecinosLoading(true)
    supabase.rpc('obtener_concentracion_vecinos', { p_id_solicitud: s.id_solicitud })
      .then(({ data, error }) => {
        if (!error && data) setVecinos(data as { id_solicitud: number; folio_unico: string; distancia_m: number }[])
        setVecinosLoading(false)
      })
  }, [s.id_solicitud, s.peso_ranking])

  const handleOpenDocumentModal = () => {
    setDocumentTab('oficio')
  }

  const handleTabChange = (tab: 'oficio' | 'ficha' | 'enviar') => {
    setDocumentTab(tab)
  }

  const oficioRef = useRef<{ exportarPdf: () => Promise<string> }>(null)
  const fichaRef = useRef<{ exportarPdf: () => Promise<string> }>(null)

  const handleEnviarDocumentacion = async () => {
    setEnviandoEmail(true)
    setEmailError(null)
    try {
      if (!oficioRef.current || !fichaRef.current) {
        throw new Error('Documentos no disponibles')
      }
      // Si el usuario terminó de editar un campo sin salir de él, forzar el blur
      // para que el onBlur commitee el estado y el DOM capturado refleje la edición.
      const activo = document.activeElement as HTMLElement | null
      if (activo?.isContentEditable) activo.blur()
      await new Promise(res => setTimeout(res, 80))
      const [oficioPdf, fichaPdf] = await Promise.all([
        oficioRef.current.exportarPdf(),
        fichaRef.current.exportarPdf(),
      ])
      const body = JSON.stringify({
        correo: s.correo,
        folio: s.folio_unico,
        oficioPdf,
        fichaPdf,
        oficioNombre: `Oficio_${s.folio_unico}.pdf`,
        fichaNombre: `Ficha_tecnica_${s.folio_unico}.pdf`,
      })
      if (body.length > 3_800_000) {
        throw new Error('La documentación es demasiado grande para enviarse por correo. Intenta reducir el contenido de los documentos.')
      }
      const res = await fetch('/api/enviar-documentacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!res.ok) {
        const text = await res.text()
        let data: { error?: string } | null = null
        try { data = JSON.parse(text) } catch { /* respuesta no JSON */ }
        if (res.status === 413) {
          throw new Error('La documentación excede el tamaño máximo permitido por el servidor. Reduce el contenido de los documentos e inténtalo de nuevo.')
        }
        throw new Error(data?.error || `Error al enviar (${res.status})`)
      }
      setEmailEnviado(true)
    } catch (err: any) {
      setEmailError(err?.message || 'Error al enviar correo')
    }
    setEnviandoEmail(false)
  }

  const showGenerateButtons = userRole && esCargoPublico(userRole)

  const esMaxRanking = s.peso_ranking === 10
  const esConcentracion = s.peso_ranking === 12
  const esPrioridad = s.peso_ranking != null && s.peso_ranking >= 15

  const [editGeoOpen, setEditGeoOpen] = useState(false)
  const [editObraOpen, setEditObraOpen] = useState(false)
  const [editTramoOpen, setEditTramoOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    calle: s.calle || '',
    entre_calles: s.entre_calles || '',
    tipo_solicitud: s.tipo_solicitud,
    colonia: s.colonia,
    junta_auxiliar: s.junta_auxiliar,
    distancia_tramo_m: s.distancia_tramo_m != null ? String(s.distancia_tramo_m) : '',
    ancho_calle_m: s.ancho_calle_m != null ? String(s.ancho_calle_m) : '',
    zona_zap: s.zona_zap ?? false,
    cobertura_agua: s.cobertura_agua ?? false,
    escuelas_cercanas: (s.escuelas_cercanas || []).join(', '),
    iglesias_cercanas: (s.iglesias_cercanas || []).join(', '),
    transportes_cercanos: (s.transportes_cercanos || []).join(', '),
  })
  const [editSaving, setEditSaving] = useState(false)

  const handleSaveGeo = async () => {
    setEditSaving(true)
    const { error } = await supabase
      .from('solicitudes')
      .update({ calle: editForm.calle, entre_calles: editForm.entre_calles })
      .eq('id_solicitud', s.id_solicitud)
    if (!error) {
      s.calle = editForm.calle
      s.entre_calles = editForm.entre_calles
    }
    setEditSaving(false)
    setEditGeoOpen(false)
  }

  const handleSaveObra = async () => {
    setEditSaving(true)
    const { error } = await supabase
      .from('solicitudes')
      .update({ tipo_solicitud: editForm.tipo_solicitud, colonia: editForm.colonia, junta_auxiliar: editForm.junta_auxiliar })
      .eq('id_solicitud', s.id_solicitud)
    if (!error) {
      s.tipo_solicitud = editForm.tipo_solicitud
      s.colonia = editForm.colonia
      s.junta_auxiliar = editForm.junta_auxiliar
    }
    setEditSaving(false)
    setEditObraOpen(false)
  }

  const handleSaveTramo = async () => {
    setEditSaving(true)
    const toList = (v: string) => v.split(',').map(x => x.trim()).filter(Boolean)
    const distancia = editForm.distancia_tramo_m.trim() === '' ? null : Number(editForm.distancia_tramo_m)
    const ancho = editForm.ancho_calle_m.trim() === '' ? null : Number(editForm.ancho_calle_m)
    const { error } = await supabase
      .from('solicitudes')
      .update({
        distancia_tramo_m: distancia != null && Number.isFinite(distancia) ? distancia : null,
        ancho_calle_m: ancho != null && Number.isFinite(ancho) ? ancho : null,
        zona_zap: editForm.zona_zap,
        cobertura_agua: editForm.cobertura_agua,
        escuelas_cercanas: toList(editForm.escuelas_cercanas),
        iglesias_cercanas: toList(editForm.iglesias_cercanas),
        transportes_cercanos: toList(editForm.transportes_cercanos),
      })
      .eq('id_solicitud', s.id_solicitud)
    if (!error) {
      s.distancia_tramo_m = distancia != null && Number.isFinite(distancia) ? distancia : undefined
      s.ancho_calle_m = ancho != null && Number.isFinite(ancho) ? ancho : undefined
      s.zona_zap = editForm.zona_zap
      s.cobertura_agua = editForm.cobertura_agua
      s.escuelas_cercanas = toList(editForm.escuelas_cercanas)
      s.iglesias_cercanas = toList(editForm.iglesias_cercanas)
      s.transportes_cercanos = toList(editForm.transportes_cercanos)
    }
    setEditSaving(false)
    setEditTramoOpen(false)
  }

  const puedeEditar = userRole && esCargoPublico(userRole)

  return (
    <>
      {documentTab ? (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-black/60">
          {/* Header guinda con tabs */}
          <div className="flex items-center justify-between bg-guinda px-4 py-3 text-white">
            <div className="flex items-center gap-4">
              <span className="text-lg font-bold tracking-wider">{s.folio_unico}</span>
              <div className="flex gap-1">
                  {(['oficio', 'ficha', 'enviar'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => handleTabChange(tab)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      documentTab === tab
                        ? 'bg-white text-guinda'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    {tab === 'oficio' && <FileText className="mr-1.5 inline h-4 w-4" />}
                    {tab === 'ficha' && <FileText className="mr-1.5 inline h-4 w-4" />}
                    {tab === 'enviar' && <Send className="mr-1.5 inline h-4 w-4" />}
                    {tab === 'oficio' ? 'Oficio PDF' : tab === 'ficha' ? 'Ficha técnica' : 'Enviar documentación'}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDocumentTab(null)}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="relative flex-1 overflow-hidden">
            <div className={`absolute inset-0 ${documentTab === 'oficio' ? 'z-30' : 'z-0'}`}>
              <VistaOficioEditable ref={oficioRef} solicitud={s} />
            </div>
            <div className={`absolute inset-0 ${documentTab === 'ficha' ? 'z-20' : 'z-10'}`}>
              <VistaFichaEditable ref={fichaRef} solicitud={s} sigedData={sigedData} />
            </div>
            <div className={`absolute inset-0 ${documentTab === 'enviar' ? 'z-30' : 'z-10'}`}>
              <div className="flex h-full flex-col items-center justify-center bg-gray-50 p-8">
                <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
                  <div className="mb-6 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-guinda/10">
                      <Send className="h-6 w-6 text-guinda" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Enviar documentación</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Se enviarán ambos documentos por correo electrónico al solicitante.
                    </p>
                  </div>

                  <div className="space-y-3 rounded-xl bg-gray-50 p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Folio</span>
                      <span className="font-mono font-medium text-gray-900">{s.folio_unico}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Solicitante</span>
                      <span className="font-medium text-gray-900">{s.nombre_solicitante}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Correo</span>
                      <span className="flex items-center gap-1.5 font-medium text-gray-900">
                        <Mail className="h-3.5 w-3.5 text-gray-400" />
                        {s.correo || 'Sin correo'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Documentos</span>
                      <span className="text-gray-900">Oficio + Ficha técnica (PDF)</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    {emailEnviado ? (
                      <div className="flex items-center justify-center gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-700">
                        <CheckCircle className="h-5 w-5" />
                        Documentación enviada correctamente
                      </div>
                    ) : (
                      <Button
                        onClick={handleEnviarDocumentacion}
                        disabled={enviandoEmail || !s.correo}
                        className="flex w-full items-center justify-center gap-2"
                      >
                        {enviandoEmail ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            Enviar documentación
                          </>
                        )}
                      </Button>
                    )}
                    {emailError && (
                      <p className="mt-2 text-center text-sm text-red-500">{emailError}</p>
                    )}
                    {!s.correo && (
                      <p className="mt-2 text-center text-sm text-amber-600">
                        No hay correo registrado para este solicitante
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/40 py-6">
          <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl shadow-xl">
            <div className={`flex items-center justify-between px-6 py-4 ${
              esPrioridad
                ? 'bg-guinda'
                : esConcentracion
                  ? 'bg-[#DBC6B3]'
                  : esMaxRanking
                    ? 'bg-[#41504D]'
                    : 'bg-white border border-gray-100'
            }`}>
              <div className="flex items-baseline gap-3">
                <p className={`text-xl font-bold tracking-wider ${
                  esPrioridad ? 'text-white' : esConcentracion ? 'text-black' : esMaxRanking ? 'text-[#DBC6B3]' : 'text-guinda'
                }`}>{s.folio_unico}</p>
                <span className={`text-[20px] font-semibold ${
                  esPrioridad
                    ? 'text-white/70'
                    : esConcentracion
                      ? 'text-black/70'
                      : esMaxRanking
                        ? 'text-[#DBC6B3]/70'
                        : 'text-guinda/60'
                }`}>
                  {esPrioridad ? 'Prioridad alta' : esConcentracion ? 'Prioridad media-alta' : esMaxRanking ? 'Prioridad media' : 'Prioridad baja'}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`rounded-xl p-1.5 transition-colors ${
                  esPrioridad
                    ? 'text-white/60 hover:bg-white/10 hover:text-white'
                    : esConcentracion
                      ? 'text-black/60 hover:bg-black/10 hover:text-black'
                      : esMaxRanking
                        ? 'text-[#DBC6B3]/60 hover:bg-[#DBC6B3]/10 hover:text-[#DBC6B3]'
                        : 'text-gray-institutional hover:bg-gray-100 hover:text-guinda'
                }`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-white p-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-4">
                <Card title="Datos del solicitante">
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-guinda" />
                      <span className="text-gray-institutional">{s.nombre_solicitante}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileWarning className="h-4 w-4 text-guinda" />
                      <span className="font-mono text-xs text-gray-institutional/70">{s.curp}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-guinda" />
                      <span className="text-gray-institutional">{s.telefono}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-guinda" />
                      <span className="text-gray-institutional">{s.correo}</span>
                    </div>
                  </div>
                </Card>

                <Card title="Datos de la obra" className="relative">
                  {puedeEditar && (
                    <button
                      type="button"
                      onClick={() => { setEditForm(prev => ({ ...prev, tipo_solicitud: s.tipo_solicitud, colonia: s.colonia, junta_auxiliar: s.junta_auxiliar })); setEditObraOpen(true) }}
                      className="absolute right-2 top-2 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-guinda"
                      aria-label="Editar datos de la obra"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-institutional/60">Tipo</span>
                      <span className="font-medium text-gray-institutional">{s.tipo_solicitud}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-institutional/60">Colonia</span>
                      <span className="font-medium text-gray-institutional">{s.colonia}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-institutional/60">Junta auxiliar</span>
                      <span className="font-medium text-green-700">{s.junta_auxiliar}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-institutional/60">Estatus</span>
                      {onEstatusChange ? (
                        <select
                          value={s.estatus_fase || ''}
                          onChange={e => onEstatusChange(e.target.value as EstatusFase)}
                          className="max-w-[200px] truncate rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-guinda outline-none focus:border-guinda"
                        >
                          {ESTATUS_OPCIONES.map(e => (
                            <option key={e} value={e} className="truncate">{e}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="rounded-lg bg-guinda/10 px-2 py-0.5 text-xs font-medium text-guinda">
                          {s.estatus_fase}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-institutional/60">Peso ranking</span>
                      <span className={`font-medium ${s.peso_ranking != null && s.peso_ranking >= 15 ? 'rounded-lg bg-amber-100 px-2 py-0.5 text-amber-800' : 'text-gray-institutional'}`}>
                        {s.peso_ranking}
                        {s.peso_ranking != null && s.peso_ranking >= 15 && <span className="ml-1">★</span>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-institutional/60">Fecha</span>
                      <span className="text-xs text-gray-institutional/70">
                        {s.fecha_creacion
                          ? new Date(s.fecha_creacion).toLocaleDateString('es-MX', {
                              day: '2-digit', month: 'long', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })
                          : '—'}
                      </span>
                    </div>
                  </div>
                </Card>

                {(s.zona_zap != null || s.cobertura_agua != null || s.distancia_tramo_m != null || s.ancho_calle_m != null || (s.escuelas_cercanas && s.escuelas_cercanas.length > 0) || (s.iglesias_cercanas && s.iglesias_cercanas.length > 0) || (s.transportes_cercanos && s.transportes_cercanos.length > 0)) && (
                  <Card title="Información del tramo" className="relative">
                    {puedeEditar && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditForm(prev => ({
                            ...prev,
                            distancia_tramo_m: s.distancia_tramo_m != null ? String(s.distancia_tramo_m) : '',
                            ancho_calle_m: s.ancho_calle_m != null ? String(s.ancho_calle_m) : '',
                            zona_zap: s.zona_zap ?? false,
                            cobertura_agua: s.cobertura_agua ?? false,
                            escuelas_cercanas: (s.escuelas_cercanas || []).join(', '),
                            iglesias_cercanas: (s.iglesias_cercanas || []).join(', '),
                            transportes_cercanos: (s.transportes_cercanos || []).join(', '),
                          }))
                          setEditTramoOpen(true)
                        }}
                        className="absolute right-2 top-2 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-guinda"
                        aria-label="Editar información del tramo"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <div className="flex flex-col gap-2 text-sm">
                      {s.distancia_tramo_m != null && (
                        <div className="flex justify-between">
                          <span className="text-gray-institutional/60">Distancia del tramo</span>
                          <span className="font-medium text-guinda">{s.distancia_tramo_m} m</span>
                        </div>
                      )}
                      {s.ancho_calle_m != null && (
                        <div className="flex justify-between">
                          <span className="text-gray-institutional/60">Ancho de calle</span>
                          <span className="font-medium text-guinda">~{s.ancho_calle_m} m</span>
                        </div>
                      )}
                      {s.zona_zap != null && (
                        <div className="flex justify-between">
                          <span className="text-gray-institutional/60">Zona ZAP</span>
                          <span className={`font-medium ${s.zona_zap ? 'text-amber-700' : 'text-gray-institutional'}`}>
                            {s.zona_zap ? 'Si' : 'No'}
                          </span>
                        </div>
                      )}
                      {s.cobertura_agua != null && (
                        <div className="flex justify-between">
                          <span className="text-gray-institutional/60">Cobertura de agua</span>
                          <span className={`font-medium ${s.cobertura_agua ? 'text-blue-600' : 'text-gray-institutional'}`}>
                            {s.cobertura_agua ? 'Si' : 'No aplica'}
                          </span>
                        </div>
                      )}
                      {(() => {
                        const escuelas = parseList(s.escuelas_cercanas).map(c => c.toUpperCase())
                        const iglesias = parseList(s.iglesias_cercanas)
                        const rutas = parseList(s.transportes_cercanos).map(shortRoute)
                        if (escuelas.length === 0 && iglesias.length === 0 && rutas.length === 0) return null
                        return (
                          <div className="mt-1 overflow-hidden rounded-xl border border-gray-100">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50">
                                  {escuelas.length > 0 && (
                                    <th className="px-3 py-2 text-left font-semibold text-blue-700">
                                      <School className="mr-1 inline h-3.5 w-3.5" /> Escuelas
                                    </th>
                                  )}
                                  {iglesias.length > 0 && (
                                    <th className="px-3 py-2 text-left font-semibold text-purple-700">
                                      <Church className="mr-1 inline h-3.5 w-3.5" /> Iglesias
                                    </th>
                                  )}
                                  {rutas.length > 0 && (
                                    <th className="px-3 py-2 text-left font-semibold text-orange-600">
                                      <Bus className="mr-1 inline h-3.5 w-3.5" /> Rutas
                                    </th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  {escuelas.length > 0 && (
                                    <td className="align-top">
                                      <div className="flex flex-col divide-y divide-gray-100">
                                        {escuelas.map((e, i) => (
                                          <div key={i} className="px-3 py-1.5 font-mono text-gray-institutional">{e}</div>
                                        ))}
                                      </div>
                                    </td>
                                  )}
                                  {iglesias.length > 0 && (
                                    <td className="align-top">
                                      <div className="flex flex-col divide-y divide-gray-100">
                                        {iglesias.map((e, i) => (
                                          <div key={i} className="px-3 py-1.5 text-gray-institutional">{e}</div>
                                        ))}
                                      </div>
                                    </td>
                                  )}
                                  {rutas.length > 0 && (
                                    <td className="align-top">
                                      <div className="flex flex-col divide-y divide-gray-100">
                                        {rutas.map((e, i) => (
                                          <div key={i} className="px-3 py-1.5 text-gray-institutional">{e}</div>
                                        ))}
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )
                      })()}
                    </div>
                  </Card>
                )}

                {s.descripcion && (
                  <Card title="Descripción">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-institutional">
                      {s.descripcion}
                    </p>
                  </Card>
                )}

                {s.rutas_evidencia && s.rutas_evidencia.length > 0 && (
                  <Card title={`Evidencia (${s.rutas_evidencia.length})`}>
                    <div className="flex flex-wrap gap-2">
                      {s.rutas_evidencia.map((r, i) => (
                        <a
                          key={i}
                          href={supabase.storage.from('evidencias').getPublicUrl(r).data.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs text-guinda transition-colors hover:bg-guinda/5"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span className="max-w-[160px] truncate">{r.split('/').pop()}</span>
                        </a>
                      ))}
                    </div>
                  </Card>
                )}

                {s.peso_ranking === 12 && (
                  <Card title="Ubicaciones cercanas">
                    {vecinosLoading ? (
                      <p className="text-xs text-gray-institutional/50">Buscando solicitudes cercanas...</p>
                    ) : vecinos.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {vecinos.map(v => (
                          <button
                            key={v.id_solicitud}
                            type="button"
                            disabled={!onNavigate}
                            onClick={async () => {
                              const { data } = await supabase
                                .from('solicitudes')
                                .select('*')
                                .eq('id_solicitud', v.id_solicitud)
                                .single()
                              if (data) onNavigate?.(data as Solicitud)
                            }}
                            className="flex w-full items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm transition-colors hover:bg-guinda/5 disabled:cursor-default"
                          >
                            <span className="font-mono font-medium text-guinda">{v.folio_unico}</span>
                            <span className="text-xs text-gray-institutional/60">{v.distancia_m}m</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-institutional/50">Sin solicitudes cercanas</p>
                    )}
                  </Card>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <Card title="Ubicación">
                  {ubicacionFullscreen && (
                    <div className="fixed inset-0 z-[10001] bg-black">
                      <div className="h-full w-full">
                        <MapContainer
                          center={[s.latitud, s.longitud]}
                          zoom={16}
                          className="h-full w-full"
                          zoomControl={true}
                        >
                          {!satelliteUbicacion ? (
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
                          ) : (
                            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution='&copy; Esri' />
                          )}
                          <DetailMarker position={[s.latitud, s.longitud]} icon={icon} />
                          {showLayersUbicacion && capas?.colonias && (
                            <GeoJSON key="colonias" data={capas.colonias} style={COLONIA_STYLE} interactive={false} />
                          )}
                          {showLayersUbicacion && capas?.juntas && (
                            <GeoJSON key="juntas" data={capas.juntas} style={JUNTA_STYLE} interactive={false} />
                          )}
                          {showLayersUbicacion && capas?.zonasZap && (
                            <GeoJSON key="zonasZap" data={capas.zonasZap} style={ZONA_ZAP_STYLE} interactive={false} />
                          )}
                          <div className="absolute right-4 top-4 z-[10000] flex flex-col items-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSatelliteUbicacion(prev => !prev)}
                              className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs text-guinda shadow-card transition-colors hover:bg-guinda hover:text-white"
                              aria-label={satelliteUbicacion ? 'Vista calle' : 'Vista satélite'}
                            >
                              {satelliteUbicacion ? <Map className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                              {satelliteUbicacion ? 'Calle' : 'Satélite'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowLayersUbicacion(prev => !prev)}
                              className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs text-guinda shadow-card transition-colors hover:bg-guinda hover:text-white"
                              aria-label={showLayersUbicacion ? 'Ocultar capas' : 'Mostrar capas'}
                            >
                              {showLayersUbicacion ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              <Layers className="h-3.5 w-3.5" />
                              Capas
                            </button>
                            <button
                              type="button"
                              onClick={() => setUbicacionFullscreen(false)}
                              className="rounded-lg bg-white/90 p-2 shadow-lg hover:bg-white"
                            >
                              <Minimize2 className="h-5 w-5 text-gray-700" />
                            </button>
                          </div>
                        </MapContainer>
                      </div>
                    </div>
                  )}
                  <div className="relative h-48 overflow-hidden rounded-xl">
                    <MapContainer
                      center={[s.latitud, s.longitud]}
                      zoom={16}
                      className="h-full w-full"
                      zoomControl={false}
                      dragging={false}
                      scrollWheelZoom={false}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
                      <DetailMarker position={[s.latitud, s.longitud]} icon={icon} />
                    </MapContainer>
                    <button
                      type="button"
                      onClick={() => setUbicacionFullscreen(true)}
                      className="absolute right-2 top-2 z-[2000] rounded-lg bg-white p-1.5 shadow-lg hover:bg-gray-50"
                    >
                      <Maximize2 className="h-4 w-4 text-gray-700" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-institutional/60">
                    <MapPin className="h-3.5 w-3.5 text-guinda" />
                    {s.latitud.toFixed(6)}, {s.longitud.toFixed(6)}
                  </div>
                </Card>

                {hasTramo && (() => {
                  const puntos = (s.tramo_puntos && s.tramo_puntos.length >= 2)
                    ? s.tramo_puntos
                    : [
                        { lat: s.tramo_lat_ini!, lng: s.tramo_lng_ini! },
                        { lat: s.tramo_lat_fin!, lng: s.tramo_lng_fin! },
                      ]
                  const center: [number, number] = [
                    puntos.reduce((s, p) => s + p.lat, 0) / puntos.length,
                    puntos.reduce((s, p) => s + p.lng, 0) / puntos.length,
                  ]
                  const numMarkers = [
                    marker1,
                    marker2,
                    ...Array.from({ length: Math.max(0, puntos.length - 2) }, (_, i) =>
                      L.divIcon({
                        className: 'flex items-center justify-center',
                        html: `<div style="width:20px;height:20px;border-radius:50%;background:#7d2447;color:white;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${i + 3}</div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10],
                      })
                    ),
                  ]

                  const polyline = (
                    <Polyline
                      positions={puntos.map(p => [p.lat, p.lng])}
                      pathOptions={{ color: '#7d2447', weight: 4, dashArray: '8 4' }}
                    />
                  )
                  const markers = puntos.map((p, i) => (
                    <DetailMarker key={i} position={[p.lat, p.lng]} icon={numMarkers[i] || numMarkers[numMarkers.length - 1]} />
                  ))

                  const compactMap = (
                    <MapContainer
                      center={center}
                      zoom={17}
                      className="h-full w-full"
                      zoomControl={false}
                      dragging={false}
                      scrollWheelZoom={false}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
                      {polyline}
                      {markers}
                    </MapContainer>
                  )

                  const fullMap = (
                    <MapContainer
                      center={center}
                      zoom={17}
                      className="h-full w-full"
                      zoomControl={true}
                    >
                      {!satelliteTramo ? (
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
                      ) : (
                        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution='&copy; Esri' />
                      )}
                      {polyline}
                      {markers}
                      {showLayersTramo && capas?.colonias && (
                        <GeoJSON key="colonias" data={capas.colonias} style={COLONIA_STYLE} interactive={false} />
                      )}
                      {showLayersTramo && capas?.juntas && (
                        <GeoJSON key="juntas" data={capas.juntas} style={JUNTA_STYLE} interactive={false} />
                      )}
                      {showLayersTramo && capas?.zonasZap && (
                        <GeoJSON key="zonasZap" data={capas.zonasZap} style={ZONA_ZAP_STYLE} interactive={false} />
                      )}
                      <div className="absolute right-4 top-4 z-[10000] flex flex-col items-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSatelliteTramo(prev => !prev)}
                          className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs text-guinda shadow-card transition-colors hover:bg-guinda hover:text-white"
                          aria-label={satelliteTramo ? 'Vista calle' : 'Vista satélite'}
                        >
                          {satelliteTramo ? <Map className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                          {satelliteTramo ? 'Calle' : 'Satélite'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowLayersTramo(prev => !prev)}
                          className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs text-guinda shadow-card transition-colors hover:bg-guinda hover:text-white"
                          aria-label={showLayersTramo ? 'Ocultar capas' : 'Mostrar capas'}
                        >
                          {showLayersTramo ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          <Layers className="h-3.5 w-3.5" />
                          Capas
                        </button>
                        <button
                          type="button"
                          onClick={() => setTramoFullscreen(false)}
                          className="rounded-lg bg-white/90 p-2 shadow-lg hover:bg-white"
                        >
                          <Minimize2 className="h-5 w-5 text-gray-700" />
                        </button>
                      </div>
                    </MapContainer>
                  )

                  return (
                    <Card title="Tramo">
                      {tramoFullscreen && (
                        <div className="fixed inset-0 z-[10001] bg-black">
                          <div className="h-full w-full">{fullMap}</div>
                        </div>
                      )}
                      <div className="relative h-48 overflow-hidden rounded-xl">
                        {compactMap}
                        <button
                          type="button"
                          onClick={() => setTramoFullscreen(true)}
                          className="absolute right-2 top-2 z-[2000] rounded-lg bg-white p-1.5 shadow-lg hover:bg-gray-50"
                        >
                          <Maximize2 className="h-4 w-4 text-gray-700" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-institutional/60">
                        <Ruler className="h-3.5 w-3.5 text-guinda" />
                        {s.tramo_lat_ini!.toFixed(6)}, {s.tramo_lng_ini!.toFixed(6)} → {s.tramo_lat_fin!.toFixed(6)}, {s.tramo_lng_fin!.toFixed(6)}
                      </div>
                    </Card>
                  )
                })()}

                <Card title="Información Geográfica" className="relative">
                  {puedeEditar && (
                    <button
                      type="button"
                      onClick={() => { setEditForm(prev => ({ ...prev, calle: s.calle || '', entre_calles: s.entre_calles || '' })); setEditGeoOpen(true) }}
                      className="absolute right-2 top-2 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-guinda"
                      aria-label="Editar información geográfica"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  <div className="flex flex-col gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-guinda" />
                      <span className="text-gray-institutional/60">
                        {s.latitud.toFixed(6)}, {s.longitud.toFixed(6)}
                      </span>
                    </div>

                    {calleInfo?.calle && (
                      <div className="flex items-center gap-2">
                        <Navigation className="h-3.5 w-3.5 text-guinda" />
                        <span className="font-medium text-gray-institutional">
                          {calleInfo.calle}
                        </span>
                      </div>
                    )}

                    {calleInfo?.entreCalles && (
                      <div className="flex items-center gap-2 pl-5">
                        <span className="text-gray-institutional/60">
                          {calleInfo.entreCalles}
                        </span>
                      </div>
                    )}

                    {hasTramo && (
                      <div className="flex items-center gap-2">
                        <Ruler className="h-3.5 w-3.5 text-guinda" />
                        <span className="text-gray-institutional/60">
                          {s.tramo_lat_ini!.toFixed(6)}, {s.tramo_lng_ini!.toFixed(6)} → {s.tramo_lat_fin!.toFixed(6)}, {s.tramo_lng_fin!.toFixed(6)}
                        </span>
                      </div>
                    )}

                    {detection?.fuera_alcance && (
                      <p className="text-xs text-red-500">Fuera del área de cobertura</p>
                    )}
                  </div>
                </Card>

                <Card title="Datos SIGED (ficha técnica)">
                  <div className="flex flex-col gap-3 text-sm">
                    <p className="text-xs text-gray-institutional/60">
                      CCT de la escuela — se busca automáticamente para complementar la ficha técnica.
                    </p>
                    <div className="relative">
                      <input
                        type="text"
                        value={sigedCct}
                        onChange={e => setSigedCct(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                        placeholder="21DPR0881C"
                        maxLength={10}
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 pr-8 text-xs font-mono uppercase outline-none focus:border-guinda"
                      />
                      {sigedLoading && (
                        <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-guinda" />
                      )}
                    </div>

                    {sigedError && (
                      <p className="text-xs text-red-500">{sigedError}</p>
                    )}

                    {sigedData && (
                      <div className="rounded-xl bg-blue-50 p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <School className="h-4 w-4 text-blue-600" />
                          <span className="text-xs font-bold text-blue-800">{sigedData.nombre}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">CCT</span>
                            <span className="font-mono font-medium text-gray-institutional">{sigedData.cct}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Nivel</span>
                            <span className="font-medium text-guinda">{sigedData.nivel}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Subnivel</span>
                            <span className="text-gray-institutional">{sigedData.subnivel}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Turno</span>
                            <span className="text-gray-institutional">{sigedData.turno}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Sostenimiento</span>
                            <span className="text-gray-institutional">{sigedData.sostenimiento}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Total alumnos</span>
                            <span className="font-bold text-guinda">{sigedData.totalAlumnos}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Alumnos (H/M)</span>
                            <span className="text-gray-institutional">{sigedData.alumnosHombres}/{sigedData.alumnosMujeres}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Docentes</span>
                            <span className="text-gray-institutional">{sigedData.docentes}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Grupos</span>
                            <span className="text-gray-institutional">{sigedData.grupos}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Municipio</span>
                            <span className="text-gray-institutional">{sigedData.municipio}</span>
                          </div>
                          <div className="col-span-2 flex justify-between">
                            <span className="text-gray-500">Domicilio</span>
                            <span className="max-w-[200px] text-right text-gray-institutional">{sigedData.domicilio}</span>
                          </div>
                          <div className="col-span-2 flex justify-between">
                            <span className="text-gray-500">Fuente</span>
                            <span className="text-xs text-gray-400">{sigedData.fuente}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>

              {showGenerateButtons && (
              <div className="mt-6 flex flex-col gap-3 border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-institutional/50">Documentos</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleOpenDocumentModal} className="flex w-full items-center justify-center gap-2">
                    <FileText className="h-4 w-4" />
                    Generar oficio y ficha técnica
                  </Button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {editGeoOpen && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-guinda">Editar información geográfica</h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-institutional/70">Calle</label>
                <input
                  type="text"
                  value={editForm.calle}
                  onChange={e => setEditForm(prev => ({ ...prev, calle: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-institutional outline-none focus:border-guinda focus:ring-1 focus:ring-guinda/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-institutional/70">Entre calles</label>
                <input
                  type="text"
                  value={editForm.entre_calles}
                  onChange={e => setEditForm(prev => ({ ...prev, entre_calles: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-institutional outline-none focus:border-guinda focus:ring-1 focus:ring-guinda/30"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setEditGeoOpen(false)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-institutional transition-colors hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveGeo}
                disabled={editSaving}
                className="flex-1 rounded-xl bg-guinda px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-guinda/90 disabled:opacity-50"
              >
                {editSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editObraOpen && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-guinda">Editar datos de la obra</h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-institutional/70">Tipo de obra</label>
                <select
                  value={editForm.tipo_solicitud}
                  onChange={e => setEditForm(prev => ({ ...prev, tipo_solicitud: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-institutional outline-none focus:border-guinda focus:ring-1 focus:ring-guinda/30"
                >
                  {CATALOGO_TIPOS_OBRA.map(t => (
                    <option key={t.nombre} value={t.nombre}>{t.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-institutional/70">Colonia</label>
                <input
                  type="text"
                  value={editForm.colonia}
                  onChange={e => setEditForm(prev => ({ ...prev, colonia: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-institutional outline-none focus:border-guinda focus:ring-1 focus:ring-guinda/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-institutional/70">Junta auxiliar</label>
                <input
                  type="text"
                  value={editForm.junta_auxiliar}
                  onChange={e => setEditForm(prev => ({ ...prev, junta_auxiliar: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-institutional outline-none focus:border-guinda focus:ring-1 focus:ring-guinda/30"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setEditObraOpen(false)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-institutional transition-colors hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveObra}
                disabled={editSaving}
                className="flex-1 rounded-xl bg-guinda px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-guinda/90 disabled:opacity-50"
              >
                {editSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editTramoOpen && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-guinda">Editar información del tramo</h3>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-institutional/70">Distancia (m)</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.distancia_tramo_m}
                    onChange={e => setEditForm(prev => ({ ...prev, distancia_tramo_m: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-institutional outline-none focus:border-guinda focus:ring-1 focus:ring-guinda/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-institutional/70">Ancho de calle (m)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={editForm.ancho_calle_m}
                    onChange={e => setEditForm(prev => ({ ...prev, ancho_calle_m: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-institutional outline-none focus:border-guinda focus:ring-1 focus:ring-guinda/30"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-institutional/70">Zona ZAP</label>
                  <select
                    value={editForm.zona_zap ? 'si' : 'no'}
                    onChange={e => setEditForm(prev => ({ ...prev, zona_zap: e.target.value === 'si' }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-institutional outline-none focus:border-guinda focus:ring-1 focus:ring-guinda/30"
                  >
                    <option value="no">No</option>
                    <option value="si">Si</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-institutional/70">Cobertura de agua</label>
                  <select
                    value={editForm.cobertura_agua ? 'si' : 'no'}
                    onChange={e => setEditForm(prev => ({ ...prev, cobertura_agua: e.target.value === 'si' }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-institutional outline-none focus:border-guinda focus:ring-1 focus:ring-guinda/30"
                  >
                    <option value="no">No</option>
                    <option value="si">Si</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-institutional/70">
                  Escuelas (claves CCT separadas por coma)
                </label>
                <input
                  type="text"
                  value={editForm.escuelas_cercanas}
                  onChange={e => setEditForm(prev => ({ ...prev, escuelas_cercanas: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-institutional outline-none focus:border-guinda focus:ring-1 focus:ring-guinda/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-institutional/70">
                  Iglesias (separadas por coma)
                </label>
                <input
                  type="text"
                  value={editForm.iglesias_cercanas}
                  onChange={e => setEditForm(prev => ({ ...prev, iglesias_cercanas: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-institutional outline-none focus:border-guinda focus:ring-1 focus:ring-guinda/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-institutional/70">
                  Rutas de transporte (separadas por coma)
                </label>
                <input
                  type="text"
                  value={editForm.transportes_cercanos}
                  onChange={e => setEditForm(prev => ({ ...prev, transportes_cercanos: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-institutional outline-none focus:border-guinda focus:ring-1 focus:ring-guinda/30"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setEditTramoOpen(false)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-institutional transition-colors hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveTramo}
                disabled={editSaving}
                className="flex-1 rounded-xl bg-guinda px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-guinda/90 disabled:opacity-50"
              >
                {editSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
