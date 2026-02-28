import { generateText } from 'ai'
import { createMoonshotAI } from '@ai-sdk/moonshotai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatResponse, Source } from '@naufarrel/shared'
import { SYSTEM_PROMPT } from './system-prompt'
import { searchSections, getDocumentById } from '../db/queries'

export interface AgentInput {
    userText: string
    supabase: SupabaseClient
    apiKey: string
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export async function runAgent({
    userText,
    supabase,
    apiKey,
    history = []
}: AgentInput): Promise<ChatResponse> {
    const moonshot = createMoonshotAI({ apiKey })

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
        ...history.slice(-6),
        { role: 'user' as const, content: userText }
    ]

    // Collect sources from tool calls via closure
    const collectedSources: Source[] = []
    const seenSources = new Set<string>()

    const result = await generateText({
        model: moonshot('kimi-k2.5'),
        system: SYSTEM_PROMPT,
        messages,
        tools: {
            searchDocuments: {
                description: 'Cari bagian-bagian dokumen KM ITB yang relevan dengan query. Gunakan ini saat butuh informasi spesifik dari dokumen.',
                inputSchema: z.object({
                    query: z.string().describe('Query pencarian dalam bahasa Indonesia')
                }),
                execute: async ({ query }: { query: string }) => {
                    const results = await searchSections(supabase, query, 5)
                    if (results.length === 0) {
                        return { found: false, message: 'Tidak ditemukan dokumen yang relevan.', sections: [] as Array<{ index: number; documentTitle: string; sectionTitle: string; content: string }> }
                    }
                    const sections = results.map((r, i) => {
                        const key = `${r.documentTitle}::${r.sectionTitle}`
                        if (!seenSources.has(key)) {
                            seenSources.add(key)
                            collectedSources.push({
                                index: i + 1,
                                documentTitle: r.documentTitle,
                                sectionTitle: r.sectionTitle,
                                excerpt: r.content
                            })
                        }
                        return {
                            index: i + 1,
                            documentTitle: r.documentTitle,
                            sectionTitle: r.sectionTitle,
                            content: r.content
                        }
                    })
                    return { found: true, sections }
                }
            },
            getDocumentFull: {
                description: 'Ambil isi lengkap satu dokumen berdasarkan ID. Gunakan ini saat butuh konteks lengkap, bukan potongan.',
                inputSchema: z.object({
                    documentId: z.string().describe('UUID dari dokumen')
                }),
                execute: async ({ documentId }: { documentId: string }) => {
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
            }
        }
    })

    return {
        answer: result.text,
        sources: collectedSources
    }
}
