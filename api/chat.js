/**
 * POST /api/chat — Vercel serverless function.
 *
 * Kunci API TIDAK PERNAH menyentuh browser. Fungsi ini yang memegangnya,
 * memanggil Anthropic, lalu meneruskan jawabannya ke halaman sebagai SSE.
 * Kalau kunci ditaruh di JavaScript sisi klien, siapa pun bisa membacanya
 * lewat View Source dan memakainya atas namamu.
 *
 * Set ANTHROPIC_API_KEY di Vercel → Settings → Environment Variables.
 */

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "../lib/profile.js";

const MODEL = "claude-opus-5";
const MAX_TOKENS = 1200;        // jawaban chat pendek; ini juga plafon biaya per pertanyaan
const MAX_INPUT_CHARS = 800;    // satu pertanyaan wajar tidak sampai sepanjang ini
const MAX_HISTORY = 10;         // 5 tanya-jawab terakhir; sisanya dibuang

// Pembatas laju sederhana. Catatan jujur: memori ini per-instance, dan Vercel
// bisa menjalankan banyak instance sekaligus, jadi ini menahan spam kasar dari
// satu orang — bukan serangan sungguhan. Untuk plafon yang benar-benar keras,
// pakai penyimpanan bersama (mis. Upstash Redis) atau Vercel Firewall.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map();

function rateLimited(ip) {
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
// kalau kunci belum ada, dan itu akan menabrak fungsi sebelum sempat mengirim
// pesan yang jelas ke pengunjung.
let client;
const getClient = () => (client ??= new Anthropic());

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY belum di-set di environment." });
    return;
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (rateLimited(ip)) {
    res.status(429).json({ error: "Terlalu banyak pertanyaan. Coba lagi sebentar lagi." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }

  const history = Array.isArray(body?.messages) ? body.messages : null;
  if (!history || history.length === 0) {
    res.status(400).json({ error: "Body harus berisi { messages: [...] }" });
    return;
  }

  // Hanya terima bentuk yang kita harapkan. Apa pun selain ini dibuang, supaya
  // klien tidak bisa menyelipkan blok konten atau peran lain ke dalam request.
  const messages = history
    .slice(-MAX_HISTORY)
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_INPUT_CHARS) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    res.status(400).json({ error: "Pesan terakhir harus dari user." });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

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

  // Fitur di atas opsional. Kalau flag beta-nya ditolak API (400), lebih baik
  // chat tetap hidup tanpa fallback daripada mati total — kegagalannya dicatat
  // di log supaya ketahuan, bukan disembunyikan.
  //
  // Delta diteruskan ke pengunjung sambil stream berjalan; jangan menunggu
  // stream selesai lebih dulu, karena itu meniadakan gunanya streaming.
  const runStream = async (req, beta) => {
    const s = beta
      ? getClient().beta.messages.stream(req)
      : getClient().messages.stream(req);
    for await (const event of s) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        send("delta", { text: event.delta.text });
      }
    }
    return s.finalMessage();
  };

  try {
    let final;
    try {
      final = await runStream(withFallback, true);
    } catch (err) {
      // 400 selalu terjadi sebelum ada delta terkirim, jadi mengulang di sini
      // aman: pengunjung belum melihat teks apa pun.
      if (!(err instanceof Anthropic.BadRequestError)) throw err;
      console.warn("[chat] parameter fallback ditolak, ulangi tanpa flag beta:", err.message);
      final = await runStream(baseReq, false);
    }

    if (final.stop_reason === "refusal") {
      send("error", { message: "Maaf, saya tidak bisa menjawab yang itu. Coba tanya soal pengalaman atau project Elroy." });
    } else {
      send("done", {
        stop_reason: final.stop_reason,
        // Berguna saat memantau biaya: kalau cache_read tetap 0 di request
        // berulang, berarti cache prompt tidak kena.
        usage: {
          input: final.usage.input_tokens,
          output: final.usage.output_tokens,
          cache_read: final.usage.cache_read_input_tokens ?? 0,
          cache_write: final.usage.cache_creation_input_tokens ?? 0,
        },
      });
    }
  } catch (err) {
    // Pesan internal tidak dibocorkan ke pengunjung; detailnya masuk log Vercel.
    console.error("[chat]", err?.status, err?.message);

    let message = "Ada gangguan sebentar. Coba lagi ya.";
    if (err instanceof Anthropic.AuthenticationError) {
      message = "Konfigurasi server belum benar. Hubungi Elroy langsung lewat email.";
    } else if (err instanceof Anthropic.RateLimitError) {
      message = "Lagi ramai. Tunggu sebentar lalu coba lagi.";
    }
    send("error", { message });
  } finally {
    res.end();
  }
}
