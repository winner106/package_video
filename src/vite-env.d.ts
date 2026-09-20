/// <reference types="vite/client" />
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_ENABLE_LEFT_SIDEBAR?: string
  readonly VITE_ENABLE_RIGHT_SIDEBAR?: string
}

declare module '*.svg?react' {
  import type * as React from 'react'
  const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>
  export default ReactComponent
}
