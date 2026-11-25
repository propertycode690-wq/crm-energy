const prisma = require('../config/prisma');

class RdKpiService {
  /**
   * Return default R&D KPI blueprint definitions
   */
  getDefaultKpiDefinitions() {
    return [
      {
        code: 'KPI-SCHED-01',
        name: 'R&D Schedule Adherence Rate',
        description: 'Percentage of completed or active tasks delivered on or before the scheduled due date without variance drift.',
        calculationFormula: '(Tasks Delivered On/Before DueDate / Total Tasks with DueDate) * 100',
        category: 'DELIVERY',
        targetValue: 85.0,
        unit: 'PERCENT',
        measurementPeriod: 'MONTHLY',
      },
      {
        code: 'KPI-FIN-01',
        name: 'Portfolio Budget Utilization Rate',
        description: 'Ratio of total actual R&D expenditure versus the total approved capital budget allocation.',
        calculationFormula: '(Total Actual Expenditure / Total Approved Budget) * 100',
        category: 'FINANCIAL',
        targetValue: 90.0,
        unit: 'PERCENT',
        measurementPeriod: 'QUARTERLY',
      },
      {
        code: 'KPI-INNOV-01',
        name: 'Innovation Pipeline Velocity',
        description: 'Proportion of submitted research ideas successfully advancing through scoring to formal project intake.',
        calculationFormula: '(Approved or Converted Ideas / Total Evaluated Ideas) * 100',
        category: 'INNOVATION',
        targetValue: 40.0,
        unit: 'PERCENT',
        measurementPeriod: 'MONTHLY',
      },
      {
        code: 'KPI-EXEC-01',
        name: 'Critical Path Delivery Integrity',
        description: 'Proportion of critical-path tasks proceeding without dependency delay or critical schedule alert.',
        calculationFormula: '((Total Critical Tasks - Delayed Critical Tasks) / Total Critical Tasks) * 100',
        category: 'DELIVERY',
        targetValue: 95.0,
        unit: 'PERCENT',
        measurementPeriod: 'MONTHLY',
      },
      {
        code: 'KPI-RES-01',
        name: 'Researcher Capacity Allocation Ratio',
        description: 'Actual assigned task estimated work hours divided by available researcher team capacity.',
        calculationFormula: '(Total Assigned Work Hours / (Team Members * 160 Standard Monthly Hours)) * 100',
        category: 'RESOURCE',
        targetValue: 80.0,
        unit: 'PERCENT',
        measurementPeriod: 'MONTHLY',
      },
      {
        code: 'KPI-GOV-01',
        name: 'Stage-Gate GO Decision Rate',
        description: 'Ratio of formal stage-gate evaluation meetings that resulted in an explicit GO or ADVANCE decision.',
        calculationFormula: '(GO Gate Decisions / Total Concluded Gate Decisions) * 100',
        category: 'PORTFOLIO',
        targetValue: 75.0,
        unit: 'PERCENT',
        measurementPeriod: 'QUARTERLY',
      },
    ];
  }

  /**
   * Seed default KPIs if tenant does not have them yet
   */
  async ensureDefaultKpis(tenantId) {
    const count = await prisma.rdKpi.count({ where: { tenantId } });
    if (count > 0) return;

    const defaults = this.getDefaultKpiDefinitions();
    for (const def of defaults) {
      await prisma.rdKpi.create({
        data: {
          tenantId,
          code: def.code,
          name: def.name,
          description: def.description,
          calculationFormula: def.calculationFormula,
          category: def.category,
          targetValue: def.targetValue,
          currentValue: 0.0,
          unit: def.unit,
          measurementPeriod: def.measurementPeriod,
          status: 'ON_TRACK',
          trend: 'STABLE',
        },
      });
    }
  }

  /**
   * Fetch all KPIs with historical trends and live calculated values
   */
  async getKpis(tenantId, query = {}) {
    await this.ensureDefaultKpis(tenantId);

    const { category, status } = query;
    const where = {
      tenantId,
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
    };

    // Calculate live actual values based on real database metrics
    await this.recalculateLiveValues(tenantId);

    const kpis = await prisma.rdKpi.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        history: {
          orderBy: { recordedAt: 'desc' },
          take: 6,
        },
      },
      orderBy: { code: 'asc' },
    });

    return kpis;
  }

  /**
   * Live recalculation of all KPI actual values from underlying database records
   */
  async recalculateLiveValues(tenantId) {
    const [
      allTasks,
      projects,
      ideas,
      gateDecisions,
      users,
      scheduleAlerts,
    ] = await Promise.all([
      prisma.task.findMany({ where: { tenantId } }),
      prisma.erpProject.findMany({ where: { tenantId } }),
      prisma.rdIdea.findMany({ where: { tenantId } }),
      prisma.rdGateDecision.findMany({ where: { tenantId } }),
      prisma.user.findMany({ where: { tenantId } }),
      prisma.rdScheduleAlert.findMany({ where: { tenantId, status: 'ACTIVE' } }),
    ]);

    // 1. Schedule Adherence
    const tasksWithDueDate = allTasks.filter((t) => t.dueDate);
    let scheduleAdherence = 85.0; // Baseline
    if (tasksWithDueDate.length > 0) {
      const onTimeTasks = tasksWithDueDate.filter((t) => {
        if (t.status === 'COMPLETED') return true;
        return new Date(t.dueDate) >= new Date();
      });
      scheduleAdherence = parseFloat(((onTimeTasks.length / tasksWithDueDate.length) * 100).toFixed(1));
    }

    // 2. Budget Utilization
    let totalBudget = 0;
    let totalSpent = 0;
    projects.forEach((p) => {
      totalBudget += parseFloat(p.budget || 0);
      totalSpent += parseFloat(p.spent || 0);
    });
    const budgetUtilization = totalBudget > 0 ? parseFloat(((totalSpent / totalBudget) * 100).toFixed(1)) : 0.0;

    // 3. Idea Conversion Velocity
    let ideaConversion = 45.0; // Default baseline if empty
    if (ideas.length > 0) {
      const approvedOrConverted = ideas.filter((i) => i.status === 'APPROVED' || i.status === 'CONVERTED');
      ideaConversion = parseFloat(((approvedOrConverted.length / ideas.length) * 100).toFixed(1));
    }

    // 4. Critical Path Integrity
    let criticalPathHealth = 100.0;
    if (allTasks.length > 0) {
      const activeBlockers = scheduleAlerts.filter((a) => a.alertType === 'CRITICAL_PATH_DELAY' || a.alertType === 'DEPENDENCY_BLOCKED');
      criticalPathHealth = Math.max(0, 100 - (activeBlockers.length * 10));
    }

    // 5. Capacity Allocation
    let totalAssignedHours = 0;
    allTasks.forEach((t) => {
      totalAssignedHours += parseFloat(t.estimatedHours || 0);
    });
    const totalCapacity = Math.max(users.length * 160, 160);
    const capacityUtilization = Math.min(100.0, parseFloat(((totalAssignedHours / totalCapacity) * 100).toFixed(1)));

    // 6. Gate Decision GO Rate
    let gateApprovalRate = 80.0;
    if (gateDecisions.length > 0) {
      const goDecisions = gateDecisions.filter((d) => d.decision === 'GO' || d.decision === 'APPROVED');
      gateApprovalRate = parseFloat(((goDecisions.length / gateDecisions.length) * 100).toFixed(1));
    }

    // Map calculated values to KPI updates
    const updates = [
      { code: 'KPI-SCHED-01', val: scheduleAdherence },
      { code: 'KPI-FIN-01', val: budgetUtilization },
      { code: 'KPI-INNOV-01', val: ideaConversion },
      { code: 'KPI-EXEC-01', val: criticalPathHealth },
      { code: 'KPI-RES-01', val: capacityUtilization },
      { code: 'KPI-GOV-01', val: gateApprovalRate },
    ];

    for (const u of updates) {
      const kpi = await prisma.rdKpi.findFirst({
        where: { tenantId, code: u.code },
      });
      if (kpi) {
        let status = 'ON_TRACK';
        if (u.val < kpi.targetValue * 0.75) status = 'CRITICAL';
        else if (u.val < kpi.targetValue) status = 'AT_RISK';
        else if (u.val > kpi.targetValue * 1.1) status = 'EXCEEDED';

        const trend = u.val > kpi.currentValue ? 'UP' : u.val < kpi.currentValue ? 'DOWN' : 'STABLE';

        await prisma.rdKpi.update({
          where: { id: kpi.id },
          data: {
            currentValue: u.val,
            status,
            trend,
          },
        });
      }
    }
  }

  /**
   * Recalculate all KPIs and return updated list
   */
  async recalculateAllKpis(tenantId) {
    await this.recalculateLiveValues(tenantId);
    return this.getKpis(tenantId);
  }

  /**
   * Update target value of a KPI and record snapshot
   */
  async updateKpiTarget(tenantId, id, targetValue, ownerId) {
    const kpi = await prisma.rdKpi.findFirst({
      where: { id, tenantId },
    });
    if (!kpi) throw new Error('KPI not found.');

    const newTarget = parseFloat(targetValue);
    const updated = await prisma.rdKpi.update({
      where: { id },
      data: {
        targetValue: newTarget,
        ownerId: ownerId !== undefined ? ownerId : kpi.ownerId,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    // Record historical entry for target modification
    await prisma.rdKpiHistory.create({
      data: {
        tenantId,
        kpiId: id,
        period: new Date().toISOString().slice(0, 7),
        targetValue: newTarget,
        actualValue: kpi.currentValue,
        variance: parseFloat((kpi.currentValue - newTarget).toFixed(2)),
        notes: `Target updated from ${kpi.targetValue} to ${newTarget}`,
      },
    });

    return updated;
  }

  /**
   * Fetch historical snapshots for a KPI
   */
  async getKpiHistory(tenantId, kpiId) {
    return prisma.rdKpiHistory.findMany({
      where: { tenantId, kpiId },
      orderBy: { recordedAt: 'desc' },
      take: 24,
    });
  }

  /**
   * Create or customize a KPI
   */
  async createKpi(tenantId, data) {
    const { code, name, description, calculationFormula, category, targetValue, unit, measurementPeriod, ownerId } = data;

    if (!code || !name) {
      throw new Error('KPI code and name are required.');
    }

    return prisma.rdKpi.create({
      data: {
        tenantId,
        code: code.toUpperCase().trim(),
        name: name.trim(),
        description: description || null,
        calculationFormula: calculationFormula || null,
        category: category || 'PORTFOLIO',
        targetValue: parseFloat(targetValue) || 100.0,
        currentValue: 0.0,
        unit: unit || 'PERCENT',
        measurementPeriod: measurementPeriod || 'MONTHLY',
        ownerId: ownerId || null,
      },
    });
  }

  /**
   * Update KPI targets or metadata
   */
  async updateKpi(tenantId, id, data) {
    const kpi = await prisma.rdKpi.findFirst({
      where: { id, tenantId },
    });
    if (!kpi) throw new Error('KPI not found.');

    return prisma.rdKpi.update({
      where: { id },
      data: {
        name: data.name ?? kpi.name,
        description: data.description !== undefined ? data.description : kpi.description,
        targetValue: data.targetValue !== undefined ? parseFloat(data.targetValue) : kpi.targetValue,
        measurementPeriod: data.measurementPeriod ?? kpi.measurementPeriod,
        category: data.category ?? kpi.category,
        ownerId: data.ownerId !== undefined ? data.ownerId : kpi.ownerId,
      },
    });
  }

  /**
   * Record historical snapshot for a KPI
   */
  async recordHistory(tenantId, kpiId, data) {
    const kpi = await prisma.rdKpi.findFirst({
      where: { id: kpiId, tenantId },
    });
    if (!kpi) throw new Error('KPI not found.');

    const { period, actualValue, targetValue, notes } = data;
    const act = parseFloat(actualValue) || kpi.currentValue;
    const tgt = parseFloat(targetValue) || kpi.targetValue;
    const variance = parseFloat((act - tgt).toFixed(2));

    return prisma.rdKpiHistory.create({
      data: {
        tenantId,
        kpiId,
        period: period || new Date().toISOString().slice(0, 7),
        targetValue: tgt,
        actualValue: act,
        variance,
        notes: notes || null,
      },
    });
  }
}

module.exports = new RdKpiService();

