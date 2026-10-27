'use client'

import Image from 'next/image'
import type { Branding } from '@/types'
import { cn } from '@/lib/utils'

interface BrandMarkProps {
  branding: Branding
  imageClassName?: string
  textClassName?: string
}

export function BrandMark({ branding, imageClassName, textClassName }: BrandMarkProps) {
  if (branding.mode === 'none') return null

  if (branding.mode === 'text') {
    return (
      <span
        className={cn(
          'font-bold tracking-tight text-[var(--color-text)] underline-offset-4',
          textClassName
        )}
      >
        {branding.text}
      </span>
    )
  }

  return (
    <Image
      src={branding.logoUrl}
      alt={branding.text}
      width={141}
      height={50}
      className={cn('w-auto brand-logo', imageClassName)}
      priority
      unoptimized
    />
  )
}
