import React from "react";

export type BulletinBarProps = {
  kicker?: string;
  items?: string[];
};

const DEFAULT_ITEMS: string[] = [
  "Now booking May Garmin install slots \u2014 schedule early",
  "GFC 500 installs: Bonanza, Mooney, Cessna \u2014 same-day quote",
  "Papa-Alpha tools ship same day from Yankton",
  "Avionics desk: (605) 299-8178 \u00b7 avionics@rwas.team",
];

/**
 * BulletinBar — ink-900 strip with outlined cream "Bulletin" pill and
 * gold-tone pip separators. Matches the approved D2 PDP mockup (.np-bulletin-bar).
 */
export default function BulletinBar({
  kicker = "Bulletin",
  items = DEFAULT_ITEMS,
}: BulletinBarProps) {
  return (
    <aside className="bs-bulletin" role="complementary" aria-label="Shop bulletin">
      <div className="bs-bulletin__inner">
        <span className="bs-bulletin__kicker">{kicker}</span>
        {items.map((item, idx) => (
          <React.Fragment key={idx}>
            <span className="bs-bulletin__item">{item}</span>
            {idx < items.length - 1 ? (
              <span className="bs-bulletin__pip" aria-hidden="true">
                {"\u25A0"}
              </span>
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </aside>
  );
}
