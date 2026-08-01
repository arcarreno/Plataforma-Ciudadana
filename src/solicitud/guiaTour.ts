import { driver } from 'driver.js'
import type { Driver, DriveStep, PopoverDOM, DriverHook } from 'driver.js'
import 'driver.js/dist/driver.css'
import logoSemovinfra from '../assets/Logo_Semovinfra.jpg'

type HookOpts = Parameters<DriverHook>[2]

const TOUR_KEY = 'semovinfra_tour_visto'
const AVANCE_RAPIDO = 900
const AVANCE_DIFERIDO = 2000
const DURACION_TWEEN = 400

const TEXTO_BOTON_REALIZADO = {
  titulo: 'Revisa tus datos',
  descripcion:
    'Presiona «Realizado» para ver la tarjeta con los datos de tu obra ya rellenados: coordenadas del punto y del tramo, colonia, calle y entre calles.',
}

const TEXTO_TARJETA_OBRA = {
  titulo: 'Datos de obra',
  descripcion:
    'Así quedaron rellenados tus campos de forma automática: coordenadas del punto y del tramo, colonia, junta auxiliar, calle y entre calles. Solo te falta explicar la razón de tu problema, subir evidencias si las tienes y enviar la solicitud.',
}

let driverActivo: Driver | null = null
let intervaloRefresco: ReturnType<typeof setInterval> | null = null
let ultimaActivacion = 0
let elementoActual: Element | null = null

function yaVisto(key: string): boolean {
  try {
    return !!localStorage.getItem(key)
  } catch {
    return false
  }
}

function marcarVisto(key: string) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // almacenamiento no disponible: se muestra igual esta vez
  }
}

function panelTexto(): string {
  return document.querySelector('[data-tour="panel"]')?.textContent ?? ''
}

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

function desvanecer(d: Driver) {
  document
    .querySelectorAll('.driver-overlay, .driver-popover.driver-guinda')
    .forEach(el => el.classList.add('driver-desvanecer'))
  setTimeout(() => {
    if (driverActivo === d) d.destroy()
  }, 650)
}

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

function detenerRefresco() {
  if (!intervaloRefresco) return
  clearInterval(intervaloRefresco)
  intervaloRefresco = null
}

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

export function detenerTour() {
  if (!driverActivo) return
  driverActivo.destroy()
  driverActivo = null
}
