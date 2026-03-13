import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const currentWorkingDirectory = process.cwd();

function escapeForSingleQuotedBash(value: string) {
  return value.replace(/'/g, `'\"'\"'`);
}

function escapeForDoubleQuotedCmd(value: string) {
  return value.replace(/"/g, '""');
}

function getWebServerCommand() {
  if (
    currentWorkingDirectory.startsWith('\\\\wsl.localhost\\') ||
    currentWorkingDirectory.startsWith('\\\\wsl$\\')
  ) {
    const parts = currentWorkingDirectory.split('\\').filter(Boolean);
    const [, distro, ...segments] = parts;

    if (!distro || segments.length === 0) {
      throw new Error(`Unable to derive WSL path from cwd: ${currentWorkingDirectory}`);
    }

    const linuxPath = `/${segments.join('/')}`;
    const escapedLinuxPath = escapeForSingleQuotedBash(linuxPath);
    const bashCommand = `cd '${escapedLinuxPath}' && npm run dev:web`;
    const escapedBashCommand = escapeForDoubleQuotedCmd(bashCommand);
    return `cd /d %USERPROFILE% && wsl.exe -d ${distro} bash -lc "${escapedBashCommand}"`;
  }

  return 'npm run dev:web';
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['html'], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: getWebServerCommand(),
    url: baseURL,
    reuseExistingServer: !CI,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001',
    },
  },
  projects: [
    {
      name: 'web-chromium',
      testMatch: /web\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'desktop-electron',
      testMatch: /desktop\/.*\.spec\.ts/,
    },
  ],
});
