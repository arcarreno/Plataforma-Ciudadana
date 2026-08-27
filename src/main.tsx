/**
 * @file main.tsx
 * @description
 * Punto de entrada de la aplicación React ( Vite + React 19 ).
 * Monta el árbol React en el elemento `#root` del `index.html`,
 * importa estilos globales y CSS de Leaflet, y envuelve la app en `StrictMode`
 * para detectar efectos secundarios y prácticas obsoletas en desarrollo.
 *
 * Dependencias:
 * - `react` (`StrictMode`)
 * - `react-dom/client` (`createRoot` para React 18/19 concurrent mode)
 * - `leaflet/dist/leaflet.css` (estilos base del mapa)
 * - `./index.css` (Tailwind y estilos globales)
 * - `./App.tsx` (componente raíz con routing)
 *
 * Uso: es el `entry` configurado en `vite.config.ts` / `index.html`.
 * No se importa manualmente; Vite lo ejecuta al cargar la página.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css' // Estilos obligatorios de Leaflet (iconos, controles, tiles)
import './index.css' // Estilos globales de la app (Tailwind + custom)
import App from './App.tsx' // Componente raíz con BrowserRouter y rutas

/**
 * Monta la aplicación React en el DOM.
 * `document.getElementById('root')!` usa non-null assertion porque `index.html`
 * garantiza que existe `<div id="root"></div>`.
 * `StrictMode` activa verificaciones extra solo en desarrollo (doble invocación de efectos).
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
