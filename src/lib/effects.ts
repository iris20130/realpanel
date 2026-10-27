export type EffectId = 'nebula' | 'starfield' | 'shapes' | 'fireworks'

export interface EffectMeta {
  id: EffectId
  name: string
  description: string
  accent: string
}

export const EFFECTS: EffectMeta[] = [
  {
    id: 'nebula',
    name: '粒子星云',
    description: '3D 粒子随鼠标聚散，经典默认效果',
    accent: '#818cf8',
  },
  {
    id: 'starfield',
    name: '星空闪烁',
    description: '夜空繁星明灭，偶有流星划过',
    accent: '#f7d794',
  },
  {
    id: 'shapes',
    name: '几何漂浮',
    description: '彩色方块、圆形、三角形缓慢漂浮',
    accent: '#4ecdc4',
  },
  {
    id: 'fireworks',
    name: '绚烂烟花',
    description: '自动绽放的烟花粒子，带拖尾光效',
    accent: '#45b7d1',
  },
]

export const DEFAULT_EFFECT: EffectId = 'nebula'

export function randomEffectId(exclude?: EffectId | null): EffectId {
  const pool = exclude ? EFFECTS.filter((effect) => effect.id !== exclude) : EFFECTS
  return pool[Math.floor(Math.random() * pool.length)].id
}
