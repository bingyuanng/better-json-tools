import React from "react";

const LINE_HEIGHT = 20;
const OVERSCAN = 20;

export function VirtualizedText({
  text,
  wrap = false,
  className,
  empty,
}: {
  text: string;
  wrap?: boolean;
  className?: string;
  empty?: React.ReactNode;
}) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);

  const lines = React.useMemo(() => (text ? text.split(/\r?\n/) : []), [text]);

  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setViewportHeight(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - OVERSCAN);
  const end = Math.min(lines.length, Math.ceil((scrollTop + viewportHeight) / LINE_HEIGHT) + OVERSCAN);
  const visible = lines.slice(start, end);

  return (
    <div ref={viewportRef} className={className} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
      {!lines.length ? (
        empty ?? null
      ) : (
        <div style={{ height: lines.length * LINE_HEIGHT, position: "relative" }}>
          {visible.map((line, i) => (
            <div
              key={start + i}
              style={{ position: "absolute", top: (start + i) * LINE_HEIGHT, left: 0, right: 0, height: LINE_HEIGHT }}
              className={wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"}
            >
              {line || "\u00a0"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
