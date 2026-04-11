import { LandingHeader, LandingHeaderMenuItem } from '@/components/landing';
import ThemeSwitch from '@/components/shared/ThemeSwitch';
import Link from 'next/link';

const collectionLinks = [
  {
    href: '/collections/garmin-avionics',
    label: 'Garmin',
  },
  {
    href: '/collections/rigging-tools',
    label: 'Papa-Alpha',
  },
  {
    href: '/aircraft-for-sale',
    label: 'Aircraft 4 Sale',
  },
  {
    href: '/collections/on-sale',
    label: 'On Sale',
  },
];

export const Header = ({ className }: { className?: string }) => {
  return (
    <LandingHeader
      className={className}
      fixed
      withBackground
      variant="primary"
      logoComponent={
        <Link href="/" className="flex items-center gap-3 text-primary-500">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary-500/40 bg-primary-500/10 text-sm font-bold text-primary-500">
            RW
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-semibold uppercase tracking-[0.28em] text-primary-500/80">
              Roger Wilco
            </span>
            <span className="text-base font-bold text-foreground">
              Aviation Services
            </span>
          </div>
        </Link>
      }
    >
      <LandingHeaderMenuItem href="/collections">Collections</LandingHeaderMenuItem>
      {collectionLinks.map((item) => (
        <LandingHeaderMenuItem key={item.href} href={item.href}>
          {item.label}
        </LandingHeaderMenuItem>
      ))}
      <LandingHeaderMenuItem href="#services">Services</LandingHeaderMenuItem>
      <LandingHeaderMenuItem href="#contact">Contact</LandingHeaderMenuItem>
      <LandingHeaderMenuItem href="/cart">Cart</LandingHeaderMenuItem>
      <LandingHeaderMenuItem
        type="button"
        href="/collections"
      >
        Browse Products
      </LandingHeaderMenuItem>

      <ThemeSwitch />
    </LandingHeader>
  );
};

export default Header;
