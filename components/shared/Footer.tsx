import { LandingFooter, LandingFooterColumn, LandingFooterLink } from '@/components/landing';

const collectionLinks = [
  {
    href: '/collections/avionics-certified',
    label: 'Avionics certified retail',
  },
  {
    href: '/collections/avionics-experimental',
    label: 'Avionics experimental',
  },
  {
    href: '/collections/pilot-gear',
    label: 'Pilot gear',
  },
  {
    href: '/collections/watches-accessories',
    label: 'Watches & accessories',
  },
  {
    href: '/collections/garmin-dealer-install',
    label: 'Dealer install parts',
  },
  {
    href: '/collections/papa-alpha-tools',
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
        <LandingFooterLink href="/about">
          About
        </LandingFooterLink>
        <LandingFooterLink href="/shop-capabilities">
          Shop capabilities
        </LandingFooterLink>
        <LandingFooterLink href="/services/garmin-installation-northern-plains">
          Garmin installation
        </LandingFooterLink>
        <LandingFooterLink href="/services/aircraft-maintenance-yankton">
          Aircraft maintenance
        </LandingFooterLink>
        <LandingFooterLink href="/services/pre-buy-inspection">
          Pre-buy inspections
        </LandingFooterLink>
        <LandingFooterLink href="/services/ndt-inspection">
          NDT inspection
        </LandingFooterLink>
        <LandingFooterLink href="/services/papa-alpha-tools">
          Papa-Alpha story
        </LandingFooterLink>
        <LandingFooterLink href="/services/fiber-laser-fabrication">
          Fiber laser fabrication
        </LandingFooterLink>
        <LandingFooterLink href="/services/rotax-repair">
          Rotax maintenance
        </LandingFooterLink>
        <LandingFooterLink href="/contact">
          Contact
        </LandingFooterLink>
      </LandingFooterColumn>
      <LandingFooterColumn title="Commerce">
        <LandingFooterLink href="/collections">Browse collections</LandingFooterLink>
        <LandingFooterLink href="https://www.rogerwilcoaviation.com/cart">
          View Shopify cart
        </LandingFooterLink>
        <LandingFooterLink href="/contact?reason=quote">
          Request a quote
        </LandingFooterLink>
      </LandingFooterColumn>
    </LandingFooter>
  );
};

export default Footer;
