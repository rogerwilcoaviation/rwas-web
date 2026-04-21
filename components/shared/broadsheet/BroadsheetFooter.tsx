/*
 * BroadsheetFooter
 * Ink-900 surface with 6px gold-700 double-rule top border (the colophon
 * signature). Brand name on the left, copyright on the right. Use this
 * instead of the site's LandingFooter on broadsheet-styled pages.
 */
import { ReactNode } from 'react';

type Props = {
  brand?: string;
  copyright?: ReactNode;
};

export const BroadsheetFooter = ({
  brand = 'Roger Wilco Aviation Services',
  copyright = <>© {new Date().getFullYear()} RWAS · All Rights Reserved</>,
}: Props) => {
  return (
    <div className="bs-footer">
      <span className="bs-footer__brand">{brand}</span>
      <span className="bs-footer__copy">{copyright}</span>
    </div>
  );
};

export default BroadsheetFooter;
