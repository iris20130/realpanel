import { NextResponse } from 'next/server'
import { initializeAdmin } from '@/lib/auth'
import { isInitialized } from '@/lib/db'

export async function POST(request: Request) {
  try {
    if (await isInitialized()) {
      return NextResponse.json({ error: '系统已初始化' }, { status: 400 })
    }

    const body = await request.json()
    const { username, password } = body

    const result = await initializeAdmin(String(username ?? ''), String(password ?? ''))

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ token: result.token, user: result.user })
  } catch (error) {
    console.error('Init error:', error)
    return NextResponse.json({ error: '初始化失败' }, { status: 500 })
  }
}
