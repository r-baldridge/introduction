/**
 * License policy for imported content.
 *
 * Importing splits source material into sections, flashcards, and quizzes,
 * which is an *adaptation* under Creative Commons terms. So:
 *   - NoDerivatives (ND) licenses are always refused.
 *   - NonCommercial (NC) licenses are refused unless explicitly allowed,
 *     because modules may be shared by co-ops or groups that charge fees.
 *   - Unknown licenses are refused. Add them here deliberately, not by default.
 *   - ShareAlike (SA) content keeps its license on the resulting module.
 */

const CC = 'https://creativecommons.org';

export const LICENSES = Object.freeze({
  'CC0-1.0': { url: `${CC}/publicdomain/zero/1.0/`, attribution: false, shareAlike: false, nc: false, nd: false },
  'CC-BY-3.0': { url: `${CC}/licenses/by/3.0/`, attribution: true, shareAlike: false, nc: false, nd: false },
  'CC-BY-4.0': { url: `${CC}/licenses/by/4.0/`, attribution: true, shareAlike: false, nc: false, nd: false },
  'CC-BY-SA-3.0': { url: `${CC}/licenses/by-sa/3.0/`, attribution: true, shareAlike: true, nc: false, nd: false },
  'CC-BY-SA-4.0': { url: `${CC}/licenses/by-sa/4.0/`, attribution: true, shareAlike: true, nc: false, nd: false },
  'CC-BY-NC-4.0': { url: `${CC}/licenses/by-nc/4.0/`, attribution: true, shareAlike: false, nc: true, nd: false },
  'CC-BY-NC-SA-4.0': { url: `${CC}/licenses/by-nc-sa/4.0/`, attribution: true, shareAlike: true, nc: true, nd: false },
  'CC-BY-ND-4.0': { url: `${CC}/licenses/by-nd/4.0/`, attribution: true, shareAlike: false, nc: false, nd: true },
  'CC-BY-NC-ND-4.0': { url: `${CC}/licenses/by-nc-nd/4.0/`, attribution: true, shareAlike: false, nc: true, nd: true },
});

export class LicenseError extends Error {}

/**
 * Check a license against the import policy.
 * @returns {{id:string, url:string, warnings:string[]}}
 * @throws {LicenseError}
 */
export function checkLicense(id, { allowNonCommercial = false } = {}) {
  const info = LICENSES[id];
  if (!info) {
    throw new LicenseError(
      `License "${id}" is not on the import allow-list. Known: ${Object.keys(LICENSES).join(', ')}.`,
    );
  }
  if (info.nd) {
    throw new LicenseError(`${id} forbids derivative works; splitting it into learning items would be an adaptation.`);
  }
  if (info.nc && !allowNonCommercial) {
    throw new LicenseError(`${id} is NonCommercial. Pass allowNonCommercial (--allow-nc) if every use will be non-commercial.`);
  }
  const warnings = [];
  if (info.nc) warnings.push(`${id} is NonCommercial: do not use this module in any paid offering.`);
  if (info.shareAlike) warnings.push(`${id} is ShareAlike: the module keeps this license and so must any adaptation of it.`);
  return { id, url: info.url, warnings };
}

/** Map a license URL (e.g. from a wiki's rightsinfo) to an SPDX id, or null. */
export function licenseIdFromUrl(url) {
  if (!url) return null;
  const norm = String(url).replace(/^http:/, 'https:').replace(/\/?(legalcode|deed\.[a-z-]+)?$/i, '/');
  for (const [id, info] of Object.entries(LICENSES)) {
    if (norm === info.url) return id;
  }
  return null;
}

export const MODIFICATION_NOTE = 'Adapted into micro-learning sections, flashcards, and quizzes.';
