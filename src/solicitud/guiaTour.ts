/**
 * @file guiaTour.ts
 * @description
 * Tour guiado interactivo para el flujo de solicitud de obra, basado en `driver.js`.
 * Guía al usuario paso a paso por el mapa, picado de ubicación, confirmación de
 * datos, dibujo de tramo y revisión de la tarjeta de obra.
 *
 * Algoritmos / mecanismos clave:
 * - **Definición de pasos** (`paso`): cada `DriveStep` apunta a un selector CSS,
 *   con `autoAvanzar` (condición para avanzar automáticamente) y flags `verMapa`/
 *   `mostrarResumen` que alteran el popover.
 * - **Avance automático** (`programarAvance` + `vigilar`): si la condición ya se
 *   cumple, espera `AVANCE_DIFERIDO` y avanza; si no, observa el DOM con
 *   `MutationObserver` + polling cada 400 ms hasta que se cumpla, luego espera
 *   `AVANCE_RAPIDO` y avanza. Maneja el último paso desvaneciendo el overlay.
 * - **Popover dinámico** (`onPopoverRender`): inyecta el logo SEMOVINFRA y oculta
 *   la flecha; si `verMapa` agrega botón "Ver mapa" que salta al highlight del
 *   mapa completo; si `mostrarResumen` alterna entre `TEXTO_BOTON_REALIZADO` y
 *   `TEXTO_TARJETA_OBRA` según exista `[data-tour="resumen-obra"]`.
 * - **Vigilancia de resumen** (`vigilarResumen`): cuando se entra al paso de
 *   resumen, espera a que aparezca la tarjeta y la highlighta; luego vigila su
 *   desaparición para cerrar el tour con `desvanecer`.
 * - **Refresco de posición** (`iniciarRefresco`): `setInterval` cada 600 ms que
 *   llama `driver.refresh()` si el elemento highlightado sigue conectado y visible,
 *   evitando recálculos durante la animación tween.
 * - **Persistencia** (`yaVisto`/`marcarVisto`): localStorage `semovinfra_tour_visto`
 *   para no repetir el tour; solo en desktop (min-width 768px).
 */

import { driver } from 'driver.js'
import type { Driver, DriveStep, PopoverDOM, DriverHook } from 'driver.js'
import 'driver.js/dist/driver.css'
import logoSemovinfra from '../assets/Logo_Semovinfra.jpg'

/** Tipo de las opciones del hook de driver.js (tercer parámetro). */
type HookOpts = Parameters<DriverHook>[2]

/** Key de localStorage para recordar si el tour ya fue visto. */
const TOUR_KEY = 'semovinfra_tour_visto'
/** Delay corto antes de avanzar cuando la condición ya se venía vigilando. */
const AVANCE_RAPIDO = 900
/** Delay inicial antes de verificar si la condición ya está cumplida al entrar al paso. */
const AVANCE_DIFERIDO = 2000
/** Duración de la animación tween de driver.js (usada para evitar refresh durante animación). */
const DURACION_TWEEN = 400

/** Textos para el paso que muestra el botón "Realizado" (antes de que aparezca la tarjeta). */
const TEXTO_BOTON_REALIZADO = {
  titulo: 'Revisa tus datos',
  descripcion:
    'Presiona «Realizado» para ver la tarjeta con los datos de tu obra ya rellenados: coordenadas del punto y del tramo, colonia, calle y entre calles.',
}

/** Textos para el paso cuando la tarjeta de obra ya está visible. */
const TEXTO_TARJETA_OBRA = {
  titulo: 'Datos de obra',
  descripcion:
    'Así quedaron rellenados tus campos de forma automática: coordenadas del punto y del tramo, colonia, junta auxiliar, calle y entre calles. Solo te falta explicar la razón de tu problema, subir evidencias si las tienes y enviar la solicitud.',
}

/** Instancia activa del driver; null si no hay tour en curso. */
let driverActivo: Driver | null = null
/** Intervalo de refresco de posición del highlight. */
let intervaloRefresco: ReturnType<typeof setInterval> | null = null
/** Timestamp de la última activación de highlight (para evitar refresh durante tween). */
let ultimaActivacion = 0
/** Elemento actualmente highlightado (para verificar isConnected y getBoundingClientRect). */
let elementoActual: Element | null = null

/**
 * Verifica si el tour ya fue visto según localStorage.
 * @param key - Key en localStorage.
 * @returns `true` si existe el flag.
 */
function yaVisto(key: string): boolean {
  try {
    return !!localStorage.getItem(key)
  } catch {
    return false
  }
}

/**
 * Marca el tour como visto en localStorage.
 * @param key - Key en localStorage.
 */
function marcarVisto(key: string) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // almacenamiento no disponible: se muestra igual esta vez
  }
}

/**
 * Lee el texto del panel de datos de ubicación (usado como condición de avance).
 * @returns Texto del elemento `[data-tour="panel"]` o cadena vacía.
 */
function panelTexto(): string {
  return document.querySelector('[data-tour="panel"]')?.textContent ?? ''
}

/**
 * Factory de pasos del tour.
 * @param selector - Selector CSS del elemento a highlightar.
 * @param titulo - Título del popover.
 * @param descripcion - Descripción del popover.
 * @param side - Lado donde aparece el popover respecto al elemento.
 * @param autoAvanzar - Condición que, al cumplirse, avanza automáticamente al siguiente paso.
 * @param verMapa - Si true, agrega botón "Ver mapa" en el popover.
 * @param mostrarResumen - Si true, el popover adapta su texto según exista la tarjeta de obra.
 * @returns DriveStep configurado.
 */
function paso(
  selector: string,
  titulo: string,
  descripcion: string,
  side: 'top' | 'right' | 'bottom' | 'left',
  autoAvanzar?: () => boolean,
  verMapa = false,
  mostrarResumen = false,
): DriveStep {
  return {
    element: selector,
    skipMissingElement: true,
    popover: { title: titulo, description: descripcion, side, align: 'start' },
    data: { autoAvanzar, verMapa, mostrarResumen },
  }
}

/**
 * Inyecta el header con logo SEMOVINFRA en el popover y oculta la flecha.
 * Se ejecuta en `onPopoverRender`; evita duplicar el header si ya existe.
 * @param popover - DOM del popover de driver.js.
 */
function prepararPopover(popover: PopoverDOM) {
  if (popover.wrapper.querySelector('.driver-head')) return
  const head = document.createElement('div')
  head.className = 'driver-head'
  const img = document.createElement('img')
  img.src = logoSemovinfra
  img.alt = 'Semovinfra'
  head.appendChild(img)
  popover.wrapper.prepend(head)
  popover.arrow.style.display = 'none'
}

/**
 * Observa el DOM hasta que `condicion()` sea verdadera, entonces ejecuta `alCumplirse`.
 * Usa `MutationObserver` sobre `document.documentElement` + polling cada 400 ms como fallback.
 * Retorna función `parar` para cancelar la vigilancia.
 * @param condicion - Predicado a evaluar.
 * @param alCumplirse - Callback al cumplirse la condición.
 * @returns Función para detener la observación.
 */
function vigilar(condicion: () => boolean, alCumplirse: () => void): () => void {
  let detenido = false
  let observador: MutationObserver
  let intervalo: ReturnType<typeof setInterval>
  const parar = () => {
    if (detenido) return
    detenido = true
    observador.disconnect()
    clearInterval(intervalo)
  }
  const comprobar = () => {
    if (detenido || !condicion()) return
    parar()
    alCumplirse()
  }
  observador = new MutationObserver(comprobar)
  observador.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  })
  intervalo = setInterval(comprobar, 400)
  return parar
}

/**
 * Anima la desaparición del tour (agrega clase `driver-desvanecer` y destruye tras 650 ms).
 * @param d - Instancia del driver a desvanecer.
 */
function desvanecer(d: Driver) {
  document
    .querySelectorAll('.driver-overlay, .driver-popover.driver-guinda')
    .forEach(el => el.classList.add('driver-desvanecer'))
  setTimeout(() => {
    if (driverActivo === d) d.destroy()
  }, 650)
}

/**
 * Crea y configura la instancia de driver.js con todos los hooks.
 * - `onPopoverRender`: prepara popover, adapta texto de resumen y agrega botón Ver mapa.
 * - `onHighlightStarted`: registra `ultimaActivacion`/`elementoActual`, programa avance
 *   automático o vigilancia de resumen según `step.data`.
 * - `onDeselected`/`onDestroyed`: limpia vigilancias, intervalo de refresco y refs.
 * @param steps - Array de pasos del tour.
 * @returns Driver configurado (sin iniciar).
 */
function crearTour(steps: DriveStep[]): Driver {
  const paradas: (() => void)[] = []
  const detenerVigilancias = () => {
    paradas.splice(0).forEach(p => p())
  }

  let resumenVigilado = false
  const vigilarResumen = (opts: HookOpts) => {
    if (resumenVigilado) return
    resumenVigilado = true
    paradas.push(
      vigilar(
        () => !!document.querySelector('[data-tour="resumen-obra"]'),
        () => {
          opts.driver.highlight({
            element: '[data-tour="resumen-obra"]',
            popover: { side: 'bottom', align: 'center' },
          })
          paradas.push(
            vigilar(
              () => !document.querySelector('[data-tour="resumen-obra"]'),
              () => desvanecer(opts.driver),
            ),
          )
        },
      ),
    )
  }

  const programarAvance = (d: Driver, indice: number, auto: () => boolean) => {
    const yaCumplida = auto()
    const ultimo = indice === steps.length - 1
    const avanzar = () => {
      if (d.getActiveIndex() !== indice) return
      if (ultimo) {
        desvanecer(d)
      } else {
        d.moveNext()
      }
    }
    if (yaCumplida) {
      const t = setTimeout(() => {
        if (d.getActiveIndex() !== indice) return
        if (auto()) {
          avanzar()
        } else {
          paradas.push(vigilar(auto, () => setTimeout(avanzar, AVANCE_RAPIDO)))
        }
      }, AVANCE_DIFERIDO)
      paradas.push(() => clearTimeout(t))
    } else {
      paradas.push(vigilar(auto, () => setTimeout(avanzar, AVANCE_RAPIDO)))
    }
  }

  const verMapa = (opts: HookOpts) => {
    opts.driver.highlight({ element: '[data-tour="mapa-completo"]' })
    programarAvance(opts.driver, opts.index ?? 0, () => panelTexto().includes('Ubicación confirmada'))
  }

  const onPopoverRender = (popover: PopoverDOM, opts: HookOpts) => {
    prepararPopover(popover)
    const pasoActual = opts.index !== undefined ? steps[opts.index] : undefined
    if (pasoActual?.data?.mostrarResumen) {
      const conTarjeta = !!document.querySelector('[data-tour="resumen-obra"]')
      const texto = conTarjeta ? TEXTO_TARJETA_OBRA : TEXTO_BOTON_REALIZADO
      popover.title.textContent = texto.titulo
      popover.title.style.display = 'block'
      popover.description.textContent = texto.descripcion
      popover.description.style.display = 'block'
    }
    if (pasoActual?.data?.verMapa && !popover.wrapper.querySelector('.driver-ver-mapa')) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'driver-ver-mapa'
      btn.textContent = 'Ver mapa'
      btn.addEventListener('click', () => verMapa(opts))
      popover.description.insertAdjacentElement('afterend', btn)
    }
  }

  return driver({
    showProgress: true,
    progressText: 'Paso {{current}} de {{total}}',
    showButtons: ['close'],
    popoverClass: 'driver-guinda',
    overlayOpacity: 0.75,
    steps,
    onPopoverRender,
    onHighlightStarted: (_el, step, opts) => {
      ultimaActivacion = Date.now()
      elementoActual = _el ?? null
      if (step.data?.mostrarResumen) {
        vigilarResumen(opts)
        return
      }
      const auto = step.data?.autoAvanzar
      if (typeof auto !== 'function') return
      programarAvance(opts.driver, opts.index ?? 0, auto)
    },
    onDeselected: detenerVigilancias,
    onDestroyed: () => {
      detenerVigilancias()
      detenerRefresco()
      driverActivo = null
      elementoActual = null
    },
  })
}

/**
 * Inicia el intervalo que mantiene el highlight alineado si el layout cambia.
 * Evita llamar `refresh` durante la animación tween y si el elemento está desconectado o invisible.
 */
function iniciarRefresco() {
  detenerRefresco()
  intervaloRefresco = setInterval(() => {
    if (!driverActivo) return
    if (Date.now() - ultimaActivacion < DURACION_TWEEN + 50) return
    const el = elementoActual
    if (!el || !el.isConnected) return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return
    driverActivo.refresh()
  }, 600)
}

/** Detiene el intervalo de refresco de posición. */
function detenerRefresco() {
  if (!intervaloRefresco) return
  clearInterval(intervaloRefresco)
  intervaloRefresco = null
}

/**
 * Inicia el tour guiado si corresponde (solo desktop, no visto antes salvo `marcar=false`).
 * Destruye cualquier tour previo, construye los 6 pasos (mapa → picar → panel → dibujo
 * → confirmar tramo → resumen) y lo lanza tras 500 ms para asegurar que el DOM esté listo.
 * @param marcar - Si true, respeta y actualiza el flag de localStorage; si false, fuerza el tour.
 * @returns `true` si el tour se inició, `false` si se omitió por viewport/flag.
 */
export function correrTour(marcar = true): boolean {
  if (typeof window === 'undefined') return false
  if (!window.matchMedia('(min-width: 768px)').matches) return false
  if (marcar && yaVisto(TOUR_KEY)) return false
  if (marcar) marcarVisto(TOUR_KEY)
  if (driverActivo) {
    driverActivo.destroy()
    driverActivo = null
  }
  const hayMarcador = () => !!document.querySelector('.leaflet-marker-icon')
  const d = crearTour([
    paso(
      '.leaflet-container',
      'Mapa de Puebla',
      'Haz clic o toca el lugar donde necesitas la obra para colocar el marcador. Acércate con los botones de zoom y arrastra el mapa para moverte a tu gusto.',
      'left',
      hayMarcador,
    ),
    paso(
      '[data-tour="picar-ubicacion"]',
      'Picar ubicación',
      'Presiona «Picar ubicación» para detectar automáticamente la colonia y la junta auxiliar del punto que elegiste.',
      'top',
      () => panelTexto().includes('Confirmar ubicación'),
    ),
    paso(
      '[data-tour="panel"]',
      'Datos de tu ubicación',
      'Aquí aparecen la colonia y la junta auxiliar detectadas. Verifica los datos y presiona «Confirmar ubicación». A veces la detección no es exacta: si ves datos incorrectos o vacíos, ingrésalos manualmente en los campos. Si necesitas ubicarte mejor, usa «Ver mapa» para inspeccionar las calles.',
      'top',
      () => panelTexto().includes('Ubicación confirmada'),
      true,
    ),
    paso(
      '.leaflet-container',
      'Dibuja el tramo',
      'Haz clic en el punto de inicio del tramo y después en cada punto por donde pasa la calle afectada. Puedes colocar más de 2 puntos para trazar la calle sin cruzar muros, parques, casas, edificios o escuelas. La línea guinda marca el tramo. Cuando termines, presiona «Terminar tramo» para calcular la distancia, el ancho de calle y los puntos de referencia cercanos.',
      'left',
      () => !!document.querySelector('[data-tour="confirmar-tramo"]'),
    ),
    paso(
      '[data-tour="confirmar-tramo"]',
      'Confirma el tramo',
      'Revisa la distancia, el ancho de calle y los puntos de referencia calculados. Si los datos son correctos, presiona «Confirmar tramo» para continuar con tu solicitud.',
      'top',
      () => panelTexto().includes('Realizado'),
    ),
    paso(
      '[data-tour="ver-resumen"]',
      TEXTO_BOTON_REALIZADO.titulo,
      TEXTO_BOTON_REALIZADO.descripcion,
      'top',
      undefined,
      false,
      true,
    ),
  ])
  driverActivo = d
  setTimeout(() => {
    if (driverActivo !== d) return
    iniciarRefresco()
    d.drive()
  }, 500)
  return true
}

/**
 * Detiene y destruye el tour activo si existe.
 */
export function detenerTour() {
  if (!driverActivo) return
  driverActivo.destroy()
  driverActivo = null
}
