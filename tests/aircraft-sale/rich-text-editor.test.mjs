import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/Users/rwas/Documents/ChatGPT/New Project/node_modules/playwright/index.mjs');

test('editor adds emphasis and lists, then restores the saved formatting', async () => {
  const bundle = await build({stdin:{contents:`
    import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
    import {RichTextEditor} from './app/aircraft-for-sale/rich-text-editor';
    function App(){const [v,setV]=useState({text:'GPS and radio',format:''});const [visible,setVisible]=useState(true);window.saved=v;return <><button onClick={()=>setVisible(!visible)}>Reopen</button>{visible&&<RichTextEditor label="Avionics" value={v.text} format={v.format} maxLength={10000} onChange={(text,format)=>setV({text,format})}/>}</>}
    createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || (process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined)});
  try {
    const page=await browser.newPage(); await page.setContent('<div id="root"></div>'); await page.addScriptTag({content:bundle.outputFiles[0].text});
    const editor=page.getByRole('textbox',{name:'Avionics'}); await editor.waitFor();
    await editor.evaluate(element=>{ const range=document.createRange();range.selectNodeContents(element);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range); });
    await page.getByRole('button',{name:'Bold',exact:true}).click();
    await page.waitForFunction(()=>window.saved.format.includes('strong'));
    assert.equal(await page.evaluate(()=>window.saved.text),'GPS and radio');
    await page.getByRole('button',{name:'Bulleted list',exact:true}).click();
    await page.waitForFunction(()=>window.saved.format.includes('ul'));
    const saved=await page.evaluate(()=>window.saved); assert.match(saved.format,/"type":"ul"/);
    await page.getByRole('button',{name:'Reopen'}).click(); await page.getByRole('button',{name:'Reopen'}).click();
    assert.equal(await page.locator('[role=textbox] ul strong').textContent(),'GPS and radio');
    await page.getByRole('textbox',{name:'Avionics'}).fill('  First line\nSecond line  \nLast line');
    assert.equal(await page.evaluate(()=>window.saved.text),'  First line\nSecond line  \nLast line');
    await page.getByRole('textbox',{name:'Avionics'}).press('End');
    await page.getByRole('textbox',{name:'Avionics'}).press('Enter');
    await page.keyboard.type('Another line');
    assert.equal(await page.evaluate(()=>window.saved.text),'  First line\nSecond line  \nLast line\nAnother line');
  } finally {await browser.close();}
});
