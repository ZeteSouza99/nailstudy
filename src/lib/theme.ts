export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "nail-agenda-theme";

// Executado no head antes da pintura: evita um clarão do tema claro ao recarregar.
// O conteúdo é fixo e não recebe dados do usuário.
export const themeScript = `(() => {
  let theme;
  try { theme = localStorage.getItem("${THEME_STORAGE_KEY}"); } catch {}
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.dataset.theme = theme;
})();`;
