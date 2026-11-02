import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs');

test('viewing current listing preserves saved draft until a field changes', async () => {
  const bundle = await build({
    stdin: {
      contents: `
        import React, {useRef, useState} from 'react';
        import {createRoot} from 'react-dom/client';
        import {useListingAutosave} from './app/aircraft-for-sale/listing-autosave';
        function App() {
          const [values,setValues]=useState({description:'Current listing'});
          const [step,setStep]=useState(0); const revision=useRef('old');
          const autosave=useListingAutosave({owner:'test',enabled:true,editor:1,values,step,listingId:'listing',listingRevision:1,revision,preserveUntilChange:true,request:async body=>{window.requests.push(body);return {revision:'new'};}});
          return <><button onClick={()=>{autosave.capture(values,1);setStep(1);}}>Navigate</button><input aria-label="Description" value={values.description} onChange={e=>setValues({description:e.target.value})}/></>;
        }
        window.requests=[]; createRoot(document.getElementById('root')).render(<App/>);
      `,
      resolveDir: process.cwd(), loader: 'tsx',
    },
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
  });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined) });
  try {
    const page = await browser.newPage();
    await page.route('https://example.test/', route => route.fulfill({body:'<div id="root"></div>',contentType:'text/html'}));
    await page.goto('https://example.test/');
    await page.evaluate(() => localStorage.setItem('rwas-listing-recovery-v1:test', 'saved recovery'));
    await page.addScriptTag({content: bundle.outputFiles[0].text});
    await page.getByRole('button', {name:'Navigate'}).click();
    await page.waitForTimeout(800);
    assert.deepEqual(await page.evaluate(() => window.requests), []);
    assert.equal(await page.evaluate(() => localStorage.getItem('rwas-listing-recovery-v1:test')), 'saved recovery');
    await page.getByLabel('Description').fill('Changed current listing');
    await page.waitForFunction(() => window.requests.length === 1);
    assert.equal(await page.evaluate(() => window.requests[0].values.description), 'Changed current listing');
  } finally { await browser.close(); }
});
