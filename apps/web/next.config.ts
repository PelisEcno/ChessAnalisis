import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // packages/core ships raw TypeScript (no build step), so Next needs to
  // transpile it itself instead of treating it as pre-built.
  transpilePackages: ["@peon-libre/core"],

  webpack(config) {
    // packages/core importa entre sus propios módulos con extensión ".js"
    // (la convención correcta de TS para ESM), pero esos archivos son .ts.
    // tsc y Vite lo resuelven solos; el webpack de Next no, así que hay que
    // decirle explícitamente que pruebe .ts/.tsx cuando ve un import ".js".
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },

  // Stockfish corre en WASM con hilos vía SharedArrayBuffer, que los
  // navegadores solo exponen en páginas "cross-origin isolated". COOP+COEP
  // son los dos headers que activan ese aislamiento; sin ellos el motor cae
  // a un build monohilo mucho más lento (ver apps/web/src/engine más adelante).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
