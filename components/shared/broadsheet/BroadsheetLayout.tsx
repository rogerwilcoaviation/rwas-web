/*
 * BroadsheetLayout
 * Applies the `.broadsheet` scope (cream body, ink text, Source Serif 4,
 * and the enr_h05 chart watermark as a fixed ::before layer) and centers
 * the page content in a max-width column. Every broadsheet-styled page
 * wraps its content in <BroadsheetLayout>. Legacy `.np-wrapper` pages are
 * left alone until they migrate.
 */
import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Narrower column used for article reading pages. Default: false (wide). */
  narrow?: boolean;
  /** Optional className appended to the inner <div className="bs-page"> wrapper. */
  pageClassName?: string;
};

export const BroadsheetLayout = ({ children, narrow = false, pageClassName }: Props) => {
  return (
    <div className="broadsheet">
      <div className={`bs-page${narrow ? ' bs-page--narrow' : ''}${pageClassName ? ' ' + pageClassName : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default BroadsheetLayout;
