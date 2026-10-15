/**
 * SEMENTARA — diagnosis asisten AI yang gagal di produksi. Hapus setelah selesai.
 *
 * Log runtime Vercel tidak bisa dibaca dari sini (403 di paket Hobby), jadi
 * endpoint ini memanggil Gemini sekali dengan prompt kecil dan mengembalikan
 * kode status + alasan dari Google. Tidak ada informasi kunci API yang
 * dikembalikan, sebagian pun tidak.
 */
import { GoogleGenAI } from "@google/genai";
import { MODEL } from "../lib/chat-core.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.query?.probe !== "1") {
    res.status(200).json({ ok: true, model: MODEL });
    return;
  }

  const out = { model: MODEL, hasKey: Boolean(process.env.GEMINI_API_KEY) };
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const r = await ai.models.generateContent({
      model: MODEL,
      contents: "ping",
      config: { maxOutputTokens: 5 },
    });
    out.probe = "ok";
    out.sample = String(r?.text ?? "").slice(0, 40);
  } catch (err) {
    out.probe = "gagal";
    out.status = err?.status ?? err?.code ?? null;
    const raw = String(err?.message ?? "");
    try {
      const j = JSON.parse(raw);
      out.googleStatus = j?.error?.status ?? null;
      out.reason = (j?.error?.details ?? []).map((d) => d?.reason).filter(Boolean);
      out.message = String(j?.error?.message ?? "").slice(0, 300);
    } catch {
      out.message = raw.slice(0, 300);
    }
  }
  res.status(200).json(out);
}
