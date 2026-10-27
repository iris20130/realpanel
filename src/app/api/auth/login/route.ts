import { NextResponse } from 'next/server'
import { login } from '@/lib/auth'
import { isInitialized } from '@/lib/db'

export async function POST(request: Request) {
  try {
    if (!(await isInitialized())) {
      return NextResponse.json({ error: '系统尚未初始化' }, { status: 400 })
    }

    const body = await request.json()
    const username = String(body.username ?? '')
    const password = String(body.password ?? '')

    if (!username || !password) {
      return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 })
    }

    const result = await login(username, password)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 })
    }

    return NextResponse.json({ token: result.token, user: result.user })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: '登录失败' }, { status: 500 })
  }
}
