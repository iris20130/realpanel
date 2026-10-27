import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { readPanel, withDataLock, writePanel } from '@/lib/db'

interface ReorderBody {
  siteOrders: { id: string; order: number; groupId?: string }[]
}

export async function PUT(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  return withDataLock(async () => {
    try {
      const body: ReorderBody = await request.json()
      const { siteOrders } = body
      if (!Array.isArray(siteOrders)) {
        return NextResponse.json({ error: '数据格式错误' }, { status: 400 })
      }

      const data = await readPanel(user.id)
      for (const item of siteOrders) {
        const site = data.sites.find((entry) => entry.id === item.id)
        if (site) {
          site.order = Number(item.order) || 0
          if (item.groupId) site.groupId = item.groupId
          site.updatedAt = Date.now()
        }
      }

      await writePanel(user.id, data)
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Reorder sites error:', error)
      return NextResponse.json({ error: '网站排序失败' }, { status: 500 })
    }
  })
}
