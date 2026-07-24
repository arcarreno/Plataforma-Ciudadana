const fs = require('fs')
const path = require('path')
const decompress = require('decompress')
const { XMLParser } = require('fast-xml-parser')

const dataDir = path.join(__dirname, '..', 'public', 'data')
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.kml'))

async function readKml(file) {
  const kmlPath = path.join(dataDir, file)
  const buf = fs.readFileSync(kmlPath)

  // KMZ detection: ZIP header starts with PK\x03\x04
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    const files = await decompress(kmlPath)
    const doc = files.find(f => f.path === 'doc.kml' || f.path.endsWith('.kml'))
    if (doc) return doc.data.toString('utf8')
    throw new Error('No KML found inside KMZ')
  }

  return buf.toString('utf8')
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
})

function coordStrToArray(str) {
  return (str || '').trim().split(/\s+/).filter(Boolean).map(p => {
    const [lng, lat] = p.split(',').map(Number)
    return [lng, lat]
  })
}

function extractGeometry(geom) {
  if (!geom) return null
  if (geom.Point) {
    return { type: 'Point', coordinates: coordStrToArray(geom.Point.coordinates)[0] }
  }
  if (geom.Polygon) {
    const rings = [geom.Polygon.outerBoundaryIs, geom.Polygon.innerBoundaryIs]
      .filter(Boolean)
      .flatMap(b => {
        const r = b.LinearRing || b.linearRing
        return r ? [coordStrToArray(r.coordinates)] : []
      })
    return { type: 'Polygon', coordinates: rings }
  }
  if (geom.MultiGeometry || geom.MultiGeometry) {
    const mg = geom.MultiGeometry || geom.MultiGeometry
    const geoms = []
    if (mg.Polygon) {
      const polys = Array.isArray(mg.Polygon) ? mg.Polygon : [mg.Polygon]
      polys.forEach(p => {
        const rings = [p.outerBoundaryIs, p.innerBoundaryIs]
          .filter(Boolean)
          .flatMap(b => {
            const r = b.LinearRing || b.linearRing
            return r ? [coordStrToArray(r.coordinates)] : []
          })
        if (rings.length) geoms.push({ type: 'Polygon', coordinates: rings })
      })
    }
    if (mg.Point) {
      const pts = Array.isArray(mg.Point) ? mg.Point : [mg.Point]
      pts.forEach(p => {
        const c = coordStrToArray(p.coordinates)[0]
        if (c) geoms.push({ type: 'Point', coordinates: c })
      })
    }
    if (mg.LineString) {
      const lines = Array.isArray(mg.LineString) ? mg.LineString : [mg.LineString]
      lines.forEach(l => {
        const c = coordStrToArray(l.coordinates)
        if (c.length) geoms.push({ type: 'LineString', coordinates: c })
      })
    }
    return geoms.length === 1 ? geoms[0] : { type: 'GeometryCollection', geometries: geoms }
  }
  if (geom.LineString) {
    return { type: 'LineString', coordinates: coordStrToArray(geom.LineString.coordinates) }
  }
  return null
}

function extractPlacemarks(node) {
  let features = []
  if (!node || typeof node !== 'object') return features

  if (node.Placemark) {
    const marks = Array.isArray(node.Placemark) ? node.Placemark : [node.Placemark]
    marks.forEach(pm => {
      const name = typeof pm.name === 'string' ? pm.name : ''
      const description = typeof pm.description === 'string' ? pm.description : ''
      const geom = extractGeometry(pm)
      if (geom) {
        features.push({
          type: 'Feature',
          properties: { name, description },
          geometry: geom,
        })
      }
    })
  }

  if (node.Folder) {
    const folders = Array.isArray(node.Folder) ? node.Folder : [node.Folder]
    folders.forEach(f => extractPlacemarks(f).forEach(fe => features.push(fe)))
  }

  if (node.Document) {
    extractPlacemarks(node.Document).forEach(f => features.push(f))
  }

  return features
}

;(async () => {
  for (const file of files) {
    const kmlPath = path.join(dataDir, file)
    const geojsonPath = kmlPath.replace('.kml', '.geojson')

    console.log(`CONV ${file}...`)

    try {
      const kmlStr = await readKml(file)
      const parsed = parser.parse(kmlStr)
      const features = extractPlacemarks(parsed.kml || parsed)

      const geojson = {
        type: 'FeatureCollection',
        features,
      }

      fs.writeFileSync(geojsonPath, JSON.stringify(geojson))
      const mb = (Buffer.byteLength(JSON.stringify(geojson)) / 1024 / 1024).toFixed(2)
      console.log(`  OK → ${file.replace('.kml', '.geojson')} (${features.length} features, ${mb} MB)`)
    } catch (e) {
      console.log(`  ERROR: ${e.message}`)
    }
  }

  console.log('\nLISTO')
})()
