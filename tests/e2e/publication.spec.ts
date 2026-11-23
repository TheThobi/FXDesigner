import { expect, test } from '@playwright/test';
import { contentHash } from '../../src/app/library';

test(
  'publish a library card without opening it and edit its display type',
  { tag: '@part3' },
  async ({ page }) => {
    test.setTimeout(360_000);
    let publication: Record<string, unknown> | undefined;
    const edits: Record<string, unknown>[] = [];
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const request = route.request();
      let body: unknown = {};
      if (path.endsWith('/health')) body = { accounts: true, discord: false, registration: false };
      else if (path.endsWith('/auth/me'))
        body = {
          user: { id: 'test', pseudo: 'Test', email: null, discord: false, password: true },
        };
      else if (path.endsWith('/library')) body = { folders: [], systems: [], tombstones: [] };
      else if (path.endsWith('/community/categories'))
        body = { categories: [{ id: 'other', label: 'Other' }] };
      else if (path.endsWith('/community') && request.method() === 'POST') {
        publication = {
          ...request.postDataJSON(),
          id: 'abcdef012345',
          version: 1,
          mine: true,
          author: 'Test',
          updated: Date.now(),
          subscribers: 0,
        };
        body = { id: 'abcdef012345', version: 1 };
      } else if (path.endsWith('/abcdef012345')) {
        if (request.method() === 'PUT') {
          const edit = request.postDataJSON() as Record<string, unknown>;
          edits.push(edit);
          Object.assign(publication!, edit);
          body = { version: 1 };
        } else body = publication;
      } else if (path.endsWith('/community')) body = { items: [], more: false };
      await route.fulfill({ json: body });
    });
    await page.goto('/?e2e&paused');
    await expect(page.locator('.preview-canvas')).toBeVisible();
    const currentId = await page.evaluate(() => localStorage.getItem('ptm.library.current'));
    await page.addInitScript(() => {
      const entry = 'stestlibrarycard';
      const index = JSON.parse(localStorage.getItem('ptm.library.index') ?? '[]');
      const current = localStorage.getItem('ptm.library.current');
      const doc = JSON.parse(localStorage.getItem(`ptm.library.doc.${current}`) ?? 'null');
      if (!doc || index.some((item: { id: string }) => item.id === entry)) return;
      doc.nodes[0].generator = 'lightning';
      doc.nodes[0].params = { bolts: 1, octaves: 1 };
      index.push({
        id: entry,
        name: 'Library Lightning',
        updated: Date.now(),
        thumb: null,
        folder: null,
      });
      localStorage.setItem('ptm.library.index', JSON.stringify(index));
      localStorage.setItem(`ptm.library.doc.${entry}`, JSON.stringify(doc));
    });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Test', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    const current = page.locator('.library-card.current[aria-current="true"]');
    await expect(current.locator('.library-date')).not.toBeEmpty();
    await expect(current.getByText('Open', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Publish Library Lightning', exact: true }).click();
    const community = page.locator('.community-dialog');
    await expect(
      community.getByRole('heading', { name: 'Publish "Library Lightning"' }),
    ).toBeVisible();
    await expect(community.locator('.community-preview-picker img')).toBeVisible({
      timeout: 30000,
    });
    const display = community.getByLabel('Display as');
    await expect(display).toHaveValue('animated');
    await display.selectOption('static');
    await community.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(
      community.getByRole('button', { name: 'Edit details', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('ptm.library.current'))).toBe(currentId);
    expect(publication?.animated).toBe(false);

    await community.getByRole('button', { name: 'Edit details', exact: true }).click();
    await expect(display).toHaveValue('static');
    await display.selectOption('animated');
    const oldThumb = publication?.thumb;
    await community.getByRole('button', { name: 'Edit preview…' }).click();
    const studio = page.locator('.studio-dialog');
    await expect(studio).toBeVisible({ timeout: 30000 });
    await studio.locator('.studio-canvas').hover();
    await page.mouse.wheel(0, -300);
    await studio.getByRole('button', { name: 'Use this preview' }).click();
    await community.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(community.getByRole('button', { name: 'Edit details', exact: true })).toBeVisible({
      timeout: 30000,
    });
    expect(edits[0]).toMatchObject({ animated: true, previewFrames: 16 });
    expect(edits[0]?.thumb).toEqual(expect.any(String));
    expect(edits[0]?.thumb).not.toBe(oldThumb);
    expect(edits[0]).not.toHaveProperty('document');

    await community.getByRole('button', { name: 'Edit details', exact: true }).click();
    await display.selectOption('static');
    await community.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(
      community.getByRole('button', { name: 'Edit details', exact: true }),
    ).toBeVisible();
    expect(edits[1]).toMatchObject({ animated: false, preview: null, previewFrames: 0 });
    expect(edits[1]).not.toHaveProperty('document');
  },
);

test(
  'community filters the results and offers relevant tags in the publishing form',
  { tag: '@part3' },
  async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      let body: unknown;
      if (path.endsWith('/health')) body = { accounts: true, discord: false, registration: false };
      else if (path.endsWith('/auth/me'))
        body = {
          user: { id: 'test', pseudo: 'Test', email: null, discord: false, password: true },
        };
      else if (path.endsWith('/library')) body = { folders: [], systems: [], tombstones: [] };
      else if (path.endsWith('/community/categories'))
        body = { categories: [{ id: 'other', label: 'Other' }] };
      else if (path.endsWith('/community/tags')) {
        const q = url.searchParams.get('q');
        body = {
          tags:
            q === 'fir'
              ? [{ tag: 'fire', count: 14 }]
              : q === ''
                ? [{ tag: 'smoke', count: 20 }]
                : [],
        };
      } else if (path.endsWith('/community') && url.searchParams.get('kind') === 'static') {
        const shared = { author: 'Test', category: 'other', subscribers: 0, previewFrames: 16 };
        body = {
          items: [
            { ...shared, id: 'animated', name: 'Animated effect', animated: true },
            { ...shared, id: 'static', name: 'Static effect', animated: false },
          ],
          more: false,
        };
      } else body = { items: [], more: false };
      await route.fulfill({ json: body });
    });
    await page.goto('/?e2e&paused');
    await page.getByRole('button', { name: 'Community', exact: true }).click();
    const dialog = page.locator('.community-dialog');
    const body = dialog.locator('.community-body');
    await expect(body.getByText('Nothing found.')).toBeVisible({ timeout: 30000 });
    await expect(body.locator('.library-grid')).toHaveCount(0);
    await dialog.getByRole('tab', { name: 'Static', exact: true }).click();
    await expect(body.getByText('Static effect')).toBeVisible();
    await expect(body.getByText('Animated effect')).toHaveCount(0);
    await dialog.getByRole('tab', { name: 'All', exact: true }).click();
    await dialog.getByRole('tab', { name: 'Subscribed' }).click();
    await expect(body.getByText('No subscription yet.')).toBeVisible();
    await page.screenshot({ path: 'test-results/community-empty.png' });
    await dialog.getByRole('button', { name: 'Publish current system' }).click();
    const tags = dialog.getByRole('textbox', { name: 'Tags', exact: true });
    await tags.focus();
    await expect(dialog.getByRole('button', { name: /smoke.*20/ })).toBeVisible();
    await tags.fill('loop');
    await tags.press('Enter');
    await expect(dialog.getByRole('button', { name: 'Remove tag loop' })).toBeVisible();
    await tags.fill('fir');
    const suggestion = dialog.getByRole('button', { name: /fire.*14/ });
    await expect(suggestion).toBeVisible();
    await expect(dialog.getByLabel('Display as')).toHaveValue('animated');
    await dialog.getByLabel('Display as').selectOption('static');
    await expect(dialog.locator('.community-preview-picker img')).toBeVisible();
    await expect(dialog.locator('.community-preview-picker .community-kind-badge')).toBeHidden();
    await page.screenshot({ path: 'test-results/community-publish.png' });
    await suggestion.click();
    await expect(tags).toHaveValue('');
    await expect(dialog.getByRole('button', { name: 'Remove tag fire' })).toBeVisible();
  },
);

test(
  'legacy publication links survive reloads and transient errors without undefined versions',
  { tag: '@part3' },
  async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body: unknown;
      if (path.endsWith('/health')) body = { accounts: true, discord: false, registration: false };
      else if (path.endsWith('/auth/me'))
        body = {
          user: { id: 'test', pseudo: 'Test', email: null, discord: false, password: true },
        };
      else if (path.endsWith('/library')) body = { folders: [], systems: [], tombstones: [] };
      else if (path.includes('/library/systems/')) body = { stored: true };
      else if (path.endsWith('/community/categories'))
        body = { categories: [{ id: 'other', label: 'Other' }] };
      else if (path.endsWith('/community')) body = { items: [], more: false };
      else {
        await route.fulfill({ status: 404, json: { error: 'Route unavailable' } });
        return;
      }
      await route.fulfill({ json: body });
    });
    await page.goto('/?e2e');
    await expect(page.locator('.preview-canvas')).toBeVisible();
    const doc = await page.evaluate(() => {
      const id = localStorage.getItem('ptm.library.current')!;
      return JSON.parse(localStorage.getItem(`ptm.library.doc.${id}`)!);
    });
    await page.addInitScript((hash) => {
      if (sessionStorage.getItem('seededPublication')) return;
      sessionStorage.setItem('seededPublication', '1');
      const index = JSON.parse(localStorage.getItem('ptm.library.index')!);
      const current = localStorage.getItem('ptm.library.current');
      index.find((entry: { id: string }) => entry.id === current).published = {
        id: 'abcdef012345',
        hash,
      };
      localStorage.setItem('ptm.library.index', JSON.stringify(index));
    }, contentHash(doc));
    await page.reload();
    await page.getByRole('button', { name: 'Community', exact: true }).click();
    const dialog = page.locator('.community-dialog');
    const status = dialog.getByRole('button', { name: 'Published · up to date', exact: true });
    await expect(status).toBeVisible();
    await status.click();
    await expect(dialog).toContainText('Route unavailable');
    await expect(dialog).not.toContainText(/undefined|vnull|NaN/);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Community', exact: true }).click();
    await expect(status).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();

    // The same legacy link must still allow an update after local edits.
    await page.addInitScript(() => {
      if (sessionStorage.getItem('modifiedPublication')) return;
      sessionStorage.setItem('modifiedPublication', '1');
      const index = JSON.parse(localStorage.getItem('ptm.library.index')!);
      const current = localStorage.getItem('ptm.library.current');
      index.find((entry: { id: string }) => entry.id === current).published.hash = 'older-content';
      localStorage.setItem('ptm.library.index', JSON.stringify(index));
    });
    await page.reload();
    await page.getByRole('button', { name: 'Community', exact: true }).click();
    await dialog.getByRole('button', { name: 'Publish update…', exact: true }).click();
    await expect(page.locator('.community-update')).toContainText('Next version');
    await expect(page.locator('.community-update')).not.toContainText(/undefined|vnull|NaN/);
    await page.screenshot({ path: 'test-results/publication-unknown-version.png' });
  },
);
