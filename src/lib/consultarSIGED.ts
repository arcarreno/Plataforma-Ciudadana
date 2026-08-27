/**
 * @file consultarSIGED.ts
 * @description
 * Cliente frontend para consultar información de escuelas por CCT (Clave de Centro de Trabajo)
 * contra el proxy backend `/api/consultar-siged`, que a su vez consulta el SIGED (Sistema de
 * Información y Gestión Educativa de la SEP).
 * Se usa para autocompletar/validar datos de planteles en solicitudes relacionadas con infraestructura educativa.
 *
 * Dependencias: ninguna externa (solo `fetch` nativo y `URLSearchParams`).
 *
 * Flujo:
 * 1. Valida que `cct` tenga 10 caracteres (formato oficial CCT).
 * 2. Construye `GET /api/consultar-siged?cct=...&turno=...` (con header `ngrok-skip-browser-warning` para túneles ngrok).
 * 3. Interpreta la respuesta:
 *    - 404 → "Escuela no encontrada en SIGED".
 *    - !ok → intenta leer `body.error` o fallback `Error {status}`.
 *    - ok → parsea JSON como `SigedEscuela` y retorna `data`.
 * 4. Captura excepciones de red y retorna error genérico.
 *
 * Decisiones de diseño:
 * - Validación temprana de longitud evita request inútil.
 * - `cct.toUpperCase().trim()` normaliza antes de validar/enviar.
 * - `turno` es opcional; solo se añade al query si se pasa (escuelas con múltiples turnos).
 * - No se lanza excepción al caller; siempre se retorna `{ data }` o `{ error }` para manejo uniforme en UI.
 */

/**
 * Representa un plantel educativo tal como lo devuelve SIGED (vía el proxy backend).
 * Todos los campos vienen como strings salvo conteos numéricos.
 */
export interface SigedEscuela {
  /** Clave de Centro de Trabajo (10 caracteres, ej. "21PPR0001A"). */
  cct: string
  /** Nombre oficial del plantel. */
  nombre: string
  /** Nivel educativo (ej. "Primaria", "Secundaria", "Preescolar"). */
  nivel: string
  /** Subnivel / modalidad (ej. "General", "Técnica", "Indígena"). */
  subnivel: string
  /** Turno (ej. "Matutino", "Vespertino", "Continuo"). */
  turno: string
  /** Sostenimiento (ej. "Público", "Privado"). */
  sostenimiento: string
  /** Control administrativo (ej. "Federal", "Estatal", "Autónomo"). */
  control: string
  /** Sub-control (detalle del control). */
  subControl: string
  /** Domicilio / calle y número. */
  domicilio: string
  /** Colonia del plantel. */
  colonia: string
  /** Municipio. */
  municipio: string
  /** Estado (entidad federativa). */
  estado: string
  /** Código postal. */
  codigoPostal: string
  /** Latitud como string (puede venir vacía si SIGED no la tiene). */
  latitud: string
  /** Longitud como string. */
  longitud: string
  /** Alumnos hombres inscritos. */
  alumnosHombres: number
  /** Alumnas mujeres inscritas. */
  alumnosMujeres: number
  /** Total de alumnos (hombres + mujeres). */
  totalAlumnos: number
  /** Número de docentes. */
  docentes: number
  /** Número de grupos. */
  grupos: number
  /** Fuente/origen del dato (ej. "SIGED"). */
  fuente: string
}

/**
 * Consulta una escuela por CCT (y turno opcional) al endpoint proxy `/api/consultar-siged`.
 * @param cct - Clave de Centro de Trabajo (10 caracteres, se normaliza a upper+trim).
 * @param turno - Turno opcional para desambiguar (ej. "Matutino"); si se omite, el backend decide.
 * @returns Promesa con `{ data: SigedEscuela }` si éxito, `{ error: string }` si validación/network/404.
 * @example
 * const { data, error } = await consultarSIGED('21PPR0001A', 'Matutino')
 * if (error) mostrarError(error)
 * else console.log(data.nombre, data.totalAlumnos)
 */
export async function consultarSIGED(
  cct: string,
  turno?: string
): Promise<{ data?: SigedEscuela; error?: string }> {
  // Normalizar CCT: mayúsculas y sin espacios externos
  const cctClean = cct.toUpperCase().trim()
  // Validación de longitud oficial (CCT siempre 10)
  if (cctClean.length !== 10) {
    return { error: 'El CCT debe tener 10 caracteres' }
  }

  try {
    // Construir query string de forma segura (encode automático)
    const params = new URLSearchParams({ cct: cctClean })
    if (turno) params.set('turno', turno)

    // Llamada al proxy backend; header ngrok evita la página de advertencia del túnel
    const res = await fetch(`/api/consultar-siged?${params.toString()}`, { headers: { 'ngrok-skip-browser-warning': 'true' } })

    // 404 específico: el CCT no existe en SIGED
    if (res.status === 404) {
      return { error: 'Escuela no encontrada en SIGED' }
    }
    // Otros errores HTTP: intentar leer mensaje del body
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { error: body.error || `Error ${res.status}` }
    }

    // Éxito: parsear como SigedEscuela
    const data: SigedEscuela = await res.json()
    return { data }
  } catch (err) {
    // Error de red / CORS / JSON inválido
    console.error('Error consultando SIGED:', err)
    return { error: 'No se pudo conectar con SIGED' }
  }
}
