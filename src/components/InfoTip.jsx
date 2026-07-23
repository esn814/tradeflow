import { useState, useRef, useEffect, useCallback } from 'react';
import { Info } from 'lucide-react';

/**
 * Slick contextual help tooltip.
 * On touch devices, click-only to avoid the tap-flash-close bug.
 */
export default function InfoTip({ text, position = 'top' }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const iconRef = useRef(null);
  const tipRef = useRef(null);
  const isTouchRef = useRef(false);

  useEffect(() => {
    const onTouch = () => { isTouchRef.current = true; };
    window.addEventListener('touchstart', onTouch, { once: true });
    return () => window.removeEventListener('touchstart', onTouch);
  }, []);

  useEffect(() => {
    if (open && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      const tipW = 260;
      let left = rect.left + rect.width / 2 - tipW / 2;
      if (left < 8) left = 8;
      if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8;
      setCoords({ top: position === 'top' ? rect.top - 8 : rect.bottom + 8, left });
    }
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (iconRef.current?.contains(e.target)) return;
      if (tipRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const handleClick = useCallback(() => setOpen(o => !o), []);
  const handleMouseEnter = useCallback(() => { if (!isTouchRef.current) setOpen(true); }, []);
  const handleMouseLeave = useCallback(() => { if (!isTouchRef.current) setOpen(false); }, []);

  return (
    <span className="relative inline-flex" ref={iconRef}>
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--color-border-subtle)] text-gray-500 hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-15)] transition-all ml-1.5 cursor-help"
        aria-label="More info"
      >
        <Info className="w-3 h-3" />
      </button>
      {open && (
        <div
          ref={tipRef}
          className="fixed z-[100] px-3.5 py-2.5 bg-[var(--color-border-subtle)] border border-[var(--color-border-info)] rounded-lg text-xs text-gray-300 leading-relaxed shadow-xl shadow-black/40 max-w-[260px]"
          style={{
            top: position === 'top' ? undefined : coords.top,
            bottom: position === 'top' ? `calc(100vh - ${coords.top}px)` : undefined,
            left: coords.left,
            transform: position === 'top' ? 'translateY(-100%)' : 'none',
          }}
        >
          {text}
          <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--color-border-subtle)] border-[var(--color-border-info)] rotate-45 ${
            position === 'top' ? '-bottom-1 border-r border-b' : '-top-1 border-l border-t'
          }`} />
        </div>
      )}
    </span>
  );
}
