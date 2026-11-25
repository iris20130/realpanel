export interface SearchEngine {
  id: string
  name: string
  prefix: string
}

// 常见搜索引擎的查询地址前缀，前缀末尾拼上关键词即可；
// 也支持用 %s 占位（如 https://example.com/search/%s）
export const SEARCH_ENGINES: SearchEngine[] = [
  { id: 'baidu', name: '百度', prefix: 'https://www.baidu.com/s?wd=' },
  { id: 'google', name: 'Google', prefix: 'https://www.google.com/search?q=' },
  { id: 'bing', name: '必应', prefix: 'https://cn.bing.com/search?q=' },
  { id: 'so360', name: '360 搜索', prefix: 'https://www.so.com/s?q=' },
  { id: 'sogou', name: '搜狗', prefix: 'https://www.sogou.com/web?query=' },
  { id: 'yandex', name: 'Yandex', prefix: 'https://yandex.com/search/?text=' },
  { id: 'github', name: 'GitHub', prefix: 'https://github.com/search?q=' },
  { id: 'bilibili', name: '哔哩哔哩', prefix: 'https://search.bilibili.com/all?keyword=' },
  { id: 'douyin', name: '抖音', prefix: 'https://www.douyin.com/search/%s' },
  { id: 'xiaohongshu', name: '小红书', prefix: 'https://www.xiaohongshu.com/search_result?keyword=' },
]

export const CUSTOM_ENGINE_ID = 'custom'

export function resolveEngine(
  id: string,
  customName: string,
  customPrefix: string
): SearchEngine {
  if (id === CUSTOM_ENGINE_ID) {
    return {
      id: CUSTOM_ENGINE_ID,
      name: customName.trim() || '自定义搜索',
      prefix: customPrefix.trim(),
    }
  }
  return SEARCH_ENGINES.find((engine) => engine.id === id) ?? SEARCH_ENGINES[0]
}

export function buildSearchUrl(prefix: string, query: string): string {
  const keyword = query.trim()
  if (!prefix || !keyword) return ''
  const encoded = encodeURIComponent(keyword)
  if (prefix.includes('%s')) return prefix.replace(/%s/g, encoded)
  return prefix + encoded
}
