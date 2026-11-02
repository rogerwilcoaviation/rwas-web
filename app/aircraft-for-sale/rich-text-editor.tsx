'use client';

import { useEffect, useRef, useState } from 'react';
import { richTextHtml, richTextPlain } from '@/lib/marketplace/rich-text.mjs';

type Props = {
  label: string;
  value: string;
  format: string;
  maxLength: number;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (text: string, format: string) => void;
};

// Convert browser editing markup to a small, attribute-free document. Pasted
// content is plain text; arbitrary elements are never stored as HTML.
function documentNodes(parent: Node): unknown[] {
  return Array.from(parent.childNodes).flatMap((node): unknown[] => {
    if (node.nodeType === Node.TEXT_NODE)
      return [{ type: 'text', text: (node.textContent || '').replace(/\u00a0/g, ' ') }];
    if (node.nodeType !== Node.ELEMENT_NODE) return [];
    const tag = (node as Element).tagName.toLowerCase();
    if (['script', 'style', 'iframe', 'object'].includes(tag)) return [];
    const type = ({ b: 'strong', i: 'em' } as Record<string, string>)[tag] || tag;
    if (type === 'br') return [{ type }];
    const children = documentNodes(node);
    if (['p', 'div', 'strong', 'em', 'ul', 'ol', 'li'].includes(type))
      return [{ type, children }];
    return children;
  });
}

// Existing listings can contain several lines in a single text node, sometimes
// prefixed with literal asterisks. Convert these into separate list items while
// keeping any bold or italic spans intact.
function convertLegacyList(editor: HTMLElement, action: string): boolean {
  if (!['insertUnorderedList', 'insertOrderedList'].includes(action)) return false;
  const selected = window.getSelection();
  if (!selected) return false;
  const selectedText = selected.toString().replace(/\u00a0/g, ' ');
  const allSelected = !!selectedText && [editor.innerText, editor.textContent || ''].some(
    text => selectedText === text.replace(/\u00a0/g, ' '),
  );
  if (selectedText && !allSelected) return false;
  const lines: DocumentFragment[] = [document.createDocumentFragment()];
  let supported = true;
  let existingItems = 0;
  const append = (text: string, marks: string[]) => {
    if (!text) return;
    let child: Node = document.createTextNode(text);
    for (const mark of [...marks].reverse()) {
      const wrapper = document.createElement(mark);
      wrapper.appendChild(child);
      child = wrapper;
    }
    lines[lines.length - 1].appendChild(child);
  };
  const walk = (node: Node, marks: string[] = []) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const pieces = (node.textContent || '').replace(/\u00a0/g, ' ').split('\n');
      pieces.forEach((piece, index) => {
        if (index) lines.push(document.createDocumentFragment());
        append(piece, marks);
      });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = (node as Element).tagName.toLowerCase();
    if (tag === 'br') { lines.push(document.createDocumentFragment()); return; }
    if (tag === 'div' || tag === 'p') {
      if (lines[lines.length - 1].textContent) lines.push(document.createDocumentFragment());
      node.childNodes.forEach(child => walk(child, marks));
      if (node.nextSibling && lines[lines.length - 1].textContent)
        lines.push(document.createDocumentFragment());
      return;
    }
    const mark = ({ b: 'strong', i: 'em', strong: 'strong', em: 'em' } as Record<string, string>)[tag];
    if (!mark) { supported = false; return; }
    node.childNodes.forEach(child => walk(child, [...marks, mark]));
  };
  editor.childNodes.forEach(node => {
    if (node instanceof HTMLElement && ['UL', 'OL'].includes(node.tagName)) {
      const items = Array.from(node.children);
      if (!items.length || items.some(item => item.tagName !== 'LI')) { supported = false; return; }
      existingItems += items.length;
      items.forEach((item, index) => {
        if (index) lines.push(document.createDocumentFragment());
        item.childNodes.forEach(child => walk(child));
      });
    } else walk(node);
  });
  let start = 0, end = lines.length;
  while (start < end && !lines[start].textContent) start++;
  while (end > start && !lines[end - 1].textContent) end--;
  const content = lines.slice(start, end);
  const prefixes = content.map(line => (line.textContent || '').match(/^[ \t]*(?:[*•-]|\d+[.)])[ \t]+/)?.[0]);
  const allPrefixed = prefixes.every(Boolean);
  if (!supported || content.length < 2 || content.some(line => !line.textContent) ||
      (existingItems && !allPrefixed && content.length <= existingItems)) return false;
  const list = document.createElement(action === 'insertOrderedList' ? 'ol' : 'ul');
  content.forEach((line, index) => {
    let remaining = allPrefixed ? prefixes[index]!.length : 0;
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
    for (const node of textNodes) {
      if (!remaining) break;
      const removed = Math.min(remaining, node.data.length);
      node.deleteData(0, removed);
      remaining -= removed;
    }
    const item = document.createElement('li');
    item.appendChild(line);
    list.appendChild(item);
  });
  const range = document.createRange();
  range.selectNodeContents(editor);
  selected.removeAllRanges();
  selected.addRange(range);
  const wrapper = document.createElement('div');
  for (let index = 0; index < start; index++) wrapper.appendChild(document.createElement('br'));
  wrapper.appendChild(list);
  const trailing = lines.length - end;
  for (let index = 1; index < trailing; index++) wrapper.appendChild(document.createElement('br'));
  if (trailing) wrapper.appendChild(document.createElement('div'));
  const inserted = document.execCommand('insertHTML', false, wrapper.innerHTML);
  const desired = action === 'insertOrderedList' ? 'OL' : 'UL';
  if (inserted && editor.children.length === 1 &&
      ['OL', 'UL'].includes(editor.children[0].tagName) &&
      editor.children[0].tagName !== desired) {
    const insertedRange = document.createRange();
    insertedRange.selectNodeContents(editor);
    selected.removeAllRanges();
    selected.addRange(insertedRange);
    document.execCommand(action, false);
  }
  return inserted;
}

export function RichTextEditor({label, value, format, maxLength, disabled, invalid, onChange}: Props) {
  const editor = useRef<HTMLDivElement>(null);
  const last = useRef('');
  const selection = useRef<Range | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const current = JSON.stringify([value, format]);
    if (!editor.current || current === last.current) return;
    editor.current.innerHTML = richTextHtml(value, format);
    last.current = current;
  }, [value, format]);
  function rememberSelection() {
    const selected = window.getSelection();
    if (selected?.rangeCount && editor.current?.contains(selected.anchorNode))
      selection.current = selected.getRangeAt(0).cloneRange();
  }
  function update() {
    if (!editor.current) return;
    const serialized = JSON.stringify({v: 1, nodes: documentNodes(editor.current)});
    const text = richTextPlain(serialized);
    if (text === null || text.length > maxLength || serialized.length > 60000) {
      editor.current.innerHTML = richTextHtml(value, format);
      setError(`Keep this field within ${maxLength.toLocaleString()} characters.`);
      return;
    }
    setError('');
    last.current = JSON.stringify([text, serialized]);
    onChange(text, serialized);
    rememberSelection();
  }
  function command(action: string) {
    if (!editor.current) return;
    editor.current.focus();
    if (selection.current && editor.current.contains(selection.current.commonAncestorContainer)) {
      const current = window.getSelection();
      current?.removeAllRanges();
      current?.addRange(selection.current);
    }
    if (!convertLegacyList(editor.current, action)) document.execCommand(action, false);
    update();
  }
  return (
    <div className="rich-editor">
      <div className="rich-toolbar" role="toolbar" aria-label={`${label} formatting`}>
        {[
          ['bold', 'Bold', 'B'],
          ['italic', 'Italic', 'I'],
          ['insertUnorderedList', 'Bulleted list', '• List'],
          ['insertOrderedList', 'Numbered list', '1. List'],
        ].map(([action, title, caption]) => (
          <button key={action} type="button" aria-label={title} title={title} disabled={disabled} style={{fontWeight: action === 'bold' ? 700 : undefined, fontStyle: action === 'italic' ? 'italic' : undefined}} onMouseDown={event => event.preventDefault()} onClick={() => command(action)}>{caption}</button>
        ))}
      </div>
      <div ref={editor} id="listing-step-input" role="textbox" aria-label={label} aria-multiline="true" aria-describedby="listing-step-help listing-field-count" aria-invalid={invalid || !!error} contentEditable={!disabled} suppressContentEditableWarning onInput={update} onKeyUp={rememberSelection} onMouseUp={rememberSelection} onPaste={event => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); }} className="rich-editor-input" />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
