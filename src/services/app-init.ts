/**
 * 应用初始化服务
 * 负责在应用启动时初始化各种设置
 */
import { enableAutoStart, disableAutoStart, checkAutoStartEnabled } from './autostart'
import { commands } from '@/lib/tauri-bindings'
import { logger } from '@/lib/logger'

/**
 * 初始化应用设置
 * 根据用户偏好设置应用各种配置
 */
export async function initializeAppSettings(): Promise<void> {
  try {
    // 获取保存的偏好设置
    const result = await commands.loadPreferences()

    // 如果加载成功且有自启动设置
    if (result.status === 'ok' && result.data.auto_start !== undefined) {
      const shouldAutoStart = result.data.auto_start
      const currentlyEnabled = await checkAutoStartEnabled()

      // 只有当设置与当前状态不一致时才更新
      if (shouldAutoStart !== currentlyEnabled) {
        if (shouldAutoStart) {
          await enableAutoStart()
          logger.info('Auto-start enabled')
        } else {
          await disableAutoStart()
          logger.info('Auto-start disabled')
        }
      }
    }
  } catch (error) {
    logger.error('Failed to initialize app settings', { error })
  }
}
