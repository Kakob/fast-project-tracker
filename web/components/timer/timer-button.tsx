'use client'

import { Play, Square } from 'lucide-react'
import { useUIStore } from '@/lib/stores/ui-store'
import { useStartTimer, useStopTimer } from '@/lib/hooks/use-time-entries'
import { formatDuration } from '@/lib/utils'

export function TimerButton({ itemId, size = 'sm' }: { itemId: string; size?: 'sm' | 'md' }) {
  const activeTimerItemId = useUIStore((s) => s.activeTimerItemId)
  const timerElapsedSeconds = useUIStore((s) => s.timerElapsedSeconds)
  const startTimer = useStartTimer()
  const stopTimer = useStopTimer()

  const isActive = activeTimerItemId === itemId
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isActive) {
      stopTimer.mutate()
    } else {
      startTimer.mutate({ item_id: itemId })
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1 rounded text-xs transition-colors ${
        size === 'sm' ? 'px-1.5 py-0.5' : 'px-2.5 py-1.5'
      } ${
        isActive
          ? 'bg-red-100 text-red-600 hover:bg-red-200'
          : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
      }`}
      title={isActive ? 'Stop timer' : 'Start timer'}
    >
      {isActive ? (
        <>
          <Square className={iconSize} />
          <span className="font-mono">{formatDuration(timerElapsedSeconds)}</span>
        </>
      ) : (
        <Play className={iconSize} />
      )}
    </button>
  )
}
