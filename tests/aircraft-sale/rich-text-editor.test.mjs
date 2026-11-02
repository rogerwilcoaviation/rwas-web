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

test('italic indicates its active state and formats selected and newly typed text', async () => {
  const bundle = await build({stdin:{contents:`
    import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
    import {RichTextEditor} from './app/aircraft-for-sale/rich-text-editor';
    function App(){const [v,setV]=useState({text:'Aircraft',format:''});const [visible,setVisible]=useState(true);window.saved=v;return <><button onClick={()=>setVisible(!visible)}>Reopen</button>{visible&&<RichTextEditor label="Description" value={v.text} format={v.format} maxLength={10000} onChange={(text,format)=>setV({text,format})}/>}</>}
    createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || (process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined)});
  try {
    const page=await browser.newPage(); await page.setContent('<div id="root"></div>'); await page.addScriptTag({content:bundle.outputFiles[0].text});
    const editor=page.getByRole('textbox',{name:'Description'}), italic=page.getByRole('button',{name:'Italic',exact:true});
    await editor.waitFor();
    await editor.evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);element.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});
    await italic.click();
    assert.equal(await italic.getAttribute('aria-pressed'),'true');
    assert.equal(await editor.locator('i,em').first().evaluate(el=>getComputedStyle(el).fontStyle),'italic');
    assert.match((await page.evaluate(()=>window.saved.format)),/"type":"em"/);
    await page.getByRole('button',{name:'Reopen'}).click();await page.getByRole('button',{name:'Reopen'}).click();
    assert.equal(await editor.locator('em').first().evaluate(el=>getComputedStyle(el).fontStyle),'italic');
    await editor.fill('');await editor.focus();await italic.click();
    assert.equal(await italic.getAttribute('aria-pressed'),'true');
    await page.keyboard.type('New text');
    assert.equal(await editor.locator('i,em').first().textContent(),'New text');
  } finally {await browser.close();}
});

test('list buttons convert existing asterisk lines into individual list items', async () => {
  const bundle = await build({stdin:{contents:`
    import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
    import {RichTextEditor} from './app/aircraft-for-sale/rich-text-editor';
    function App(){const [v,setV]=useState({text:'* GPS navigator\\n* Autopilot\\n* Transponder',format:''});window.saved=v;window.setDraft=setV;return <RichTextEditor label="Avionics" value={v.text} format={v.format} maxLength={10000} onChange={(text,format)=>setV({text,format})}/>}
    createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || (process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined)});
  try {
    const page=await browser.newPage(); await page.setContent('<div id="root"></div>'); await page.addScriptTag({content:bundle.outputFiles[0].text});
    const editor=page.getByRole('textbox',{name:'Avionics'}); await editor.waitFor();
    await editor.click();
    await page.getByRole('button',{name:'Bulleted list',exact:true}).click();
    assert.deepEqual(await editor.locator('ul > li').allTextContents(),['GPS navigator','Autopilot','Transponder']);
    const blockText='* GPS navigator\n* Autopilot\n* Transponder';
    const blockFormat=JSON.stringify({v:1,nodes:['* GPS navigator','* Autopilot','* Transponder'].map(text=>({type:'div',children:[{type:'text',text}]}))});
    await page.evaluate(({text,format})=>window.setDraft({text,format}),{text:blockText,format:blockFormat});
    await page.waitForFunction(()=>document.querySelectorAll('[role=textbox] > div').length===3);
    await editor.click();
    await page.getByRole('button',{name:'Bulleted list',exact:true}).click();
    assert.deepEqual(await editor.locator('ul > li').allTextContents(),['GPS navigator','Autopilot','Transponder']);
    assert.equal(await page.evaluate(()=>window.saved.text),'GPS navigator\nAutopilot\nTransponder');
    await editor.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
    assert.equal(await page.evaluate(()=>window.saved.text),'* GPS navigator\n* Autopilot\n* Transponder');
    await page.evaluate(()=>window.setDraft({text:'* GPS navigator\n* Autopilot\n* Transponder',format:''}));
    await page.waitForFunction(()=>{const e=document.querySelector('[role=textbox]');return e?.childNodes.length === 1 && e.firstChild.nodeType === Node.TEXT_NODE && window.saved.format === '';});
    await editor.evaluate(element=>{const node=element.firstChild;const range=document.createRange();range.setStart(node,2);range.setEnd(node,15);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);element.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});
    await page.getByRole('button',{name:'Bold',exact:true}).click();
    await editor.click();
    await page.getByRole('button',{name:'Numbered list',exact:true}).click();
    assert.deepEqual(await editor.locator('ol > li').allTextContents(),['GPS navigator','Autopilot','Transponder']);
    assert.equal(await editor.locator('ol > li').first().locator('strong,b').textContent(),'GPS navigator');
    await editor.fill('* GPS navigator\n* Autopilot\n* Transponder');
    const enteredHtml=await editor.innerHTML();
    await editor.click();
    await page.getByRole('button',{name:'Bulleted list',exact:true}).click();
    assert.deepEqual(await editor.locator('ul > li').allTextContents(),['GPS navigator','Autopilot','Transponder'],enteredHtml + ' => ' + await editor.innerHTML());
    const badText='* GPS navigator\n* Autopilot\n* Transponder';
    const badFormat=JSON.stringify({v:1,nodes:[{type:'ul',children:[{type:'li',children:[{type:'text',text:badText}]}]}]});
    await page.evaluate(({text,format})=>window.setDraft({text,format}),{text:badText,format:badFormat});
    await page.waitForFunction(()=>document.querySelectorAll('[role=textbox] ul > li').length===1);
    await editor.click();
    await page.getByRole('button',{name:'Bulleted list',exact:true}).click();
    assert.deepEqual(await editor.locator('ul > li').allTextContents(),['GPS navigator','Autopilot','Transponder']);
    await page.evaluate(()=>window.setDraft({text:'* GPS navigator\n* Autopilot\n* Transponder\n\n',format:''}));
    await page.waitForFunction(()=>document.querySelector('[role=textbox]')?.textContent === '* GPS navigator\n* Autopilot\n* Transponder\n\n');
    await editor.click();
    await page.getByRole('button',{name:'Bulleted list',exact:true}).click();
    assert.deepEqual(await editor.locator('ul > li').allTextContents(),['GPS navigator','Autopilot','Transponder']);
    assert.equal(await page.evaluate(()=>window.saved.text),'GPS navigator\nAutopilot\nTransponder\n\n');
    await page.evaluate(()=>window.setDraft({text:'GPS navigator\nAutopilot\nTransponder',format:''}));
    await page.waitForFunction(()=>document.querySelector('[role=textbox]')?.textContent === 'GPS navigator\nAutopilot\nTransponder');
    await editor.click();
    await page.getByRole('button',{name:'Numbered list',exact:true}).click();
    assert.deepEqual(await editor.locator('ol > li').allTextContents(),['GPS navigator','Autopilot','Transponder']);
    await page.evaluate(()=>window.setDraft({text:'GPS navigator\nAutopilot\nTransponder',format:''}));
    await page.waitForFunction(()=>!document.querySelector('[role=textbox] ol'));
    await editor.evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);element.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});
    await page.getByRole('button',{name:'Numbered list',exact:true}).click();
    assert.deepEqual(await editor.locator('ol > li').allTextContents(),['GPS navigator','Autopilot','Transponder']);
    await editor.evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);element.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});
    await page.getByRole('button',{name:'Numbered list',exact:true}).click();
    assert.equal(await editor.locator('ol').count(),0,'An existing numbered list can be switched off');
  } finally {await browser.close();}
});
