// Shared destination validation for API writes and offline migration planning.
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export const listingFields = [
  'sellerName',
  'sellerPhone',
  'sellerLocation',
  'make',
  'model',
  'year',
  'serialNumber',
  'nNumber',
  'totalTime',
  'engineTime',
  'engineModel',
  'propTime',
  'propModel',
  'price',
  'priceLabel',
  'description',
  'avionics',
  'equipmentList',
  'annualDue',
  'usefulLoad',
  'fuelCapacity',
  'cruiseSpeed',
  'range',
  'category',
  'condition',
  'damageHistory',
];
export function cleanListing(body, complete = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    fail(400, 'Invalid listing.');
  for (const key of Object.keys(body))
    if (!listingFields.includes(key))
      fail(400, 'Unsupported listing field: ' + key);
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v !== 'string' && typeof v !== 'number')
      fail(400, 'Invalid ' + k);
    if (
      String(v).length >
      (['description', 'avionics', 'equipmentList'].includes(k) ? 10000 : 300)
    )
      fail(400, k + ' is too long.');
    out[k] = String(v).trim();
  }
  if (out.year !== undefined) {
    const y = Number(out.year);
    if (!Number.isInteger(y) || y < 1903 || y > new Date().getUTCFullYear() + 1)
      fail(400, 'Enter a valid aircraft year.');
    out.year = y;
  }
  if (out.price !== undefined) {
    const p = Number(out.price);
    if (!Number.isFinite(p) || p <= 0 || p > 1000000000)
      fail(400, 'Enter a positive asking price.');
    out.price = p;
  }
  if (out.nNumber && !/^N[0-9][A-Z0-9]{0,4}$/.test(out.nNumber.toUpperCase()))
    fail(400, 'Enter a valid US N-number.');
  if (out.nNumber) out.nNumber = out.nNumber.toUpperCase();
  if (complete && (!out.make || !out.model || !out.year || !out.price))
    fail(400, 'Make, model, year and asking price are required.');
  return out;
}
