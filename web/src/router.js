import { refreshIcons } from "./main.js";
import { renderHome } from "./pages/home.js";
import { renderConverter } from "./pages/converter.js";
import { renderEditor } from "./pages/editor.js";
import { renderSvg } from "./pages/svg.js";
import { renderPdf } from "./pages/pdf.js";
import { renderPlaceholder } from "./pages/placeholder.js";
const routes = [
  { path: "/", id: "home", icon: "home", label: "Home", render: renderHome },
  { path: "/converter", id: "convert", icon: "arrow-right-left", label: "Convert", render: renderConverter },
  { path: "/editor", id: "code", icon: "code", label: "Code", render: renderEditor },
  { path: "/svg", id: "svg", icon: "pen-tool", label: "SVG", render: renderSvg },
  { path: "/pdf", id: "pdf", icon: "file-text", label: "PDF", render: renderPdf },
  { path: "/rss", id: "rss", icon: "rss", label: "RSS", render: () => renderPlaceholder("RSS Reader") },
  { path: "/bytebeat", id: "beat", icon: "music", label: "Beat", render: () => renderPlaceholder("Bytebeat Composer") },
  { path: "/settings", id: "settings", icon: "settings", label: "Settings", render: () => renderPlaceholder("Settings") }
];
function createRouter() {
  const mainContent = document.getElementById("main-content");
  const navLinksContainer = document.getElementById("nav-links");
  if (!mainContent || !navLinksContainer) return;
  const navRoutes = routes.filter((r) => r.id !== "settings");
  navLinksContainer.innerHTML = navRoutes.map((route) => `
    <a href="${route.path}" class="nav-item group w-full flex flex-col items-center justify-center p-2 text-muted hover:text-fg transition-colors" data-path="${route.path}">
      <div class="icon-wrapper w-10 h-10 flex items-center justify-center rounded-xl transition-colors group-hover:bg-hover">
        <i data-lucide="${route.icon}" class="w-5 h-5"></i>
      </div>
      <span class="text-[10px] font-medium mt-1">${route.label}</span>
    </a>
  `).join("");
  const navigate = (path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
    const route = routes.find((r) => r.path === path) || routes[0];
    document.querySelectorAll(".nav-item").forEach((el) => {
      const wrapper = el.querySelector(".icon-wrapper");
      if (el.getAttribute("data-path") === path || path === "/" && el.getAttribute("href") === "/") {
        el.classList.add("active");
        el.classList.remove("text-muted");
        wrapper?.classList.add("bg-active");
        wrapper?.classList.remove("group-hover:bg-hover");
      } else {
        el.classList.remove("active");
        el.classList.add("text-muted");
        wrapper?.classList.remove("bg-active");
        wrapper?.classList.add("group-hover:bg-hover");
      }
    });
    mainContent.innerHTML = '<div id="page-wrapper" class="page-transition-enter w-full min-h-full p-6 md:p-12"></div>';
    const pageWrapper = document.getElementById("page-wrapper");
    if (pageWrapper) {
      requestAnimationFrame(() => {
        route.render(pageWrapper);
        refreshIcons();
        requestAnimationFrame(() => {
          pageWrapper.classList.add("page-transition-enter-active");
        });
      });
    }
  };
  document.body.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (link && link.getAttribute("href")?.startsWith("/")) {
      e.preventDefault();
      navigate(link.getAttribute("href"));
    }
  });
  window.addEventListener("popstate", () => {
    navigate(window.location.pathname);
  });
  navigate(window.location.pathname);
  return { navigate, routes };
}
export {
  createRouter,
  routes
};
