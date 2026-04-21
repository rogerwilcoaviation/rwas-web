import React from "react";

export type BroadsheetFooterProps = {
  brand?: string;
  copyright?: string;
};

/**
 * BroadsheetFooter — ink-900 footer with gold double top rule.
 */
export default function BroadsheetFooter({
  brand = "Roger Wilco Aviation Services",
  copyright = `\u00a9 ${new Date().getFullYear()} Roger Wilco Aviation Services \u00b7 Yankton, SD`,
}: BroadsheetFooterProps) {
  return (
    <footer className="bs-footer">
      <div className="bs-footer__inner">
        <span className="bs-footer__brand">{brand}</span>
        <span className="bs-footer__copy">{copyright}</span>
      </div>
    </footer>
  );
}
