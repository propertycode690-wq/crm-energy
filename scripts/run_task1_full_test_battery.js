const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testSuites = [
  { name: 'MP06: Gantt & CPM Schedule', file: 'test_egolytics_master_06.js' },
  { name: 'MP07: Experiments & Hypotheses', file: 'test_egolytics_master_07.js' },
  { name: 'MP08: ELN & Research Documents', file: 'test_egolytics_master_08.js' },
  { name: 'MP09: Governance, Risks & Budgets', file: 'test_egolytics_master_09.js' },
  { name: 'MP10: Resource, Capacity & Facilities', file: 'test_egolytics_master_10.js' },
  { name: 'MP11: Collaboration & Integrations', file: 'test_egolytics_master_11.js' },
  { name: 'MP12: Dashboard, Analytics & KPIs', file: 'test_egolytics_master_12.js' },
  { name: 'MP13: Maplytics GIS Territories', file: 'test_egolytics_master_13.js' },
  { name: 'MP14: BFOV Charts Core Canvas', file: 'test_egolytics_master_14.js' },
  { name: 'MP15: BFOV Advanced & AI Generation', file: 'test_egolytics_master_15.js' },
  { name: 'MP16: Enterprise IP, SOP & Audit QA', file: 'test_egolytics_master_16.js' },
];

const results = [];

console.log('================================================================');
console.log('  RUNNING FULL EGOLYTICS TEST BATTERY (MP06 - MP16)');
console.log('================================================================\n');

for (const suite of testSuites) {
  process.stdout.write(`Executing ${suite.name} (${suite.file})... `);
  const startTime = Date.now();
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let blocked = 0;
  let status = 'PASSED';
  let rawOutput = '';

  try {
    rawOutput = execSync(`node ${suite.file}`, {
      cwd: path.resolve(__dirname, '..'),
      timeout: 30000,
    }).toString('utf8');

    // Count [PASS] or ✓ PASS
    const passMatches = rawOutput.match(/(\[PASS\]|✓\s*PASS)/g);
    passed = passMatches ? passMatches.length : 0;

    const failMatches = rawOutput.match(/(\[FAIL\]|✗\s*FAIL)/g);
    failed = failMatches ? failMatches.length : 0;

    // Check summary line if available: e.g. "X PASSED / Y FAILED" or "X PASSED, Y FAILED"
    const summaryMatch = rawOutput.match(/(\d+)\s+PASSED[,\s/]+(\d+)\s+FAILED/i);
    if (summaryMatch) {
      passed = parseInt(summaryMatch[1], 10);
      failed = parseInt(summaryMatch[2], 10);
    }

    if (failed > 0) {
      status = 'FAILED';
    }
  } catch (err) {
    status = 'ERROR';
    rawOutput = err.stdout ? err.stdout.toString('utf8') : err.message;
    const failMatches = rawOutput.match(/(\[FAIL\]|✗\s*FAIL)/g);
    failed = failMatches ? failMatches.length : 1;
    const passMatches = rawOutput.match(/(\[PASS\]|✓\s*PASS)/g);
    passed = passMatches ? passMatches.length : 0;
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const total = passed + failed + skipped + blocked;

  console.log(`[${status}] Total: ${total}, Passed: ${passed}, Failed: ${failed} (${duration}s)`);

  results.push({
    suite: suite.name,
    file: suite.file,
    total,
    passed,
    failed,
    skipped,
    blocked,
    status,
    duration,
  });
}

console.log('\n================================================================');
console.log('  TEST EXECUTION MATRIX');
console.log('================================================================');
console.table(results);

fs.writeFileSync(path.resolve(__dirname, '../test_battery_results.json'), JSON.stringify(results, null, 2));
console.log('Saved test_battery_results.json');

