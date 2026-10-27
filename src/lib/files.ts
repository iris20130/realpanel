import path from 'path'

export const MAX_STORED_FILE_BYTES = 50 * 1024 * 1024

const MIME_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  zip: 'application/zip',
}

const ALLOWED_UPLOAD_EXT = new Set([
  'html',
  'htm',
  'svg',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'ico',
  'pdf',
  'txt',
  'md',
  'mp4',
  'webm',
  'mp3',
  'zip',
])

export function extOf(name: string): string {
  return path.extname(name).slice(1).toLowerCase()
}

export function mimeForFile(name: string): string {
  return MIME_TYPES[extOf(name)] || 'application/octet-stream'
}

export function isAllowedUpload(name: string): boolean {
  return ALLOWED_UPLOAD_EXT.has(extOf(name))
}

// html / svg 在浏览器里直接用独立沙箱渲染，脚本可运行但拿不到面板的登录态
export function sandboxHeaders(name: string): Record<string, string> {
  const ext = extOf(name)
  if (ext !== 'html' && ext !== 'htm' && ext !== 'svg') return {}
  return {
    'Content-Security-Policy':
      "sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-pointer-lock allow-popups-to-escape-sandbox",
  }
}
