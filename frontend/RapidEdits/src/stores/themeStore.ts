import { defineStore } from "pinia";
import { ref } from "vue";

export const useThemeStore = defineStore("theme", () => {
    const isDark = ref(true);

    const initTheme = () => {
        const storedTheme = localStorage.getItem("RapidEdits_theme");
        if (storedTheme) {
            isDark.value = storedTheme === "dark";
        } else {
            // Default to dark, or check system preference?
            // User requested explicit check on launch, so defaulting to dark if null is fine
            isDark.value = true;
        }
        applyTheme();
    };

    const toggleTheme = () => {
        isDark.value = !isDark.value;
        localStorage.setItem(
            "RapidEdits_theme",
            isDark.value ? "dark" : "light",
        );
        applyTheme();
    };

    const applyTheme = () => {
        if (isDark.value) {
            document.documentElement.classList.add("dark");
            document.documentElement.classList.remove("light");
        } else {
            document.documentElement.classList.add("light");
            document.documentElement.classList.remove("dark");
        }
    };

    return {
        isDark,
        initTheme,
        toggleTheme,
    };
});
