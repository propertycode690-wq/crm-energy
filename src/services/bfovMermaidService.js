/**
 * BFOV Charts — Advanced Mermaid Parser & Converter Engine
 * Master Prompt 15: Converts Mermaid DSL into internal BFOV graph structures
 * Supports: Flowchart, Sequence, Class, ERD, and State diagrams
 */

const bfovValidationService = require('./bfovValidationService');

class BfovMermaidService {
  /**
   * Validate and parse Mermaid text input
   */
  parse(mermaidCode) {
    if (!mermaidCode || typeof mermaidCode !== 'string' || !mermaidCode.trim()) {
      return {
        isValid: false,
        errors: [{ line: 1, message: 'Mermaid code input cannot be empty.' }]
      };
    }

    const lines = mermaidCode
      .split('\n')
      .map((l, index) => ({ text: l.trim(), lineNum: index + 1 }))
      .filter(l => l.text.length > 0 && !l.text.startsWith('%%'));

    if (lines.length === 0) {
      return {
        isValid: false,
        errors: [{ line: 1, message: 'No valid Mermaid instructions found (only comments or whitespace).' }]
      };
    }

    const firstLine = lines[0].text.toLowerCase();

    try {
      if (firstLine.startsWith('flowchart') || firstLine.startsWith('graph')) {
        return this.parseFlowchart(lines);
      } else if (firstLine.startsWith('sequencediagram')) {
        return this.parseSequenceDiagram(lines);
      } else if (firstLine.startsWith('classdiagram')) {
        return this.parseClassDiagram(lines);
      } else if (firstLine.startsWith('erdiagram')) {
        return this.parseErDiagram(lines);
      } else if (firstLine.startsWith('statediagram')) {
        return this.parseStateDiagram(lines);
      } else {
        return {
          isValid: false,
          errors: [
            {
              line: lines[0].lineNum,
              message: `Unsupported or unknown diagram type in header '${lines[0].text}'. Expected 'flowchart', 'graph', 'sequenceDiagram', 'classDiagram', 'erDiagram', or 'stateDiagram'.`
            }
          ]
        };
      }
    } catch (err) {
      return {
        isValid: false,
        errors: [{ line: 1, message: `Parser exception: ${err.message}` }]
      };
    }
  }

  /**
   * Parse Flowcharts (flowchart TD, flowchart LR, graph TD, etc.)
   */
  parseFlowchart(lines) {
    const header = lines[0].text;
    const isLR = header.includes('LR') || header.includes('RL');
    const nodesMap = new Map();
    const edgesList = [];
    const errors = [];

    // Regex for edge with optional label
    // Matches e.g. A[Start] -->|Yes| B{Decision} or A --> B
    const edgePattern = /(-->|---|==>|-\.->)\s*(?:\|([^|]+)\|)?/g;

    let edgeCounter = 1;

    for (let i = 1; i < lines.length; i++) {
      const lineObj = lines[i];
      const line = lineObj.text;

      // Extract node definitions or connections
      // Syntax: Source [shape] -->|label| Target [shape]
      if (line.includes('-->') || line.includes('---') || line.includes('==>') || line.includes('-.->')) {
        const parts = line.split(/-->|---|==>|-\.->/);
        if (parts.length >= 2) {
          const rawSource = parts[0].trim();
          const remainder = line.slice(parts[0].length);

          const edgeMatch = edgePattern.exec(remainder);
          edgePattern.lastIndex = 0; // reset regex

          const edgeSymbol = edgeMatch ? edgeMatch[1] : '-->';
          const edgeLabel = edgeMatch && edgeMatch[2] ? edgeMatch[2].trim() : '';

          // Target is after the arrow + label
          let rawTarget = remainder.replace(edgePattern, '').trim();

          const sourceNode = this.extractNodeDef(rawSource);
          const targetNode = this.extractNodeDef(rawTarget);

          if (!nodesMap.has(sourceNode.id)) nodesMap.set(sourceNode.id, sourceNode);
          if (!nodesMap.has(targetNode.id)) nodesMap.set(targetNode.id, targetNode);

          edgesList.push({
            id: `edge-mmd-${edgeCounter++}`,
            source: sourceNode.id,
            target: targetNode.id,
            sourceHandle: isLR ? 'right' : 'bottom',
            targetHandle: isLR ? 'left' : 'top',
            type: edgeSymbol === '-.->' ? 'elbow' : 'straight',
            label: edgeLabel,
            style: {
              stroke: '#475569',
              strokeWidth: edgeSymbol === '==>' ? 3 : 2,
              strokeDasharray: edgeSymbol === '-.->' ? '4 4' : null
            }
          });
          continue;
        }
      }

      // Standalone node definition: id[Label]
      const standalone = this.extractNodeDef(line);
      if (standalone && standalone.id) {
        if (!nodesMap.has(standalone.id)) {
          nodesMap.set(standalone.id, standalone);
        }
      } else {
        errors.push({ line: lineObj.lineNum, message: `Could not parse line: '${line}'` });
      }
    }

    if (nodesMap.size === 0) {
      return {
        isValid: false,
        errors: [{ line: 1, message: 'No valid nodes could be parsed from the flowchart.' }]
      };
    }

    // Auto-layout coordinates
    const nodes = Array.from(nodesMap.values());
    this.layoutNodes(nodes, edgesList, isLR ? 'LR' : 'TD');

    return {
      isValid: true,
      diagramType: 'FLOWCHART',
      nodeCount: nodes.length,
      edgeCount: edgesList.length,
      graphData: {
        nodes,
        edges: edgesList,
        viewport: { x: 50, y: 50, zoom: 1 }
      },
      errors
    };
  }

  /**
   * Parse Sequence Diagrams (sequenceDiagram, Alice->>Bob: Message)
   */
  parseSequenceDiagram(lines) {
    const participantsMap = new Map();
    const edgesList = [];
    let messageIndex = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].text;

      if (line.startsWith('participant') || line.startsWith('actor')) {
        const name = line.replace(/^(participant|actor)\s+/, '').trim();
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        participantsMap.set(id, {
          id,
          type: line.startsWith('actor') ? 'uml_actor' : 'process',
          label: name,
          width: 140,
          height: 50,
          style: { fill: '#eff6ff', stroke: '#3b82f6', strokeWidth: 2, textColor: '#1e40af' }
        });
      } else if (line.includes('->>') || line.includes('-->>') || line.includes('->')) {
        // Message line: Source->>Target: Content
        const match = line.match(/^([^-\s]+)\s*(-?->>|-?->)\s*([^:\s]+)\s*:\s*(.*)$/);
        if (match) {
          const rawSrc = match[1].trim();
          const arrow = match[2];
          const rawTarget = match[3].trim();
          const msg = match[4].trim();

          const srcId = rawSrc.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const tgtId = rawTarget.toLowerCase().replace(/[^a-z0-9]/g, '_');

          if (!participantsMap.has(srcId)) {
            participantsMap.set(srcId, {
              id: srcId,
              type: 'process',
              label: rawSrc,
              width: 140,
              height: 50,
              style: { fill: '#eff6ff', stroke: '#3b82f6', strokeWidth: 2, textColor: '#1e40af' }
            });
          }
          if (!participantsMap.has(tgtId)) {
            participantsMap.set(tgtId, {
              id: tgtId,
              type: 'process',
              label: rawTarget,
              width: 140,
              height: 50,
              style: { fill: '#eff6ff', stroke: '#3b82f6', strokeWidth: 2, textColor: '#1e40af' }
            });
          }

          edgesList.push({
            id: `seq-edge-${++messageIndex}`,
            source: srcId,
            target: tgtId,
            sourceHandle: 'bottom',
            targetHandle: 'bottom',
            type: 'straight',
            label: `${messageIndex}. ${msg}`,
            style: {
              stroke: '#2563eb',
              strokeWidth: 2,
              strokeDasharray: arrow.includes('--') ? '4 4' : null
            }
          });
        }
      }
    }

    const participants = Array.from(participantsMap.values());
    // Layout participants horizontally
    participants.forEach((p, idx) => {
      p.x = 80 + idx * 220;
      p.y = 80;
    });

    return {
      isValid: true,
      diagramType: 'SEQUENCE',
      nodeCount: participants.length,
      edgeCount: edgesList.length,
      graphData: {
        nodes: participants,
        edges: edgesList,
        viewport: { x: 40, y: 40, zoom: 1 }
      }
    };
  }

  /**
   * Parse Class Diagrams (classDiagram, class User { +name: String })
   */
  parseClassDiagram(lines) {
    const classMap = new Map();
    const edgesList = [];
    let edgeCounter = 1;

    let currentClass = null;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].text;

      if (line.startsWith('class ') && line.includes('{')) {
        const className = line.replace('class ', '').replace('{', '').trim();
        currentClass = {
          id: className.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          type: 'uml_class',
          label: `${className}\n--`,
          width: 200,
          height: 140,
          style: { fill: '#f8fafc', stroke: '#3b82f6', strokeWidth: 2, textColor: '#0f172a' }
        };
        classMap.set(currentClass.id, currentClass);
      } else if (line === '}' && currentClass) {
        currentClass = null;
      } else if (currentClass) {
        currentClass.label += `\n${line}`;
      } else if (line.includes('<|--') || line.includes('*--') || line.includes('-->')) {
        // Association: ClassA <|-- ClassB
        const parts = line.split(/<\|--|\*--|-->/);
        if (parts.length === 2) {
          const srcName = parts[0].trim();
          const tgtName = parts[1].split(':')[0].trim();
          const label = parts[1].includes(':') ? parts[1].split(':')[1].trim() : '';

          const srcId = srcName.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const tgtId = tgtName.toLowerCase().replace(/[^a-z0-9]/g, '_');

          if (!classMap.has(srcId)) {
            classMap.set(srcId, {
              id: srcId,
              type: 'uml_class',
              label: `${srcName}\n--`,
              width: 200,
              height: 120,
              style: { fill: '#f8fafc', stroke: '#3b82f6', strokeWidth: 2, textColor: '#0f172a' }
            });
          }
          if (!classMap.has(tgtId)) {
            classMap.set(tgtId, {
              id: tgtId,
              type: 'uml_class',
              label: `${tgtName}\n--`,
              width: 200,
              height: 120,
              style: { fill: '#f8fafc', stroke: '#3b82f6', strokeWidth: 2, textColor: '#0f172a' }
            });
          }

          edgesList.push({
            id: `class-edge-${edgeCounter++}`,
            source: srcId,
            target: tgtId,
            sourceHandle: 'bottom',
            targetHandle: 'top',
            type: 'straight',
            label,
            style: { stroke: '#475569', strokeWidth: 2 }
          });
        }
      }
    }

    const classes = Array.from(classMap.values());
    this.layoutNodes(classes, edgesList, 'TD');

    return {
      isValid: true,
      diagramType: 'UML',
      nodeCount: classes.length,
      edgeCount: edgesList.length,
      graphData: {
        nodes: classes,
        edges: edgesList,
        viewport: { x: 50, y: 50, zoom: 1 }
      }
    };
  }

  /**
   * Parse ER Diagrams (erDiagram, CUSTOMER ||--o{ ORDER : places)
   */
  parseErDiagram(lines) {
    const entityMap = new Map();
    const edgesList = [];
    let relIndex = 1;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].text;
      if (line.includes('||--') || line.includes('}|--') || line.includes('--o{') || line.includes('--|{')) {
        // e.g. CUSTOMER ||--o{ ORDER : places
        const parts = line.split(/\|\|--o\{|\|\|--\|\{|\}\|--o\{|--/);
        if (parts.length >= 2) {
          const e1 = parts[0].trim();
          const remainder = parts[1].trim();
          const e2 = remainder.split(':')[0].trim();
          const label = remainder.includes(':') ? remainder.split(':')[1].trim() : '1 : N';

          const id1 = e1.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const id2 = e2.toLowerCase().replace(/[^a-z0-9]/g, '_');

          if (!entityMap.has(id1)) {
            entityMap.set(id1, {
              id: id1,
              type: 'entity',
              label: `${e1.toUpperCase()}\n--\nPK id: VARCHAR`,
              width: 200,
              height: 120,
              style: { fill: '#f0fdf4', stroke: '#16a34a', strokeWidth: 2, textColor: '#166534' }
            });
          }
          if (!entityMap.has(id2)) {
            entityMap.set(id2, {
              id: id2,
              type: 'entity',
              label: `${e2.toUpperCase()}\n--\nPK id: VARCHAR\nFK ${id1}Id: VARCHAR`,
              width: 210,
              height: 140,
              style: { fill: '#eff6ff', stroke: '#2563eb', strokeWidth: 2, textColor: '#1e40af' }
            });
          }

          edgesList.push({
            id: `er-rel-${relIndex++}`,
            source: id1,
            target: id2,
            sourceHandle: 'right',
            targetHandle: 'left',
            type: 'straight',
            label,
            style: { stroke: '#475569', strokeWidth: 2 }
          });
        }
      }
    }

    const entities = Array.from(entityMap.values());
    this.layoutNodes(entities, edgesList, 'LR');

    return {
      isValid: true,
      diagramType: 'ERD',
      nodeCount: entities.length,
      edgeCount: edgesList.length,
      graphData: {
        nodes: entities,
        edges: edgesList,
        viewport: { x: 50, y: 50, zoom: 1 }
      }
    };
  }

  /**
   * Parse State Diagrams (stateDiagram-v2, [*] --> State1)
   */
  parseStateDiagram(lines) {
    const statesMap = new Map();
    const transitions = [];
    let edgeIndex = 1;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].text;
      if (line.includes('-->')) {
        const parts = line.split('-->');
        const s1 = parts[0].trim();
        const rem = parts[1].trim();
        const s2 = rem.split(':')[0].trim();
        const label = rem.includes(':') ? rem.split(':')[1].trim() : '';

        const id1 = s1 === '[*]' ? 'state_start' : s1.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const id2 = s2 === '[*]' ? 'state_end' : s2.toLowerCase().replace(/[^a-z0-9]/g, '_');

        if (!statesMap.has(id1)) {
          statesMap.set(id1, {
            id: id1,
            type: id1 === 'state_start' ? 'terminator' : 'rounded_rectangle',
            label: id1 === 'state_start' ? 'Initial State' : s1,
            width: 140,
            height: 50,
            style: { fill: '#ecfdf5', stroke: '#10b981', strokeWidth: 2, textColor: '#065f46' }
          });
        }

        if (!statesMap.has(id2)) {
          statesMap.set(id2, {
            id: id2,
            type: id2 === 'state_end' ? 'terminator' : 'rounded_rectangle',
            label: id2 === 'state_end' ? 'Final State' : s2,
            width: 140,
            height: 50,
            style: { fill: id2 === 'state_end' ? '#fff1f2' : '#f8fafc', stroke: id2 === 'state_end' ? '#e11d48' : '#64748b', strokeWidth: 2, textColor: '#0f172a' }
          });
        }

        transitions.push({
          id: `trans-${edgeIndex++}`,
          source: id1,
          target: id2,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'straight',
          label,
          style: { stroke: '#475569', strokeWidth: 2 }
        });
      }
    }

    const states = Array.from(statesMap.values());
    this.layoutNodes(states, transitions, 'TD');

    return {
      isValid: true,
      diagramType: 'FLOWCHART',
      nodeCount: states.length,
      edgeCount: transitions.length,
      graphData: {
        nodes: states,
        edges: transitions,
        viewport: { x: 50, y: 50, zoom: 1 }
      }
    };
  }

  /**
   * Helper: extract node identifier and shape type from raw string
   * e.g. A[Rectangle], B(Rounded), C([Terminator]), D{Decision}, E[(Database)], F((Circle)), G[/IO/]
   */
  extractNodeDef(str) {
    const trimmed = str.trim();

    // Check database [ ( ... ) ]
    let match = trimmed.match(/^([a-zA-Z0-9_-]+)\[\((.*?)\)\]$/);
    if (match) return { id: match[1], type: 'database', label: match[2], width: 130, height: 80, style: { fill: '#ecfdf5', stroke: '#059669', strokeWidth: 2, textColor: '#064e3b' } };

    // Check terminator ( [ ... ] )
    match = trimmed.match(/^([a-zA-Z0-9_-]+)\(\[(.*?)\]\)$/);
    if (match) return { id: match[1], type: 'terminator', label: match[2], width: 140, height: 50, style: { fill: '#ecfdf5', stroke: '#10b981', strokeWidth: 2, textColor: '#065f46' } };

    // Check decision { ... }
    match = trimmed.match(/^([a-zA-Z0-9_-]+)\{(.*?)\}$/);
    if (match) return { id: match[1], type: 'decision', label: match[2], width: 130, height: 80, style: { fill: '#fef3c7', stroke: '#f59e0b', strokeWidth: 2, textColor: '#92400e' } };

    // Check input_output [/ ... /]
    match = trimmed.match(/^([a-zA-Z0-9_-]+)\[\/(.*?)\/\]$/);
    if (match) return { id: match[1], type: 'input_output', label: match[2], width: 150, height: 60, style: { fill: '#eff6ff', stroke: '#3b82f6', strokeWidth: 2, textColor: '#1e40af' } };

    // Check circle (( ... ))
    match = trimmed.match(/^([a-zA-Z0-9_-]+)\(\((.*?)\)\)$/);
    if (match) return { id: match[1], type: 'circle', label: match[2], width: 80, height: 80, style: { fill: '#f8fafc', stroke: '#64748b', strokeWidth: 2, textColor: '#0f172a' } };

    // Check rounded ( ... )
    match = trimmed.match(/^([a-zA-Z0-9_-]+)\((.*?)\)$/);
    if (match) return { id: match[1], type: 'rounded_rectangle', label: match[2], width: 140, height: 60, style: { fill: '#f8fafc', stroke: '#64748b', strokeWidth: 2, textColor: '#0f172a' } };

    // Check rectangle [ ... ]
    match = trimmed.match(/^([a-zA-Z0-9_-]+)\[(.*?)\]$/);
    if (match) return { id: match[1], type: 'process', label: match[2], width: 140, height: 65, style: { fill: '#f8fafc', stroke: '#475569', strokeWidth: 2, textColor: '#0f172a' } };

    // Plain ID without brackets
    const cleanId = trimmed.replace(/[^a-zA-Z0-9_-]/g, '');
    return {
      id: cleanId,
      type: 'process',
      label: trimmed,
      width: 130,
      height: 60,
      style: { fill: '#ffffff', stroke: '#475569', strokeWidth: 2, textColor: '#0f172a' }
    };
  }

  /**
   * Simple topological grid layout for nodes
   */
  layoutNodes(nodes, edges, direction = 'TD') {
    const isLR = direction === 'LR';
    const visited = new Set();
    const ranks = new Map();

    // Assign rank 0 to nodes with in-degree = 0
    const inDegree = new Map();
    nodes.forEach(n => inDegree.set(n.id, 0));
    edges.forEach(e => {
      inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    });

    let currentRankNodes = nodes.filter(n => (inDegree.get(n.id) || 0) === 0);
    if (currentRankNodes.length === 0 && nodes.length > 0) {
      currentRankNodes = [nodes[0]];
    }

    let rank = 0;
    while (currentRankNodes.length > 0) {
      currentRankNodes.forEach(n => {
        ranks.set(n.id, rank);
        visited.add(n.id);
      });

      const nextRankSet = new Set();
      currentRankNodes.forEach(n => {
        edges
          .filter(e => e.source === n.id)
          .forEach(e => {
            if (!visited.has(e.target)) {
              nextRankSet.add(nodes.find(node => node.id === e.target));
            }
          });
      });

      currentRankNodes = Array.from(nextRankSet).filter(Boolean);
      rank++;
    }

    // Nodes left unvisited (cycles or disconnected)
    nodes.forEach(n => {
      if (!ranks.has(n.id)) {
        ranks.set(n.id, rank++);
      }
    });

    // Group by rank and position
    const rankGroups = new Map();
    ranks.forEach((r, nodeId) => {
      if (!rankGroups.has(r)) rankGroups.set(r, []);
      rankGroups.get(r).push(nodes.find(n => n.id === nodeId));
    });

    rankGroups.forEach((groupNodes, r) => {
      groupNodes.forEach((node, colIdx) => {
        if (!node) return;
        if (isLR) {
          node.x = 80 + r * 220;
          node.y = 80 + colIdx * 120;
        } else {
          node.x = 80 + colIdx * 200;
          node.y = 80 + r * 130;
        }
      });
    });
  }
}

module.exports = new BfovMermaidService();

