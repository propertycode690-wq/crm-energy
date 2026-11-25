const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class RdResourceService {
  async _logAudit(tenantId, userId, title, description, metadata = {}) {
    try {
      await prisma.activity.create({
        data: {
          tenantId,
          userId: userId || null,
          type: 'NOTE_ADDED',
          title: `[ResourceMgmt] ${title}`,
          description,
          metadata,
        },
      });
    } catch (err) {
      console.warn('[RdResourceService] Audit logging warning:', err.message);
    }
  }

  // ==============================================================================
  // OVERVIEW & DASHBOARD METRICS (Req 51, 53, 58, 59)
  // ==============================================================================

  async getResourceOverview(tenantId, projectId = null) {
    await this.ensureUserProfiles(tenantId);
    await this.ensureDefaultSkills(tenantId);
    await this.ensureDefaultFacilities(tenantId);

    const [
      totalResources,
      profiles,
      activeAllocations,
      skillsCount,
      facilities,
      equipment,
      pendingTimesheets,
      upcomingBookings,
    ] = await Promise.all([
      prisma.rdResourceProfile.count({ where: { tenantId, employmentStatus: 'ACTIVE' } }),
      prisma.rdResourceProfile.findMany({
        where: { tenantId, employmentStatus: 'ACTIVE' },
        select: { id: true, standardWeeklyHours: true, hourlyCostRate: true, department: true },
      }),
      prisma.rdResourceAllocation.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          ...(projectId ? { projectId } : {}),
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
        },
      }),
      prisma.rdSkill.count({ where: { tenantId, isActive: true } }),
      prisma.rdFacility.findMany({ where: { tenantId } }),
      prisma.rdLabEquipment.findMany({ where: { tenantId } }),
      prisma.rdTimesheet.count({ where: { tenantId, status: 'SUBMITTED' } }),
      prisma.rdFacilityBooking.findMany({
        where: {
          tenantId,
          status: 'CONFIRMED',
          endDateTime: { gte: new Date() },
          ...(projectId ? { projectId } : {}),
        },
        orderBy: { startDateTime: 'asc' },
        take: 5,
        include: {
          facility: { select: { id: true, name: true, facilityCode: true } },
          equipment: { select: { id: true, name: true, equipmentCode: true } },
          project: { select: { id: true, name: true } },
        },
      }),
    ]);

    const totalStandardWeeklyHours = profiles.reduce(
      (sum, p) => sum + Number(p.standardWeeklyHours || 40),
      0
    );
    const totalAllocatedWeeklyHours = activeAllocations.reduce(
      (sum, a) => sum + Number(a.expectedWeeklyHours || 0),
      0
    );
    const utilizationRate =
      totalStandardWeeklyHours > 0
        ? Math.round((totalAllocatedWeeklyHours / totalStandardWeeklyHours) * 100 * 10) / 10
        : 0;

    // Over-allocated resources detection (> 100% total allocation)
    const userAllocationMap = {};
    for (const alloc of activeAllocations) {
      userAllocationMap[alloc.userId] =
        (userAllocationMap[alloc.userId] || 0) + Number(alloc.allocationPercentage || 0);
    }
    const overAllocatedUsersCount = Object.values(userAllocationMap).filter((pct) => pct > 100).length;

    // Operational equipment stats
    const operationalEquipmentCount = equipment.filter((e) => e.operationalStatus === 'AVAILABLE').length;
    const maintenanceEquipmentCount = equipment.filter(
      (e) => e.operationalStatus === 'UNDER_MAINTENANCE' || e.operationalStatus === 'CALIBRATION_DUE'
    ).length;

    return {
      totalResources,
      totalStandardWeeklyHours,
      totalAllocatedWeeklyHours,
      utilizationRate,
      overAllocatedUsersCount,
      skillsCount,
      totalFacilities: facilities.length,
      totalEquipment: equipment.length,
      operationalEquipmentCount,
      maintenanceEquipmentCount,
      pendingTimesheets,
      upcomingBookings,
    };
  }

  // ==============================================================================
  // 1. RESOURCE PROFILES & DIRECTORY (Req 51)
  // ==============================================================================

  async ensureUserProfiles(tenantId) {
    const users = await prisma.user.findMany({ where: { tenantId } });
    for (let idx = 0; idx < users.length; idx++) {
      const u = users[idx];
      const exists = await prisma.rdResourceProfile.findUnique({
        where: { userId: u.id },
      });
      if (!exists) {
        const empCode = `EMP-${String(idx + 101).padStart(3, '0')}`;
        let dept = 'Scientific Research';
        let desig = 'Senior Research Scientist';
        let rate = 85.0;

        if (u.role === 'BUSINESS_OWNER' || u.role === 'SUPER_ADMIN') {
          dept = 'Executive R&D Leadership';
          desig = 'R&D Director';
          rate = 150.0;
        } else if (u.role === 'OPERATIONS_SALES_ADMIN' || u.role === 'FINANCE_COMPLIANCE_ADMIN') {
          dept = 'Laboratory Operations';
          desig = 'Lab Operations Manager';
          rate = 110.0;
        } else if (idx % 3 === 0) {
          dept = 'Materials & Electrochemistry';
          desig = 'Principal Investigator';
          rate = 95.0;
        } else if (idx % 3 === 1) {
          dept = 'Software & Embedded Systems';
          desig = 'Lead Firmware Engineer';
          rate = 90.0;
        }

        await prisma.rdResourceProfile.create({
          data: {
            tenantId,
            userId: u.id,
            employeeCode: empCode,
            department: dept,
            designation: desig,
            standardWeeklyHours: 40.0,
            hourlyCostRate: rate,
            employmentStatus: 'ACTIVE',
          },
        });
      }
    }
  }

  async listResourceProfiles(tenantId, filters = {}) {
    await this.ensureUserProfiles(tenantId);
    const { department, employmentStatus, search } = filters;

    const where = { tenantId };
    if (department) where.department = department;
    if (employmentStatus) where.employmentStatus = employmentStatus;

    if (search && search.trim()) {
      where.OR = [
        { employeeCode: { contains: search.trim() } },
        { designation: { contains: search.trim() } },
        { department: { contains: search.trim() } },
        { user: { name: { contains: search.trim() } } },
        { user: { email: { contains: search.trim() } } },
      ];
    }

    const profiles = await prisma.rdResourceProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
            isActive: true,
          },
        },
      },
      orderBy: { employeeCode: 'asc' },
    });

    // Attach active allocation percentages and project counts
    const activeAllocations = await prisma.rdResourceAllocation.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: { project: { select: { id: true, name: true } } },
    });

    const userAllocationsMap = {};
    for (const alloc of activeAllocations) {
      if (!userAllocationsMap[alloc.userId]) {
        userAllocationsMap[alloc.userId] = {
          totalAllocationPercentage: 0,
          totalWeeklyHours: 0,
          projects: [],
        };
      }
      userAllocationsMap[alloc.userId].totalAllocationPercentage += Number(alloc.allocationPercentage || 0);
      userAllocationsMap[alloc.userId].totalWeeklyHours += Number(alloc.expectedWeeklyHours || 0);
      userAllocationsMap[alloc.userId].projects.push({
        id: alloc.projectId,
        name: alloc.project.name,
        role: alloc.roleInProject,
        percentage: alloc.allocationPercentage,
      });
    }

    return profiles.map((p) => {
      const allocInfo = userAllocationsMap[p.userId] || {
        totalAllocationPercentage: 0,
        totalWeeklyHours: 0,
        projects: [],
      };
      const standardHours = Number(p.standardWeeklyHours || 40);
      const remainingHours = Math.max(0, standardHours - allocInfo.totalWeeklyHours);
      return {
        ...p,
        standardWeeklyHours: standardHours,
        hourlyCostRate: Number(p.hourlyCostRate || 75),
        currentAllocationPercentage: allocInfo.totalAllocationPercentage,
        currentWeeklyHours: allocInfo.totalWeeklyHours,
        remainingWeeklyHours: remainingHours,
        isOverAllocated: allocInfo.totalAllocationPercentage > 100,
        assignedProjects: allocInfo.projects,
      };
    });
  }

  async getResourceProfile(tenantId, idOrUserId) {
    await this.ensureUserProfiles(tenantId);
    const profile = await prisma.rdResourceProfile.findFirst({
      where: {
        tenantId,
        OR: [{ id: idOrUserId }, { userId: idOrUserId }],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
            isActive: true,
          },
        },
      },
    });

    if (!profile) {
      const err = new Error('Resource profile not found');
      err.statusCode = 404;
      throw err;
    }

    const [allocations, employeeSkills, recentTimesheets] = await Promise.all([
      prisma.rdResourceAllocation.findMany({
        where: { tenantId, userId: profile.userId },
        include: { project: { select: { id: true, name: true, status: true } } },
        orderBy: { startDate: 'desc' },
      }),
      prisma.rdEmployeeSkill.findMany({
        where: { tenantId, userId: profile.userId },
        include: { skill: true },
      }),
      prisma.rdTimesheet.findMany({
        where: { tenantId, userId: profile.userId },
        orderBy: { weekStartDate: 'desc' },
        take: 5,
      }),
    ]);

    const activeAllocations = allocations.filter((a) => a.status === 'ACTIVE');
    const totalAllocPct = activeAllocations.reduce((sum, a) => sum + Number(a.allocationPercentage || 0), 0);
    const totalWeeklyHours = activeAllocations.reduce((sum, a) => sum + Number(a.expectedWeeklyHours || 0), 0);

    return {
      ...profile,
      standardWeeklyHours: Number(profile.standardWeeklyHours),
      hourlyCostRate: Number(profile.hourlyCostRate),
      currentAllocationPercentage: totalAllocPct,
      currentWeeklyHours: totalWeeklyHours,
      remainingWeeklyHours: Math.max(0, Number(profile.standardWeeklyHours) - totalWeeklyHours),
      isOverAllocated: totalAllocPct > 100,
      allocations,
      skills: employeeSkills,
      recentTimesheets,
    };
  }

  async updateResourceProfile(tenantId, id, data) {
    const { department, designation, standardWeeklyHours, hourlyCostRate, employmentStatus } = data;
    const profile = await prisma.rdResourceProfile.findFirst({
      where: { tenantId, id },
    });
    if (!profile) {
      const err = new Error('Resource profile not found');
      err.statusCode = 404;
      throw err;
    }

    const updated = await prisma.rdResourceProfile.update({
      where: { id },
      data: {
        department: department !== undefined ? department : profile.department,
        designation: designation !== undefined ? designation : profile.designation,
        standardWeeklyHours:
          standardWeeklyHours !== undefined ? Number(standardWeeklyHours) : profile.standardWeeklyHours,
        hourlyCostRate: hourlyCostRate !== undefined ? Number(hourlyCostRate) : profile.hourlyCostRate,
        employmentStatus: employmentStatus || profile.employmentStatus,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return updated;
  }

  // ==============================================================================
  // 2. RESOURCE ALLOCATIONS (Req 51, 53)
  // ==============================================================================

  async listAllocations(tenantId, filters = {}) {
    const { projectId, userId, status } = filters;
    const where = { tenantId };
    if (projectId) where.projectId = projectId;
    if (userId) where.userId = userId;
    if (status) where.status = status;

    return await prisma.rdResourceAllocation.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
        project: { select: { id: true, name: true, status: true, budget: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async createAllocation(tenantId, assignedById, assignedByName, data) {
    const {
      projectId,
      userId,
      roleInProject = 'Researcher',
      allocationPercentage = 50,
      startDate,
      endDate,
      notes,
    } = data;

    if (!projectId || !userId || !startDate || !endDate) {
      const err = new Error('projectId, userId, startDate, and endDate are required.');
      err.statusCode = 400;
      throw err;
    }

    // Verify user profile to fetch standard weekly hours
    const profile = await prisma.rdResourceProfile.findUnique({
      where: { userId },
    });
    const standardHours = profile ? Number(profile.standardWeeklyHours) : 40.0;
    const expectedWeeklyHours = Math.round((standardHours * (Number(allocationPercentage) / 100)) * 100) / 100;

    // Check existing active allocations for over-allocation warning
    const activeAllocations = await prisma.rdResourceAllocation.findMany({
      where: {
        tenantId,
        userId,
        status: 'ACTIVE',
        endDate: { gte: new Date(startDate) },
        startDate: { lte: new Date(endDate) },
      },
    });

    const currentAllocPct = activeAllocations.reduce(
      (sum, a) => sum + Number(a.allocationPercentage || 0),
      0
    );
    const totalAllocPct = currentAllocPct + Number(allocationPercentage);
    const isOverAllocated = totalAllocPct > 100;

    const allocation = await prisma.rdResourceAllocation.create({
      data: {
        tenantId,
        projectId,
        userId,
        roleInProject,
        allocationPercentage: Number(allocationPercentage),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        expectedWeeklyHours,
        status: 'ACTIVE',
        notes: isOverAllocated
          ? `[Over-allocation Alert: User allocated ${totalAllocPct}% across active projects] ${notes || ''}`
          : notes,
        assignedById,
        assignedByName,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    await this._logAudit(
      tenantId,
      assignedById,
      'Resource Allocated',
      `Allocated ${allocation.user.name} to ${allocation.project.name} (${allocationPercentage}%, ${expectedWeeklyHours} hrs/wk)`,
      { allocationId: allocation.id, totalAllocPct, isOverAllocated }
    );

    return {
      ...allocation,
      totalAllocationPercentage: totalAllocPct,
      isOverAllocated,
      warning: isOverAllocated
        ? `Warning: Resource ${allocation.user.name} is over-allocated at ${totalAllocPct}% capacity.`
        : null,
    };
  }

  async updateAllocation(tenantId, id, data) {
    const allocation = await prisma.rdResourceAllocation.findFirst({
      where: { tenantId, id },
    });
    if (!allocation) {
      const err = new Error('Resource allocation not found');
      err.statusCode = 404;
      throw err;
    }

    const { allocationPercentage, roleInProject, startDate, endDate, status, notes } = data;
    let expectedWeeklyHours = allocation.expectedWeeklyHours;

    if (allocationPercentage !== undefined) {
      const profile = await prisma.rdResourceProfile.findUnique({
        where: { userId: allocation.userId },
      });
      const standardHours = profile ? Number(profile.standardWeeklyHours) : 40.0;
      expectedWeeklyHours = Math.round((standardHours * (Number(allocationPercentage) / 100)) * 100) / 100;
    }

    const updated = await prisma.rdResourceAllocation.update({
      where: { id },
      data: {
        allocationPercentage:
          allocationPercentage !== undefined ? Number(allocationPercentage) : allocation.allocationPercentage,
        expectedWeeklyHours,
        roleInProject: roleInProject || allocation.roleInProject,
        startDate: startDate ? new Date(startDate) : allocation.startDate,
        endDate: endDate ? new Date(endDate) : allocation.endDate,
        status: status || allocation.status,
        notes: notes !== undefined ? notes : allocation.notes,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return updated;
  }

  async deleteAllocation(tenantId, id) {
    const allocation = await prisma.rdResourceAllocation.findFirst({
      where: { tenantId, id },
    });
    if (!allocation) {
      const err = new Error('Resource allocation not found');
      err.statusCode = 404;
      throw err;
    }

    await prisma.rdResourceAllocation.delete({ where: { id } });
    return { success: true, message: 'Resource allocation deleted successfully' };
  }

  // ==============================================================================
  // 3. SKILL MATRIX & EXPERTISE MAPPING (Req 52)
  // ==============================================================================

  async ensureDefaultSkills(tenantId) {
    const count = await prisma.rdSkill.count({ where: { tenantId } });
    if (count === 0) {
      const defaultSkills = [
        { code: 'SKL-ECHEM-01', name: 'Electrochemical Impedance Spectroscopy', cat: 'SCIENTIFIC_RESEARCH', desc: 'Characterization of battery materials and solid electrolytes.' },
        { code: 'SKL-SPECT-01', name: 'Mass Spectrometry & HPLC Analysis', cat: 'LAB_TECHNIQUE', desc: 'Quantitative chromatography and compound identification.' },
        { code: 'SKL-EMBED-01', name: 'Embedded C & RTOS Firmware', cat: 'ENGINEERING', desc: 'Firmware design for real-time battery management systems.' },
        { code: 'SKL-SIMUL-01', name: 'Finite Element Thermal Simulation', cat: 'ENGINEERING', desc: 'COMSOL/ANSYS thermal runaway modeling and simulation.' },
        { code: 'SKL-SYNT-01', name: 'Cathode Precursor Chemical Synthesis', cat: 'SCIENTIFIC_RESEARCH', desc: 'High-purity co-precipitation of NMC precursors.' },
        { code: 'SKL-DATA-01', name: 'Python Scientific Data Modeling', cat: 'DATA_SCIENCE', desc: 'Automated experiment regression analysis and curve fitting.' },
        { code: 'SKL-QUAL-01', name: 'ISO 17025 & GLP Lab Compliance', cat: 'REGULATORY', desc: 'Laboratory standard operating procedures and calibration protocols.' },
        { code: 'SKL-CAD-01', name: 'SolidWorks Mechanical Packaging', cat: 'ENGINEERING', desc: 'Design of high-density battery module enclosures.' },
      ];

      for (const s of defaultSkills) {
        await prisma.rdSkill.create({
          data: {
            tenantId,
            skillCode: s.code,
            name: s.name,
            category: s.cat,
            description: s.desc,
            isActive: true,
          },
        });
      }

      // Automatically map initial skills to users to make matrix rich
      const [allSkills, allUsers] = await Promise.all([
        prisma.rdSkill.findMany({ where: { tenantId } }),
        prisma.user.findMany({ where: { tenantId } }),
      ]);

      const levels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
      for (let uIdx = 0; uIdx < allUsers.length; uIdx++) {
        const u = allUsers[uIdx];
        // Assign 2-4 skills to each user
        const assignedSkills = allSkills.slice(uIdx % 4, (uIdx % 4) + 3);
        for (let sIdx = 0; sIdx < assignedSkills.length; sIdx++) {
          const sk = assignedSkills[sIdx];
          const lvl = levels[(uIdx + sIdx) % levels.length];
          await prisma.rdEmployeeSkill.create({
            data: {
              tenantId,
              userId: u.id,
              skillId: sk.id,
              expertiseLevel: lvl,
              yearsOfExperience: (sIdx + 1) * 2.5,
              isVerified: (uIdx + sIdx) % 2 === 0,
              verifiedByName: (uIdx + sIdx) % 2 === 0 ? 'Dr. Elena Vance (Lead Scientist)' : null,
              notes: `Proficiency demonstrated in ongoing R&D projects.`,
            },
          });
        }
      }
    }
  }

  async listSkills(tenantId, filters = {}) {
    await this.ensureDefaultSkills(tenantId);
    const { category, isActive, search } = filters;
    const where = { tenantId };
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;

    if (search && search.trim()) {
      where.OR = [
        { skillCode: { contains: search.trim() } },
        { name: { contains: search.trim() } },
        { description: { contains: search.trim() } },
      ];
    }

    return await prisma.rdSkill.findMany({
      where,
      include: {
        _count: { select: { employeeSkills: true } },
      },
      orderBy: { skillCode: 'asc' },
    });
  }

  async createSkill(tenantId, data) {
    const { skillCode, name, category = 'SCIENTIFIC_RESEARCH', description, isActive = true } = data;
    if (!skillCode || !name) {
      const err = new Error('skillCode and name are required');
      err.statusCode = 400;
      throw err;
    }

    return await prisma.rdSkill.create({
      data: {
        tenantId,
        skillCode,
        name,
        category,
        description,
        isActive,
      },
    });
  }

  async updateSkill(tenantId, id, data) {
    const skill = await prisma.rdSkill.findFirst({ where: { tenantId, id } });
    if (!skill) {
      const err = new Error('Skill not found');
      err.statusCode = 404;
      throw err;
    }

    return await prisma.rdSkill.update({
      where: { id },
      data: {
        name: data.name || skill.name,
        category: data.category || skill.category,
        description: data.description !== undefined ? data.description : skill.description,
        isActive: data.isActive !== undefined ? data.isActive : skill.isActive,
      },
    });
  }

  async upsertEmployeeSkill(tenantId, data) {
    const { userId, skillId, expertiseLevel = 'INTERMEDIATE', yearsOfExperience = 1.0, certifications, notes } = data;
    if (!userId || !skillId) {
      const err = new Error('userId and skillId are required');
      err.statusCode = 400;
      throw err;
    }

    const existing = await prisma.rdEmployeeSkill.findUnique({
      where: { tenantId_userId_skillId: { tenantId, userId, skillId } },
    });

    if (existing) {
      return await prisma.rdEmployeeSkill.update({
        where: { id: existing.id },
        data: {
          expertiseLevel,
          yearsOfExperience: Number(yearsOfExperience),
          certifications: certifications !== undefined ? certifications : existing.certifications,
          notes: notes !== undefined ? notes : existing.notes,
        },
        include: { skill: true, user: { select: { id: true, name: true, email: true } } },
      });
    }

    return await prisma.rdEmployeeSkill.create({
      data: {
        tenantId,
        userId,
        skillId,
        expertiseLevel,
        yearsOfExperience: Number(yearsOfExperience),
        certifications,
        notes,
      },
      include: { skill: true, user: { select: { id: true, name: true, email: true } } },
    });
  }

  async verifyEmployeeSkill(tenantId, employeeSkillId, verifiedById, verifiedByName) {
    const empSkill = await prisma.rdEmployeeSkill.findFirst({
      where: { tenantId, id: employeeSkillId },
    });
    if (!empSkill) {
      const err = new Error('Employee skill record not found');
      err.statusCode = 404;
      throw err;
    }

    return await prisma.rdEmployeeSkill.update({
      where: { id: employeeSkillId },
      data: {
        isVerified: true,
        verifiedById,
        verifiedByName,
        verifiedAt: new Date(),
      },
      include: { skill: true, user: { select: { id: true, name: true, email: true } } },
    });
  }

  async deleteEmployeeSkill(tenantId, id) {
    const empSkill = await prisma.rdEmployeeSkill.findFirst({
      where: { tenantId, id },
    });
    if (!empSkill) {
      const err = new Error('Employee skill record not found');
      err.statusCode = 404;
      throw err;
    }

    await prisma.rdEmployeeSkill.delete({ where: { id } });
    return { success: true, message: 'Skill removed from employee successfully.' };
  }

  async getSkillMatrix(tenantId, filters = {}) {
    await this.ensureUserProfiles(tenantId);
    await this.ensureDefaultSkills(tenantId);

    const { department } = filters;
    const profileWhere = { tenantId, employmentStatus: 'ACTIVE' };
    if (department) profileWhere.department = department;

    const [profiles, skills, employeeSkills] = await Promise.all([
      prisma.rdResourceProfile.findMany({
        where: profileWhere,
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { employeeCode: 'asc' },
      }),
      prisma.rdSkill.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ category: 'asc' }, { skillCode: 'asc' }],
      }),
      prisma.rdEmployeeSkill.findMany({
        where: { tenantId },
        include: { skill: true },
      }),
    ]);

    // Build 2D matrix: userId -> { [skillId]: { level, years, isVerified, id } }
    const matrix = {};
    const skillCoverage = {};

    for (const sk of skills) {
      skillCoverage[sk.id] = {
        skillId: sk.id,
        skillCode: sk.skillCode,
        name: sk.name,
        category: sk.category,
        totalQualified: 0,
        expertCount: 0,
        advancedCount: 0,
        intermediateCount: 0,
        beginnerCount: 0,
      };
    }

    for (const p of profiles) {
      matrix[p.userId] = {};
    }

    for (const es of employeeSkills) {
      if (matrix[es.userId]) {
        matrix[es.userId][es.skillId] = {
          id: es.id,
          expertiseLevel: es.expertiseLevel,
          yearsOfExperience: Number(es.yearsOfExperience || 0),
          isVerified: es.isVerified,
          verifiedByName: es.verifiedByName,
        };

        if (skillCoverage[es.skillId]) {
          skillCoverage[es.skillId].totalQualified++;
          if (es.expertiseLevel === 'EXPERT') skillCoverage[es.skillId].expertCount++;
          if (es.expertiseLevel === 'ADVANCED') skillCoverage[es.skillId].advancedCount++;
          if (es.expertiseLevel === 'INTERMEDIATE') skillCoverage[es.skillId].intermediateCount++;
          if (es.expertiseLevel === 'BEGINNER') skillCoverage[es.skillId].beginnerCount++;
        }
      }
    }

    return {
      skills,
      employees: profiles.map((p) => ({
        id: p.id,
        userId: p.userId,
        name: p.user.name,
        email: p.user.email,
        employeeCode: p.employeeCode,
        department: p.department,
        designation: p.designation,
      })),
      matrix,
      skillCoverage: Object.values(skillCoverage),
    };
  }

  async searchResourcesBySkills(tenantId, params = {}) {
    const { skillIds = [], minLevel, department, maxAllocationPct = 100 } = params;

    const profileList = await this.listResourceProfiles(tenantId, { department });

    if (!skillIds || skillIds.length === 0) {
      return profileList.filter((p) => p.currentAllocationPercentage <= Number(maxAllocationPct));
    }

    const levelWeights = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3, EXPERT: 4 };
    const requiredMinWeight = minLevel ? levelWeights[minLevel] || 1 : 1;

    const matchedUsers = await prisma.rdEmployeeSkill.findMany({
      where: {
        tenantId,
        skillId: { in: Array.isArray(skillIds) ? skillIds : [skillIds] },
      },
      include: { skill: true },
    });

    const userSkillSummary = {};
    for (const es of matchedUsers) {
      const weight = levelWeights[es.expertiseLevel] || 1;
      if (weight >= requiredMinWeight) {
        if (!userSkillSummary[es.userId]) {
          userSkillSummary[es.userId] = [];
        }
        userSkillSummary[es.userId].push({
          skillId: es.skillId,
          skillName: es.skill.name,
          level: es.expertiseLevel,
          isVerified: es.isVerified,
        });
      }
    }

    return profileList
      .filter(
        (p) =>
          userSkillSummary[p.userId] &&
          userSkillSummary[p.userId].length > 0 &&
          p.currentAllocationPercentage <= Number(maxAllocationPct)
      )
      .map((p) => ({
        ...p,
        matchedSkills: userSkillSummary[p.userId],
      }));
  }

  // ==============================================================================
  // 4. TEAM CAPACITY PLANNING (Req 53)
  // ==============================================================================

  async getCapacityPlanning(tenantId, filters = {}) {
    await this.ensureUserProfiles(tenantId);
    const { department } = filters;

    const profileWhere = { tenantId, employmentStatus: 'ACTIVE' };
    if (department) profileWhere.department = department;

    const [profiles, activeAllocations] = await Promise.all([
      prisma.rdResourceProfile.findMany({
        where: profileWhere,
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { department: 'asc' },
      }),
      prisma.rdResourceAllocation.findMany({
        where: { tenantId, status: 'ACTIVE' },
        include: { project: { select: { id: true, name: true } } },
      }),
    ]);

    const allocByUser = {};
    for (const a of activeAllocations) {
      if (!allocByUser[a.userId]) allocByUser[a.userId] = [];
      allocByUser[a.userId].push(a);
    }

    const resources = profiles.map((p) => {
      const userAllocs = allocByUser[p.userId] || [];
      const standardHours = Number(p.standardWeeklyHours || 40);
      const allocatedHours = userAllocs.reduce((s, a) => s + Number(a.expectedWeeklyHours || 0), 0);
      const allocatedPercentage = userAllocs.reduce((s, a) => s + Number(a.allocationPercentage || 0), 0);
      const remainingHours = Math.max(0, standardHours - allocatedHours);
      const utilizationRate =
        standardHours > 0 ? Math.round((allocatedHours / standardHours) * 100 * 10) / 10 : 0;

      let capacityStatus = 'OPTIMAL';
      if (allocatedPercentage > 100) capacityStatus = 'OVER_ALLOCATED';
      else if (allocatedPercentage < 70) capacityStatus = 'UNDER_UTILIZED';

      return {
        id: p.id,
        userId: p.userId,
        name: p.user.name,
        email: p.user.email,
        employeeCode: p.employeeCode,
        department: p.department,
        designation: p.designation,
        standardWeeklyHours: standardHours,
        allocatedWeeklyHours: allocatedHours,
        remainingWeeklyHours: remainingHours,
        allocatedPercentage,
        utilizationRate,
        capacityStatus,
        allocations: userAllocs.map((a) => ({
          id: a.id,
          projectName: a.project.name,
          percentage: a.allocationPercentage,
          hours: a.expectedWeeklyHours,
        })),
      };
    });

    // Department-level rollups
    const departmentMap = {};
    for (const r of resources) {
      if (!departmentMap[r.department]) {
        departmentMap[r.department] = {
          department: r.department,
          totalHeadcount: 0,
          totalStandardHours: 0,
          totalAllocatedHours: 0,
          totalRemainingHours: 0,
          overAllocatedCount: 0,
        };
      }
      departmentMap[r.department].totalHeadcount++;
      departmentMap[r.department].totalStandardHours += r.standardWeeklyHours;
      departmentMap[r.department].totalAllocatedHours += r.allocatedWeeklyHours;
      departmentMap[r.department].totalRemainingHours += r.remainingWeeklyHours;
      if (r.capacityStatus === 'OVER_ALLOCATED') departmentMap[r.department].overAllocatedCount++;
    }

    const departmentRollups = Object.values(departmentMap).map((d) => ({
      ...d,
      utilizationRate:
        d.totalStandardHours > 0
          ? Math.round((d.totalAllocatedHours / d.totalStandardHours) * 100 * 10) / 10
          : 0,
    }));

    return {
      resources,
      departmentRollups,
      totalHeadcount: resources.length,
      overallStandardHours: resources.reduce((s, r) => s + r.standardWeeklyHours, 0),
      overallAllocatedHours: resources.reduce((s, r) => s + r.allocatedWeeklyHours, 0),
      overallOverAllocatedCount: resources.filter((r) => r.capacityStatus === 'OVER_ALLOCATED').length,
    };
  }

  // ==============================================================================
  // 5. TIMESHEETS & TIME TRACKING (Req 54)
  // ==============================================================================

  async listTimesheets(tenantId, filters = {}) {
    const { userId, status, weekStartDate } = filters;
    const where = { tenantId };
    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (weekStartDate) where.weekStartDate = new Date(weekStartDate);

    return await prisma.rdTimesheet.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
        _count: { select: { timeEntries: true } },
      },
      orderBy: { weekStartDate: 'desc' },
    });
  }

  async getTimesheet(tenantId, id) {
    const timesheet = await prisma.rdTimesheet.findFirst({
      where: { tenantId, id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        timeEntries: {
          include: {
            project: { select: { id: true, name: true } },
            task: { select: { id: true, title: true } },
            experiment: { select: { id: true, title: true, experimentCode: true } },
          },
          orderBy: { workDate: 'asc' },
        },
        histories: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!timesheet) {
      const err = new Error('Timesheet not found');
      err.statusCode = 404;
      throw err;
    }

    return timesheet;
  }

  async getOrCreateWeeklyTimesheet(tenantId, userId, weekStartDateStr) {
    const weekStart = new Date(weekStartDateStr);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    let timesheet = await prisma.rdTimesheet.findFirst({
      where: {
        tenantId,
        userId,
        weekStartDate: weekStart,
      },
      include: {
        timeEntries: {
          include: {
            project: { select: { id: true, name: true } },
            task: { select: { id: true, title: true } },
          },
          orderBy: { workDate: 'asc' },
        },
      },
    });

    if (!timesheet) {
      const code = `TMS-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 899 + 100)}`;
      timesheet = await prisma.rdTimesheet.create({
        data: {
          tenantId,
          userId,
          timesheetCode: code,
          weekStartDate: weekStart,
          weekEndDate: weekEnd,
          totalHours: 0.0,
          status: 'DRAFT',
        },
        include: {
          timeEntries: {
            include: { project: { select: { id: true, name: true } } },
          },
        },
      });

      await prisma.rdTimesheetHistory.create({
        data: {
          tenantId,
          timesheetId: timesheet.id,
          action: 'CREATED',
          previousStatus: null,
          newStatus: 'DRAFT',
          comments: 'Timesheet auto-initialized for work week.',
        },
      });
    }

    return timesheet;
  }

  async addTimeEntry(tenantId, userId, timesheetId, data) {
    const timesheet = await prisma.rdTimesheet.findFirst({
      where: { tenantId, id: timesheetId },
    });
    if (!timesheet) {
      const err = new Error('Timesheet not found');
      err.statusCode = 404;
      throw err;
    }

    if (timesheet.status === 'SUBMITTED' || timesheet.status === 'APPROVED') {
      const err = new Error(`Cannot add entries to timesheet with status '${timesheet.status}'.`);
      err.statusCode = 400;
      throw err;
    }

    const { projectId, taskId, experimentId, workDate, hours, description, workCategory = 'RESEARCH', isBillable = true } = data;
    if (!projectId || !workDate || hours === undefined) {
      const err = new Error('projectId, workDate, and hours are required.');
      err.statusCode = 400;
      throw err;
    }

    // Lookup user's hourly rate from profile
    const profile = await prisma.rdResourceProfile.findUnique({
      where: { userId },
    });
    const hourlyCostRate = profile ? Number(profile.hourlyCostRate) : 75.0;
    const calculatedCost = Math.round(Number(hours) * hourlyCostRate * 100) / 100;

    const entry = await prisma.rdTimeEntry.create({
      data: {
        tenantId,
        timesheetId,
        userId,
        projectId,
        taskId: taskId || null,
        experimentId: experimentId || null,
        workDate: new Date(workDate),
        hours: Number(hours),
        description: description || 'Research and development engineering tasks.',
        workCategory,
        isBillable: isBillable === undefined ? true : Boolean(isBillable),
        hourlyCostRate,
        calculatedCost,
      },
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
        experiment: { select: { id: true, title: true } },
      },
    });

    // Recompute totalHours for timesheet
    const allEntries = await prisma.rdTimeEntry.findMany({
      where: { timesheetId },
      select: { hours: true },
    });
    const totalHours = allEntries.reduce((s, e) => s + Number(e.hours), 0);
    await prisma.rdTimesheet.update({
      where: { id: timesheetId },
      data: { totalHours },
    });

    return entry;
  }

  async deleteTimeEntry(tenantId, entryId) {
    const entry = await prisma.rdTimeEntry.findFirst({
      where: { tenantId, id: entryId },
    });
    if (!entry) {
      const err = new Error('Time entry not found');
      err.statusCode = 404;
      throw err;
    }

    const timesheet = await prisma.rdTimesheet.findFirst({
      where: { id: entry.timesheetId },
    });
    if (timesheet && (timesheet.status === 'SUBMITTED' || timesheet.status === 'APPROVED')) {
      const err = new Error(`Cannot delete entries from timesheet in '${timesheet.status}' status.`);
      err.statusCode = 400;
      throw err;
    }

    await prisma.rdTimeEntry.delete({ where: { id: entryId } });

    // Update totalHours
    const allEntries = await prisma.rdTimeEntry.findMany({
      where: { timesheetId: entry.timesheetId },
      select: { hours: true },
    });
    const totalHours = allEntries.reduce((s, e) => s + Number(e.hours), 0);
    await prisma.rdTimesheet.update({
      where: { id: entry.timesheetId },
      data: { totalHours },
    });

    return { success: true, message: 'Time entry deleted successfully.' };
  }

  async submitTimesheet(tenantId, timesheetId, userId, userName) {
    const timesheet = await prisma.rdTimesheet.findFirst({
      where: { tenantId, id: timesheetId },
    });
    if (!timesheet) {
      const err = new Error('Timesheet not found');
      err.statusCode = 404;
      throw err;
    }

    if (timesheet.status !== 'DRAFT' && timesheet.status !== 'REJECTED') {
      const err = new Error(`Cannot submit timesheet with status '${timesheet.status}'.`);
      err.statusCode = 400;
      throw err;
    }

    const updated = await prisma.rdTimesheet.update({
      where: { id: timesheetId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    await prisma.rdTimesheetHistory.create({
      data: {
        tenantId,
        timesheetId,
        action: 'SUBMITTED',
        previousStatus: timesheet.status,
        newStatus: 'SUBMITTED',
        comments: 'Timesheet submitted for manager approval.',
        performedById: userId,
        performedByName: userName,
      },
    });

    await this._logAudit(
      tenantId,
      userId,
      'Timesheet Submitted',
      `Timesheet ${timesheet.timesheetCode} submitted for approval with ${timesheet.totalHours} hours.`,
      { timesheetId, totalHours: timesheet.totalHours }
    );

    return updated;
  }

  async approveTimesheet(tenantId, timesheetId, reviewerId, reviewerName, notes) {
    const timesheet = await prisma.rdTimesheet.findFirst({
      where: { tenantId, id: timesheetId },
    });
    if (!timesheet) {
      const err = new Error('Timesheet not found');
      err.statusCode = 404;
      throw err;
    }

    if (timesheet.status !== 'SUBMITTED') {
      const err = new Error(`Timesheet must be in 'SUBMITTED' status to be approved.`);
      err.statusCode = 400;
      throw err;
    }

    const updated = await prisma.rdTimesheet.update({
      where: { id: timesheetId },
      data: {
        status: 'APPROVED',
        reviewedById: reviewerId,
        reviewedByName: reviewerName,
        reviewedAt: new Date(),
        approvalNotes: notes || 'Timesheet approved by R&D Manager.',
      },
    });

    await prisma.rdTimesheetHistory.create({
      data: {
        tenantId,
        timesheetId,
        action: 'APPROVED',
        previousStatus: timesheet.status,
        newStatus: 'APPROVED',
        comments: notes || 'Timesheet approved.',
        performedById: reviewerId,
        performedByName: reviewerName,
      },
    });

    await this._logAudit(
      tenantId,
      reviewerId,
      'Timesheet Approved',
      `Timesheet ${timesheet.timesheetCode} approved by ${reviewerName}.`,
      { timesheetId, reviewerId }
    );

    return updated;
  }

  async rejectTimesheet(tenantId, timesheetId, reviewerId, reviewerName, reason) {
    const timesheet = await prisma.rdTimesheet.findFirst({
      where: { tenantId, id: timesheetId },
    });
    if (!timesheet) {
      const err = new Error('Timesheet not found');
      err.statusCode = 404;
      throw err;
    }

    if (timesheet.status !== 'SUBMITTED') {
      const err = new Error(`Timesheet must be in 'SUBMITTED' status to be rejected.`);
      err.statusCode = 400;
      throw err;
    }

    const updated = await prisma.rdTimesheet.update({
      where: { id: timesheetId },
      data: {
        status: 'REJECTED',
        reviewedById: reviewerId,
        reviewedByName: reviewerName,
        reviewedAt: new Date(),
        approvalNotes: reason || 'Revision required.',
      },
    });

    await prisma.rdTimesheetHistory.create({
      data: {
        tenantId,
        timesheetId,
        action: 'REJECTED',
        previousStatus: timesheet.status,
        newStatus: 'REJECTED',
        comments: reason || 'Timesheet rejected.',
        performedById: reviewerId,
        performedByName: reviewerName,
      },
    });

    return updated;
  }

  // ==============================================================================
  // 6. COST & BUDGET INTEGRATION WITH MP09 (Req 55, 56, 57)
  // ==============================================================================

  async getProjectLaborCostSummary(tenantId, projectId) {
    // 1. Fetch approved actual hours and costs from time entries
    const actualEntries = await prisma.rdTimeEntry.findMany({
      where: {
        tenantId,
        projectId,
        timesheet: { status: 'APPROVED' },
      },
    });

    const actualHours = actualEntries.reduce((s, e) => s + Number(e.hours), 0);
    const actualCost = actualEntries.reduce((s, e) => s + Number(e.calculatedCost), 0);

    // 2. Fetch planned hours and costs from allocations
    const allocations = await prisma.rdResourceAllocation.findMany({
      where: { tenantId, projectId, status: 'ACTIVE' },
      include: { user: { include: { resourceProfile: true } } },
    });

    let plannedHoursTotal = 0;
    let plannedCostTotal = 0;

    for (const alloc of allocations) {
      const weeklyHours = Number(alloc.expectedWeeklyHours || 0);
      const start = new Date(alloc.startDate);
      const end = new Date(alloc.endDate);
      const weeks = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 7)));
      const totalHoursForAlloc = weeklyHours * weeks;
      const rate = alloc.user.resourceProfile ? Number(alloc.user.resourceProfile.hourlyCostRate) : 75.0;

      plannedHoursTotal += totalHoursForAlloc;
      plannedCostTotal += totalHoursForAlloc * rate;
    }

    // 3. Compare with MP09 Project Budget PERSONNEL allocation if available
    const projectBudget = await prisma.rdProjectBudget.findFirst({
      where: { tenantId, projectId },
      include: {
        allocations: {
          where: { category: 'PERSONNEL' },
        },
      },
    });

    const budgetPersonnelAllocation = projectBudget?.allocations?.[0] || null;
    const budgetedAmount = budgetPersonnelAllocation ? Number(budgetPersonnelAllocation.plannedAmount) : plannedCostTotal;
    const variance = budgetedAmount - actualCost;

    return {
      projectId,
      actualHours,
      actualCost: Math.round(actualCost * 100) / 100,
      plannedHours: plannedHoursTotal,
      plannedCost: Math.round(plannedCostTotal * 100) / 100,
      budgetedAmount: Math.round(budgetedAmount * 100) / 100,
      costVariance: Math.round(variance * 100) / 100,
      burnRatePercentage: budgetedAmount > 0 ? Math.round((actualCost / budgetedAmount) * 100 * 10) / 10 : 0,
      activeAllocationsCount: allocations.length,
      approvedTimeEntriesCount: actualEntries.length,
    };
  }

  // ==============================================================================
  // 7. RESOURCE UTILIZATION METRICS (Req 58)
  // ==============================================================================

  async getUtilizationMetrics(tenantId, filters = {}) {
    const { department, projectId } = filters;

    const [profiles, timeEntries, allocations] = await Promise.all([
      prisma.rdResourceProfile.findMany({
        where: {
          tenantId,
          employmentStatus: 'ACTIVE',
          ...(department ? { department } : {}),
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.rdTimeEntry.findMany({
        where: {
          tenantId,
          timesheet: { status: 'APPROVED' },
          ...(projectId ? { projectId } : {}),
        },
      }),
      prisma.rdResourceAllocation.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          ...(projectId ? { projectId } : {}),
        },
      }),
    ]);

    const actualHoursByUser = {};
    for (const e of timeEntries) {
      actualHoursByUser[e.userId] = (actualHoursByUser[e.userId] || 0) + Number(e.hours);
    }

    const plannedHoursByUser = {};
    for (const a of allocations) {
      plannedHoursByUser[a.userId] = (plannedHoursByUser[a.userId] || 0) + Number(a.expectedWeeklyHours);
    }

    const employeeMetrics = profiles.map((p) => {
      const standardHours = Number(p.standardWeeklyHours || 40);
      const actualWeeklyAvgHours = actualHoursByUser[p.userId] || 0;
      const plannedWeeklyHours = plannedHoursByUser[p.userId] || 0;

      const actualUtilizationPct =
        standardHours > 0 ? Math.round((actualWeeklyAvgHours / standardHours) * 100 * 10) / 10 : 0;
      const plannedUtilizationPct =
        standardHours > 0 ? Math.round((plannedWeeklyHours / standardHours) * 100 * 10) / 10 : 0;

      return {
        userId: p.userId,
        name: p.user.name,
        email: p.user.email,
        employeeCode: p.employeeCode,
        department: p.department,
        designation: p.designation,
        standardWeeklyHours: standardHours,
        plannedWeeklyHours,
        actualApprovedHours: actualWeeklyAvgHours,
        plannedUtilizationPct,
        actualUtilizationPct,
        variancePct: Math.round((actualUtilizationPct - plannedUtilizationPct) * 10) / 10,
      };
    });

    const totalStandard = employeeMetrics.reduce((s, m) => s + m.standardWeeklyHours, 0);
    const totalPlanned = employeeMetrics.reduce((s, m) => s + m.plannedWeeklyHours, 0);
    const totalActual = employeeMetrics.reduce((s, m) => s + m.actualApprovedHours, 0);

    return {
      employees: employeeMetrics,
      summary: {
        totalHeadcount: employeeMetrics.length,
        overallStandardHours: totalStandard,
        overallPlannedHours: totalPlanned,
        overallActualHours: totalActual,
        overallPlannedUtilizationPct:
          totalStandard > 0 ? Math.round((totalPlanned / totalStandard) * 100 * 10) / 10 : 0,
        overallActualUtilizationPct:
          totalStandard > 0 ? Math.round((totalActual / totalStandard) * 100 * 10) / 10 : 0,
      },
    };
  }

  // ==============================================================================
  // 8. SHARED LAB FACILITIES & EQUIPMENT MANAGEMENT (Req 59)
  // ==============================================================================

  async ensureDefaultFacilities(tenantId) {
    const facilityCount = await prisma.rdFacility.count({ where: { tenantId } });
    if (facilityCount === 0) {
      const defaults = [
        {
          code: 'FAC-CHEM-01',
          name: 'Advanced Chemistry & Synthesis Lab',
          type: 'CHEMISTRY_LAB',
          desc: 'Synthetic chemistry fume hoods, glove boxes, and chemical safety equipment.',
          loc: 'Main Campus',
          bld: 'Research Pavilion Alpha',
          flr: 'Level 2',
          cap: 12,
          open: '08:00',
          close: '21:00',
        },
        {
          code: 'FAC-BAT-01',
          name: 'Battery Prototyping Cleanroom',
          type: 'CLEANROOM',
          desc: 'Dry room (<1% RH) for pouch cell and cylindrical cell assembly.',
          loc: 'Main Campus',
          bld: 'Cleanroom Complex Beta',
          flr: 'Basement 1',
          cap: 8,
          open: '07:00',
          close: '22:00',
        },
        {
          code: 'FAC-TEST-01',
          name: 'High-Voltage Electrochemistry & Cycler Bay',
          type: 'TESTING_FACILITY',
          desc: 'High-current cell cycling, impedance testing, and environmental testing chambers.',
          loc: 'Tech Center East',
          bld: 'Energy Storage Test Wing',
          flr: 'Ground Floor',
          cap: 15,
          open: '08:00',
          close: '20:00',
        },
      ];

      for (const f of defaults) {
        const facility = await prisma.rdFacility.create({
          data: {
            tenantId,
            facilityCode: f.code,
            name: f.name,
            facilityType: f.type,
            description: f.desc,
            location: f.loc,
            building: f.bld,
            floor: f.flr,
            capacity: f.cap,
            operatingHoursStart: f.open,
            operatingHoursEnd: f.close,
            availabilityStatus: 'AVAILABLE',
          },
        });

        // Add default equipment to each facility
        if (f.code === 'FAC-CHEM-01') {
          await prisma.rdLabEquipment.create({
            data: {
              tenantId,
              facilityId: facility.id,
              equipmentCode: 'EQP-HPLC-01',
              name: 'Shimadzu Prominence HPLC System',
              category: 'CHROMATOGRAPHY',
              description: 'High-performance liquid chromatography for electrolyte decomposition tracking.',
              manufacturer: 'Shimadzu Corp',
              modelNumber: 'LC-20AD',
              serialNumber: 'SHZ-882910',
              operationalStatus: 'AVAILABLE',
              hourlyUsageRate: 35.0,
            },
          });
        } else if (f.code === 'FAC-BAT-01') {
          await prisma.rdLabEquipment.create({
            data: {
              tenantId,
              facilityId: facility.id,
              equipmentCode: 'EQP-GLOVE-01',
              name: 'MBRAUN Dual-Workstation Glovebox (Ar)',
              category: 'GLOVEBOX',
              description: 'Ultra-pure argon atmosphere (<0.1 ppm H2O and O2) for lithium handling.',
              manufacturer: 'MBRAUN',
              modelNumber: 'LABstar Pro',
              serialNumber: 'MB-449102',
              operationalStatus: 'AVAILABLE',
              hourlyUsageRate: 45.0,
            },
          });
        } else if (f.code === 'FAC-TEST-01') {
          await prisma.rdLabEquipment.create({
            data: {
              tenantId,
              facilityId: facility.id,
              equipmentCode: 'EQP-CYCL-01',
              name: 'Arbin Instruments 64-Channel Battery Cycler',
              category: 'CYCLER',
              description: 'Multi-channel high-precision charge/discharge battery cycler.',
              manufacturer: 'Arbin Instruments',
              modelNumber: 'LBT21084',
              serialNumber: 'ARB-9921',
              operationalStatus: 'AVAILABLE',
              hourlyUsageRate: 50.0,
            },
          });
        }
      }
    }
  }

  async listFacilities(tenantId, filters = {}) {
    await this.ensureDefaultFacilities(tenantId);
    const { facilityType, availabilityStatus, search } = filters;
    const where = { tenantId };
    if (facilityType) where.facilityType = facilityType;
    if (availabilityStatus) where.availabilityStatus = availabilityStatus;

    if (search && search.trim()) {
      where.OR = [
        { facilityCode: { contains: search.trim() } },
        { name: { contains: search.trim() } },
        { location: { contains: search.trim() } },
        { building: { contains: search.trim() } },
      ];
    }

    return await prisma.rdFacility.findMany({
      where,
      include: {
        equipment: true,
        _count: { select: { bookings: true } },
      },
      orderBy: { facilityCode: 'asc' },
    });
  }

  async getFacility(tenantId, id) {
    await this.ensureDefaultFacilities(tenantId);
    const facility = await prisma.rdFacility.findFirst({
      where: { tenantId, id },
      include: {
        equipment: {
          include: {
            maintenances: { orderBy: { startDate: 'desc' }, take: 3 },
          },
        },
        bookings: {
          where: { endDateTime: { gte: new Date() } },
          orderBy: { startDateTime: 'asc' },
          take: 10,
          include: {
            requestedBy: { select: { id: true, name: true, email: true } },
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!facility) {
      const err = new Error('Facility not found');
      err.statusCode = 404;
      throw err;
    }

    return facility;
  }

  async createFacility(tenantId, data) {
    const {
      facilityCode,
      name,
      facilityType = 'CHEMISTRY_LAB',
      description,
      location = 'Main Campus',
      building = 'Building A',
      floor = '1st Floor',
      capacity = 10,
      operatingHoursStart = '08:00',
      operatingHoursEnd = '20:00',
      accessRestrictions,
    } = data;

    if (!facilityCode || !name) {
      const err = new Error('facilityCode and name are required');
      err.statusCode = 400;
      throw err;
    }

    return await prisma.rdFacility.create({
      data: {
        tenantId,
        facilityCode,
        name,
        facilityType,
        description,
        location,
        building,
        floor,
        capacity: Number(capacity),
        operatingHoursStart,
        operatingHoursEnd,
        accessRestrictions,
        availabilityStatus: 'AVAILABLE',
      },
    });
  }

  async updateFacility(tenantId, id, data) {
    const facility = await prisma.rdFacility.findFirst({ where: { tenantId, id } });
    if (!facility) {
      const err = new Error('Facility not found');
      err.statusCode = 404;
      throw err;
    }

    return await prisma.rdFacility.update({
      where: { id },
      data: {
        name: data.name || facility.name,
        facilityType: data.facilityType || facility.facilityType,
        description: data.description !== undefined ? data.description : facility.description,
        location: data.location || facility.location,
        building: data.building || facility.building,
        floor: data.floor || facility.floor,
        capacity: data.capacity !== undefined ? Number(data.capacity) : facility.capacity,
        operatingHoursStart: data.operatingHoursStart || facility.operatingHoursStart,
        operatingHoursEnd: data.operatingHoursEnd || facility.operatingHoursEnd,
        availabilityStatus: data.availabilityStatus || facility.availabilityStatus,
        accessRestrictions: data.accessRestrictions !== undefined ? data.accessRestrictions : facility.accessRestrictions,
      },
    });
  }

  async deleteFacility(tenantId, id) {
    const facility = await prisma.rdFacility.findFirst({ where: { tenantId, id } });
    if (!facility) {
      const err = new Error('Facility not found');
      err.statusCode = 404;
      throw err;
    }

    await prisma.rdFacility.delete({ where: { id } });
    return { success: true, message: 'Facility deleted successfully.' };
  }

  // ==============================================================================
  // EQUIPMENT CRUD (Req 59)
  // ==============================================================================

  async listEquipment(tenantId, filters = {}) {
    await this.ensureDefaultFacilities(tenantId);
    const { facilityId, category, operationalStatus, search } = filters;
    const where = { tenantId };
    if (facilityId) where.facilityId = facilityId;
    if (category) where.category = category;
    if (operationalStatus) where.operationalStatus = operationalStatus;

    if (search && search.trim()) {
      where.OR = [
        { equipmentCode: { contains: search.trim() } },
        { name: { contains: search.trim() } },
        { manufacturer: { contains: search.trim() } },
        { modelNumber: { contains: search.trim() } },
      ];
    }

    return await prisma.rdLabEquipment.findMany({
      where,
      include: {
        facility: { select: { id: true, name: true, facilityCode: true, location: true } },
        maintenances: {
          where: { status: 'SCHEDULED' },
          orderBy: { startDate: 'asc' },
          take: 1,
        },
      },
      orderBy: { equipmentCode: 'asc' },
    });
  }

  async getEquipment(tenantId, id) {
    const eqp = await prisma.rdLabEquipment.findFirst({
      where: { tenantId, id },
      include: {
        facility: true,
        maintenances: { orderBy: { startDate: 'desc' } },
        bookings: {
          where: { endDateTime: { gte: new Date() } },
          orderBy: { startDateTime: 'asc' },
          include: {
            requestedBy: { select: { id: true, name: true, email: true } },
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!eqp) {
      const err = new Error('Lab equipment not found');
      err.statusCode = 404;
      throw err;
    }

    return eqp;
  }

  async createEquipment(tenantId, data) {
    const {
      facilityId,
      equipmentCode,
      name,
      category = 'SPECTROSCOPY',
      description,
      manufacturer,
      modelNumber,
      serialNumber,
      hourlyUsageRate = 0.0,
      usageRestrictions,
    } = data;

    if (!facilityId || !equipmentCode || !name) {
      const err = new Error('facilityId, equipmentCode, and name are required');
      err.statusCode = 400;
      throw err;
    }

    return await prisma.rdLabEquipment.create({
      data: {
        tenantId,
        facilityId,
        equipmentCode,
        name,
        category,
        description,
        manufacturer,
        modelNumber,
        serialNumber,
        hourlyUsageRate: Number(hourlyUsageRate),
        usageRestrictions,
        operationalStatus: 'AVAILABLE',
      },
      include: { facility: true },
    });
  }

  async updateEquipment(tenantId, id, data) {
    const eqp = await prisma.rdLabEquipment.findFirst({ where: { tenantId, id } });
    if (!eqp) {
      const err = new Error('Equipment not found');
      err.statusCode = 404;
      throw err;
    }

    return await prisma.rdLabEquipment.update({
      where: { id },
      data: {
        name: data.name || eqp.name,
        category: data.category || eqp.category,
        description: data.description !== undefined ? data.description : eqp.description,
        manufacturer: data.manufacturer !== undefined ? data.manufacturer : eqp.manufacturer,
        modelNumber: data.modelNumber !== undefined ? data.modelNumber : eqp.modelNumber,
        serialNumber: data.serialNumber !== undefined ? data.serialNumber : eqp.serialNumber,
        operationalStatus: data.operationalStatus || eqp.operationalStatus,
        calibrationDueDate: data.calibrationDueDate ? new Date(data.calibrationDueDate) : eqp.calibrationDueDate,
        maintenanceDueDate: data.maintenanceDueDate ? new Date(data.maintenanceDueDate) : eqp.maintenanceDueDate,
        hourlyUsageRate:
          data.hourlyUsageRate !== undefined ? Number(data.hourlyUsageRate) : eqp.hourlyUsageRate,
        usageRestrictions: data.usageRestrictions !== undefined ? data.usageRestrictions : eqp.usageRestrictions,
      },
    });
  }

  async deleteEquipment(tenantId, id) {
    const eqp = await prisma.rdLabEquipment.findFirst({ where: { tenantId, id } });
    if (!eqp) {
      const err = new Error('Equipment not found');
      err.statusCode = 404;
      throw err;
    }

    await prisma.rdLabEquipment.delete({ where: { id } });
    return { success: true, message: 'Lab equipment deleted successfully.' };
  }

  // ==============================================================================
  // MAINTENANCE & CALIBRATION (Req 59)
  // ==============================================================================

  async scheduleMaintenance(tenantId, data) {
    const {
      equipmentId,
      maintenanceType = 'PREVENTATIVE',
      title,
      description,
      startDate,
      endDate,
      performedById,
      performedByName,
      notes,
    } = data;

    if (!equipmentId || !title || !startDate || !endDate) {
      const err = new Error('equipmentId, title, startDate, and endDate are required');
      err.statusCode = 400;
      throw err;
    }

    const eqp = await prisma.rdLabEquipment.findFirst({ where: { tenantId, id: equipmentId } });
    if (!eqp) {
      const err = new Error('Equipment not found');
      err.statusCode = 404;
      throw err;
    }

    const maintenance = await prisma.rdEquipmentMaintenance.create({
      data: {
        tenantId,
        equipmentId,
        maintenanceType,
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'SCHEDULED',
        performedById,
        performedByName,
        notes,
      },
    });

    // If starting now or earlier, update equipment status to UNDER_MAINTENANCE
    if (new Date(startDate) <= new Date()) {
      await prisma.rdLabEquipment.update({
        where: { id: equipmentId },
        data: { operationalStatus: 'UNDER_MAINTENANCE' },
      });
    }

    return maintenance;
  }

  async completeMaintenance(tenantId, maintenanceId, data = {}) {
    const { calibrationCertificateNumber, notes } = data;
    const maintenance = await prisma.rdEquipmentMaintenance.findFirst({
      where: { tenantId, id: maintenanceId },
    });
    if (!maintenance) {
      const err = new Error('Maintenance record not found');
      err.statusCode = 404;
      throw err;
    }

    const completed = await prisma.rdEquipmentMaintenance.update({
      where: { id: maintenanceId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        calibrationCertificateNumber: calibrationCertificateNumber || maintenance.calibrationCertificateNumber,
        notes: notes !== undefined ? notes : maintenance.notes,
      },
    });

    // Reset equipment status to AVAILABLE and extend calibration due date (e.g. +6 months)
    const nextCalib = new Date();
    nextCalib.setMonth(nextCalib.getMonth() + 6);

    await prisma.rdLabEquipment.update({
      where: { id: maintenance.equipmentId },
      data: {
        operationalStatus: 'AVAILABLE',
        calibrationDueDate: nextCalib,
        maintenanceDueDate: nextCalib,
      },
    });

    return completed;
  }

  // ==============================================================================
  // 9. FACILITY & EQUIPMENT BOOKINGS WITH CONFLICT PREVENTION (Req 59, 60)
  // ==============================================================================

  async listBookings(tenantId, filters = {}) {
    const { facilityId, equipmentId, projectId, status, startDate, endDate } = filters;
    const where = { tenantId };
    if (facilityId) where.facilityId = facilityId;
    if (equipmentId) where.equipmentId = equipmentId;
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    if (startDate && endDate) {
      where.startDateTime = { gte: new Date(startDate) };
      where.endDateTime = { lte: new Date(endDate) };
    }

    return await prisma.rdFacilityBooking.findMany({
      where,
      include: {
        facility: { select: { id: true, name: true, facilityCode: true, location: true } },
        equipment: { select: { id: true, name: true, equipmentCode: true } },
        project: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startDateTime: 'desc' },
    });
  }

  async getBooking(tenantId, id) {
    const booking = await prisma.rdFacilityBooking.findFirst({
      where: { tenantId, id },
      include: {
        facility: true,
        equipment: true,
        project: { select: { id: true, name: true } },
        experiment: { select: { id: true, title: true, experimentCode: true } },
        task: { select: { id: true, title: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        histories: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!booking) {
      const err = new Error('Booking not found');
      err.statusCode = 404;
      throw err;
    }

    return booking;
  }

  async createBooking(tenantId, requestedById, requestedByName, data) {
    const {
      resourceType = 'FACILITY', // 'FACILITY' or 'EQUIPMENT'
      facilityId,
      equipmentId,
      projectId,
      experimentId,
      taskId,
      bookingDate,
      startTime = '09:00',
      endTime = '12:00',
      startDateTime,
      endDateTime,
      purpose,
      notes,
    } = data;

    if (!projectId || !purpose) {
      const err = new Error('projectId and purpose are required.');
      err.statusCode = 400;
      throw err;
    }

    if (resourceType === 'FACILITY' && !facilityId) {
      const err = new Error('facilityId is required for facility bookings.');
      err.statusCode = 400;
      throw err;
    }

    if (resourceType === 'EQUIPMENT' && !equipmentId) {
      const err = new Error('equipmentId is required for equipment bookings.');
      err.statusCode = 400;
      throw err;
    }

    // Determine actual start & end DateTimes
    let sDate = startDateTime ? new Date(startDateTime) : null;
    let eDate = endDateTime ? new Date(endDateTime) : null;

    if (!sDate || !eDate) {
      const baseDate = bookingDate ? new Date(bookingDate) : new Date();
      const [sH, sM] = (startTime || '09:00').split(':').map(Number);
      const [eH, eM] = (endTime || '12:00').split(':').map(Number);

      sDate = new Date(baseDate);
      sDate.setHours(sH, sM, 0, 0);

      eDate = new Date(baseDate);
      eDate.setHours(eH, eM, 0, 0);
    }

    if (eDate <= sDate) {
      const err = new Error('End date/time must be strictly after start date/time.');
      err.statusCode = 400;
      throw err;
    }

    // 1. Check operational status for equipment
    if (equipmentId) {
      const eqp = await prisma.rdLabEquipment.findFirst({ where: { tenantId, id: equipmentId } });
      if (!eqp) {
        const err = new Error('Equipment not found');
        err.statusCode = 404;
        throw err;
      }
      if (eqp.operationalStatus === 'OUT_OF_SERVICE' || eqp.operationalStatus === 'UNDER_MAINTENANCE') {
        const err = new Error(
          `Booking rejected: Equipment '${eqp.name}' is currently unavailable (Status: ${eqp.operationalStatus}).`
        );
        err.statusCode = 400;
        throw err;
      }
    }

    // 2. Strict Overlap Check (Conflict Prevention)
    const conflictQuery = {
      tenantId,
      status: { in: ['CONFIRMED', 'PENDING_APPROVAL', 'IN_PROGRESS'] },
      startDateTime: { lt: eDate },
      endDateTime: { gt: sDate },
    };

    if (resourceType === 'EQUIPMENT' && equipmentId) {
      conflictQuery.equipmentId = equipmentId;
    } else if (facilityId) {
      conflictQuery.facilityId = facilityId;
    }

    const conflictingBookings = await prisma.rdFacilityBooking.findMany({
      where: conflictQuery,
      include: {
        requestedBy: { select: { name: true } },
        project: { select: { name: true } },
      },
    });

    if (conflictingBookings.length > 0) {
      const conf = conflictingBookings[0];
      const err = new Error(
        `Scheduling Conflict: Resource is already booked from ${new Date(
          conf.startDateTime
        ).toLocaleTimeString()} to ${new Date(conf.endDateTime).toLocaleTimeString()} for project '${
          conf.project.name
        }' by ${conf.requestedBy.name} (Booking Code: ${conf.bookingCode}).`
      );
      err.statusCode = 409;
      err.conflict = conf;
      throw err;
    }

    const bookingCode = `BK-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 899 + 100)}`;

    const booking = await prisma.rdFacilityBooking.create({
      data: {
        tenantId,
        bookingCode,
        resourceType,
        facilityId: facilityId || null,
        equipmentId: equipmentId || null,
        projectId,
        experimentId: experimentId || null,
        taskId: taskId || null,
        requestedById,
        requestedByName,
        bookingDate: sDate,
        startTime: startTime || sDate.toTimeString().substring(0, 5),
        endTime: endTime || eDate.toTimeString().substring(0, 5),
        startDateTime: sDate,
        endDateTime: eDate,
        purpose,
        status: 'CONFIRMED',
        notes,
      },
      include: {
        facility: { select: { id: true, name: true, facilityCode: true } },
        equipment: { select: { id: true, name: true, equipmentCode: true } },
        project: { select: { id: true, name: true } },
      },
    });

    await prisma.rdBookingHistory.create({
      data: {
        tenantId,
        bookingId: booking.id,
        action: 'CONFIRMED',
        previousStatus: null,
        newStatus: 'CONFIRMED',
        notes: `Booking confirmed for ${resourceType}.`,
        performedById: requestedById,
        performedByName: requestedByName,
      },
    });

    await this._logAudit(
      tenantId,
      requestedById,
      'Facility/Equipment Booked',
      `Booked ${booking.facility?.name || booking.equipment?.name} for ${booking.project.name} (${sDate.toLocaleDateString()})`,
      { bookingId: booking.id, bookingCode }
    );

    return booking;
  }

  async cancelBooking(tenantId, bookingId, userId, userName, reason) {
    const booking = await prisma.rdFacilityBooking.findFirst({
      where: { tenantId, id: bookingId },
    });
    if (!booking) {
      const err = new Error('Booking not found');
      err.statusCode = 404;
      throw err;
    }

    const updated = await prisma.rdFacilityBooking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason || 'Cancelled by user.',
      },
    });

    await prisma.rdBookingHistory.create({
      data: {
        tenantId,
        bookingId,
        action: 'CANCELLED',
        previousStatus: booking.status,
        newStatus: 'CANCELLED',
        notes: reason || 'Booking cancelled.',
        performedById: userId,
        performedByName: userName,
      },
    });

    return updated;
  }
}

module.exports = new RdResourceService();
