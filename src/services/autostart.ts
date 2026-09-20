/**
 * 自启动服务
 * 提供控制应用开机自启动的功能
 */
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart'
import { logger } from '@/lib/logger'

/**
 * 检查应用是否设置为开机自启动
 */
export async function checkAutoStartEnabled(): Promise<boolean> {
  try {
    return await isEnabled()
  } catch (error) {
    logger.error('Failed to check autostart status', { error })
    return false
  }
}

/**
 * 启用开机自启动
 */
export async function enableAutoStart(): Promise<boolean> {
  try {
    await enable()
    return true
  } catch (error) {
    logger.error('Failed to enable autostart', { error })
    return false
  }
}

/**
 * 禁用开机自启动
 */
export async function disableAutoStart(): Promise<boolean> {
  try {
    await disable()
    return true
  } catch (error) {
    logger.error('Failed to disable autostart', { error })
    return false
  }
}
