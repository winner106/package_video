/**
 * 托盘语言同步服务
 * 负责在前端语言变化时同步更新系统托盘菜单的语言
 */
import { commands } from '@/lib/tauri-bindings'
import i18n from '@/i18n/config'
import { logger } from '@/lib/logger'

/**
 * 设置托盘语言同步监听
 * 在应用初始化时调用此函数以启用托盘语言自动同步
 */
export function setupTrayLanguageSync(): void {
  // 初始同步
  syncTrayLanguage()

  // 监听语言变化
  i18n.on('languageChanged', _lng => {
    syncTrayLanguage()
  })
}

/**
 * 手动同步托盘语言
 * 可在语言切换后调用以确保托盘菜单语言同步更新
 */
export async function syncTrayLanguage(): Promise<void> {
  const currentLang = i18n.language
  try {
    logger.debug('Syncing tray language', { language: currentLang })
    await commands.trayUpdateLang(currentLang)
  } catch (error) {
    logger.error('Failed to update tray language', { error })
  }
}
