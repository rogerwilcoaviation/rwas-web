// Formatting is stored separately from the plain listing text. Only these
// attribute-free nodes may be rendered; untrusted or stale data falls back to
// escaped plain text.
export const richTextFields = ['description', 'avionics', 'equipmentList'];
export const richTextKey = (name) => name + 'RichText';
const allowed = new Set(['p', 'div', 'strong', 'em', 'ul', 'ol', 'li', 'br']);
const block = new Set(['p', 'div', 'li']);
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

function read(value) {
  if (typeof value !== 'string' || !value || value.length > 60000) return null;
  let root;
  try { root = JSON.parse(value); } catch { return null; }
  if (root?.v !== 1 || !Array.isArray(root.nodes)) return null;
  let count = 0;
  function valid(node, depth) {
    if (++count > 4000 || depth > 20 || !node || typeof node !== 'object' || Array.isArray(node)) return false;
    if (node.type === 'text') return typeof node.text === 'string' && node.text.length <= 10000;
    if (!allowed.has(node.type)) return false;
    if (node.type === 'br') return true;
    return Array.isArray(node.children) && node.children.every(child => valid(child, depth + 1));
  }
  return root.nodes.every(node => valid(node, 0)) ? root.nodes : null;
}
function plain(nodes) {
  let result = '';
  const walk = (node) => {
    if (node.type === 'text') { result += node.text; return; }
    if (node.type === 'br') { result += '\n'; return; }
    if (block.has(node.type) && result && !result.endsWith('\n')) result += '\n';
    node.children.forEach(walk);
    if (block.has(node.type)) result += '\n';
  };
  nodes.forEach(walk);
  const endsWithBlock = (node) => node && (block.has(node.type) || (node.children?.length && endsWithBlock(node.children[node.children.length - 1])));
  return endsWithBlock(nodes[nodes.length - 1]) && result.endsWith('\n') ? result.slice(0, -1) : result;
}
export function richTextPlain(value) {
  const nodes = read(value);
  return nodes ? plain(nodes) : null;
}
export function richTextHtml(text, value) {
  const nodes = read(value);
  if (!nodes || plain(nodes).trim() !== String(text ?? '').trim()) return escape(text ?? '');
  const html = (node) => node.type === 'text' ? escape(node.text) : node.type === 'br' ? '<br>' : '<' + node.type + '>' + node.children.map(html).join('') + '</' + node.type + '>';
  return nodes.map(html).join('');
}
