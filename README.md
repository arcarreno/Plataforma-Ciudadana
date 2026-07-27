# Plataforma Atención Ciudadana

Sistema web para la gestión digital de solicitudes de obras públicas.
Desarrollado para la **Secretaría de Movilidad e Infraestructura (SEMOVINFRA)**
del **Honorable Ayuntamiento del Municipio de Puebla**.

**Stack:** React 19 + TypeScript 5 + Vite 8 + Tailwind CSS 4 + Supabase + Leaflet + Turf.js

---

## Tabla de Contenidos

- [Arquitectura](#arquitectura)
- [Flujo del Sistema](#flujo-del-sistema)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Base de Datos](#base-de-datos)
- [Autenticación](#autenticación)
- [Mapas y Análisis Geoespacial](#mapas-y-análisis-geoespacial)
- [Servicios Externos](#servicios-externos)
- [Generación de Documentos](#generación-de-documentos)
- [Configuración del Entorno](#configuración-del-entorno)
- [Despliegue](#despliegue)

---

## Arquitectura

```
Cliente (React 19 SPA)
    ↕ RPC HTTP
Vercel — Serverless Functions
    ↕
Supabase — PostgreSQL + Storage
    ↕
/public/data/ — 7 archivos GeoJSON
```

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript 5 |
| Bundler | Vite 8 |
| Estilos | Tailwind CSS 4 |
| Mapas | Leaflet 1.9 + react-leaflet 5 |
| Análisis geoespacial | Turf.js (7 submódulos) |
| Base de datos | Supabase (PostgreSQL + RPC) |
| Storage | Supabase Storage |
| Despliegue | Vercel (SPA + Serverless) |
| Email | Nodemailer |
| PDF | html2canvas + jsPDF |
| Gráficas | Recharts |
| Iconos | Lucide React |

---

## Flujo del Sistema

### 1. Registro de Solicitud (Ciudadano)

El formulario progresivo consta de 7 pasos:

```
Inicio
  └─ /nueva-solicitud
       ├─ Paso 1: Datos personales (nombre, CURP, teléfono, correo)
       ├─ Paso 2: Tipo de obra (catálogo de 15 tipos)
       ├─ Paso 3: Ubicación — MapaPin (selección de punto en mapa)
       │              └─ Detección automática: colonia, junta auxiliar,
       │                 zona ZAP, cobertura de agua, POI cercanos
       ├─ Paso 4: Tramo — MapaTramo (opcional, dibujo de segmento)
       │              └─ Detección: distancia Haversine, ancho de calle,
       │                 intersecciones con capas GIS
       ├─ Paso 5: Descripción del problema
       ├─ Paso 6: Evidencia (hasta 3 archivos, máx. 500 KB c/u)
       └─ Paso 7: Confirmación y envío → BD + Storage
```

### 2. Consulta de Folio (Ciudadano)

```
/consultar-folio
  └─ Ingresa folio → consulta en BD → muestra datos de la solicitud
```

### 3. Administración (Funcionario)

```
/admin (dashboard)
  ├─ Lista de solicitudes con filtros (estatus, tipo, fecha)
  ├─ Detalle de solicitud
  │    ├─ Mapas de ubicación y tramo (con fullscreen + capas)
  │    ├─ Consulta SIGED por CCT (escuelas cercanas)
  │    ├─ Generación de documentos PDF (oficio + ficha técnica)
  │    └─ Envío de documentación por correo electrónico
  │
  ├─ /admin/usuarios  (solo admin)
  │    └─ CRUD de usuarios del sistema
  │
  └─ /admin/mapas
       └─ Dashboard con mapa de todas las solicitudes + 4 gráficas
          (colonias top 10, juntas auxiliares, tipo de obra,
           solicitudes por día de la semana)
```

### 4. Autenticación

```
LoginModal
  → AuthContext.iniciarSesion(username, password)
    → lib/auth.login(username, password)
      → supabase.rpc('login_usuario', { p_username, p_password })
      → localStorage('semovinfra_auth') ← sesión persistida
      → Redirección a /admin
```

Roles: `admin` (todo), `revisor` (sin gestión de usuarios),
`diputado`/`senador` (pueden omitir CURP, prioridad 15).

---

## Estructura del Proyecto

```
src/
├── App.tsx                          ← Router principal (6 rutas)
├── main.tsx                         ← Entry point React 19
├── index.css                        ← Estilos globales + Tailwind
│
├── core/
│   ├── constants.ts                 ← Constantes del sistema:
│   │                                  APP_NAME, MAX_SOLICITUDES/MES,
│   │                                  RANKING_PUNTOS, FOLIO_PREFIX,
│   │                                  ESTATUS_OPCIONES, JUNTAS_AUXILIARES (17),
│   │                                  CATALOGO_TIPOS_OBRA (15 tipos con precios)
│   ├── geo.ts                       ← Normalización geoespacial:
│   │                                  removeAccents, normalize, stripPrefix,
│   │                                  matchJunta, cleanColoniaName
│   └── theme.ts                     ← Tokens de diseño: colores, tamaños de fuente
│
├── types/
│   ├── solicitud.ts                 ← Interface Solicitud (30+ campos),
│   │                                  SolicitudFormData, SolicitudErrors
│   └── auth.ts                      ← Interface Usuario (id, username, nombres,
│                                       apellidos, rol) + helpers (esCargoPublico)
│
├── lib/
│   ├── supabase.ts                  ← Cliente Supabase desde VITE_SUPABASE_*
│   ├── auth.ts                      ← login(), logout(), getSession(),
│   │                                  crearUsuario(), listarUsuarios()
│   ├── solicitud.ts                 ← crearSolicitud() — orquesta inserción
│   │                                  en BD + subida a Storage + actualización
│   │                                  de rutas_evidencia. consultarSolicitud()
│   ├── geolocalizarCalle.ts         ← Reverse geocoding en 2 pasos:
│   │                                  Nominatim (calle principal) + Overpass
│   │                                  (calles transversales, radio 150m)
│   ├── consultarSIGED.ts            ← Consulta de escuelas por CCT via proxy
│   ├── generarOficio.ts             ← PDF de oficio (2 páginas, tamaño carta)
│   ├── generarFicha.ts              ← PDF de ficha técnica (1 página, horizontal,
│                                       con captura del mapa en vivo)
│   └── api.ts                       ← Cliente HTTP genérico
│
├── contexts/
│   └── AuthContext.tsx              ← Contexto React: user, iniciarSesion,
│                                       cerrarSesion. Inicializa desde localStorage
│
├── hooks/
│   └── useTalkBack.ts              ← Text-to-speech en español (lectura al clic)
│
├── shared/                          ← 11 componentes reutilizables
│   ├── Button.tsx                   ← 3 variantes × 3 tamaños
│   ├── Card.tsx                     ← Contenedor con título opcional
│   ├── Input.tsx                    ← Input + Textarea con validación
│   ├── Select.tsx                   ← Dropdown con opciones tipadas
│   ├── Layout.tsx                   ← Wrapper: Header + Footer + font-size + talkBack
│   ├── Header.tsx                   ← Sticky con blur, logo, nav, accesibilidad, login
│   ├── Footer.tsx                   ← Pie institucional con slogan y copyright
│   ├── NavigationPanel.tsx          ← Menú móvil slide-in
│   ├── LoginModal.tsx               ← Modal fullscreen de autenticación
│   ├── AccessibilityPanel.tsx       ← Panel: 3 tamaños de fuente + talkBack
│   └── AvisoPrivacidad.tsx          ← Aviso de privacidad completo (8 secciones)
│
├── pages/
│   ├── Inicio.tsx                   ← Landing page con tarjetas de características
│   ├── NuevaSolicitud.tsx           ← Wrapper del formulario (permite omitir CURP
│   │                                  para cargos públicos)
│   ├── ConsultarFolio.tsx           ← Página de consulta por folio
│   ├── AdminDashboard.tsx           ← Lista de solicitudes con búsqueda,
│   │                                  filtros (estatus, tipo), ordenamiento
│   ├── GestionUsuarios.tsx          ← CRUD de usuarios (solo admin)
│   └── MapasEstadisticas.tsx        ← Dashboard: mapa con todas las solicitudes
│                                      + 4 gráficas Recharts + KPIs
│
└── solicitud/
    ├── MapaPin.tsx                   ← Mapa interactivo para seleccionar punto.
    │                                    Marcador SVG, toggle satélite, toggle capas
    │                                    GeoJSON (colonias, juntas, ZAP). Detección
    │                                    automática al hacer clic en "Picar ubicación".
    │                                    Props: onConfirm, onClose, initialLat/Lng
    │
    ├── MapaTramo.tsx                 ← Mapa para dibujar tramo (polilínea).
    │                                    Marcadores numerados (1,2,3...), deshacer/
    │                                    reiniciar/terminar. Calcula distancia total
    │                                    + ancho de calle automáticamente.
    │                                    Props: onConfirm, onClose
    │
    ├── SolicitudForm.tsx             ← Formulario progresivo de 7 pasos con
    │                                    integración de mapas, validaciones,
    │                                    carga de archivos y envío a BD
    │
    ├── SolicitudDetail.tsx           ← Vista detallada de solicitud con mapas
    │                                    de ubicación y tramo, consulta SIGED,
    │                                    generación de PDFs, envío por correo,
    │                                    cambio de estatus
    │
    ├── detectar-ubicacion.ts         ← Motor de análisis geoespacial.
    │                                    Carga 7 capas GeoJSON. Funciones:
    │                                    cargarCapas(), detectarPunto() [PIP + 100m
    │                                    radio], detectarTramo() [buffer + intersecciones]
    │                                    Usa @turf/boolean-point-in-polygon,
    │                                    @turf/buffer, @turf/distance, @turf/line-intersect
    │
    └── calle.ts                      ← Haversine distance + estimación de ancho
                                         de calle mediante análisis de aristas STV
                                         opuestas y distancia perpendicular
```

### API (Vercel Serverless)

```
api/
└── enviar-documentacion.ts          ← POST endpoint. Recibe correo, folio y
                                       2 PDFs en base64. Envía email con Nodemailer
                                       usando SMTP de variables de entorno.
                                       Retorna { ok, messageId }
```

### Datos Geoespaciales

```
public/data/
├── COLONIAS PUEBLA.geojson          ← Polígonos de colonias
├── JUNTAS AUXILIARES.geojson        ← Polígonos de 17 juntas auxiliares
├── zonas zap2024.geojson            ← Polígonos de Zonas de Atención Prioritaria
├── Escuelas.geojson                 ← Puntos de escuelas
├── Iglesias.geojson                 ← Puntos de iglesias
├── STV.geojson                      ← Líneas de transporte público (Sistema de
│                                       Transporte Vial)
└── COBERTURA_AGUAS DE PUEBLA.geojson ← Polígonos de cobertura de agua (SOAQPAP)
```

---

## Base de Datos

### Tabla `solicitudes`

Almacena cada solicitud con toda su información geoespacial y de detección.
Campos principales: `id_solicitud`, `folio_unico`, `nombre_solicitante`, `curp`,
`telefono`, `correo`, `tipo_solicitud`, `colonia`, `junta_auxiliar`, `latitud`,
`longitud`, `calle`, `entre_calles`, `tramo_lat_ini`, `tramo_lng_ini`,
`tramo_lat_fin`, `tramo_lng_fin`, `tramo_puntos` (JSONB), `descripcion`,
`rutas_evidencia` (text[]), `zona_zap`, `cobertura_agua`, `escuelas_cercanas`
(text[]), `iglesias_cercanas` (text[]), `transportes_cercanos` (text[]),
`distancia_tramo_m`, `ancho_calle_m`, `peso_ranking` (5/10/15),
`estatus_fase`, `fecha_creacion` (default NOW()).

### Tabla `usuarios`

Gestiona cuentas de funcionarios. Campos: `id`, `username` (UNIQUE),
`password_hash` (bcrypt), `nombres`, `apellidos`, `rol`
(admin/revisor/diputado/senador).

### Funciones RPC

| Función | Descripción |
|---------|-------------|
| `login_usuario(p_username, p_password)` | Autenticación, retorna datos del usuario |
| `crear_usuario(p_admin_id, p_username, p_password, p_rol, ...)` | Creación de usuarios por admin |
| `listar_usuarios()` | Listado completo de usuarios |

### Trigger

Límite de **3 solicitudes por mes por CURP** a nivel base de datos.
Mensaje de error: `"Limite de 3 solicitudes"`.

### Storage

Bucket `evidencias` (público). Patrón: `evidencias/{folio}/{uuid}.{ext}`.
Máximo 500 KB por archivo.

---

## Autenticación

Sistema custom (no usa `auth.users` de Supabase). La sesión se persiste en
`localStorage` bajo la clave `semovinfra_auth`. Las contraseñas se transmiten
via RPC sobre TLS y el hashing se realiza en PostgreSQL.

| Rol | Dashboard | Docs | Usuarios | CURP omitido | Prioridad 15 |
|-----|-----------|------|----------|-------------|--------------|
| admin | ✓ | ✓ | ✓ | ✗ | ✗ |
| revisor | ✓ | ✓ | ✗ | ✗ | ✗ |
| diputado | ✓ | ✓ | ✗ | ✓ | ✓ |
| senador | ✓ | ✓ | ✗ | ✓ | ✓ |

---

## Mapas y Análisis Geoespacial

### Componentes de Mapa

| Componente | Propósito | Teclas |
|-----------|-----------|--------|
| `MapaPin` | Selección de punto por el ciudadano | Clic para marcar, "Picar ubicación" para detectar |
| `MapaTramo` | Dibujo de segmento de calle | Clic secuencial para puntos, deshacer/reiniciar/terminar |
| `SolicitudDetail` | Vista administrativa con mapa estático + fullscreen | Toggle fullscreen para ver capas |
| `MapasEstadisticas` | Dashboard con todas las solicitudes | KPIs + gráficas + mapa global |

### Fórmula de Haversine

```
d = 2R · arcsin(√( sin²(Δφ/2) + cos φ₁ · cos φ₂ · sin²(Δλ/2) ))
```

Implementada via `@turf/distance`. Se usa para:
- Distancia total del tramo (suma de segmentos)
- Estimación de ancho de calle (conversión grados → metros)

### Algoritmo de Ancho de Calle

1. Encuentra aristas de calles opuestas (diferencia de ángulo 150°–210°)
2. Calcula distancia perpendicular entre aristas
3. Convierte de grados a metros usando `111320 × cos(latitud)`
4. Fallback: nearest-point-on-line desde el punto medio
5. Default: 7 m si no hay suficientes datos

### Detección Geoespacial

- **Punto:** Point-in-Polygon con `@turf/boolean-point-in-polygon`
  (maneja Polygon, MultiPolygon y GeometryCollection)
- **Cercanía:** Radio de 100 m con `@turf/distance` para puntos,
  `@turf/nearest-point-on-line` para líneas
- **Tramo:** Buffer de 100 m con `@turf/buffer`, luego intersecciones
  con `booleanIntersects` y `lineIntersect`

---

## Servicios Externos

| Servicio | Uso | Endpoint |
|----------|-----|----------|
| **Nominatim** | Reverse geocoding (calle principal) | `GET /reverse?lat=&lon=&zoom=18` |
| **Overpass API** | Calles transversales (radio 150 m) | `POST /api/interpreter` |
| **SIGED** | Datos de escuelas por CCT | `GET /api/consultar-siged?cct=` |
| **SMTP** | Envío de correos | Vía Nodemailer (env vars) |

---

## Generación de Documentos

### Oficio (`generarOficioPDF`)
- 2 páginas, tamaño carta (21.6 × 27.9 cm)
- Contenido: año oficial, folio, fundamento legal, tabla de control, compromiso
- Marca de agua con membrete (18% opacidad)

### Ficha Técnica (`generarFichaPDF`)
- 1 página horizontal (960 × 720 px)
- Captura del mapa en vivo (composición de tiles vía canvas)
- Datos técnicos: longitud, intervención (m²), ancho
- Entorno social: escuelas, iglesias, transporte
- Inversión estimada: costo/m² × intervención

Catálogo de 15 tipos de obra con costos de $0 a $27,384/m².

---

## Configuración del Entorno

```bash
# .env (raíz del proyecto)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

Variables de entorno del servidor (Vercel):
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

---

## Despliegue

El proyecto se despliega en **Vercel** como SPA con funciones serverless.

```bash
npm run dev      # Entorno de desarrollo (Vite)
npm run build    # TypeScript check + build (tsc -b && vite build)
npm run lint     # ESLint
npm run preview  # Vista previa del build
```

---

## Diseño y Accesibilidad

- **Colores institucionales:** guinda `#7d2447`, alabaster `#EDEAE0`
- **Componentes:** 11 componentes reutilizables en `src/shared/`
- **Accesibilidad:** 3 niveles de fuente + text-to-speech (talkBack)
- **Responsive:** Adaptable a móvil, tablet y escritorio

---

## Dependencias Principales

| Paquete | Propósito |
|---------|-----------|
| react | UI framework |
| typescript | Tipado estático |
| vite | Bundler y dev server |
| tailwindcss | CSS utility-first |
| @supabase/supabase-js | Cliente Supabase |
| react-leaflet / leaflet | Mapas interactivos |
| @turf/* (7 paquetes) | Análisis geoespacial |
| html2canvas + jspdf | Generación de PDF |
| recharts | Gráficas |
| lucide-react | Iconos |
| nodemailer | Envío de correos |
