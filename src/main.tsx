import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./ui/App";
import "./styles/globals.css";

declare global {
  interface Window {
    __BJ_INITIAL_STATE__?: {
      mode?: "paste" | "inpage";
      subtitle?: string;
      rawText?: string;
      value?: unknown;
      replSandboxUrl?: string;
    };
    __BJ_REPL_SANDBOX_URL__?: string;
  }
}

function readDomInitialState() {
  const el = document.getElementById("bj-initial-state");
  if (!el?.textContent) return undefined;
  try {
    return JSON.parse(el.textContent) as Window["__BJ_INITIAL_STATE__"];
  } catch {
    return undefined;
  }
}

function inferMode(initial: Window["__BJ_INITIAL_STATE__"]): "paste" | "inpage" {
  const qs = new URLSearchParams(location.search);
  const m = qs.get("mode");
  if (m === "inpage") return "inpage";
  if (m === "paste") return "paste";
  if (initial?.mode === "inpage") return "inpage";
  return "paste";
}


function waitForPostedInitialState(timeoutMs = 1000) {
  return new Promise<Window["__BJ_INITIAL_STATE__"] | undefined>((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve(undefined);
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      // In in-page mode the viewer runs in a chrome-extension:// iframe, while
      // the content script posts from the host JSON page, so event.origin is the
      // host page origin rather than location.origin. Restrict this to our parent
      // frame instead of checking same-origin.
      if (event.source !== window.parent) return;
      if (event.data?.type !== "BJ_INITIAL_STATE") return;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(event.data.state);
    }

    window.addEventListener("message", onMessage);
  });
}

async function main() {
  const domInitial = window.__BJ_INITIAL_STATE__ ?? readDomInitialState();
  const qs = new URLSearchParams(location.search);
  const initial = domInitial ?? (qs.get("mode") === "inpage" ? await waitForPostedInitialState() : undefined) ?? {};
  if (initial.replSandboxUrl) window.__BJ_REPL_SANDBOX_URL__ = initial.replSandboxUrl;

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App
        mode={inferMode(initial)}
        subtitle={initial.subtitle}
        initialRawText={initial.rawText}
        initialValue={initial.value}
      />
    </React.StrictMode>
  );
}

void main();

