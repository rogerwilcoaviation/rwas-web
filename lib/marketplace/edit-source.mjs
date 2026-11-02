export function editSource(listing, draft, recovery) {
  if (!listing) return 'current';
  if ((draft && draft.listingId !== listing.id) ||
      (recovery && recovery.listingId !== listing.id)) return 'different';
  return draft || recovery ? 'choose' : 'current';
}
