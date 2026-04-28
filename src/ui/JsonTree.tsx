import React from "react";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { stableStringify } from "../lib/json";
import { cn } from "../lib/utils";

type PathPart = string | number;

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function labelFor(value: unknown) {
  if (value === null) return { kind: "null", short: "null" };
  if (isArray(value)) return { kind: "array", short: `Array(${value.length})` };
  if (isObject(value)) return { kind: "object", short: "Object" };
  const t = typeof value;
  if (t === "string") return { kind: "string", short: JSON.stringify(value) };
  if (t === "number") return { kind: "number", short: String(value) };
  if (t === "boolean") return { kind: "boolean", short: value ? "true" : "false" };
  return { kind: "other", short: String(value) };
}

function stringifyKey(k: string | number) {
  return typeof k === "number" ? `[${k}]` : JSON.stringify(k);
}

function pathToString(path: PathPart[]) {
  if (path.length === 0) return "$";
  return "$" + path.map((p) => (typeof p === "number" ? `[${p}]` : `.${p}`)).join("");
}

function highlightMatch(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let idx = lowerText.indexOf(lowerQuery);

  while (idx !== -1) {
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <mark key={`${idx}-${idx + q.length}`} className="bg-yellow-300 px-0.5 text-black dark:bg-yellow-400 dark:text-black">
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    cursor = idx + q.length;
    idx = lowerText.indexOf(lowerQuery, cursor);
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function collectMatches(value: unknown, query: string, sortKeys: boolean) {
  const q = query.trim().toLowerCase();
  if (!q) return [] as PathPart[][];

  const matches: PathPart[][] = [];

  function walk(node: unknown, path: PathPart[]) {
    const lbl = labelFor(node);
    const hay = (lbl.kind === "string" ? String(node) : lbl.short).toLowerCase();
    const pathStr = pathToString(path).toLowerCase();
    if (hay.includes(q) || pathStr.includes(q)) matches.push(path);

    if (isArray(node)) {
      node.forEach((child, idx) => walk(child, path.concat([idx])));
    } else if (isObject(node)) {
      const keys = Object.keys(node);
      if (sortKeys) keys.sort();
      for (const k of keys) {
        if (k.toLowerCase().includes(q)) matches.push(path.concat([k]));
        walk(node[k], path.concat([k]));
      }
    }
  }

  walk(value, []);
  const seen = new Set(matches.map((m) => JSON.stringify(m)));
  return Array.from(seen).map((s) => JSON.parse(s) as PathPart[]);
}

export function JsonTree({
  value,
  sortKeys,
  query,
  activeMatchIndex,
  onMatchesChanged,
  onCopyValue,
  onCopyText,
  onSelectedPathChanged,
  apiRef,
}: {
  value: unknown;
  sortKeys: boolean;
  query: string;
  activeMatchIndex: number;
  onMatchesChanged?: (count: number) => void;
  onCopyValue: (value: unknown) => void | Promise<void>;
  onCopyText?: (text: string, label: string) => void | Promise<void>;
  onSelectedPathChanged?: (path: string) => void;
  apiRef: React.MutableRefObject<{
    matchCount: number;
    focusMatch: (idx: number) => void;
    expandAll: () => void;
    collapseAll: () => void;
  } | null>;
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => {
    const all = new Set<string>();
    function walk(node: unknown, path: PathPart[]) {
      all.add(pathToString(path));
      if (isArray(node)) node.forEach((child, idx) => walk(child, path.concat([idx])));
      else if (isObject(node)) {
        for (const key of Object.keys(node)) walk(node[key], path.concat([key]));
      }
    }
    walk(value, []);
    return all;
  });

  const matches = React.useMemo(() => collectMatches(value, query, sortKeys), [value, query, sortKeys]);

  const activeMatchPathStr = React.useMemo(() => {
    if (!matches.length) return null;
    const idx = ((activeMatchIndex % matches.length) + matches.length) % matches.length;
    return pathToString(matches[idx]);
  }, [matches, activeMatchIndex]);

  const nodeRefs = React.useRef(new Map<string, HTMLDivElement>());

  const ensureExpanded = React.useCallback((path: PathPart[]) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (let i = 0; i <= path.length; i++) {
        next.add(pathToString(path.slice(0, i)));
      }
      return next;
    });
  }, []);

  const focusMatch = React.useCallback(
    (idx: number) => {
      if (!matches.length) return;
      const path = matches[((idx % matches.length) + matches.length) % matches.length];
      ensureExpanded(path);
      const id = pathToString(path);
      requestAnimationFrame(() => {
        const el = nodeRefs.current.get(id);
        el?.scrollIntoView({ block: "center" });
      });
    },
    [matches, ensureExpanded]
  );

  const expandAll = React.useCallback(() => {
    const next = new Set<string>();
    function walk(node: unknown, path: PathPart[]) {
      next.add(pathToString(path));
      if (isArray(node)) node.forEach((c, i) => walk(c, path.concat([i])));
      else if (isObject(node)) {
        for (const k of Object.keys(node)) walk(node[k], path.concat([k]));
      }
    }
    walk(value, []);
    setExpanded(next);
  }, [value]);

  const collapseAll = React.useCallback(() => {
    setExpanded(new Set(["$"]));
  }, []);

  React.useEffect(() => {
    apiRef.current = {
      matchCount: matches.length,
      focusMatch,
      expandAll,
      collapseAll,
    };
    onMatchesChanged?.(matches.length);
  }, [apiRef, matches.length, onMatchesChanged, focusMatch, expandAll, collapseAll]);

  React.useEffect(() => {
    if (!matches.length) return;
    const idx = ((activeMatchIndex % matches.length) + matches.length) % matches.length;
    focusMatch(idx);
  }, [activeMatchIndex, matches, focusMatch]);

  function toggle(pathId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pathId)) next.delete(pathId);
      else next.add(pathId);
      return next;
    });
  }

  function renderNode(node: unknown, path: PathPart[], keyLabel: string | null) {
    const id = pathToString(path);
    const lbl = labelFor(node);
    const isContainer = lbl.kind === "object" || lbl.kind === "array";
    const open = expanded.has(id);

    const queryTrim = query.trim();
    const matchHighlight = queryTrim.length > 0 && matches.some((m) => pathToString(m) === id);
    const displayValue = isContainer ? (lbl.kind === "object" ? "{…}" : "[…]") : lbl.short;

    const isActiveMatch = !!activeMatchPathStr && activeMatchPathStr === id;
    const childCount = isArray(node) ? node.length : isObject(node) ? Object.keys(node).length : 0;
    const nodeText = stableStringify(node, sortKeys) ?? String(node);
    const keyValueText = keyLabel ? `${keyLabel}: ${nodeText}` : nodeText;

    return (
      <div
        key={id}
        ref={(el) => {
          if (el) nodeRefs.current.set(id, el);
          else nodeRefs.current.delete(id);
        }}
        className="px-1 py-0.5"
      >
        <div
          className={cn(
            "group/row relative flex cursor-default items-start gap-1.5 pr-2 transition-colors hover:bg-muted/40 group-hover/row:pr-52",
            matchHighlight ? "bg-accent/35" : undefined,
            isActiveMatch ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : undefined
          )}
          onClick={() => {
            onSelectedPathChanged?.(id);
            onCopyText?.(keyValueText, keyLabel ? "Copied key value" : "Copied value");
          }}
        >
          <button
            type="button"
            className={cn(
              "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center hover:bg-accent",
              !isContainer && "pointer-events-none opacity-0"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (isContainer) toggle(id);
            }}
            aria-label={open ? "Collapse" : "Expand"}
          >
            {isContainer ? open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" /> : null}
          </button>

          <div className="min-w-0 flex-1 break-words font-mono text-xs leading-5 [overflow-wrap:anywhere]">
            {keyLabel ? <span className="text-primary">{highlightMatch(keyLabel, queryTrim)}</span> : null}
            {keyLabel ? <span className="text-muted-foreground">: </span> : null}
            <span
              className={cn(
                "cursor-default",
                lbl.kind === "string" && "text-emerald-600 dark:text-emerald-400",
                lbl.kind === "number" && "text-amber-600 dark:text-amber-400",
                lbl.kind === "boolean" && "text-purple-600 dark:text-purple-400",
                (lbl.kind === "null" || lbl.kind === "object" || lbl.kind === "array") && "text-muted-foreground"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onSelectedPathChanged?.(id);
                onCopyValue(node);
              }}
            >
              {highlightMatch(displayValue, queryTrim)}
            </span>
            {isContainer ? (
              <span className="ml-2 text-[10px] text-muted-foreground">
                {childCount} {childCount === 1 ? "child" : "children"}
              </span>
            ) : null}
          </div>

          <div className="pointer-events-none absolute right-1 top-0.5 z-10 flex shrink-0 items-center gap-1 bg-card/95 opacity-0 shadow-sm transition-opacity group-hover/row:pointer-events-auto group-hover/row:opacity-100">
            <button
              type="button"
              className="inline-flex h-5 items-center gap-1 border border-border bg-background px-1.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onSelectedPathChanged?.(id);
                onCopyValue(node);
              }}
              title="Copy value"
            >
              <Copy className="h-3 w-3" /> Value
            </button>
            {keyLabel ? (
              <button
                type="button"
                className="inline-flex h-5 items-center border border-border bg-background px-1.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectedPathChanged?.(id);
                  onCopyText?.(keyValueText, "Copied key value");
                }}
                title="Copy Key Value"
              >
                Key Value
              </button>
            ) : null}
            {isContainer ? (
              <button
                type="button"
                className="inline-flex h-5 items-center border border-border bg-background px-1.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectedPathChanged?.(id);
                  onCopyText?.(nodeText, "Copied node");
                }}
                title="Copy node"
              >
                Node
              </button>
            ) : null}
          </div>
        </div>

        {isContainer && open ? (
          <div className="mt-0.5 border-l border-border/60 pl-3">
            {isArray(node)
              ? node.map((child, idx) => renderNode(child, path.concat([idx]), stringifyKey(idx)))
              : (() => {
                  const obj = node as Record<string, unknown>;
                  const keys = Object.keys(obj);
                  if (sortKeys) keys.sort();
                  return keys.map((k) => renderNode(obj[k], path.concat([k]), stringifyKey(k)));
                })()}
          </div>
        ) : null}
      </div>
    );
  }

  return <div className="grid gap-1">{renderNode(value, [], null)}</div>;
}
