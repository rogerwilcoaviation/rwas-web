// Offline candidate planning only. Preserve the supplied seller manifest and
// append new resources; never replace the existing SellerStore migration.
export function planJerrySellerConfig(source, { transportService }) {
  if (
    typeof source !== 'string' ||
    !source.includes('class_name = "SellerStore"') ||
    !source.includes('new_sqlite_classes = ["SellerStore"]') ||
    !source.includes('keep_vars = true')
  )
    throw Error(
      'The existing seller baseline must be reviewed before planning new bindings.',
    );
  if (!/^[a-z][a-z0-9-]{2,62}$/.test(transportService || ''))
    throw Error('Specify a reviewed website transport service name.');
  if (
    /JERRY_CONVERSATIONS|JERRY_RESPONSE|JERRY_WEBSITE_TRANSPORT|jerry-conversations-v1/.test(
      source,
    )
  )
    throw Error(
      'Jerry resources already appear in this manifest; review them instead of adding duplicate migrations.',
    );
  if (!source.includes('[vars]\n'))
    throw Error('Seller variables are missing.');
  return (
    source.replace(
      '[vars]\n',
      '[vars]\nJERRY_CONVERSATIONS_ENABLED = "false"\n',
    ) +
    '\n# Offline candidate: requires separate release approval and active-settings comparison.\n[[durable_objects.bindings]]\nname = "JERRY_CONVERSATIONS"\nclass_name = "JerryConversations"\n\n[[migrations]]\ntag = "jerry-conversations-v1"\nnew_sqlite_classes = ["JerryConversations"]\n\n[[services]]\nbinding = "JERRY_WEBSITE_TRANSPORT"\nservice = ' +
    JSON.stringify(transportService) +
    '\n'
  );
}
