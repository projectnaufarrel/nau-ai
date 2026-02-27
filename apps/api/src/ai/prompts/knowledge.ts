export function buildKnowledgePrompt(
  sources: Array<{ sectionTitle: string; documentTitle: string; content: string }>,
  userQuestion: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): string {
  const sourcesBlock = sources
    .map((s, i) => `[${i + 1}] ${s.documentTitle} — ${s.sectionTitle}\n${s.content}`)
    .join('\n\n')

  const historyBlock = history.length > 0
    ? '\nRIWAYAT PERCAKAPAN:\n' + history
        .slice(-6) // last 3 exchanges to keep context manageable
        .map(h => `${h.role === 'user' ? 'Pengguna' : 'Asisten'}: ${h.content}`)
        .join('\n') + '\n'
    : ''

  return `Kamu adalah asisten pengetahuan untuk KM ITB (Keluarga Mahasiswa Institut Teknologi Bandung).
Jawab pertanyaan mahasiswa berdasarkan sumber-sumber berikut.
Gunakan bahasa Indonesia yang ramah dan jelas.

PENTING: Sertakan kutipan inline menggunakan format [src:N] di mana N adalah nomor sumber.
Contoh: "Pengajuan kegiatan harus dilakukan minimal 14 hari sebelumnya [src:1]."
Hanya kutip sumber yang benar-benar relevan dengan jawabanmu.

SUMBER-SUMBER:
${sourcesBlock}
${historyBlock}
PERTANYAAN PENGGUNA:
${userQuestion}

Jawab berdasarkan sumber di atas. Jika tidak ada informasi yang relevan, sampaikan dengan jujur.`
}
