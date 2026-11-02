import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs'
);

test('seller can choose and clear an accessible condition rating', async () => {
  const result = await build({
    stdin: {
      contents: `
        import React, {useState} from 'react';
        import {createRoot} from 'react-dom/client';
        import {ListingDraftWorkflow} from './app/aircraft-for-sale/listing-draft-workflow';
        import {getDraftFields} from './app/aircraft-for-sale/listing-draft-fields';
        function App() {
          const [values,setValues]=useState({workflowVersion:'3',listingType:'aircraft',category:'piston-single-aircraft'});
          const step=getDraftFields(values).findIndex(f=>f.name==='exteriorRating');
          return <ListingDraftWorkflow values={values} onChange={(name,value)=>setValues(v=>({...v,[name]:value}))} busy={false} saved={true} onSave={async()=>true} onSubmitReview={async()=>{}} renderMedia={()=>null} mediaCounts={{}} initialStep={step}/>;
        }
        createRoot(document.getElementById('root')).render(<App/>);
      `,
      resolveDir: process.cwd(),
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      (process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : undefined),
  });
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: result.outputFiles[0].text });
    const group = page.getByRole('radiogroup', { name: /exterior/i });
    await group.waitFor();
    const choices = group.getByRole('radio');
    assert.equal(await choices.count(), 6);
    for (const width of [320, 390, 900]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await group.evaluate((element) => {
        const inputs = [...element.querySelectorAll('input[type="radio"]')];
        return {
          inputSizes: inputs.map((input) => ({
            width: input.getBoundingClientRect().width,
            height: input.getBoundingClientRect().height,
          })),
          pageWidth: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
        };
      });
      assert.ok(
        layout.inputSizes.every(
          ({ width, height }) =>
            width >= 16 && width <= 26 && height >= 16 && height <= 26,
        ),
        `radio dimensions at ${width}px: ${JSON.stringify(layout.inputSizes)}`,
      );
      assert.ok(
        layout.pageWidth <= layout.viewport + 1,
        `no horizontal overflow at ${width}px`,
      );
    }
    await choices.nth(4).check();
    assert.equal(await choices.nth(4).isChecked(), true);
    await choices.nth(0).check();
    assert.equal(await choices.nth(0).isChecked(), true);
  } finally {
    await browser.close();
  }
});
