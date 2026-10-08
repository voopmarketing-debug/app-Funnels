#!/usr/bin/env node
// Exporta cada <section class="slide"> de un HTML a PNG 1080×1350.
// Uso: node render.cjs ruta/carrusel.html [carpeta-salida]
const path = require("path");
const fs = require("fs");

function loadPlaywright() {
  try { return require("playwright"); } catch {}
  try {
    const globalRoot = require("child_process").execSync("npm root -g").toString().trim();
    return require(path.join(globalRoot, "playwright"));
  } catch {}
  console.error("No se encontró playwright. Instálalo con: npm i -D playwright");
  process.exit(1);
}

(async () => {
  const input = process.argv[2];
  if (!input) { console.error("Uso: node render.cjs carrusel.html [salida]"); process.exit(1); }
  const htmlPath = path.resolve(input);
  const outDir = path.resolve(process.argv[3] || path.dirname(htmlPath));
  fs.mkdirSync(outDir, { recursive: true });

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 1 });
  await page.goto("file://" + htmlPath, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  const slides = await page.$$(".slide");
  for (let i = 0; i < slides.length; i++) {
    const file = path.join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
    await slides[i].screenshot({ path: file });
    console.log(file);
  }
  await browser.close();
})();
