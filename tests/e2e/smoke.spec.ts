import { expect, test, type Page } from '@playwright/test';
import { probe } from './pixels';

/**
 * Loads the app, then selects every generator in turn and checks that it renders without
 * shader/GL errors. Screenshots of the preview land in test-results/ for visual review.
 */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

test('every generator compiles and renders', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    // WebGL errors only surface as console warnings (e.g. GL_INVALID_OPERATION feedback loops).
    if (msg.type() === 'error' || /GL_INVALID|WebGL: /.test(msg.text())) errors.push(msg.text());
  });

  await page.goto('/');
  await expect(page.locator('.preview-canvas')).toBeVisible();
  await expect(page.locator('.fatal')).toHaveCount(0);

  const ids = await page
    .locator('.generator-item')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-id')!));
  expect(ids.length).toBeGreaterThan(10);

  let previous: Uint8Array | null = null;
  for (const id of ids) {
    await page.locator(`.generator-item[data-id="${id}"]`).click();
    await expect(page.locator('.inspector-header h2')).not.toBeEmpty();
    await page.waitForTimeout(id === 'reaction-diffusion' ? 4000 : 400);
    const overlay = page.locator('.error-overlay');
    if (await overlay.isVisible()) throw new Error(`${id}: ${await overlay.textContent()}`);
    const shot = await page
      .locator('.canvas-frame')
      .screenshot({ path: `test-results/generators/${id}.png` });
    // Guards against stale frames: each generator must change the preview.
    expect(
      previous !== null && sameBytes(shot, previous),
      `${id} rendered the same image as the previous generator`,
    ).toBeFalsy();
    previous = shot;
  }

  expect(errors).toEqual([]);
});

test('reaction-diffusion presets and share link round-trip', async ({ page }) => {
  await page.goto('/');
  await page.locator('.generator-item[data-id="reaction-diffusion"]').click();
  await page.locator('.preset-select').first().selectOption({ label: 'Mitosis' });
  await expect(page.locator('.param-row[data-key="feed"] input.num')).toHaveValue('0.0367');

  // Persisted through autosave: reload keeps the value.
  await page.waitForTimeout(600);
  await page.reload();
  await expect(page.locator('.param-row[data-key="feed"] input.num')).toHaveValue('0.0367');
});

async function select(page: Page, id: string, waitMs = 600) {
  await page.locator(`.generator-item[data-id="${id}"]`).click();
  await page.waitForTimeout(waitMs);
  return probe(page, page.locator('.preview-canvas'));
}

test('rendered pixels match expected patterns', async ({ page }) => {
  await page.goto('/');

  // Reaction-diffusion grows a pattern from its seed (not a flat or ramp image).
  const rd = await select(page, 'reaction-diffusion', 4000);
  expect(rd.stdDev, 'reaction-diffusion should show a pattern').toBeGreaterThan(10);

  // Checker 8x8: adjacent cell centers are black/white. (Switch away first so the checker is
  // rendered while thumbnails are still being generated in the background.)
  const checker = await select(page, 'tiles');
  expect(Math.abs(checker.lum(1 / 16, 1 / 16) - checker.lum(3 / 16, 1 / 16))).toBeGreaterThan(200);
  expect(Math.abs(checker.lum(1 / 16, 1 / 16) - checker.lum(3 / 16, 3 / 16))).toBeLessThan(10);

  // Bricks 4x8: brick centers are bright, horizontal mortar lines are dark.
  const bricks = await select(page, 'bricks');
  const brickCenter = bricks.lum(0.35, 1 - 1.5 / 8);
  const mortar = bricks.lum(0.35, 1 - 2 / 8);
  expect(brickCenter - mortar, `brick ${brickCenter} vs mortar ${mortar}`).toBeGreaterThan(120);
});
