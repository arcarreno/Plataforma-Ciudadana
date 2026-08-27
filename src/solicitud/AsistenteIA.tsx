/**
 * @file AsistenteIA.tsx
 * @description Asistente conversacional por voz/texto que guía al usuario paso a paso para
 *              llenar SolicitudForm. Extrae entidades con iaLocal (regex/NLP ligero) y pide
 *              confirmación antes de avanzar.
 *
 * Flujo conversacional:
 *  1. Saludo + primera pregunta según siguientePregunta() (recorre PREGUNTAS filtrando
 *     !completadosRef.has && !esLleno). PREGUNTAS tiene 11 campos: apellido_paterno/materno,
 *     nombres, curp, telefono, correo, tipo, ubicacion, calle, entre_calles, descripcion.
 *  2. Usuario responde por texto o voz (SpeechRecognition). enviar(texto) muestra mensaje user,
 *     verifica si hay pendiente de confirmación (pendientesRef): interpreta sí/no con esSi/esNo
 *     (regex tolerante a slang mexicano: sip, simón, va, sale, nel, etc.). Si no, limpia o confirma
 *     y avanza; si pendiente, pide re-confirmación.
 *  3. Si no hay pendiente: valorDeCampo(campo, texto) usa extraerTodo + extraerCampo (iaLocal)
 *     para obtener Partial<IaLlenarResultado>; onAplicar(data) intenta llenar form y retorna
 *     etiquetas llenadas. Se mapean a LLENADO_A_CAMPO/ETIQUETA_A_DATO para generar pendientes
 *     con preguntaConfirmacion "Capturé \"valor\" como etiqueta. ¿Es correcto?".
 *  4. Si onAplicar no llenó nada, muestra "No pude capturar..." + repite pregunta activa.
 *     continuar() maneja caso especial ubicacion: marca mapaPendienteRef, muestra mensaje de
 *     mapa y dispara onAbrirMapa (MapaCombinado). Si último paso, setTerminado true.
 *  5. Mapa: effect en mapaConfirmado verifica esLleno('ubicacion') y calles; si falta, reabre mapa;
 *     si todo ok, agradece y sigue. completa ubicacion siempre tras confirmación.
 *  6. Voz: arrancar() crea reconocedor via crearReconocedor(), maneja onstart/onaudiostart,
 *     onresult (fusionarTranscripcion con textoRef + vivo preview), onend/onerror con reintentos
 *     (max 4, fallar() con mensajes Brave shield, network, mic). hablar() con Web Speech API para
 *     leer preguntas IA (precargarVoces). Botón Mic/MicOff toggle, textarea sincronizado con input.
 *     hablarUltimo repite última pregunta.
 *
 * Props: esLleno(campo)->bool, onAplicar(data)->string[], onLimpiar(campo), onClose, onAbrirMapa,
 *        mapaConfirmado (number trigger).
 * Estado: mensajes (Msg[] con autor ia/user), input/vivo/estadoVoz, terminado, escuchando,
 *         completadosRef Set, pendientesRef queue, preguntaActivaRef, manualRef, reintentosRef.
 * UI: header guinda con Sparkles y botones repeat/close, lista scrollable, input + mic + send.
 */
﻿import { useEffect, useRef, useState } from 'react'
import { Sparkles, Send, X, Mic, MicOff } from 'lucide-react'
import Button from '../shared/Button'
import type { IaLlenarResultado } from '../lib/servidor'
import { extraerCampo, extraerTodo } from '../lib/iaLocal'
import { hablar, crearReconocedor, ultimoTranscripcion, fusionarTranscripcion, precargarVoces } from '../lib/speech'
import type { SpeechRecognitionLike } from '../lib/speech'
import { TIPOS_OBRA_NOMBRES } from '../core/constants'

/** Mensaje de chat: autor ia/user y texto. */
interface Msg {
  autor: 'ia' | 'user'
  texto: string
}

/** Props: esLleno verifica completitud, onAplicar llena form, onAbrirMapa, mapaConfirmado trigger. */
interface AsistenteIAProps {
  esLleno: (campo: string) => boolean
  onAplicar: (data: Partial<IaLlenarResultado>) => string[]
  onLimpiar?: (campo: string) => void
  onClose?: () => void
  onAbrirMapa?: () => void
  mapaConfirmado?: number
}

// --- Cuestionario secuencial de 11 campos con textos de pregunta ---
// 11 preguntas ordenadas; ubicacion dispara apertura de mapa
const PREGUNTAS = [
  { campo: 'apellido_paterno', pregunta: '¿Cuál es tu apellido paterno?' },
  { campo: 'apellido_materno', pregunta: '¿Y tu apellido materno?' },
  { campo: 'nombres', pregunta: '¿Cuál es tu nombre o nombres?' },
  { campo: 'curp', pregunta: '¿Cuál es tu CURP?' },
  { campo: 'telefono', pregunta: '¿Para contactarte, cuál es tu teléfono a 10 dígitos?' },
  { campo: 'correo', pregunta: '¿Cuál es tu correo electrónico?' },
  { campo: 'tipo', pregunta: `¿Qué servicio necesitas? Dime por ejemplo: ${TIPOS_OBRA_NOMBRES.slice(0, 5).join(', ')} u otro.` },
  { campo: 'ubicacion', pregunta: 'Ahora necesito ubicar en el mapa el lugar donde quieres la obra.' },
  { campo: 'calle', pregunta: '¿Cuál es el nombre principal de la calle donde se ubica la obra?' },
  { campo: 'entre_calles', pregunta: '¿Entre qué calles se ubica? Dime las calles que la cruzan.' },
  { campo: 'descripcion', pregunta: 'Cuéntame con detalle, ¿cuál es el problema?' },
]

const SALUDO =
  '¡Hola! Soy el asistente para capturar tu solicitud. Contesta una pregunta a la vez y yo voy llenando el formulario. Empecemos:'

// Mapea etiqueta devuelta por onAplicar a campo interno de PREGUNTAS
const LLENADO_A_CAMPO: Record<string, string> = {
  'nombre': 'nombres',
  'apellido paterno': 'apellido_paterno',
  'apellido materno': 'apellido_materno',
  'nombre(s)': 'nombres',
  'CURP': 'curp',
  'teléfono': 'telefono',
  'correo': 'correo',
  'tipo de obra': 'tipo',
  'colonia': 'ubicacion',
  'calle': 'calle',
  'entre calles': 'entre_calles',
  'descripción': 'descripcion',
}

const ETIQUETA_A_DATO: Record<string, keyof IaLlenarResultado> = {
  'nombre': 'nombre_solicitante',
  'apellido paterno': 'apellido_paterno',
  'apellido materno': 'apellido_materno',
  'nombre(s)': 'nombres',
  'CURP': 'curp',
  'teléfono': 'telefono',
  'correo': 'correo',
  'tipo de obra': 'tipo_solicitud',
  'colonia': 'colonia',
  'calle': 'calle',
  'entre calles': 'entre_calles',
  'descripción': 'descripcion',
}

/** Extrae valor específico según campo activo usando iaLocal extraerCampo/extraerTodo. */
function valorDeCampo(campo: string, texto: string): Partial<IaLlenarResultado> {
  const extra = extraerTodo(texto)
  const extrajo = extraerCampo(campo, texto)
  if (!extrajo) return extra

  switch (campo) {
    case 'apellido_paterno': return { ...extra, apellido_paterno: extrajo }
    case 'apellido_materno': return { ...extra, apellido_materno: extrajo }
    case 'nombres': return { ...extra, nombres: extrajo }
    case 'curp': return { ...extra, curp: extrajo.toUpperCase() }
    case 'telefono': return { ...extra, telefono: extrajo }
    case 'correo': return { ...extra, correo: extrajo.toLowerCase() }
    case 'tipo': return { ...extra, tipo_solicitud: extrajo }
    case 'ubicacion': return { ...extra, colonia: extrajo }
    case 'descripcion': return { ...extra, descripcion: extrajo }
    default: return extra
  }
}

// --- AsistenteIA: orquesta flujo de preguntas, validación sí/no, voz y mapa ---
export default function AsistenteIA({ esLleno, onAplicar, onLimpiar, onClose, onAbrirMapa, mapaConfirmado }: AsistenteIAProps) {
  // completadosRef Set de campos ya confirmados; mapaPendienteRef evita reabrir mapa en loop
  const completadosRef = useRef<Set<string>>(new Set())
  const mapaPendienteRef = useRef(false)
  const siguientePregunta = (): { campo: string; texto: string } | null => {
    for (const p of PREGUNTAS) {
      if (!completadosRef.current.has(p.campo) && !esLleno(p.campo)) return { campo: p.campo, texto: p.pregunta }
    }
    return null
  }

const preguntaActivaRef = useRef('')
  const pendientesRef = useRef<{ campo: string; etiqueta: string; valor: string }[]>([])

  // estadoInicial calcula saludo + primera pregunta según siguientePregunta()
  const [estadoInicial] = useState(() => {
    const primeras: Msg[] = [{ autor: 'ia', texto: SALUDO }]
    const sig = siguientePregunta()
    if (sig) primeras.push({ autor: 'ia', texto: sig.texto })
    return { mensajes: primeras, terminado: !sig }
  })
  // mensajes array ia/user; input/vivo/estadoVoz/terminado/escuchando; refs para voz y scroll
  const [mensajes, setMensajes] = useState<Msg[]>(estadoInicial.mensajes)
  const [input, setInput] = useState('')
  const [vivo, setVivo] = useState('')
  const [estadoVoz, setEstadoVoz] = useState('')
  const [terminado, setTerminado] = useState(estadoInicial.terminado)
  const [escuchando, setEscuchando] = useState(false)
  const listaRef = useRef<HTMLDivElement>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const yaHabladoRef = useRef(0)
  const textoRef = useRef('')
  const manualRef = useRef(false)
  const reintentosRef = useRef(0)
  const ultimoErrorRef = useRef('')

  // --- Detección de respuesta sí/no con mucha tolerancia a slang/mexicanismos ---
    // Detecta afirmación tolerante a mexicanismos (sip, simón, va, sale, ok, etc.)
const esSi = (t: string): boolean => {
    const x = ' ' + t.toLowerCase().trim().replace(/[^\p{L}\p{N}\s]/gu, '') + ' '
    return /(^|\s)(s[ií]|sip|sipi|sim[oó]n|sipo?|yes|claro|si claro|est[aá] bien|ok|oka|okay|de acuerdo|v[áa]le|correcto|perfecto|sale|si como no|siuu)/.test(x)
  }
  const esNo = (t: string): boolean => {
    const x = ' ' + t.toLowerCase().trim().replace(/[^\p{L}\p{N}\s]/gu, '') + ' '
    return /(^|\s)(no|noa|non|n[oó]po|nel|ni modo|negativo|nada|jam[aá]s|cambi|repite|otra vez|no es)/.test(x) || /\sno\s/.test(x)
  }

  /** Genera texto de confirmación para campo pendiente. */
  const preguntaConfirmacion = (p: { campo: string; etiqueta: string; valor: string }): string =>
    `Capturé "${p.valor}" como ${p.etiqueta.toLocaleLowerCase()}. ¿Es correcto? Responde sí o no.`

    // Auto-scroll del chat al añadir mensajes
useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: 'smooth' })
  }, [mensajes, vivo])

  useEffect(() => {
    const nuevas = mensajes.slice(yaHabladoRef.current).filter((m) => m.autor === 'ia')
    if (nuevas.length === 0) return
    yaHabladoRef.current = mensajes.length
    hablar(nuevas.map((m) => m.texto).join(' '))
  }, [mensajes])

    // Precarga voces y limpia reconocimiento al desmontar
useEffect(() => {
    precargarVoces()
    return () => {
      recRef.current?.abort()
      recRef.current = null
      window.speechSynthesis?.cancel()
    }
  }, [])

    // Reacciona a confirmación de mapa: valida punto/calle y decide siguiente pregunta
useEffect(() => {
    if (!mapaConfirmado) return
    if (mapaPendienteRef.current) mapaPendienteRef.current = false
    const area = new Set<string>()
    for (const c of ['colonia', 'calle', 'entre_calles']) {
      if (c === 'colonia' ? esLleno('ubicacion') : esLleno(c)) area.add(c)
    }
    const faltaPunto = !esLleno('ubicacion')
    completadosRef.current.add('ubicacion')
    let texto: string
    if (faltaPunto) {
      texto = 'Presionaste confirmar, pero no capté el punto del mapa. Vuelve a colocarlo y confirma, o dime el nombre de la colonia.'
      setMensajes(m => [...m, { autor: 'ia', texto }])
      onAbrirMapa?.()
      return
    }
    const sinCalle = !esLleno('calle')
    const sinEntre = !esLleno('entre_calles')
    const faltanDireccion = sinCalle || sinEntre
    const sig = siguientePregunta()
if (faltanDireccion) {
      texto = 'Tu punto quedó marcado, pero no tengo los datos exactos de la calle. '
      if (sinCalle && sinEntre) {
        texto += 'Por favor, dime el nombre principal de la calle y las calles que la cruzan.'
        preguntaActivaRef.current = 'calle'
      } else if (sinCalle) {
        texto += 'Por favor, dime el nombre principal de la calle.'
        preguntaActivaRef.current = 'calle'
      } else {
        texto += 'Por favor, dime entre cuáles calles se ubica la obra.'
        preguntaActivaRef.current = 'entre_calles'
      }
    } else {
      texto = 'Perfecto, todos los datos se han extraído con éxito.'
      if (sig) texto += ` ${sig.texto}`
    }
    setMensajes(m => [...m, { autor: 'ia', texto }])
    if (!sig) setTerminado(true)
  }, [mapaConfirmado])

  // Abort recognition manual y envía lo capturado
  const terminarEscucha = () => {
    manualRef.current = true
    recRef.current?.abort()
    recRef.current = null
    setEscuchando(false)
    setVivo('')
    const t = textoRef.current.trim()
    if (t) enviar(t)
  }

  const hacerPregunta = (sig: { campo: string; texto: string }) => {
    preguntaActivaRef.current = sig.campo
    setMensajes(m => [...m, { autor: 'ia', texto: sig.texto }])
  }

  const hacerPreguntaDeCampo = (campo: string) => {
    const p = PREGUNTAS.find(x => x.campo === campo)
    if (p) hacerPregunta({ campo: p.campo, texto: p.pregunta })
  }

  /** Avanza al siguiente campo; caso especial ubicacion abre mapa con mensaje guiado. */
  const continuar = () => {
    const sig = siguientePregunta()
    if (sig?.campo === 'ubicacion' && !mapaPendienteRef.current) {
      preguntaActivaRef.current = 'ubicacion'
      mapaPendienteRef.current = true
      setMensajes(m => [...m, {
        autor: 'ia',
        texto: 'A continuación verás el mapa de la Heroica Puebla de Zaragoza. Marca en la pantalla el lugar donde deseas tu obra. Si estás en el lugar ideal, presiona el botón para obtener tu ubicación; si no, desplázate por el mapa y coloca el pin.',
      }])
      onAbrirMapa?.()
      return
    }
    if (sig) {
      hacerPregunta(sig)
      return
    }
    setTerminado(true)
  }

    /** Maneja envío de texto: gestiona confirmaciones pendientes, extrae entidades y pide confirmación. */
const enviar = (texto = input.trim()) => {
    if (!texto) return
    setInput('')
    textoRef.current = ''
    setMensajes(m => [...m, { autor: 'user', texto }])

    // Si hay campos capturados esperando confirmación, interpreta la respuesta
    const pendiente = pendientesRef.current.length ? pendientesRef.current[0] : null
    if (pendiente) {
      if (esNo(texto)) {
        onLimpiar?.(pendiente.campo)
        completadosRef.current.delete(pendiente.campo)
        pendientesRef.current = []
        if (pendiente.campo) {
          hacerPreguntaDeCampo(pendiente.campo)
        } else {
          continuar()
        }
        return
      }
      if (esSi(texto)) {
        pendientesRef.current.shift()
        if (pendiente.campo) completadosRef.current.add(pendiente.campo)
        const mas = pendientesRef.current.length ? pendientesRef.current[0] : null
        if (mas) {
          setMensajes(m => [...m, { autor: 'ia', texto: preguntaConfirmacion(mas) }])
          return
        }
        continuar()
        return
      }
      setMensajes(m => [...m, { autor: 'ia', texto: `No te entendí. ${preguntaConfirmacion(pendiente)}` }])
      return
    }

    // Campo objetivo = el que se está preguntando en pantalla (no saltar al "siguiente")
    const campo = preguntaActivaRef.current || siguientePregunta()?.campo || ''
    const data = valorDeCampo(campo, texto)
    const llenados = onAplicar(data)
    const nuevosPendientes: { campo: string; etiqueta: string; valor: string }[] = []
    for (const c of llenados) {
      const campoLlenado = LLENADO_A_CAMPO[c]
      if (!campoLlenado) continue
      const datoKey = ETIQUETA_A_DATO[c]
      const valor = datoKey ? String(data?.[datoKey] ?? '') : ''
      nuevosPendientes.push({ campo: campoLlenado, etiqueta: c, valor })
    }
    if (nuevosPendientes.length > 0) {
      pendientesRef.current = nuevosPendientes
      setMensajes(m => [...m, { autor: 'ia', texto: preguntaConfirmacion(nuevosPendientes[0]) }])
      return
    }

    if (llenados.length === 0) {
      if (preguntaActivaRef.current) {
        const activa = PREGUNTAS.find(p => p.campo === preguntaActivaRef.current)
        if (activa) {
          setMensajes(m => [...m, { autor: 'ia', texto: `No pude capturar eso. ${activa.pregunta}` }])
          return
        }
      }
      const sig = siguientePregunta()
      if (sig && sig.campo !== 'ubicacion') {
        setMensajes(m => [...m, { autor: 'ia', texto: `No pude capturar eso. ${sig.texto}` }])
        return
      }
    }
    continuar()
  }

    // Inicia reconocimiento de voz con manejo de permisos, reintentos y mensajes Brave
const arrancar = (reintento: boolean) => {
    window.speechSynthesis?.cancel()
    setEstadoVoz('Conectando al servicio de voz…')
    if (!reintento) {
      textoRef.current = ''
      setVivo('')
      reintentosRef.current = 0
    }
    const rec = crearReconocedor()
    if (!rec) {
      setEstadoVoz('')
      setMensajes(m => [...m, { autor: 'ia', texto: 'Tu navegador no soporta reconocimiento de voz. Escribe tu respuesta debajo.' }])
      return
    }
    rec.onstart = () => setEstadoVoz('Escuchando…')
    rec.onaudiostart = () => {
      reintentosRef.current = 0
      setEstadoVoz('Habla ahora…')
    }
    rec.onresult = (e) => {
      const nuevo = ultimoTranscripcion(e)
      if (!nuevo) return
      const fusion = fusionarTranscripcion(textoRef.current, nuevo)
      textoRef.current = fusion
      setInput(fusion)
      if (fusion) setVivo(fusion)
    }
    rec.onend = () => {
      if (recRef.current !== rec) return
      recRef.current = null
      fallar(
        'El reconocimiento terminó sin captar audio. Revisa que el escudo de Brave no esté bloqueando la voz para este sitio, o recarga la página y vuelve a intentarlo.',
        false
      )
    }
    rec.onerror = (ev) => {
      if (recRef.current !== rec) return
      recRef.current = null
      const nombre = (ev as { error?: string })?.error ?? ''
      ultimoErrorRef.current = nombre
      if (nombre === 'not-allowed' || nombre === 'service-not-allowed' || nombre.startsWith('audio-capture')) {
        reintentosRef.current = 0
        fallar(
          'No pude acceder a tu micrófono. Verifica que esté permitido el permiso en el navegador y vuelve a intentarlo, o escribe tu respuesta debajo.',
          true
        )
        return
      }
      if (nombre === 'network' || nombre === 'network-timeout') {
        fallar(
          'El permiso de voz se bloqueó o no se pudo conectar al servicio. Toca el ícono del escudo al inicio de la barra de direcciones de Brave, permite el micrófono y vuelve a intentar.',
          true
        )
        return
      }
      fallar('', false)
    }
    recRef.current = rec
    try {
      rec.start()
      setEscuchando(true)
    } catch {
      recRef.current = null
      fallar('El micrófono no pudo iniciar. Recarga la página, acepta el permiso y vuelve a intentarlo.', true)
    }
  }

  function fallar(mensaje: string, forzar: boolean): void {
    if (manualRef.current || terminado) {
      setEscuchando(false)
      setVivo('')
      setEstadoVoz('')
      return
    }
    reintentosRef.current += 1
    if (forzar || reintentosRef.current >= 4) {
      setEscuchando(false)
      setVivo('')
      setEstadoVoz('')
      setMensajes(m => [...m, { autor: 'ia', texto: mensaje }])
      reintentosRef.current = 0
      return
    }
    setEstadoVoz(`Reintentando ${reintentosRef.current + 1}/3…`)
    setTimeout(() => {
      if (!manualRef.current && !terminado) arrancar(true)
    }, 800)
  }

  const iniciarEscucha = () => {
    if (escuchando) return
    manualRef.current = false
    arrancar(false)
  }

  const hablarUltimo = () => {
    const ultimas = mensajes.filter((m) => m.autor === 'ia')
    const texto = ultimas.length ? ultimas[ultimas.length - 1].texto : ''
    if (texto) hablar(texto)
  }

  // --- JSX: header guinda con repeat/close, lista de mensajes, área terminado vs input+mic+send ---
  return (
    <div className="overflow-hidden rounded-2xl border border-alabaster-dark/40 bg-white shadow-sm">
      <div className="flex items-center justify-between bg-guinda px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-5 text-white" />
          <span className="text-sm font-semibold text-white">Asistente de captura por voz</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={hablarUltimo}
            aria-label="Repetir pregunta"
            className="rounded-full p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M11 5 6 9H2v6h4l5 4V5z" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar asistente"
              className="rounded-full p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div ref={listaRef} className="flex max-h-72 flex-col gap-3 overflow-y-auto bg-alabaster/40 p-4">
        {mensajes.map((m, i) => (
          <div key={i} className={`flex ${m.autor === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.autor === 'user'
                  ? 'rounded-br-sm bg-guinda text-white'
                  : 'rounded-bl-sm border border-alabaster-dark/30 bg-white text-gray-institutional'
              }`}
            >
              {m.texto}
            </div>
          </div>
        ))}
        {escuchando && (
          <div className="flex justify-end">
            <div className="flex max-w-[80%] items-center gap-2 rounded-2xl rounded-br-sm bg-guinda/20 px-3 py-2 text-sm leading-relaxed text-guinda">
              {vivo ? (
                <span>{vivo}</span>
              ) : (
                <>
                  <span className="h-2 w-2 shrink-0 animate-bounce rounded-full bg-guinda" />
                  <span className="italic opacity-80">Escuchando…</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-alabaster-dark/30 bg-white p-3">
        {terminado ? (
          <p className="text-center text-xs text-green-700">
            ¡Gracias! El formulario quedó con tus datos. Revisa, complementa los faltantes y marca la ubicación en el mapa.
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={escuchando ? terminarEscucha : iniciarEscucha}
              aria-label={escuchando ? 'Terminar y enviar lo hablado' : 'Empezar a hablar'}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${
                escuchando
                  ? 'bg-red-500 text-white shadow-lg animate-pulse'
                  : 'bg-guinda/10 text-guinda hover:bg-guinda/20'
              }`}
            >
              {escuchando ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
              rows={2}
              placeholder={escuchando ? 'Te estoy escuchando...' : 'Responde hablando o aquí...'}
              className="min-h-[52px] flex-1 resize-none rounded-xl border-2 border-alabaster-dark/30 bg-alabaster/30 px-3 py-2 text-sm text-gray-institutional outline-none transition focus:border-guinda"
            />
            <Button
              type="button"
              onClick={() => enviar()}
              disabled={!input.trim()}
              className="!px-3"
              aria-label="Enviar respuesta"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
        {estadoVoz && (
          <p className="mt-2 text-center text-xs" aria-live="polite">
            <span className="font-medium text-guinda">{estadoVoz}</span>
          </p>
        )}
      </div>
    </div>
  )
}
