/* eslint-disable @next/next/no-img-element */
import React from "react";

export type MastheadProps = {
  logoSrc?: string;
  logoAlt?: string;
  brand?: string;
  tagline?: string;
  certLine1?: string;
  certLine2?: string;
  certLine3?: string;
};

/**
 * Masthead — bone ground, gold top hairline + 6px gold double bottom rule.
 * Matches the approved D2 PDP mockup (.np-masthead).
 */
export default function Masthead({
  logoSrc = "/newspaper/images/logo.png",
  logoAlt = "Roger Wilco Aviation Services",
  brand = "Roger Wilco Aviation Services",
  tagline = "Avionics \u00b7 Aircraft Brokerage \u00b7 Pilot Supplies",
  certLine1 = "FAA Part 145",
  certLine2 = "Repair Station",
  certLine3 = "Cert. RWSR491E",
}: MastheadProps) {
  return (
    <header className="bs-masthead">
      <div className="bs-masthead__inner">
        <img className="bs-masthead__logo" src={logoSrc} alt={logoAlt} />
        <div className="bs-masthead__titles">
          <h1 className="bs-masthead__brand">{brand}</h1>
          {tagline ? <div className="bs-masthead__tagline">{tagline}</div> : null}
        </div>
        <div className="bs-masthead__cert">
          <div>{certLine1}</div>
          <div>{certLine2}</div>
          <div><strong>{certLine3}</strong></div>
        </div>
      </div>
    </header>
  );
}
