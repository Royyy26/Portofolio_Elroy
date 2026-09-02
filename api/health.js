/**
 * GET /api/health — diagnosa singkat.
 *
 * Tanpa parameter: hanya melaporkan apakah kunci API ada dan model apa yang
 * dipakai. TIDAK memanggil Google, jadi tidak memakai kuota.
 *
 * Dengan ?probe=1: melakukan satu panggilan sekecil mungkin ke Gemini dan
 * melaporkan hasilnya apa adanya, termasuk pesan error dari Google. Ini yang
 * membuat kegagalan bisa didiagnosa tanpa membuka log.
 *
 * Yang TIDAK pernah dikembalikan: nilai kunci API. Hanya ada/tidaknya, dan
 * empat karakter terakhir supaya bisa dicocokkan dengan yang di dashboard.
 *
 * Hapus file ini kalau sudah tidak diperlukan.
 */

import { GoogleGenAI } from "@google/genai";
import { MODEL, rateLimited } from "../lib/chat-core.js";

export default async function handler(req, res) {
  const key = process.env.GEMINI_API_KEY;

  const info = {
    hasKey: Boolean(key),
    keyLength: key ? key.length : 0,
    keyEndsWith: key ? "..." + key.slice(-4) : null,
    keyLooksTrimmed: key ? key === key.trim() : null,
    model: MODEL,
    node: process.version,
    // Nama variabel lain yang mirip, supaya salah nama langsung ketahuan.
    // Hanya NAMA, tidak pernah nilainya.
    similarVarNames: Object.keys(process.env)
      .filter((k) => /GEMINI|GOOGLE|ANTHROPIC|API_KEY/i.test(k))
      .sort(),
  };

  // ?models=1 menanyakan ke Google model apa saja yang benar-benar bisa
  // diakses kunci ini. Menghilangkan tebak-tebakan saat nama model berubah.
  if (req.query?.models === "1" && key) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const names = [];
      const page = await ai.models.list();
      for await (const m of page) {
        const actions = m.supportedActions || m.supportedGenerationMethods || [];
        if (!actions.length || actions.includes("generateContent")) {
          names.push(m.name);
        }
        if (names.length >= 60) break;
      }
      res.status(200).json({ ...info, models: names.sort() });
    } catch (err) {
      res.status(200).json({
        ...info,
        modelsError: String(err?.message ?? "").slice(0, 500),
        modelsStatus: err?.status ?? err?.code ?? null,
      });
    }
    return;
  }

  if (req.query?.probe !== "1") {
    res.status(200).json({ ...info, hint: "tambahkan ?probe=1 untuk menguji panggilan ke Gemini" });
    return;
  }

  if (!key) {
    res.status(200).json({ ...info, probe: "dilewati: kunci belum ada" });
    return;
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) {
    res.status(429).json({ ...info, probe: "dibatasi laju" });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const r = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: "ping" }] }],
      config: { maxOutputTokens: 5 },
    });
    res.status(200).json({ ...info, probe: "ok", reply: (r.text || "").slice(0, 60) });
  } catch (err) {
    res.status(200).json({
      ...info,
      probe: "gagal",
      errorStatus: err?.status ?? err?.code ?? null,
      errorName: err?.name ?? null,
      // Pesan dari Google. Tidak memuat kunci — Google tidak mengembalikannya.
      errorMessage: String(err?.message ?? "").slice(0, 700),
    });
  }
}
