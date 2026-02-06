import { useThemeStore } from "../stores/themeStore";

export default function DarkModeToggle() {
  const { dark, toggle } = useThemeStore();

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
      title={dark ? "Mode clair" : "Mode sombre"}
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
