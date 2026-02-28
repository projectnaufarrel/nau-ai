import { tool } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getDocumentById } from '../../db/queries'

export function createGetDocumentFullTool(supabase: SupabaseClient) {
    return tool({
        description: 'Ambil isi lengkap satu dokumen berdasarkan ID-nya. Gunakan ini saat butuh konteks lengkap dari suatu dokumen, bukan hanya potongan. Kamu bisa mendapatkan document ID dari hasil searchDocuments.',
        parameters: z.object({
            documentId: z.string().describe('UUID dari dokumen yang ingin diambil')
        }),
        execute: async ({ documentId }) => {
            const doc = await getDocumentById(supabase, documentId)
            if (!doc) {
                return { found: false, message: 'Dokumen tidak ditemukan.' }
            }
            return {
                found: true,
                title: doc.title,
                type: doc.docType,
                fullContent: doc.sections
                    .sort((a, b) => a.sectionOrder - b.sectionOrder)
                    .map(s => `## ${s.sectionTitle}\n${s.content}`)
                    .join('\n\n')
            }
        }
    })
}
