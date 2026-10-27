import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { readPanel, withDataLock, writePanel } from '@/lib/db'

export async function PUT(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  return withDataLock(async () => {
    try {
      const { groupOrders } = await request.json()
      if (!Array.isArray(groupOrders)) {
        return NextResponse.json({ error: '数据格式错误' }, { status: 400 })
      }

      const data = await readPanel(user.id)
      for (const { id, order } of groupOrders) {
        const group = data.groups.find((item) => item.id === id)
        if (group) {
          group.order = Number(order) || 0
          group.updatedAt = Date.now()
        }
      }
      await writePanel(user.id, data)
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Reorder groups error:', error)
      return NextResponse.json({ error: '分组排序失败' }, { status: 500 })
    }
  })
}
