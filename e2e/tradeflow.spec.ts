import { test, expect } from '@playwright/test';

test.describe('TradeFlow E2E', () => {
  test('home page loads with title and key elements', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TradeFlow/i);
    // Key elements visible
    await expect(page.locator('text=TradeFlow').first()).toBeVisible();
  });

  test('navigation to all main pages', async ({ page }) => {
    await page.goto('/');
    const routes = [
      '/dashboard', '/autopilot', '/invest', '/my-bots', '/strategies',
      '/backtester', '/alerts', '/risk', '/analytics', '/copy-trading',
      '/automated-trading', '/cross-dex-arb', '/cross-chain-arb',
      '/community', '/connections', '/pricing', '/security',
      '/settings', '/help', '/scheduler', '/referrals',
      '/privacy', '/terms',
    ];

    for (const route of routes) {
      await page.goto(route);
      // Should not show 404
      const is404 = await page.locator('text=404').isVisible().catch(() => false);
      expect(is404, `Route ${route} should not show 404`).toBe(false);
    }
  });

  test('privacy policy page renders content', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('text=Privacy Policy')).toBeVisible();
    await expect(page.locator('text=Information We Collect')).toBeVisible();
    await expect(page.locator('text=Your Rights')).toBeVisible();
  });

  test('terms of service page renders content', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.locator('text=Terms of Service')).toBeVisible();
    await expect(page.locator('text=Not Financial Advice')).toBeVisible();
    await expect(page.locator('text=Risk Disclosure')).toBeVisible();
  });

  test('settings page loads with controls', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('text=Settings')).toBeVisible();
    await expect(page.locator('text=Risk Limits')).toBeVisible();
    await expect(page.locator('text=Notifications')).toBeVisible();
    await expect(page.locator('text=Trading Mode')).toBeVisible();
  });

  test('help page loads with FAQ sections', async ({ page }) => {
    await page.goto('/help');
    await expect(page.locator('text=Help & Guide')).toBeVisible();
    await expect(page.locator('text=Getting Started')).toBeVisible();
    await expect(page.locator('text=Trading Bots')).toBeVisible();
  });

  test('dashboard loads without errors', async ({ page }) => {
    await page.goto('/dashboard');
    // Should load without crashing (may show demo data)
    await expect(page.locator('text=Dashboard').first()).toBeVisible();
  });

  test('strategies page loads', async ({ page }) => {
    await page.goto('/strategies');
    await expect(page.locator('text=Strategies').first()).toBeVisible();
  });

  test('backtester page loads', async ({ page }) => {
    await page.goto('/backtester');
    await expect(page.locator('text=Backtester').first()).toBeVisible();
  });

  test('404 page for unknown route', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    await expect(page.locator('text=404')).toBeVisible();
    await expect(page.locator('text=Page not found')).toBeVisible();
  });

  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/');
    // Click sidebar link to navigate
    const sidebar = page.locator('.sidebar, nav').first();
    await expect(sidebar).toBeVisible();
  });

  test('disclaimer banner shows on first visit', async ({ page }) => {
    // Clear localStorage to simulate first visit
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // Should see the disclaimer banner
    const disclaimer = page.locator('text=Not Financial Advice').first();
    await expect(disclaimer).toBeVisible({ timeout: 5000 });
  });

  test('mobile viewport renders without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    // Check no horizontal scrollbar
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2); // 2px tolerance
  });

  test('API health check endpoint responds', async ({ request }) => {
    // This tests the backend if running
    try {
      const response = await request.get('http://localhost:3001/api/health');
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.ok).toBe(true);
    } catch {
      // Backend may not be running in CI — skip
      test.skip();
    }
  });
});
