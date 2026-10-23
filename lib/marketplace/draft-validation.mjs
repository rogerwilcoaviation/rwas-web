export function validateDraftField(field, value = '') {
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
    field.options &&
    !field.options.some(
      (option) => (typeof option === 'string' ? option : option.value) === text,
    )
  )
    return 'Choose one of the listed options.';
  if (
    field.type === 'number' &&
    field.name !== 'year' &&
    (!Number.isFinite(Number(text)) ||
      Number(text) < 0 ||
      (field.name === 'quantity' && Number(text) <= 0))
  )
    return (
      'Enter a valid ' +
      (field.name === 'quantity' ? 'positive' : 'non-negative') +
      ' number.'
    );
  if (
    field.name === 'price' &&
    (!Number.isFinite(Number(text)) ||
      Number(text) <= 0 ||
      Number(text) > 1000000000)
  )
    return 'Enter an asking price greater than $0 and no more than $1,000,000,000.';
  if (field.name === 'nNumber' && !/^N[0-9][A-Z0-9]{0,4}$/i.test(text))
    return 'Enter a valid US N-number, such as N123AB.';
  return '';
}
