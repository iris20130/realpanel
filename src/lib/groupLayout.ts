// 桌面端分组占位网格：8 列，行高按图标行数计算
export const GROUP_COLUMNS = 8
export const GROUP_ROW_UNIT = 124
export const GROUP_HEADER_SPACE = 88
// 竖排且未指定尺寸时，每列默认放 4 个图标
export const GROUP_VERTICAL_ROWS = 4

export function clampGroupCols(value: number): number {
  return Math.min(GROUP_COLUMNS, Math.max(1, Math.round(value)))
}

export function clampGroupRows(value: number): number {
  return Math.min(8, Math.max(1, Math.round(value)))
}

// 固定行数时的分组最小高度（标题 + 若干行图标）
export function groupFixedHeight(rows?: number): number | undefined {
  return rows ? GROUP_HEADER_SPACE + rows * GROUP_ROW_UNIT : undefined
}
