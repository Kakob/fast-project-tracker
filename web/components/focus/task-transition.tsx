'use client'

import { ArrowRight, Coffee } from 'lucide-react'
import type { Item } from '@/types'

interface TaskTransitionProps {
  fromTask: Item | null
  toTask: Item | null
  onBreak: (durationSec: number | null) => void
  onSkipBreak: () => void
}

export function TaskTransition({
  fromTask,
  toTask,
  onBreak,
  onSkipBreak,
}: TaskTransitionProps) {
  return (
    <div className="relative bg-white rounded-2xl border-2 border-indigo-100 p-8 overflow-hidden">
      {/* Progress bar (auto-filling over 4 seconds) */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
        <div
          className="h-full bg-indigo-500 transition-none"
          style={{
            animation: 'fillProgress 4s linear forwards',
          }}
        />
      </div>

      <div className="flex items-center gap-6">
        {/* From task */}
        {fromTask && (
          <div className="flex-1 text-right opacity-50">
            <div className="text-sm text-gray-400 mb-1">Completed</div>
            <div className="text-lg text-gray-500 line-through">
              {fromTask.title}
            </div>
          </div>
        )}

        {/* Arrow */}
        <div className="flex-shrink-0">
          <ArrowRight className="w-6 h-6 text-indigo-400" />
        </div>

        {/* To task */}
        {toTask && (
          <div className="flex-1">
            <div className="text-sm text-indigo-500 mb-1 font-medium">
              Next up
            </div>
            <div className="text-lg font-semibold text-gray-900">
              {toTask.title}
            </div>
          </div>
        )}
      </div>

      {/* Quick break prompt */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Coffee className="w-4 h-4" />
            Quick break?
          </div>
          <div className="flex gap-2">
            {[1, 3, 5].map((min) => (
              <button
                key={min}
                onClick={() => onBreak(min * 60)}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
              >
                {min}m
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
