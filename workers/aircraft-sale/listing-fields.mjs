import {
  marketplaceFields,
  currencyOptions,
  listingTypes,
  categoryFor,
  categoryFields,
  cleanSpecifications,
} from '../../lib/marketplace/schema.mjs';
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
  ...marketplaceFields,
];
export function cleanListing(body, complete = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    fail(400, 'Invalid listing.');
  for (const key of Object.keys(body))
    if (!listingFields.includes(key))
      fail(400, 'Unsupported listing field: ' + key);
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === 'specifications') continue;
    if (typeof v !== 'string' && typeof v !== 'number')
      fail(400, 'Invalid ' + k);
    if (
      String(v).length >
      (['description', 'avionics', 'equipmentList'].includes(k) ? 10000 : 300)
    )
      fail(400, k + ' is too long.');
    out[k] = String(v).trim();
  }
  if (out.workflowVersion && out.workflowVersion !== '3')
    fail(400, 'Unsupported listing workflow.');
  if (complete && out.workflowVersion === '3' && !out.listingType)
    fail(400, 'Choose a listing type.');
  if (out.listingType) {
    if (!listingTypes.some(([id]) => id === out.listingType))
      fail(400, 'Choose a valid listing type.');
    if (out.category && !categoryFor(out))
      fail(400, 'Choose a category for this listing type.');
    if (body.specifications !== undefined)
      out.specifications = cleanSpecifications(body.specifications, out);
    const choices = {
      currency: currencyOptions,
      transactionType:
        out.listingType === 'aircraft'
          ? ['sale', 'lease', 'fractional']
          : ['sale', 'lease'],
      priceMode: ['amount', 'on-request'],
      condition:
        out.listingType === 'parts'
          ? [
              'As Removed',
              'Core',
              'Factory Rebuilt',
              'New',
              'New Surplus',
              'On Request',
              'Overhauled',
              'Repaired',
              'Serviceable',
            ]
          : ['New', 'Used', 'Refurbished', 'Salvaged', 'Unknown'],
      hangarType: [
        'T-hangar',
        'Box / rectangular',
        'Community / shared',
        'Portable',
        'Other',
      ],
    };
    for (const [key, allowed] of Object.entries(choices))
      if (out[key] && !allowed.includes(out[key]))
        fail(400, 'Invalid ' + key + '.');
    if (
      out.quantity &&
      (!Number.isFinite(Number(out.quantity)) || Number(out.quantity) <= 0)
    )
      fail(400, 'Enter a positive quantity.');
    if (out.priceMode === 'on-request') out.price = '';
    if (complete) {
      for (const field of categoryFields(out))
        if (field.required && !out.specifications?.[field.name.slice(5)])
          fail(400, 'Choose the unit for ' + field.label + '.');
      const required = [
        'category',
        'sellerLocation',
        'description',
        'currency',
        'transactionType',
        'priceMode',
      ];
      if (out.listingType === 'aircraft')
        required.push('make', 'model', 'year');
      else required.push('title');
      if (out.listingType !== 'hangars') required.push('condition');
      if (['parts', 'tools'].includes(out.listingType))
        required.push('quantity', 'unitOfSale', 'condition');
      if (out.listingType === 'parts') required.push('make', 'partNumber');
      if (out.listingType === 'hangars') required.push('airport', 'hangarType');
      if (out.priceMode === 'amount') required.push('price');
      for (const key of required)
        if (!out[key]) fail(400, key + ' is required before submitting.');
      if (
        out.transactionType === 'fractional' &&
        !out.specifications?.['ownership-fraction']
      )
        fail(400, 'Ownership fraction is required.');
    }
  } else if (body.specifications && Object.keys(body.specifications).length)
    fail(400, 'Choose a listing type before adding specifications.');
  if (out.year !== undefined && out.year !== '') {
    const y = Number(out.year);
    if (
      !Number.isInteger(y) ||
      y < (out.listingType && out.listingType !== 'aircraft' ? 1800 : 1903) ||
      y > new Date().getUTCFullYear() + 1
    )
      fail(400, 'Enter a valid aircraft year.');
    out.year = y;
  }
  if (out.price !== undefined && out.price !== '') {
    const p = Number(out.price);
    if (!Number.isFinite(p) || p <= 0 || p > 1000000000)
      fail(400, 'Enter a positive asking price.');
    out.price = p;
  }
  if (out.nNumber && !/^N[0-9][A-Z0-9]{0,4}$/.test(out.nNumber.toUpperCase()))
    fail(400, 'Enter a valid US N-number.');
  if (out.nNumber) out.nNumber = out.nNumber.toUpperCase();
  if (
    complete &&
    !out.listingType &&
    (!out.make || !out.model || !out.year || !out.price)
  )
    fail(400, 'Make, model, year and asking price are required.');
  return out;
}
