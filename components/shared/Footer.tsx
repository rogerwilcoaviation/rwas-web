import { LandingFooter, LandingFooterColumn, LandingFooterLink } from '@/components/landing';

const collectionLinks = [
  {
    href: '/collections/garmin-avionics',
    label: 'Garmin install-only',
  },
  {
    href: '/collections/garmin-avionics-certified-retail',
    label: 'Garmin retail',
  },
  {
    href: '/collections/garmin-avionics-accessories',
    label: 'Garmin accessories',
  },
  {
    href: '/collections/papa-alpha-tools',
    label: 'Experimental avionics',
  },
  {
    href: '/collections/rigging-tools',
    label: 'Papa-Alpha tools',
  },
  {
    href: '/collections/on-sale',
    label: 'On Sale',
  },
];

export const Footer = ({ className }: { className?: string }) => {
  return (
    <LandingFooter
      className={className}
      title="Roger Wilco Aviation Services"
      description="Garmin avionics, NDT, fabrication, and practical aircraft support from a real working shop."
      withBackground
      withBackgroundGlow={false}
      variant="primary"
      backgroundGlowVariant="primary"
      withBackgroundGradient
      logoComponent={
        <div className="flex items-center gap-3 text-primary-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary-500/40 bg-primary-500/10 text-sm font-bold text-primary-500">
            RW
          </div>
          <span className="font-semibold">RWAS</span>
        </div>
      }
    >
      <LandingFooterColumn title="Collections">
        {collectionLinks.slice(0, 3).map((link) => (
          <LandingFooterLink key={link.href} href={link.href}>
            {link.label}
          </LandingFooterLink>
        ))}
      </LandingFooterColumn>
      <LandingFooterColumn title="More products">
        {collectionLinks.slice(3).map((link) => (
          <LandingFooterLink key={link.href} href={link.href}>
            {link.label}
          </LandingFooterLink>
        ))}
      </LandingFooterColumn>
      <LandingFooterColumn title="Company">
        <LandingFooterLink href="https://www.rogerwilcoaviation.com/pages/about">
          About
        </LandingFooterLink>
        <LandingFooterLink href="https://www.rogerwilcoaviation.com/pages/shop-capabilities">
          Shop capabilities
        </LandingFooterLink>
        <LandingFooterLink href="https://www.rogerwilcoaviation.com/pages/contact">
          Contact
        </LandingFooterLink>
      </LandingFooterColumn>
      <LandingFooterColumn title="Commerce">
        <LandingFooterLink href="/collections">Browse collections</LandingFooterLink>
        <LandingFooterLink href="https://www.rogerwilcoaviation.com/cart">
          View Shopify cart
        </LandingFooterLink>
        <LandingFooterLink href="https://www.rogerwilcoaviation.com/pages/contact">
          Request a quote
        </LandingFooterLink>
      </LandingFooterColumn>
    </LandingFooter>
  );
};

export default Footer;
