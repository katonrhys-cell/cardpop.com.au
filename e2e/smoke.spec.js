import { test, expect } from '@playwright/test';

// Real-browser smoke tests against the production bundle. These catch the class
// of failure unit tests structurally can't: the actual built app failing to
// boot, a router misconfiguration, or an uncaught runtime error on first paint.
//
// They assert the SPA shell mounts and public routes render without an uncaught
// exception. They deliberately do NOT exercise authenticated flows (those need a
// seeded test environment + backend) — that is the next layer to build.

// Collect uncaught page errors; a clean boot has none.
function trackPageErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

test('home page boots and mounts the app shell', async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveTitle(/CardPop/i);
  // React mounted something into #root.
  await expect(page.locator('#root')).not.toBeEmpty();
  // The site header / nav is present.
  await expect(page.locator('header').first()).toBeVisible();

  expect(errors, `Uncaught page errors:\n${errors.join('\n')}`).toEqual([]);
});

test('navigates to the marketplace route without crashing', async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#root')).not.toBeEmpty();
  expect(errors, `Uncaught page errors:\n${errors.join('\n')}`).toEqual([]);
});

test('login page renders a sign-in form', async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  // A password field is a stable signal the auth UI rendered.
  await expect(page.locator('input[type="password"]')).toBeVisible();
  expect(errors, `Uncaught page errors:\n${errors.join('\n')}`).toEqual([]);
});

test('shop route renders', async ({ page }) => {
  const errors = trackPageErrors(page);
  await page.goto('/shop', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#root')).not.toBeEmpty();
  expect(errors, `Uncaught page errors:\n${errors.join('\n')}`).toEqual([]);
});

test('cart drawer lazy-loads and opens when the cart button is clicked', async ({ page }) => {
  // The cart UI is code-split (framer-motion + Radix) and only mounted after the
  // first open. This guards that the lazy chunk loads and the drawer renders.
  const errors = trackPageErrors(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Cart' }).first().click();
  await expect(page.getByRole('heading', { name: 'Your Cart', exact: true })).toBeVisible();
  expect(errors, `Uncaught page errors:\n${errors.join('\n')}`).toEqual([]);
});
