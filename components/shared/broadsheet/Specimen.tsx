/*
 * Specimen
 * The signature "document-on-chart" content block: bone-fill card with an
 * ink-700 hairline border, lifted off the cream watermark ground. Two
 * variants:
 *   - hero: 4px/4px/0 hard-edged ink-900 offset shadow (letterpress lift)
 *   - flat: no shadow, just the hairline
 *
 * Composable subparts exposed as properties on Specimen so pages can build
 * hero figures like the Garmin D2 PDP without reinventing the layout:
 *
 *   <Specimen variant="hero">
 *     <Specimen.Image src="/foo.jpg" alt="…" />
 *     <Specimen.CaptionRule />
 *     <Specimen.Caption numeral="FIG. 01">hand-lettered caption</Specimen.Caption>
 *   </Specimen>
 */
/* eslint-disable @next/next/no-img-element */
import { ReactNode } from 'react';

type SpecimenProps = {
  children: ReactNode;
  variant?: 'hero' | 'flat';
  className?: string;
  as?: 'div' | 'section' | 'article' | 'aside' | 'figure';
};

type SpecimenImageProps = {
  src: string;
  alt: string;
  className?: string;
};

type SpecimenCaptionProps = {
  children: ReactNode;
  numeral?: ReactNode;
  className?: string;
};

export const Specimen = ({
  children,
  variant = 'flat',
  className,
  as: Tag = 'div',
}: SpecimenProps) => {
  const classes = [
    'specimen',
    variant === 'hero' ? 'specimen--hero' : 'specimen--flat',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');
  return <Tag className={classes}>{children}</Tag>;
};

const SpecimenImage = ({ src, alt, className }: SpecimenImageProps) => (
  <img
    src={src}
    alt={alt}
    className={`specimen__image${className ? ' ' + className : ''}`}
  />
);

const SpecimenCaptionRule = () => <hr className="specimen__caption-rule" />;

const SpecimenCaption = ({ children, numeral, className }: SpecimenCaptionProps) => (
  <div className={`specimen__caption-row${className ? ' ' + className : ''}`}>
    {numeral ? <span className="specimen__figure-numeral">{numeral}</span> : null}
    <p className="specimen__caption">{children}</p>
  </div>
);

Specimen.Image = SpecimenImage;
Specimen.CaptionRule = SpecimenCaptionRule;
Specimen.Caption = SpecimenCaption;

export default Specimen;
