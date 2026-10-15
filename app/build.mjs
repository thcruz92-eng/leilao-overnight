// Gera ../public/app.js a partir de src/main.jsx.
// Uso: npm run build   (ou npm run dev para recompilar a cada alteração)
import * as esbuild from "esbuild";

const opcoes = {
  entryPoints: ["src/main.jsx"],
  outfile: "../public/app.js",
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  jsx: "automatic",
  loader: { ".js": "jsx" },
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "eof",
  logLevel: "info",
};

if (process.argv.includes("--watch")) {
  const ctx = await esbuild.context(opcoes);
  await ctx.watch();
} else {
  await esbuild.build(opcoes);
}
