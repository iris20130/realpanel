'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@/components/icons/Icon'
import { usePrefsStore } from '@/stores/prefs'
import { useSitesStore } from '@/stores/sites'
import { useSiteAccessor } from '@/lib/siteAccess'
import { useSiteLauncher } from '@/lib/useSiteLauncher'
import {
  CUSTOM_ENGINE_ID,
  SEARCH_ENGINES,
  buildSearchUrl,
  resolveEngine,
} from '@/lib/searchEngines'
import { RecentBar } from './RecentBar'
import { useSiteContextMenu } from './SiteContextMenu'
import { cn } from '@/lib/utils'
import {
  Search,
  LayoutGrid,
  List,
  ArrowDownWideNarrow,
  ChevronDown,
  CornerDownLeft,
} from 'lucide-react'
import type { Site } from '@/types'

interface SearchHit {
  site: Site
  groupId: string
  groupName: string
}

function buildHaystack(site: Site, groupName: string): string {
  const raw = [
    site.title,
    site.description,
    site.notice,
    ...(site.tags ?? []),
    site.internalUrl,
    site.externalUrl,
    groupName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    // 地址里有非法转义时保持原文
  }
  return `${raw} ${decoded}`
}

export function PanelToolbar() {
  const { sites, groups } = useSitesStore()
  const { isVisible, access } = useSiteAccessor()
  const launcher = useSiteLauncher()
  const { launch, overlays } = launcher
  const { openMenu, menuNode } = useSiteContextMenu(launcher)

  const viewMode = usePrefsStore((state) => state.viewMode)
  const setViewMode = usePrefsStore((state) => state.setViewMode)
  const autoSort = usePrefsStore((state) => state.autoSort)
  const setAutoSort = usePrefsStore((state) => state.setAutoSort)
  const searchEngineId = usePrefsStore((state) => state.searchEngineId)
  const customEngineName = usePrefsStore((state) => state.customEngineName)
  const customEnginePrefix = usePrefsStore((state) => state.customEnginePrefix)
  const setSearchEngine = usePrefsStore((state) => state.setSearchEngine)

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [engineMenu, setEngineMenu] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<HTMLDivElement>(null)

  const engine = resolveEngine(searchEngineId, customEngineName, customEnginePrefix)

  const engines = useMemo(() => {
    if (searchEngineId === CUSTOM_ENGINE_ID || customEnginePrefix.trim()) {
      return [
        ...SEARCH_ENGINES,
        {
          id: CUSTOM_ENGINE_ID,
          name: customEngineName.trim() || '自定义',
          prefix: customEnginePrefix,
        },
      ]
    }
    return SEARCH_ENGINES
  }, [searchEngineId, customEngineName, customEnginePrefix])

  const groupMap = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups]
  )

  // 跨分组实时搜索：按名称、描述、备注、标签、地址（含 WebDAV 文件名）匹配
  const groupsWithHits = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length === 0) return []
    const buckets = new Map<string, SearchHit[]>()
    for (const site of sites) {
      if (!site.enabled || !isVisible(site)) continue
      const group = groupMap.get(site.groupId)
      if (!group) continue
      const hay = buildHaystack(site, group.name)
      if (!terms.every((term) => hay.includes(term))) continue
      const list = buckets.get(group.id) ?? []
      list.push({ site, groupId: group.id, groupName: group.name })
      buckets.set(group.id, list)
    }
    return groups
      .map((group) => ({
        id: group.id,
        name: group.name,
        hits: (buckets.get(group.id) ?? []).sort((a, b) => a.site.order - b.site.order),
      }))
      .filter((group) => group.hits.length > 0)
  }, [query, sites, groups, groupMap, isVisible])

  const totalHits = groupsWithHits.reduce((sum, group) => sum + group.hits.length, 0)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      const insideSearch = containerRef.current?.contains(target)
      const insideEngine = engineRef.current?.contains(target)
      if (!insideSearch && !insideEngine) {
        setOpen(false)
        setEngineMenu(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setEngineMenu(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const runEngineSearch = () => {
    const target = buildSearchUrl(engine.prefix || SEARCH_ENGINES[0].prefix, query)
    if (!target) return
    window.open(target, '_blank', 'noopener,noreferrer')
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    runEngineSearch()
  }

  const handleOpenHit = (hit: SearchHit) => {
    const result = access(hit.site)
    if (!result.url) return
    launch(hit.site, result.url, result.network ?? 'internet')
    setOpen(false)
  }

  const showResults = open && query.trim().length > 0

  return (
    <div className="mb-5">
      <RecentBar />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div ref={containerRef} className="relative flex-1 min-w-0">
          <form onSubmit={handleSubmit} className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              placeholder={`搜索名称、描述、备注、文件名；回车用${engine.name}搜索`}
              aria-label="搜索导航"
              className={cn(
                'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/70',
                'pl-9 pr-24 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
                'outline-none transition-colors focus:border-[var(--color-primary)]'
              )}
            />
            <button
              type="submit"
              title={`用${engine.name}搜索`}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]/70 px-2 py-1 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]"
            >
              <CornerDownLeft size={12} />
              {engine.name}
            </button>
          </form>

          {showResults && (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[60vh] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-3 shadow-2xl">
              {totalHits === 0 ? (
                <p className="px-1 py-2 text-sm text-[var(--color-text-muted)]">
                  面板里没有匹配的网站，按回车用「{engine.name}」搜索「{query.trim()}」
                </p>
              ) : (
                <div className="space-y-3">
                  {groupsWithHits.map((group) => (
                    <div
                      key={group.id}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-2"
                    >
                      <p className="mb-1.5 px-1 text-xs font-medium text-[var(--color-text-muted)]">
                        {group.name}
                        <span className="ml-1 opacity-70">({group.hits.length})</span>
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {group.hits.map((hit) => (
                          <button
                            key={hit.site.id}
                            type="button"
                            onClick={() => handleOpenHit(hit)}
                            onContextMenu={(event) => openMenu(hit.site, event)}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[var(--color-primary)]/15"
                          >
                            <Icon icon={hit.site.icon} size={18} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-[var(--color-text)]">
                                {hit.site.title}
                              </span>
                              {(hit.site.description || hit.site.notice) && (
                                <span className="block truncate text-[11px] text-[var(--color-text-muted)]">
                                  {hit.site.description || hit.site.notice}
                                </span>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {/* 搜索引擎切换 */}
          <div ref={engineRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setEngineMenu((value) => !value)
                setOpen(true)
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-2.5 py-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]"
              title="切换搜索引擎（可在设置里自定义前缀）"
            >
              {engine.name}
              <ChevronDown size={13} />
            </button>
            {engineMenu && (
              <div className="absolute right-0 top-full z-40 mt-1 w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] p-1 shadow-xl">
                {engines.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSearchEngine(item.id)
                      setEngineMenu(false)
                    }}
                    className={cn(
                      'w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-[var(--color-primary)]/25',
                      item.id === engine.id
                        ? 'text-[var(--color-primary)]'
                        : 'text-[var(--color-text)]'
                    )}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 视图切换 */}
          <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/70 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="卡片视图"
              className={cn(
                'rounded-md p-1.5 transition-colors',
                viewMode === 'grid'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              )}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              title="列表视图（小图标 + 名称）"
              className={cn(
                'rounded-md p-1.5 transition-colors',
                viewMode === 'compact'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              )}
            >
              <List size={16} />
            </button>
          </div>

          {/* 按使用次数自动排序 */}
          <button
            type="button"
            onClick={() => setAutoSort(!autoSort)}
            title={autoSort ? '已按使用次数排序（点击恢复默认顺序）' : '按使用次数从高到低排序'}
            aria-pressed={autoSort}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs transition-colors',
              autoSort
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)]/70 text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            )}
          >
            <ArrowDownWideNarrow size={15} />
            <span className="hidden sm:inline">常用优先</span>
          </button>
        </div>
      </div>

      {menuNode}

      {overlays}
    </div>
  )
}
