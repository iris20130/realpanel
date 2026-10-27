import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'

export async function GET(request: Request) {
  const user = await verifyAuth(request)
  if (!user) {
    return NextResponse.json({ error: '未登录或登录已过期' }, { status: 401 })
  }
  return NextResponse.json(user)
}
