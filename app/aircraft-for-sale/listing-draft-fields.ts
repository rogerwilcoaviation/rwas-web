export type DraftField = {
  name: string;
  label: string;
  help: string;
  required?: boolean;
  type?: 'number' | 'tel';
  multiline?: boolean;
  maxLength?: number;
};

export const draftFields: DraftField[] = [
  {
    name: 'make',
    label: 'Make',
    required: true,
    help: 'Enter the aircraft manufacturer, such as Cessna or Piper.',
  },
  {
    name: 'model',
    label: 'Model',
    required: true,
    help: 'Enter the exact model and variant, if known.',
  },
  {
    name: 'year',
    label: 'Year',
    required: true,
    type: 'number',
    help: 'Enter the four-digit year of manufacture.',
  },
  {
    name: 'price',
    label: 'Asking price (USD)',
    required: true,
    type: 'number',
    help: 'Enter a positive asking price in US dollars.',
  },
  {
    name: 'description',
    label: 'Description',
    multiline: true,
    maxLength: 10000,
    help: 'Describe what is for sale, its condition and the details buyers should know. You can ask Jerry to proofread your wording.',
  },
  {
    name: 'nNumber',
    label: 'N-number',
    help: 'For a US-registered aircraft, enter its registration, such as N123AB. Otherwise, skip this item.',
  },
  {
    name: 'serialNumber',
    label: 'Serial number',
    help: 'Enter the manufacturer’s serial number, if available.',
  },
  {
    name: 'sellerName',
    label: 'Seller name',
    help: 'Enter the name you want associated with this listing.',
  },
  {
    name: 'sellerPhone',
    label: 'Seller phone',
    type: 'tel',
    help: 'Enter a contact number, including area or country code.',
  },
  {
    name: 'sellerLocation',
    label: 'Location',
    help: 'Enter the city, state or region, and country where the item is located.',
  },
  {
    name: 'totalTime',
    label: 'Airframe total time',
    help: 'Include hours and any relevant details. Leave blank if unknown.',
  },
  {
    name: 'engineModel',
    label: 'Engine model',
    help: 'Enter the installed engine model, if known.',
  },
  {
    name: 'engineTime',
    label: 'Engine time',
    help: 'Include hours and the basis, such as time since overhaul. Do not estimate unknown times.',
  },
  {
    name: 'propModel',
    label: 'Propeller model',
    help: 'Enter the installed propeller model, if known.',
  },
  {
    name: 'propTime',
    label: 'Propeller time',
    help: 'Include hours and the basis, such as time since overhaul.',
  },
  {
    name: 'avionics',
    label: 'Avionics',
    multiline: true,
    maxLength: 10000,
    help: 'List the installed avionics and exact models you can confirm.',
  },
  {
    name: 'equipmentList',
    label: 'Equipment list',
    multiline: true,
    maxLength: 10000,
    help: 'List other included equipment or accessories.',
  },
  {
    name: 'damageHistory',
    label: 'Damage history',
    multiline: true,
    help: 'Describe known damage or repairs. State when history is unknown; do not assume no damage.',
  },
  {
    name: 'annualDue',
    label: 'Annual due',
    help: 'Enter the due date or explain the known inspection status.',
  },
  {
    name: 'usefulLoad',
    label: 'Useful load',
    help: 'Include units and use the applicable aircraft records.',
  },
  {
    name: 'fuelCapacity',
    label: 'Fuel capacity',
    help: 'Include units and specify usable or total capacity.',
  },
  {
    name: 'cruiseSpeed',
    label: 'Cruise speed',
    help: 'Include units and operating conditions, if known.',
  },
  {
    name: 'range',
    label: 'Range',
    help: 'Include units and relevant conditions, if known.',
  },
];

export const mediaSteps = [
  ['photos', 'Photos'],
  ['videos', 'Videos'],
  ['airframe', 'Airframe logbooks'],
  ['powerplant', 'Powerplant logbooks'],
  ['propeller', 'Propeller logbooks'],
  ['adSbCompliance', 'AD / SB compliance'],
  ['misc', 'Other records'],
] as const;

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export function mediaLimits(category: string) {
  return category === 'photos'
    ? 'JPG, JPEG, PNG, GIF or WebP. Maximum 50 MB (52,428,800 bytes) per photo.'
    : category === 'videos'
      ? 'MP4 or WebM. Maximum 50 MB (52,428,800 bytes) per video.'
      : 'PDF only. Maximum 50 MB (52,428,800 bytes) per document.';
}

export function validateDraftField(field: DraftField, value = '') {
  const text = value.trim();
  if (!text)
    return field.required ? `${field.label} is required to continue.` : '';
  if (text.length > (field.maxLength || 300))
    return `${field.label} exceeds the character limit.`;
  if (field.name === 'year') {
    const year = Number(text);
    if (
      !Number.isInteger(year) ||
      year < 1903 ||
      year > new Date().getUTCFullYear() + 1
    )
      return `Enter a year from 1903 to ${new Date().getUTCFullYear() + 1}.`;
  }
  if (
    field.name === 'price' &&
    (!Number.isFinite(Number(text)) ||
      Number(text) <= 0 ||
      Number(text) > 1000000000)
  )
    return 'Enter an asking price greater than $0 and no more than $1,000,000,000.';
  if (field.name === 'nNumber' && !/^N[0-9][A-Z0-9]{0,4}$/i.test(text))
    return 'Enter a valid US N-number, such as N123AB, or leave this optional item blank.';
  return '';
}

export function validateUpload(file: File, category: string) {
  if (!file.size) return `${file.name} is empty. Choose a file with content.`;
  if (file.size > MAX_UPLOAD_BYTES)
    return `${file.name} exceeds the 50 MB per file limit.`;
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const allowed =
    category === 'photos'
      ? ['jpg', 'jpeg', 'png', 'gif', 'webp']
      : category === 'videos'
        ? ['mp4', 'webm']
        : ['pdf'];
  if (!allowed.includes(extension))
    return `${file.name} has an unsupported format. ${mediaLimits(category)}`;
  return '';
}
