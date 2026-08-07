export interface SigedEscuela {
  cct: string
  nombre: string
  nivel: string
  subnivel: string
  turno: string
  sostenimiento: string
  control: string
  subControl: string
  domicilio: string
  colonia: string
  municipio: string
  estado: string
  codigoPostal: string
  latitud: string
  longitud: string
  alumnosHombres: number
  alumnosMujeres: number
  totalAlumnos: number
  docentes: number
  grupos: number
  fuente: string
}

export async function consultarSIGED(
  cct: string,
  turno?: string
): Promise<{ data?: SigedEscuela; error?: string }> {
  const cctClean = cct.toUpperCase().trim()
  if (cctClean.length !== 10) {
    return { error: 'El CCT debe tener 10 caracteres' }
  }

  try {
    const params = new URLSearchParams({ cct: cctClean })
    if (turno) params.set('turno', turno)

    const res = await fetch(`/api/consultar-siged?${params.toString()}`, { headers: { 'ngrok-skip-browser-warning': 'true' } })

    if (res.status === 404) {
      return { error: 'Escuela no encontrada en SIGED' }
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { error: body.error || `Error ${res.status}` }
    }

    const data: SigedEscuela = await res.json()
    return { data }
  } catch (err) {
    console.error('Error consultando SIGED:', err)
    return { error: 'No se pudo conectar con SIGED' }
  }
}
