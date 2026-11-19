/**
 * Pecut AI — Global E2E Test Teardown
 * Runs once after all test suites complete.
 */

import fs from 'fs';

async function globalTeardown() {
  console.log('🧹 [Global Teardown] Cleaning up E2E test environment...');

  // Optionally: clean up test artifacts, summarize results, etc.
  const reportDir = 'playwright-report';
  const resultsDir = 'test-results';

  if (fs.existsSync(reportDir)) {
    const files = fs.readdirSync(reportDir);
    console.log(`🧹 [Global Teardown] HTML report available at: ${reportDir}/index.html`);
    console.log(`🧹 [Global Teardown] Report contains ${files.length} files`);
  }

  if (fs.existsSync(resultsDir)) {
    const files = fs.readdirSync(resultsDir);
    console.log(`🧹 [Global Teardown] Test results in: ${resultsDir}/ (${files.length} files)`);
  }

  console.log('🧹 [Global Teardown] Complete');
}

export default globalTeardown;