import type { PlatformMessage, PlatformAdapter } from './types'
import type { ChatResponse } from '@naufarrel/shared'

// Web adapter: passes full structured ChatResponse as-is (citations + sources for sidebar)
export const webAdapter: PlatformAdapter = {
  parseIncoming(raw: unknown): PlatformMessage {
    const body = raw as { message: string; userId?: string; conversationId?: string }
    return {
      userId: body.userId ?? 'anonymous',
      text: body.message,
      platform: 'web'
    }
  },

  formatResponse(response: ChatResponse): ChatResponse {
    // Web gets the full structured response — frontend handles citation rendering
    return response
  }
}
