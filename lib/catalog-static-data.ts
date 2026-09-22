import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Build-only, content-addressed public data. Call only with public Storefront projections. */
export async function writeCatalogStaticData(data: unknown) {
  const json = JSON.stringify(data);
  const digest = createHash('sha256').update(json).digest('hex').slice(0, 24);
  const directory = path.join(process.cwd(), 'public', 'catalog-data');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${digest}.json`), json);
  return `/catalog-data/${digest}.json`;
}
