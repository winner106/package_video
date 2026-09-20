/**
 * 语言工具函数，用于处理语言代码和匹配最佳可用语言
 */
import { availableLanguages } from './config'
import { logger } from '@/lib/logger'

/**
 * 将系统语言代码标准化（统一格式）
 * @param locale 原始语言代码，如 "zh_CN", "ZH-cn" 等
 * @returns 标准化的语言代码，如 "zh-cn"
 */
export function normalizeLocale(locale: string): string {
  return locale.replace('_', '-').toLowerCase()
}

/**
 * 根据系统语言代码确定最佳匹配的应用语言
 *
 * 匹配优先级：
 * 1. 特殊处理中文变体（香港、澳门、台湾 -> zh-TW，中国大陆、新加坡 -> zh-CN）
 * 2. 完全匹配（如 "fr-fr" -> "fr"）
 * 3. 语言部分匹配（如 "en-gb" -> "en"）
 * 4. 中文默认使用简体中文
 * 5. 找不到匹配时使用英语
 *
 * @param systemLocale 系统语言代码
 * @returns 最佳匹配的应用语言代码
 */
export function getBestLanguageMatch(systemLocale: string | null): string {
  if (!systemLocale) {
    return 'en'
  }

  const normalizedLocale = normalizeLocale(systemLocale)

  // 处理繁体中文特殊情况（香港、澳门、台湾）
  if (normalizedLocale === 'zh-hk' || normalizedLocale === 'zh-mo' || normalizedLocale === 'zh-tw') {
    logger.debug('Matched Traditional Chinese locale', { systemLocale })
    return 'zh-TW'
  }

  // 处理简体中文特殊情况（中国大陆、新加坡）
  if (normalizedLocale === 'zh-cn' || normalizedLocale === 'zh-sg') {
    logger.debug('Matched Simplified Chinese locale', { systemLocale })
    return 'zh-CN'
  }

  // 尝试完整匹配
  if (availableLanguages.includes(normalizedLocale)) {
    logger.debug('Exact locale match found', {
      systemLocale,
      match: normalizedLocale,
    })
    return normalizedLocale
  }

  // 尝试匹配语言部分
  const langCode = normalizedLocale.split('-')[0]

  // 特殊处理中文
  if (langCode === 'zh') {
    logger.debug('Generic Chinese locale, using Simplified Chinese', {
      systemLocale,
    })
    return 'zh-CN'
  }

  // 查找以该语言代码开头的可用语言
  const matchingLang = availableLanguages.find(lang => lang === langCode || lang.startsWith(`${langCode}-`))

  if (matchingLang) {
    logger.debug('Partial locale match found', {
      systemLocale,
      match: matchingLang,
    })
    return matchingLang
  }

  // 默认使用英语
  logger.debug('No locale match found, using English', { systemLocale })
  return 'en'
}
