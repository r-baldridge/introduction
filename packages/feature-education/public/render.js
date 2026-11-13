/**
 * DOM helpers. Module content is untrusted (it may come from any importer),
 * so it is only ever inserted as text nodes — never via innerHTML.
 */

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Render plain-text body: blank lines split paragraphs; "- " lines form lists. */
export function renderBody(text) {
  const frag = document.createDocumentFragment();
  for (const block of String(text).split(/\n\s*\n/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.every((l) => /^[-*•]\s+/.test(l))) {
      frag.append(h('ul', {}, lines.map((l) => h('li', {}, l.replace(/^[-*•]\s+/, '')))));
    } else if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
      frag.append(h('ol', {}, lines.map((l) => h('li', {}, l.replace(/^\d+[.)]\s+/, '')))));
    } else {
      frag.append(h('p', {}, lines.join(' ')));
    }
  }
  return frag;
}

/** Only allow http(s) links from content metadata. */
export function safeLink(url, text) {
  return /^https?:\/\//i.test(url ?? '') ? h('a', { href: url, rel: 'noopener noreferrer', target: '_blank' }, text) : null;
}

export function formatDays(days) {
  if (days <= 0) return 'now';
  if (days === 1) return '1 day';
  if (days < 31) return `${days} days`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return `${(days / 365).toFixed(1)} yr`;
}

export function formatWhen(ms, now = Date.now()) {
  const diff = ms - now;
  if (diff <= 0) return 'now';
  const hours = Math.round(diff / 3_600_000);
  if (hours < 24) return hours <= 1 ? 'within the hour' : `in ${hours} hours`;
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
