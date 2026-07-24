const fs = require('fs')
const path = require('path')
const turf = require('@turf/turf')

const dataDir = path.join(__dirname, '..', 'public', 'data')
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.geojson'))

function roundCoords(coords, decimals = 6) {
  if (typeof coords[0] === 'number') {
    return [parseFloat(coords[0].toFixed(decimals)), parseFloat(coords[1].toFixed(decimals))]
  }
  return coords.map(c => roundCoords(c, decimals))
}

for (const file of files) {
  const filePath = path.join(dataDir, file)
  console.log(`OPT ${file}...`)

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const features = raw.features.map(f => {
    const props = { name: f.properties.name || '' }

    // Strip description HTML — not useful in frontend
    // delete props.description

    let geom = f.geometry
    if (geom.type === 'Polygon' || geom.type === 'MultiPolygon' || geom.type === 'LineString' || geom.type === 'MultiLineString') {
      try {
        const simplified = turf.simplify(geom, { tolerance: 0.001, highQuality: true })
        if (simplified) geom = simplified
      } catch (e) {
        // fallback: use original
      }
    }

    if (geom.type === 'GeometryCollection' && geom.geometries) {
      geom.geometries = geom.geometries.map(g => {
        if (g.type === 'Polygon' || g.type === 'MultiPolygon' || g.type === 'LineString') {
          try {
            const s = turf.simplify(g, { tolerance: 0.001, highQuality: true })
            return s || g
          } catch { return g }
        }
        return g
      })
    }

    // Round coordinates to 6 decimal places (~11cm)
    if (geom.type === 'GeometryCollection') {
      geom.geometries = geom.geometries.map(g => ({ ...g, coordinates: roundCoords(g.coordinates) }))
    } else {
      geom.coordinates = roundCoords(geom.coordinates)
    }

    return { type: 'Feature', properties: props, geometry: geom }
  })

  const out = { type: 'FeatureCollection', features }
  fs.writeFileSync(filePath, JSON.stringify(out))
  const mb = (Buffer.byteLength(JSON.stringify(out)) / 1024 / 1024).toFixed(2)
  console.log(`  OK → ${file} (${features.length} features, ${mb} MB)`)
}

console.log('\nLISTO')
