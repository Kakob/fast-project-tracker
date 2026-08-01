'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { PRIORITY_CONFIG } from '@/types'
import type { Item } from '@/types'

interface TaskSelectorProps {
  items: Item[]
  search: string
  onSearchChange: (value: string) => void
  onAddTask: (item: Item) => void
  onQuickCreate: (title: string) => void
  isCreating: boolean
}

export function TaskSelector({
  items,
  search,
  onSearchChange,
  onAddTask,
  onQuickCreate,
  isCreating,
}: TaskSelectorProps) {
  const trimmedSearch = search.trim()
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Rows: existing matches first, then the create row (when searching)
  const rowCount = items.length + (trimmedSearch ? 1 : 0)
  const createRowIndex = trimmedSearch ? items.length : -1

  useEffect(() => {
    setActiveIndex(0)
  }, [search, items.length])

  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const activateRow = (index: number) => {
    if (index === createRowIndex) {
      if (!isCreating) onQuickCreate(trimmedSearch)
    } else if (items[index]) {
      onAddTask(items[index])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (rowCount === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, rowCount - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      activateRow(activeIndex)
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search or create a task..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
        />
      </div>

      <div
        ref={listRef}
        className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto"
      >
        {items.map((item, index) => {
          const priority = PRIORITY_CONFIG[item.priority]
          return (
            <button
              key={item.id}
              onClick={() => onAddTask(item)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-gray-100 last:border-b-0 transition-colors ${
                index === activeIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900 truncate">
                  {item.title}
                </div>
                {item.priority !== 'none' && (
                  <span className={`text-xs ${priority.color}`}>
                    {priority.label}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0 capitalize">
                {item.status.replace('_', ' ')}
              </span>
            </button>
          )
        })}
        {trimmedSearch && (
          <button
            onClick={() => onQuickCreate(trimmedSearch)}
            onMouseEnter={() => setActiveIndex(createRowIndex)}
            disabled={isCreating}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-gray-100 last:border-b-0 transition-colors disabled:opacity-50 ${
              activeIndex === createRowIndex ? 'bg-indigo-50' : 'hover:bg-indigo-50'
            }`}
          >
            <Plus className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <span className="text-sm text-indigo-600 truncate">
              {isCreating ? 'Creating...' : (
                <>Create &ldquo;{trimmedSearch}&rdquo; and add to queue</>
              )}
            </span>
          </button>
        )}
        {rowCount === 0 && (
          <div className="px-4 py-8 text-sm text-gray-400 text-center">
            No available tasks
          </div>
        )}
      </div>
    </div>
  )
}
