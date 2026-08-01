import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const REGEX_CURP = /^[A-ZÁÉÍÓÚÜ]{4}\d{6}[HM][A-ZÁÉÍÓÚÜ]{5}[0-9A-ZÁÉÍÓÚÜ]\d$/
const ALFABETO_DIGITO = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'

const quitarAcentos = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function formatoOK(curp) {
  return REGEX_CURP.test((curp || '').trim().toUpperCase())
}

function digitoOK(curp) {
  const c = quitarAcentos(curp.trim().toUpperCase())
  if (c.length !== 18) return false
  let suma = 0
  for (let i = 0; i < 17; i++) {
    const valor = ALFABETO_DIGITO.indexOf(c[i])
    if (valor === -1) return false
    suma += valor * (18 - i)
  }
  const digito = (10 - (suma % 10)) % 10
  return String(digito) === c[17]
}

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env')
  process.exit(1)
}

const supabase = createClient(url, key)
const { data, error } = await supabase
  .from('solicitudes')
  .select('curp')
  .not('curp', 'is', null)
  .limit(500)

if (error) {
  console.error('Error consultando:', error.message)
  process.exit(1)
}

const curps = [...new Set(data.map((r) => String(r.curp).trim()).filter(Boolean))]
const formatoBien = curps.filter(formatoOK)
const digitosBien = formatoBien.filter(digitoOK)

console.log(`Muestra: ${curps.length} CURPs unicos`)
console.log(
  `Formato OK: ${formatoBien.length} (${((formatoBien.length / curps.length) * 100).toFixed(1)}%)`
)
console.log(
  `Digito verificador OK: ${digitosBien.length} de ${formatoBien.length} (${(
    (digitosBien.length / formatoBien.length) *
    100
  ).toFixed(1)}%)`
)

const fallos = formatoBien.filter((c) => !digitoOK(c))
if (fallos.length > 0) {
  console.log('CURPs con digito fallido:')
  for (const f of fallos.slice(0, 20)) console.log('  -', f)
}
