#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

function replaceInFile(file, find, replace) {
  if (!fs.existsSync(file)) return false;
  const content = fs.readFileSync(file, "utf-8");
  const next = content.split(find).join(replace);
  if (content === next) return false;
  fs.writeFileSync(file, next, "utf-8");
  return true;
}

async function main() {
  console.log("Rename do esqueleto SaaS");
  console.log("-------------------------");
  const displayName = (await ask("Nome de exibição (ex: \"Meu SaaS\"): ")).trim();
  const pkgName = (await ask("Nome do pacote (kebab-case, ex: \"meu-saas\"): "))
    .trim();
  rl.close();

  if (!displayName || !pkgName) {
    console.error("Nome de exibição e nome do pacote são obrigatórios.");
    process.exit(1);
  }

  // package.json name
  const pkgPath = path.join(ROOT, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  pkg.name = pkgName;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");

  // shared/const.ts — APP_NAME
  replaceInFile(
    path.join(ROOT, "shared", "const.ts"),
    'export const APP_NAME = "Meu SaaS";',
    `export const APP_NAME = ${JSON.stringify(displayName)};`
  );

  // client/index.html title + description
  const htmlPath = path.join(ROOT, "client", "index.html");
  if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, "utf-8");
    html = html.replace(
      /<title>[^<]*<\/title>/,
      `<title>${displayName}</title>`
    );
    html = html.replace(
      /(name="description" content=)"[^"]*"/,
      `$1"${displayName}"`
    );
    fs.writeFileSync(htmlPath, html, "utf-8");
  }

  console.log(`\nRenomeado para "${displayName}" (pacote: ${pkgName})`);
  console.log("\nPróximos passos:");
  console.log("  1. cp .env.example .env  (e preencha)");
  console.log("  2. pnpm install");
  console.log("  3. pnpm db:push");
  console.log("  4. pnpm dev");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
