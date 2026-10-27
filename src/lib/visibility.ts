import type { Group, PublicUser, Site, SiteVisibility, SitesData, VisibilityMode } from '@/types'

type Viewer = Pick<PublicUser, 'id' | 'role'> | null

export function normalizeVisibility(value: unknown): VisibilityMode {
  return value === 'members' || value === 'users' ? value : 'public'
}

export function normalizeSiteVisibility(value: unknown): SiteVisibility {
  return value === 'members' || value === 'users' || value === 'public' ? value : 'inherit'
}

export function normalizeUserIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(String).filter(Boolean)))
}

export function getEffectiveSiteVisibility(site: Site, group: Group): VisibilityMode {
  const mode = site.visibility
  if (!mode || mode === 'inherit') return group.visibility ?? 'public'
  return mode
}

export function canViewByVisibility(
  mode: VisibilityMode | undefined,
  visibleUserIds: string[] | undefined,
  viewer: Viewer
): boolean {
  const effective = mode ?? 'public'
  if (effective === 'public') return true
  if (!viewer) return false
  if (viewer.role === 'admin') return true
  if (effective === 'members') return true
  return (visibleUserIds ?? []).includes(viewer.id)
}

export function filterPanelForViewer(panel: SitesData, viewer: Viewer): SitesData {
  const groups = panel.groups.filter((group) =>
    canViewByVisibility(group.visibility, group.visibleUserIds, viewer)
  )
  const groupIds = new Set(groups.map((group) => group.id))
  const groupMap = new Map(groups.map((group) => [group.id, group]))

  const sites = panel.sites.filter((site) => {
    if (!groupIds.has(site.groupId)) return false
    const group = groupMap.get(site.groupId)!
    return canViewByVisibility(
      getEffectiveSiteVisibility(site, group),
      site.visibleUserIds,
      viewer
    )
  })

  return { groups, sites }
}
