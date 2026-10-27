import { NextResponse } from 'next/server'
import { readBranding } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await readBranding())
}
