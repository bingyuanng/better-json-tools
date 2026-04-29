import React from "react";

export function useDebouncedValue<T>(value: T, delayMs = 150) {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export function trimJsonText(text: string) {
  return text.replace(/[\t ]+$/gm, "").replace(/(?:\r?\n)+$/, "");
}

export function sanitizeReplCode(code: string) {
  return code
    .replace(/^\/\/ JSON is loaded as: data\s*\n?/, "")
    .replace(/^\/\/ Current JSON is available as `data`\s*\n?/, "")
    .replace(/^\/\/ Try: data\s*\n?/, "")
    .trim();
}

export function getJsonStats(value: unknown) {
  const stats = { nodes: 0, objects: 0, arrays: 0, scalars: 0 };
  function walk(node: unknown) {
    stats.nodes += 1;
    if (Array.isArray(node)) {
      stats.arrays += 1;
      node.forEach(walk);
    } else if (node && typeof node === "object") {
      stats.objects += 1;
      Object.values(node as Record<string, unknown>).forEach(walk);
    } else {
      stats.scalars += 1;
    }
  }
  walk(value);
  return stats;
}

export function formatBytes(chars: number) {
  if (chars < 1024) return `${chars} B`;
  if (chars < 1024 * 1024) return `${(chars / 1024).toFixed(1)} KB`;
  return `${(chars / 1024 / 1024).toFixed(1)} MB`;
}

export function highlightJson(text: string) {
  if (!text) return null;

  const tokenPattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],:]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));

    const token = match[0];
    const stringToken = match[1];
    const keySuffix = match[2] ?? "";
    const key = `${match.index}-${tokenPattern.lastIndex}`;

    if (stringToken && keySuffix) {
      parts.push(
        React.createElement(
          React.Fragment,
          { key },
          React.createElement("span", { className: "text-sky-300" }, stringToken),
          React.createElement("span", { className: "text-muted-foreground" }, keySuffix)
        )
      );
    } else if (stringToken) {
      parts.push(React.createElement("span", { key, className: "text-emerald-300" }, token));
    } else if (token === "true" || token === "false") {
      parts.push(React.createElement("span", { key, className: "text-amber-300" }, token));
    } else if (token === "null") {
      parts.push(React.createElement("span", { key, className: "text-muted-foreground" }, token));
    } else if (/^-?\d/.test(token)) {
      parts.push(React.createElement("span", { key, className: "text-orange-300" }, token));
    } else {
      parts.push(React.createElement("span", { key, className: "text-muted-foreground" }, token));
    }

    lastIndex = tokenPattern.lastIndex;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
