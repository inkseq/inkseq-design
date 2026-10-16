// Prototype-only bilingual layer: the UI is written in Chinese; in English mode the rendered text is
// swapped through a dictionary (exact strings + "{}" patterns). Production should use real i18n keys.
import EN from './en.json';

const KEY = 'inkseq-lang';
const CJK = /[㐀-鿿]/;
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE']);
const ATTRS = ['placeholder', 'title', 'aria-label'];

export const getLang = () => { try { return localStorage.getItem(KEY) || 'en'; } catch { return 'en'; } };
let lang = getLang();
const listeners = new Set();
export const onLang = fn => { listeners.add(fn); return () => listeners.delete(fn); };

const exact = new Map(), patterns = [];
const esc = s => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
for (const [zh, en] of Object.entries(EN)) {
  if (zh.includes('{}')) {
    const parts = zh.split('{}');
    if (parts.every(p => !p.trim())) continue;
    patterns.push({re: new RegExp('^' + parts.map(p => esc(p).replace(/\s+/g, '\\s*')).join('([\\s\\S]+?)') + '$'), en, zh, n: parts.join('').length});
  } else exact.set(zh.replace(/\s+/g, ' ').trim(), en);
}
patterns.sort((a, b) => b.n - a.n); // most specific first

// Several patterns can match one string; prefer the first whose slots also translate fully (no Chinese
// left), else the most specific one. Results are cached because React re-renders the same strings.
const cache = new Map();
function core(c) {
  if (cache.has(c)) return cache.get(c);
  let out = exact.get(c) ?? null;
  if (out == null) {
    let first = null, tries = 0;
    for (const p of patterns) {
      const m = c.match(p.re);
      if (!m) continue;
      let i = 1; // "{2}" in English = second Chinese slot; "{}" = next slot
      const r = p.en.replace(/\{(\d*)\}/g, (_, d) => { const v = (d ? m[+d] : m[i++]) ?? ''; return translate(v) ?? v; });
      if (!CJK.test(r)) { out = r; break; }
      first ??= r;
      if (++tries >= 6) break;
    }
    out ??= first;
  }
  // English plurals: "1 stories" -> "1 story"
  if (out) out = out.replace(/(^|[^\d.])1 (chapter|shot|take|look|image|machine|version|voice clip|clip|run|file|profile|sample|work|item|scene|asset|minute|hour|day|group)s\b/g, '$11 $2').replace(/(^|[^\d.])1 stories\b/g, '$11 story');
  if (cache.size > 5000) cache.clear();
  cache.set(c, out);
  return out;
}
export function translate(s) {
  if (!s || !CJK.test(s)) return null;
  const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], out = core(s.trim().replace(/\s+/g, ' '));
  return out == null ? null : lead + out + trail;
}

// Each text node remembers what React wrote, so switching back to Chinese restores it.
const orig = new WeakMap(), mine = new WeakMap();
// Debug: original Chinese of a text node (used to find untranslated strings).
if (typeof window !== 'undefined') window.__i18nOrig = n => original(n);
const original = n => { if (mine.get(n) !== n.nodeValue) orig.set(n, n.nodeValue); return orig.get(n); };
const write = (n, v) => { if (n.nodeValue !== v) { mine.set(n, v); n.nodeValue = v; } else mine.set(n, v); };
const skipped = el => !el || SKIP.has(el.tagName) || el.isContentEditable || el.closest?.('[data-no-i18n]');

function processElement(el) {
  if (!el || el.isContentEditable || el.closest?.('[data-no-i18n]')) return;
  const texts = SKIP.has(el.tagName) ? [] : [...el.childNodes].filter(n => n.nodeType === 3);
  if (texts.length) {
    const origs = texts.map(original);
    if (lang === 'zh') texts.forEach((n, i) => write(n, origs[i]));
    else {
      const whole = texts.length > 1 && texts.length === el.childNodes.length ? translate(origs.join('')) : null;
      if (whole != null) texts.forEach((n, i) => write(n, i ? '' : whole));
      else texts.forEach((n, i) => write(n, translate(origs[i]) ?? origs[i]));
    }
  }
  for (const a of ATTRS) {
    const k = 'data-zh-' + a, cur = el.getAttribute?.(a);
    if (cur == null) continue;
    if (el.getAttribute(k + '-en') !== cur) el.setAttribute(k, cur); // React wrote a new value
    const zh = el.getAttribute(k);
    const v = lang === 'zh' ? zh : (translate(zh) ?? zh);
    if (cur !== v) el.setAttribute(a, v);
    el.setAttribute(k + '-en', v);
  }
}
// Reverse lookup for sample data (English -> Chinese) when switching back.
const reverse = new Map(Object.entries(EN).filter(([zh]) => !zh.includes('{}')).map(([zh, en]) => [en, zh]));
// Translate one piece of sample data to the target language; user-written text that is not in the
// dictionary is returned unchanged.
export function translateData(v, to) {
  if (typeof v !== 'string' || !v) return v;
  if (to === 'zh') return reverse.get(v) ?? v;
  return translate(v) ?? v;
}

function walk(root) {
  if (root.nodeType === 3) return processElement(root.parentElement);
  if (root.nodeType !== 1 || root.closest?.('[data-no-i18n]')) return;
  processElement(root);
  for (const el of root.querySelectorAll('*')) processElement(el);
}

let started = false;
export function startI18n() {
  if (started || typeof document === 'undefined') return;
  started = true;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  new MutationObserver(list => {
    const seen = new Set();
    for (const m of list) {
      if (m.type === 'characterData') { const p = m.target.parentElement; if (p && !seen.has(p) && mine.get(m.target) !== m.target.nodeValue) { seen.add(p); processElement(p); } }
      else if (m.type === 'attributes') { if (!seen.has(m.target)) { seen.add(m.target); processElement(m.target); } }
      else { if (!seen.has(m.target)) { seen.add(m.target); processElement(m.target); } m.addedNodes.forEach(walk); }
    }
  }).observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS});
  walk(document.body);
}
export function setLang(l) {
  lang = l;
  try { localStorage.setItem(KEY, l); } catch {}
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  walk(document.body);
  listeners.forEach(fn => fn(l));
}
