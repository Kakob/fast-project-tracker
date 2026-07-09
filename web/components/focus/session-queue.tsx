'use client'

import { GripVertical, X, ChevronUp, ChevronDown } from 'lucide-react'
import type { QueuedTask } from './session-setup-modal'

interface SessionQueueProps {
  queue: QueuedTask[]
  onRemoveTask: (index: number) => void
  onUpdateTask: (index: number, updates: Partial<Omit<QueuedTask, 'item'>>) => void
  onMoveTask: (from: number, to: number) => void
}

const TIME_PRESETS = [5, 10, 15, 20, 25, 30, 45, 60, 120]

export function SessionQueue({
  queue,
  onRemoveTask,
  onUpdateTask,
  onMoveTask,
}: SessionQueueProps) {
  if (queue.length === 0) {
    return (
      <div className="border-2 border-dashed border-gray-200 rounded-lg px-4 py-12 text-center">
        <p className="text-sm text-gray-400">
          Add tasks from the left panel to build your session
        </p>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
      {queue.map((entry, index) => (
        <div
          key={entry.item.id}
          className="flex items-start gap-2 px-3 py-3 border-b border-gray-100 last:border-b-0 bg-white hover:bg-gray-50"
        >
          {/* Drag handle + reorder */}
          <div className="flex flex-col items-center gap-0.5 pt-1">
            <GripVertical className="w-4 h-4 text-gray-300" />
            <button
              onClick={() => index > 0 && onMoveTask(index, index - 1)}
              disabled={index === 0}
              className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={() =>
                index < queue.length - 1 && onMoveTask(index, index + 1)
              }
              disabled={index === queue.length - 1}
              className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* Task info */}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-900 truncate mb-1.5">
              {index + 1}. {entry.item.title}
            </div>

            {/* Time allocation */}
            <div className="flex flex-wrap gap-1">
              {TIME_PRESETS.map((mins) => (
                <button
                  key={mins}
                  onClick={() => onUpdateTask(index, { allocatedMinutes: mins })}
                  className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                    entry.allocatedMinutes === mins
                      ? 'bg-indigo-100 text-indigo-700 font-medium'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {mins}m
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={120}
                value={entry.allocatedMinutes}
                onChange={(e) =>
                  onUpdateTask(index, {
                    allocatedMinutes: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
                className="w-14 px-1.5 py-0.5 text-xs border border-gray-200 rounded text-center bg-white text-gray-900"
              />
            </div>
          </div>

          {/* Remove */}
          <button
            onClick={() => onRemoveTask(index)}
            className="p-1 text-gray-400 hover:text-red-500 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
