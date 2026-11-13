import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { importMarkdown } from './markdown.js';
import { importDelimited } from './csv.js';

export { importMarkdown, parseItems, parseFrontMatter, assembleModule, ImportError } from './markdown.js';
export { importDelimited, parseDelimited } from './csv.js';
export { importMediaWikiPage, extractToItems } from './mediawiki.js';
export { checkLicense, licenseIdFromUrl, LICENSES, LicenseError } from './licenses.js';

/**
 * Import a local file, choosing the importer by extension.
 * @param {string} path  .md, .markdown, .csv, or .tsv
 * @param {object} [opts]  { meta, allowNonCommercial }; meta overrides/supplies metadata
 */
export async function importFile(path, { meta = {}, allowNonCommercial = false } = {}) {
  const text = await readFile(path, 'utf8');
  const ext = extname(path).toLowerCase();
  switch (ext) {
    case '.md':
    case '.markdown':
      return importMarkdown(text, { overrides: meta, allowNonCommercial });
    case '.csv':
      return importDelimited(text, { meta, delimiter: ',', allowNonCommercial });
    case '.tsv':
      return importDelimited(text, { meta, delimiter: '\t', allowNonCommercial });
    default:
      throw new Error(`Unsupported file type "${ext}". Use .md, .csv, or .tsv.`);
  }
}
