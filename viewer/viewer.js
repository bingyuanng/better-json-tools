(function () {
  "use strict";

  function createEl(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (v !== undefined && v !== null) el.setAttribute(k, String(v));
      }
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined) continue;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return el;
  }

  function stableStringify(value, sortKeys) {
    const seen = new WeakSet();
    return JSON.stringify(
      value,
      (k, v) => {
        if (!sortKeys) return v;
        if (!v || typeof v !== "object") return v;
        if (seen.has(v)) return v;
        seen.add(v);
        if (Array.isArray(v)) return v;
        const out = {};
        for (const key of Object.keys(v).sort()) out[key] = v[key];
        return out;
      },
      2
    );
  }

  function classifyValue(value) {
    if (value === null) return { type: "null", label: "null" };
    if (Array.isArray(value)) return { type: "array", label: `Array(${value.length})` };
    const t = typeof value;
    if (t === "object") return { type: "object", label: "Object" };
    if (t === "string") return { type: "string", label: "string" };
    if (t === "number") return { type: "number", label: "number" };
    if (t === "boolean") return { type: "boolean", label: "boolean" };
    return { type: "other", label: t };
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = createEl("textarea", { style: "position:fixed;left:-9999px;top:-9999px;" });
        ta.value = text;
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch {
        return false;
      }
    }
  }

  function buildNode({
    key,
    value,
    depth,
    expandedByDefault,
    onCopyValue,
    pathParts,
  }) {
    const { type } = classifyValue(value);
    const isContainer = type === "object" || type === "array";
    const line = createEl("div", { class: "bj-line" });
    const lineInner = createEl("span", { class: "bj-nodeLine" });

    const twist = createEl("span", { class: "bj-twist", text: isContainer ? "▸" : "" });
    const keyEl =
      key !== null
        ? createEl("span", { class: "bj-key", text: JSON.stringify(String(key)) })
        : null;

    const colon = key !== null ? createEl("span", { text: ":" }) : null;
    const valEl = renderInlineValue(value);
    const copyBtn = createEl("button", {
      class: "bj-copy",
      text: "Copy",
      onclick: async (e) => {
        e.preventDefault();
        e.stopPropagation();
        onCopyValue(pathParts, value);
      },
      type: "button",
    });

    if (keyEl) lineInner.append(twist, keyEl, colon, valEl, copyBtn);
    else lineInner.append(twist, valEl, copyBtn);
    line.appendChild(lineInner);

    if (!isContainer) return { line, childrenWrap: null, setExpanded() {} };

    const childrenWrap = createEl("div", { class: "bj-children" });

    let expanded = !!expandedByDefault;
    const syncTwist = () => {
      twist.textContent = expanded ? "▾" : "▸";
      childrenWrap.style.display = expanded ? "" : "none";
    };
    syncTwist();

    const toggle = () => {
      expanded = !expanded;
      syncTwist();
    };
    twist.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle();
    });

    // Build children
    if (type === "array") {
      value.forEach((child, idx) => {
        const childNode = buildNode({
          key: idx,
          value: child,
          depth: depth + 1,
          expandedByDefault: depth < 1,
          onCopyValue,
          pathParts: pathParts.concat([idx]),
        });
        if (childNode.childrenWrap) {
          childrenWrap.append(childNode.line, childNode.childrenWrap);
        } else {
          childrenWrap.append(childNode.line);
        }
      });
    } else {
      for (const k of Object.keys(value)) {
        const childNode = buildNode({
          key: k,
          value: value[k],
          depth: depth + 1,
          expandedByDefault: depth < 1,
          onCopyValue,
          pathParts: pathParts.concat([k]),
        });
        if (childNode.childrenWrap) {
          childrenWrap.append(childNode.line, childNode.childrenWrap);
        } else {
          childrenWrap.append(childNode.line);
        }
      }
    }

    return {
      line,
      childrenWrap,
      setExpanded(next) {
        expanded = next;
        syncTwist();
      },
    };
  }

  function renderInlineValue(value) {
    const { type } = classifyValue(value);
    if (type === "object") return createEl("span", { class: "bj-type", text: "{…}" });
    if (type === "array") return createEl("span", { class: "bj-type", text: "[…]" });
    if (type === "string")
      return createEl("span", { class: "bj-valString", text: JSON.stringify(value) });
    if (type === "number") return createEl("span", { class: "bj-valNumber", text: String(value) });
    if (type === "boolean")
      return createEl("span", { class: "bj-valBool", text: value ? "true" : "false" });
    if (type === "null") return createEl("span", { class: "bj-valNull", text: "null" });
    return createEl("span", { class: "bj-valNull", text: String(value) });
  }

  function mountViewerShell(root, { subtitle }) {
    root.innerHTML = "";

    const topbar = createEl("div", { class: "bj-topbar" });
    const topbarInner = createEl("div", { class: "bj-topbarInner" });
    const title = createEl("div", { class: "bj-title" }, [
      createEl("strong", { text: "Better JSON Tools" }),
      createEl("small", { text: subtitle || "JSON viewer" }),
    ]);

    const controls = createEl("div", { class: "bj-controls" });

    const search = createEl("input", {
      class: "bj-input",
      placeholder: "Search keys/values…",
      type: "search",
      autocomplete: "off",
      spellcheck: "false",
    });

    const prevBtn = createEl("button", { class: "bj-btn", text: "Prev", type: "button" });
    const nextBtn = createEl("button", { class: "bj-btn", text: "Next", type: "button" });
    const toggleModeBtn = createEl("button", {
      class: "bj-btn bj-btnPrimary",
      text: "Raw",
      type: "button",
    });
    const sortKeysBtn = createEl("button", { class: "bj-btn", text: "Sort keys: off", type: "button" });
    const expandAllBtn = createEl("button", { class: "bj-btn", text: "Expand all", type: "button" });
    const collapseAllBtn = createEl("button", { class: "bj-btn", text: "Collapse all", type: "button" });
    const copyRawBtn = createEl("button", { class: "bj-btn", text: "Copy raw", type: "button" });

    controls.append(search, prevBtn, nextBtn, toggleModeBtn, sortKeysBtn, expandAllBtn, collapseAllBtn, copyRawBtn);
    topbarInner.append(title, controls);
    topbar.append(topbarInner);

    const main = createEl("div", { class: "bj-main" });
    const viewerCard = createEl("div", { class: "bj-card" });
    const viewer = createEl("div", { class: "bj-viewer" });
    const rawCard = createEl("div", { class: "bj-card" });
    const rawTextarea = createEl("textarea", { class: "bj-textarea", spellcheck: "false" });
    rawTextarea.readOnly = true;

    viewerCard.append(viewer);
    rawCard.append(rawTextarea);
    main.append(viewerCard, rawCard);

    root.append(topbar, main);

    return {
      els: {
        search,
        prevBtn,
        nextBtn,
        toggleModeBtn,
        sortKeysBtn,
        expandAllBtn,
        collapseAllBtn,
        copyRawBtn,
        viewer,
        rawTextarea,
        rawCard,
        viewerCard,
      },
    };
  }

  function makeController(root, { subtitle }) {
    const { els } = mountViewerShell(root, { subtitle });

    let originalText = "";
    let parsedValue = null;
    let mode = "pretty"; // or raw
    let sortKeys = false;

    /** @type {{setExpanded:(b:boolean)=>void}[]} */
    let containerNodes = [];

    /** @type {HTMLElement[]} */
    let matches = [];
    let activeMatchIdx = -1;

    function setMode(nextMode) {
      mode = nextMode;
      const showRaw = mode === "raw";
      els.rawCard.style.display = showRaw ? "" : "none";
      els.viewerCard.style.display = showRaw ? "none" : "";
      els.toggleModeBtn.textContent = showRaw ? "Pretty" : "Raw";
    }

    function clearMatches() {
      for (const el of matches) el.classList.remove("bj-match", "bj-matchActive");
      matches = [];
      activeMatchIdx = -1;
    }

    function applySearch(query) {
      clearMatches();
      const q = query.trim().toLowerCase();
      if (!q) return;

      const lines = els.viewer.querySelectorAll(".bj-line");
      for (const line of lines) {
        const hay = (line.textContent || "").toLowerCase();
        if (hay.includes(q)) {
          line.classList.add("bj-match");
          matches.push(line);
        }
      }
      if (matches.length) activateMatch(0);
    }

    function activateMatch(idx) {
      if (!matches.length) return;
      const next = ((idx % matches.length) + matches.length) % matches.length;
      if (activeMatchIdx >= 0 && matches[activeMatchIdx]) {
        matches[activeMatchIdx].classList.remove("bj-matchActive");
      }
      activeMatchIdx = next;
      const el = matches[activeMatchIdx];
      el.classList.add("bj-matchActive");
      el.scrollIntoView({ block: "center" });
    }

    function renderPretty() {
      els.viewer.innerHTML = "";
      containerNodes = [];

      const onCopyValue = async (_pathParts, value) => {
        await copyText(
          typeof value === "string" ? value : stableStringify(value, sortKeys) ?? String(value)
        );
      };

      const rootNode = buildNode({
        key: null,
        value: parsedValue,
        depth: 0,
        expandedByDefault: true,
        onCopyValue,
        pathParts: [],
      });
      if (rootNode.childrenWrap) {
        // Root line is minimal; show children directly as a tree.
        els.viewer.append(rootNode.line, rootNode.childrenWrap);
      } else {
        els.viewer.append(rootNode.line);
      }

      // Collect container nodes to support expand/collapse all.
      const twists = els.viewer.querySelectorAll(".bj-twist");
      for (const t of twists) {
        // buildNode already wired each twist; we just need a cheap expand/collapse all.
        // We'll toggle by clicking: but that’s brittle. Instead, rebuild a list of nodes from DOM:
        // Keep it simple: use click simulation on twists for collapse, then expand by clicking again.
      }

      // Re-apply search after rerender
      applySearch(els.search.value || "");
    }

    function renderRaw() {
      els.rawTextarea.value = originalText;
    }

    function renderAll() {
      renderRaw();
      renderPretty();
      setMode(mode);
    }

    function setData({ text, value }) {
      originalText = text;
      parsedValue = value;
      renderAll();
    }

    function setError(message) {
      els.viewer.innerHTML = "";
      els.rawTextarea.value = originalText;
      const error = createEl("div", { class: "bj-error", text: message });
      els.viewer.append(error);
    }

    function expandCollapseAll(expand) {
      // Simple approach: walk all children sections and set display, and update twist glyph.
      const children = els.viewer.querySelectorAll(".bj-children");
      for (const c of children) c.style.display = expand ? "" : "none";
      const twists = els.viewer.querySelectorAll(".bj-twist");
      for (const t of twists) {
        if (!t.textContent) continue;
        t.textContent = expand ? "▾" : "▸";
      }
    }

    els.toggleModeBtn.addEventListener("click", () => {
      setMode(mode === "pretty" ? "raw" : "pretty");
    });
    els.copyRawBtn.addEventListener("click", async () => {
      await copyText(originalText);
    });
    els.sortKeysBtn.addEventListener("click", () => {
      sortKeys = !sortKeys;
      els.sortKeysBtn.textContent = sortKeys ? "Sort keys: on" : "Sort keys: off";
      try {
        parsedValue = JSON.parse(stableStringify(parsedValue, true));
        renderPretty();
      } catch {
        renderPretty();
      }
    });
    els.expandAllBtn.addEventListener("click", () => expandCollapseAll(true));
    els.collapseAllBtn.addEventListener("click", () => expandCollapseAll(false));

    els.search.addEventListener("input", () => applySearch(els.search.value || ""));
    els.nextBtn.addEventListener("click", () => activateMatch(activeMatchIdx + 1));
    els.prevBtn.addEventListener("click", () => activateMatch(activeMatchIdx - 1));
    els.search.addEventListener("keydown", (e) => {
      if (e.key === "Enter") activateMatch(activeMatchIdx + 1);
      if (e.key === "Escape") {
        els.search.value = "";
        applySearch("");
      }
    });

    setMode("pretty");

    return { setData, setError, els };
  }

  function mountPasteTab(root) {
    // Build a simple paste UI on top of the shared viewer shell.
    const shell = createEl("div", { class: "bj-app" });
    shell.classList.add("bj-paste");
    root.replaceWith(shell);

    const ctl = makeController(shell, { subtitle: "Paste JSON and prettify" });

    // Editor (left) + viewer (right) layout.
    const main = shell.querySelector(".bj-main");
    const viewerTopbar = shell.querySelector(".bj-topbar");
    if (viewerTopbar) viewerTopbar.classList.add("bj-viewerTopbar");

    // Keep branding pinned at the very top, but move viewer controls into the right column.
    if (viewerTopbar) {
      const title = viewerTopbar.querySelector(".bj-title");
      const brandTopbar = createEl("div", { class: "bj-topbar" });
      const brandInner = createEl("div", { class: "bj-topbarInner" });
      if (title) {
        title.remove();
        brandInner.append(title);
      }
      brandTopbar.append(brandInner);
      shell.prepend(brandTopbar);
    }

    const split = createEl("div", { class: "bj-split" });

    const leftCol = createEl("div", {});
    const rightCol = createEl("div", { style: "display:grid;gap:12px;" });

    const pasteCard = createEl("div", { class: "bj-card" });
    const pasteTa = createEl("textarea", {
      class: "bj-textarea",
      placeholder: "Paste JSON here…",
      spellcheck: "false",
    });

    const pasteActions = createEl("div", { class: "bj-topbar" });
    pasteActions.style.position = "static";
    pasteActions.style.borderBottom = "0";
    pasteActions.style.borderTop = "1px solid var(--bj-border)";

    const inner = createEl("div", { class: "bj-topbarInner" });
    const left = createEl("div", { class: "bj-title" }, [
      createEl("strong", { text: "Input" }),
      createEl("small", { text: "Paste JSON, then click Format" }),
    ]);
    const btns = createEl("div", { class: "bj-controls" });
    const formatBtn = createEl("button", { class: "bj-btn bj-btnPrimary", text: "Format", type: "button" });
    const prettierBtn = createEl("button", { class: "bj-btn", text: "Prettier", type: "button" });
    const clearBtn = createEl("button", { class: "bj-btn", text: "Clear", type: "button" });
    btns.append(formatBtn, prettierBtn, clearBtn);
    inner.append(left, btns);
    pasteActions.append(inner);

    pasteCard.append(pasteTa, pasteActions);

    // Move viewer cards into the right column, and put editor on the left.
    leftCol.append(pasteCard);
    if (viewerTopbar) rightCol.append(viewerTopbar);
    rightCol.append(ctl.els.viewerCard, ctl.els.rawCard);
    split.append(leftCol, rightCol);

    main.innerHTML = "";
    main.append(split);

    function format() {
      const text = pasteTa.value;
      try {
        const value = JSON.parse(text);
        ctl.setData({ text, value });
      } catch (e) {
        ctl.setData({ text, value: {} });
        ctl.setError(`Invalid JSON: ${e && e.message ? e.message : String(e)}`);
      }
    }

    formatBtn.addEventListener("click", format);
    prettierBtn.addEventListener("click", () => {
      const text = pasteTa.value;
      try {
        const value = JSON.parse(text);
        const pretty = JSON.stringify(value, null, 2);
        pasteTa.value = pretty + "\n";
        ctl.setData({ text: pasteTa.value, value });
      } catch (e) {
        ctl.setData({ text, value: {} });
        ctl.setError(`Invalid JSON: ${e && e.message ? e.message : String(e)}`);
      }
    });
    pasteTa.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") format();
    });
    clearBtn.addEventListener("click", () => {
      pasteTa.value = "";
      ctl.setData({ text: "", value: {} });
    });

    // Initial blank state.
    ctl.setData({ text: "", value: {} });
  }

  // Content-script entry: build viewer in the current page.
  function mountInPage({ root, subtitle, rawText, value }) {
    const ctl = makeController(root, { subtitle });
    ctl.setData({ text: rawText, value });
    return ctl;
  }

  window.BetterJsonViewer = {
    mountPasteTab,
    mountInPage,
  };
})();

