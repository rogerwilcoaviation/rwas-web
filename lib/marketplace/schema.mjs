import catalog from './catalog.mjs';

export const currencyOptions = [
  'AED',
  'ARS',
  'AUD',
  'BDT',
  'BGN',
  'BOB',
  'BRL',
  'BWP',
  'BZD',
  'CAD',
  'CHF',
  'CLP',
  'CNY',
  'COP',
  'CRC',
  'CZK',
  'DKK',
  'EGP',
  'EUR',
  'GBP',
  'GHS',
  'GTQ',
  'HKD',
  'HNL',
  'HUF',
  'IDR',
  'ILS',
  'INR',
  'JOD',
  'JPY',
  'KRW',
  'LBP',
  'LKR',
  'MAD',
  'MXN',
  'MYR',
  'NAD',
  'NIO',
  'NOK',
  'NZD',
  'PAB',
  'PEN',
  'PHP',
  'PKR',
  'PLN',
  'PYG',
  'QAR',
  'RON',
  'RSD',
  'RUB',
  'SAR',
  'SEK',
  'SGD',
  'THB',
  'TND',
  'TRY',
  'TWD',
  'TZS',
  'UAH',
  'USD',
  'UYU',
  'VES',
  'VND',
  'XAF',
  'ZAR',
  'ZMW',
];
export const listingTypes = [
  ['aircraft', 'Aircraft'],
  ['parts', 'Parts & Components'],
  ['tools', 'Tools & Ground Support'],
  ['hangars', 'Hangars'],
  ['other', 'Other Aviation'],
];
export const listingCategories = catalog.categories;
export const specificationFields = catalog.fields;
export const marketplaceFields = [
  'workflowVersion',
  'listingType',
  'title',
  'partNumber',
  'quantity',
  'unitOfSale',
  'hangarType',
  'airport',
  'transactionType',
  'currency',
  'priceMode',
  'specifications',
];
const choices = (name, label, options, help, required = true) => ({
  name,
  label,
  options,
  help,
  required,
});
const text = (name, label, help, required = false) => ({
  name,
  label,
  help,
  required,
});
export function categoryFor(values) {
  return listingCategories.find(
    (c) => c.id === values.category && c.type === values.listingType,
  );
}
export function categoryOptions(type) {
  return listingCategories
    .filter((c) => c.type === type)
    .map((c) => ({ value: c.id, label: c.label }));
}
export function categoryFields(values) {
  return (categoryFor(values)?.fields || []).map((key) => {
    const field = specificationFields[key];
    const numberKey = key.endsWith('-unit') ? key.slice(0, -5) : '';
    return {
      ...field,
      required: !!(
        numberKey &&
        (values['spec:' + numberKey] || values.specifications?.[numberKey])
      ),
    };
  });
}
export function listingTitle(values) {
  return (
    values.title ||
    [values.year, values.make, values.model].filter(Boolean).join(' ') ||
    'Listing draft'
  );
}
export function listingPrice(values) {
  if (values.priceMode === 'on-request' || !Number(values.price))
    return 'Price on request';
  const currency = /^[A-Z]{3}$/.test(values.currency || '')
    ? values.currency
    : 'USD';
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(Number(values.price));
  return (
    formatted +
    (values.transactionType === 'lease'
      ? ' / month'
      : values.transactionType === 'fractional'
        ? ' (ownership share)'
        : '')
  );
}
export function newListingFields(values, legacyFields) {
  const type = values.listingType;
  const selectType = choices(
    'listingType',
    'What would you like to list?',
    listingTypes.map(([value, label]) => ({ value, label })),
    'Choose the type of item or property. Your questions will match this choice.',
  );
  if (!type) return [selectType];
  const fields = [
    selectType,
    choices(
      'category',
      'Listing category',
      categoryOptions(type),
      'Choose the closest category for buyers to find your listing.',
    ),
  ];
  if (!categoryFor(values)) return fields;
  if (type === 'aircraft')
    fields.push(
      ...legacyFields.filter((f) => ['make', 'model', 'year'].includes(f.name)),
    );
  else {
    fields.push(
      text(
        'title',
        'Listing title',
        'Give the item or property a clear, descriptive name.',
        true,
      ),
    );
    if (type !== 'hangars')
      fields.push(
        text(
          'make',
          'Manufacturer',
          'Enter the manufacturer or state Unknown.',
          type === 'parts',
        ),
        text('model', 'Model', 'Enter the exact model if known.'),
      );
    if (type !== 'hangars')
      fields.push({
        ...text('year', 'Year', 'Optional year of manufacture, if known.'),
        type: 'number',
      });
    if (type === 'parts')
      fields.push(
        text(
          'partNumber',
          'Part number',
          'Enter the part number or state Not applicable.',
          true,
        ),
      );
    if (['parts', 'tools'].includes(type))
      fields.push(
        {
          ...text(
            'quantity',
            'Quantity',
            'Enter the available quantity.',
            true,
          ),
          type: 'number',
        },
        text(
          'unitOfSale',
          'Unit of sale',
          'For example: each, pair, kit or lot.',
          true,
        ),
      );
    if (type === 'hangars')
      fields.push(
        choices(
          'hangarType',
          'Hangar type',
          [
            'T-hangar',
            'Box / rectangular',
            'Community / shared',
            'Portable',
            'Other',
          ],
          'Choose the property type.',
        ),
        text(
          'airport',
          'Airport name or identifier',
          'Enter the airport name and its identifier, if known.',
          true,
        ),
      );
  }
  fields.push(
    choices(
      'condition',
      'Condition',
      type === 'parts'
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
      'Choose the seller-reported condition. This does not constitute verification.',
      type !== 'hangars',
    ),
  );
  fields.push(
    choices(
      'transactionType',
      'Sale or lease',
      type === 'hangars'
        ? [
            { value: 'sale', label: 'For sale' },
            { value: 'lease', label: 'For lease' },
          ]
        : type === 'aircraft'
          ? [
              { value: 'sale', label: 'For sale' },
              { value: 'lease', label: 'For lease' },
              { value: 'fractional', label: 'Fractional ownership' },
            ]
          : [
              { value: 'sale', label: 'For sale' },
              { value: 'lease', label: 'For lease' },
            ],
      'Select the transaction you are offering.',
    ),
  );
  fields.push(
    choices(
      'currency',
      'Currency',
      currencyOptions,
      'Select the currency for your price.',
    ),
    choices(
      'priceMode',
      'Price display',
      [
        { value: 'amount', label: 'Show a price' },
        { value: 'on-request', label: 'Price on request' },
      ],
      'Choose whether to show an amount or invite buyers to request a price.',
    ),
  );
  if (values.priceMode === 'amount')
    fields.push({
      ...text(
        'price',
        values.transactionType === 'lease'
          ? 'Monthly lease price'
          : 'Asking price',
        'Enter a positive amount in the selected currency.',
        true,
      ),
      type: 'number',
    });
  if (values.transactionType === 'fractional')
    fields.push(
      choices(
        'spec:ownership-fraction',
        'Ownership fraction',
        ['3/4', '2/3', ...Array.from({ length: 19 }, (_, i) => '1/' + (i + 2))],
        'Select the ownership share offered.',
      ),
    );
  fields.push(
    ...legacyFields
      .filter((f) =>
        ['sellerName', 'sellerPhone', 'sellerLocation', 'description'].includes(
          f.name,
        ),
      )
      .map((f) => ({
        ...f,
        required: ['sellerLocation', 'description'].includes(f.name),
      })),
  );
  if (type === 'aircraft')
    fields.push(
      ...legacyFields.filter(
        (f) =>
          ![
            'make',
            'model',
            'year',
            'price',
            'description',
            'sellerName',
            'sellerPhone',
            'sellerLocation',
          ].includes(f.name),
      ),
    );
  if (['parts', 'tools', 'other'].includes(type))
    fields.push(
      text(
        'serialNumber',
        'Serial number',
        'Enter the serial number if one exists.',
      ),
    );
  fields.push(...categoryFields(values));
  return fields;
}

// The form keeps individual controls as strings; the service stores a bounded,
// category-validated specification object. Reopening a draft reverses this map.
export function listingFormValues(listing, legacyFields) {
  const values = Object.fromEntries(
    [
      ...legacyFields.map((f) => f.name),
      ...marketplaceFields.filter((k) => k !== 'specifications'),
      'category',
      'condition',
    ].map((key) => [key, String(listing?.[key] ?? '')]),
  );
  const legacy =
    !!listing &&
    !listing.listingType &&
    !listing.workflowVersion &&
    !!(
      listing.id ||
      listing.make ||
      listing.model ||
      listing.year ||
      listing.price
    );
  if (legacy) values.__legacyAircraft = 'true';
  else values.workflowVersion = '3';
  for (const [key, value] of Object.entries(listing?.specifications || {}))
    values['spec:' + key] = String(value);
  return values;
}
export function listingPayload(values) {
  const result = {},
    specs = {};
  for (const [key, value] of Object.entries(values)) {
    if (key.startsWith('spec:')) specs[key.slice(5)] = value;
    else result[key] = value;
  }
  if (values.listingType) result.specifications = specs;
  return result;
}
export function cleanSpecifications(value, listing) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length > 250
  )
    throw Object.assign(Error('Invalid listing specifications.'), {
      status: 400,
    });
  const allowed = new Map(
    categoryFields(listing).map((f) => [f.name.slice(5), f]),
  );
  if (listing.listingType === 'aircraft')
    allowed.set('ownership-fraction', {
      maxLength: 10,
      options: [
        '3/4',
        '2/3',
        ...Array.from({ length: 19 }, (_, i) => '1/' + (i + 2)),
      ],
    });
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    const field = allowed.get(key);
    if (!field || !['string', 'number'].includes(typeof raw))
      throw Object.assign(Error('Unsupported listing specification: ' + key), {
        status: 400,
      });
    const text = String(raw).trim();
    if (text.length > (field.maxLength || 300))
      throw Object.assign(Error('Specification is too long: ' + key), {
        status: 400,
      });
    const opts = field.options?.map((v) =>
      typeof v === 'string' ? v : v.value,
    );
    if (text && opts && !opts.includes(text))
      throw Object.assign(Error('Invalid specification choice: ' + key), {
        status: 400,
      });
    if (
      text &&
      field.type === 'number' &&
      (!Number.isFinite(Number(text)) || Number(text) < 0)
    )
      throw Object.assign(Error('Enter a non-negative specification: ' + key), {
        status: 400,
      });
    out[key] = text;
  }
  if (JSON.stringify(out).length > 60000)
    throw Object.assign(
      Error('Listing specifications exceed the size limit.'),
      { status: 400 },
    );
  return out;
}
