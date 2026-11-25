/**
 * BFOV Charts — Graph Validation and Normalization Service
 * Master Prompt 14: Validates node/edge consistency, handles size limits, and sanitizes payload
 */

const VALID_DIAGRAM_TYPES = [
  'FLOWCHART',
  'UML',
  'ERD',
  'NETWORK',
  'GENERAL',
  'SEQUENCE',
  'ARCHITECTURE'
];

const VALID_SHAPE_TYPES = [
  // Basic Shapes
  'rectangle',
  'rounded_rectangle',
  'circle',
  'ellipse',
  'diamond',
  'triangle',
  'line',
  'text',

  // Flowchart Shapes
  'terminator',
  'process',
  'decision',
  'input_output',
  'document',
  'database',
  'connector',

  // Technical / UML Shapes
  'uml_class',
  'uml_usecase',
  'uml_actor',
  'uml_component',
  'uml_state',

  // ERD Shapes
  'entity',
  'attribute',
  'relationship',

  // Network Shapes
  'network_node',
  'server',
  'cloud',
  'firewall',
  'router',
  'workstation'
];

const MAX_NODES = 1000;
const MAX_EDGES = 2000;
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

class BfovValidationService {
  /**
   * Validate full diagram input payload
   */
  validateDiagramPayload(data, isUpdate = false) {
    const errors = [];

    // Title validation
    if (!isUpdate || data.title !== undefined) {
      if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
        errors.push('Diagram title is required and must be a non-empty string.');
      } else if (data.title.trim().length > 255) {
        errors.push('Diagram title must not exceed 255 characters.');
      }
    }

    // Diagram type validation
    if (data.diagramType !== undefined) {
      const type = String(data.diagramType).toUpperCase();
      if (!VALID_DIAGRAM_TYPES.includes(type)) {
        errors.push(`Invalid diagram type '${data.diagramType}'. Supported types: ${VALID_DIAGRAM_TYPES.join(', ')}`);
      }
    }

    // Graph data validation
    if (data.graphData !== undefined) {
      const graphValidation = this.validateGraphData(data.graphData);
      if (!graphValidation.isValid) {
        errors.push(...graphValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate and normalize structured graphData { nodes, edges, viewport }
   */
  validateGraphData(rawGraphData) {
    const errors = [];
    let graph = rawGraphData;

    if (typeof graph === 'string') {
      try {
        graph = JSON.parse(graph);
      } catch (e) {
        return { isValid: false, errors: ['Graph data must be valid JSON format.'] };
      }
    }

    if (!graph || typeof graph !== 'object') {
      return { isValid: false, errors: ['Graph data must be an object with nodes and edges arrays.'] };
    }

    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const edges = Array.isArray(graph.edges) ? graph.edges : [];

    // Capacity checks
    if (nodes.length > MAX_NODES) {
      errors.push(`Diagram exceeds maximum node capacity (${MAX_NODES} nodes allowed).`);
    }
    if (edges.length > MAX_EDGES) {
      errors.push(`Diagram exceeds maximum edge capacity (${MAX_EDGES} edges allowed).`);
    }

    // Node validation & map construction
    const nodeMap = new Map();
    const normalizedNodes = [];

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (!n || typeof n !== 'object') {
        errors.push(`Node at index ${i} is invalid.`);
        continue;
      }

      const id = String(n.id || `node-${i}`).trim();
      if (nodeMap.has(id)) {
        errors.push(`Duplicate node id '${id}' detected at index ${i}.`);
      }
      nodeMap.set(id, true);

      normalizedNodes.push({
        id,
        type: VALID_SHAPE_TYPES.includes(n.type) ? n.type : 'rectangle',
        x: Number.isFinite(n.x) ? Number(n.x) : 0,
        y: Number.isFinite(n.y) ? Number(n.y) : 0,
        width: Math.max(20, Number(n.width) || 120),
        height: Math.max(20, Number(n.height) || 60),
        rotation: Number.isFinite(n.rotation) ? Number(n.rotation) : 0,
        label: typeof n.label === 'string' ? n.label.slice(0, 500) : '',
        style: {
          fill: n.style?.fill || '#ffffff',
          stroke: n.style?.stroke || '#475569',
          strokeWidth: Number(n.style?.strokeWidth) || 2,
          strokeDasharray: n.style?.strokeDasharray || null,
          textColor: n.style?.textColor || '#0f172a',
          fontSize: Number(n.style?.fontSize) || 14,
          fontWeight: n.style?.fontWeight || 'normal',
          textAlign: n.style?.textAlign || 'center',
          opacity: Number.isFinite(n.style?.opacity) ? Number(n.style?.opacity) : 1
        },
        data: n.data || {}
      });
    }

    // Edge validation
    const normalizedEdges = [];
    for (let j = 0; j < edges.length; j++) {
      const e = edges[j];
      if (!e || typeof e !== 'object') {
        errors.push(`Edge at index ${j} is invalid.`);
        continue;
      }

      const id = String(e.id || `edge-${j}`).trim();
      const source = String(e.source || '').trim();
      const target = String(e.target || '').trim();

      if (!source || !nodeMap.has(source)) {
        errors.push(`Edge '${id}' references non-existent source node '${source}'.`);
      }
      if (!target || !nodeMap.has(target)) {
        errors.push(`Edge '${id}' references non-existent target node '${target}'.`);
      }

      normalizedEdges.push({
        id,
        source,
        target,
        sourceHandle: e.sourceHandle || 'right',
        targetHandle: e.targetHandle || 'left',
        type: ['straight', 'elbow', 'curved', 'orthogonal', 'bezier'].includes(e.type) ? e.type : 'straight',
        label: typeof e.label === 'string' ? e.label.slice(0, 120) : '',
        arrowStart: Boolean(e.arrowStart),
        arrowEnd: e.arrowEnd !== undefined ? Boolean(e.arrowEnd) : true,
        style: {
          stroke: e.style?.stroke || '#475569',
          strokeWidth: Number(e.style?.strokeWidth) || 2,
          strokeDasharray: e.style?.strokeDasharray || null,
          labelColor: e.style?.labelColor || '#334155',
          fontSize: Number(e.style?.fontSize) || 12
        }
      });
    }

    const viewport = {
      x: Number.isFinite(graph.viewport?.x) ? Number(graph.viewport.x) : 0,
      y: Number.isFinite(graph.viewport?.y) ? Number(graph.viewport.y) : 0,
      zoom: Math.min(3, Math.max(0.2, Number(graph.viewport?.zoom) || 1))
    };

    return {
      isValid: errors.length === 0,
      errors,
      normalizedGraph: {
        nodes: normalizedNodes,
        edges: normalizedEdges,
        viewport
      }
    };
  }

  getSupportedTypes() {
    return {
      diagramTypes: VALID_DIAGRAM_TYPES,
      shapeTypes: VALID_SHAPE_TYPES
    };
  }
}

module.exports = new BfovValidationService();

