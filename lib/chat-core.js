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
// gemini-2.0-flash dipensiunkan Google dan sekarang membalas 404; API-nya
// sendiri yang menunjuk gemini-3.6-flash sebagai penggantinya. Nama model
// memang berubah dari waktu ke waktu — kalau chat tiba-tiba mati dengan 404,
// di sinilah tempat memperbaikinya.
export const MODEL = "gemini-3.6-flash";

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

  const stream = await getClient().models.generateContentStream({
    model: MODEL,
    contents,
    config: {
      // Profil Elroy dikirim sebagai instruksi sistem, terpisah dari percakapan,
      // supaya tidak bisa ditimpa oleh teks pengunjung.
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: MAX_TOKENS,
      temperature: 0.4,
    },
  });

  let finishReason;
  let usage = {};
  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) onDelta(text);
    const cand = chunk.candidates?.[0];
    if (cand?.finishReason) finishReason = cand.finishReason;
    if (chunk.usageMetadata) usage = chunk.usageMetadata;
  }

  return {
    finishReason,
    usage: {
      input: usage.promptTokenCount ?? 0,
      output: usage.candidatesTokenCount ?? 0,
      total: usage.totalTokenCount ?? 0,
    },
  };
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
