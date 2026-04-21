/*
 * BroadsheetNav
 * The primary nav row. Pass `activeHref` to highlight the current section.
 * The "Ask Jerry" item gets the gold highlight that makes it a visual CTA.
 */
type NavItem = {
  href: string;
  label: string;
  /** Renders this item as the gold "Ask Jerry" CTA variant. */
  accent?: boolean;
};

type Props = {
  items?: NavItem[];
  activeHref?: string;
};

const defaultItems: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '#ask-jerry', label: 'Ask Jerry', accent: true },
  { href: '/collections/on-sale', label: 'On Sale' },
  { href: '/collections/garmin-avionics', label: 'Garmin' },
  { href: '/collections/rigging-tools', label: 'Papa-Alpha Tools' },
  { href: '/aircraft-for-sale', label: 'Aircraft 4 Sale' },
  { href: '/financing', label: 'Financing' },
  { href: '/shop-capabilities', label: 'Shop Capabilities' },
  { href: '/blog/', label: 'Blog Articles' },
  { href: '/contact', label: 'Contact' },
];

export const BroadsheetNav = ({ items = defaultItems, activeHref }: Props) => {
  return (
    <nav className="bs-nav" aria-label="Primary">
      {items.map((item) => {
        const classes = [
          item.accent ? 'bs-nav__item--accent' : '',
          activeHref && activeHref === item.href ? 'bs-nav__item--active' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <a key={item.href + item.label} href={item.href} className={classes || undefined}>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
};

export default BroadsheetNav;
