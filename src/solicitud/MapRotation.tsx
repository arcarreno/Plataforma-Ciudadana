import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

export default function MapRotation() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()

    // Ctrl (+ trackpad/two-finger scroll) rotates the map, Google Maps style.
    // Capture phase runs before Leaflet's ScrollWheelZoom, so we can stop it.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        map.scrollWheelZoom.enable()
        return
      }
      e.preventDefault()
      e.stopPropagation()
      const step = Math.sign(e.deltaY) * Math.max(0.5, Math.min(10, Math.abs(e.deltaY) / 10))
      map.setBearing(map.getBearing() + step)
    }

    // Right-button drag rotates the map (trackpad-friendly: two-finger tap & hold).
    let dragging = false
    let startX = 0
    let startY = 0
    let startBearing = 0

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 2) return
      dragging = true
      startX = e.clientX
      startY = e.clientY
      startBearing = map.getBearing()
      e.preventDefault()
      e.stopPropagation()
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return
      const rect = container.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const a0 = Math.atan2(startY - cy, startX - cx)
      const a1 = Math.atan2(e.clientY - cy, e.clientX - cx)
      map.setBearing(startBearing + ((a1 - a0) * 180) / Math.PI)
    }

    const onMouseUp = () => { dragging = false }

    const onContextMenu = (e: MouseEvent) => e.preventDefault()

    container.addEventListener('wheel', onWheel, { capture: true, passive: false })
    container.addEventListener('mousedown', onMouseDown, { capture: true })
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    container.addEventListener('contextmenu', onContextMenu)

    return () => {
      container.removeEventListener('wheel', onWheel, { capture: true } as EventListenerOptions)
      container.removeEventListener('mousedown', onMouseDown, { capture: true } as EventListenerOptions)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      container.removeEventListener('contextmenu', onContextMenu)
    }
  }, [map])

  return null
}
