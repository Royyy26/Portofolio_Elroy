/**
 * POST /api/chat — Serverless Function untuk Vercel.
 *
 * Pembungkus tipis bergaya Node (req, res); logikanya ada di lib/chat-core.js.
 *
 * Kunci API TIDAK PERNAH menyentuh browser. Fungsi ini yang memegangnya,
 * memanggil Gemini, lalu meneruskan jawabannya ke halaman sebagai SSE. Kalau
 * kunci ditaruh di JavaScript sisi klien, siapa pun bisa membacanya lewat View
 * Source dan memakai kuotamu.
 *
 * Set GEMINI_API_KEY di Vercel → Settings → Environment Variables.
 */

import {
  parseMessages, rateLimited, streamAnswer,
  friendlyError, refusalMessage, hasApiKey,
} from "../lib/chat-core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!hasApiKey()) {
    res.status(500).json({ error: "GEMINI_API_KEY belum di-set di environment." });
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

  const parsed = parseMessages(body);
  if (!parsed.ok) {
    res.status(parsed.status).json({ error: parsed.error });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const { finishReason, usage } = await streamAnswer(
      parsed.messages,
      (text) => send("delta", { text }),
    );

    const refused = refusalMessage(finishReason);
    if (refused) {
      send("error", { message: refused });
    } else {
      send("done", { finish_reason: finishReason, usage });
    }
  } catch (err) {
    // Pesan internal tidak dibocorkan ke pengunjung; detailnya masuk log Vercel.
    console.error("[chat]", err?.status ?? err?.code, err?.message);
    send("error", { message: friendlyError(err) });
  } finally {
    res.end();
  }
}
