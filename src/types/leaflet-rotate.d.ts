declare module 'leaflet-rotate'

import 'leaflet'

declare module 'leaflet' {
  interface MapOptions {
    rotate?: boolean
    bearing?: number
    rotateControl?: boolean | object
    shiftKeyRotate?: boolean
    touchRotate?: boolean
  }

  interface Map {
    setBearing(theta: number): void
    getBearing(): number
    _bearing?: number
    _rotate?: boolean
  }

  namespace Control {
    function rotate(options?: object): Control
  }
}
