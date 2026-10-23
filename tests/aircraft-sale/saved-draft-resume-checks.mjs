import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  listingCategories,
  categoryFields,
} from '../../lib/marketplace/schema.mjs';

// The real exported seller panel, real widget, and disposable business service.
export async function checkSavedDraftResume({
  page,
  dialog,
  f,
  width,
  artifacts,
  token,
  origin,
}) {
  await dialog
    .getByRole('button', { name: 'Close seller panel', exact: true })
    .click();
  await page.evaluate(() => {
    window.jerryChat = window.__realJerryChat;
  });
  const savedDraft = async () =>
    (await (await f.call('/draft', 'GET', undefined, token)).json()).draft;
  async function openResume() {
    await page
      .getByRole('button', { name: 'My Listings', exact: true })
      .click();
    await dialog
      .getByRole('button', { name: 'Resume Saved Draft', exact: true })
      .click();
    await dialog
      .getByRole('button', { name: 'Resume manually', exact: true })
      .waitFor();
    await dialog
      .getByRole('button', { name: 'Resume with Jerry', exact: true })
      .waitFor();
  }
  async function reviewAnswers(saved) {
    await dialog
      .getByRole('button', { name: 'Review draft', exact: true })
      .click();
    const details = await dialog.innerText();
    for (const value of [
      ...(saved.listingType === 'aircraft' ? [] : [saved.title]),
      saved.description,
      saved.sellerLocation,
      ...Object.values(saved.specifications || {}),
    ])
      assert.ok(
        details.includes(value),
        'Saved answer is retained in manual review: ' + value,
      );
  }
  for (const type of ['aircraft', 'hangars', 'parts', 'tools']) {
    const answers = {
      workflowVersion: '3',
      listingType: type,
      category: listingCategories.find((c) => c.type === type).id,
      title: 'Synthetic resume ' + type,
      ...(type === 'aircraft'
        ? { make: 'Synthetic', model: 'Resume Aircraft' }
        : {}),
      description: 'Retained description ' + type,
      sellerLocation: 'Synthetic saved location',
    };
    const spec = categoryFields(answers).find(
      (field) => !field.options && field.type !== 'number',
    );
    if (spec)
      answers.specifications = {
        [spec.name.slice(5)]: 'Retained specification',
      };
    for (const intake of [false, true]) {
      assert.equal(
        (await f.call('/draft', 'PUT', answers, token, { Origin: origin }))
          .status,
        200,
      );
      if (intake)
        assert.equal(
          (
            await f.call(
              '/intake',
              'POST',
              { resume: true, messages: [{ role: 'user', content: 'Resume' }] },
              token,
              { Origin: origin },
            )
          ).status,
          200,
        );
      const before = await savedDraft();
      const listingsBefore = Object.keys(f.state().listings).length;
      await openResume();
      assert.equal(
        await page.locator('.jerry-widget-panel').isVisible(),
        false,
      );
      if (type === 'aircraft' && !intake)
        await page.screenshot({
          path: resolve(artifacts, 'resume-choice-' + width + '.png'),
        });
      await dialog
        .getByRole('button', { name: 'Resume manually', exact: true })
        .click();
      await dialog
        .getByRole('button', { name: 'Review draft', exact: true })
        .waitFor();
      assert.notEqual(
        await dialog.getByLabel('Listing step index').inputValue(),
        '0',
        'Resumes at an unfinished item',
      );
      await reviewAnswers(answers);
      assert.deepEqual(
        await savedDraft(),
        before,
        'Viewing manually never overwrites saved intake',
      );
      await dialog
        .getByRole('button', { name: 'Close seller panel', exact: true })
        .click();
      await openResume();
      const response = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname.endsWith('/intake') &&
          r.request().postDataJSON()?.resume === true,
      );
      await dialog
        .getByRole('button', { name: 'Resume with Jerry', exact: true })
        .click();
      try {
        assert.equal((await response).status(), 200);
      } catch (error) {
        console.error(
          JSON.stringify({
            type,
            intake,
            widget: await page.locator('.jerry-widget-panel').innerText(),
            calls: await page.evaluate(() => window.__jerryCalls),
            errors: await page.locator('[role=alert]').allTextContents(),
          }),
        );
        throw error;
      }
      await page
        .locator('.jerry-widget-msg')
        .filter({ hasText: 'Continuing your saved draft.' })
        .last()
        .waitFor();
      const withJerry = await savedDraft();
      for (const [key, value] of Object.entries(answers))
        assert.deepEqual(withJerry.fields[key], value);
      if (intake)
        assert.equal(
          withJerry.step,
          before.step,
          'Opening Jerry does not answer the next question',
        );
      await page
        .getByRole('link', {
          name: 'Prefer to fill out the form manually?',
          exact: true,
        })
        .last()
        .click();
      await dialog
        .getByRole('button', { name: 'Review draft', exact: true })
        .waitFor();
      await reviewAnswers(answers);
      assert.equal(
        await page.locator('.jerry-widget-panel').isVisible(),
        false,
      );
      assert.equal(
        Object.keys(f.state().listings).length,
        listingsBefore,
        'Changing methods creates no listing',
      );
      await dialog
        .getByRole('button', { name: 'Save Draft', exact: true })
        .click();
      await dialog
        .getByText('Draft saved. Add media, then submit for review.', {
          exact: true,
        })
        .waitFor();
      assert.equal(
        await savedDraft(),
        null,
        'Saving consumes exactly the resumed intake',
      );
      const created = Object.values(f.state().listings).sort(
        (a, b) => b.createdAt - a.createdAt,
      )[0];
      assert.ok(created);
      assert.equal(Object.keys(f.state().listings).length, listingsBefore + 1);
      await dialog
        .getByRole('button', { name: 'Save Draft', exact: true })
        .click();
      await dialog
        .getByRole('button', { name: 'Close seller panel', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'My Listings', exact: true })
        .click();
      assert.equal(
        await dialog
          .getByRole('button', { name: 'Resume Saved Draft', exact: true })
          .count(),
        0,
      );
      const matching = Object.values(f.state().listings);
      assert.equal(
        Object.keys(f.state().listings).length,
        listingsBefore + 1,
        'Repeat save keeps listing identity',
      );
      assert.ok(matching.some((l) => l.id === created.id));
      await dialog
        .getByRole('button', { name: 'Close seller panel', exact: true })
        .click();
    }
  }
  await page.getByRole('button', { name: 'My Listings', exact: true }).click();
}
