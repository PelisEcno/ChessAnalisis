import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Fase 0: core todavía no exporta nada, por lo que no hay tests que
    // escribir. Quitar esto en cuanto se agregue la primera función pública.
    passWithNoTests: true,
  },
});
