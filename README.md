# Responsive Portfolio Website Patrick
## [Watch it on youtube](https://youtu.be/Y4-xMb-eHOQ)
### Responsive Portfolio Website Patrick

- Responsive Portfolio Website Design Using HTML CSS & JavaScript
- Contains animations when scrolling.
- Smooth scrolling in each section.
- Contains a beautiful dark theme.
- The color of the project can be customized.
- Sending emails in the contact section.
- Developed first with the Mobile First methodology, then for desktop.
- Compatible with all mobile devices and with a beautiful and pleasant user interface.

💙 Join the channel to see more videos like this. [Bedimcode](https://www.youtube.com/@Bedimcode)

![preview img](assets/img/og-image.png)

## AI Assistant

Widget chat di pojok kanan bawah menjawab pertanyaan tentang Elroy — pengalaman,
project, keahlian, ketersediaan. Ditenagai **Google Gemini** lewat sebuah
serverless function, dijalankan di **tier gratis** Google AI Studio.

### Struktur

| File | Isi |
|---|---|
| `lib/profile.js` | Basis pengetahuan + prompt sistem. **Satu-satunya file yang perlu diubah** saat ada pekerjaan/project/sertifikat baru. |
| `lib/chat-core.js` | Logika: validasi, pembatas laju, panggilan Gemini, penanganan error. |
| `api/chat.js` | Pembungkus Vercel: memegang kunci API, streaming SSE ke browser. |

Kunci API tidak pernah dikirim ke browser. Kalau ditaruh di JavaScript sisi
klien, siapa pun bisa membacanya lewat View Source dan memakai kuotamu.

### Setup

1. Ambil kunci API gratis di https://aistudio.google.com/apikey
2. Vercel → project → Settings → Environment Variables → tambah `GEMINI_API_KEY`
3. Redeploy

Untuk dev lokal: `npm install`, buat file `.env` berisi `GEMINI_API_KEY=...`
(sudah masuk `.gitignore`), lalu `npx vercel dev`.

Preview statis biasa (`python -m http.server`) tidak menjalankan serverless
function — widget-nya akan bilang asisten cuma aktif di versi ter-deploy. Itu
normal.

### Batasan yang sudah dipasang

- Maks 8 pertanyaan per menit per IP (per-instance; menahan spam kasar dan
  mengurangi risiko satu orang menghabiskan kuota harian)
- Maks 800 karakter per pertanyaan, 10 pesan riwayat terakhir
- `maxOutputTokens` 1000 — jawaban chat pendek
- Model `gemini-2.0-flash`

### Soal tier gratis

Tier gratis punya batas request per menit dan per hari, dan syaratnya
ditentukan Google — bisa berubah sewaktu-waktu. Kalau kuota habis, pengunjung
mendapat pesan yang menyarankan menghubungi Elroy lewat WhatsApp, bukan error
mentah.
