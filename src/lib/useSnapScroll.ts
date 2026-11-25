'use client'

import { useEffect } from 'react'

const IDLE_MS = 160
const SNAP_GAP = 8
const BOTTOM_GAP = 20
const SNAP_THRESHOLD = 240

function docTop(el: HTMLElement): number {
  let top = 0
  let node: HTMLElement | null = el
  while (node) {
    top += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return top
}

// 松手吸附：滚动停止后对齐到最近的整行；
// 若该行是分组的最后一行且分组能完整显示，则对齐到分组底部，让分组完整可见
export function useSnapScroll(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let timer = 0
    let programmaticUntil = 0

    const contentTop = () => {
      const bar = document.querySelector<HTMLElement>('[data-sticky-bar]')
      if (!bar) return 80
      return Math.max(bar.getBoundingClientRect().bottom, 0)
    }

    const collectTargets = (): number[] => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      if (maxScroll <= 0) return []
      const top = contentTop() + SNAP_GAP
      const viewport = window.innerHeight

      const groups = Array.from(document.querySelectorAll<HTMLElement>('[data-group-card]')).map(
        (el) => {
          const groupTop = docTop(el)
          const groupBottom = groupTop + el.offsetHeight
          return {
            el,
            top: groupTop,
            bottom: groupBottom,
            fits: groupBottom - groupTop + SNAP_GAP <= viewport - top - BOTTOM_GAP,
          }
        }
      )
      const groupInfo = new Map(groups.map((group) => [group.el, group]))

      const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-site-card]')).map(
        (el) => ({
          top: docTop(el),
          group: el.closest<HTMLElement>('[data-group-card]'),
        })
      )
      cards.sort((a, b) => a.top - b.top)

      const rowTops: number[] = []
      for (const card of cards) {
        const last = rowTops[rowTops.length - 1]
        if (last !== undefined && Math.abs(card.top - last) <= 10) continue
        rowTops.push(card.top)
      }

      const targets = new Set<number>()
      targets.add(0)

      for (const group of groups) {
        if (group.fits) targets.add(group.top - top)
      }

      for (const rowTop of rowTops) {
        targets.add(rowTop - top)
        const groupsAtRow = new Set(
          cards
            .filter((card) => Math.abs(card.top - rowTop) <= 10 && card.group)
            .map((card) => card.group as HTMLElement)
        )
        for (const groupEl of groupsAtRow) {
          const group = groupInfo.get(groupEl)
          if (!group || !group.fits) continue
          const isLastRow = !cards.some(
            (card) => card.group === groupEl && card.top > rowTop + 10
          )
          if (isLastRow) targets.add(group.bottom - viewport + BOTTOM_GAP)
        }
      }

      targets.add(maxScroll)
      return [...targets]
        .map((value) => Math.max(0, Math.min(maxScroll, Math.round(value))))
        .sort((a, b) => a - b)
    }

    const snap = () => {
      if (performance.now() < programmaticUntil) return
      if (document.querySelector('[role="dialog"]')) return
      const targets = collectTargets()
      if (targets.length === 0) return
      const current = window.scrollY
      let best = targets[0]
      let bestDistance = Math.abs(best - current)
      for (const target of targets) {
        const distance = Math.abs(target - current)
        if (distance < bestDistance) {
          best = target
          bestDistance = distance
        }
      }
      if (bestDistance < 2 || bestDistance > SNAP_THRESHOLD) return
      programmaticUntil = performance.now() + 700
      window.scrollTo({ top: best, behavior: 'smooth' })
    }

    const onScroll = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(snap, IDLE_MS)
    }

    const onUserScroll = () => {
      programmaticUntil = 0
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('wheel', onUserScroll, { passive: true })
    window.addEventListener('touchstart', onUserScroll, { passive: true })

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('wheel', onUserScroll)
      window.removeEventListener('touchstart', onUserScroll)
    }
  }, [enabled])
}
