import React from "react";

export type BroadsheetLayoutProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * BroadsheetLayout — outer wrapper that scopes all .bs-* chrome rules
 * via the .broadsheet class and carries the enr_h05 watermark from
 * broadsheet-tokens.css.
 */
export default function BroadsheetLayout({
  children,
  className,
}: BroadsheetLayoutProps) {
  const classes = ["broadsheet", className].filter(Boolean).join(" ");
  return <div className={classes}>{children}</div>;
}
