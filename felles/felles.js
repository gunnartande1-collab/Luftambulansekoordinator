/* Felles dag- og kveldsmodus med hukommelse mellom sidene. */
(() => {
  const root = document.documentElement;
  const storageKey = "luftambulansekoordinator-theme";

  let savedTheme = "light";

  try {
    if (sessionStorage.getItem(storageKey) === "dark") {
      savedTheme = "dark";
    }
  } catch {
    // Dagmodus brukes dersom nettleseren blokkerer lagring.
  }

  root.dataset.theme = savedTheme;

  function initialiseThemeToggle() {
    const button = document.getElementById("themeToggle");

    if (!button) {
      return;
    }

    const icon = button.querySelector(".theme-toggle-icon");
    const text = button.querySelector(".theme-toggle-text");

    function updateThemeButton() {
      const isDark = root.dataset.theme === "dark";

      button.setAttribute("aria-pressed", String(isDark));
      button.setAttribute(
        "aria-label",
        isDark ? "Slå på dagmodus" : "Slå på kveldsmodus"
      );

      if (icon) {
        icon.textContent = isDark ? "☀️" : "🌙";
      }

      if (text) {
        text.textContent = isDark ? "Dagmodus" : "Kveldsmodus";
      }
    }

    button.addEventListener("click", () => {
      const theme =
        root.dataset.theme === "dark" ? "light" : "dark";

      root.dataset.theme = theme;

      try {
        sessionStorage.setItem(storageKey, theme);
      } catch {
        // Knappen fungerer fortsatt på den åpne siden.
      }

      updateThemeButton();
    });

    // Oppdater også hvis siden gjenopprettes med tilbakeknappen.
    window.addEventListener("pageshow", () => {
      try {
        root.dataset.theme =
          sessionStorage.getItem(storageKey) === "dark"
            ? "dark"
            : "light";
      } catch {
        // Behold gjeldende tema.
      }

      updateThemeButton();
    });

    updateThemeButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialiseThemeToggle
    );
  } else {
    initialiseThemeToggle();
  }
})();