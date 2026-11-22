import { expect, test, type Page } from '@playwright/test';
import { probe } from './pixels';

async function openGraph(page: Page, nodes: unknown[], selected: string, links: unknown[] = []) {
  await page.addInitScript(
    ({ nodes, selected, links }) => {
      const document = {
        format: 'fx-designer',
        version: 7,
        nodes,
        links,
        selected,
        seed: 1,
        aspect: 1,
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
    { nodes, selected, links },
  );
  await page.goto('/?e2e');
  await expect(page.locator('.preview-canvas')).toBeVisible();
}

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
    );
    const image = page.locator('.preview-canvas');
    await expect
      .poll(async () => (await probe(page, image)).lum(0.5, 0.01), { timeout: 15000 })
      .toBeGreaterThan(200);
    const open = await probe(page, image);
    expect(open.lum(0.5, 0.99)).toBeLessThan(80);
    await image.screenshot({ path: 'test-results/generators/smoke-fire-open-edge.png' });

    await page.locator('.node[data-id="wrap"] .node-title').click();
    const wrapped = await probe(page, image);
    expect(wrapped.lum(0.5, 0.99)).toBeGreaterThan(175);
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
          generator: 'custom-shader',
          x: 0,
          y: 0,
          postEnabled: false,
          code: 'vec4 generate(vec2 uv) { if (uv.x < 0.1) return vec4(1.0, 1.0, 1.0, 0.0); return vec4(vec3(0.35 + 0.3 * clamp((uv.x - 0.2) / 0.6, 0.0, 1.0)), 1.0); }',
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
    );
    const image = page.locator('.preview-canvas');
    await expect
      .poll(async () => (await probe(page, image)).lum(0.9, 0.5), {
        timeout: 15000,
      })
      .toBeGreaterThan(245);
    const levels = await probe(page, image);
    expect(levels.lum(0.15, 0.5)).toBeLessThan(10);
    expect(levels.lum(0.5, 0.5)).toBeCloseTo(127, -1);
    await image.screenshot({ path: 'test-results/generators/auto-levels.png' });

    await page.locator('.node[data-id="flatLevels"] .node-title').click();
    const flat = await probe(page, image);
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
    const image = page.locator('.preview-canvas');
    const pixels = await probe(page, image);
    await image.screenshot({ path: 'test-results/generators/ember-motes-stretched.png' });
    expect(pixels.stdDev).toBeGreaterThan(10);
    const xs = Array.from({ length: 40 }, (_, i) => (i + 1) / 41);
    // A continuous spark can vary slightly between the pixel centers on either side.
    const seam = Math.max(...xs.map((x) => Math.abs(pixels.lum(x, 0.002) - pixels.lum(x, 0.998))));
    const cell = Math.max(...xs.map((x) => Math.abs(pixels.lum(x, 0.498) - pixels.lum(x, 0.502))));
    expect(seam).toBeLessThan(25);
    expect(cell).toBeLessThan(16);
    expect(errors).toEqual([]);
  },
);
