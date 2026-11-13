/**
 * Import a page from a MediaWiki site (Wikibooks by default) as a text-only
 * module, split into sections at the page's headings.
 *
 * - License is read from the wiki's own `rightsinfo`, not assumed, and must
 *   pass the import policy in licenses.js.
 * - Attribution links to the exact revision imported and to the page history
 *   (the contributor list), which is how Wikimedia content is credited.
 * - `fetch` is injectable so this can be tested offline and run behind a proxy.
 *
 * API docs: https://www.mediawiki.org/wiki/API:Main_page
 *           https://www.mediawiki.org/wiki/Extension:TextExtracts#API
 */

import { slugify, shortHash } from '../shared/module-schema.js';
import { licenseIdFromUrl, LicenseError } from './licenses.js';
import { assembleModule, ImportError } from './markdown.js';

const DEFAULT_UA = 'uplifting-oer-importer/0.1 (open educational content importer)';

async function getJson(fetchImpl, url, userAgent) {
  const res = await fetchImpl(url, { headers: { 'User-Agent': userAgent, Accept: 'application/json' } });
  if (!res.ok) throw new ImportError(`Request failed (${res.status}) for ${url}`);
  return res.json();
}

/** Split a TextExtracts plain-text extract (exsectionformat=wiki) into sections. */
export function extractToItems(extract, pageTitle) {
  const items = [];
  const used = new Set();
  let current = { title: pageTitle, lines: [] };
  const flush = () => {
    const body = current.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (body) {
      let id = slugify(current.title || `section-${shortHash(body)}`, 'section');
      for (let n = 2; used.has(id); n++) id = `${slugify(current.title, 'section')}-${n}`;
      used.add(id);
      items.push({ id, type: 'text', title: current.title, body });
    }
  };
  for (const line of extract.split(/\r?\n/)) {
    const h = /^(={2,6})\s*(.+?)\s*\1\s*$/.exec(line);
    if (h) {
      flush();
      current = { title: h[2], lines: [] };
    } else current.lines.push(line);
  }
  flush();
  return items;
}

/**
 * @param {object} opts
 * @param {string} opts.title  page title, e.g. "Cookbook:Pancake"
 * @param {string} [opts.site]  host, default en.wikibooks.org
 * @param {string} [opts.language]  BCP 47; defaults to the subdomain (e.g. "en")
 * @param {Function} [opts.fetch]
 * @param {string} [opts.userAgent]  Wikimedia asks for a descriptive UA with contact info
 */
export async function importMediaWikiPage({
  title,
  site = 'en.wikibooks.org',
  language,
  id,
  fetch: fetchImpl = globalThis.fetch,
  userAgent = DEFAULT_UA,
  allowNonCommercial = false,
  now = Date.now(),
}) {
  if (!title) throw new ImportError('A page title is required.');
  if (!/^[a-z0-9.-]+$/i.test(site)) throw new ImportError(`Invalid site host: ${site}`);
  const api = `https://${site}/w/api.php`;
  const common = 'format=json&formatversion=2&origin=*';

  const siteinfo = await getJson(fetchImpl, `${api}?action=query&meta=siteinfo&siprop=rightsinfo|general&${common}`, userAgent);
  const rights = siteinfo?.query?.rightsinfo ?? {};
  const licenseId = licenseIdFromUrl(rights.url);
  if (!licenseId) {
    throw new LicenseError(`${site} reports license "${rights.text ?? 'unknown'}" (${rights.url ?? 'no url'}), which is not on the allow-list.`);
  }
  const siteName = siteinfo?.query?.general?.sitename ?? site;

  const pageUrl =
    `${api}?action=query&prop=extracts|info&explaintext=1&exsectionformat=wiki&inprop=url&redirects=1` +
    `&titles=${encodeURIComponent(title)}&${common}`;
  const data = await getJson(fetchImpl, pageUrl, userAgent);
  const page = data?.query?.pages?.[0];
  if (!page || page.missing || page.invalid) throw new ImportError(`Page "${title}" was not found on ${site}.`);
  if (!page.extract || !page.extract.trim()) throw new ImportError(`Page "${page.title}" has no extractable text.`);

  const items = extractToItems(page.extract, page.title);
  const revisionUrl = `https://${site}/w/index.php?title=${encodeURIComponent(page.title.replace(/ /g, '_'))}&oldid=${page.lastrevid}`;
  const meta = {
    id: id || slugify(page.title.replace(/^[^:]+:/, ''), 'module'),
    title: page.title,
    sourceTitle: page.title,
    language: language || site.split('.')[0],
    license: licenseId,
    authors: [`${siteName} contributors`],
    source: revisionUrl,
    history: `${page.fullurl}${page.fullurl.includes('?') ? '&' : '?'}action=history`,
  };
  return assembleModule({ meta, items, allowNonCommercial, retrievedAt: new Date(now).toISOString() });
}
