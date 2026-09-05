import { useEffect, useRef, useState } from "react";

export type ElementSize = { width: number; height: number };

/**
 * An element's own content-box size, kept in sync via `ResizeObserver` —
 * `<Factory>`'s own viewport, so it can fit the display's aspect ratio to
 * whatever room it actually has.
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}
