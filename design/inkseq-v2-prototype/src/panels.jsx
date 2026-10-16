import React, {useEffect, useState} from 'react';

// A panel size the user can drag; remembered per browser, double-click restores the default.
export function usePanelSize(key, initial, min, max) {
  const [size, setSize] = useState(() => {
    try {
      const n = Number(localStorage.getItem('panel:' + key));
      return n >= min && n <= max ? n : initial;
    } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem('panel:' + key, String(size)); } catch {} }, [key, size]);
  const clamp = n => Math.max(min, Math.min(max, n));
  return {size, reset: () => setSize(initial), start: (event, axis, sign) => {
    event.preventDefault();
    const origin = axis === 'x' ? event.clientX : event.clientY, base = size;
    const move = e => setSize(clamp(base + sign * ((axis === 'x' ? e.clientX : e.clientY) - origin)));
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
export function Splitter({panel, axis = 'x', sign = 1, className = ''}) {
  return (
    <div className={`splitter ${axis} ${className}`} role="separator" aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      title="拖动调整大小 · 双击恢复默认" onPointerDown={e => panel.start(e, axis, sign)} onDoubleClick={panel.reset}>
      <i />
    </div>
  );
}
