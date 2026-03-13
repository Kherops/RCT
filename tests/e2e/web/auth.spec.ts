import { expect, test } from '@playwright/test';

test.describe('web auth smoke', () => {
  test('loads the login page and can navigate to signup', async ({ page }) => {
    await page.goto('/en/login');

    await expect(page.getByRole('heading', { name: 'Welcome back!' })).toBeVisible();
    await expect(page.locator('#loginEmail')).toBeVisible();
    await expect(page.locator('#loginPassword')).toBeVisible();

    await page.locator('#signupLink').click();

    await expect(page).toHaveURL(/\/en\/signup$/);
    await expect(page.getByRole('heading', { name: 'Create an Account' })).toBeVisible();
    await expect(page.locator('#signupUsername')).toBeVisible();
  });

  test('shows a validation error on mismatched signup passwords', async ({ page }) => {
    await page.goto('/en/signup');

    await page.locator('#signupUsername').fill('playwright-user');
    await page.locator('#signupEmail').fill('playwright@example.com');
    await page.locator('#signupPassword').fill('Password123!');
    await page.locator('#confirmPassword').fill('Mismatch123!');
    await page.locator('#signupSubmit').click();

    await expect(page.locator('#signupError')).toHaveText('Passwords do not match');
  });
});
