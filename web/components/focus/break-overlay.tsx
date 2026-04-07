'use client'

import { Coffee } from 'lucide-react'

interface BreakOverlayProps {
  elapsedMs: number
  plannedDurationSec: number | null
  onEndBreak: () => void
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function BreakOverlay({
  elapsedMs,
  plannedDurationSec,
  onEndBreak,
}: BreakOverlayProps) {
  const remainingMs = plannedDurationSec
    ? Math.max(0, plannedDurationSec * 1000 - elapsedMs)
    : null

  return (
    <div className="fixed inset-0 bg-emerald-900/80 z-50 flex items-center justify-center">
      <div className="text-center text-white space-y-6">
        <Coffee className="w-12 h-12 mx-auto opacity-80" />

        <div>
          <h2 className="text-2xl font-semibold mb-2">Break Time</h2>
          <p className="text-emerald-200 text-sm">
            Step away, stretch, hydrate
          </p>
        </div>

        {/* Timer */}
        <div className="text-5xl font-mono tabular-nums">
          {remainingMs !== null ? formatTime(remainingMs) : formatTime(elapsedMs)}
        </div>
        <div className="text-sm text-emerald-300">
          {remainingMs !== null ? 'remaining' : 'elapsed'}
        </div>

        <button
          onClick={onEndBreak}
          className="px-8 py-3 bg-white text-emerald-900 font-medium rounded-xl hover:bg-emerald-50 transition-colors"
        >
          End Break
        </button>
      </div>
    </div>
  )
}
