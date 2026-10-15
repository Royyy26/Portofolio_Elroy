/**
 * Logika asisten, terpisah dari pembungkus platform.
 *
 * Memakai Google Gemini lewat SDK resmi @google/genai, dijalankan di tier
 * gratis Google AI Studio. Dipilih karena biaya: tier gratis punya kuota
 * harian, jadi asisten ini tidak menagih apa pun.
 *
 * Konsekuensi yang perlu diketahui, bukan disembunyikan:
 *  - Tier gratis punya batas request per menit dan per hari. Kalau terlampaui,
 *    API mengembalikan 429 dan pengunjung diberi pesan "lagi ramai", bukan
 *    error mentah.
 *  - Syarat dan batas tier gratis ditentukan Google dan bisa berubah.
 */

import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "./profile.js";

// Flash adalah varian tercepat dan termurah, dan yang tersedia di tier gratis.
// Tugasnya cuma menjawab dari satu dokumen yang sudah diberikan — tidak butuh
// model penalaran berat.
//
// Rantai model, dicoba berurutan. Satu model saja ternyata rapuh: pada Okt 2026
// gemini-3.6-flash membalas 503 "high demand" terus-menerus, dan saat diuji
// gemini-3.5-flash-lite pun sesekali ikut 503. Model gratis bisa penuh,
// dipensiunkan (gemini-2.0 dan 2.5-flash kini 404), atau kuotanya habis —
// jadi kalau satu gagal sebelum sempat menjawab, coba yang berikutnya.
//
// thinking: model generasi 3 "berpikir" dulu dan pikirannya ikut memakan
// maxOutputTokens. Flash-lite dengan MINIMAL langsung menjawab (paling cepat).
// gemini-3.8-flash menolak MINIMAL (400) dan tetap berpikir ~115 token di LOW,
// jadi batas tokennya dilonggarkan supaya jawabannya tidak kosong.
export const MODELS = [
  { id: "gemini-3.5-flash-lite", thinking: "MINIMAL" },
  { id: "gemini-3.8-flash", thinking: "LOW", maxTokens: 1600 },
  { id: "gemini-3.1-flash-lite", thinking: "MINIMAL" },
  { id: "gemini-3.6-flash" },
];
export const MODEL = MODELS[0].id;

const MAX_TOKENS = 1000;        // jawaban chat pendek
const MAX_INPUT_CHARS = 800;    // satu pertanyaan wajar tidak sampai sepanjang ini
const MAX_HISTORY = 10;         // 5 tanya-jawab terakhir; sisanya dibuang

// Pembatas laju sederhana. Catatan jujur: memori ini per-instance, dan Vercel
// bisa menjalankan banyak instance sekaligus, jadi ini menahan spam kasar dari
// satu orang — bukan serangan sungguhan. Di tier gratis ia punya guna tambahan:
// mengurangi kemungkinan satu orang menghabiskan kuota harian.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map();

export function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start > WINDOW_MS) {
    hits.set(ip, { start: now, n: 1 });
    if (hits.size > 5000) hits.clear();   // jaga memori tidak tumbuh liar
    return false;
  }
  rec.n += 1;
  return rec.n > MAX_PER_WINDOW;
}

// Dibuat malas, bukan saat modul dimuat, supaya kunci yang belum di-set
// menghasilkan pesan yang jelas dan bukan menabrak fungsi saat start.
let client;
const getClient = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));

export const hasApiKey = () => Boolean(process.env.GEMINI_API_KEY);

/**
 * Terima hanya bentuk yang kita harapkan. Apa pun selain ini dibuang, supaya
 * klien tidak bisa menyelipkan peran atau blok konten lain ke dalam request.
 * @returns {{ok: true, messages: Array} | {ok: false, status: number, error: string}}
 */
export function parseMessages(body) {
  const history = Array.isArray(body?.messages) ? body.messages : null;
  if (!history || history.length === 0) {
    return { ok: false, status: 400, error: "Body harus berisi { messages: [...] }" };
  }

  const messages = history
    .slice(-MAX_HISTORY)
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_INPUT_CHARS) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return { ok: false, status: 400, error: "Pesan terakhir harus dari user." };
  }
  return { ok: true, messages };
}

/**
 * Jalankan jawabannya, teruskan tiap potongan teks lewat onDelta segera —
 * jangan tunggu selesai, karena itu meniadakan gunanya streaming.
 * @returns {Promise<{finishReason: string|undefined, usage: object}>}
 */
export async function streamAnswer(messages, onDelta) {
  // Gemini memakai "model" untuk giliran asisten, dan tiap giliran berisi parts.
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let lastErr;
  for (const m of MODELS) {
    let sent = false;
    try {
      const stream = await getClient().models.generateContentStream({
        model: m.id,
        contents,
        config: {
          // Profil Elroy dikirim sebagai instruksi sistem, terpisah dari percakapan,
          // supaya tidak bisa ditimpa oleh teks pengunjung.
          systemInstruction: SYSTEM_PROMPT,
          maxOutputTokens: m.maxTokens ?? MAX_TOKENS,
          temperature: 0.4,
          ...(m.thinking ? { thinkingConfig: { thinkingLevel: m.thinking } } : {}),
        },
      });

      let finishReason;
      let usage = {};
      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          sent = true;
          onDelta(text);
        }
        const cand = chunk.candidates?.[0];
        if (cand?.finishReason) finishReason = cand.finishReason;
        if (chunk.usageMetadata) usage = chunk.usageMetadata;
      }

      return {
        finishReason,
        model: m.id,
        usage: {
          input: usage.promptTokenCount ?? 0,
          output: usage.candidatesTokenCount ?? 0,
          total: usage.totalTokenCount ?? 0,
        },
      };
    } catch (err) {
      lastErr = err;
      // Setelah teks mulai terkirim, berpindah model akan menyambung dua jawaban
      // berbeda di layar pengunjung — lebih baik gagal jujur.
      if (sent || !canFallBack(err)) throw err;
      console.warn("[chat] fallback dari", m.id, err?.status ?? err?.code);
    }
  }
  throw lastErr;
}

/**
 * Pindah ke model berikutnya hanya untuk masalah ketersediaan model itu
 * sendiri. Masalah kunci (401/403) tidak, karena semua model akan gagal sama.
 */
function canFallBack(err) {
  const status = Number(err?.status ?? err?.code);
  if (status === 401 || status === 403) return false;
  if ([404, 429, 500, 502, 503, 504].includes(status)) return true;
  const text = String(err?.message ?? "");
  if (/UNAVAILABLE|RESOURCE_EXHAUSTED|NOT_FOUND|INTERNAL|high demand|overloaded/i.test(text)) return true;
  // 400 karena opsi tidak didukung model ini (mis. tingkat berpikir)
  if (status === 400 && /not supported/i.test(text)) return true;
  return false;
}

const MSG_AUTH = "Konfigurasi server belum benar. Hubungi Elroy langsung lewat email.";
const MSG_QUOTA = "Asisten sedang ramai dan kuotanya penuh. Coba lagi nanti, atau hubungi Elroy langsung lewat WhatsApp.";
const MSG_GENERIC = "Ada gangguan sebentar. Coba lagi ya.";

/** Pesan yang aman ditampilkan ke pengunjung; detail aslinya tetap di log. */
export function friendlyError(err) {
  const status = err?.status ?? err?.code;
  const text = String(err?.message ?? "");

  // Kode status lebih dulu. Pesan kuota habis dari Google kerap ikut menyebut
  // "API key" di dalamnya, jadi mencocokkan teks duluan membuat kuota penuh
  // salah dilaporkan sebagai salah konfigurasi — dan itu menyesatkan, karena
  // yang satu perlu diperbaiki Elroy, yang lain cukup ditunggu.
  if (status === 429) return MSG_QUOTA;
  if (status === 401 || status === 403) return MSG_AUTH;

  // Baru teks, untuk error yang datang tanpa kode status.
  if (/RESOURCE_EXHAUSTED|quota|rate limit/i.test(text)) return MSG_QUOTA;
  if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(text)) return MSG_AUTH;

  return MSG_GENERIC;
}

// Gemini menghentikan jawaban dengan alasan selain STOP bila kena filter keamanan
// atau menyentuh batas token.
export function refusalMessage(finishReason) {
  if (!finishReason || finishReason === "STOP") return null;
  if (finishReason === "MAX_TOKENS") return null;  // jawabannya cuma terpotong
  return "Maaf, saya tidak bisa menjawab yang itu. Coba tanya soal pengalaman atau project Elroy.";
}
