/**
 * Menyusun folder dist/ berisi HANYA berkas yang memang untuk publik.
 *
 * Kenapa perlu: Netlify menyajikan seluruh isi publish directory sebagai berkas
 * statis. Kalau publish diarahkan ke root repo, maka lib/profile.js — yang
 * memuat seluruh system prompt dan profil Elroy — bisa dibuka siapa pun lewat
 * URL. Begitu juga api/chat.js, package.json, dan arsip gambar 6 MB.
 *
 * Vercel tidak butuh ini (ia menyajikan statis + mengompilasi /api sendiri),
 * jadi skrip ini khusus untuk jalur Netlify.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

// Hanya ini yang boleh tersaji publik.
const INCLUDE = ["index.html", "favicon.ico", "robots.txt", "site.webmanifest", "assets"];

// Arsip resolusi penuh: disimpan di repo sebagai cadangan, tidak perlu online.
const EXCLUDE_DIRS = new Set(["original"]);
// Sumber CV yang bisa diedit; yang dipublikasikan cukup PDF-nya.
const EXCLUDE_EXT = new Set([".docx"]);

let files = 0;
let bytes = 0;

function copy(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (EXCLUDE_DIRS.has(path.basename(src))) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) copy(path.join(src, entry), path.join(dest, entry));
    return;
  }
  if (EXCLUDE_EXT.has(path.extname(src).toLowerCase())) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  files += 1;
  bytes += stat.size;
}

fs.rmSync(DIST, { recursive: true, force: true });
for (const item of INCLUDE) {
  const src = path.join(ROOT, item);
  if (!fs.existsSync(src)) {
    console.error(`build-static: ${item} tidak ditemukan`);
    process.exit(1);
  }
  copy(src, path.join(DIST, item));
}

// Jaring pengaman: kalau suatu saat INCLUDE diubah dan tanpa sadar
// memasukkan kode server, build harus berhenti — bukan diam-diam mempublikasi.
const leaked = [];
(function scan(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (fs.statSync(p).isDirectory()) { scan(p); continue; }
    const rel = path.relative(DIST, p).replace(/\\/g, "/");
    if (/^(api|lib|netlify|scripts|node_modules)\//.test(rel) || /^\.env/.test(rel)) leaked.push(rel);
  }
})(DIST);

if (leaked.length) {
  console.error("build-static: kode server ikut masuk dist/ —", leaked.join(", "));
  process.exit(1);
}

console.log(`build-static: ${files} berkas, ${(bytes / 1048576).toFixed(2)} MB -> dist/`);
