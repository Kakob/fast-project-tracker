'use client'

import { Search, Plus } from 'lucide-react'
import { PRIORITY_CONFIG } from '@/types'
import type { Item } from '@/types'

interface TaskSelectorProps {
  items: Item[]
  search: string
  onSearchChange: (value: string) => void
  onAddTask: (item: Item) => void
}

export function TaskSelector({
  items,
  search,
  onSearchChange,
  onAddTask,
}: TaskSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search tasks..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
        />
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-sm text-gray-400 text-center">
            {search ? 'No matching tasks' : 'No available tasks'}
          </div>
        ) : (
          items.map((item) => {
            const priority = PRIORITY_CONFIG[item.priority]
            return (
              <button
                key={item.id}
                onClick={() => onAddTask(item)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
              >
                <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">
                    {item.title}
                  </div>
                  {item.priority !== 'none' && (
                    <span
                      className={`text-xs ${priority.color}`}
                    >
                      {priority.label}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 capitalize">
                  {item.status.replace('_', ' ')}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
