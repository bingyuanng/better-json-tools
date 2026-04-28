(() => {
  "use strict";

  const isProbablyJsonContentType = () => {
    const ct = (document.contentType || "").toLowerCase();
    return ct.includes("application/json") || ct.includes("+json");
  };

  const urlLooksJson = () => {
    try {
      const u = new URL(location.href);
      return u.pathname.toLowerCase().endsWith(".json");
    } catch {
      return location.pathname.toLowerCase().endsWith(".json");
    }
  };

  const extractRawText = () => {
    const pre = document.querySelector("pre");
    if (pre && pre.innerText) return pre.innerText;
    return document.body ? document.body.innerText || "" : "";
  };

  const tryParseJson = (text) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return { ok: false, error: "Empty response" };
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
      return { ok: false, error: "Not a JSON-looking payload" };
    }
    try {
      const value = JSON.parse(trimmed);
      if (value === null || typeof value !== "object") {
        return { ok: false, error: "Top-level JSON is not an object/array" };
      }
      return { ok: true, value, raw: trimmed };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  };

  const shouldActivate = () => {
    if (document.documentElement && document.documentElement.hasAttribute("data-bj-active")) {
      return false;
    }
    // Only try when the page is mostly text-like. (Avoid interfering with normal web apps.)
    const body = document.body;
    if (!body) return false;
    const hasComplexMarkup = body.querySelectorAll("input, textarea, select, button, canvas, video").length > 0;
    if (hasComplexMarkup) return false;
    return urlLooksJson() || isProbablyJsonContentType();
  };

  const mount = async () => {
    const rawText = extractRawText();
    const parsed = tryParseJson(rawText);
    if (!parsed.ok) {
      // If URL/content-type suggests JSON, still do a fallback parse attempt even when body has extra whitespace.
      // Otherwise, do nothing.
      if (!(urlLooksJson() || isProbablyJsonContentType())) return;
      return;
    }

    document.documentElement.setAttribute("data-bj-active", "true");

    const initialState = {
      mode: "inpage",
      subtitle: `${location.origin}${location.pathname}`,
      rawText: parsed.raw,
      value: parsed.value,
      replSandboxUrl: chrome.runtime.getURL("sandbox/repl.html"),
    };

    // Clear the page body and mount the extension viewer in an iframe.
    // This keeps the app out of the host page's CSP. Some JSON endpoints send
    // `default-src 'none'`, which blocks inline styles/style tags used by React
    // components and CodeMirror when injected directly into the page.
    document.head && (document.title = document.title || "JSON");
    document.body.innerHTML = "";

    const iframe = document.createElement("iframe");
    iframe.src = chrome.runtime.getURL("viewer.html?mode=inpage");
    iframe.setAttribute("width", "100%");
    iframe.setAttribute("height", String(Math.max(window.innerHeight, 600)));
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("title", "Better JSON Tools");
    document.body.appendChild(iframe);

    const resize = () => iframe.setAttribute("height", String(Math.max(window.innerHeight, 600)));
    window.addEventListener("resize", resize, { passive: true });

    iframe.addEventListener("load", () => {
      iframe.contentWindow?.postMessage({ type: "BJ_INITIAL_STATE", state: initialState }, chrome.runtime.getURL(""));
    });
  };

  if (shouldActivate()) {
    // Keep it responsive for large pages.
    requestAnimationFrame(() => mount().catch(() => {}));
  }
})();

