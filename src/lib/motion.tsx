import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from 'react';
import { generate, type GenerationRun } from '../vendor/transitions-ui-generation/ui-generation.js';

export const MotionContext = createContext({ enabled: true, replay: 0 });

/** Replay on semantic props, not on incidental renders or interactive local state. */
export function MotionRegion({ signature, children }: { signature: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { enabled, replay } = useContext(MotionContext);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    let disposed = false;
    let run: GenerationRun | undefined;
    let frame = 0;
    let active = false;
    let observer: ResizeObserver | undefined;
    const previousVisibility = element.style.visibility;
    // Preserve layout while waiting for fonts; never use display:none for measurement.
    element.style.visibility = 'hidden';
    const cancel = () => {
      if (!active) return;
      active = false;
      run?.cancel();
      element.dataset.motion = 'idle';
    };
    void document.fonts.ready.then(() => {
      if (disposed) return;
      frame = requestAnimationFrame(() => {
        if (disposed) return;
        element.style.visibility = previousVisibility;
        const bounds = element.getBoundingClientRect();
        if (!bounds.width) return;
        element.dataset.motion = 'playing';
        run = generate(element, { mode: 'skeleton', duration: 1600, maxParts: 35, keys: 2 });
        active = true;
        observer = new ResizeObserver(() => {
          const next = element.getBoundingClientRect();
          if (Math.abs(next.width - bounds.width) > 1 || Math.abs(next.height - bounds.height) > 1) cancel();
        });
        observer.observe(element);
        void run.finished.then(() => {
          if (disposed) return;
          active = false;
          element.dataset.motion = 'idle';
          observer?.disconnect();
        });
      });
    });
    // Upstream overlays use page coordinates. On scroll/resize, reveal rather than drift.
    window.addEventListener('scroll', cancel, true);
    window.addEventListener('resize', cancel);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      run?.cancel();
      element.style.visibility = previousVisibility;
      element.dataset.motion = 'idle';
      window.removeEventListener('scroll', cancel, true);
      window.removeEventListener('resize', cancel);
    };
  }, [signature, enabled, replay]);
  return <div ref={ref} className="motion-region" data-motion="idle">{children}</div>;
}
