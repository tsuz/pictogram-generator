const fs = require('fs')
const turf = require('@turf/turf')

const myArgs = process.argv.slice(2);
const inputFile = myArgs[0]
if (!myArgs[0]) {
    throw new Error(`input file required`)
}
const outputFile = myArgs[1] || 'merged.geojson'

const geojsonStr = fs.readFileSync(inputFile, { encoding: 'utf8' })

const geojson = JSON.parse(geojsonStr)

// geojson needs to connect first
const startLatLngStr = {}
const endLatLngStr = {}

const latlngToStr = (lat, lng) => {
    return `${lat}:${lng}`
}

// put into an efficient algorithm structure
for (const feature of geojson.features) {
    const coords = feature.geometry.coordinates
    const firstCoord = coords[0]
    const lastCoord = coords[coords.length - 1]
    const startKey = latlngToStr(firstCoord[1], firstCoord[0])
    const endKey = latlngToStr(lastCoord[1], lastCoord[0])
    if (!startLatLngStr[startKey]) {
        startLatLngStr[startKey] = []
    }
    if (!endLatLngStr[endKey]) {
        endLatLngStr[endKey] = []
    }
    startLatLngStr[startKey].push(feature)
    endLatLngStr[endKey].push(feature)
}

const usedRef = {}

const nextWay = (feature, after) => {
    const coords = feature.geometry.coordinates
    let coord = coords[0]
    let lookupMap = endLatLngStr
    if (after === true) {
        lookupMap = startLatLngStr
        coord = coords[coords.length - 1]
    }
    const key = latlngToStr(coord[1], coord[0])
    return lookupMap[key] || []
}

// look up each ref
for (const feature of geojson.features) {
    const coords = feature.geometry.coordinates
    const ref = feature.properties.ref
    if (usedRef[ref]) {
        continue
    }
    usedRef[ref] = feature

    let allBeforeCoords = []
    let beforeFeature = feature
    do {
        const beforeFeatures = nextWay(beforeFeature)
        beforeFeature = beforeFeatures.find(v => v.properties.ref === ref)
        if (beforeFeature) {
            allBeforeCoords = beforeFeature.geometry.coordinates.concat(allBeforeCoords)
        }
    } while (!!beforeFeature)

    let allAfterCoords = []
    let afterFeature = feature
    do {
        const afterFeatures = nextWay(afterFeature, true)
        afterFeature = afterFeatures.find(v => v.properties.ref === ref)
        if (afterFeature) {
            allAfterCoords.push(...afterFeature.geometry.coordinates)
        }
    } while (!!afterFeature)

    const allfeatures = [
        ...allBeforeCoords,
        ...feature.geometry.coordinates,
        ...allAfterCoords,
    ]
    const newFeature = turf.lineString(allfeatures, feature.properties)
    const firstEntireRoad = turf.featureCollection([newFeature])
    fs.writeFileSync(outputFile,
        JSON.stringify(firstEntireRoad, null, 2)
    );
}
