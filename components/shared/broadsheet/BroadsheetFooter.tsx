import React from "react";
import Link from "next/link";

export type BroadsheetFooterProps = {
  brand?: string;
  copyright?: string;
};

type PolicyLink = { href: string; label: string };

const DEFAULT_POLICIES: PolicyLink[] = [
  { href: "/terms",    label: "Terms" },
  { href: "/privacy",  label: "Privacy" },
  { href: "/cookies",  label: "Cookies" },
  { href: "/security", label: "Security" },
  { href: "/status",   label: "Status" },
];

/**
 * BroadsheetFooter — ink-900 footer with gold double top rule.
 * Top row: policy links (Terms · Privacy · Cookies · Security · Status).
 * Bottom row: brand + copyright.
 */
export default function BroadsheetFooter({
  brand = "Roger Wilco Aviation Services",
  copyright = `\u00a9 ${new Date().getFullYear()} Roger Wilco Aviation Services \u00b7 Yankton, SD`,
}: BroadsheetFooterProps) {
  return (
    <footer className="bs-footer">
      <nav className="bs-footer__policies" aria-label="Policies">
        {DEFAULT_POLICIES.map((p, i) => (
          <React.Fragment key={p.href}>
            {i > 0 && <span className="bs-footer__sep" aria-hidden="true">·</span>}
            <Link href={p.href} className="bs-footer__policy-link">{p.label}</Link>
          </React.Fragment>
        ))}
      </nav>
      <div className="bs-footer__inner">
        <span className="bs-footer__brand">{brand}</span>
        <span className="bs-footer__copy">{copyright}</span>
      </div>
    </footer>
  );
}
