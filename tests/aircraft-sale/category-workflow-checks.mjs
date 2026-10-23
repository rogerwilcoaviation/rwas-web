import assert from 'node:assert/strict';
import { resolve } from 'node:path';

export async function checkCategoryWorkflows({
  page,
  dialog,
  f,
  width,
  artifacts,
  token,
  origin,
}) {
  async function jump(label) {
    const index = dialog.getByLabel('Listing step index', { exact: true });
    const options = await index
      .locator('option')
      .evaluateAll((nodes) =>
        nodes.map((node) => ({ text: node.textContent, value: node.value })),
      );
    const choice = options.find(
      (option) =>
        option.text.replace(/^\d+\. /, '').replace(/ \(Required\)$/, '') ===
          label || option.text.endsWith(': ' + label),
    );
    assert.ok(choice, 'Step exists: ' + label);
    await index.selectOption(choice.value);
  }
  async function enter(label, value, select = false) {
    await jump(label);
    const field = dialog.locator('#listing-step-input');
    if (select) await field.selectOption(value);
    else await field.fill(value);
  }
  for (const [type, category, extra, spec] of [
    [
      'hangars',
      'hangars',
      [
        ['Hangar type', 'Box / rectangular', true],
        ['Airport name or identifier', 'KSYN Synthetic Airport'],
      ],
      ['Floor area (include sq ft or sq m)', '5000 sq ft'],
    ],
    [
      'parts',
      'components-engines',
      [
        ['Manufacturer', 'Synthetic'],
        ['Part number', 'PN-001'],
        ['Quantity', '2'],
        ['Unit of sale', 'each'],
        ['Condition', 'Serviceable', true],
      ],
      ['Traceability status', 'Seller-stated documentation available'],
    ],
    [
      'tools',
      'tools-hand-tools',
      [
        ['Quantity', '1'],
        ['Unit of sale', 'kit'],
        ['Condition', 'Used', true],
      ],
      [
        'Calibration applicability, status and date',
        'Not applicable to this hand tool',
      ],
    ],
  ]) {
    await dialog
      .getByRole('button', { name: 'Close seller panel', exact: true })
      .click();
    await f.call('/draft', 'DELETE', undefined, token, { Origin: origin });
    await page
      .getByRole('button', { name: 'Create a Listing', exact: true })
      .click();
    await dialog
      .getByRole('button', { name: 'List manually', exact: true })
      .click();
    await dialog
      .getByLabel('What would you like to list?', { exact: true })
      .selectOption(type);
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await dialog
      .getByLabel('Listing category', { exact: true })
      .selectOption(category);
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    assert.equal(await dialog.locator('#listing-step-input').count(), 1);
    await enter('Listing title', 'Synthetic ' + type + ' listing');
    for (const [label, value, select] of extra)
      await enter(label, value, select);
    await enter('Sale or lease', type === 'hangars' ? 'lease' : 'sale', true);
    await enter('Currency', 'CAD', true);
    await enter('Price display', 'on-request', true);
    await enter('Location', 'Synthetic location');
    await enter(
      'Description',
      'Synthetic listing description. Records have not been verified.',
    );
    await enter(...spec);
    await dialog
      .getByRole('button', { name: 'Save Draft', exact: true })
      .click();
    await dialog
      .getByText('Draft saved. Add media, then submit for review.', {
        exact: true,
      })
      .waitFor();
    const saved = Object.values(f.state().listings).find(
      (l) => l.fields.title === 'Synthetic ' + type + ' listing',
    );
    assert.ok(saved);
    assert.equal(saved.fields.listingType, type);
    assert.equal(saved.fields.currency, 'CAD');
    assert.ok(Object.values(saved.fields.specifications).includes(spec[1]));
    await dialog
      .getByRole('button', { name: 'Review draft', exact: true })
      .click();
    if (type === 'hangars') {
      assert.equal(
        await dialog
          .getByRole('button', { name: 'Edit N-number', exact: true })
          .count(),
        0,
      );
      assert.equal(
        await dialog
          .getByRole('button', { name: 'Edit Engine model', exact: true })
          .count(),
        0,
      );
    }
    assert.equal(
      await dialog
        .getByRole('button', { name: 'Edit Airframe logbooks', exact: true })
        .count(),
      0,
    );
    assert.equal(
      await dialog
        .getByRole('button', { name: 'Submit for Review', exact: true })
        .isEnabled(),
      true,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
    await page.screenshot({
      path: resolve(artifacts, `category-${type}-${width}.png`),
    });
    await dialog
      .getByRole('button', { name: 'Submit for Review', exact: true })
      .click();
    await dialog
      .getByText('Submitted for private RWAS review.', { exact: true })
      .waitFor();
    assert.equal(f.state().listings[saved.id].status, 'pending');
    const row = dialog
      .locator('.seller-listing')
      .filter({ hasText: 'Synthetic ' + type + ' listing' });
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    await jump(spec[0]);
    assert.equal(
      await dialog.locator('#listing-step-input').inputValue(),
      spec[1],
    );
  }
}
