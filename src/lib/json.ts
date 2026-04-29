export function stableStringify(value: unknown, sortKeys: boolean) {
  const seen = new WeakSet<object>();
  return JSON.stringify(
    value,
    (_k, v) => {
      if (!sortKeys) return v;
      if (!v || typeof v !== "object") return v;
      if (seen.has(v as object)) return v;
      seen.add(v as object);
      if (Array.isArray(v)) return v;
      const obj = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(obj).sort()) out[key] = obj[key];
      return out;
    },
    2
  );
}

export function isJsonTopLevel(value: unknown): value is Record<string, unknown> | unknown[] {
  return !!value && typeof value === "object";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error);
}

export function tryParseJson(text: string): { ok: true; value: unknown; raw: string } | { ok: false; error: string } {
  const raw = (text ?? "").trim();
  if (!raw) return { ok: false, error: "Empty input" };
  if (!(raw.startsWith("{") || raw.startsWith("["))) return { ok: false, error: "Not a JSON-looking payload" };
  try {
    const value = JSON.parse(raw);
    if (!isJsonTopLevel(value)) return { ok: false, error: "Top-level JSON is not an object/array" };
    return { ok: true, value, raw };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

