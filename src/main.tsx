import ReactDOM from 'react-dom/client'

import { QueryClientProvider } from '@tanstack/react-query'
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App'
import './i18n'
import { queryClient } from './lib/query-client'

import { initializeAppSettings } from './services/app-init'
import { setupTrayLanguageSync } from './services/tray-language'

// 初始化托盘语言同步
setupTrayLanguageSync()

// 初始化应用设置
initializeAppSettings().catch(console.error)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <QueryClientProvider client={queryClient}>
    <App />
    {/* <ReactQueryDevtools initialIsOpen={false} /> */}
  </QueryClientProvider>
)
