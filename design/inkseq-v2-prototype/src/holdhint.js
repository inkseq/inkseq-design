// On a phone, icon+text buttons collapse to just the icon (CSS). Pressing and holding one for ~0.45s
// shows its hidden label in a small bubble; releasing hides it. The tap itself still works as usual.
export function installHoldHint() {
  if (window.__holdHint) return; // once per page, also across hot reloads
  window.__holdHint = true;
  let timer = null, bubble = null, held = false;
  const label = btn => btn.getAttribute('title') || btn.textContent.replace(/\s+/g, ' ').trim();
  const collapsed = btn => btn && getComputedStyle(btn).fontSize === '0px';
  const hide = () => { clearTimeout(timer); timer = null; bubble?.remove(); bubble = null; };
  document.addEventListener('touchstart', e => {
    const btn = e.target.closest?.('button');
    hide(); held = false;
    if (!collapsed(btn) || !label(btn)) return;
    timer = setTimeout(() => {
      const r = btn.getBoundingClientRect();
      bubble = document.createElement('div');
      bubble.className = 'hold-hint';
      bubble.textContent = label(btn);
      document.body.appendChild(bubble);
      const w = bubble.offsetWidth;
      bubble.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
      bubble.style.top = Math.max(8, r.top - bubble.offsetHeight - 8) + 'px';
      held = true;
    }, 450);
  }, {passive: true, capture: true});
  // A long press only explains the button; it does not also press it.
  document.addEventListener('click', e => { if (held) { e.preventDefault(); e.stopPropagation(); held = false; } }, true);
  ['touchend', 'touchcancel', 'touchmove', 'scroll'].forEach(t => document.addEventListener(t, () => { clearTimeout(timer); timer = null; setTimeout(() => { bubble?.remove(); bubble = null; }, bubble ? 900 : 0); }, {passive: true, capture: true}));
  document.addEventListener('contextmenu', e => { if (collapsed(e.target.closest?.('button'))) e.preventDefault(); }, true);
}
