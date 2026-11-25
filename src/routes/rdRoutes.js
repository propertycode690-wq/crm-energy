const express = require('express');
const router = express.Router();
const rdController = require('../controllers/rdController');
const rdPortfolioController = require('../controllers/rdPortfolioController');
const rdIntakeController = require('../controllers/rdIntakeController');
const rdStrategyController = require('../controllers/rdStrategyController');
const rdPrioritizationController = require('../controllers/rdPrioritizationController');
const rdIdeaController = require('../controllers/rdIdeaController');
const rdScoringController = require('../controllers/rdScoringController');
const rdGovernanceController = require('../controllers/rdGovernanceController');
const rdTaskController = require('../controllers/rdTaskController');
const rdCollaborationController = require('../controllers/rdCollaborationController');
const rdCalendarController = require('../controllers/rdCalendarController');
const rdIntegrationController = require('../controllers/rdIntegrationController');
const rdAnalyticsController = require('../controllers/rdAnalyticsController');
const rdEnterpriseRoutes = require('./rdEnterpriseRoutes');
const rdMilestoneController = require('../controllers/rdMilestoneController');
const rdGanttController = require('../controllers/rdGanttController');
const rdResearchController = require('../controllers/rdResearchController');
const rdElnController = require('../controllers/rdElnController');
const rdGovernanceOpsController = require('../controllers/rdGovernanceOpsController');
const rdResourceController = require('../controllers/rdResourceController');
const { authenticateToken } = require('../middleware/auth');
const { validateTenantScope } = require('../middleware/tenantIsolation');

// All EgoLytics R&D endpoints require verified JWT session and strict tenant scoping
router.use(authenticateToken);
router.use(validateTenantScope);

// ==============================================================================
// MASTER PROMPT 01: FOUNDATION & SYSTEM TELEMETRY
// ==============================================================================
router.get('/status', (req, res, next) => rdController.getStatus(req, res, next));
router.get('/modules', (req, res, next) => rdController.getModules(req, res, next));
router.get('/permissions', (req, res, next) => rdController.getPermissions(req, res, next));
router.post('/verify-tenant', (req, res, next) => rdController.verifyTenantBoundary(req, res, next));

// ==============================================================================
// MASTER PROMPT 02: R&D PROJECT PORTFOLIO MANAGEMENT (REQUIREMENT 1)
// ==============================================================================
router.get('/portfolio', (req, res, next) => rdPortfolioController.getPortfolio(req, res, next));
router.get('/portfolio/projects', (req, res, next) => rdPortfolioController.getProjectsList(req, res, next));
router.post('/portfolio', (req, res, next) => rdPortfolioController.createProject(req, res, next));
router.get('/portfolio/:id', (req, res, next) => rdPortfolioController.getProjectById(req, res, next));
router.put('/portfolio/:id', (req, res, next) => rdPortfolioController.updateProject(req, res, next));

// ==============================================================================
// MASTER PROMPT 02: PROJECT INTAKE & APPLICATION WORKFLOWS (REQUIREMENT 2)
// ==============================================================================
router.get('/intake', (req, res, next) => rdIntakeController.getProposals(req, res, next));
router.post('/intake', (req, res, next) => rdIntakeController.createProposal(req, res, next));
router.get('/intake/:id', (req, res, next) => rdIntakeController.getProposalById(req, res, next));
router.put('/intake/:id', (req, res, next) => rdIntakeController.updateProposal(req, res, next));
router.post('/intake/:id/submit', (req, res, next) => rdIntakeController.submitProposal(req, res, next));
router.post('/intake/:id/review', (req, res, next) => rdIntakeController.reviewProposal(req, res, next));
router.post('/intake/:id/approve', (req, res, next) => rdIntakeController.approveProposal(req, res, next));
router.post('/intake/:id/reject', (req, res, next) => rdIntakeController.rejectProposal(req, res, next));
router.post('/intake/:id/withdraw', (req, res, next) => rdIntakeController.withdrawProposal(req, res, next));

// ==============================================================================
// MASTER PROMPT 02: STRATEGIC ALIGNMENT TRACKING (REQUIREMENT 5)
// ==============================================================================
router.get('/strategy/goals', (req, res, next) => rdStrategyController.getGoals(req, res, next));
router.post('/strategy/goals', (req, res, next) => rdStrategyController.createGoal(req, res, next));
router.get('/strategy/goals/:id', (req, res, next) => rdStrategyController.getGoalById(req, res, next));
router.put('/strategy/goals/:id', (req, res, next) => rdStrategyController.updateGoal(req, res, next));
router.delete('/strategy/goals/:id', (req, res, next) => rdStrategyController.deleteGoal(req, res, next));
router.post('/strategy/align', (req, res, next) => rdStrategyController.alignProject(req, res, next));
router.delete('/strategy/align/:id', (req, res, next) => rdStrategyController.removeAlignment(req, res, next));
router.get('/strategy/matrix', (req, res, next) => rdStrategyController.getStrategyMatrix(req, res, next));

// ==============================================================================
// MASTER PROMPT 02: PROJECT PRIORITIZATION (REQUIREMENT 6)
// ==============================================================================
router.get('/prioritization', (req, res, next) => rdPrioritizationController.getPrioritizedProjects(req, res, next));
router.put('/prioritization/:id', (req, res, next) => rdPrioritizationController.updatePrioritization(req, res, next));
router.post('/prioritization/recalculate', (req, res, next) => rdPrioritizationController.recalculateAll(req, res, next));

// ==============================================================================
// MASTER PROMPT 03: IDEA MANAGEMENT & INNOVATION SCORING ENGINE (REQS 3, 4, 61, 62)
// ==============================================================================
// Dashboard & Pipeline Funnel
router.get('/ideas/metrics', (req, res, next) => rdIdeaController.getDashboardMetrics(req, res, next));
router.get('/ideas/pipeline', (req, res, next) => rdIdeaController.getPipeline(req, res, next));
router.get('/ideas/leaderboard', (req, res, next) => rdScoringController.getLeaderboard(req, res, next));

// Categories & Tags
router.get('/ideas/categories', (req, res, next) => rdIdeaController.getCategories(req, res, next));
router.post('/ideas/categories', (req, res, next) => rdIdeaController.createCategory(req, res, next));
router.put('/ideas/categories/:id', (req, res, next) => rdIdeaController.updateCategory(req, res, next));
router.delete('/ideas/categories/:id', (req, res, next) => rdIdeaController.deleteCategory(req, res, next));
router.get('/ideas/tags', (req, res, next) => rdIdeaController.getTags(req, res, next));

// Rubrics
router.get('/ideas/rubrics/active', (req, res, next) => rdScoringController.getActiveRubric(req, res, next));
router.get('/ideas/rubrics', (req, res, next) => rdScoringController.getRubrics(req, res, next));
router.post('/ideas/rubrics', (req, res, next) => rdScoringController.configureRubric(req, res, next));

// Core Ideas CRUD & Lifecycle
router.get('/ideas', (req, res, next) => rdIdeaController.getIdeas(req, res, next));
router.post('/ideas', (req, res, next) => rdIdeaController.createIdea(req, res, next));
router.get('/ideas/:id', (req, res, next) => rdIdeaController.getIdeaById(req, res, next));
router.put('/ideas/:id', (req, res, next) => rdIdeaController.updateIdea(req, res, next));
router.patch('/ideas/:id', (req, res, next) => rdIdeaController.updateIdea(req, res, next));
router.post('/ideas/:id/submit', (req, res, next) => rdIdeaController.submitIdea(req, res, next));
router.post('/ideas/:id/status', (req, res, next) => rdIdeaController.updateIdeaStatus(req, res, next));
router.patch('/ideas/:id/status', (req, res, next) => rdIdeaController.updateIdeaStatus(req, res, next));
router.put('/ideas/:id/status', (req, res, next) => rdIdeaController.updateIdeaStatus(req, res, next));

// Voting
router.post('/ideas/:id/vote', (req, res, next) => rdIdeaController.voteIdea(req, res, next));
router.delete('/ideas/:id/vote', (req, res, next) => rdIdeaController.unvoteIdea(req, res, next));

// Comments
router.get('/ideas/:id/comments', (req, res, next) => rdIdeaController.getComments(req, res, next));
router.post('/ideas/:id/comments', (req, res, next) => rdIdeaController.addComment(req, res, next));
router.delete('/ideas/comments/:commentId', (req, res, next) => rdIdeaController.deleteComment(req, res, next));

// Reviewer Assignments
router.get('/ideas/:id/reviewers', (req, res, next) => rdIdeaController.getIdeaReviewers(req, res, next));
router.post('/ideas/:id/reviewers', (req, res, next) => rdIdeaController.assignReviewer(req, res, next));
router.delete('/ideas/:id/reviewers/:reviewerId', (req, res, next) => rdIdeaController.removeReviewer(req, res, next));

// Evaluation Submission
router.get('/ideas/:id/evaluation', (req, res, next) => rdScoringController.getEvaluation(req, res, next));
router.post('/ideas/:id/evaluation', (req, res, next) => rdScoringController.submitEvaluation(req, res, next));

// ==============================================================================
// MASTER PROMPT 04: STAGE-GATE GOVERNANCE & APPROVAL WORKFLOW
// ==============================================================================
// Templates
router.get('/governance/templates', (req, res, next) => rdGovernanceController.getTemplates(req, res, next));
router.post('/governance/templates', (req, res, next) => rdGovernanceController.createTemplate(req, res, next));
router.get('/governance/templates/:id', (req, res, next) => rdGovernanceController.getTemplateById(req, res, next));

// Dashboard & Inbox
router.get('/governance/dashboard', (req, res, next) => rdGovernanceController.getDashboardMetrics(req, res, next));
router.get('/governance/inbox', (req, res, next) => rdGovernanceController.getReviewerInbox(req, res, next));

// Project Governance
router.get('/governance/projects', (req, res, next) => rdGovernanceController.getGovernedProjects(req, res, next));
router.post('/governance/projects/:projectId/initialize', (req, res, next) => rdGovernanceController.initializeProjectGovernance(req, res, next));
router.get('/governance/projects/:projectId', (req, res, next) => rdGovernanceController.getProjectGovernance(req, res, next));
router.post('/governance/projects/:projectId/resume', (req, res, next) => rdGovernanceController.resumeHeldGovernance(req, res, next));

// Gate Reviews & Decision Engine
router.post('/governance/reviews/:reviewId/submit', (req, res, next) => rdGovernanceController.submitGateReview(req, res, next));
router.post('/governance/reviews/:reviewId/reviewers', (req, res, next) => rdGovernanceController.assignReviewers(req, res, next));
router.post('/governance/reviews/:reviewId/sign-off', (req, res, next) => rdGovernanceController.submitSignOff(req, res, next));
router.post('/governance/reviews/:reviewId/evidence', (req, res, next) => rdGovernanceController.uploadEvidence(req, res, next));
router.post('/governance/reviews/:reviewId/decision', (req, res, next) => rdGovernanceController.recordGateDecision(req, res, next));

// ==============================================================================
// MASTER PROMPT 05: ADVANCED TASK, SPRINT & BACKLOG MANAGEMENT
// ==============================================================================

// R&D Tasks & Kanban Lifecycle (Req 11, 12)
router.get('/tasks', (req, res, next) => rdTaskController.getTasks(req, res, next));
router.post('/tasks', (req, res, next) => rdTaskController.createTask(req, res, next));
router.get('/tasks/:id', (req, res, next) => rdTaskController.getTaskById(req, res, next));
router.put('/tasks/:id', (req, res, next) => rdTaskController.updateTask(req, res, next));
router.patch('/tasks/:id/status', (req, res, next) => rdTaskController.updateTaskStatus(req, res, next));
router.delete('/tasks/:id', (req, res, next) => rdTaskController.deleteTask(req, res, next));

// Also mount under /governance/tasks for nested clients
router.get('/governance/tasks', (req, res, next) => rdTaskController.getTasks(req, res, next));
router.post('/governance/tasks', (req, res, next) => rdTaskController.createTask(req, res, next));
router.get('/governance/tasks/:id', (req, res, next) => rdTaskController.getTaskById(req, res, next));
router.put('/governance/tasks/:id', (req, res, next) => rdTaskController.updateTask(req, res, next));
router.patch('/governance/tasks/:id/status', (req, res, next) => rdTaskController.updateTaskStatus(req, res, next));
router.delete('/governance/tasks/:id', (req, res, next) => rdTaskController.deleteTask(req, res, next));

// Sprint Planning & Execution (Req 15)
router.get('/sprints', (req, res, next) => rdTaskController.getSprints(req, res, next));
router.post('/sprints', (req, res, next) => rdTaskController.createSprint(req, res, next));
router.put('/sprints/:id', (req, res, next) => rdTaskController.updateSprint(req, res, next));
router.post('/sprints/:id/start', (req, res, next) => rdTaskController.startSprint(req, res, next));
router.post('/sprints/:id/complete', (req, res, next) => rdTaskController.completeSprint(req, res, next));

router.get('/governance/sprints', (req, res, next) => rdTaskController.getSprints(req, res, next));
router.post('/governance/sprints', (req, res, next) => rdTaskController.createSprint(req, res, next));
router.put('/governance/sprints/:id', (req, res, next) => rdTaskController.updateSprint(req, res, next));
router.post('/governance/sprints/:id/start', (req, res, next) => rdTaskController.startSprint(req, res, next));
router.post('/governance/sprints/:id/complete', (req, res, next) => rdTaskController.completeSprint(req, res, next));

// Backlog Management (Req 16)
router.get('/backlog', (req, res, next) => rdTaskController.getBacklog(req, res, next));
router.post('/backlog/reorder', (req, res, next) => rdTaskController.reorderBacklog(req, res, next));
router.post('/backlog/commit', (req, res, next) => rdTaskController.commitBacklogToSprint(req, res, next));

router.get('/governance/backlog', (req, res, next) => rdTaskController.getBacklog(req, res, next));
router.post('/governance/backlog/reorder', (req, res, next) => rdTaskController.reorderBacklog(req, res, next));
router.post('/governance/backlog/commit', (req, res, next) => rdTaskController.commitBacklogToSprint(req, res, next));

// Task Dependencies & Graph (Req 17)
router.get('/dependencies', (req, res, next) => rdTaskController.getDependencies(req, res, next));
router.post('/dependencies', (req, res, next) => rdTaskController.addDependency(req, res, next));
router.delete('/dependencies/:id', (req, res, next) => rdTaskController.deleteDependency(req, res, next));

router.get('/governance/dependencies', (req, res, next) => rdTaskController.getDependencies(req, res, next));
router.post('/governance/dependencies', (req, res, next) => rdTaskController.addDependency(req, res, next));
router.delete('/governance/dependencies/:id', (req, res, next) => rdTaskController.deleteDependency(req, res, next));

// Critical Path Method (CPM) (Req 18)
router.get('/cpm/:projectId', (req, res, next) => rdTaskController.calculateCPM(req, res, next));
router.get('/governance/cpm/:projectId', (req, res, next) => rdTaskController.calculateCPM(req, res, next));

// Baseline Schedule & Variance (Req 19)
router.post('/schedule/baseline', (req, res, next) => rdTaskController.createBaseline(req, res, next));
router.get('/schedule/variance/:projectId', (req, res, next) => rdTaskController.getScheduleVariance(req, res, next));

router.post('/governance/schedule/baseline', (req, res, next) => rdTaskController.createBaseline(req, res, next));
router.get('/governance/schedule/variance/:projectId', (req, res, next) => rdTaskController.getScheduleVariance(req, res, next));

// Automated Schedule Alerts (Req 20)
router.get('/schedule/alerts', (req, res, next) => rdTaskController.getAlerts(req, res, next));
router.post('/schedule/alerts/scan', (req, res, next) => rdTaskController.scanAlerts(req, res, next));
router.post('/schedule/alerts/:id/resolve', (req, res, next) => rdTaskController.resolveAlert(req, res, next));

router.get('/governance/schedule/alerts', (req, res, next) => rdTaskController.getAlerts(req, res, next));
router.post('/governance/schedule/alerts/scan', (req, res, next) => rdTaskController.scanAlerts(req, res, next));
router.post('/governance/schedule/alerts/:id/resolve', (req, res, next) => rdTaskController.resolveAlert(req, res, next));

// ==============================================================================
// MASTER PROMPT 11: COLLABORATION, COMMUNICATION & EXTERNAL INTEGRATIONS
//

// ==============================================================================

// Conversations (Project Channels, Direct Messages, Group Chats)
router.get('/collaboration/conversations', (req, res, next) => rdCollaborationController.getConversations(req, res, next));
router.post('/collaboration/conversations', (req, res, next) => rdCollaborationController.createConversation(req, res, next));
router.get('/collaboration/conversations/:id', (req, res, next) => rdCollaborationController.getConversationById(req, res, next));
router.put('/collaboration/conversations/:id', (req, res, next) => rdCollaborationController.updateConversation(req, res, next));
router.post('/collaboration/conversations/:id/participants', (req, res, next) => rdCollaborationController.addParticipant(req, res, next));
router.delete('/collaboration/conversations/:id/participants/:userId', (req, res, next) => rdCollaborationController.removeParticipant(req, res, next));

// Messages & Threads
router.get('/collaboration/conversations/:conversationId/messages', (req, res, next) => rdCollaborationController.getMessages(req, res, next));
router.post('/collaboration/conversations/:conversationId/messages', (req, res, next) => rdCollaborationController.sendMessage(req, res, next));
router.put('/collaboration/messages/:id', (req, res, next) => rdCollaborationController.editMessage(req, res, next));
router.delete('/collaboration/messages/:id', (req, res, next) => rdCollaborationController.deleteMessage(req, res, next));
router.post('/collaboration/messages/:id/pin', (req, res, next) => rdCollaborationController.pinMessage(req, res, next));
router.get('/collaboration/search', (req, res, next) => rdCollaborationController.searchMessages(req, res, next));

// Contextual Comments
router.get('/collaboration/comments', (req, res, next) => rdCollaborationController.getComments(req, res, next));
router.post('/collaboration/comments', (req, res, next) => rdCollaborationController.createComment(req, res, next));
router.put('/collaboration/comments/:id', (req, res, next) => rdCollaborationController.editComment(req, res, next));
router.delete('/collaboration/comments/:id', (req, res, next) => rdCollaborationController.deleteComment(req, res, next));

// Notifications & Preferences
router.get('/collaboration/notifications', (req, res, next) => rdCollaborationController.getNotifications(req, res, next));
router.post('/collaboration/notifications/:id/read', (req, res, next) => rdCollaborationController.markNotificationRead(req, res, next));
router.post('/collaboration/notifications/read-all', (req, res, next) => rdCollaborationController.markAllNotificationsRead(req, res, next));
router.get('/collaboration/preferences', (req, res, next) => rdCollaborationController.getPreferences(req, res, next));
router.put('/collaboration/preferences', (req, res, next) => rdCollaborationController.updatePreferences(req, res, next));

// Shared Calendars & Events
router.get('/collaboration/calendar/events', (req, res, next) => rdCalendarController.getEvents(req, res, next));
router.post('/collaboration/calendar/events', (req, res, next) => rdCalendarController.createEvent(req, res, next));
router.put('/collaboration/calendar/events/:id', (req, res, next) => rdCalendarController.updateEvent(req, res, next));
router.delete('/collaboration/calendar/events/:id', (req, res, next) => rdCalendarController.deleteEvent(req, res, next));
router.post('/collaboration/calendar/events/:id/respond', (req, res, next) => rdCalendarController.respondInvitation(req, res, next));
router.post('/collaboration/calendar/conflicts', (req, res, next) => rdCalendarController.checkConflicts(req, res, next));

// External Integrations (Slack, Teams, Webhooks)
router.get('/collaboration/integrations', (req, res, next) => rdIntegrationController.getIntegrations(req, res, next));
router.post('/collaboration/integrations/:provider', (req, res, next) => rdIntegrationController.saveConfig(req, res, next));
router.post('/collaboration/integrations/:id/test', (req, res, next) => rdIntegrationController.testConnection(req, res, next));
router.post('/collaboration/integrations/:id/disconnect', (req, res, next) => rdIntegrationController.disconnect(req, res, next));
router.get('/collaboration/integrations/logs', (req, res, next) => rdIntegrationController.getLogs(req, res, next));
router.post('/collaboration/integrations/logs/:id/retry', (req, res, next) => rdIntegrationController.retryLog(req, res, next));

// ==============================================================================
// MASTER PROMPT 12: R&D DASHBOARD, REPORTING & ANALYTICS ENGINE
// ==============================================================================

// Multi-Dimensional Analytics Aggregation
router.get('/analytics/executive', (req, res, next) => rdAnalyticsController.getExecutiveOverview(req, res, next));
router.get('/analytics/portfolio', (req, res, next) => rdAnalyticsController.getPortfolioAnalytics(req, res, next));
router.get('/analytics/innovation', (req, res, next) => rdAnalyticsController.getInnovationAnalytics(req, res, next));
router.get('/analytics/execution', (req, res, next) => rdAnalyticsController.getExecutionAnalytics(req, res, next));
router.get('/analytics/financial', (req, res, next) => rdAnalyticsController.getFinancialAnalytics(req, res, next));
router.get('/analytics/resources', (req, res, next) => rdAnalyticsController.getResourceAnalytics(req, res, next));
router.get('/analytics/risks-decisions', (req, res, next) => rdAnalyticsController.getRiskDecisionAnalytics(req, res, next));

// KPI Framework & Recalculation
router.get('/analytics/kpis', (req, res, next) => rdAnalyticsController.getKpis(req, res, next));
router.post('/analytics/kpis/recalculate', (req, res, next) => rdAnalyticsController.recalculateKpis(req, res, next));
router.put('/analytics/kpis/:id/target', (req, res, next) => rdAnalyticsController.updateKpiTarget(req, res, next));
router.get('/analytics/kpis/:id/history', (req, res, next) => rdAnalyticsController.getKpiHistory(req, res, next));

// Reporting Engine & Exports
router.get('/analytics/reports', (req, res, next) => rdAnalyticsController.generateReport(req, res, next));
router.get('/analytics/export/csv', (req, res, next) => rdAnalyticsController.exportCsv(req, res, next));
router.get('/analytics/export/json', (req, res, next) => rdAnalyticsController.exportJson(req, res, next));

// Dashboard Layout Customization & Preferences
router.get('/analytics/preferences', (req, res, next) => rdAnalyticsController.getPreferences(req, res, next));
router.put('/analytics/preferences', (req, res, next) => rdAnalyticsController.savePreferences(req, res, next));
router.delete('/analytics/preferences', (req, res, next) => rdAnalyticsController.resetPreferences(req, res, next));
// MASTER PROMPT 06: GANTT, TIMELINE, MILESTONES & ROADMAPS
// ==============================================================================

// Dynamic Milestone Planning (Req 10)
router.get('/milestones', (req, res, next) => rdMilestoneController.getMilestones(req, res, next));
router.post('/milestones', (req, res, next) => rdMilestoneController.createMilestone(req, res, next));
router.get('/milestones/:id', (req, res, next) => rdMilestoneController.getMilestoneById(req, res, next));
router.put('/milestones/:id', (req, res, next) => rdMilestoneController.updateMilestone(req, res, next));
router.delete('/milestones/:id', (req, res, next) => rdMilestoneController.deleteMilestone(req, res, next));
router.post('/milestones/:id/status', (req, res, next) => rdMilestoneController.updateMilestoneStatus(req, res, next));
router.post('/milestones/:id/tasks', (req, res, next) => rdMilestoneController.linkTasks(req, res, next));
router.post('/milestones/reorder', (req, res, next) => rdMilestoneController.reorderMilestones(req, res, next));

router.get('/governance/milestones', (req, res, next) => rdMilestoneController.getMilestones(req, res, next));
router.post('/governance/milestones', (req, res, next) => rdMilestoneController.createMilestone(req, res, next));
router.get('/governance/milestones/:id', (req, res, next) => rdMilestoneController.getMilestoneById(req, res, next));
router.put('/governance/milestones/:id', (req, res, next) => rdMilestoneController.updateMilestone(req, res, next));
router.delete('/governance/milestones/:id', (req, res, next) => rdMilestoneController.deleteMilestone(req, res, next));
router.post('/governance/milestones/:id/status', (req, res, next) => rdMilestoneController.updateMilestoneStatus(req, res, next));
router.post('/governance/milestones/:id/tasks', (req, res, next) => rdMilestoneController.linkTasks(req, res, next));
router.post('/governance/milestones/reorder', (req, res, next) => rdMilestoneController.reorderMilestones(req, res, next));

// Interactive Gantt Chart Operations (Req 13)
router.get('/gantt/:projectId', (req, res, next) => rdGanttController.getGanttData(req, res, next));
router.patch('/gantt/tasks/:id/dates', (req, res, next) => rdGanttController.updateTaskScheduleDates(req, res, next));

router.get('/governance/gantt/:projectId', (req, res, next) => rdGanttController.getGanttData(req, res, next));
router.patch('/governance/gantt/tasks/:id/dates', (req, res, next) => rdGanttController.updateTaskScheduleDates(req, res, next));

// Project Roadmap (Req 9)
router.get('/roadmap/:projectId', (req, res, next) => rdGanttController.getProjectRoadmap(req, res, next));
router.get('/governance/roadmap/:projectId', (req, res, next) => rdGanttController.getProjectRoadmap(req, res, next));

// Project Timeline Views (Req 14)
router.get('/timeline/:projectId', (req, res, next) => rdGanttController.getProjectTimeline(req, res, next));
router.get('/governance/timeline/:projectId', (req, res, next) => rdGanttController.getProjectTimeline(req, res, next));

// ==============================================================================
// MASTER PROMPT 07: RESEARCH HYPOTHESIS & EXPERIMENT MANAGEMENT
// ==============================================================================

// Research Objectives (Req 26)
router.get('/objectives', (req, res, next) => rdResearchController.getObjectives(req, res, next));
router.post('/objectives', (req, res, next) => rdResearchController.createObjective(req, res, next));
router.get('/objectives/:id', (req, res, next) => rdResearchController.getObjectiveById(req, res, next));
router.put('/objectives/:id', (req, res, next) => rdResearchController.updateObjective(req, res, next));
router.delete('/objectives/:id', (req, res, next) => rdResearchController.deleteObjective(req, res, next));

// Hypotheses (Req 27)
router.get('/hypotheses', (req, res, next) => rdResearchController.getHypotheses(req, res, next));
router.post('/hypotheses', (req, res, next) => rdResearchController.createHypothesis(req, res, next));
router.get('/hypotheses/:id', (req, res, next) => rdResearchController.getHypothesisById(req, res, next));
router.put('/hypotheses/:id', (req, res, next) => rdResearchController.updateHypothesis(req, res, next));
router.post('/hypotheses/:id/evaluate', (req, res, next) => rdResearchController.evaluateHypothesis(req, res, next));
router.delete('/hypotheses/:id', (req, res, next) => rdResearchController.deleteHypothesis(req, res, next));

// Scientific Variables (Req 28)
router.get('/variables', (req, res, next) => rdResearchController.getVariables(req, res, next));
router.post('/variables', (req, res, next) => rdResearchController.createVariable(req, res, next));

// Protocols & Steps (Req 28, 63)
router.get('/protocols', (req, res, next) => rdResearchController.getProtocols(req, res, next));
router.post('/protocols', (req, res, next) => rdResearchController.createProtocol(req, res, next));
router.get('/protocols/:id', (req, res, next) => rdResearchController.getProtocolById(req, res, next));
router.put('/protocols/:id', (req, res, next) => rdResearchController.updateProtocol(req, res, next));
router.post('/protocols/:id/version', (req, res, next) => rdResearchController.createProtocolVersion(req, res, next));
router.post('/protocols/:id/duplicate', (req, res, next) => rdResearchController.duplicateProtocol(req, res, next));
router.post('/protocols/:id/steps', (req, res, next) => rdResearchController.addProtocolStep(req, res, next));

// Experiments & Planning (Req 28, 29)
router.get('/experiments', (req, res, next) => rdResearchController.getExperiments(req, res, next));
router.post('/experiments', (req, res, next) => rdResearchController.createExperiment(req, res, next));
router.get('/experiments/stats', (req, res, next) => rdResearchController.getDashboardStats(req, res, next));
router.get('/experiments/:id', (req, res, next) => rdResearchController.getExperimentById(req, res, next));
router.put('/experiments/:id', (req, res, next) => rdResearchController.updateExperiment(req, res, next));
router.post('/experiments/:experimentId/runs', (req, res, next) => rdResearchController.createRun(req, res, next));
router.post('/experiments/:experimentId/results', (req, res, next) => rdResearchController.recordResult(req, res, next));
router.get('/experiments/:experimentId/compare', (req, res, next) => rdResearchController.compareRuns(req, res, next));

// Experiment Runs & Execution (Req 29, 63)
router.get('/runs/:id', (req, res, next) => rdResearchController.getRunById(req, res, next));
router.post('/runs/:id/status', (req, res, next) => rdResearchController.updateRunStatus(req, res, next));
router.post('/runs/steps/:id/complete', (req, res, next) => rdResearchController.completeRunStep(req, res, next));
router.post('/runs/:runId/observations', (req, res, next) => rdResearchController.recordObservation(req, res, next));
router.get('/runs/:runId/observations', (req, res, next) => rdResearchController.getObservations(req, res, next));
router.post('/runs/:runId/measurements', (req, res, next) => rdResearchController.recordMeasurement(req, res, next));
router.get('/runs/:runId/measurements', (req, res, next) => rdResearchController.getMeasurements(req, res, next));

// Evidence & Outcomes (Req 25)
router.get('/evidence', (req, res, next) => rdResearchController.getEvidences(req, res, next));
router.post('/evidence', (req, res, next) => rdResearchController.createEvidence(req, res, next));
router.get('/outcomes', (req, res, next) => rdResearchController.getOutcomes(req, res, next));
router.post('/outcomes', (req, res, next) => rdResearchController.createOutcome(req, res, next));

// Research Documentation & Notes (Req 30, 63)
router.get('/notes', (req, res, next) => rdResearchController.getNotes(req, res, next));
router.post('/notes', (req, res, next) => rdResearchController.createNote(req, res, next));

// ==============================================================================
// MASTER PROMPT 08: ELECTRONIC LAB NOTEBOOK (ELN) & RESEARCH DOCUMENTATION
// (REQUIREMENTS 30, 42, 63, 94)
// ==============================================================================

// Global Unified ELN Discovery Search (AC-20)
router.get('/eln/search', (req, res, next) => rdElnController.globalSearch(req, res, next));

// Notebooks Management
router.get('/eln/notebooks', (req, res, next) => rdElnController.listNotebooks(req, res, next));
router.post('/eln/notebooks', (req, res, next) => rdElnController.createNotebook(req, res, next));
router.get('/eln/notebooks/:id', (req, res, next) => rdElnController.getNotebook(req, res, next));
router.put('/eln/notebooks/:id', (req, res, next) => rdElnController.updateNotebook(req, res, next));
router.put('/eln/notebooks/:id/archive', (req, res, next) => rdElnController.archiveNotebook(req, res, next));
router.post('/eln/notebooks/:id/contributors', (req, res, next) => rdElnController.addContributor(req, res, next));

// Research Entries & Versioned Notes
router.get('/eln/entries', (req, res, next) => rdElnController.listEntries(req, res, next));
router.post('/eln/entries', (req, res, next) => rdElnController.createEntry(req, res, next));
router.get('/eln/entries/:id', (req, res, next) => rdElnController.getEntry(req, res, next));
router.put('/eln/entries/:id', (req, res, next) => rdElnController.updateEntry(req, res, next));
router.put('/eln/entries/:id/archive', (req, res, next) => rdElnController.archiveEntry(req, res, next));
router.get('/eln/entries/:id/versions', (req, res, next) => rdElnController.getEntryVersions(req, res, next));

// Research Documents & Attachments (Req 42)
router.get('/eln/documents', (req, res, next) => rdElnController.listDocuments(req, res, next));
router.post('/eln/documents', (req, res, next) => rdElnController.uploadDocument(req, res, next));
router.get('/eln/documents/:id', (req, res, next) => rdElnController.getDocument(req, res, next));
router.put('/eln/documents/:id', (req, res, next) => rdElnController.updateDocumentMetadata(req, res, next));
router.put('/eln/documents/:id/archive', (req, res, next) => rdElnController.archiveDocument(req, res, next));
router.put('/eln/documents/:id/restore', (req, res, next) => rdElnController.restoreDocument(req, res, next));
router.get('/eln/documents/:id/download', (req, res, next) => rdElnController.downloadDocument(req, res, next));
router.get('/eln/documents/:id/preview', (req, res, next) => rdElnController.previewDocument(req, res, next));

// Document Versioning & Restoration (Req 94)
router.post('/eln/documents/:id/versions', (req, res, next) => rdElnController.uploadNewVersion(req, res, next));
router.get('/eln/documents/:id/versions', (req, res, next) => rdElnController.getDocumentVersions(req, res, next));
router.post('/eln/documents/:id/versions/:versionNumber/restore', (req, res, next) => rdElnController.restoreHistoricalVersion(req, res, next));

// Research Datasets & Files
router.get('/eln/datasets', (req, res, next) => rdElnController.listDatasets(req, res, next));
router.post('/eln/datasets', (req, res, next) => rdElnController.createDataset(req, res, next));
router.get('/eln/datasets/:id', (req, res, next) => rdElnController.getDataset(req, res, next));
router.post('/eln/datasets/:id/files', (req, res, next) => rdElnController.uploadDatasetFile(req, res, next));
router.get('/eln/datasets/files/:fileId/download', (req, res, next) => rdElnController.downloadDatasetFile(req, res, next));

// Research Knowledge Repository
router.get('/eln/knowledge', (req, res, next) => rdElnController.listKnowledgeRecords(req, res, next));
router.post('/eln/knowledge', (req, res, next) => rdElnController.createKnowledgeRecord(req, res, next));
router.get('/eln/knowledge/:id', (req, res, next) => rdElnController.getKnowledgeRecord(req, res, next));
router.put('/eln/knowledge/:id', (req, res, next) => rdElnController.updateKnowledgeRecord(req, res, next));

// Research Document Linking & Relationships
router.post('/eln/documents/:id/links', (req, res, next) => rdElnController.linkDocumentToEntity(req, res, next));
router.delete('/eln/document-links/:linkId', (req, res, next) => rdElnController.unlinkDocumentFromEntity(req, res, next));
router.get('/eln/entities/:entityType/:entityId/documents', (req, res, next) => rdElnController.getEntityDocuments(req, res, next));

// ==============================================================================
// MASTER PROMPT 09: DECISION, RISK, ISSUE & FINANCIAL MANAGEMENT (Req 31 - 40)
// ==============================================================================

// Overview
router.get('/governance-ops/overview', (req, res, next) => rdGovernanceOpsController.getOverview(req, res, next));

// 1. Decision Logs (Req 31)
router.get('/governance-ops/decisions', (req, res, next) => rdGovernanceOpsController.listDecisions(req, res, next));
router.post('/governance-ops/decisions', (req, res, next) => rdGovernanceOpsController.createDecision(req, res, next));
router.get('/governance-ops/decisions/:id', (req, res, next) => rdGovernanceOpsController.getDecision(req, res, next));
router.put('/governance-ops/decisions/:id', (req, res, next) => rdGovernanceOpsController.updateDecision(req, res, next));
router.post('/governance-ops/decisions/:id/status', (req, res, next) => rdGovernanceOpsController.updateDecisionStatus(req, res, next));

// 2. Risk Registers, Scoring & 5x5 Matrix (Req 32 & 33)
router.get('/governance-ops/risks/matrix', (req, res, next) => rdGovernanceOpsController.getRiskMatrix(req, res, next));
router.get('/governance-ops/risks', (req, res, next) => rdGovernanceOpsController.listRisks(req, res, next));
router.post('/governance-ops/risks', (req, res, next) => rdGovernanceOpsController.createRisk(req, res, next));
router.get('/governance-ops/risks/:id', (req, res, next) => rdGovernanceOpsController.getRisk(req, res, next));
router.put('/governance-ops/risks/:id', (req, res, next) => rdGovernanceOpsController.updateRisk(req, res, next));
router.post('/governance-ops/risks/:id/review', (req, res, next) => rdGovernanceOpsController.reviewRisk(req, res, next));
router.post('/governance-ops/risks/:id/mitigations', (req, res, next) => rdGovernanceOpsController.addRiskMitigation(req, res, next));
router.put('/governance-ops/mitigations/:mitigationId', (req, res, next) => rdGovernanceOpsController.updateRiskMitigation(req, res, next));
router.delete('/governance-ops/mitigations/:mitigationId', (req, res, next) => rdGovernanceOpsController.deleteRiskMitigation(req, res, next));

// 3. Issue Tracking (Req 34)
router.get('/governance-ops/issues', (req, res, next) => rdGovernanceOpsController.listIssues(req, res, next));
router.post('/governance-ops/issues', (req, res, next) => rdGovernanceOpsController.createIssue(req, res, next));
router.get('/governance-ops/issues/:id', (req, res, next) => rdGovernanceOpsController.getIssue(req, res, next));
router.put('/governance-ops/issues/:id', (req, res, next) => rdGovernanceOpsController.updateIssue(req, res, next));
router.post('/governance-ops/issues/:id/status', (req, res, next) => rdGovernanceOpsController.updateIssueStatus(req, res, next));
router.post('/governance-ops/issues/:id/comments', (req, res, next) => rdGovernanceOpsController.addIssueComment(req, res, next));

// 4. Change Management (Req 35)
router.get('/governance-ops/change-requests', (req, res, next) => rdGovernanceOpsController.listChangeRequests(req, res, next));
router.post('/governance-ops/change-requests', (req, res, next) => rdGovernanceOpsController.createChangeRequest(req, res, next));
router.get('/governance-ops/change-requests/:id', (req, res, next) => rdGovernanceOpsController.getChangeRequest(req, res, next));
router.put('/governance-ops/change-requests/:id', (req, res, next) => rdGovernanceOpsController.updateChangeRequest(req, res, next));
router.post('/governance-ops/change-requests/:id/review', (req, res, next) => rdGovernanceOpsController.reviewChangeRequest(req, res, next));
router.post('/governance-ops/change-requests/:id/implement', (req, res, next) => rdGovernanceOpsController.implementChangeRequest(req, res, next));

// 5. Requirements Management & Traceability (Req 36)
router.get('/governance-ops/requirements/traceability', (req, res, next) => rdGovernanceOpsController.getTraceabilityMatrix(req, res, next));
router.get('/governance-ops/requirements', (req, res, next) => rdGovernanceOpsController.listRequirements(req, res, next));
router.post('/governance-ops/requirements', (req, res, next) => rdGovernanceOpsController.createRequirement(req, res, next));
router.get('/governance-ops/requirements/:id', (req, res, next) => rdGovernanceOpsController.getRequirement(req, res, next));
router.put('/governance-ops/requirements/:id', (req, res, next) => rdGovernanceOpsController.updateRequirement(req, res, next));
router.post('/governance-ops/requirements/:id/criteria', (req, res, next) => rdGovernanceOpsController.addCriterionToRequirement(req, res, next));
router.put('/governance-ops/criteria/:criterionId/verify', (req, res, next) => rdGovernanceOpsController.verifyRequirementCriterion(req, res, next));

// 6. Scope Tracking & WBS (Req 37)
router.get('/governance-ops/scope/baselines', (req, res, next) => rdGovernanceOpsController.getScopeBaselines(req, res, next));
router.post('/governance-ops/scope/baselines', (req, res, next) => rdGovernanceOpsController.createScopeBaseline(req, res, next));
router.get('/governance-ops/scope/wbs', (req, res, next) => rdGovernanceOpsController.getWbs(req, res, next));
router.post('/governance-ops/scope/wbs', (req, res, next) => rdGovernanceOpsController.createWbsItem(req, res, next));
router.put('/governance-ops/scope/wbs/:id', (req, res, next) => rdGovernanceOpsController.updateWbsItem(req, res, next));
router.delete('/governance-ops/scope/wbs/:id', (req, res, next) => rdGovernanceOpsController.deleteWbsItem(req, res, next));

// 7. Deliverable Tracking (Req 38)
router.get('/governance-ops/deliverables', (req, res, next) => rdGovernanceOpsController.listDeliverables(req, res, next));
router.post('/governance-ops/deliverables', (req, res, next) => rdGovernanceOpsController.createDeliverable(req, res, next));
router.get('/governance-ops/deliverables/:id', (req, res, next) => rdGovernanceOpsController.getDeliverable(req, res, next));
router.put('/governance-ops/deliverables/:id', (req, res, next) => rdGovernanceOpsController.updateDeliverable(req, res, next));
router.post('/governance-ops/deliverables/:id/submit', (req, res, next) => rdGovernanceOpsController.submitDeliverable(req, res, next));
router.post('/governance-ops/deliverables/:id/review', (req, res, next) => rdGovernanceOpsController.reviewDeliverable(req, res, next));

// 8. Quality Checkpoints (Req 39)
router.get('/governance-ops/quality-checkpoints', (req, res, next) => rdGovernanceOpsController.listQualityCheckpoints(req, res, next));
router.post('/governance-ops/quality-checkpoints', (req, res, next) => rdGovernanceOpsController.createQualityCheckpoint(req, res, next));
router.get('/governance-ops/quality-checkpoints/:id', (req, res, next) => rdGovernanceOpsController.getQualityCheckpoint(req, res, next));
router.post('/governance-ops/quality-checkpoints/:id/criteria', (req, res, next) => rdGovernanceOpsController.addCriterionToCheckpoint(req, res, next));
router.put('/governance-ops/quality-criteria/:criterionId', (req, res, next) => rdGovernanceOpsController.evaluateQualityCriterion(req, res, next));
router.post('/governance-ops/quality-checkpoints/:id/conduct', (req, res, next) => rdGovernanceOpsController.conductQualityCheckpoint(req, res, next));

// 9. Budget Planning & Financial Controls (Req 40)
router.get('/governance-ops/budgets', (req, res, next) => rdGovernanceOpsController.listBudgets(req, res, next));
router.post('/governance-ops/budgets', (req, res, next) => rdGovernanceOpsController.createBudget(req, res, next));
router.get('/governance-ops/budgets/:id', (req, res, next) => rdGovernanceOpsController.getBudget(req, res, next));
router.put('/governance-ops/budgets/:id', (req, res, next) => rdGovernanceOpsController.updateBudget(req, res, next));
router.post('/governance-ops/budgets/:id/allocations', (req, res, next) => rdGovernanceOpsController.addBudgetAllocation(req, res, next));
router.put('/governance-ops/allocations/:allocationId', (req, res, next) => rdGovernanceOpsController.updateBudgetAllocation(req, res, next));
router.delete('/governance-ops/allocations/:allocationId', (req, res, next) => rdGovernanceOpsController.deleteBudgetAllocation(req, res, next));
router.post('/governance-ops/budgets/:id/approve', (req, res, next) => rdGovernanceOpsController.approveBudget(req, res, next));
router.post('/governance-ops/budgets/:id/revisions', (req, res, next) => rdGovernanceOpsController.requestBudgetRevision(req, res, next));
router.post('/governance-ops/revisions/:revisionId/review', (req, res, next) => rdGovernanceOpsController.reviewBudgetRevision(req, res, next));
router.get('/governance-ops/budgets/:id/summary', (req, res, next) => rdGovernanceOpsController.getBudgetSummary(req, res, next));

// ==============================================================================
// MASTER PROMPT 10: RESOURCE, CAPACITY, TIME & LAB FACILITY MANAGEMENT (REQS 51-60)
// ==============================================================================

// Overview & Metrics
router.get('/resources/overview', (req, res, next) => rdResourceController.getOverview(req, res, next));

// 1. Resource Directory & Profiles (Req 51)
router.get('/resources/profiles', (req, res, next) => rdResourceController.listProfiles(req, res, next));
router.get('/resources/profiles/:id', (req, res, next) => rdResourceController.getProfile(req, res, next));
router.put('/resources/profiles/:id', (req, res, next) => rdResourceController.updateProfile(req, res, next));

// 2. Resource Allocations (Req 51, 53)
router.get('/resources/allocations', (req, res, next) => rdResourceController.listAllocations(req, res, next));
router.post('/resources/allocations', (req, res, next) => rdResourceController.createAllocation(req, res, next));
router.put('/resources/allocations/:id', (req, res, next) => rdResourceController.updateAllocation(req, res, next));
router.delete('/resources/allocations/:id', (req, res, next) => rdResourceController.deleteAllocation(req, res, next));

// 3. Skill Matrix & Expertise Mapping (Req 52)
router.get('/resources/skills/matrix', (req, res, next) => rdResourceController.getSkillMatrix(req, res, next));
router.get('/resources/skills/search', (req, res, next) => rdResourceController.searchResourcesBySkills(req, res, next));
router.get('/resources/skills', (req, res, next) => rdResourceController.listSkills(req, res, next));
router.post('/resources/skills', (req, res, next) => rdResourceController.createSkill(req, res, next));
router.put('/resources/skills/:id', (req, res, next) => rdResourceController.updateSkill(req, res, next));
router.post('/resources/employee-skills', (req, res, next) => rdResourceController.upsertEmployeeSkill(req, res, next));
router.put('/resources/employee-skills/:id/verify', (req, res, next) => rdResourceController.verifyEmployeeSkill(req, res, next));
router.delete('/resources/employee-skills/:id', (req, res, next) => rdResourceController.deleteEmployeeSkill(req, res, next));

// 4. Team Capacity Planning (Req 53)
router.get('/resources/capacity', (req, res, next) => rdResourceController.getCapacityPlanning(req, res, next));

// 5. Timesheets & Time Tracking (Req 54)
router.get('/resources/timesheets/weekly', (req, res, next) => rdResourceController.getOrCreateWeeklyTimesheet(req, res, next));
router.get('/resources/timesheets', (req, res, next) => rdResourceController.listTimesheets(req, res, next));
router.get('/resources/timesheets/:id', (req, res, next) => rdResourceController.getTimesheet(req, res, next));
router.post('/resources/timesheets/:id/entries', (req, res, next) => rdResourceController.addTimeEntry(req, res, next));
router.delete('/resources/time-entries/:entryId', (req, res, next) => rdResourceController.deleteTimeEntry(req, res, next));
router.post('/resources/timesheets/:id/submit', (req, res, next) => rdResourceController.submitTimesheet(req, res, next));
router.post('/resources/timesheets/:id/approve', (req, res, next) => rdResourceController.approveTimesheet(req, res, next));
router.post('/resources/timesheets/:id/reject', (req, res, next) => rdResourceController.rejectTimesheet(req, res, next));

// 6. Labor Cost & Financial Integration (Req 55, 56, 57)
router.get('/resources/projects/:projectId/labor-costs', (req, res, next) => rdResourceController.getProjectLaborCostSummary(req, res, next));

// 7. Resource Utilization Metrics (Req 58)
router.get('/resources/utilization', (req, res, next) => rdResourceController.getUtilizationMetrics(req, res, next));

// 8. Shared Facilities & Lab Equipment (Req 59)
router.get('/resources/facilities', (req, res, next) => rdResourceController.listFacilities(req, res, next));
router.post('/resources/facilities', (req, res, next) => rdResourceController.createFacility(req, res, next));
router.get('/resources/facilities/:id', (req, res, next) => rdResourceController.getFacility(req, res, next));
router.put('/resources/facilities/:id', (req, res, next) => rdResourceController.updateFacility(req, res, next));
router.delete('/resources/facilities/:id', (req, res, next) => rdResourceController.deleteFacility(req, res, next));

router.get('/resources/equipment', (req, res, next) => rdResourceController.listEquipment(req, res, next));
router.post('/resources/equipment', (req, res, next) => rdResourceController.createEquipment(req, res, next));
router.get('/resources/equipment/:id', (req, res, next) => rdResourceController.getEquipment(req, res, next));
router.put('/resources/equipment/:id', (req, res, next) => rdResourceController.updateEquipment(req, res, next));
router.delete('/resources/equipment/:id', (req, res, next) => rdResourceController.deleteEquipment(req, res, next));
router.post('/resources/equipment/maintenance', (req, res, next) => rdResourceController.scheduleMaintenance(req, res, next));
router.put('/resources/equipment/maintenance/:id/complete', (req, res, next) => rdResourceController.completeMaintenance(req, res, next));

// 9. Facility & Equipment Bookings (Req 59, 60)
router.get('/resources/bookings', (req, res, next) => rdResourceController.listBookings(req, res, next));
router.post('/resources/bookings', (req, res, next) => rdResourceController.createBooking(req, res, next));
router.get('/resources/bookings/:id', (req, res, next) => rdResourceController.getBooking(req, res, next));
router.post('/resources/bookings/:id/cancel', (req, res, next) => rdResourceController.cancelBooking(req, res, next));

module.exports = router;
