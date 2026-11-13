import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "api/prisma/generated/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // The codebase strips keys via rest destructuring
      // (`const { id, ...rest } = row`); sibling omits are intentional.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
  {
    // No debug logging on request paths. The startup messages in index.ts
    // and the seed and dummy-data CLIs under api/prisma print on purpose.
    files: ["api/**/*.ts"],
    ignores: ["api/index.ts", "api/prisma/**"],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
);
