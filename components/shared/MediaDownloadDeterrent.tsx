'use client';

import { useEffect } from 'react';

const mediaSelector = 'img, video';

function protectMedia(element: Element) {
  if (
    element instanceof HTMLImageElement ||
    element instanceof HTMLVideoElement
  ) {
    element.draggable = false;
    element.setAttribute('draggable', 'false');
  }

  if (element instanceof HTMLVideoElement) {
    const controls = new Set(
      (element.getAttribute('controlsList') ?? '').split(/\s+/).filter(Boolean),
    );
    controls.add('nodownload');
    element.setAttribute('controlsList', [...controls].join(' '));
  }
}

function protectTree(root: ParentNode) {
  if (root instanceof Element && root.matches(mediaSelector)) {
    protectMedia(root);
  }
  root.querySelectorAll(mediaSelector).forEach(protectMedia);
}

function mediaFromEvent(event: Event) {
  return event.target instanceof Element
    ? event.target.closest(mediaSelector)
    : null;
}

export default function MediaDownloadDeterrent() {
  useEffect(() => {
    protectTree(document);

    const preventMediaContextMenu = (event: MouseEvent) => {
      if (mediaFromEvent(event)) event.preventDefault();
    };
    const preventMediaDrag = (event: DragEvent) => {
      if (mediaFromEvent(event)) event.preventDefault();
    };
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) protectTree(node);
        });
      });
    });

    document.addEventListener('contextmenu', preventMediaContextMenu, true);
    document.addEventListener('dragstart', preventMediaDrag, true);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener(
        'contextmenu',
        preventMediaContextMenu,
        true,
      );
      document.removeEventListener('dragstart', preventMediaDrag, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
