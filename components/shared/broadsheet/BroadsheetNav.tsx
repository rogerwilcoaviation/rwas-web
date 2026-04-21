import React from "react";

export type NavItem = {
  href: string;
  label: string;
  accent?: boolean;
};

export type BroadsheetNavProps = {
  items?: NavItem[];
  activeHref?: string;
};

const DEFAULT_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "#ask-jerry", label: "Ask Jerry", accent: true },
  { href: "/collections/on-sale", label: "On Sale" },
  { href: "/collections/garmin-avionics-certified-retail", label: "Garmin" },
  { href: "/collections/retail-experimental", label: "Papa-Alpha Tools" },
  { href: "/aircraft-for-sale", label: "Aircraft 4 Sale" },
  { href: "/financing", label: "Financing" },
  { href: "/shop-capabilities", label: "Shop Capabilities" },
  { href: "/blog", label: "Blog Articles" },
  { href: "/about", label: "About" },
];

/**
 * BroadsheetNav — single-row primary nav with gold-light ASK JERRY accent.
 * Matches the approved D2 PDP mockup (.np-nav).
 */
export default function BroadsheetNav({
  items = DEFAULT_ITEMS,
  activeHref,
}: BroadsheetNavProps) {
  return (
    <nav className="bs-nav" aria-label="Primary">
      {items.map((item) => {
        const classes = [
          item.accent ? "bs-nav__accent" : "",
          activeHref && activeHref === item.href ? "bs-nav__active" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <a key={item.href + item.label} href={item.href} className={classes || undefined}>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
