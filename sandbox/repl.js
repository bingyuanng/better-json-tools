window.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.type !== "bj-repl-run") return;

  try {
    const code = String(message.code || "");
    const logs = [];
    const captureLog = (...args) => {
      logs.push(args.length === 1 ? args[0] : args);
      return undefined;
    };
    const replConsole = {
      log: captureLog,
      info: captureLog,
      warn: captureLog,
      error: captureLog,
    };
    const fn = new Function(
      "__bjData",
      "console",
      `"use strict"; const data = __bjData; globalThis.data = __bjData; return (async () => { ${code} })();`
    );
    Promise.resolve(fn(message.value, replConsole))
      .then((result) => {
        event.source.postMessage({ type: "bj-repl-result", id: message.id, ok: true, result, logs }, "*");
      })
      .catch((error) => {
        event.source.postMessage(
          {
            type: "bj-repl-result",
            id: message.id,
            ok: false,
            error: error && error.message ? error.message : String(error),
          },
          "*"
        );
      });
  } catch (error) {
    event.source.postMessage(
      {
        type: "bj-repl-result",
        id: message.id,
        ok: false,
        error: error && error.message ? error.message : String(error),
      },
      "*"
    );
  }
});
