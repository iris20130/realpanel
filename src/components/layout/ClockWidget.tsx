'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function format(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return {
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    seconds: pad(date.getSeconds()),
    date: `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`,
  }
}

export function ClockWidget({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  if (!now) return null
  const text = format(now)

  return (
    <div className={cn('mb-4 flex flex-wrap items-end gap-x-3 gap-y-1', className)}>
      <span className="text-3xl sm:text-4xl font-semibold tabular-nums leading-none text-[var(--color-text)]">
        {text.time}
        <span className="ml-1 text-base sm:text-lg font-normal text-[var(--color-text-muted)]">
          :{text.seconds}
        </span>
      </span>
      <span className="text-sm text-[var(--color-text-muted)] pb-0.5">{text.date}</span>
    </div>
  )
}
