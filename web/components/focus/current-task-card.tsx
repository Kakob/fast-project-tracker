'use client'

import { Pause } from 'lucide-react'
import type { Item, SessionTask } from '@/types'

interface CurrentTaskCardProps {
  item: Item
  sessionTask: SessionTask
  elapsedMs: number
  isWarning: boolean
  isPaused: boolean
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function CurrentTaskCard({
  item,
  sessionTask,
  elapsedMs,
  isWarning,
  isPaused,
}: CurrentTaskCardProps) {
  const totalAllocated = sessionTask.allocated_time_ms + sessionTask.extensions_ms
  const remainingMs = Math.max(0, totalAllocated - elapsedMs)
  const progress = totalAllocated > 0 ? Math.min(1, elapsedMs / totalAllocated) : 0

  return (
    <div
      className={`relative rounded-2xl border-2 p-8 transition-all ${
        isWarning
          ? 'border-red-400 bg-red-50 animate-pulse'
          : isPaused
          ? 'border-gray-300 bg-gray-50'
          : 'border-indigo-200 bg-white'
      }`}
    >
      {/* Task progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl overflow-hidden bg-gray-200">
        <div
          className={`h-full transition-all duration-1000 ${
            isWarning ? 'bg-red-500' : 'bg-indigo-500'
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Paused indicator */}
      {isPaused && (
        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 bg-gray-200 rounded-full">
          <Pause className="w-3 h-3 text-gray-600" />
          <span className="text-xs font-medium text-gray-600">Paused</span>
        </div>
      )}

      {/* Task title */}
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{item.title}</h2>

      {/* Intention */}
      {item.intention && (
        <p className="text-sm text-gray-500 italic mb-6">
          &ldquo;{item.intention}&rdquo;
        </p>
      )}

      {/* Timer display */}
      <div className="flex items-baseline gap-6">
        {/* Remaining (countdown) */}
        <div className="text-center">
          <div
            className={`text-5xl font-mono font-bold tabular-nums ${
              isWarning ? 'text-red-600' : 'text-gray-900'
            }`}
          >
            {formatTime(remainingMs)}
          </div>
          <div className="text-xs text-gray-400 mt-1 uppercase tracking-wider">
            Remaining
          </div>
        </div>

        {/* Separator */}
        <div className="text-2xl text-gray-300">/</div>

        {/* Elapsed */}
        <div className="text-center">
          <div className="text-2xl font-mono text-gray-400 tabular-nums">
            {formatTime(elapsedMs)}
          </div>
          <div className="text-xs text-gray-400 mt-1 uppercase tracking-wider">
            Elapsed
          </div>
        </div>
      </div>

      {/* Extensions info */}
      {sessionTask.extension_count > 0 && (
        <div className="mt-4 text-xs text-gray-400">
          Extended {sessionTask.extension_count}x (+
          {Math.round(sessionTask.extensions_ms / 60000)} min)
        </div>
      )}
    </div>
  )
}
