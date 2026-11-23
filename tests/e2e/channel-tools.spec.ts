import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { probe, probePng } from './pixels';

async function openGraph(
  page: Page,
  nodes: unknown[],
  selected: string,
  links: unknown[] = [],
  aspect = 1,
  paused = false,
) {
  await page.addInitScript(
    ({ nodes, selected, links, aspect }) => {
      const document = {
        format: 'fx-designer',
        version: 7,
        nodes,
        links,
        selected,
        seed: 1,
        aspect,
        resolution: 512,
      };
      const id = 'schanneltest';
      localStorage.setItem('ptm.library.current', id);
      localStorage.setItem(
        'ptm.library.index',
        JSON.stringify([{ id, name: 'Channel test', updated: 1, thumb: null, folder: null }]),
      );
      localStorage.setItem(`ptm.library.doc.${id}`, JSON.stringify(document));
    },
    { nodes, selected, links, aspect },
  );
  await page.goto(paused ? '/?e2e&paused' : '/?e2e');
  await expect(page.locator('.preview-canvas')).toBeVisible();
}

async function exportImage(page: Page, path?: string) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Image \(PNG\)/ }).click(),
  ]);
  if (path) await download.saveAs(path);
  return probePng(page, await readFile(await download.path()));
}

test('legacy Levels & Math opens and exports as Math', { tag: '@part1' }, async ({ page }) => {
  await openGraph(
    page,
    [
      { id: 'source', generator: 'uniform', x: 0, y: 0, params: { value: 0.25 } },
      {
        id: 'legacy',
        generator: 'op-levels',
        x: 420,
        y: 0,
        params: { inLow: 0.5, gamma: 3, gain: 2 },
      },
    ],
    'legacy',
    [{ from: 'source', output: 'value', to: 'legacy', input: 'image' }],
    1,
    true,
  );
  await expect(page.locator('.inspector-header h2')).toHaveText('Math');
  await expect(page.locator('.param-row[data-key="inLow"]')).toHaveCount(0);
  const pixels = await exportImage(page);
  expect(Math.abs(pixels.lum(0.5, 0.5) - 127.5)).toBeLessThan(2);
});

test(
  'Blend broadcasts scalar pins and multiplies RGBA componentwise',
  { tag: '@part1' },
  async ({ page }) => {
    const cases = [
      { id: 'rgba', output: undefined, base: undefined, expected: [102, 32, 26, 64] },
      { id: 'rgb', output: 'rgb', base: undefined, expected: [102, 32, 26, 128] },
      { id: 'scalar', output: 'r', base: undefined, expected: [102, 51, 26, 64] },
      { id: 'scalar-base', output: undefined, base: 'g', expected: [51, 32, 51, 51] },
      { id: 'add', output: 'rgb', base: undefined, mode: 1, expected: [255, 182, 179, 128] },
      { id: 'bypass', output: undefined, base: 'g', opacity: 0, expected: [102, 102, 102, 255] },
    ];
    await openGraph(
      page,
      [
        {
          id: 'bg',
          generator: 'op-pack',
          x: 0,
          y: 0,
          params: { redValue: 0.8, greenValue: 0.4, blueValue: 0.2, alphaValue: 0.5 },
        },
        {
          id: 'fg',
          generator: 'op-pack',
          x: 0,
          y: 400,
          params: { redValue: 0.5, greenValue: 0.3125, blueValue: 0.5, alphaValue: 0.5 },
        },
        { id: 'route', generator: 'reroute', x: 400, y: 400 },
        ...cases.map(({ id, mode, opacity }, i) => ({
          id,
          generator: 'op-blend',
          x: i < 3 ? 600 : 1000,
          y: (i % 3) * 400,
          params: { mode: mode ?? 3, opacity: opacity ?? 1 },
        })),
      ],
      'rgba',
      [
        { from: 'fg', to: 'route', input: 'image', output: 'r' },
        ...cases.flatMap(({ id, output, base }) => [
          { from: 'bg', to: id, input: 'background', output: base },
          id === 'scalar'
            ? { from: 'route', to: id, input: 'foreground' }
            : { from: 'fg', to: id, input: 'foreground', output },
        ]),
      ],
      1,
      true,
    );
    for (const { id, expected } of cases) {
      await page.locator(`.node[data-id="${id}"] .node-title`).click();
      const pixels = await exportImage(page);
      const actual = [...pixels.rgb(0.5, 0.5), pixels.alpha(0.5, 0.5)];
      for (const [channel, value] of actual.entries()) {
        expect(
          Math.abs(value - expected[channel]!),
          `${id}, channel ${channel}`,
        ).toBeLessThanOrEqual(4);
      }
    }
  },
);

test(
  'portrait brush cursor matches the round painted footprint',
  { tag: '@part2' },
  async ({ page }) => {
    await openGraph(
      page,
      [
        {
          id: 'paint',
          generator: 'paint-mask',
          x: 0,
          y: 0,
          params: { brushSize: 0.15, hardness: 0.95, strength: 1, simResolution: 256 },
        },
      ],
      'paint',
      [],
      0.5,
    );
    const canvas = page.locator('.preview-canvas');
    await page.keyboard.press('f');
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const cursor = page.locator('.brush-cursor');
    await expect(cursor).toBeVisible();
    const ring = (await cursor.boundingBox())!;
    expect(Math.abs(ring.width - ring.height)).toBeLessThan(1);
    await page.mouse.down();
    try {
      await expect
        .poll(async () => (await probe(page, canvas)).lum(0.56, 0.5), { timeout: 20000 })
        .toBeGreaterThan(190);
    } finally {
      await page.mouse.up();
    }
    await page.mouse.move(0, 0);
    const painted = await probe(page, canvas);
    expect(painted.lum(0.61, 0.5)).toBeGreaterThan(190);
    expect(painted.lum(0.5, 0.555)).toBeGreaterThan(190);
    expect(painted.lum(0.5, 0.61)).toBeLessThan(60);
    await canvas.screenshot({ path: 'test-results/generators/portrait-brush.png' });
  },
);

test(
  'Smoke & Fire keeps its edge density and only Wrap emits across the seam',
  { tag: '@part3' },
  async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (/GL_INVALID|WebGL:/.test(message.text())) errors.push(message.text());
    });
    const params = {
      emitterPos: [0.5, 0.985],
      emitterSize: 0.06,
      emission: 1,
      emitSpeed: 0,
      buoyancy: 0,
      vorticity: 0,
      turbulence: 0,
      simResolution: 128,
      pressureIterations: 4,
    };
    await openGraph(
      page,
      [
        { id: 'open', generator: 'smoke-fire', x: 0, y: 0, params: { ...params, boundaries: 1 } },
        { id: 'wrap', generator: 'smoke-fire', x: 420, y: 0, params: { ...params, boundaries: 0 } },
      ],
      'open',
      [],
      1,
      true,
    );
    const nextFrame = page.getByRole('button', { name: 'Next frame (.)', exact: true });
    await nextFrame.click();
    const open = await exportImage(page, 'test-results/generators/smoke-fire-open-edge.png');
    expect(open.alpha(0.5, 0.01)).toBeGreaterThan(200);
    expect(open.alpha(0.5, 0.99)).toBeLessThan(10);

    await page.locator('.node[data-id="wrap"] .node-title').click();
    await nextFrame.click();
    const wrapped = await exportImage(page);
    expect(wrapped.alpha(0.5, 0.99)).toBeGreaterThan(175);
    expect(errors).toEqual([]);
  },
);

test(
  'Auto Levels stretches visible luminance and preserves a flat input',
  { tag: '@part2' },
  async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (/GL_INVALID|WebGL:/.test(message.text())) errors.push(message.text());
    });
    await openGraph(
      page,
      [
        {
          id: 'ramp',
          generator: 'gradient',
          x: 0,
          y: 0,
          post: { colorMode: 1, alphaMode: 2 },
          ramp: {
            stops: [
              { pos: 0, color: '#ffffff', alpha: 0 },
              { pos: 0.07, color: '#ffffff', alpha: 0 },
              { pos: 0.1, color: '#595959', alpha: 0 },
              { pos: 0.14, color: '#595959', alpha: 1 },
              { pos: 0.2, color: '#595959', alpha: 1 },
              { pos: 0.8, color: '#a6a6a6', alpha: 1 },
              { pos: 1, color: '#a6a6a6', alpha: 1 },
            ],
          },
        },
        { id: 'levels', generator: 'op-auto-levels', x: 420, y: 0 },
        { id: 'flat', generator: 'uniform', x: 0, y: 400, params: { value: 0.4 } },
        { id: 'flatLevels', generator: 'op-auto-levels', x: 420, y: 400 },
      ],
      'levels',
      [
        { from: 'ramp', to: 'levels', input: 'image' },
        { from: 'flat', output: 'value', to: 'flatLevels', input: 'image' },
      ],
      1,
      true,
    );
    const levels = await exportImage(page, 'test-results/generators/auto-levels.png');
    expect(levels.alpha(0.03, 0.5)).toBe(0);
    expect(levels.lum(0.9, 0.5)).toBeGreaterThan(245);
    expect(levels.lum(0.15, 0.5)).toBeLessThan(10);
    expect(levels.lum(0.5, 0.5)).toBeCloseTo(127, -1);

    await page.locator('.node[data-id="flatLevels"] .node-title').click();
    const flat = await exportImage(page);
    expect(flat.rgb(0.5, 0.5)).toEqual([102, 102, 102]);
    expect(errors).toEqual([]);
  },
);

test(
  'Pack RGBA uses fallback values until connected to a Uniform float',
  { tag: '@part4' },
  async ({ page }) => {
    await openGraph(
      page,
      [
        { id: 'source', generator: 'uniform', x: 0, y: 0, params: { value: 0.8 } },
        {
          id: 'pack',
          generator: 'op-pack',
          x: 420,
          y: 0,
          params: { redValue: 0.2, greenValue: 0.4, blueValue: 0.6 },
        },
      ],
      'pack',
    );
    const red = page.locator('.panel-details [data-key="redValue"]');
    await expect(red).not.toHaveAttribute('inert', '');
    const pixel = async () => (await probe(page, page.locator('.preview-canvas'))).rgb(0.5, 0.5);
    await expect.poll(pixel).toEqual([51, 102, 153]);

    const output = page.locator('.node[data-id="source"] .pin.out[data-output="value"] .pin-dot');
    const input = page.locator('.node[data-id="pack"] .pin.in[data-input="red"] .pin-dot');
    const a = (await output.boundingBox())!;
    const b = (await input.boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(red).toHaveAttribute('inert', '');
    await expect(page.locator('.panel-details [data-key="greenValue"]')).not.toHaveAttribute(
      'inert',
      '',
    );
    await page.mouse.move(12, 12);
    await expect.poll(pixel).toEqual([204, 102, 153]);
  },
);

test(
  'stretched Ember Motes continue across cells and tile boundaries',
  { tag: '@part3' },
  async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (/GL_INVALID|WebGL:/.test(message.text())) errors.push(message.text());
    });
    await openGraph(
      page,
      [
        {
          id: 'embers',
          generator: 'ember-motes',
          x: 0,
          y: 0,
          frozenAt: 0,
          postEnabled: false,
          params: { cells: 2, size: 1.2, stretch: 6, density: 1, drift: 0, flicker: 0 },
        },
      ],
      'embers',
    );
    // The preview card has an inset shadow over the outermost texels.
    const pixels = await exportImage(page, 'test-results/generators/ember-motes-stretched.png');
    expect(pixels.stdDev).toBeGreaterThan(10);
    const xs = Array.from({ length: pixels.width }, (_, i) => i / (pixels.width - 1));
    // A continuous spark can vary slightly between the pixel centers on either side.
    const seam = Math.max(...xs.map((x) => Math.abs(pixels.lum(x, 0) - pixels.lum(x, 1))));
    const middle = Math.floor(pixels.height / 2);
    const before = (middle - 1) / (pixels.height - 1);
    const after = middle / (pixels.height - 1);
    const cell = Math.max(...xs.map((x) => Math.abs(pixels.lum(x, before) - pixels.lum(x, after))));
    expect(seam).toBeLessThan(25);
    expect(cell).toBeLessThan(16);
    expect(errors).toEqual([]);
  },
);
