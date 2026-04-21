/*
 * EditionBar
 * Dark ink bar directly under the masthead carrying three rotating "edition
 * notes" (seasonal pricing, booking window, availability). Uses Caveat script
 * for the notes themselves to feel hand-chalked.
 */
import { ReactNode } from 'react';

type Props = {
  items?: ReactNode[];
};

const defaultItems = [
  'Garmin Spring 2026 pricing now active',
  'GFC 500 autopilot installations available',
  'Now accepting spring scheduling',
];

export const EditionBar = ({ items = defaultItems }: Props) => {
  return (
    <div className="bs-edition-bar">
      {items.map((item, i) => (
        <span key={i}>{item}</span>
      ))}
    </div>
  );
};

export default EditionBar;
