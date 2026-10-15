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

  // hanya model dari daftar ini yang boleh diuji, supaya endpoint tak bisa dipakai sembarangan
  const BOLEH = [MODEL, "gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash"];
  const model = BOLEH.includes(req.query?.model) ? req.query.model : MODEL;
  const out = { model, hasKey: Boolean(process.env.GEMINI_API_KEY) };
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const r = await ai.models.generateContent({
      model,
      contents: "Say hello to a portfolio visitor in five words.",
      config: {
        maxOutputTokens: 120,
        ...(req.query?.think ? { thinkingConfig: { thinkingLevel: String(req.query.think).toUpperCase() } } : {}),
      },
    });
    out.probe = "ok";
    out.sample = String(r?.text ?? "").slice(0, 60);
    out.usage = r?.usageMetadata ?? null;
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
