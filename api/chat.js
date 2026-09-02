/**
 * POST /api/chat — Serverless Function untuk Vercel.
 *
 * Ini hanya pembungkus bergaya Node (req, res). Logikanya ada di
 * lib/chat-core.js dan dipakai bersama dengan versi Netlify.
 *
 * Kunci API TIDAK PERNAH menyentuh browser. Fungsi ini yang memegangnya,
 * memanggil Anthropic, lalu meneruskan jawabannya ke halaman sebagai SSE.
 * Kalau kunci ditaruh di JavaScript sisi klien, siapa pun bisa membacanya
 * lewat View Source dan memakainya atas namamu.
 *
 * Set ANTHROPIC_API_KEY di Vercel → Settings → Environment Variables.
 */

import {
  parseMessages, rateLimited, streamAnswer,
  friendlyError, usageOf, REFUSAL_MESSAGE,
} from "../lib/chat-core.js";

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
    const final = await streamAnswer(parsed.messages, (text) => send("delta", { text }));

    if (final.stop_reason === "refusal") {
      send("error", { message: REFUSAL_MESSAGE });
    } else {
      send("done", { stop_reason: final.stop_reason, usage: usageOf(final) });
    }
  } catch (err) {
    // Pesan internal tidak dibocorkan ke pengunjung; detailnya masuk log Vercel.
    console.error("[chat]", err?.status, err?.message);
    send("error", { message: friendlyError(err) });
  } finally {
    res.end();
  }
}
