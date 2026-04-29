import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Prec } from "@codemirror/state";
import { tags } from "@lezer/highlight";
import { EditorView, keymap } from "@codemirror/view";
import { json } from "@codemirror/lang-json";
import {
  AlertCircle,
  ArrowDownUp,
  CheckCircle2,
  Clipboard,
  Code2,
  Eraser,
  FileJson2,
  LayoutDashboard,
  Columns2,
  Rows2,
  Maximize2,
  Minimize2,
  RemoveFormatting,
  Search,
  Sparkles,
} from "lucide-react";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { stableStringify, tryParseJson } from "../lib/json";
import { formatBytes, getJsonStats, highlightJson, sanitizeReplCode, trimJsonText, useDebouncedValue } from "./jsonWorkbenchUtils";
import { JsonTree } from "./JsonTree";

const JsonEditorPanel = React.lazy(() => import("./JsonEditorPanel").then((m) => ({ default: m.JsonEditorPanel })));
const ReplPanel = React.lazy(() => import("./ReplPanel").then((m) => ({ default: m.ReplPanel })));
import { VirtualizedText } from "./virtualizedText";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

declare global {
  interface Window {
    __BJ_REPL_SANDBOX_URL__?: string;
    chrome?: { runtime?: { getURL?: (path: string) => string } };
  }
}

type ViewMode = "pretty" | "raw";

const nordHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.operatorKeyword], color: "#81a1c1" },
  { tag: [tags.name, tags.variableName, tags.propertyName], color: "#d8dee9" },
  { tag: [tags.string, tags.special(tags.string)], color: "#a3be8c" },
  { tag: [tags.number, tags.bool, tags.null], color: "#b48ead" },
  { tag: [tags.operator, tags.punctuation, tags.separator, tags.bracket], color: "#81a1c1" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "#616e88", fontStyle: "italic" },
  { tag: [tags.invalid], color: "#bf616a" },
]);
const codeMirrorTheme = EditorView.theme({ "&": { backgroundColor: "#2e3440", color: "#d8dee9", fontSize: "14px" } }, { dark: true });
const codeMirrorExtensions = [Prec.highest(syntaxHighlighting(nordHighlightStyle, { fallback: true }))];

function ResizeHandle({ direction }: { direction: "horizontal" | "vertical" }) {
  return (
    <PanelResizeHandle
      className={
        direction === "horizontal"
          ? "group flex w-4 items-center justify-center"
          : "group flex h-4 items-center justify-center"
      }
    >
      <div
        className={
          direction === "horizontal"
            ? "h-12 w-1 bg-border transition-colors group-hover:bg-primary"
            : "h-1 w-12 bg-border transition-colors group-hover:bg-primary"
        }
      />
    </PanelResizeHandle>
  );
}

export function JsonWorkbench({
  mode,
  initialRawText,
  initialValue,
}: {
  mode: "paste" | "inpage";
  initialRawText?: string;
  initialValue?: unknown;
}) {
  const editorRef = React.useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = React.useRef<HTMLDivElement | null>(null);
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const replFrameRef = React.useRef<HTMLIFrameElement | null>(null);

  const [rawText, setRawText] = React.useState(initialRawText ?? "{}");
  const [value, setValue] = React.useState<unknown>(initialValue ?? {});
  const [error, setError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<ViewMode>("pretty");
  const [sortKeys, setSortKeys] = React.useState(false);

  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, 180);
  const [matchIndex, setMatchIndex] = React.useState(0);
  const [matchCount, setMatchCount] = React.useState(0);
  const [toast, setToast] = React.useState<string | null>(null);
  const [editorScroll, setEditorScroll] = React.useState({ left: 0, top: 0 });
  const [replCode, setReplCode] = React.useState("// Current JSON is available as `data`\n// Try: console.log(data)");
  const [replResult, setReplResult] = React.useState<string>("");
  const [replError, setReplError] = React.useState<string | null>(null);
  const [replSandboxReady, setReplSandboxReady] = React.useState(false);
  const [replLayout, setReplLayout] = React.useState<"vertical" | "horizontal">("vertical");
  const [replLastRun, setReplLastRun] = React.useState<{ at: number; ok: boolean } | null>(null);
  const [selectedPath, setSelectedPath] = React.useState("$");

  const treeApiRef = React.useRef<{ matchCount: number; focusMatch: (idx: number) => void; expandAll: () => void; collapseAll: () => void } | null>(
    null
  );

  React.useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const prettyRaw = React.useMemo(() => {
    try {
      return stableStringify(value, sortKeys) ?? "";
    } catch {
      return rawText;
    }
  }, [value, sortKeys, rawText]);

  const stats = React.useMemo(() => getJsonStats(value), [value]);
  const hasInput = rawText.trim().length > 0 || initialValue !== undefined;
  const rawLineCount = React.useMemo(() => (rawText ? rawText.split(/\r?\n/).length : 0), [rawText]);
  const lineNumbers = React.useMemo(
    () => Array.from({ length: Math.max(rawLineCount, 1) }, (_, idx) => idx + 1),
    [rawLineCount]
  );
  const highlightedRawText = React.useMemo(() => highlightJson(rawText), [rawText]);
  const sharedSize = formatBytes((rawText || prettyRaw).length);

  function setFromText(text: string) {
    setRawText(text);
    const parsed = tryParseJson(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setValue(parsed.value);
  }

  React.useEffect(() => {
    if (initialValue !== undefined) return;
    if (!initialRawText) return;
    setFromText(initialRawText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onFormat() {
    setFromText(rawText);
  }

  function onPrettier() {
    const parsed = tryParseJson(rawText);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setValue(parsed.value);
    setRawText(JSON.stringify(parsed.value, null, 2) + "\n");
  }

  function onMinify() {
    const parsed = tryParseJson(rawText);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setValue(parsed.value);
    setRawText(JSON.stringify(parsed.value));
  }

  function onClear() {
    setRawText("");
    setValue({});
    setError(null);
    setQuery("");
    setMatchIndex(0);
    setMatchCount(0);
  }

  const showEditor = mode === "paste";

  function navigateMatch(direction: 1 | -1) {
    const api = treeApiRef.current;
    if (!api || api.matchCount === 0) return;
    const next = (matchIndex + direction + api.matchCount) % api.matchCount;
    setMatchIndex(next);
  }

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "enter") {
        if (!showEditor) return;
        e.preventDefault();
        onFormat();
      }
      if (e.altKey && e.key.toLowerCase() === "p") {
        if (!showEditor) return;
        e.preventDefault();
        onPrettier();
      }
      if (meta && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setQuery("");
        setMatchIndex(0);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEditor, rawText]);

  async function copyPrettyRaw() {
    const ok = await copyText(prettyRaw);
    setToast(ok ? "Copy successful" : "Copy failed");
  }

  function updateEditorText(nextText: string, selectionStart: number, selectionEnd: number) {
    setRawText(nextText);
    requestAnimationFrame(() => {
      editorRef.current?.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  async function runRepl() {
    const code = sanitizeReplCode(replCode);
    if (!code) {
      setReplResult("");
      setReplError(null);
      setReplLastRun(null);
      return;
    }

    const frame = replFrameRef.current?.contentWindow;
    if (!frame || !replSandboxReady) {
      setReplError("REPL sandbox is not ready yet.");
      setReplLastRun({ at: Date.now(), ok: false });
      return;
    }

    const parsed = tryParseJson(rawText);
    const replValue = parsed.ok ? parsed.value : value;

    const id = crypto.randomUUID();
    try {
      const result = await new Promise<unknown>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          window.removeEventListener("message", onMessage);
          reject(new Error("REPL timed out"));
        }, 5000);

        function onMessage(event: MessageEvent) {
          const message = event.data;
          if (!message || message.type !== "bj-repl-result" || message.id !== id) return;
          window.clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          if (message.ok) resolve({ result: message.result, logs: message.logs ?? [] });
          else reject(new Error(message.error || "REPL failed"));
        }

        window.addEventListener("message", onMessage);
        frame.postMessage({ type: "bj-repl-run", id, code, value: replValue }, "*");
      });
      const output = result as { result: unknown; logs: unknown[] };
      const formatReplValue = (item: unknown) => (typeof item === "string" ? item : stableStringify(item, sortKeys) ?? String(item));
      const sections: string[] = [];
      if (output.logs.length) sections.push(output.logs.map(formatReplValue).join("\n"));
      if (output.result !== undefined) sections.push(formatReplValue(output.result));
      setReplResult(sections.join("\n"));
      setReplError(null);
      setReplLastRun({ at: Date.now(), ok: true });
    } catch (e) {
      setReplResult("");
      setReplError(e instanceof Error ? e.message : String(e));
      setReplLastRun({ at: Date.now(), ok: false });
    }
  }

  function onEditorPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = e.clipboardData.getData("text");
    if (!pasted) return;

    e.preventDefault();
    const target = e.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const cleaned = trimJsonText(pasted);
    const nextText = rawText.slice(0, start) + cleaned + rawText.slice(end);
    const nextPos = start + cleaned.length;
    updateEditorText(nextText, nextPos, nextPos);
  }

  function onEditorKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab") return;
    e.preventDefault();

    const target = e.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const indent = "  ";

    if (!e.shiftKey && start === end) {
      updateEditorText(rawText.slice(0, start) + indent + rawText.slice(end), start + indent.length, start + indent.length);
      return;
    }

    const lineStart = rawText.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = end === start ? start : rawText.indexOf("\n", end);
    const selectionEnd = lineEnd === -1 ? rawText.length : lineEnd;
    const before = rawText.slice(0, lineStart);
    const selected = rawText.slice(lineStart, selectionEnd);
    const after = rawText.slice(selectionEnd);

    if (!e.shiftKey) {
      const indented = selected.replace(/^/gm, indent);
      updateEditorText(before + indented + after, start + indent.length, end + (indented.length - selected.length));
      return;
    }

    let firstLineRemoved = 0;
    let removedTotal = 0;
    const unindented = selected.replace(/^( {1,2}|\t)/gm, (match, removed: string, offset: number) => {
      if (offset === 0) firstLineRemoved = removed.length;
      removedTotal += removed.length;
      return "";
    });
    updateEditorText(
      before + unindented + after,
      Math.max(lineStart, start - firstLineRemoved),
      Math.max(lineStart, end - removedTotal)
    );
  }

  const replSandboxUrl = window.__BJ_REPL_SANDBOX_URL__ ?? window.chrome?.runtime?.getURL?.("sandbox/repl.html") ?? "";
  const validateKeymap = React.useMemo(
    () =>
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              onFormat();
              return true;
            },
          },
        ])
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawText]
  );
  const replKeymap = React.useMemo(
    () =>
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              void runRepl();
              return true;
            },
          },
        ])
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replCode, value, sortKeys, replSandboxReady]
  );

  return (
    <div className="h-[calc(100vh-6rem)] min-h-[560px]">
      {replSandboxUrl ? (
        <iframe
          ref={replFrameRef}
          src={replSandboxUrl}
          title="REPL sandbox"
          className="hidden"
          onLoad={() => setReplSandboxReady(true)}
        />
      ) : null}
      {toast ? (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 border border-emerald-500/30 bg-emerald-500 px-8 py-4 text-base font-semibold text-white shadow-2xl shadow-emerald-950/30">
          {toast}
        </div>
      ) : null}

      <div className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0" aria-hidden="true">
        <CodeMirror className="bj-cm" value="{}" extensions={[json(), ...codeMirrorExtensions]} theme={codeMirrorTheme} />
      </div>

      <PanelGroup orientation="vertical" className="h-full min-h-0">
        <Panel defaultSize={58} minSize={25} className="min-h-0">
          <PanelGroup orientation="horizontal" className="h-full min-h-0">
            {showEditor ? (
              <Panel defaultSize={50} minSize={25} className="min-w-0 overflow-hidden">
                <Card className="flex h-full min-w-0 flex-col overflow-hidden border-border bg-card">
                  <React.Suspense fallback={<div className="grid h-full min-h-[240px] place-items-center text-sm text-muted-foreground">Loading editor…</div>}>
                    <JsonEditorPanel rawText={rawText} rawLineCount={rawLineCount} onFormat={onFormat} onPrettier={onPrettier} onMinify={onMinify} onClear={onClear} onChange={(v) => setRawText(trimJsonText(v))} extensions={[validateKeymap]} />
                  </React.Suspense>
                </Card>
              </Panel>
            ) : null}

            {showEditor ? <ResizeHandle direction="horizontal" /> : null}

            <Panel defaultSize={50} minSize={25} className="min-w-0 overflow-hidden">
              <Card className="flex h-full min-w-0 flex-col overflow-hidden border-border bg-card">
        <CardHeader className="gap-2 border-border bg-card">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 border border-border bg-background p-2">
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm">Viewer</CardTitle>
                <CardDescription className="font-mono text-[11px]">
                  {stats.nodes} nodes / {rawLineCount} lines / {sharedSize}
                </CardDescription>
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 lg:justify-end">
              <div className="inline-flex border border-border bg-background p-1">
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === "pretty" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setViewMode("pretty")}
                >
                  Pretty
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === "raw" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setViewMode("raw")}
                >
                  Raw
                </button>
              </div>

              <Button variant="outline" size="sm" onClick={() => setSortKeys((s) => !s)}>
                <ArrowDownUp />
                Sort keys: {sortKeys ? "on" : "off"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => treeApiRef.current?.expandAll()}>
                <Maximize2 /> Expand
              </Button>
              <Button variant="outline" size="sm" onClick={() => treeApiRef.current?.collapseAll()}>
                <Minimize2 /> Collapse
              </Button>
              <Button variant="secondary" size="sm" onClick={copyPrettyRaw}>
                <Clipboard /> Copy JSON
              </Button>
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="pointer-events-none -mr-9 grid h-9 w-9 place-items-center text-muted-foreground">
                <Search className="h-4 w-4" />
              </div>
              <Input
                ref={searchRef}
                className="pl-9"
                placeholder="Search keys, values, paths…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setMatchIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  navigateMatch(e.shiftKey ? -1 : 1);
                }}
              />
              <div className="hidden shrink-0 border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground md:block">
                {query.trim() ? (
                  <span>
                    {matchCount ? (
                      <span>
                        {Math.min(matchIndex + 1, matchCount)} / {matchCount}
                      </span>
                    ) : (
                      <span>No matches</span>
                    )}
                  </span>
                ) : (
                  <span>Matches</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
              <Button
                variant="outline"
                size="sm"
                disabled={!matchCount}
                onClick={() => navigateMatch(-1)}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!matchCount}
                onClick={() => navigateMatch(1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardHeader>

        {error ? (
          <div className="mx-4 mt-4 border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <div className="flex items-center gap-2 font-medium"><AlertCircle className="h-4 w-4" /> Could not parse JSON</div>
            <div className="mt-1 font-mono text-xs text-destructive/90">{error}</div>
          </div>
        ) : null}

        <CardContent className={viewMode === "raw" ? "min-h-0 flex-1 px-4 pb-4" : "min-h-0 flex-1 px-0 pb-4"}>
          {viewMode === "raw" ? (
            <VirtualizedText
              text={prettyRaw}
              className="h-full overflow-auto border-y border-border bg-[hsl(var(--canvas)/0.92)] px-4 py-3 font-mono text-sm leading-5"
              empty={<div className="text-muted-foreground">No JSON yet.</div>}
            />
          ) : !hasInput && showEditor ? (
            <div className="mx-4 my-4 grid min-h-[240px] place-items-center border border-dashed border-border bg-background p-8 text-center">
              <div>
                <FileJson2 className="mx-auto h-10 w-10 text-muted-foreground/70" />
                <div className="mt-3 text-sm text-muted-foreground">No parsed JSON.</div>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto border-t border-border px-4 pb-3 pt-3">
              <JsonTree
                value={value}
                sortKeys={sortKeys}
                query={debouncedQuery}
                activeMatchIndex={matchIndex}
                onMatchesChanged={(n) => {
                  setMatchCount(n);
                  setMatchIndex((idx) => (n === 0 ? 0 : Math.min(idx, n - 1)));
                }}
                onCopyValue={async (v) => {
                  const txt = typeof v === "string" ? v : stableStringify(v, sortKeys) ?? String(v);
                  const ok = await copyText(txt);
                  setToast(ok ? "Copy successful" : "Copy failed");
                }}
                onCopyText={async (txt) => {
                  const ok = await copyText(txt);
                  setToast(ok ? "Copy successful" : "Copy failed");
                }}
                onSelectedPathChanged={setSelectedPath}
                apiRef={treeApiRef}
              />
            </div>
          )}
        </CardContent>
                <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-3 py-2 font-mono text-xs text-muted-foreground">
                  <div className="min-w-0 truncate">
                    Path: <span className="text-foreground">{selectedPath}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const ok = await copyText(selectedPath);
                      setToast(ok ? "Copy successful" : "Copy failed");
                    }}
                    title="Copy path"
                  >
                    <Clipboard /> Copy
                  </Button>
                </div>
              </Card>
            </Panel>
          </PanelGroup>
        </Panel>

        <ResizeHandle direction="vertical" />

        <Panel defaultSize={42} minSize={18} className="min-h-0">
          <Card className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-border bg-card">
            <React.Suspense fallback={<div className="grid h-full min-h-[120px] place-items-center text-sm text-muted-foreground">Loading REPL…</div>}>
              <ReplPanel replCode={replCode} onChange={(value) => setReplCode(value)} onRun={runRepl} replLayout={replLayout} setReplLayout={setReplLayout} replResult={replResult} replError={replError} replLastRun={replLastRun} extensions={[replKeymap]} />
            </React.Suspense>
          </Card>
        </Panel>
      </PanelGroup>
    </div>
  );
}
