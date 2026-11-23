import { expect, test } from '@playwright/test';

test(
  'hidden panels give their space to the viewport and restore their sizes',
  { tag: '@part4' },
  async ({ page }) => {
    await page.goto('/?e2e&paused');
    const stack = (id: string) =>
      page.locator('.dock-stack').filter({ has: page.locator(`.dock-tab[data-panel="${id}"]`) });
    const width = async (id: string) => (await stack(id).boundingBox())!.width;
    const toggle = async (name: string) => {
      await page.getByRole('button', { name: 'Layout', exact: true }).click();
      await page.getByRole('menuitemcheckbox', { name, exact: true }).click();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Layout', exact: true })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    };
    await expect(stack('viewport')).toBeVisible();
    const browser = await width('browser');
    const details = await width('details');
    const viewport = await width('viewport');

    await stack('browser').locator('.panel-close').first().click();
    expect(Math.abs((await width('details')) - details)).toBeLessThan(2);
    expect(await width('viewport')).toBeGreaterThan(viewport + browser - 2);
    await toggle('Generator browser');
    expect(Math.abs((await width('browser')) - browser)).toBeLessThan(2);

    await stack('details').locator('.panel-close').first().click();
    expect(Math.abs((await width('browser')) - browser)).toBeLessThan(2);
    expect(await width('viewport')).toBeGreaterThan(viewport + details - 2);
    await stack('browser').locator('.panel-close').first().click();
    await expect(page.locator('.dock-stack')).toHaveCount(1);
    expect(
      Math.abs(
        (await width('viewport')) -
          (await page.locator('.dock > .dock-split').boundingBox())!.width,
      ),
    ).toBeLessThan(2);

    await toggle('Details panel');
    await toggle('Generator browser');
    expect(Math.abs((await width('browser')) - browser)).toBeLessThan(2);
    expect(Math.abs((await width('details')) - details)).toBeLessThan(2);
    expect(Math.abs((await width('viewport')) - viewport)).toBeLessThan(2);

    // Resizing while a panel is hidden must not bake its borrowed space into the layout.
    await toggle('Generator browser');
    const beforeResize = await width('viewport');
    const separator = (await page.locator('.dock-splitter').boundingBox())!;
    await page.mouse.move(separator.x + separator.width / 2, separator.y + 50);
    await page.mouse.down();
    await page.mouse.move(separator.x + separator.width / 2 - 40, separator.y + 50);
    await page.mouse.up();
    expect(Math.abs((await width('viewport')) - (beforeResize - 40))).toBeLessThan(2);
    await page.screenshot({ path: 'test-results/dock-browser-hidden.png' });
    await toggle('Generator browser');
    expect(Math.abs((await width('browser')) - browser)).toBeLessThan(2);
    expect(Math.abs((await width('details')) - (details + 40))).toBeLessThan(2);
    await toggle('Generator browser');
    expect(Math.abs((await width('viewport')) - (beforeResize - 40))).toBeLessThan(2);
  },
);
