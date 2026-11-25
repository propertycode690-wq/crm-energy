/**
 * GIS File Parser & Validator Service
 * Supports GeoJSON (.geojson, .json) and KML (.kml) formats with full geographic validation.
 */

const gisSpatialEngine = require('./gisSpatialEngine');

class GisParserService {
  /**
   * Parse uploaded file buffer or raw text string
   * @param {string|Buffer} content Raw file content
   * @param {string} fileType 'GEOJSON' or 'KML'
   * @returns {object} { isValid: boolean, features: Array, metadata: object, error: string }
   */
  parseGisFile(content, fileType = 'GEOJSON') {
    const rawStr = Buffer.isBuffer(content) ? content.toString('utf-8') : String(content);

    if (!rawStr || rawStr.trim().length === 0) {
      throw new Error('Empty GIS file content provided.');
    }

    const typeUpper = fileType.toUpperCase();
    if (typeUpper === 'GEOJSON' || typeUpper === 'JSON') {
      return this.parseGeoJson(rawStr);
    } else if (typeUpper === 'KML') {
      return this.parseKml(rawStr);
    } else {
      throw new Error(`Unsupported GIS file format: ${fileType}. Supported: GeoJSON, KML.`);
    }
  }

  /**
   * Parse and validate GeoJSON structure
   */
  parseGeoJson(rawStr) {
    let parsed;
    try {
      parsed = JSON.parse(rawStr);
    } catch (err) {
      throw new Error(`Invalid JSON syntax: ${err.message}`);
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('GeoJSON must be a valid JSON object.');
    }

    const features = [];

    if (parsed.type === 'FeatureCollection') {
      if (!Array.isArray(parsed.features)) {
        throw new Error('FeatureCollection must contain a "features" array.');
      }
      for (let i = 0; i < parsed.features.length; i++) {
        const feat = parsed.features[i];
        const normalized = this._normalizeFeature(feat, i);
        if (normalized) features.push(normalized);
      }
    } else if (parsed.type === 'Feature') {
      const normalized = this._normalizeFeature(parsed, 0);
      if (normalized) features.push(normalized);
    } else if (parsed.type === 'Polygon' || parsed.type === 'Point' || parsed.type === 'LineString' || parsed.type === 'MultiPolygon') {
      // Direct geometry
      const feat = {
        type: 'Feature',
        geometry: parsed,
        properties: { name: `Imported ${parsed.type}` },
      };
      const normalized = this._normalizeFeature(feat, 0);
      if (normalized) features.push(normalized);
    } else {
      throw new Error(`Unsupported root GeoJSON type: ${parsed.type}`);
    }

    if (features.length === 0) {
      throw new Error('No valid geographic features found in the provided GeoJSON.');
    }

    return {
      isValid: true,
      fileType: 'GEOJSON',
      featureCount: features.length,
      features,
      rawContent: rawStr,
    };
  }

  /**
   * Parse and validate KML structure
   */
  parseKml(rawStr) {
    if (!rawStr.includes('<kml') && !rawStr.includes('<Placemark')) {
      throw new Error('Provided content does not appear to be a valid KML document.');
    }

    const features = [];
    const placemarkRegex = /<Placemark[\s\S]*?<\/Placemark>/gi;
    const matches = rawStr.match(placemarkRegex);

    if (!matches || matches.length === 0) {
      throw new Error('No <Placemark> elements found in KML file.');
    }

    for (let i = 0; i < matches.length; i++) {
      const pml = matches[i];

      // Extract Name
      const nameMatch = pml.match(/<name>(.*?)<\/name>/i);
      const name = nameMatch ? nameMatch[1].trim() : `KML Feature ${i + 1}`;

      // Extract Description
      const descMatch = pml.match(/<description>([\s\S]*?)<\/description>/i);
      const description = descMatch ? descMatch[1].trim() : null;

      // Check Polygon
      const polyMatch = pml.match(/<Polygon[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Polygon>/i);
      if (polyMatch) {
        const coordsStr = polyMatch[1].trim();
        const coords = this._parseKmlCoordinates(coordsStr);
        if (coords.length >= 3) {
          // Ensure closed loop
          const first = coords[0];
          const last = coords[coords.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            coords.push([first[0], first[1]]);
          }

          const centroid = gisSpatialEngine.calculateCentroid([coords]);
          const area = gisSpatialEngine.calculatePolygonAreaSqKm(coords);

          features.push({
            name,
            geometryType: 'POLYGON',
            featureType: 'POLYGON',
            coordinates: [coords],
            latitude: centroid.lat,
            longitude: centroid.lng,
            properties: {
              name,
              description,
              areaSqKm: area,
              source: 'KML_IMPORT',
            },
          });
          continue;
        }
      }

      // Check Point
      const pointMatch = pml.match(/<Point[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Point>/i);
      if (pointMatch) {
        const coordsStr = pointMatch[1].trim();
        const coords = this._parseKmlCoordinates(coordsStr);
        if (coords.length > 0) {
          const pt = coords[0];
          features.push({
            name,
            geometryType: 'POINT',
            featureType: 'POINT',
            coordinates: pt,
            latitude: pt[1],
            longitude: pt[0],
            properties: {
              name,
              description,
              source: 'KML_IMPORT',
            },
          });
          continue;
        }
      }
    }

    if (features.length === 0) {
      throw new Error('Failed to parse any valid geometries from the KML file.');
    }

    return {
      isValid: true,
      fileType: 'KML',
      featureCount: features.length,
      features,
      rawContent: rawStr,
    };
  }

  /**
   * Helper to parse comma/whitespace separated KML coordinate strings
   */
  _parseKmlCoordinates(coordsStr) {
    const list = coordsStr.trim().split(/\s+/);
    const parsed = [];
    for (const item of list) {
      const parts = item.split(',');
      if (parts.length >= 2) {
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng) && this._isValidCoord(lat, lng)) {
          parsed.push([Number(lng.toFixed(6)), Number(lat.toFixed(6))]);
        }
      }
    }
    return parsed;
  }

  /**
   * Normalize GeoJSON feature
   */
  _normalizeFeature(feature, index) {
    if (!feature || !feature.geometry) return null;

    const geom = feature.geometry;
    const props = feature.properties || {};
    const name = props.name || props.title || `Feature ${index + 1}`;

    const geomType = (geom.type || '').toUpperCase();

    if (geomType === 'POINT') {
      const [lng, lat] = geom.coordinates;
      if (!this._isValidCoord(lat, lng)) {
        throw new Error(`Invalid Point coordinates at index ${index}: [${lng}, ${lat}]`);
      }
      return {
        name,
        geometryType: 'POINT',
        featureType: props.featureType || 'ACCOUNT',
        latitude: lat,
        longitude: lng,
        coordinates: [lng, lat],
        properties: props,
      };
    }

    if (geomType === 'POLYGON') {
      const coords = geom.coordinates;
      if (!Array.isArray(coords) || coords.length === 0 || !Array.isArray(coords[0])) {
        throw new Error(`Invalid Polygon coordinates array at index ${index}`);
      }
      const outerRing = coords[0];
      if (outerRing.length < 3) {
        throw new Error(`Polygon at index ${index} must contain at least 3 vertices.`);
      }

      const centroid = gisSpatialEngine.calculateCentroid(coords);
      const area = gisSpatialEngine.calculatePolygonAreaSqKm(outerRing);

      return {
        name,
        geometryType: 'POLYGON',
        featureType: props.featureType || 'TERRITORY',
        latitude: centroid.lat,
        longitude: centroid.lng,
        coordinates: coords,
        properties: {
          ...props,
          areaSqKm: area,
        },
      };
    }

    if (geomType === 'LINESTRING') {
      const coords = geom.coordinates;
      const centroid = gisSpatialEngine.calculateCentroid(coords);
      return {
        name,
        geometryType: 'LINESTRING',
        featureType: props.featureType || 'ROUTE',
        latitude: centroid.lat,
        longitude: centroid.lng,
        coordinates: coords,
        properties: props,
      };
    }

    return null;
  }

  /**
   * Validate coordinate range
   */
  _isValidCoord(lat, lng) {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }
}

module.exports = new GisParserService();

