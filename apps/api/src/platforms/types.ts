import type { ChatResponse } from '@naufarrel/shared'

export interface PlatformMessage {
  userId: string
  text: string
  platform: 'line' | 'web'
  replyToken?: string // Line only — expires in 30 seconds
}

export interface PlatformAdapter {
  parseIncoming(raw: unknown): PlatformMessage
  formatResponse(response: ChatResponse): unknown
}
