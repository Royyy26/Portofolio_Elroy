/**
 * POST /api/chat — Netlify Function (v2).
 *
 * Pembungkus bergaya Web API (Request -> Response). Logikanya sama persis
 * dengan versi Vercel karena keduanya memakai lib/chat-core.js.
 *
 * `config.path` di bawah membuat fungsi ini melayani /api/chat langsung, jadi
 * kode di browser tidak perlu tahu ia sedang berjalan di Netlify atau Vercel.
 *
 * Set ANTHROPIC_API_KEY di Netlify → Site configuration → Environment variables.
 */

import {
  parseMessages, rateLimited, streamAnswer,
  friendlyError, usageOf, REFUSAL_MESSAGE,
} from "../../lib/chat-core.js";

const json = (status, obj) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export default async (req, context) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  if (!process.env.ANTHROPIC_API_KEY) {
    return json(500, { error: "ANTHROPIC_API_KEY belum di-set di environment." });
  }

  const ip =
    context?.ip ||
    (req.headers.get("x-nf-client-connection-ip") ||
      (req.headers.get("x-forwarded-for") || "").split(",")[0]).trim() ||
    "unknown";

  if (rateLimited(ip)) {
    return json(429, { error: "Terlalu banyak pertanyaan. Coba lagi sebentar lagi." });
  }

  let body;
  try { body = await req.json(); } catch { body = null; }

  const parsed = parseMessages(body);
  if (!parsed.ok) return json(parsed.status, { error: parsed.error });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, data) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      try {
        const final = await streamAnswer(parsed.messages, (text) => send("delta", { text }));

        if (final.stop_reason === "refusal") {
          send("error", { message: REFUSAL_MESSAGE });
        } else {
          send("done", { stop_reason: final.stop_reason, usage: usageOf(final) });
        }
      } catch (err) {
        // Pesan internal tidak dibocorkan ke pengunjung; detailnya masuk log Netlify.
        console.error("[chat]", err?.status, err?.message);
        send("error", { message: friendlyError(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
};

export const config = { path: "/api/chat" };
