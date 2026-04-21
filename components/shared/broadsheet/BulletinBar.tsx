/*
 * BulletinBar
 * The "Bulletin" ticker strip under the nav — left-anchored pill labeled
 * BULLETIN in Inter, followed by a single horizontally-scrolling line of
 * rotating announcements in Source Serif 4. Non-animated by default; add
 * the `marquee` prop to enable scroll animation.
 */
import { ReactNode } from 'react';

type Props = {
  label?: string;
  /** Array of bulletin items. Joined with bullets. */
  items?: ReactNode[];
  /** Enable CSS marquee scroll. Default false (static). */
  marquee?: boolean;
};

const defaultItems: ReactNode[] = [
  'Papa-Alpha rigging reference tools now shipping worldwide',
  'Garmin G3X Touch installations booking into summer 2026',
  'Annual inspection slots available — call (605) 299-8178',
];

export const BulletinBar = ({
  label = 'Bulletin',
  items = defaultItems,
  marquee = false,
}: Props) => {
  return (
    <div className="bs-bulletin">
      <span className="bs-bulletin__label">{label}</span>
      <span className={`bs-bulletin__text${marquee ? ' bs-bulletin__text--marquee' : ''}`}>
        {items.map((item, i) => (
          <span key={i} className="bs-bulletin__item">
            {item}
            {i < items.length - 1 ? <span className="bs-bulletin__sep"> • </span> : null}
          </span>
        ))}
      </span>
    </div>
  );
};

export default BulletinBar;
