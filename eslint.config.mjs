import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Architecture rule: UI must not reach into the data layer directly.
    // Components / pages talk to services (via useApp), never to repositories or storage.
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/data", "@/lib/data/*", "@/lib/data/**"],
              message: "UI must not import the data layer. Go through a service (UI → Service → Repository → Data).",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/sw.js", "scripts/sw.template.js"]),
]);

export default eslintConfig;
