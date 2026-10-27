import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { detectSiteIcon } from '@/lib/icons'

export async function POST(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  try {
    const body = await request.json()
    const url = String(body.url ?? '').trim()
    const title = typeof body.title === 'string' ? body.title : undefined

    if (!url) return NextResponse.json({ error: '请先填写网址' }, { status: 400 })

    const result = await detectSiteIcon(url, title)
    if (!result.icon) {
      return NextResponse.json({ error: '没有识别到图标' }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('Detect icon error:', error)
    return NextResponse.json({ error: '图标识别失败' }, { status: 500 })
  }
}
