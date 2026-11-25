const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function seedBfovTemplates() {
  console.log('[Seed BFOV] Seeding standard diagram templates...');

  const templates = [
    {
      id: 'tmpl-flowchart-standard',
      templateKey: 'standard-process-flow',
      title: 'Standard Decision Process Flow',
      description: 'Standard flowchart with start/end terminals, input/output, process action, and decision branching.',
      category: 'Flowchart',
      diagramType: 'FLOWCHART',
      icon: 'Workflow',
      defaultGraphData: {
        nodes: [
          { id: 'node-start', type: 'terminator', x: 280, y: 50, width: 140, height: 50, label: 'Start Process', style: { fill: '#ecfdf5', stroke: '#10b981', strokeWidth: 2, textColor: '#065f46' } },
          { id: 'node-input', type: 'input_output', x: 270, y: 150, width: 160, height: 60, label: 'Read Project Specs', style: { fill: '#eff6ff', stroke: '#3b82f6', strokeWidth: 2, textColor: '#1e40af' } },
          { id: 'node-proc1', type: 'process', x: 270, y: 260, width: 160, height: 65, label: 'Synthesize & Validate', style: { fill: '#f8fafc', stroke: '#64748b', strokeWidth: 2, textColor: '#0f172a' } },
          { id: 'node-dec1', type: 'decision', x: 280, y: 380, width: 140, height: 80, label: 'Quality Pass?', style: { fill: '#fef3c7', stroke: '#f59e0b', strokeWidth: 2, textColor: '#92400e' } },
          { id: 'node-proc2', type: 'process', x: 500, y: 390, width: 150, height: 60, label: 'Rework & Calibrate', style: { fill: '#fff1f2', stroke: '#f43f5e', strokeWidth: 2, textColor: '#9f1239' } },
          { id: 'node-end', type: 'terminator', x: 280, y: 520, width: 140, height: 50, label: 'Release Artifact', style: { fill: '#ecfdf5', stroke: '#10b981', strokeWidth: 2, textColor: '#065f46' } }
        ],
        edges: [
          { id: 'edge-1', source: 'node-start', target: 'node-input', sourceHandle: 'bottom', targetHandle: 'top', type: 'straight', style: { stroke: '#475569', strokeWidth: 2 } },
          { id: 'edge-2', source: 'node-input', target: 'node-proc1', sourceHandle: 'bottom', targetHandle: 'top', type: 'straight', style: { stroke: '#475569', strokeWidth: 2 } },
          { id: 'edge-3', source: 'node-proc1', target: 'node-dec1', sourceHandle: 'bottom', targetHandle: 'top', type: 'straight', style: { stroke: '#475569', strokeWidth: 2 } },
          { id: 'edge-4', source: 'node-dec1', target: 'node-end', sourceHandle: 'bottom', targetHandle: 'top', type: 'straight', label: 'Yes', style: { stroke: '#10b981', strokeWidth: 2 } },
          { id: 'edge-5', source: 'node-dec1', target: 'node-proc2', sourceHandle: 'right', targetHandle: 'left', type: 'elbow', label: 'No', style: { stroke: '#f43f5e', strokeWidth: 2 } },
          { id: 'edge-6', source: 'node-proc2', target: 'node-proc1', sourceHandle: 'top', targetHandle: 'right', type: 'elbow', label: 'Retry', style: { stroke: '#64748b', strokeWidth: 2, strokeDasharray: '4 4' } }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    },
    {
      id: 'tmpl-uml-class',
      templateKey: 'standard-uml-class',
      title: 'UML Object & Class Hierarchy',
      description: 'Standard UML Class diagram depicting domains, attributes, methods, and inheritance/association.',
      category: 'UML',
      diagramType: 'UML',
      icon: 'Boxes',
      defaultGraphData: {
        nodes: [
          { id: 'uml-user', type: 'uml_class', x: 100, y: 80, width: 220, height: 160, label: 'User\n--\n+ id: String\n+ email: String\n+ role: UserRole\n--\n+ authenticate(): Boolean\n+ getPermissions(): List', style: { fill: '#f8fafc', stroke: '#3b82f6', strokeWidth: 2, textColor: '#0f172a' } },
          { id: 'uml-project', type: 'uml_class', x: 420, y: 80, width: 230, height: 160, label: 'ErpProject\n--\n+ id: String\n+ name: String\n+ budget: Decimal\n+ status: String\n--\n+ recalculateBudget(): Void\n+ advanceStage(): Boolean', style: { fill: '#f8fafc', stroke: '#10b981', strokeWidth: 2, textColor: '#0f172a' } },
          { id: 'uml-experiment', type: 'uml_class', x: 420, y: 320, width: 230, height: 150, label: 'ResearchExperiment\n--\n+ id: String\n+ hypothesis: String\n+ outcome: String\n--\n+ recordMeasurement(): Void\n+ logNotebook(): Void', style: { fill: '#f8fafc', stroke: '#8b5cf6', strokeWidth: 2, textColor: '#0f172a' } }
        ],
        edges: [
          { id: 'uml-edge-1', source: 'uml-user', target: 'uml-project', sourceHandle: 'right', targetHandle: 'left', type: 'straight', label: '1..* manages', style: { stroke: '#475569', strokeWidth: 2 } },
          { id: 'uml-edge-2', source: 'uml-project', target: 'uml-experiment', sourceHandle: 'bottom', targetHandle: 'top', type: 'straight', label: '1..* conducts', style: { stroke: '#475569', strokeWidth: 2 } }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    },
    {
      id: 'tmpl-erd-relational',
      templateKey: 'standard-erd-schema',
      title: 'ERD Relational Data Model',
      description: 'Entity Relationship Diagram showing tables, primary/foreign keys, and 1:N cardinality relations.',
      category: 'ERD',
      diagramType: 'ERD',
      icon: 'Database',
      defaultGraphData: {
        nodes: [
          { id: 'erd-tenant', type: 'entity', x: 80, y: 100, width: 200, height: 130, label: 'TENANTS\n--\nPK  id: VARCHAR\n    name: VARCHAR\n    plan: VARCHAR', style: { fill: '#f0fdf4', stroke: '#16a34a', strokeWidth: 2, textColor: '#166534' } },
          { id: 'erd-users', type: 'entity', x: 380, y: 100, width: 210, height: 150, label: 'USERS\n--\nPK  id: VARCHAR\nFK  tenantId: VARCHAR\n    email: VARCHAR\n    role: VARCHAR', style: { fill: '#eff6ff', stroke: '#2563eb', strokeWidth: 2, textColor: '#1e40af' } },
          { id: 'erd-diagrams', type: 'entity', x: 380, y: 330, width: 210, height: 160, label: 'BFOV_DIAGRAMS\n--\nPK  id: VARCHAR\nFK  tenantId: VARCHAR\nFK  userId: VARCHAR\n    title: VARCHAR\n    graphData: JSON', style: { fill: '#fdf4ff', stroke: '#c026d3', strokeWidth: 2, textColor: '#86198f' } }
        ],
        edges: [
          { id: 'erd-rel-1', source: 'erd-tenant', target: 'erd-users', sourceHandle: 'right', targetHandle: 'left', type: 'straight', label: '1 : N', style: { stroke: '#475569', strokeWidth: 2 } },
          { id: 'erd-rel-2', source: 'erd-users', target: 'erd-diagrams', sourceHandle: 'bottom', targetHandle: 'top', type: 'straight', label: '1 : N', style: { stroke: '#475569', strokeWidth: 2 } }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    },
    {
      id: 'tmpl-network-cloud',
      templateKey: 'standard-network-cloud',
      title: 'Cloud Microservices Network Topology',
      description: 'Distributed infrastructure topology with API Gateway, application clusters, firewall, and MySQL database cluster.',
      category: 'Network',
      diagramType: 'NETWORK',
      icon: 'Server',
      defaultGraphData: {
        nodes: [
          { id: 'net-client', type: 'network_node', x: 80, y: 160, width: 140, height: 60, label: 'Client (Web / Mobile)', style: { fill: '#f1f5f9', stroke: '#64748b', strokeWidth: 2, textColor: '#0f172a' } },
          { id: 'net-firewall', type: 'firewall', x: 280, y: 160, width: 130, height: 60, label: 'Cloud WAF / Firewall', style: { fill: '#fff1f2', stroke: '#e11d48', strokeWidth: 2, textColor: '#9f1239' } },
          { id: 'net-gateway', type: 'cloud', x: 470, y: 150, width: 150, height: 80, label: 'Express API Gateway\nPort 5002', style: { fill: '#e0e7ff', stroke: '#4338ca', strokeWidth: 2, textColor: '#312e81' } },
          { id: 'net-db', type: 'database', x: 700, y: 150, width: 140, height: 80, label: 'MySQL 8.0 Cluster\nPort 3306', style: { fill: '#ecfdf5', stroke: '#059669', strokeWidth: 2, textColor: '#064e3b' } }
        ],
        edges: [
          { id: 'net-edge-1', source: 'net-client', target: 'net-firewall', sourceHandle: 'right', targetHandle: 'left', type: 'straight', label: 'HTTPS :443', style: { stroke: '#475569', strokeWidth: 2 } },
          { id: 'net-edge-2', source: 'net-firewall', target: 'net-gateway', sourceHandle: 'right', targetHandle: 'left', type: 'straight', label: 'Filtered', style: { stroke: '#10b981', strokeWidth: 2 } },
          { id: 'net-edge-3', source: 'net-gateway', target: 'net-db', sourceHandle: 'right', targetHandle: 'left', type: 'straight', label: 'Prisma ORM', style: { stroke: '#3b82f6', strokeWidth: 2 } }
        ],
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    }
  ];

  for (const t of templates) {
    await prisma.bfovDiagramTemplate.upsert({
      where: { templateKey: t.templateKey },
      update: {
        title: t.title,
        description: t.description,
        category: t.category,
        diagramType: t.diagramType,
        icon: t.icon,
        defaultGraphData: t.defaultGraphData
      },
      create: {
        id: t.id,
        templateKey: t.templateKey,
        title: t.title,
        description: t.description,
        category: t.category,
        diagramType: t.diagramType,
        icon: t.icon,
        defaultGraphData: t.defaultGraphData,
        isSystem: true
      }
    });
    console.log(`[Seed BFOV] Successfully upserted template: ${t.templateKey}`);
  }

  const count = await prisma.bfovDiagramTemplate.count();
  console.log(`[Seed BFOV] Total diagram templates in database: ${count}`);
  await prisma.$disconnect();
}

seedBfovTemplates().catch(async (e) => {
  console.error('[Seed BFOV ERROR]:', e);
  await prisma.$disconnect();
  process.exit(1);
});

