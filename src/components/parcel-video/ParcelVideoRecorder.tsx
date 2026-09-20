import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { commands } from '@/lib/tauri-bindings'

type RecordingStatus = 'idle' | 'recording' | 'saving'

const MAX_RECORDING_MS = 40_000
const DEFAULT_STORAGE_GB = 100

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}

function sanitizeBarcode(raw: string): string {
  return raw.trim()
}

export function ParcelVideoRecorder() {
  const [scanInput, setScanInput] = useState('')
  const [activeBarcode, setActiveBarcode] = useState<string | null>(null)
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const [lastSavedPath, setLastSavedPath] = useState('')
  const [recordingDir, setRecordingDir] = useState('')
  const [maxStorageGb, setMaxStorageGb] = useState<number>(DEFAULT_STORAGE_GB)
  const [countdownMs, setCountdownMs] = useState(0)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const countdownTimerRef = useRef<number | null>(null)
  const stopTimerRef = useRef<number | null>(null)
  const pendingNextBarcodeRef = useRef<string | null>(null)
  const currentBarcodeRef = useRef<string | null>(null)

  const maxStorageBytes = useMemo(() => {
    const safeGb = Number.isFinite(maxStorageGb) && maxStorageGb > 0 ? maxStorageGb : DEFAULT_STORAGE_GB
    return Math.floor(safeGb * 1024 * 1024 * 1024)
  }, [maxStorageGb])

  useEffect(() => {
    commands.getParcelRecordingDirectory().then(result => {
      if (result.status === 'ok') {
        setRecordingDir(result.data)
      }
    })
  }, [])

  useEffect(() => {
    return () => {
      clearTimers()
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop()
      }
      stopStream()
    }
  }, [])

  const clearTimers = () => {
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }

    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }

    setCountdownMs(0)
  }

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const ensureCameraStream = async (): Promise<MediaStream> => {
    if (streamRef.current) {
      return streamRef.current
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    })

    streamRef.current = stream

    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play().catch(() => undefined)
    }

    return stream
  }

  const resolveRecorderMimeType = () => {
    const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    const matched = candidates.find(item => MediaRecorder.isTypeSupported(item))
    return matched ?? ''
  }

  const startCountdown = () => {
    const deadline = Date.now() + MAX_RECORDING_MS
    setCountdownMs(MAX_RECORDING_MS)

    countdownTimerRef.current = window.setInterval(() => {
      const remain = Math.max(0, deadline - Date.now())
      setCountdownMs(remain)
    }, 200)
  }

  const stopCurrentRecording = (reason: 'next-barcode' | 'timeout' | 'manual') => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== 'recording') {
      return
    }

    clearTimers()

    if (reason === 'timeout') {
      toast.warning('录制已达到 40 秒，自动停止保存')
    }

    recorder.stop()
  }

  const startRecording = async (barcode: string) => {
    const stream = await ensureCameraStream()
    const mimeType = resolveRecorderMimeType()

    chunksRef.current = []
    currentBarcodeRef.current = barcode

    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    recorderRef.current = recorder

    recorder.ondataavailable = event => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    }

    recorder.onerror = event => {
      console.error(event)
      toast.error('录像器发生错误，请检查摄像头权限')
      setStatus('idle')
      setActiveBarcode(null)
      clearTimers()
    }

    recorder.onstop = async () => {
      const barcodeAtStop = currentBarcodeRef.current
      const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' })
      chunksRef.current = []
      currentBarcodeRef.current = null

      if (!barcodeAtStop || blob.size === 0) {
        setStatus('idle')
        setActiveBarcode(null)
        return
      }

      setStatus('saving')

      try {
        const data = new Uint8Array(await blob.arrayBuffer())
        const saveResult = await commands.saveParcelRecordingMp4(barcodeAtStop, Array.from(data), maxStorageBytes)

        if (saveResult.status === 'error') {
          throw new Error(saveResult.error)
        }

        setLastSavedPath(saveResult.data.file_path)
        const removed = saveResult.data.deleted_files.length
        toast.success(
          `已保存 ${saveResult.data.file_name}（${formatBytes(saveResult.data.file_size_bytes)}）${
            removed > 0 ? `，已滚动删除 ${removed} 个旧文件` : ''
          }`
        )
      } catch (error) {
        toast.error(`保存录像失败：${String(error)}`)
      } finally {
        setStatus('idle')
        setActiveBarcode(null)
      }

      const nextBarcode = pendingNextBarcodeRef.current
      pendingNextBarcodeRef.current = null
      if (nextBarcode) {
        void handleScan(nextBarcode)
      }
    }

    recorder.start(250)
    setStatus('recording')
    setActiveBarcode(barcode)
    startCountdown()

    stopTimerRef.current = window.setTimeout(() => {
      stopCurrentRecording('timeout')
    }, MAX_RECORDING_MS)
  }

  const handleScan = async (rawBarcode?: string) => {
    const parsed = sanitizeBarcode(rawBarcode ?? scanInput)
    if (!parsed) {
      return
    }

    setScanInput('')

    if (status === 'saving') {
      pendingNextBarcodeRef.current = parsed
      toast.message('当前视频正在保存，已排队下一单号')
      return
    }

    if (status === 'recording') {
      if (parsed === activeBarcode) {
        toast.message('相同快递单号，继续当前录像')
        return
      }

      pendingNextBarcodeRef.current = parsed
      stopCurrentRecording('next-barcode')
      return
    }

    try {
      await startRecording(parsed)
    } catch (error) {
      toast.error(`无法开始录像：${String(error)}`)
      setStatus('idle')
      setActiveBarcode(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">扫码触发录像（测试版）</h1>

      <div className="grid grid-cols-1 gap-3 rounded-lg border bg-card p-4 md:grid-cols-[1fr_auto_auto]">
        <Input
          value={scanInput}
          onChange={event => setScanInput(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void handleScan()
            }
          }}
          placeholder="扫描枪输入后通常会自动回车；无扫描枪时可手输后回车"
        />
        <Button onClick={() => void handleScan()} disabled={status === 'saving'}>
          模拟扫码
        </Button>
        <Button variant="outline" onClick={() => stopCurrentRecording('manual')} disabled={status !== 'recording'}>
          手动停止
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border bg-card p-4 md:grid-cols-[1fr_auto]">
        <div className="text-sm text-muted-foreground">
          当前状态：
          {status === 'recording' ? `录制中（${activeBarcode}，剩余 ${(countdownMs / 1000).toFixed(1)}s）` : null}
          {status === 'saving' ? '保存中…' : null}
          {status === 'idle' ? '空闲，等待扫码' : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">总容量上限(GB)</span>
          <Input
            className="w-28"
            type="number"
            min={1}
            value={Number.isNaN(maxStorageGb) ? '' : maxStorageGb}
            onChange={event => setMaxStorageGb(Number(event.target.value))}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-black/90">
        <video ref={videoRef} autoPlay playsInline muted className="h-[360px] w-full object-contain" />
      </div>

      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        <p>保存目录：{recordingDir || '加载中...'}</p>
        <p>最近保存：{lastSavedPath || '暂无'}</p>
        <p>容量策略：总量超过 {maxStorageGb || DEFAULT_STORAGE_GB}GB 时，按最旧录像开始删除。</p>
      </div>
    </div>
  )
}
