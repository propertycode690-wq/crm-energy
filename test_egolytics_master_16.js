/**
 * Comprehensive Verification Battery for Master Prompt 16:
 * IP Management, SOP Compliance, Immutable Audit Trail, Scoped API Keys, Universal Export & Enterprise QA
 */

const http = require('http');

const PORT = 5002;
const BASE_HOST = '127.0.0.1';

// Helper for making HTTP requests
function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer demo-business-owner-token',
      ...headers
    };

    let postData = null;
    if (body) {
      if (typeof body === 'string') {
        postData = body;
      } else {
        postData = JSON.stringify(body);
      }
      defaultHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: BASE_HOST,
      port: PORT,
      path,
      method,
      headers: defaultHeaders
    };

    const req = http.request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(rawData);
        } catch (e) {
          parsed = rawData;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runMaster16Tests() {
  console.log('================================================================');
  console.log('   EGOLYTICS MASTER PROMPT 16: ENTERPRISE QA & VERIFICATION    ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Telemetry & Active Module Catalog
    // -------------------------------------------------------------
    console.log('[Test Suite 1: Roadmap & Architecture Boundaries]');
    const statusRes = await makeRequest('GET', '/api/rd/status');
    assert(statusRes.statusCode === 200, 'GET /api/rd/status returns 200 OK');
    assert(statusRes.data.data.boundaries.enterpriseQa.includes('ACTIVE'), 'Boundaries mark enterpriseQa as ACTIVE');

    const modulesRes = await makeRequest('GET', '/api/rd/modules');
    const modules = modulesRes.data.data;
    const mod14 = modules.find(m => m.id === 'mod-14-ip-patents');
    const mod15 = modules.find(m => m.id === 'mod-15-compliance');
    const mod16 = modules.find(m => m.id === 'mod-16-analytics');
    assert(mod14 && mod14.status === 'ACTIVE', 'Module 14 (IP/Patents) is ACTIVE');
    assert(mod15 && mod15.status === 'ACTIVE', 'Module 15 (Compliance) is ACTIVE');
    assert(mod16 && mod16.status === 'ACTIVE', 'Module 16 (Enterprise QA/Analytics) is ACTIVE');

    // -------------------------------------------------------------
    // Test 2: Intellectual Property Asset Creation & Lifecycle
    // -------------------------------------------------------------
    console.log('\n[Test Suite 2: Intellectual Property & Patent Registry]');
    const newIp = {
      title: 'Solid-State Battery Electrolyte Formulation with High Thermal Stability',
      description: 'Novel composite ceramic-polymer electrolyte enabling 500 Wh/kg specific energy.',
      category: 'PATENT',
      jurisdiction: 'US',
      applicationNumber: 'US17/998,421',
      claimsCount: 14,
      inventors: ['Dr. Elena Rostova', 'Marcus Chen'],
      notes: 'Priority date established. Submitted under accelerated examination.'
    };

    const createIpRes = await makeRequest('POST', '/api/rd/enterprise/ip', newIp);
    assert(createIpRes.statusCode === 201, 'POST /api/rd/enterprise/ip creates IP asset (201 Created)');
    const createdAsset = createIpRes.data.data;
    assert(createdAsset.title === newIp.title, 'Created IP asset title matches');
    assert(createdAsset.status === 'INVENTION_DISCLOSURE', 'Initial IP status defaults to INVENTION_DISCLOSURE');

    // Update IP Status / Lifecycle Transition
    const updateIpRes = await makeRequest('PUT', `/api/rd/enterprise/ip/${createdAsset.id}`, {
      status: 'APPLICATION_SUBMITTED',
      patentNumber: 'US11849200B1'
    });
    assert(updateIpRes.statusCode === 200, 'PUT /api/rd/enterprise/ip/:id updates lifecycle status');
    assert(updateIpRes.data.data.status === 'APPLICATION_SUBMITTED', 'Status advanced to APPLICATION_SUBMITTED');

    // Fetch IP Metrics
    const ipMetricsRes = await makeRequest('GET', '/api/rd/enterprise/ip/metrics');
    assert(ipMetricsRes.statusCode === 200, 'GET /api/rd/enterprise/ip/metrics returns 200 OK');
    assert(ipMetricsRes.data.data.totalAssets >= 1, 'IP metrics reflects created asset count');

    // -------------------------------------------------------------
    // Test 3: Regulatory Compliance, SOPs & Checklists
    // -------------------------------------------------------------
    console.log('\n[Test Suite 3: Regulatory Compliance, SOPs & Governance]');
    const newSop = {
      sopIdentifier: `SOP-RD-TEST-${Date.now().toString().slice(-4)}`,
      title: 'High-Temperature Chemical Vapor Deposition Safety Protocol',
      category: 'LAB_SAFETY',
      regulatoryStandard: 'ISO 9001 / GLP',
      version: '1.0',
      description: 'Mandatory personal protective equipment, exhaust ventilation, and emergency shutoff procedures.'
    };

    const createSopRes = await makeRequest('POST', '/api/rd/enterprise/compliance/sops', newSop);
    assert(createSopRes.statusCode === 201, 'POST /api/rd/enterprise/compliance/sops creates SOP (201 Created)');
    const createdSop = createSopRes.data.data;
    assert(createdSop.approvalStatus === 'DRAFT', 'New SOP starts in DRAFT status');

    // Add Checklist Step
    const addChecklistRes = await makeRequest('POST', `/api/rd/enterprise/compliance/sops/${createdSop.id}/checklists`, {
      requirement: 'Verify negative chamber pressure before gas line introduction',
      verificationMethod: 'Barometric Sensor Differential Log'
    });
    assert(addChecklistRes.statusCode === 200, 'POST /api/rd/enterprise/compliance/sops/:id/checklists adds checklist item');
    assert(addChecklistRes.data.data.checklists.length >= 1, 'SOP checklist array populated');

    // Record Non-Compliance Deviation
    const incidentRes = await makeRequest('POST', `/api/rd/enterprise/compliance/sops/${createdSop.id}/incidents`, {
      severity: 'MEDIUM',
      description: 'Exhaust scrubber pressure dropped 5% below standard threshold during run #4.',
      correctiveAction: 'Replaced inline pre-filter and re-calibrated transducer.'
    });
    assert(incidentRes.statusCode === 200, 'POST /api/rd/enterprise/compliance/sops/:id/incidents records deviation');

    // Formal Governance Approval
    const approveSopRes = await makeRequest('POST', `/api/rd/enterprise/compliance/sops/${createdSop.id}/approve`, {
      isApproved: true,
      comments: 'Protocol reviewed and verified compliant with GLP standards by Chief Safety Officer.'
    });
    assert(approveSopRes.statusCode === 200, 'POST /api/rd/enterprise/compliance/sops/:id/approve signs off SOP');
    assert(approveSopRes.data.data.approvalStatus === 'APPROVED', 'SOP status transitioned to APPROVED');

    // -------------------------------------------------------------
    // Test 4: Immutable Enterprise Audit Trail
    // -------------------------------------------------------------
    console.log('\n[Test Suite 4: Immutable Enterprise Audit Trail]');
    const auditLogsRes = await makeRequest('GET', '/api/rd/enterprise/audit/logs');
    assert(auditLogsRes.statusCode === 200, 'GET /api/rd/enterprise/audit/logs returns 200 OK');
    const logs = auditLogsRes.data.data;
    assert(Array.isArray(logs) && logs.length >= 2, 'Audit trail contains recorded events');
    const hasCreateIpLog = logs.some(l => l.action === 'CREATE_IP_ASSET');
    assert(hasCreateIpLog, 'Audit trail contains CREATE_IP_ASSET event');

    const auditMetricsRes = await makeRequest('GET', '/api/rd/enterprise/audit/metrics');
    assert(auditMetricsRes.statusCode === 200, 'GET /api/rd/enterprise/audit/metrics returns summary metrics');

    // -------------------------------------------------------------
    // Test 5: Scoped API Keys & Dual-Authentication
    // -------------------------------------------------------------
    console.log('\n[Test Suite 5: Scoped Enterprise API Keys & Dual Auth]');
    const newKeyPayload = {
      name: 'External Lab IoT Telemetry Daemon',
      scopes: ['rd:read', 'rd:export'],
      rateLimitPerMin: 120,
      expiresAtDays: 60
    };

    const createKeyRes = await makeRequest('POST', '/api/rd/enterprise/apikeys', newKeyPayload);
    assert(createKeyRes.statusCode === 201, 'POST /api/rd/enterprise/apikeys generates scoped key (201 Created)');
    const keyData = createKeyRes.data.data;
    assert(keyData.rawKey.startsWith('egokey_live_'), 'Raw key is generated with prefix egokey_live_');
    assert(keyData.keyPrefix.startsWith('egokey_live_'), 'Prefix is stored safely');

    // Test Dual Auth: Request using the newly generated API Key (NO Bearer token)
    const apiKeyAuthRes = await makeRequest('GET', '/api/rd/enterprise/ip', null, {
      Authorization: `Bearer ${keyData.rawKey}`,
      'X-API-Key': ''
    });
    assert(apiKeyAuthRes.statusCode === 200, 'Dual Auth succeeds using raw API Key in Bearer header');

    // Test Invalid API Key
    const invalidKeyRes = await makeRequest('GET', '/api/rd/enterprise/ip', null, {
      'X-API-Key': 'egokey_live_invalid_signature_000000000000000000000000',
      Authorization: ''
    });
    assert(invalidKeyRes.statusCode === 401, 'Invalid API key returns 401 Unauthorized');

    // Revoke Key
    const revokeRes = await makeRequest('DELETE', `/api/rd/enterprise/apikeys/${keyData.id}`);
    assert(revokeRes.statusCode === 200, 'DELETE /api/rd/enterprise/apikeys/:id revokes key');

    // -------------------------------------------------------------
    // Test 6: Universal Data Portability & Exports
    // -------------------------------------------------------------
    console.log('\n[Test Suite 6: Universal Data Portability & Exports]');
    // CSV Export
    const csvExportRes = await makeRequest('GET', '/api/rd/enterprise/export?entityType=ip_assets&format=csv');
    assert(csvExportRes.statusCode === 200, 'GET /api/rd/enterprise/export?format=csv returns 200 OK');
    assert(csvExportRes.headers['content-type'].includes('text/csv'), 'Content-Type is text/csv');
    assert(typeof csvExportRes.data === 'string' && csvExportRes.data.includes('title'), 'CSV data contains header line');

    // JSON Export
    const jsonExportRes = await makeRequest('GET', '/api/rd/enterprise/export?entityType=compliance_sops&format=json');
    assert(jsonExportRes.statusCode === 200, 'GET /api/rd/enterprise/export?format=json returns 200 OK');
    assert(jsonExportRes.data.data && Array.isArray(jsonExportRes.data.data), 'JSON export returns structured entity array');

    // PDF Summary Export
    const pdfExportRes = await makeRequest('GET', '/api/rd/enterprise/export?entityType=projects&format=pdf');
    assert(pdfExportRes.statusCode === 200, 'GET /api/rd/enterprise/export?format=pdf returns 200 OK');
    assert(pdfExportRes.data.reportTitle.includes('EgoLytics R&D Enterprise Export'), 'PDF report structure validated');

  } catch (err) {
    console.error('Fatal test execution error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`MASTER PROMPT 16 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMaster16Tests();

