/*
 * Masthead
 * Roundel logo on the left, brand name + hairline + tagline centered,
 * certification + home airport meta on the right. Anchored with the
 * 6px gold-700 double rule at the bottom (the "broadsheet signature").
 */
/* eslint-disable @next/next/no-img-element */
type Props = {
  logoSrc?: string;
  logoAlt?: string;
  brand?: string;
  tagline?: string;
  meta?: { certNo?: string; airport?: string; city?: string };
};

export const Masthead = ({
  logoSrc = '/newspaper/images/logo.png',
  logoAlt = 'Roger Wilco Aviation Services',
  brand = 'Roger Wilco Aviation Services',
  tagline = 'FAA Cert. Repair Station · Avionics · Airframe & Powerplant · NDT · Fabrication',
  meta = { certNo: 'RWSR491E', airport: 'KYKN', city: 'Yankton, SD' },
}: Props) => {
  return (
    <div className="bs-masthead">
      <img className="bs-masthead__logo" src={logoSrc} alt={logoAlt} />
      <div className="bs-masthead__center">
        <div className="bs-masthead__brand">{brand}</div>
        <hr className="bs-masthead__rule" />
        <div className="bs-masthead__tagline">{tagline}</div>
      </div>
      <div className="bs-masthead__meta">
        {meta.certNo ? <>Cert. No. {meta.certNo}<br /></> : null}
        {meta.airport ? <>{meta.airport}{meta.city ? ` · ${meta.city}` : null}</> : null}
      </div>
    </div>
  );
};

export default Masthead;
