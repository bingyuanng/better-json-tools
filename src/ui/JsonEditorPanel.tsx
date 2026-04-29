import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Prec } from "@codemirror/state";
import { tags } from "@lezer/highlight";
import { EditorView, keymap } from "@codemirror/view";
import { json } from "@codemirror/lang-json";
import { CheckCircle2, Eraser, RemoveFormatting, Sparkles, Code2, AlertCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

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

export function JsonEditorPanel({
  rawText,
  rawLineCount,
  onFormat,
  onPrettier,
  onMinify,
  onClear,
  onChange,
  extensions = [],
}: {
  rawText: string;
  rawLineCount: number;
  onFormat: () => void;
  onPrettier: () => void;
  onMinify: () => void;
  onClear: () => void;
  onChange: (value: string) => void;
  extensions?: unknown[];
}) {
  return (
    <>
      <CardHeader className="gap-2 border-border bg-card">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="flex min-w-0 items-start gap-3">
            <div className="border border-border bg-background p-2 text-muted-foreground"><Code2 className="h-4 w-4" /></div>
            <div className="min-w-0"><CardTitle className="text-sm">Editor</CardTitle><CardDescription className="font-mono text-[11px]">⌘/Ctrl + Enter validate</CardDescription></div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button onClick={onFormat}><CheckCircle2 /> Validate</Button>
            <Button variant="secondary" onClick={onPrettier}><Sparkles /> Prettify</Button>
            <Button variant="secondary" onClick={onMinify}><RemoveFormatting /> Minify</Button>
            <Button variant="ghost" onClick={onClear}><Eraser /> Clear</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <div className="flex h-full min-h-0 flex-col overflow-hidden border-t border-border bg-[hsl(var(--canvas)/0.92)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span>Input Buffer</span><span>{rawLineCount} lines</span>
          </div>
          <CodeMirror className="bj-cm" value={rawText} height="100%" basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, highlightActiveLineGutter: true }} extensions={[json(), ...codeMirrorExtensions, ...extensions, Prec.highest(keymap.of([]))]} theme={codeMirrorTheme} placeholder="Paste JSON here..." onChange={onChange} />
        </div>
      </CardContent>
    </>
  );
}
