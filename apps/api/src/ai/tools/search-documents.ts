import { tool } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { searchSections } from '../../db/queries'

export function createSearchDocumentsTool(supabase: SupabaseClient) {
    return tool({
        description: 'Cari bagian-bagian dokumen KM ITB yang relevan dengan query. Mengembalikan judul dokumen, judul bagian, dan isi konten. Gunakan ini saat butuh informasi spesifik dari dokumen.',
        parameters: z.object({
            query: z.string().describe('Query pencarian dalam bahasa Indonesia, misalnya "prosedur pengajuan kegiatan" atau "keanggotaan KM ITB"')
        }),
        execute: async ({ query }) => {
            const results = await searchSections(supabase, query, 5)
            if (results.length === 0) {
                return { found: false, message: 'Tidak ditemukan dokumen yang relevan.', sections: [] }
            }
            return {
                found: true,
                sections: results.map((r, i) => ({
                    index: i + 1,
                    documentTitle: r.documentTitle,
                    sectionTitle: r.sectionTitle,
                    content: r.content
                }))
            }
        }
    })
}
