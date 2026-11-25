/**
 * BFOV Charts — Core Geometry & Routing Engine
 * Master Prompt 14: Mathematical canvas geometry, connector routing, and spatial layout
 */

class BfovRoutingEngine {
  /**
   * Get exact port/handle coordinate on a node perimeter
   * @param {Object} node { x, y, width, height }
   * @param {string} handleId 'top' | 'bottom' | 'left' | 'right' | 'center'
   */
  getNodeHandleCoord(node, handleId = 'center') {
    const x = Number(node.x) || 0;
    const y = Number(node.y) || 0;
    const w = Number(node.width) || 120;
    const h = Number(node.height) || 60;

    switch (handleId) {
      case 'top':
        return { x: x + w / 2, y };
      case 'bottom':
        return { x: x + w / 2, y: y + h };
      case 'left':
        return { x, y: y + h / 2 };
      case 'right':
        return { x: x + w, y: y + h / 2 };
      case 'top-left':
        return { x, y };
      case 'top-right':
        return { x: x + w, y };
      case 'bottom-left':
        return { x, y: y + h };
      case 'bottom-right':
        return { x: x + w, y: y + h };
      case 'center':
      default:
        return { x: x + w / 2, y: y + h / 2 };
    }
  }

  /**
   * Calculate SVG path string and route points for straight connectors
   */
  getStraightPath(p1, p2) {
    return {
      path: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`,
      points: [p1, p2],
      midpoint: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
      angle: Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI)
    };
  }

  /**
   * Calculate SVG path string and route points for orthogonal / elbow connectors
   */
  getElbowPath(p1, p2, sourceHandle = 'right', targetHandle = 'left') {
    const points = [p1];

    if (sourceHandle === 'right' && targetHandle === 'left') {
      const midX = (p1.x + p2.x) / 2;
      points.push({ x: midX, y: p1.y });
      points.push({ x: midX, y: p2.y });
    } else if (sourceHandle === 'bottom' && targetHandle === 'top') {
      const midY = (p1.y + p2.y) / 2;
      points.push({ x: p1.x, y: midY });
      points.push({ x: p2.x, y: midY });
    } else if (sourceHandle === 'right' && targetHandle === 'top') {
      points.push({ x: p2.x, y: p1.y });
    } else if (sourceHandle === 'bottom' && targetHandle === 'right') {
      points.push({ x: p1.x, y: p2.y });
    } else if (sourceHandle === 'left' && targetHandle === 'bottom') {
      points.push({ x: p2.x, y: p1.y });
    } else {
      // General orthogonal fallback: horizontal then vertical
      const midX = (p1.x + p2.x) / 2;
      points.push({ x: midX, y: p1.y });
      points.push({ x: midX, y: p2.y });
    }

    points.push(p2);

    const path = points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    // Midpoint for label placement
    const midIdx = Math.floor(points.length / 2);
    const midpoint = points[midIdx] || { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

    return { path, points, midpoint };
  }

  /**
   * Calculate SVG path string for smooth cubic bezier curve
   */
  getBezierPath(p1, p2, sourceHandle = 'right', targetHandle = 'left') {
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    const offset = Math.max(30, Math.min(dx, dy) * 0.5);

    let c1 = { ...p1 };
    let c2 = { ...p2 };

    if (sourceHandle === 'right') c1.x += offset;
    else if (sourceHandle === 'left') c1.x -= offset;
    else if (sourceHandle === 'bottom') c1.y += offset;
    else if (sourceHandle === 'top') c1.y -= offset;

    if (targetHandle === 'left') c2.x -= offset;
    else if (targetHandle === 'right') c2.x += offset;
    else if (targetHandle === 'top') c2.y -= offset;
    else if (targetHandle === 'bottom') c2.y += offset;

    const path = `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
    const midpoint = {
      x: 0.125 * p1.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * p2.x,
      y: 0.125 * p1.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * p2.y
    };

    return { path, points: [p1, c1, c2, p2], midpoint };
  }

  /**
   * Unified connector router: resolves endpoints from nodes and returns computed path
   */
  computeEdgeRoute(edge, nodeMap) {
    const sourceNode = nodeMap[edge.source];
    const targetNode = nodeMap[edge.target];

    if (!sourceNode || !targetNode) {
      return null;
    }

    const p1 = this.getNodeHandleCoord(sourceNode, edge.sourceHandle || 'right');
    const p2 = this.getNodeHandleCoord(targetNode, edge.targetHandle || 'left');
    const edgeType = edge.type || 'straight';

    if (edgeType === 'elbow' || edgeType === 'orthogonal') {
      return this.getElbowPath(p1, p2, edge.sourceHandle || 'right', edge.targetHandle || 'left');
    } else if (edgeType === 'curved' || edgeType === 'bezier') {
      return this.getBezierPath(p1, p2, edge.sourceHandle || 'right', edge.targetHandle || 'left');
    } else {
      return this.getStraightPath(p1, p2);
    }
  }

  /**
   * Snap coordinate to a grid spacing
   */
  snapToGrid(val, gridSize = 10) {
    return Math.round(val / gridSize) * gridSize;
  }

  /**
   * Calculate bounding box enclosing all nodes in the diagram
   */
  calculateDiagramBounds(nodes = []) {
    if (!nodes || nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      const x = Number(node.x) || 0;
      const y = Number(node.y) || 0;
      const w = Number(node.width) || 120;
      const h = Number(node.height) || 60;

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(100, maxX - minX),
      height: Math.max(100, maxY - minY)
    };
  }

  /**
   * Align a subset of nodes (left, center, right, top, middle, bottom)
   */
  alignNodes(nodes, alignType) {
    if (!nodes || nodes.length < 2) return nodes;

    const bounds = this.calculateDiagramBounds(nodes);

    return nodes.map(node => {
      const cloned = { ...node };
      const w = Number(cloned.width) || 120;
      const h = Number(cloned.height) || 60;

      switch (alignType) {
        case 'left':
          cloned.x = bounds.minX;
          break;
        case 'center':
          cloned.x = bounds.minX + (bounds.width - w) / 2;
          break;
        case 'right':
          cloned.x = bounds.maxX - w;
          break;
        case 'top':
          cloned.y = bounds.minY;
          break;
        case 'middle':
          cloned.y = bounds.minY + (bounds.height - h) / 2;
          break;
        case 'bottom':
          cloned.y = bounds.maxY - h;
          break;
        default:
          break;
      }
      return cloned;
    });
  }

  /**
   * Distribute nodes evenly along horizontal or vertical axis
   */
  distributeNodes(nodes, axis = 'horizontal') {
    if (!nodes || nodes.length < 3) return nodes;

    const sorted = [...nodes].sort((a, b) => {
      return axis === 'horizontal' ? a.x - b.x : a.y - b.y;
    });

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (axis === 'horizontal') {
      const totalSpan = last.x - first.x;
      const step = totalSpan / (sorted.length - 1);
      return sorted.map((node, i) => ({
        ...node,
        x: Math.round(first.x + i * step)
      }));
    } else {
      const totalSpan = last.y - first.y;
      const step = totalSpan / (sorted.length - 1);
      return sorted.map((node, i) => ({
        ...node,
        y: Math.round(first.y + i * step)
      }));
    }
  }
}

module.exports = new BfovRoutingEngine();

