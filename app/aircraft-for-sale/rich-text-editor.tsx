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
    document.execCommand(action, false);
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
