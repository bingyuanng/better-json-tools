(function () {
  "use strict";

  const root = document.getElementById("app");
  if (!root || !window.BetterJsonViewer) return;
  window.BetterJsonViewer.mountPasteTab(root);
})();

