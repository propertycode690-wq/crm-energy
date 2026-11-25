/**
 * EGOLYTICS MASTER PROMPT 15 — AUTOMATED VERIFICATION SUITE
 * BFOV Charts – Advanced Features & AI Integration
 *
 * Verifies:
 * - TC-15-01: Mermaid Flowchart parsing with diverse shapes & labeled edges
 * - TC-15-02: Mermaid Sequence diagram parsing (sequenceDiagram & lifelines)
 * - TC-15-03: Mermaid Class diagram parsing (classDiagram & compartments)
 * - TC-15-04: Mermaid ER diagram parsing (erDiagram & cardinality labels)
 * - TC-15-05: Mermaid State diagram parsing (stateDiagram-v2 & transitions)
 * - TC-15-06: Graceful error reporting with line numbers on invalid Mermaid syntax
 * - TC-15-07: Import Mermaid code directly creating operational BFOV diagram
 * - TC-15-08: AI provider status query (detects engine: Gemini, Ollama, Native Synthesis)
 * - TC-15-09: AI Text-to-Diagram: synthesizes valid diagram graph from natural language prompt
 * - TC-15-10: AI-Assisted Editing: applies semantic delta modification to existing canvas
 * - TC-15-11: Multi-format SVG export generates valid standalone SVG XML with markers and styles
 * - TC-15-12: Multi-format JSON export generates structured version-compatible backup schema
 * - TC-15-13: Multi-format PDF export generates vector document stream
 * - TC-15-14: Safe JSON import validates schema integrity, sanitizes, and instantiates diagram
 * - TC-15-15: Diagram sharing & granular access control (VIEWER / EDITOR)
 * - TC-15-16: Contextual comments discussion thread & resolution lifecycle
 * - TC-15-17: Save diagram as reusable blueprint template in system registry
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();
const bfovDiagramService = require('./src/services/bfovDiagramService');
const bfovMermaidService = require('./src/services/bfovMermaidService');
const bfovAiService = require('./src/services/bfovAiService');
const bfovExportService = require('./src/services/bfovExportService');
const bfovCollaborationService = require('./src/services/bfovCollaborationService');

const runId = Date.now();
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${message}`);
    failCount++;
  }
}

async function runMaster15TestSuite() {
  console.log('================================================================');
  console.log('EGOLYTICS MASTER PROMPT 15 — COMPREHENSIVE VERIFICATION SUITE');
  console.log('BFOV CHARTS – ADVANCED FEATURES & AI INTEGRATION');
  console.log('================================================================\n');

  try {
    const tenantA = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!tenantA) throw new Error('Primary tenant not found in database.');
    const userA = await prisma.user.findFirst({ where: { tenantId: tenantA.id } });

    // --- TC-15-01: Mermaid Flowchart parsing ---
    const mmdFlowchart = `flowchart TD
      A([Start Process]) --> B[/Input Specs/]
      B --> C[Execute Pipeline]
      C --> D{Quality Check?}
      D -->|Pass| E[(Save DB)]
      D -->|Fail| F[Rework]
      F --> C`;
    const flowParse = bfovMermaidService.parse(mmdFlowchart);
    assert(
      flowParse.isValid &&
      flowParse.diagramType === 'FLOWCHART' &&
      flowParse.nodeCount === 6 &&
      flowParse.edgeCount === 6,
      'TC-15-01: Mermaid Flowchart parsed successfully with 6 nodes, diverse shapes, and conditional edges'
    );

    // --- TC-15-02: Mermaid Sequence diagram parsing ---
    const mmdSequence = `sequenceDiagram
      participant User
      participant Gateway
      participant Database
      User->>Gateway: POST /api/login
      Gateway->>Database: Query credentials
      Database-->>Gateway: Verified row
      Gateway-->>User: 200 OK + JWT`;
    const seqParse = bfovMermaidService.parse(mmdSequence);
    assert(
      seqParse.isValid &&
      seqParse.diagramType === 'SEQUENCE' &&
      seqParse.nodeCount === 3 &&
      seqParse.edgeCount === 4,
      'TC-15-02: Mermaid Sequence diagram parsed with participants and chronological message edges'
    );

    // --- TC-15-03: Mermaid Class diagram parsing ---
    const mmdClass = `classDiagram
      class ErpProject {
        +id: String
        +budget: Decimal
        +recalculate(): Void
      }
      class Task {
        +id: String
        +status: String
      }
      ErpProject <|-- Task : has`;
    const classParse = bfovMermaidService.parse(mmdClass);
    assert(
      classParse.isValid &&
      classParse.diagramType === 'UML' &&
      classParse.nodeCount === 2 &&
      classParse.edgeCount === 1,
      'TC-15-03: Mermaid Class diagram parsed with compartments, attributes, and inheritance links'
    );

    // --- TC-15-04: Mermaid ER diagram parsing ---
    const mmdErd = `erDiagram
      CUSTOMER ||--o{ ORDER : places
      ORDER ||--|{ ORDER_ITEM : contains`;
    const erdParse = bfovMermaidService.parse(mmdErd);
    assert(
      erdParse.isValid &&
      erdParse.diagramType === 'ERD' &&
      erdParse.nodeCount === 3 &&
      erdParse.edgeCount === 2,
      'TC-15-04: Mermaid ER diagram parsed with relational entities and cardinality relationships'
    );

    // --- TC-15-05: Mermaid State diagram parsing ---
    const mmdState = `stateDiagram-v2
      [*] --> Draft
      Draft --> UnderReview : submit
      UnderReview --> Approved : pass
      Approved --> [*]`;
    const stateParse = bfovMermaidService.parse(mmdState);
    assert(
      stateParse.isValid &&
      stateParse.diagramType === 'FLOWCHART' &&
      stateParse.nodeCount >= 3 &&
      stateParse.edgeCount === 4,
      'TC-15-05: Mermaid State diagram parsed with state nodes and transition edges'
    );

    // --- TC-15-06: Graceful error handling on invalid Mermaid syntax ---
    const invalidMmd = `unknownDiagramType XYZ
      Random unparseable junk`;
    const errParse = bfovMermaidService.parse(invalidMmd);
    assert(
      !errParse.isValid &&
      errParse.errors &&
      errParse.errors[0].line === 1 &&
      errParse.errors[0].message.includes('Unsupported or unknown diagram type'),
      'TC-15-06: Graceful error reporting identifies invalid diagram header with exact line number'
    );

    // --- TC-15-07: Import Mermaid directly to database ---
    const importedDiag = await bfovDiagramService.createDiagram(tenantA.id, userA?.id, {
      title: `Imported Production Pipeline (${runId})`,
      diagramType: flowParse.diagramType,
      category: 'Process',
      graphData: flowParse.graphData,
      metadata: { source: 'MERMAID_IMPORT' }
    });
    assert(
      importedDiag.id &&
      importedDiag.nodeCount === 6 &&
      importedDiag.edgeCount === 6,
      'TC-15-07: Import Mermaid code directly creates operational persistent diagram record'
    );

    // --- TC-15-08: AI Provider Status ---
    const aiStatus = await bfovAiService.getAiProviderStatus();
    assert(
      aiStatus.status === 'READY' &&
      ['NATIVE_SYNTHESIS', 'OLLAMA', 'GEMINI'].includes(aiStatus.activeEngine),
      `TC-15-08: AI status query reports ready status with active synthesis engine (${aiStatus.activeEngine})`
    );

    // --- TC-15-09: AI Text-to-Diagram Generation ---
    const aiGen = await bfovAiService.generateDiagramFromText({
      tenantId: tenantA.id,
      userId: userA?.id,
      prompt: 'Design a high availability microservices architecture with cloud gateway, firewall, auth service, and MySQL database cluster',
      diagramType: 'NETWORK'
    });
    assert(
      aiGen.success === true &&
      aiGen.previewGraph.nodes.length >= 3 &&
      aiGen.previewGraph.edges.length >= 2,
      'TC-15-09: AI text-to-diagram synthesizes structured, valid network topology from natural language'
    );

    // --- TC-15-10: AI-Assisted Editing ---
    const aiEdit = await bfovAiService.editDiagramWithAi({
      tenantId: tenantA.id,
      userId: userA?.id,
      diagramId: importedDiag.id,
      currentGraphData: importedDiag.graphData,
      editInstruction: 'Add a validation decision check: Verify compliance certificate before release'
    });
    assert(
      aiEdit.success === true &&
      aiEdit.previewGraph.nodes.length > importedDiag.nodeCount,
      'TC-15-10: AI-assisted editing applies incremental step modification and returns preview delta'
    );

    // --- TC-15-11: Multi-format SVG Export ---
    const svgOutput = bfovExportService.exportToSvg(importedDiag);
    assert(
      svgOutput.startsWith('<?xml version="1.0" encoding="UTF-8"?>') &&
      svgOutput.includes('<svg xmlns="http://www.w3.org/2000/svg"') &&
      svgOutput.includes('<marker id="arrow"') &&
      svgOutput.includes('</svg>'),
      'TC-15-11: Multi-format SVG export outputs valid, standalone SVG XML with defs, markers, and shapes'
    );

    // --- TC-15-12: Multi-format JSON Export ---
    const jsonOutput = bfovExportService.exportToJson(importedDiag);
    assert(
      jsonOutput.schemaVersion === '1.0' &&
      jsonOutput.diagram.title === importedDiag.title &&
      jsonOutput.diagram.graphData.nodes.length === 6,
      'TC-15-12: Multi-format JSON export generates RFC-compliant structured backup with metadata'
    );

    // --- TC-15-13: Multi-format PDF Export ---
    const pdfBuffer = bfovExportService.exportToPdf(importedDiag);
    assert(
      Buffer.isBuffer(pdfBuffer) &&
      pdfBuffer.toString('utf8', 0, 8).startsWith('%PDF-1.4'),
      'TC-15-13: Multi-format PDF export generates valid PDF 1.4 vector document stream'
    );

    // --- TC-15-14: Safe JSON Import ---
    const importVal = bfovExportService.validateImportJson(JSON.stringify(jsonOutput));
    assert(
      importVal.isValid === true &&
      importVal.diagram.title === importedDiag.title &&
      importVal.diagram.graphData.nodes.length === 6,
      'TC-15-14: Safe JSON import validates schema integrity, sanitizes content, and verifies nodes'
    );

    // --- TC-15-15: Diagram Sharing & Access Control ---
    const share = await bfovCollaborationService.shareDiagram(tenantA.id, importedDiag.id, {
      sharedWithEmail: `collaborator_${runId}@tenant.com`,
      role: 'EDITOR'
    });
    const sharesList = await bfovCollaborationService.listShares(tenantA.id, importedDiag.id);
    assert(
      share.id && sharesList.length >= 1 && sharesList[0].role === 'EDITOR',
      'TC-15-15: Diagram sharing assigns granular EDITOR role to authorized collaborator'
    );

    // --- TC-15-16: Contextual Comments & Resolution ---
    const comment = await bfovCollaborationService.addComment(tenantA.id, userA.id, importedDiag.id, {
      content: 'Please verify the rollback retry loop timeout in the flowchart.'
    });
    const resolvedComment = await bfovCollaborationService.resolveComment(tenantA.id, comment.id, true);
    assert(
      comment.id && resolvedComment.isResolved === true,
      'TC-15-16: Contextual comments discussion thread records feedback and tracks resolution lifecycle'
    );

    // --- TC-15-17: Custom Template Registry ---
    const customTemplate = await bfovCollaborationService.saveAsTemplate(tenantA.id, userA.id, importedDiag.id, {
      templateKey: `custom-blueprint-${runId}`,
      title: 'Custom Quality Process Blueprint',
      category: 'Process'
    });
    assert(
      customTemplate.id && customTemplate.isSystem === false,
      'TC-15-17: Save diagram as reusable blueprint template registers custom template in catalog'
    );

    console.log('\n================================================================');
    console.log(`TEST SUITE RESULTS: ${passCount} PASSED | ${failCount} FAILED`);
    console.log('================================================================\n');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMaster15TestSuite();

