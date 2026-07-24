import { JUNTAS_AUXILIARES } from './constants'

const ACCENT_MAP: Record<string, string> = {
  á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u',
  Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U',
  ü: 'u', Ü: 'U', ñ: 'n', Ñ: 'N',
}

function removeAccents(s: string) {
  return s.replace(/[áéíóúÁÉÍÓÚüÜñÑ]/g, c => ACCENT_MAP[c] || c)
}

function normalize(s: string) {
  return removeAccents(s).toLowerCase().replace(/\s+/g, ' ').trim()
}

function stripPrefix(s: string) {
  const m = s.trim().match(/^\d{1,2}\s+(.*)/)
  return m ? m[1].trim() : s.trim()
}

export function matchJunta(rawName: string): string {
  const cleaned = normalize(stripPrefix(rawName))
  for (const junta of JUNTAS_AUXILIARES) {
    if (normalize(junta) === cleaned) return junta
    if (normalize(junta).includes(cleaned) || cleaned.includes(normalize(junta))) return junta
  }
  return stripPrefix(rawName).replace(/\s+/g, ' ').trim()
}

export function cleanColoniaName(rawName: string): string {
  return rawName
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
}

export function normalizeColoniaForMatch(name: string): string {
  return removeAccents(name).toLowerCase().replace(/\s+/g, ' ').trim()
}
