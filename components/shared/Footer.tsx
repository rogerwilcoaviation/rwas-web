import { LandingFooter, LandingFooterColumn, LandingFooterLink } from '@/components/landing';

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
      <LandingFooterColumn title="Services">
        <LandingFooterLink href="#services">Avionics</LandingFooterLink>
        <LandingFooterLink href="#services">NDT</LandingFooterLink>
        <LandingFooterLink href="#services">Fabrication</LandingFooterLink>
      </LandingFooterColumn>
      <LandingFooterColumn title="Commerce">
        <LandingFooterLink href="https://rogerwilcoaviation.com/collections/all">
          Shop all products
        </LandingFooterLink>
        <LandingFooterLink href="https://rogerwilcoaviation.com/collections/garmin-avionics">
          Garmin certified
        </LandingFooterLink>
        <LandingFooterLink href="https://rogerwilcoaviation.com/collections/rigging-tools">
          Papa-Alpha tools
        </LandingFooterLink>
      </LandingFooterColumn>
      <LandingFooterColumn title="Company">
        <LandingFooterLink href="https://rogerwilcoaviation.com/pages/about">
          About
        </LandingFooterLink>
        <LandingFooterLink href="https://rogerwilcoaviation.com/pages/shop-capabilities">
          Shop capabilities
        </LandingFooterLink>
        <LandingFooterLink href="https://rogerwilcoaviation.com/pages/contact">
          Contact
        </LandingFooterLink>
      </LandingFooterColumn>
      <LandingFooterColumn title="Next phase">
        <LandingFooterLink href="#featured-products">Storefront integration</LandingFooterLink>
        <LandingFooterLink href="#why-rwas">Homepage build</LandingFooterLink>
        <LandingFooterLink href="#contact">Lead capture</LandingFooterLink>
      </LandingFooterColumn>
    </LandingFooter>
  );
};

export default Footer;
