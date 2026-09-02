function initTheme() {
  const toggleBtn = document.getElementById("theme-toggle");
  const lightIcon = document.querySelector(".theme-icon-light");
  const darkIcon = document.querySelector(".theme-icon-dark");
  const savedTheme = localStorage.getItem("byteforge-theme");
  // Default dark unless user explicitly chose light
  let isLight = savedTheme === "light";
  const applyTheme = () => {
    if (isLight) {
      document.documentElement.classList.add("light");
      lightIcon?.classList.remove("hidden");
      darkIcon?.classList.add("hidden");
    } else {
      document.documentElement.classList.remove("light");
      lightIcon?.classList.add("hidden");
      darkIcon?.classList.remove("hidden");
    }
  };
  applyTheme();
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      isLight = !isLight;
      localStorage.setItem("byteforge-theme", isLight ? "light" : "dark");
      applyTheme();
    });
  }
}
export { initTheme };
