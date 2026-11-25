const prisma = require('../config/prisma');

/**
 * EgoLytics R&D Management Platform — Foundation Controller
 * Master Prompt 01: Foundation, Architecture & Existing Module Adaptation
 */
class RdController {
  /**
   * GET /api/rd/status
   * Returns live tenant R&D status, architectural boundaries, and foundation telemetry.
   */
  async getStatus(req, res, next) {
    try {
      const tenantId = req.user.tenantId;

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          domain: true,
          subscription: true,
          status: true,
          createdAt: true,
        },
      });

      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant workspace not found.',
        });
      }

      // Live metrics for R&D foundation rollups
      const [userCount, taskCount, projectCount] = await Promise.all([
        prisma.user.count({ where: { tenantId } }),
        prisma.task.count({ where: { tenantId } }),
        prisma.erpProject.count({ where: { tenantId } }),
      ]);

      return res.status(200).json({
        success: true,
        message: 'EgoLytics R&D Foundation operational.',
        data: {
          platform: 'EgoLytics – R&D Management Tool',
          division: 'Research & Development Division of CRM nErgy AI',
          foundationVersion: '1.0.0',
          executionPrompt: 'Master Prompt 10 of 16',
          status: 'ACTIVE_RESOURCE_CAPACITY_LAB_MANAGEMENT',
          activeFeatures: {
            'mod-01-foundation': 'ACTIVE',
            'mod-02-portfolio': 'ACTIVE',
            'mod-03-ideas': 'ACTIVE',
            'mod-04-stagegate': 'ACTIVE',
            'mod-05-tasks': 'ACTIVE',
            'mod-06-scheduling': 'ACTIVE',
            'mod-07-experiments': 'ACTIVE',
            'mod-08-labnotebook': 'ACTIVE',
            'mod-09-governance': 'ACTIVE',
            'mod-10-resources': 'ACTIVE',
          },
          tenant: {
            ...tenant,
            metrics: {
              activeUsers: userCount,
              activeTasks: taskCount,
              activeProjects: projectCount,
            },
          },
          session: {
            userId: req.user.userId,
            email: req.user.email,
            role: req.user.role,
          },
          boundaries: {
            crmCore: 'ACTIVE (Leads, Contacts, Pipeline, Tasks)',
            erpOperations: 'ACTIVE (Projects, Orders, Inventory, Ledger)',
            rdFoundation: 'ACTIVE (Workspace, Navigation, RBAC & Multi-Tenant Scoping)',
            maplyticsGis: 'ACTIVE (Master Prompt 13 - Complete GIS Territory Management & 7 Search Engine)',
            bfovCharts: 'ACTIVE (Master Prompt 14 & 15 - Core & Advanced Diagramming Engine)',
            enterpriseQa: 'ACTIVE (Master Prompt 16 - IP, Compliance, Enterprise Audit, Scoped API Keys & QA)',
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rd/modules
   * Returns registered R&D module catalog across the 16 Master Prompts with requirement mappings.
   */
  async getModules(req, res, next) {
    try {
      const modules = [
        {
          id: 'mod-01-foundation',
          prompt: 'Master Prompt 01',
          name: 'Foundation & Existing Module Adaptation',
          category: 'Architecture',
          status: 'ACTIVE',
          clientRequirements: ['AC-01 through AC-16', 'Foundation for Features 1-100'],
          description: 'Multi-tenant isolation, RBAC namespaces, workspace routing, and architecture boundaries.',
        },
        {
          id: 'mod-02-portfolio-intake',
          prompt: 'Master Prompt 02',
          name: 'R&D Project Portfolio & Project Intake Management',
          category: 'Portfolio & Intake',
          status: 'ACTIVE',
          clientRequirements: [
            'Req 1 (Project portfolio management)',
            'Req 2 (Project intake and application workflows)',
            'Req 5 (Strategic alignment tracking)',
            'Req 6 (Project prioritization)',
          ],
          description:
            'Portfolio tracking, multi-project status rollups, formal proposal intake with screening and conversion to projects, strategic alignment tracking, and algorithmic multi-factor prioritization.',
        },
        {
          id: 'mod-03-ideation',
          prompt: 'Master Prompt 03',
          name: 'Idea Capture & Innovation Scoring Engine',
          category: 'Ideation',
          status: 'ACTIVE',
          clientRequirements: [
            'Req 3 (Idea capture)',
            'Req 4 (Idea evaluation & scoring)',
            'Req 61 (Idea management)',
            'Req 62 (Innovation pipeline)',
          ],
          description:
            'Quick-capture ideation portal, community voting with 1-vote duplicate prevention, threaded comments, configurable multi-criteria rubrics, directional scoring, evaluator assignment, and ranked leaderboard.',
        },
        {
          id: 'mod-04-stagegate',
          prompt: 'Master Prompt 04',
          name: 'Stage-Gate Governance & Decision Checkpoints',
          category: 'Governance',
          status: 'ACTIVE',
          clientRequirements: ['Req 7 (Stage-gate workflows)', 'Req 8 (Decision checkpoints)', 'Req 31 (Decision logs)'],
          description: 'Formal phase-gate state machine with gatekeeper sign-offs, criteria verification, and auditable decision logs.',
        },
        {
          id: 'mod-05-tasks',
          prompt: 'Master Prompt 05',
          name: 'Advanced Task, Sprint & Backlog Management',
          category: 'Execution & Scheduling',
          status: 'ACTIVE',
          clientRequirements: [
            'Req 11 (Task management)',
            'Req 12 (Kanban boards)',
            'Req 13 (Gantt charts)',
            'Req 14 (Timeline views)',
            'Req 15 (Sprint planning)',
            'Req 16 (Backlog management)',
            'Req 17 (Task dependencies)',
            'Req 18 (Critical-path analysis)',
            'Req 19 (Schedule tracking)',
            'Req 20 (Schedule variance alerts)',
          ],
          description:
            'Operational R&D task assignments, drag-and-drop Kanban boards, sprint lifecycle with velocity tracking, prioritized backlog ordering, predecessor-successor dependencies with cycle detection, mathematical Critical Path Method (CPM), schedule baselines, and variance alerts.',
        },
        {
          id: 'mod-06-scheduling',
          prompt: 'Master Prompt 06',
          name: 'Gantt, Timeline, Dependencies & Critical Path Engine',
          category: 'Scheduling & Visualization',
          status: 'ACTIVE',
          clientRequirements: [
            'Req 9 (Project roadmaps)',
            'Req 10 (Milestone planning)',
            'Req 13 (Gantt charts)',
            'Req 14 (Timeline views)',
            'Req 17 (Task dependencies - Reused)',
            'Req 18 (Critical-path analysis - Reused)',
            'Req 19 (Schedule tracking - Reused)',
            'Req 20 (Schedule variance alerts - Reused)',
          ],
          description:
            'Interactive Gantt charts with multi-timescale canvas, drag-and-drop date rescheduling, SVG dependency connectors, critical path highlighting, dynamic database-backed milestones, project roadmaps, and chronological timeline views.',
        },
        {
          id: 'mod-07-experiments',
          prompt: 'Master Prompt 07',
          name: 'Research Hypotheses & Experiment Studio',
          category: 'Scientific Research',
          status: 'ACTIVE',
          clientRequirements: [
            'Req 25 (Evidence and outcomes tracking)',
            'Req 26 (Research objective tracking)',
            'Req 27 (Hypothesis tracking)',
            'Req 28 (Experiment planning)',
            'Req 29 (Experiment status tracking)',
            'Req 30 (Research documentation)',
            'Req 63 (Experiment documentation)',
          ],
          description:
            'Structured scientific research objectives, hypothesis formulation and evaluation, independent/dependent/controlled variables, versioned protocols, multi-run experiment execution, observations, measurements, results comparison, and evidence tracking.',
        },
        {
          id: 'mod-08-labnotebook',
          prompt: 'Master Prompt 08',
          name: 'Electronic Lab Notebook (ELN) & Research Documentation',
          category: 'Scientific Research',
          status: 'ACTIVE',
          clientRequirements: [
            'Req 30 (Research documentation)',
            'Req 42 (Document management)',
            'Req 63 (Experiment documentation)',
            'Req 94 (Internal document version control)',
          ],
          description:
            'Electronic Lab Notebook (ELN), project notebooks, rich-text entries with revision history, centralized document management, dataset registry, multi-file attachments, internal version history, document restoration, and research knowledge repository.',
        },
        {
          id: 'mod-09-governance',
          prompt: 'Master Prompt 09',
          name: 'Decision, Risk, Issue & Financial Management',
          category: 'Governance & Financials',
          status: 'ACTIVE',
          clientRequirements: [
            'Req 31 (Decision logs)',
            'Req 32 (Risk registers)',
            'Req 33 (Risk scoring)',
            'Req 34 (Issue tracking)',
            'Req 35 (Change management)',
            'Req 36 (Requirements management)',
            'Req 37 (Scope tracking)',
            'Req 38 (Deliverable tracking)',
            'Req 39 (Quality checkpoints)',
            'Req 40 (Budget planning)',
          ],
          description:
            'Enterprise R&D decision registries, proactive risk registers with automatic scoring and interactive 5x5 matrix, full issue lifecycle with root cause tracking, formal change requests with cost/schedule/scope impact assessments, requirements with acceptance criteria and traceability matrix, scope baselines with hierarchical WBS tree, deliverable acceptance workflow bound to research documents, quality checkpoints with criteria checklists and automated issue creation, and project budget planning with category allocations, revisions, and utilization warnings.',
        },
        {
          id: 'mod-10-resources',
          prompt: 'Master Prompt 10',
          name: 'Resource, Capacity, Time & Lab Facility Management',
          category: 'Operations & Facilities',
          status: 'ACTIVE',
          clientRequirements: [
            'Req 51 (Resource allocation tracking)',
            'Req 52 (Employee skill matrix and expertise mapping)',
            'Req 53 (Team capacity planning and workload distribution)',
            'Req 54 (Time tracking and timesheet management)',
            'Req 55 (Resource cost calculation and rate cards)',
            'Req 56 (Personnel budget integration)',
            'Req 57 (Resource cost variance analysis)',
            'Req 58 (Resource utilization metrics and reporting)',
            'Req 59 (Shared laboratory facilities and equipment booking)',
            'Req 60 (Facility and equipment scheduling conflict prevention)',
          ],
          description:
            'Comprehensive R&D resource profiles, multi-project percentage allocations with workload tracking, interactive 2D skill matrix with expertise levels and skill discovery, team capacity planning with over-allocation alerts, weekly timesheets with project/task/experiment time entries and manager approval workflows, labor cost integration with MP09 project budgets, actual vs planned utilization analytics, shared lab facilities, equipment registry with maintenance/calibration tracking, and scheduling conflict prevention.',
        },
        {
          id: 'mod-11-collaboration',
          prompt: 'Master Prompt 11',
          name: 'Collaboration, Communication & External Integrations',
          category: 'Collaboration',
          status: 'ACTIVE',
          clientRequirements: ['Project discussion spaces', 'Direct/Group messaging', 'Contextual commenting', 'Centralized notification center', 'Shared R&D calendars', 'External integrations'],
          description: 'Real-time project discussions, direct/group messaging channels, deep contextual commenting, notification hub, team calendars, and third-party webhooks/integrations.',
        },
        {
          id: 'mod-12-analytics-engine',
          prompt: 'Master Prompt 12',
          name: 'R&D Dashboard, Reporting & Analytics Engine',
          category: 'Analytics & Reporting',
          status: 'ACTIVE',
          clientRequirements: ['Executive R&D Dashboard', 'Operational Dashboards', 'Pre-configured Reports', 'Custom Report Builder', 'KPI Tracking', 'Visual Analytics'],
          description: 'Live executive portfolio dashboards, KPI telemetry, exportable tabular & graphical reports, custom report builder, and real-time project health benchmarks.',
        },
        {
          id: 'mod-13-maplytics-core',
          prompt: 'Master Prompt 13',
          name: 'Maplytics GIS & Spatial Engine',
          category: 'Territory Management',
          status: 'ACTIVE',
          clientRequirements: ['Section 4 (Maplytics GIS)', 'Search 3 (Region)', 'Search 5 (Territory)'],
          description: 'Interactive Leaflet/Mapbox engine replacing mock SVG with true geospatial boundary layers.',
        },
        {
          id: 'mod-13-maplytics-advanced',
          prompt: 'Master Prompt 13',
          name: 'Territory 7-Search & Realignment',
          category: 'Territory Management',
          status: 'ACTIVE',
          clientRequirements: ['Search 1 (File)', 'Search 2 (Proximity)', 'Search 4 (Drawing)', 'Search 6 (Overlay)', 'Search 7 (ArcGIS)'],
          description: 'Shapefile ingestion, radial proximity, polygon drawing, draft territory staging, and realignment.',
        },
        {
          id: 'mod-11-bfov-core',
          prompt: 'Master Prompt 14',
          name: 'BFOV Charts Core Canvas Engine',
          category: 'Diagramming',
          status: 'ACTIVE',
          clientRequirements: ['Section 5 (BFOV Charts 1-15)', 'Flowcharts', 'UML', 'ERD', 'Network diagrams'],
          description: 'Interactive visual canvas, drag-and-drop shape library, auto-routing orthogonal connectors, and persistent JSON graph storage.',
        },
        {
          id: 'mod-12-bfov-advanced',
          prompt: 'Master Prompt 15',
          name: 'BFOV Mermaid, AI & Cloud Sync',
          category: 'Diagramming',
          status: 'ACTIVE',
          clientRequirements: ['Section 5 (BFOV 16-20)', 'Mermaid import', 'AI text-to-diagram', 'Export/Sharing'],
          description: 'Mermaid code block parser, Gemini/Ollama AI diagram prompt generation, AI-assisted editing, version diffs, and SVG/PDF/JSON export.',
        },
        {
          id: 'mod-14-ip-patents',
          prompt: 'Master Prompt 16',
          name: 'Patent Tracking & Intellectual Property',
          category: 'IP & Legal',
          status: 'ACTIVE',
          clientRequirements: ['Req 68 (Patent tracking)', 'Req 69 (IP management)', 'Req 64 (Prototypes)'],
          description: 'Patent filing register, claims documentation, renewal reminders, and trademark catalog.',
        },
        {
          id: 'mod-15-compliance',
          prompt: 'Master Prompt 16',
          name: 'Regulatory Compliance & SOP Management',
          category: 'Compliance',
          status: 'ACTIVE',
          clientRequirements: ['Req 71 (Compliance)', 'Req 72 (Regulatory docs)', 'Req 75 (SOPs)', 'Req 77 (Safety)'],
          description: 'Standard Operating Procedure repository, lab safety logs, and quality inspection checklists.',
        },
        {
          id: 'mod-16-analytics',
          prompt: 'Master Prompt 16',
          name: 'Executive R&D Analytics & Final Hardening',
          category: 'Analytics',
          status: 'ACTIVE',
          clientRequirements: ['Req 21-23 (Dashboards)', 'Req 91-100 (API, i18n, Exports)', 'Final Certification'],
          description: 'Executive R&D burn-rate telemetry, cycle-time benchmarks, and final platform certification.',
        },
      ];

      return res.status(200).json({
        success: true,
        count: modules.length,
        data: modules,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/rd/permissions
   * Returns standardized R&D permission namespaces.
   */
  async getPermissions(req, res, next) {
    try {
      const permissions = [
        { id: 'rd.workspace.access', name: 'Access R&D Workspace', description: 'View EgoLytics R&D workspace hub' },
        { id: 'rd.dashboard.view', name: 'View R&D Dashboard', description: 'View research telemetry and project status' },
        { id: 'rd.projects.view', name: 'View R&D Projects', description: 'Browse R&D portfolio and project details' },
        { id: 'rd.projects.manage', name: 'Manage R&D Projects', description: 'Create, update, and manage R&D projects' },
        { id: 'rd.tasks.manage', name: 'Manage R&D Tasks', description: 'Schedule tasks, milestones, and assign researchers' },
        { id: 'rd.ideas.manage', name: 'Manage Innovation & Ideas', description: 'Submit, score, and prioritize ideas' },
        { id: 'rd.experiments.manage', name: 'Manage Experiments', description: 'Design protocols and log experiment runs' },
        { id: 'rd.decisions.manage', name: 'Manage Decisions & Gates', description: 'Execute stage-gate sign-offs and decision logs' },
        { id: 'rd.reports.view', name: 'View R&D Reports', description: 'Export research audits and executive reports' },
        { id: 'rd.compliance.manage', name: 'Manage R&D Compliance', description: 'Manage SOPs, safety logs, and regulatory files' },
        { id: 'rd.maplytics.view', name: 'Access Maplytics GIS', description: 'View and align spatial territories' },
        { id: 'rd.bfov.manage', name: 'Manage BFOV Diagrams', description: 'Create and edit architecture diagrams and charts' },
        { id: 'rd.ip.manage', name: 'Manage Intellectual Property', description: 'Register and track patents, trademarks, and trade secrets' },
        { id: 'rd.audit.view', name: 'View Enterprise Audit Trail', description: 'Inspect immutable governance activity and security logs' },
        { id: 'rd.apikeys.manage', name: 'Manage Enterprise API Keys', description: 'Generate and revoke scoped external integration keys' },
        { id: 'rd.export.universal', name: 'Universal Data Export', description: 'Export platform entities to CSV, JSON, and PDF reports' },
      ];

      return res.status(200).json({
        success: true,
        count: permissions.length,
        data: permissions,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/rd/verify-tenant
   * Security & multi-tenant verification endpoint.
   * Confirms client session matches server tenant without vulnerability to parameter tampering.
   */
  async verifyTenantBoundary(req, res, next) {
    try {
      const sessionTenantId = req.user.tenantId;
      const claimedTenantId = req.body.claimedTenantId || sessionTenantId;

      if (claimedTenantId !== sessionTenantId) {
        return res.status(403).json({
          success: false,
          verified: false,
          message: 'Security Violation: Claimed tenant does not match verified server session.',
          sessionTenantId,
          claimedTenantId,
        });
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: sessionTenantId },
        select: { id: true, name: true, domain: true },
      });

      return res.status(200).json({
        success: true,
        verified: true,
        message: 'Tenant boundary verified strictly by server-side JWT context.',
        data: {
          tenantId: sessionTenantId,
          tenantName: tenant?.name || 'Unknown Tenant',
          isolationEnforced: true,
          authorizedUserId: req.user.userId,
          userRole: req.user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RdController();
