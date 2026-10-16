import React, {useEffect, useRef} from 'react';

// A ⋯ menu that closes on any click outside it, Esc, or scrolling. The button that opens it carries
// data-pop={owner} so clicking it again toggles instead of close-then-reopen.
export function Popover({owner, onClose, className = '', children, ...rest}) {
  const box = useRef();
  useEffect(() => {
    const away = e => { if (box.current?.contains(e.target) || e.target.closest?.(`[data-pop="${owner}"]`)) return; onClose(); };
    const key = e => { if (e.key === 'Escape') onClose(); };
    const scroll = e => { if (!box.current?.contains(e.target)) onClose(); };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', key);
    window.addEventListener('scroll', scroll, true);
    return () => { window.removeEventListener('pointerdown', away, true); window.removeEventListener('keydown', key); window.removeEventListener('scroll', scroll, true); };
  }, [owner, onClose]);
  return <div ref={box} className={'more-menu ' + className} {...rest}>{children}</div>;
}
