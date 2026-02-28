import type { PlatformMessage, PlatformAdapter } from './types'
import type { ChatResponse } from '@naufarrel/shared'

// Line webhook event shape (simplified — only handling text messages)
interface LineTextEvent {
  type: 'message'
  message: { type: 'text'; text: string }
  source: { userId: string }
  replyToken: string
}

interface LineWebhookBody {
  events: LineTextEvent[]
}

export const lineAdapter: PlatformAdapter = {
  parseIncoming(raw: unknown): PlatformMessage {
    const body = raw as LineWebhookBody
    const event = body.events[0]
    if (!event || event.type !== 'message' || event.message.type !== 'text') {
      throw new Error('Unsupported Line event type')
    }
    return {
      userId: event.source.userId,
      text: event.message.text,
      platform: 'line',
      replyToken: event.replyToken
    }
  },

  formatResponse(response: ChatResponse): object {
    // Format citations as appended source list
    let text = response.answer

    if (response.sources.length > 0) {
      text += '\n\n📄 Sumber:'
      response.sources.forEach((src) => {
        text += `\n[${src.index}] ${src.documentTitle} — ${src.sectionTitle}`
      })
    }

    return {
      type: 'text',
      text
    }
  }
}
