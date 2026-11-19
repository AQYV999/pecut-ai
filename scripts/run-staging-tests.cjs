const { spawn } = require('child_process');
const { execSync } = require('child_process');

let bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

if (!bypassSecret) {
  try {
    const raw = execSync('npx vercel api /v9/projects/prj_laFwdu8v6bclC2eHXRvPa9dDyVvh', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const match = raw.match(/"protectionBypass":\{"([^"]+)"/);
    if (match && match[1]) {
      bypassSecret = match[1];
    }
  } catch (err) {
    // ignore
  }
}

const args = process.argv.slice(2);
const playwrightArgs = ['playwright', 'test', ...args];

const env = {
  ...process.env,
  BASE_URL: process.env.BASE_URL || 'https://pecut-ai-git-staging-pecut-ai-19-kel-4.vercel.app',
};

if (bypassSecret) {
  env.VERCEL_AUTOMATION_BYPASS_SECRET = bypassSecret;
}

console.log(`Running Playwright against: ${env.BASE_URL}`);
console.log(`Vercel Protection Bypass Active: ${Boolean(bypassSecret)}`);

const isWin = process.platform === 'win32';
const cmd = isWin ? 'npx.cmd' : 'npx';

const child = spawn(cmd, playwrightArgs, {
  env,
  stdio: 'inherit',
  shell: true
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
