/**
 * Logika asisten, terpisah dari platform.
 *
 * Vercel memanggil fungsi dengan gaya Node (req, res); Netlify memakai gaya Web
 * API (Request -> Response). Keduanya cuma bungkus. Kalau logikanya disalin ke
 * dua tempat, cepat atau lambat keduanya berbeda tanpa disadari — jadi
 * kebenarannya disimpan di sini saja.
 */

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./profile.js";

export const MODEL = "claude-opus-5";
const MAX_TOKENS = 1200;        // jawaban chat pendek; ini juga plafon biaya per pertanyaan
const MAX_INPUT_CHARS = 800;    // satu pertanyaan wajar tidak sampai sepanjang ini
const MAX_HISTORY = 10;         // 5 tanya-jawab terakhir; sisanya dibuang

// Pembatas laju sederhana. Catatan jujur: memori ini per-instance, dan penyedia
// hosting bisa menjalankan banyak instance sekaligus, jadi ini menahan spam
// kasar dari satu orang — bukan serangan sungguhan. Untuk plafon yang
// benar-benar keras, pakai penyimpanan bersama (mis. Upstash Redis).
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

// Dibuat malas, bukan saat modul dimuat: konstruktor Anthropic melempar error
// kalau kunci belum ada, dan itu menabrak fungsi sebelum sempat mengirim pesan
// yang jelas ke pengunjung.
let client;
const getClient = () => (client ??= new Anthropic());

/**
 * Terima hanya bentuk yang kita harapkan. Apa pun selain ini dibuang, supaya
 * klien tidak bisa menyelipkan blok konten atau peran lain ke dalam request.
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
 * @returns {Promise<import("@anthropic-ai/sdk").Anthropic.Message>} pesan final
 */
export async function streamAnswer(messages, onDelta) {
  // Prompt sistem berisi seluruh profil Elroy dan tidak berubah antar request,
  // jadi di-cache. Yang berubah cuma pertanyaannya, dan itu ada setelah
  // breakpoint cache.
  const baseReq = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages,
    // Tanya-jawab pendek soal dokumen yang sudah tersedia — tidak butuh
    // penalaran dalam. Effort rendah menjawab lebih cepat dan lebih murah.
    output_config: { effort: "low" },
  };

  // Kalau permintaan ditolak filter keamanan, API menjalankan ulang permintaan
  // yang sama di model cadangan dalam panggilan yang sama, sehingga pengunjung
  // tidak melihat kegagalan.
  const withFallback = {
    ...baseReq,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  };

  const run = async (req, beta) => {
    const s = beta
      ? getClient().beta.messages.stream(req)
      : getClient().messages.stream(req);
    for await (const event of s) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        onDelta(event.delta.text);
      }
    }
    return s.finalMessage();
  };

  try {
    return await run(withFallback, true);
  } catch (err) {
    // Fitur fallback itu opsional. Kalau flag beta-nya ditolak API (400), lebih
    // baik chat tetap hidup tanpa fallback daripada mati total. 400 selalu
    // terjadi sebelum ada delta terkirim, jadi mengulang di sini aman:
    // pengunjung belum melihat teks apa pun.
    if (!(err instanceof Anthropic.BadRequestError)) throw err;
    console.warn("[chat] parameter fallback ditolak, ulangi tanpa flag beta:", err.message);
    return run(baseReq, false);
  }
}

/** Pesan yang aman ditampilkan ke pengunjung; detail aslinya tetap di log. */
export function friendlyError(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return "Konfigurasi server belum benar. Hubungi Elroy langsung lewat email.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Lagi ramai. Tunggu sebentar lalu coba lagi.";
  }
  return "Ada gangguan sebentar. Coba lagi ya.";
}

export const REFUSAL_MESSAGE =
  "Maaf, saya tidak bisa menjawab yang itu. Coba tanya soal pengalaman atau project Elroy.";

export function usageOf(final) {
  return {
    input: final.usage.input_tokens,
    output: final.usage.output_tokens,
    // Berguna saat memantau biaya: kalau cache_read tetap 0 di request
    // berulang, berarti cache prompt tidak kena.
    cache_read: final.usage.cache_read_input_tokens ?? 0,
    cache_write: final.usage.cache_creation_input_tokens ?? 0,
  };
}
