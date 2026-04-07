'use client'

import { Check, Clock, SkipForward, Pause } from 'lucide-react'
import type { Item, SessionTask } from '@/types'

interface TaskQueuePanelProps {
  sessionTasks: SessionTask[]
  items: Item[]
  currentIndex: number
}

function formatMinutes(ms: number): string {
  const min = Math.round(ms / 60000)
  return `${min}m`
}

export function TaskQueuePanel({
  sessionTasks,
  items,
  currentIndex,
}: TaskQueuePanelProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-500">Session Tasks</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {sessionTasks.map((st, index) => {
          const item = items.find((i) => i.id === st.task_id)
          if (!item) return null

          const isCurrent = index === currentIndex
          const isDone = st.status === 'completed'
          const isSkipped = st.status === 'skipped'
          const isPausedIncomplete = st.status === 'paused_incomplete'
          const isPast = isDone || isSkipped || isPausedIncomplete

          return (
            <div
              key={st.id}
              className={`flex items-center gap-3 px-4 py-3 ${
                isCurrent
                  ? 'bg-indigo-50'
                  : isPast
                  ? 'bg-gray-50 opacity-60'
                  : ''
              }`}
            >
              {/* Status icon */}
              <div className="flex-shrink-0">
                {isDone ? (
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  </div>
                ) : isSkipped ? (
                  <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                    <SkipForward className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                ) : isPausedIncomplete ? (
                  <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center">
                    <Pause className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                ) : isCurrent ? (
                  <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  </div>
                ) : (
                  <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Task title */}
              <div className={`flex-1 min-w-0 ${isPast ? 'line-through' : ''}`}>
                <span
                  className={`text-sm ${
                    isCurrent
                      ? 'font-medium text-indigo-900'
                      : 'text-gray-700'
                  }`}
                >
                  {item.title}
                </span>
              </div>

              {/* Time info */}
              <div className="flex-shrink-0 text-right">
                {isPast ? (
                  <div className="text-xs text-gray-400">
                    {formatMinutes(st.actual_time_ms)} /{' '}
                    {formatMinutes(st.allocated_time_ms)}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">
                    {formatMinutes(st.allocated_time_ms + st.extensions_ms)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
