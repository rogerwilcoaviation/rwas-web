import React from 'react';
import SiteSearch from './SiteSearch';

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
  { href: '/', label: 'Home' },
  { href: '#ask-jerry', label: 'Ask Jerry', accent: true },
  {
    href: '/axis-system-planner?source=homepage-navigation',
    label: 'AXIS System Builder',
    accent: true,
  },
  { href: '/panel-planner', label: 'Panel Layout Planner', accent: true },
  { href: '/collections', label: 'Garmin' },
  { href: '/collections/papa-alpha-tools', label: 'Papa-Alpha Tools' },
  { href: '/aircraft-for-sale', label: 'Aviation Exchange' },
  { href: '/financing', label: 'Financing' },
  { href: '/services', label: 'Services' },
  {
    href: '/services/custom-printing-finishing',
    label: 'Printing & Coating',
  },
  { href: '/blog', label: 'Blog Articles' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

/**
 * BroadsheetNav — consistently highlighted primary navigation.
 */
export default function BroadsheetNav({
  items = DEFAULT_ITEMS,
  activeHref,
}: BroadsheetNavProps) {
  const renderItems = () =>
    items.map((item) => {
      const classes = [
        'bs-nav__accent',
        activeHref && activeHref === item.href ? 'bs-nav__active' : '',
      ]
        .filter(Boolean)
        .join(' ');

      return (
        <a
          key={item.href + item.label}
          href={item.href}
          className={classes || undefined}
          aria-current={activeHref === item.href ? 'page' : undefined}
        >
          {item.label}
        </a>
      );
    });

  return (
    <nav className="bs-nav" aria-label="Primary">
      <div className="bs-nav__desktop">{renderItems()}</div>
      <details className="bs-nav__mobile">
        <summary>
          <span>Menu</span>
          <small>Services · Store · Contact</small>
        </summary>
        <div className="bs-nav__mobile-links">{renderItems()}</div>
      </details>
      <SiteSearch
        className="bs-site-search"
        buttonLabel="Search services, products, articles & part numbers"
      />
    </nav>
  );
}
