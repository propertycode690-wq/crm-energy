/**
 * Mathematical Geospatial Calculation Engine
 * Implements high-precision Geodesic distance (Haversine), Ray-Casting Point-in-Polygon,
 * Spherical Polygon Area, and Centroid calculation without external C++ binary dependencies.
 */

class GisSpatialEngine {
  constructor() {
    this.EARTH_RADIUS_KM = 6371.0088;
    this.EARTH_RADIUS_MILES = 3958.7613;
  }

  /**
   * Calculate true great-circle geodesic distance between two coordinates
   * @param {number} lat1 Latitude of point 1 (degrees)
   * @param {number} lon1 Longitude of point 1 (degrees)
   * @param {number} lat2 Latitude of point 2 (degrees)
   * @param {number} lon2 Longitude of point 2 (degrees)
   * @param {string} unit 'km' or 'miles'
   * @returns {number} Geodesic distance
   */
  calculateHaversineDistance(lat1, lon1, lat2, lon2, unit = 'km') {
    const toRad = (deg) => (deg * Math.PI) / 180;

    const r = unit === 'miles' ? this.EARTH_RADIUS_MILES : this.EARTH_RADIUS_KM;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((r * c).toFixed(3));
  }

  /**
   * Ray-casting algorithm to test whether a coordinate point [lon, lat] is inside a polygon ring
   * @param {Array<number>} point [longitude, latitude]
   * @param {Array<Array<number>>} ring Array of [longitude, latitude] coordinates forming closed polygon
   * @returns {boolean} True if point is inside polygon
   */
  isPointInPolygon(point, ring) {
    if (!ring || ring.length < 3) return false;

    const x = point[0]; // Longitude
    const y = point[1]; // Latitude

    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];

      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
   * Test point containment across Polygon or MultiPolygon GeoJSON geometry
   * @param {number} lat Latitude
   * @param {number} lng Longitude
   * @param {object} geometry GeoJSON Geometry object { type, coordinates }
   * @returns {boolean}
   */
  isCoordinateInGeometry(lat, lng, geometry) {
    if (!geometry || !geometry.coordinates) return false;
    const point = [lng, lat];

    if (geometry.type === 'Polygon') {
      // coordinates[0] is outer boundary ring, subsequent are holes
      const outerRing = geometry.coordinates[0];
      if (!this.isPointInPolygon(point, outerRing)) return false;

      // Check if point falls inside any inner hole
      for (let h = 1; h < geometry.coordinates.length; h++) {
        if (this.isPointInPolygon(point, geometry.coordinates[h])) return false;
      }
      return true;
    }

    if (geometry.type === 'MultiPolygon') {
      for (const polyCoords of geometry.coordinates) {
        const outerRing = polyCoords[0];
        if (this.isPointInPolygon(point, outerRing)) {
          let inHole = false;
          for (let h = 1; h < polyCoords.length; h++) {
            if (this.isPointInPolygon(point, polyCoords[h])) {
              inHole = true;
              break;
            }
          }
          if (!inHole) return true;
        }
      }
      return false;
    }

    return false;
  }

  /**
   * Calculate approximate geodesic surface area of a GeoJSON Polygon in sq km
   * @param {Array<Array<number>>} ring Outer ring of polygon [[lng, lat], ...]
   * @returns {number} Area in square kilometers
   */
  calculatePolygonAreaSqKm(ring) {
    if (!ring || ring.length < 3) return 0.0;

    let totalArea = 0;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const r = this.EARTH_RADIUS_KM;

    if (ring.length > 2) {
      for (let i = 0; i < ring.length; i++) {
        const lowerIndex = i;
        const middleIndex = i + 1 === ring.length ? 0 : i + 1;
        const upperIndex = i + 2 >= ring.length ? (i + 2) % ring.length : i + 2;

        const p1 = ring[lowerIndex];
        const p2 = ring[middleIndex];
        const p3 = ring[upperIndex];

        totalArea += (toRad(p3[0]) - toRad(p1[0])) * Math.sin(toRad(p2[1]));
      }
      totalArea = Math.abs((totalArea * r * r) / 2);
    }

    return Number(totalArea.toFixed(2));
  }

  /**
   * Calculate center latitude and longitude of coordinates array
   */
  calculateCentroid(coordinates) {
    if (!coordinates || coordinates.length === 0) {
      return { lat: 37.7749, lng: -122.4194 };
    }

    // Flatten if multi-nested
    const flatPoints = [];
    const extract = (arr) => {
      if (arr.length === 2 && typeof arr[0] === 'number' && typeof arr[1] === 'number') {
        flatPoints.push(arr);
      } else {
        arr.forEach((sub) => {
          if (Array.isArray(sub)) extract(sub);
        });
      }
    };
    extract(coordinates);

    if (flatPoints.length === 0) return { lat: 37.7749, lng: -122.4194 };

    let sumLng = 0;
    let sumLat = 0;
    flatPoints.forEach((p) => {
      sumLng += p[0];
      sumLat += p[1];
    });

    return {
      lat: Number((sumLat / flatPoints.length).toFixed(6)),
      lng: Number((sumLng / flatPoints.length).toFixed(6)),
    };
  }

  /**
   * Test bounding box intersection
   */
  doBoundingBoxesIntersect(boxA, boxB) {
    // box = [minLng, minLat, maxLng, maxLat]
    return !(
      boxA[0] > boxB[2] ||
      boxA[2] < boxB[0] ||
      boxA[1] > boxB[3] ||
      boxA[3] < boxB[1]
    );
  }

  /**
   * Extract bounding box from polygon ring
   */
  getRingBoundingBox(ring) {
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    ring.forEach((p) => {
      if (p[0] < minLng) minLng = p[0];
      if (p[0] > maxLng) maxLng = p[0];
      if (p[1] < minLat) minLat = p[1];
      if (p[1] > maxLat) maxLat = p[1];
    });

    return [minLng, minLat, maxLng, maxLat];
  }

  /**
   * Generate circular polygon coordinates around a center point for radius visualization
   */
  generateCirclePolygon(centerLat, centerLng, radiusKm, numPoints = 36) {
    const coords = [];
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;

    const latRad = toRad(centerLat);
    const lngRad = toRad(centerLng);
    const distRad = radiusKm / this.EARTH_RADIUS_KM;

    for (let i = 0; i <= numPoints; i++) {
      const bearing = (i * 360) / numPoints;
      const bRad = toRad(bearing);

      const pLatRad = Math.asin(
        Math.sin(latRad) * Math.cos(distRad) + Math.cos(latRad) * Math.sin(distRad) * Math.cos(bRad)
      );

      const pLngRad =
        lngRad +
        Math.atan2(
          Math.sin(bRad) * Math.sin(distRad) * Math.cos(latRad),
          Math.cos(distRad) - Math.sin(latRad) * Math.sin(pLatRad)
        );

      coords.push([Number(toDeg(pLngRad).toFixed(6)), Number(toDeg(pLatRad).toFixed(6))]);
    }

    return coords;
  }
}

module.exports = new GisSpatialEngine();

