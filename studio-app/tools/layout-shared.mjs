// Shared by the layout audit and the visual checks (h3-studio#328, #897).
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export async function startPreview() {
  const port = 4173;
  const vite = new URL('../node_modules/vite/bin/vite.js', import.meta.url);
  const child = spawn(
    process.execPath,
    [fileURLToPath(vite), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { stdio: ['ignore', 'pipe', 'ignore'] },
  );
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('vite preview did not start')), 30000);
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes(String(port))) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on('exit', (code) => reject(new Error(`vite preview exited ${code}`)));
  });
  return { base: `http://127.0.0.1:${port}`, stop: () => child.kill() };
}

// Runs inside the page. Only visible elements count; scroll containers may clip on purpose.
export function inspect() {
  const out = { scrollX: 0, offscreen: [], clipped: [], spill: [], tiny: [], small: [] };
  const doc = document.documentElement;
  out.scrollX = doc.scrollWidth - doc.clientWidth;
  const vw = doc.clientWidth;
  const label = (el) => {
    const text = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
    const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} "${text.slice(0, 40)}"`;
  };
  const insideScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowX) || /(auto|scroll)/.test(s.overflow)) return true;
    }
    return false;
  };
  for (const el of document.body.querySelectorAll('*')) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)
      continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    // Skip links sit off-screen until focused; sr-only text is meant to be invisible.
    if (el.closest('[aria-hidden="true"], .sr-only, .visually-hidden, a.skip')) continue;
    if (
      (rect.right > vw + 1 || rect.left < -1) &&
      !insideScroller(el) &&
      style.position !== 'fixed'
    )
      out.offscreen.push(label(el));
    // A fixed-height button whose content spills out (text over the next row).
    if (
      el.tagName === 'BUTTON' &&
      style.overflowY === 'visible' &&
      el.scrollHeight > el.clientHeight + 4
    )
      out.spill.push(label(el));
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!ownText) continue;
    // font-size: 0 is the deliberate icon-only pattern (the label stays for screen readers).
    const size = parseFloat(style.fontSize);
    if (size === 0) continue;
    if (size < 10) out.tiny.push(`${label(el)} ${size}px`);
    else if (size < 11) out.small.push(`${label(el)} ${size}px`);
    const clipsX = el.scrollWidth > el.clientWidth + 1 && style.overflowX !== 'visible';
    if (clipsX && style.textOverflow !== 'ellipsis' && !/(auto|scroll)/.test(style.overflowX))
      out.clipped.push(label(el));
  }
  for (const key of ['offscreen', 'clipped', 'spill', 'tiny', 'small'])
    out[key] = [...new Set(out[key])];
  return out;
}
