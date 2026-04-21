/* eslint-disable @next/next/no-img-element */
import React from "react";

export type MastheadProps = {
  logoSrc?: string;
  logoAlt?: string;
  brand?: string;
  tagline?: string;
  certMain?: string;
  certLocation?: string;
};

/**
 * Masthead — bone ground, gold top hairline + 6px gold double bottom rule.
 * Matches the approved D2 PDP mockup (.np-masthead).
 *
 * Three-column grid: logo | brand+tagline (centered) | cert identifier (right).
 * The right column carries the cert number and base (KYKN · Yankton, SD);
 * all other credentials (FAA Part 145, Garmin dealer, AEA, NBAA) live in
 * the CredentialsBar directly below.
 */
export default function Masthead({
  logoSrc = "/newspaper/images/logo.png",
  logoAlt = "Roger Wilco Aviation Services",
  brand = "Roger Wilco Aviation Services",
  tagline = "FAA CERT. REPAIR STATION \u00b7 AVIONICS \u00b7 AIRFRAME & POWERPLANT \u00b7 NDT \u00b7 FABRICATION",
  certMain = "Cert. No. RWSR491E",
  certLocation = "KYKN \u00b7 Yankton, SD",
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
          <div className="bs-masthead__cert-main">{certMain}</div>
          <div className="bs-masthead__cert-location">{certLocation}</div>
        </div>
      </div>
    </header>
  );
}
