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
  test.setTimeout(1_200_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    // WebGL errors only surface as console warnings (e.g. GL_INVALID_OPERATION feedback loops).
    // The static preview has no account server: its /api 404 is expected.
    if (msg.location().url.includes('/api/')) return;
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
    const item = page.locator(`.generator-item[data-id="${id}"]`);
    const category = await item.getAttribute('data-category');
    // Operators live in their own browser tab.
    if (!(await item.isVisible()))
      await page
        .locator(
          `.panel-browser .segment[data-tab="${['operator', 'animation'].includes(category ?? '') ? 'operators' : 'generators'}"]`,
        )
        .click();
    await item.click();
    await expect(page.locator('.inspector-header h2')).not.toBeEmpty();
    const isSimulation = category === 'simulation';
    await page.waitForTimeout(isSimulation ? 4000 : 400);
    const overlay = page.locator('.error-overlay');
    if (await overlay.isVisible()) throw new Error(`${id}: ${await overlay.textContent()}`);
    const shot = await page
      .locator('.canvas-frame')
      .screenshot({ path: `test-results/generators/${id}.png` });
    // Guards against stale frames: each generator must change the preview.
    // Operators have nothing to show without inputs (all empty), so they may look alike.
    expect(
      !['operator', 'animation'].includes(category ?? '') &&
        previous !== null &&
        sameBytes(shot, previous),
      `${id} rendered the same image as the previous generator`,
    ).toBeFalsy();
    previous = shot;
  }

  expect(errors).toEqual([]);
});

test('reaction-diffusion presets and share link round-trip', async ({ page }) => {
  await page.goto('/');
  await page.locator('.generator-item[data-id="reaction-diffusion"]').click();
  await page.locator('.preset-tile', { hasText: 'Mitosis' }).first().click();
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

async function enableModule(page: Page, toggleKey: string) {
  await page.locator('.segment[data-tab="post"]').click();
  const toggle = page.locator(`.module-toggle[data-key="${toggleKey}"]`);
  if (!(await toggle.isChecked())) await toggle.click();
}

async function setField(page: Page, key: string, value: string) {
  const field = page.locator(`.param-row[data-key="${key}"] input.num`);
  await field.fill(value);
  await field.press('Enter');
}

test('posterize module reduces the output to flat tones', async ({ page }) => {
  await page.goto('/');
  const smooth = await select(page, 'fractal-noise');
  expect(smooth.distinctTones).toBeGreaterThan(20);

  await enableModule(page, 'posterizeOn');
  await setField(page, 'posterize', '3');
  await page.waitForTimeout(400);
  const flat = await probe(page, page.locator('.preview-canvas'));
  // 3 flat tones cover the image, apart from a few filtered samples on band boundaries.
  expect(flat.dominantShare(3)).toBeGreaterThan(0.85);
});

test('pixel-art mode renders uniform blocks', async ({ page }) => {
  await page.goto('/');
  await select(page, 'fractal-noise');
  await enableModule(page, 'pixelateOn');
  await setField(page, 'pixelate', '16');
  await enableModule(page, 'outlineOn');
  await page.waitForTimeout(500);
  const img = await probe(page, page.locator('.preview-canvas'));
  // Two points inside the same 1/16 block share their color.
  const a = img.lum(0.5 / 16 + 0.25 / 16, 0.5 / 16);
  const b = img.lum(0.5 / 16 - 0.25 / 16, 0.5 / 16 + 0.2 / 16);
  expect(Math.abs(a - b)).toBeLessThan(3);
  await expect(page.locator('.error-overlay')).toBeHidden();
});

test('flowmap painter encodes the stroke direction', async ({ page }) => {
  await page.goto('/');
  await select(page, 'flowmap-painter', 500);
  // Neutral start (the default has a gentle base flow), preview off, no arrows: the
  // viewport shows the plain encoded flowmap.
  await page.locator('.param-row[data-key="initial"] select').selectOption({ label: 'Neutral' });
  await page.locator('.module-toggle[data-key="preview"]').uncheck();
  await page.locator('.param-row[data-key="arrows"] input').uncheck();
  const canvas = page.locator('.preview-canvas');
  const box = (await canvas.boundingBox())!;
  const y = box.y + box.height * 0.5;
  await page.mouse.move(box.x + box.width * 0.2, y);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) {
    await page.mouse.move(box.x + box.width * (0.2 + i * 0.02), y);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
  const img = await probe(page, canvas);
  const [r, g] = img.rgb(0.5, 0.5);
  // 128 = no flow; the exact level depends on how many sim steps SwiftShader ran.
  expect(r, 'painted area points +X (red)').toBeGreaterThan(170);
  expect(Math.abs(g - 128)).toBeLessThan(40);
  const [rUntouched] = img.rgb(0.5, 0.1);
  expect(Math.abs(rUntouched - 128)).toBeLessThan(20);
});

test('node graph: add, link, per-node post', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('.generator-item[data-id="fractal-noise"]').click();
  await page.waitForTimeout(500);
  // Double-click adds a node (selected) next to the current one; operators have their tab.
  await page.locator('.panel-browser .segment[data-tab="operators"]').click();
  await page.locator('.generator-item[data-id="op-blend"]').dblclick();
  await expect(page.locator('.node')).toHaveCount(2);
  await expect(page.locator('.node.selected .node-title')).toHaveText('Blend');

  // Link the noise output to the blend's Foreground input.
  const center = async (selector: string) => {
    const b = (await page.locator(selector).boundingBox())!;
    return [b.x + b.width / 2, b.y + b.height / 2] as const;
  };
  const [x1, y1] = await center('.node[data-id="n1"] .pin.out .pin-dot');
  const [x2, y2] = await center('.node[data-id="n2"] .pin.in[data-input="foreground"] .pin-dot');
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.node[data-id="n2"] .pin.in[data-input="foreground"]')).toHaveClass(
    /linked/,
  );
  await expect(page.locator('.vp-link:not(.dragging)')).toHaveCount(1);

  // Each node has its own look.
  await enableModule(page, 'posterizeOn');
  await page.locator('.node[data-id="n1"] .node-head').click({ position: { x: 40, y: 8 } });
  await page.locator('.segment[data-tab="post"]').click();
  await expect(page.locator('.module-toggle[data-key="posterizeOn"]')).not.toBeChecked();

  // The eye bypasses a node's Post Process.
  await page.locator('.node[data-id="n1"] .node-post').click();
  await expect(page.locator('.node[data-id="n1"]')).toHaveClass(/post-off/);
  await expect(page.locator('.error-overlay')).toBeHidden();
  expect(errors).toEqual([]);
});
