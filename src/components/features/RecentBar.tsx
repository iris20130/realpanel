'use client'

import { useMemo } from 'react'
import { Icon } from '@/components/icons/Icon'
import { usePrefsStore } from '@/stores/prefs'
import { useSitesStore } from '@/stores/sites'
import { useSiteAccessor } from '@/lib/siteAccess'
import { useSiteLauncher } from '@/lib/useSiteLauncher'
import { cn } from '@/lib/utils'
import { History } from 'lucide-react'

// 最近使用：按打开时间倒序，游客的浏览记录也只存在自己的浏览器里
export function RecentBar() {
  const showRecent = usePrefsStore((state) => state.showRecent)
  const recent = usePrefsStore((state) => state.recent)
  const limit = usePrefsStore((state) => state.recentLimit)
  const iconSize = usePrefsStore((state) => state.recentIconSize)
  const fontSize = usePrefsStore((state) => state.recentFontSize)
  const fontColor = usePrefsStore((state) => state.recentFontColor)
  const { sites, groups } = useSitesStore()
  const { isVisible } = useSiteAccessor()
  const { launch, overlays } = useSiteLauncher()

  const groupNames = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name])),
    [groups]
  )

  const items = useMemo(() => {
    if (!showRecent) return []
    return recent
      .map((entry) => {
        const site = sites.find((item) => item.id === entry.siteId)
        return site ? { entry, site } : null
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter(({ site }) => site.enabled && isVisible(site))
      .slice(0, limit)
  }, [showRecent, recent, sites, isVisible, limit])

  if (items.length === 0) return null

  return (
    <>
      <div className="mb-4">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <History size={13} />
          最近使用
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {items.map(({ entry, site }) => (
            <button
              key={site.id}
              type="button"
              onClick={() => launch(site, entry.url, entry.network)}
              title={`${groupNames.get(site.groupId) ?? '未分组'} · ${site.title} · ${entry.network === 'intranet' ? '内网' : '外网'}`}
              className={cn(
                'shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)]',
                'bg-[var(--color-surface)]/70 px-2.5 py-1 transition-colors',
                'hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]'
              )}
              style={{ fontSize, color: fontColor || undefined }}
            >
              <Icon icon={site.icon} size={iconSize} />
              <span className="opacity-70">{groupNames.get(site.groupId) ?? '未分组'}</span>
              <span className="opacity-40">·</span>
              <span className="font-medium">{site.title}</span>
              <span className="opacity-40">·</span>
              <span
                className={cn(
                  'rounded px-1 py-0.5 leading-none',
                  entry.network === 'intranet'
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-emerald-500/15 text-emerald-500'
                )}
                style={{ fontSize: Math.max(10, fontSize - 1) }}
              >
                {entry.network === 'intranet' ? '内网' : '外网'}
              </span>
            </button>
          ))}
        </div>
      </div>
      {overlays}
    </>
  )
}
