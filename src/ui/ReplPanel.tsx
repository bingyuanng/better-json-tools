import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Prec } from "@codemirror/state";
import { tags } from "@lezer/highlight";
import { EditorView, keymap } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { Columns2, Rows2, Code2 } from "lucide-react";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import { Button } from "../components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { VirtualizedText } from "./virtualizedText";

const style = HighlightStyle.define([{ tag: [tags.keyword], color: "#81a1c1" }]);
const theme = EditorView.theme({}, { dark: true });
const ext = [Prec.highest(syntaxHighlighting(style, { fallback: true }))];

export function ReplPanel({
  replCode,
  onChange,
  onRun,
  replLayout,
  setReplLayout,
  replResult,
  replError,
  replLastRun,
  extensions = [],
}: {
  replCode: string;
  onChange: (value: string) => void;
  onRun: () => void;
  replLayout: "vertical" | "horizontal";
  setReplLayout: React.Dispatch<React.SetStateAction<"vertical" | "horizontal">>;
  replResult: string;
  replError: string | null;
  replLastRun: { at: number; ok: boolean } | null;
  extensions?: unknown[];
}) {
  return <>
    <CardHeader className="gap-2 border-border bg-card"><div className="flex min-w-0 items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><div className="border border-border bg-background p-2 text-muted-foreground"><Code2 className="h-4 w-4" /></div><div className="min-w-0"><CardTitle className="text-sm">REPL</CardTitle><CardDescription className="font-mono text-[11px]">JSON is available as const data</CardDescription></div></div><Button variant="outline" size="sm" onClick={() => setReplLayout((l) => (l === "vertical" ? "horizontal" : "vertical"))}>{replLayout === "vertical" ? <Columns2 /> : <Rows2 />}</Button></div></CardHeader>
    <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4"><PanelGroup orientation={replLayout === "horizontal" ? "horizontal" : "vertical"} className="min-h-0 flex-1"><Panel defaultSize={55} minSize={25} className="min-h-0 min-w-0"><div className="h-full min-h-[120px] overflow-auto border border-border bg-[hsl(var(--canvas)/0.92)] text-sm focus-within:border-ring"><CodeMirror className="bj-cm" value={replCode} height="100%" basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false }} extensions={[javascript(), ...ext, ...extensions, keymap.of([])]} theme={theme} onChange={onChange} /></div></Panel><PanelResizeHandle className={replLayout === "horizontal" ? "group flex w-4 items-center justify-center" : "group flex h-4 items-center justify-center"}><div className={replLayout === "horizontal" ? "h-12 w-1 bg-border transition-colors group-hover:bg-primary" : "h-1 w-12 bg-border transition-colors group-hover:bg-primary"} /></PanelResizeHandle><Panel defaultSize={45} minSize={20} className="min-h-0 min-w-0"><div className="h-full min-h-[80px] overflow-auto">{replError ? <pre className="h-full overflow-auto border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">{replError}</pre> : replResult ? <VirtualizedText text={replResult} wrap className="h-full overflow-auto border border-border bg-[hsl(var(--canvas)/0.92)] px-3 py-2 font-mono text-xs leading-5" empty={null} /> : <div className="grid h-full min-h-20 place-items-center border border-dashed border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">Result appears here</div>}</div></Panel></PanelGroup><div className="flex shrink-0 items-center justify-between gap-3"><div className="font-mono text-[11px] text-muted-foreground">{replLastRun ? <span>Last run {new Date(replLastRun.at).toLocaleTimeString()} · {replLastRun.ok ? "success" : "error"}</span> : <span>Press ⌘/Ctrl + Enter to run</span>}</div><Button variant="secondary" size="sm" onClick={onRun}>Run</Button></div></CardContent>
  </>;
}
