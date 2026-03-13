import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

test.describe('desktop smoke', () => {
  let app: ElectronApplication;
  let window: Page;

  test.beforeEach(async () => {
    app = await electron.launch({
      args: ['apps/desktop/main.cjs'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        ELECTRON_RENDERER_HOST: '127.0.0.1',
        ELECTRON_RENDERER_PORT: '3000',
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3001',
      },
    });

    window = await app.firstWindow();
  });

  test.afterEach(async () => {
    await app.close();
  });

  test('opens the login screen in the Electron window', async () => {
    await expect(window).toHaveURL(/http:\/\/127\.0\.0\.1:3000\/en\/login$/);
    await expect(window.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
    await expect(window.locator('#loginEmail')).toBeVisible();
  });
});
