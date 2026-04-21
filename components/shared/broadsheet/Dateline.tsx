/*
 * Dateline
 * The thin top strip above the masthead: edition on the left, volume in the
 * middle, website URL on the right. Classic newspaper convention.
 */
type Props = {
  edition?: string;
  volume?: string;
  website?: string;
};

export const Dateline = ({
  edition = 'Spring 2026 Edition',
  volume = 'Vol. XL · No. 1',
  website = 'rogerwilcoaviation.com',
}: Props) => {
  return (
    <div className="bs-dateline">
      <span>{edition}</span>
      <span>{volume}</span>
      <span>{website}</span>
    </div>
  );
};

export default Dateline;
