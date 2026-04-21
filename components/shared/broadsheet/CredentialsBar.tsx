import React from "react";

export type CredentialsBarProps = {
  certText?: string;
  dealerLabel?: string;
  dealerBrand?: string;
  dealerTrail?: string;
  membership1?: string;
  membership2?: string;
};

/**
 * CredentialsBar — bone ground row beneath the primary nav, carries
 * FAA cert, Garmin authorized dealer plate, and memberships.
 * Matches the approved D2 PDP mockup (.np-credentials-bar).
 *
 * The dealer plate uses a text wordmark ("GARMIN") because our public
 * asset folder doesn't carry a licensed Garmin logo bitmap. Text is
 * ink-900, Inter, 0.22em tracking — consistent with the mockup's plate.
 *
 * Location (KYKN · Yankton, SD) lives in the Masthead's right column,
 * not here.
 */
export default function CredentialsBar({
  certText = "FAA Part 145 Repair Station \u00b7 Cert. RWSR491E",
  dealerLabel = "Authorized",
  dealerBrand = "Garmin",
  dealerTrail = "Dealer",
  membership1 = "AEA Member",
  membership2 = "NBAA Member",
}: CredentialsBarProps) {
  return (
    <div className="bs-credentials">
      <div className="bs-credentials__inner">
        <span>{certText}</span>
        <span className="bs-credentials__pip" aria-hidden="true"></span>
        <span className="bs-dealer-plate">
          <span className="bs-dealer-plate__label">{dealerLabel}</span>
          <span
            className="bs-dealer-plate__label"
            style={{ fontWeight: 700, color: "var(--ink-900)", letterSpacing: "0.22em" }}
          >
            {dealerBrand}
          </span>
          <span className="bs-dealer-plate__label">{dealerTrail}</span>
        </span>
        <span className="bs-credentials__pip" aria-hidden="true"></span>
        <span>{membership1}</span>
        <span className="bs-credentials__pip" aria-hidden="true"></span>
        <span>{membership2}</span>
      </div>
    </div>
  );
}
