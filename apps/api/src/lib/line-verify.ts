// Verify X-Line-Signature header using HMAC-SHA256
// Uses Cloudflare Workers Web Crypto API — no Node.js crypto module needed.
// Uses crypto.subtle.verify for constant-time comparison — prevents timing attacks.

export async function verifyLineSignature(
  body: string,
  signature: string,
  channelSecret: string
): Promise<boolean> {
  // Reject empty signature immediately (no secret to leak here)
  if (!signature) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )

  // Decode the incoming base64 signature to raw bytes
  let incomingBytes: Uint8Array
  try {
    incomingBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0))
  } catch {
    return false // invalid base64 — not a valid Line signature
  }

  // crypto.subtle.verify performs a constant-time HMAC comparison internally,
  // preventing timing attacks that === string comparison is vulnerable to.
  return crypto.subtle.verify('HMAC', key, incomingBytes, encoder.encode(body))
}
