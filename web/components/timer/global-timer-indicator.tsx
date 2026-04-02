'use client'

import { Square, Timer } from 'lucide-react'
import { useUIStore } from '@/lib/stores/ui-store'
import { useItems } from '@/lib/hooks/use-items'
import { useStopTimer } from '@/lib/hooks/use-time-entries'
import { formatDuration } from '@/lib/utils'

export function GlobalTimerIndicator() {
  const activeTimerItemId = useUIStore((s) => s.activeTimerItemId)
  const timerElapsedSeconds = useUIStore((s) => s.timerElapsedSeconds)
  const { data: items } = useItems()
  const stopTimer = useStopTimer()

  if (!activeTimerItemId) return null

  const activeItem = items?.find((i) => i.id === activeTimerItemId)

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm">
      <Timer className="w-4 h-4 text-red-500 animate-pulse" />
      <span className="text-red-700 font-mono text-xs">{formatDuration(timerElapsedSeconds)}</span>
      <span className="text-red-600 truncate max-w-[120px] text-xs">{activeItem?.title || 'Timer'}</span>
      <button
        onClick={() => stopTimer.mutate()}
        className="p-0.5 text-red-400 hover:text-red-600 rounded"
        title="Stop timer"
      >
        <Square className="w-3 h-3" />
      </button>
    </div>
  )
}
