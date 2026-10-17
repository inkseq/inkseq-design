import React, {useEffect, useState} from 'react';

// A panel size the user can drag; remembered per browser, double-click restores the default.
export function usePanelSize(key, initial, min, max) {
  const read = () => { try { const n = Number(localStorage.getItem('panel:' + key)); return n >= min && n <= max ? n : null; } catch { return null; } };
  const [saved, setSaved] = useState(read); // null = the user never resized it (layout may size it automatically)
  const size = saved ?? initial;
  useEffect(() => { try { saved == null ? localStorage.removeItem('panel:' + key) : localStorage.setItem('panel:' + key, String(saved)); } catch {} }, [key, saved]);
  const clamp = n => Math.max(min, Math.min(max, n));
  return {size, custom: saved != null, set: n => setSaved(clamp(n)), reset: () => setSaved(null), start: (event, axis, sign, from = size) => {
    event.preventDefault();
    const origin = axis === 'x' ? event.clientX : event.clientY, base = from;
    const move = e => setSaved(clamp(base + sign * ((axis === 'x' ? e.clientX : e.clientY) - origin)));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('resizing', 'resizing-y');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    document.body.classList.add(axis === 'x' ? 'resizing' : 'resizing-y');
  }};
}

// axis "x" = vertical bar dragged left/right; "y" = horizontal bar dragged up/down.
// sign = +1 when dragging right/down makes the panel bigger, -1 otherwise.
// `current` = the size actually shown (may differ from panel.size when the layout sizes it automatically);
// `onDouble` replaces the default double-click (restore default).
export function Splitter({panel, axis = 'x', sign = 1, className = '', current, onDouble, title = '拖动调整大小 · 双击恢复默认'}) {
  return (
    <div className={`splitter ${axis} ${className}`} role="separator" aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      title={title} onPointerDown={e => panel.start(e, axis, sign, current ?? panel.size)} onDoubleClick={onDouble || panel.reset}>
      <i />
    </div>
  );
}
