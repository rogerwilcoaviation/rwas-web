/*
 * CredentialsBar
 * Gold-on-cream credentials strip above the footer. Uses gold-700 pip
 * separators between items. Light-weight, non-interactive.
 */
import { ReactNode } from 'react';

type Props = {
  items?: ReactNode[];
};

const defaultItems: ReactNode[] = [
  'NBAA Member',
  'AEA Member',
  'Certified & Trained',
];

export const CredentialsBar = ({ items = defaultItems }: Props) => {
  return (
    <div className="bs-credentials">
      {items.map((item, i) => (
        <span key={i} className="bs-credentials__item">
          {item}
          {i < items.length - 1 ? <span className="bs-credentials__pip" aria-hidden>•</span> : null}
        </span>
      ))}
    </div>
  );
};

export default CredentialsBar;
