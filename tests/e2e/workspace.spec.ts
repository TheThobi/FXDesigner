import { expect, test } from '@playwright/test';

test(
  'workspace settings, node seed and code stay scoped to the right place',
  { tag: '@part4' },
  async ({ page }) => {
    const shaderErrors: string[] = [];
    page.on('console', (message) => {
      if (/GL_INVALID|WebGL:/.test(message.text())) shaderErrors.push(message.text());
    });
    await page.goto('/?e2e');
    const workspace = page.locator('.panel-workspace');
    await page.getByRole('tab', { name: 'Workspace', exact: true }).click();
    await expect(workspace.locator('[data-key="aspect"]')).toBeVisible();
    await expect(workspace.locator('[data-key="seed"]')).toBeVisible();
    await page.locator('.dock-tab[data-panel="details"]').click();
    await page.getByRole('tab', { name: 'Output', exact: true }).click();
    await expect(page.locator('.panel-details [data-key="aspect"]')).toHaveCount(0);
    await page.locator('.panel-details .segment[data-tab="generator"]').click();

    const output = page.locator('.node.output-node');
    await expect(output).toHaveCount(1);
    await output.locator('.node-title').click();
    await page.keyboard.press('Delete');
    await expect(output).toHaveCount(1);
    await expect(output.getByRole('button', { name: 'Delete node' })).toHaveCount(0);
    const first = page.locator('.node[data-id="n1"]');
    await first.locator('.node-title').click();
    await first.getByRole('button', { name: 'Shuffle node seed' }).click();
    await expect(first.locator('.node-seed')).toHaveClass(/\bon\b/);
    await page.getByRole('tab', { name: 'Workspace', exact: true }).click();
    await workspace.getByRole('button', { name: 'Random seed' }).click();
    await expect(first.locator('.node-seed')).not.toHaveClass(/\bon\b/);
    await page.locator('.dock-tab[data-panel="details"]').click();

    const tile = (id: string) => page.locator(`.generator-item[data-id="${id}"]`);
    await tile('magic-circle').click();
    await expect(first.getByRole('button', { name: 'Shuffle node seed' })).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Code', exact: false })
      .filter({ has: page.locator('.code-glyph') })
      .click();
    const code = page.locator('.code-panel');
    await expect(code).toBeVisible();
    await expect(code.locator('.pe-param').first()).toHaveJSProperty('open', false);
    await code.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(code.locator('.pe-param[open]')).toContainText('New parameter');
    await tile('custom-shader').dblclick();
    await expect(code).toBeVisible();
    await first.locator('.node-title').click();
    await expect(code).toBeVisible();
    await page.locator('.code-toggle').click();
    await expect(code).toBeHidden();
    await page.locator('.panel-browser .segment[data-tab="operators"]').click();
    await expect(tile('reroute')).toHaveCount(0);
    await expect(tile('output')).toHaveCount(0);
    await tile('op-edge-fade').dblclick();
    await expect(page.locator('.inspector-header h2')).toHaveText('Edge Feather');
    await expect(page.locator('.error-overlay')).toBeHidden();
    expect(shaderErrors).toEqual([]);
  },
);
