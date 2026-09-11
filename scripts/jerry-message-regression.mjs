import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const widget = read('public/jerry-widget.js');
const newspaper = read('public/newspaper/index.html');
const start = '  // Shared safe renderer:';
const renderer = widget.slice(widget.indexOf(start), widget.indexOf('\n  function render()'));
assert.ok(newspaper.includes(renderer), 'Both shipped renderers must be identical');
assert.ok(!renderer.includes('innerHTML'));
assert.ok(!widget.includes('formatMessage('));
assert.ok(widget.includes('renderMessage(streamMsg, reply)'));
assert.ok(widget.includes('renderMessage(msg, message.content)'));
assert.ok(newspaper.includes("if (m.role === 'assistant') renderMessage(bubble, m.content)"));
assert.ok(read('components/shared/DeferredJerryWidget.tsx').includes('20260911-safe-links'));
class Node {
  constructor(tag, text = '') { this.tag = tag; this.text = text; this.children = []; this.attrs = {}; }
  appendChild(node) { if (node.tag === '#fragment') this.children.push(...node.children); else this.children.push(node); return node; }
  replaceChildren(...nodes) { this.children = []; this.text = ''; nodes.forEach(n => this.appendChild(n)); }
  setAttribute(name, value) { this.attrs[name] = value; }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return this.text + this.children.map(n => n.textContent).join(''); }
}
const context = { URL, document: { createTextNode: t => new Node('#text', t), createElement: tag => new Node(tag), createDocumentFragment: () => new Node('#fragment') } };
vm.createContext(context); vm.runInContext(renderer, context);
const flatten = n => [n, ...n.children.flatMap(flatten)];
const url = 'https://www.rogerwilcoaviation.com/products/pa-31-rudder-trim-rigging-tool?variant=47328308363483';
const cases = [
  ['exact variant', `Live retail listing: ${url} .`, [url]],
  ['period', `${url}.`, [url]], ['comma', `${url}, next`, [url]],
  ['parentheses', `(${url}).`, [url]], ['brackets', `[${url}]`, [url]],
  ['balanced URL', 'https://example.com/a_(b).', ['https://example.com/a_(b)']],
  ['query and fragment', 'https://example.com/?a=1&b=2#part', ['https://example.com/?a=1&b=2#part']],
  ['multiline', `First\n${url}\nSecond`, [url]],
  ['two links', `https://example.com/a and ${url}`, ['https://example.com/a', url]],
  ['http', 'http://example.com/', ['http://example.com/']],
  ['bold URL', `**${url}**`, [url]],
  ['javascript', 'javascript:alert(1)', []], ['data', 'data:text/html,<svg onload=alert(1)>', []],
  ['javascript embedded', 'javascript:https://example.com/', []],
  ['protocol relative', '//example.com/path', []], ['file', 'file:///etc/passwd', []],
  ['credentials', 'https://user:pass@example.com/', []],
  ['backslash', 'https://example.com\\evil', []],
  ['invalid host', 'https://', []],
  ['HTML script', '<script>globalThis.pwned=1</script>', []],
  ['HTML event', '<img src=x onerror="globalThis.pwned=1">', []],
  ['SVG event', '<svg onload=alert(1)>', []],
  ['attribute injection', 'https://example.com/" onclick="alert(1)', ['https://example.com/']],
  ['angle injection', 'https://example.com/><img src=x onerror=alert(1)>', ['https://example.com/']],
  ['encoded quotes', 'https://example.com/%22%3E%3Cscript%3E', ['https://example.com/%22%3E%3Cscript%3E']],
  ['markdown unsafe', '[click](javascript:alert(1))', []],
  ['HTML unsafe link', '<a href="javascript:alert(1)">click</a>', []],
  ['formatting', '**Bold** and __also bold__ and _italic_', []],
  ['underscore word', 'part_number_suffix', []],
  ['marker stripping', 'Hello\nINTAKE_COMPLETE:{"first_name":"test"}', []],
];
for (const [name, text, expected] of cases) {
  const root = new Node('div'); context.renderMessage(root, text);
  const nodes = flatten(root); const links = nodes.filter(n => n.tag === 'a');
  assert.deepEqual(links.map(n => n.attrs.href), expected, name);
  for (const node of nodes) assert.ok(['div', '#text', 'a', 'strong', 'em'].includes(node.tag), `${name}: unsafe tag`);
  for (const link of links) {
    assert.equal(link.attrs.target, '_blank', name);
    assert.equal(link.attrs.rel, 'noopener noreferrer', name);
    assert.equal(link.textContent, link.attrs.href, name);
    assert.deepEqual(Object.keys(link.attrs).sort(), ['href', 'rel', 'target']);
  }
  if (name === 'multiline') assert.equal(root.textContent, text);
  if (name === 'marker stripping') assert.equal(root.textContent, 'Hello');
  if (name === 'formatting') assert.equal(root.textContent, 'Bold and also bold and italic');
  if (name === 'underscore word') assert.equal(root.textContent, text);
}
console.log(`${cases.length}/${cases.length} safe renderer cases passed; identical widget/static renderer and streaming/history wiring verified`);
