import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, Sparkles, X } from 'lucide-react';

const PANEL_MAX_WIDTH = 352;
const PANEL_MIN_WIDTH = 260;
const VIEWPORT_MARGIN = 16;
const PANEL_GAP = 12;

export default function XpNotice({ title, children, className = '', panelPlacement = 'below' }) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();

  const updatePanelPosition = useCallback(() => {
    const anchor = rootRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2));
    const height = panelRef.current?.offsetHeight || 260;
    const clampedHeight = Math.min(height, viewportHeight - VIEWPORT_MARGIN * 2);

    let left = rect.right - width;
    let top = rect.bottom + PANEL_GAP;

    if (panelPlacement === 'left' && rect.left - width - PANEL_GAP >= VIEWPORT_MARGIN) {
      left = rect.left - width - PANEL_GAP;
      top = rect.top;
    } else if (top + clampedHeight > viewportHeight - VIEWPORT_MARGIN && rect.top - height - PANEL_GAP >= VIEWPORT_MARGIN) {
      top = rect.top - height - PANEL_GAP;
    }

    left = Math.min(Math.max(left, VIEWPORT_MARGIN), viewportWidth - width - VIEWPORT_MARGIN);
    top = Math.min(Math.max(top, VIEWPORT_MARGIN), viewportHeight - clampedHeight - VIEWPORT_MARGIN);

    setPanelStyle({ left, top, width });
  }, [panelPlacement]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePanelPosition();

    const frame = window.requestAnimationFrame(updatePanelPosition);
    return () => window.cancelAnimationFrame(frame);
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    const handleReposition = () => updatePanelPosition();

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, updatePanelPosition]);

  return (
    <div ref={rootRef} className={`relative flex justify-end ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Show XP notice"
        title="Show XP notice"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/60 bg-cyan-400/15 text-cyan-500 shadow-[0_12px_28px_rgba(8,145,178,0.18)] transition hover:-translate-y-0.5 hover:bg-cyan-400/25 focus-visible:outline focus-visible:outline-4 focus-visible:outline-cyan-300/50"
      >
        <Info size={21} strokeWidth={2.6} aria-hidden="true" />
      </button>

      {open ? createPortal(
        <aside
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="XP notice"
          style={{
            left: panelStyle?.left ?? 0,
            top: panelStyle?.top ?? 0,
            width: panelStyle?.width ?? PANEL_MAX_WIDTH,
            visibility: panelStyle ? 'visible' : 'hidden',
          }}
          className="fixed z-[1000] max-h-[min(26rem,calc(100vh_-_2rem))] overflow-y-auto rounded-[1.35rem] border border-cyan-300/50 bg-[color:var(--color-surface)] p-4 text-[color:var(--color-text)] shadow-[0_24px_70px_rgba(15,23,42,0.22)]"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-500 text-white shadow-[0_12px_26px_rgba(8,145,178,0.22)]">
              <Sparkles size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-500">XP notice</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="-mr-1 -mt-1 rounded-full p-1.5 text-[color:var(--color-text-muted)] transition hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-text)]"
                  aria-label="Close XP notice"
                  title="Close XP notice"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
              <p className="mt-1 text-sm font-black leading-6 sm:text-base">{title}</p>
              <p className="mt-1 text-sm font-semibold leading-7 text-[color:var(--color-text-muted)]">{children}</p>
            </div>
          </div>
        </aside>,
        document.body
      ) : null}
    </div>
  );
}
