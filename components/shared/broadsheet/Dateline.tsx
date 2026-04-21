import React from "react";

export type DatelineProps = {
  edition?: string;
  volume?: string;
  domain?: string;
  kicker?: string;
  phone?: string;
  phoneHref?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

/**
 * Dateline — thin ink strip above the masthead.
 * Matches the approved D2 PDP mockup (.np-edition-bar).
 */
export default function Dateline({
  edition = "Spring 2026 Edition",
  volume = "Vol. XL \u00b7 No. 1",
  domain = "rogerwilcoaviation.com",
  kicker = "wheels-up since 2022",
  phone = "(605) 299-8178",
  phoneHref = "tel:+16052998178",
  ctaLabel = "Book Service",
  ctaHref = "/contact",
}: DatelineProps) {
  return (
    <div className="bs-dateline">
      <div className="bs-dateline__inner">
        <div className="bs-dateline__left">
          <span>{edition}</span>
          <span>{volume}</span>
          <span>{domain}</span>
          {kicker ? <span className="bs-dateline__kicker">{kicker}</span> : null}
        </div>
        <div className="bs-dateline__right">
          {phone ? (
            <a className="bs-dateline__phone" href={phoneHref}>
              {phone}
            </a>
          ) : null}
          {ctaLabel ? (
            <a className="bs-dateline__cta" href={ctaHref}>
              {ctaLabel}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
