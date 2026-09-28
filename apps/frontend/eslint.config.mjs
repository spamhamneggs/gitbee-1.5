import effect from "eslint-plugin-react-you-might-not-need-an-effect";
import eslintReact from "@eslint-react/eslint-plugin";
import next from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  // Port of the old `next lint` default (`next/core-web-vitals`):
  // React + Hooks recommended plus the Next.js rules, with
  // eslint-plugin-react replaced by its successor. The `-typescript`
  // preset already drops rules TypeScript enforces, and there are no
  // overlapping rules with the hooks preset.
  eslintReact.configs["recommended-typescript"],
  reactHooks.configs.flat.recommended,
  // Both presets ship their own rules-of-hooks, exhaustive-deps, etc.;
  // keep eslint-react's copies so each finding is reported once.
  eslintReact.configs["disable-conflict-eslint-plugin-react-hooks"],
  next.configs["core-web-vitals"],
  // Every effect rule as an error.
  effect.configs.strict,
  {
    // The effect preset targets ts/tsx too, but its default parser is
    // espree, which cannot parse TypeScript syntax.
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    languageOptions: {
      parser: tseslint.parser,
    },
  },
];
