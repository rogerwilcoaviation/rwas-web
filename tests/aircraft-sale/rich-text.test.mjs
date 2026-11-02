import test from 'node:test';
import assert from 'node:assert/strict';
import { richTextHtml, richTextPlain } from '../../lib/marketplace/rich-text.mjs';
import { fixture, fields, submit, approve } from './fixture.mjs';

test('formatted lists and emphasis render as safe HTML and preserve plain text', () => {
  const value = JSON.stringify({ v: 1, nodes: [
    { type: 'p', children: [{ type: 'strong', children: [{ type: 'text', text: 'Panel' }] }] },
    { type: 'ul', children: [
      { type: 'li', children: [{ type: 'text', text: 'GPS <750>' }] },
      { type: 'li', children: [{ type: 'em', children: [{ type: 'text', text: 'Autopilot' }] }] },
    ] },
  ] });
  assert.equal(richTextPlain(value), 'Panel\nGPS <750>\nAutopilot');
  assert.equal(richTextHtml('Panel\nGPS <750>\nAutopilot', value), '<p><strong>Panel</strong></p><ul><li>GPS &lt;750&gt;</li><li><em>Autopilot</em></li></ul>');
});

test('invalid, hostile or stale formatting cannot inject HTML or replace listing text', () => {
  const malicious = JSON.stringify({ v: 1, nodes: [{ type: 'img', text: '<img src=x onerror=alert(1)>' }] });
  assert.equal(richTextHtml('<img src=x onerror=alert(1)>', malicious), '&lt;img src=x onerror=alert(1)&gt;');
  const hostileText = JSON.stringify({v:1,nodes:[{type:'strong',children:[{type:'text',text:'<script>alert(1)</script>'}]}]});
  assert.equal(richTextHtml('<script>alert(1)</script>', hostileText), '<strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong>');
  const stale = JSON.stringify({ v: 1, nodes: [{ type: 'text', text: 'old' }] });
  assert.equal(richTextHtml('new & correct', stale), 'new &amp; correct');
  assert.equal(richTextHtml('plain\nlisting', ''), 'plain\nlisting');
});

test('draft autosave and public listing preserve formatted details', async () => {
  const f = fixture(), owner = await f.login();
  const format = JSON.stringify({v:1,nodes:[{type:'ul',children:[{type:'li',children:[{type:'strong',children:[{type:'text',text:'GPS'}]}]},{type:'li',children:[{type:'text',text:'Radio'}]}]}]});
  const response = await f.call('/draft/autosave','PUT',{values:{avionics:'GPS\nRadio',avionicsRichText:format},step:1,listingId:null,listingRevision:null,expectedRevision:null},owner);
  assert.equal(response.status, 200, await response.clone().text());
  f.restart();
  const saved = await (await f.call('/draft','GET',undefined,owner)).json();
  assert.equal(saved.draft.values.avionicsRichText,format);
  const created = await f.call('/listings','POST',{...fields,avionics:'GPS\nRadio',avionicsRichText:format},owner,{'Idempotency-Key':'rich-test','X-RWAS-Draft-Revision':saved.revision});
  assert.equal(created.status,201,await created.clone().text());
  const listing=(await created.json()).listing;
  assert.equal(listing.avionics,'GPS\nRadio');
  assert.equal(listing.avionicsRichText,format);
  assert.equal((await submit(f,owner,listing)).status,200);
  assert.equal((await approve(f,listing)).status,200);
  const html=await (await f.call('/listing/'+listing.id,'GET',undefined,undefined,{Accept:'text/html'})).text();
  assert.match(html,/<h3>Avionics<\/h3><div class="copy"><ul><li><strong>GPS<\/strong><\/li><li>Radio<\/li><\/ul><\/div>/);
});

test('formatted draft fields with multibyte text fit within the bounded request limit', async () => {
  const f=fixture(), owner=await f.login();
  const text='✈'.repeat(8000);
  const format=JSON.stringify({v:1,nodes:[{type:'text',text}]});
  const values={description:text,descriptionRichText:format,avionics:text,avionicsRichText:format,equipmentList:text,equipmentListRichText:format};
  const response=await f.call('/draft/autosave','PUT',{values,step:1,listingId:null,listingRevision:null,expectedRevision:null},owner);
  assert.equal(response.status,200,await response.clone().text());
  assert.equal((await response.json()).draft.values.equipmentList,text);
});
