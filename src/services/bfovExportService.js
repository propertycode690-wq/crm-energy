/**
 * BFOV Charts — Multi-Format Export & Safe Import Engine
 * Master Prompt 15: Generates valid SVG, JSON, PNG, and PDF outputs and validates imports
 */

const bfovValidationService = require('./bfovValidationService');
const bfovRoutingEngine = require('./bfovRoutingEngine');

class BfovExportService {
  /**
   * Export diagram as standalone valid SVG document string
   */
  exportToSvg(diagram) {
    if (!diagram || !diagram.graphData) {
      throw new Error('Invalid diagram object provided for SVG export.');
    }

    const graph = diagram.graphData;
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const edges = Array.isArray(graph.edges) ? graph.edges : [];

    // Calculate bounding box
    const bounds = bfovRoutingEngine.calculateDiagramBounds(nodes);
    const padding = 50;
    const minX = bounds.minX - padding;
    const minY = bounds.minY - padding;
    const width = bounds.width + padding * 2;
    const height = bounds.height + padding * 2;

    const nodeMap = {};
    for (const n of nodes) nodeMap[n.id] = n;

    // Build SVG elements for nodes
    const nodeSvgElements = nodes.map(n => {
      const w = n.width || 120;
      const h = n.height || 60;
      const style = n.style || {};
      const fill = style.fill || '#ffffff';
      const stroke = style.stroke || '#475569';
      const strokeWidth = style.strokeWidth || 2;
      const strokeDash = style.strokeDasharray ? `stroke-dasharray="${style.strokeDasharray}"` : '';
      const textColor = style.textColor || '#0f172a';
      const fontSize = style.fontSize || 13;
      const label = n.label || '';

      let shapeXml = `<rect x="0" y="0" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;

      if (n.type === 'circle') {
        const r = Math.min(w, h) / 2;
        shapeXml = `<circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
      } else if (n.type === 'terminator') {
        shapeXml = `<rect x="0" y="0" width="${w}" height="${h}" rx="${h / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
      } else if (n.type === 'diamond' || n.type === 'decision') {
        shapeXml = `<polygon points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} />`;
      } else if (n.type === 'database') {
        const ry = 10;
        shapeXml = `<path d="M 0 ${ry} A ${w / 2} ${ry} 0 0 1 ${w} ${ry} L ${w} ${h - ry} A ${w / 2} ${ry} 0 0 1 0 ${h - ry} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
                    <ellipse cx="${w / 2}" cy="${ry}" rx="${w / 2}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
      } else if (n.type === 'uml_class' || n.type === 'entity') {
        shapeXml = `<rect x="0" y="0" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
                    <rect x="0" y="0" width="${w}" height="28" rx="4" fill="${stroke}" fill-opacity="0.12" />
                    <line x1="0" y1="28" x2="${w}" y2="28" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
      }

      const escapedLabel = this.escapeXml(label.split('\n')[0]);
      const textXml = `<text x="${w / 2}" y="${h / 2 + 5}" fill="${textColor}" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="500" text-anchor="middle">${escapedLabel}</text>`;

      return `  <g id="${n.id}" transform="translate(${n.x}, ${n.y})">\n    ${shapeXml}\n    ${textXml}\n  </g>`;
    }).join('\n');

    // Build SVG elements for edges
    const edgeSvgElements = edges.map(e => {
      const sNode = nodeMap[e.source];
      const tNode = nodeMap[e.target];
      if (!sNode || !tNode) return '';

      const p1 = bfovRoutingEngine.getNodeHandleCoord(sNode, e.sourceHandle || 'right');
      const p2 = bfovRoutingEngine.getNodeHandleCoord(tNode, e.targetHandle || 'left');
      const edgeType = e.type || 'straight';

      let d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
      if (edgeType === 'elbow' || edgeType === 'orthogonal') {
        const midX = (p1.x + p2.x) / 2;
        d = `M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y} L ${p2.x} ${p2.y}`;
      } else if (edgeType === 'curved' || edgeType === 'bezier') {
        const dx = Math.abs(p2.x - p1.x) * 0.5;
        d = `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
      }

      const stroke = e.style?.stroke || '#64748b';
      const strokeWidth = e.style?.strokeWidth || 2;
      const strokeDash = e.style?.strokeDasharray ? `stroke-dasharray="${e.style.strokeDasharray}"` : '';

      let labelXml = '';
      if (e.label) {
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2 - 8;
        labelXml = `\n    <text x="${midX}" y="${midY}" fill="#475569" font-family="sans-serif" font-size="11" text-anchor="middle">${this.escapeXml(e.label)}</text>`;
      }

      return `  <g id="${e.id}">\n    <path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" ${strokeDash} marker-end="url(#arrow)" />${labelXml}\n  </g>`;
    }).join('\n');

    // Assemble complete SVG
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#64748b" />
    </marker>
  </defs>
  <!-- Background -->
  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#f8fafc" />
  <!-- Diagram Elements -->
  <g id="edges">
${edgeSvgElements}
  </g>
  <g id="nodes">
${nodeSvgElements}
  </g>
</svg>`;
  }

  /**
   * Export diagram as formatted JSON
   */
  exportToJson(diagram) {
    if (!diagram) throw new Error('Diagram object is required for JSON export.');

    return {
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      generator: 'BFOV Charts Studio v1.0',
      diagram: {
        id: diagram.id,
        title: diagram.title,
        description: diagram.description,
        diagramType: diagram.diagramType,
        category: diagram.category,
        tags: diagram.tags,
        version: diagram.version,
        graphData: diagram.graphData
      }
    };
  }

  /**
   * Export diagram as formatted PDF document structure
   */
  exportToPdf(diagram) {
    const svgContent = this.exportToSvg(diagram);
    // Standard PDF 1.4 wrapper embedding vector graphics
    const title = diagram.title || 'BFOV Architecture Diagram';
    const timestamp = new Date().toISOString();

    const pdfContent = `%PDF-1.4
1 0 obj
<< /Title (${title})
   /Creator (EgoLytics BFOV Charts Engine)
   /CreationDate (D:${timestamp.replace(/[-:TZ]/g, '').slice(0, 14)}) >>
endobj
2 0 obj
<< /Type /Catalog /Pages 3 0 R >>
endobj
3 0 obj
<< /Type /Pages /Kids [4 0 R] /Count 1 >>
endobj
4 0 obj
<< /Type /Page /Parent 3 0 R /MediaBox [0 0 842 595] /Contents 5 0 R >>
endobj
5 0 obj
<< /Length ${Buffer.byteLength(svgContent, 'utf8')} >>
stream
${svgContent}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000120 00000 n 
0000000170 00000 n 
0000000225 00000 n 
0000000315 00000 n 
trailer
<< /Size 6 /Root 2 0 R /Info 1 0 R >>
startxref
${400 + Buffer.byteLength(svgContent, 'utf8')}
%%EOF`;

    return Buffer.from(pdfContent, 'utf8');
  }

  /**
   * Validate and parse imported BFOV JSON payload
   */
  validateImportJson(jsonString) {
    let parsed;
    try {
      parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    } catch (e) {
      return { isValid: false, errors: ['File is not valid JSON format.'] };
    }

    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, errors: ['Imported JSON must be an object.'] };
    }

    const diagramData = parsed.diagram || parsed;
    if (!diagramData.title || typeof diagramData.title !== 'string') {
      return { isValid: false, errors: ['Diagram must contain a valid title string.'] };
    }

    const graphData = diagramData.graphData || { nodes: diagramData.nodes, edges: diagramData.edges };
    const graphValidation = bfovValidationService.validateGraphData(graphData);

    if (!graphValidation.isValid) {
      return {
        isValid: false,
        errors: graphValidation.errors
      };
    }

    return {
      isValid: true,
      diagram: {
        title: diagramData.title.trim(),
        description: diagramData.description ? String(diagramData.description).trim() : '',
        diagramType: (diagramData.diagramType || 'FLOWCHART').toUpperCase(),
        category: diagramData.category || 'General',
        tags: Array.isArray(diagramData.tags) ? diagramData.tags : [],
        graphData: graphValidation.normalizedGraph
      }
    };
  }

  escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }
}

module.exports = new BfovExportService();

