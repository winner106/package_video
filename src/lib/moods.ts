export type LocaleMoodMap = Record<string, string[]>

export const DEFAULT_MOOD_CANDIDATES: LocaleMoodMap = {
  en: [
    '😀 Feeling great',
    '😎 Keep it cool',
    '🤔 Deep in thought',
    '🎯 Focus mode',
    '🔥 Bring the heat',
    '🌱 Grow every day',
    '🚀 Ready to launch',
    '💡 New ideas brewing',
    '🎵 In the groove',
    '⌛ Where there is time, there is a stage!',
  ],
  'zh-CN': [
    '😀 心情很好',
    '😎 冷静如常',
    '🤔 认真思考中',
    '🎯 专注模式',
    '🔥 干劲满满',
    '🌱 一点点成长',
    '🚀 准备起飞',
    '💡 灵感在酝酿',
    '🎵 音乐陪伴',
    '⌛ 时间在哪里，舞台就在那里！',
  ],
  'zh-HK': [
    '😀 心情不錯',
    '😎 冷靜如常',
    '🤔 認真思考中',
    '🎯 專注模式',
    '🔥 幹勁滿滿',
    '🌱 一點點成長',
    '🚀 準備起飛',
    '💡 靈感在醞釀',
    '🎵 音樂陪伴',
    '⌛ 時間喺邊，舞台就喺邊！',
  ],
} as const

export const getMoodCandidatesForLocale = (locale: string, override?: LocaleMoodMap): string[] => {
  const normalized = (locale || '').toLowerCase()
  const source: LocaleMoodMap = override ?? DEFAULT_MOOD_CANDIDATES
  const hk = source['zh-HK'] ?? DEFAULT_MOOD_CANDIDATES['zh-HK']
  const cn = source['zh-CN'] ?? DEFAULT_MOOD_CANDIDATES['zh-CN']
  const en = source['en'] ?? DEFAULT_MOOD_CANDIDATES.en

  if (normalized.startsWith('zh-hk') || normalized.startsWith('zh-tw')) {
    return hk as string[]
  }
  if (normalized.startsWith('zh')) {
    return cn as string[]
  }
  return en as string[]
}
