import { createRouter } from "./router.js";
import { initTheme } from "./theme.js";
import { initCommandPalette } from "./command-palette.js";
import { createIcons } from "https://esm.sh/lucide@0.475.0";
import * as icons from "https://esm.sh/lucide@0.475.0";
function refreshIcons() {
  createIcons({
    icons,
    nameAttr: "data-lucide"
  });
}
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  refreshIcons();
  const router = createRouter();
  initCommandPalette(router);
});
export {
  refreshIcons
};
