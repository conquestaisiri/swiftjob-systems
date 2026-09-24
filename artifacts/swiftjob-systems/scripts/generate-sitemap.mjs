import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const source = await readFile(path.join(root, "src/data/jobs.ts"), "utf8");
const slugs = [...source.matchAll(/^\s*slug:\s*["']([^"']+)["']/gm)]
  .map((match) => match[1])
  .filter((slug, index, all) => all.indexOf(slug) === index);
const base = "https://swiftjob.online";
const core = ["/", "/careers", "/login", "/legal", "/privacy"];
const urls = [...core, ...slugs.map((slug) => `/careers/${slug}`)];
const escapeXml = (value) => value.replace(/[<>&'\"]/g, (character) => ({
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  "'": "&apos;",
  "\"": "&quot;",
}[character]));
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escapeXml(`${base}${url}`)}</loc></url>`).join("\n")}\n</urlset>\n`;
await writeFile(path.join(root, "public/sitemap.xml"), xml);
console.log(`Generated sitemap with ${urls.length} URLs`);
