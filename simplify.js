const fs = require('fs')
const turf = require('@turf/turf')

const myArgs = process.argv.slice(2);
console.log('myArgs: ', myArgs);

const inputFile = myArgs[0]
if (!myArgs[0]) {
    throw new Error(`input file required`)
}
const outputFile = myArgs[1] || 'simplified.geojson'

const geojsonStr = fs.readFileSync(inputFile, { encoding: 'utf8' })

const geojson = JSON.parse(geojsonStr)
const lookAhead = 6 // look ahead in kilometers

const standarizeBearing = (bearing) => {
    let adjBearing = bearing
    if (bearing < 0) {
        adjBearing = 360 + bearing
    }
    const val = Math.floor(adjBearing / 22.5)
    switch (val) {
        case 0:
        case 15:
            return 0
        case 1:
        case 2:
            return 45
        case 3:
        case 4:
            return 90
        case 5:
        case 6:
            return 135
        case 7:
        case 8:
            return 180
        case 9:
        case 10:
            return 225
        case 11:
        case 12:
            return 270
        case 13:
        case 14:
            return 315
        default:
            throw new Error(`Unexpected value: ${val} for adjbearing: ${adjBearing}, bearing: ${bearing}`)
    }
}

const allCoords = []

for (const feature of geojson.features) {
    const coords = feature.geometry.coordinates
    const firstCoord = coords[0]
    let start = firstCoord
    allCoords.push(start)

    feature.geometry.coordinates.forEach((coord, idx) => {
        const from = turf.point(start)
        const to = turf.point(coord)
        const distance = turf.distance(from, to)
        // ignore if not last and not past a threshold length
        if (distance < lookAhead && idx + 1 < feature.geometry.coordinates.length) {
            return
        }
        // process
        const bearing = turf.bearing(from, to)
        const humanBearing = standarizeBearing(bearing)
        let newDestBearing = humanBearing
        if (newDestBearing > 180) {
            newDestBearing = -1 * (360 - humanBearing)
        }
        const newDest = turf.destination(from, distance, newDestBearing);
        const stdCoord = newDest.geometry.coordinates
        console.log(`From ${start} to ${coord}, 
        distance: ${distance}, 
        bearing: ${bearing}, 
        human bearing: ${humanBearing},
        newDestBearing: ${newDestBearing},
        `)
        start = stdCoord
        allCoords.push(stdCoord)
    })
}

const linestring = turf.lineString(allCoords)
const fc = turf.featureCollection([linestring])
fs.writeFileSync(outputFile,
    JSON.stringify(fc, null, 2)
);