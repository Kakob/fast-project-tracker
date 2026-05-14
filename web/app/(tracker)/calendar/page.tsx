'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useItems, useUpdateItem } from '@/lib/hooks/use-items'
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/types'
import type { Item } from '@/types'
import { useUIStore } from '@/lib/stores/ui-store'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { KeyboardShortcutsHelp } from '@/components/keyboard-shortcuts-help'
import type { ShortcutGroup } from '@/components/keyboard-shortcuts-help'
import { WeekView } from '@/components/views/week-view'

type CalendarMode = 'month' | 'week'

const CALENDAR_SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Calendar',
    shortcuts: [
      { key: '\u2191 / \u2193', description: 'Navigate between items (month view)' },
      { key: '\u2192 / Enter', description: 'Open details panel' },
      { key: '\u2190', description: 'Close details panel' },
      { key: '[', description: 'Previous month / week' },
      { key: ']', description: 'Next month / week' },
      { key: 't', description: 'Go to today' },
      { key: 'w', description: 'Toggle week / month view' },
    ],
  },
]

export default function CalendarPage() {
  const { data: items, isLoading } = useItems()
  const updateItem = useUpdateItem()
  const {
    openDetailsPanel,
    closeDetailsPanel,
    isDetailsPanelOpen,
    focusedItemId,
    setFocusedItemId,
  } = useUIStore()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [mode, setMode] = useState<CalendarMode>('week')
  const lastFocusBeforeDetailsPanelRef = useRef<string | null>(null)

  const { year, month, days, firstDayOfWeek } = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const firstDayOfWeek = firstDay.getDay()

    const days: (number | null)[] = []
    // Add empty slots for days before the first day
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null)
    }
    // Add the days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    return { year, month, days, firstDayOfWeek }
  }, [currentDate])

  // Group items by due date (exclude archived)
  const itemsByDate = useMemo(() => {
    const map = new Map<string, Item[]>()
    items?.forEach((item) => {
      if (item.due_date && item.status !== 'archived') {
        const dateKey = item.due_date
        if (!map.has(dateKey)) {
          map.set(dateKey, [])
        }
        map.get(dateKey)!.push(item)
      }
    })
    return map
  }, [items])

  // Build flat focusable items array sorted by date then position
  const focusableItems = useMemo(() => {
    const result: Item[] = []
    const sortedKeys = Array.from(itemsByDate.keys()).sort()
    for (const dateKey of sortedKeys) {
      const dayItems = itemsByDate.get(dateKey)!
      const sorted = [...dayItems].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      result.push(...sorted)
    }
    return result
  }, [itemsByDate])

  // Focus first item on mount
  useEffect(() => {
    if (focusableItems.length > 0 && !focusedItemId) {
      setFocusedItemId(focusableItems[0].id)
    }
  }, [focusableItems, focusedItemId, setFocusedItemId])

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const goToPreviousWeek = () => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - 7)
    setCurrentDate(d)
  }

  const goToNextWeek = () => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + 7)
    setCurrentDate(d)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const goPrev = () => (mode === 'month' ? goToPreviousMonth() : goToPreviousWeek())
  const goNext = () => (mode === 'month' ? goToNextMonth() : goToNextWeek())

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const tagName = target.tagName

      // Allow ArrowUp/ArrowDown in inputs, block other shortcuts
      const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA'
      if (isInput && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
        return
      }

      // Item-list keyboard nav only applies in month mode
      if (mode === 'month') {
        switch (e.key) {
          case 'ArrowUp': {
            e.preventDefault()
            if (focusableItems.length === 0) return
            const currentIndex = focusableItems.findIndex((item) => item.id === focusedItemId)
            const prevIndex = currentIndex <= 0 ? focusableItems.length - 1 : currentIndex - 1
            setFocusedItemId(focusableItems[prevIndex].id)
            return
          }
          case 'ArrowDown': {
            e.preventDefault()
            if (focusableItems.length === 0) return
            const currentIndex = focusableItems.findIndex((item) => item.id === focusedItemId)
            const nextIndex = currentIndex >= focusableItems.length - 1 ? 0 : currentIndex + 1
            setFocusedItemId(focusableItems[nextIndex].id)
            return
          }
          case 'Enter':
          case 'ArrowRight': {
            if (focusedItemId) {
              e.preventDefault()
              lastFocusBeforeDetailsPanelRef.current = focusedItemId
              openDetailsPanel(focusedItemId)
            }
            return
          }
          case 'ArrowLeft': {
            if (isDetailsPanelOpen) {
              e.preventDefault()
              closeDetailsPanel()
              if (lastFocusBeforeDetailsPanelRef.current) {
                setFocusedItemId(lastFocusBeforeDetailsPanelRef.current)
                lastFocusBeforeDetailsPanelRef.current = null
              }
            }
            return
          }
        }
      }

      switch (e.key) {
        case '[': {
          e.preventDefault()
          mode === 'month' ? goToPreviousMonth() : goToPreviousWeek()
          break
        }
        case ']': {
          e.preventDefault()
          mode === 'month' ? goToNextMonth() : goToNextWeek()
          break
        }
        case 't': {
          e.preventDefault()
          goToToday()
          break
        }
        case 'w': {
          e.preventDefault()
          setMode((m) => (m === 'month' ? 'week' : 'month'))
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    mode,
    focusableItems,
    focusedItemId,
    setFocusedItemId,
    openDetailsPanel,
    closeDetailsPanel,
    isDetailsPanelOpen,
    currentDate,
  ])

  const handleDrop = async (e: React.DragEvent, day: number) => {
    e.preventDefault()
    const itemId = e.dataTransfer.getData('itemId')
    if (itemId && day) {
      const newDueDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      await updateItem.mutateAsync({ id: itemId, due_date: newDueDate })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('itemId', itemId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const today = new Date()
  const isToday = (day: number | null) =>
    day !== null &&
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const modeToggle = (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
      {(['month', 'week'] as CalendarMode[]).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`px-3 py-1 text-sm font-medium rounded-md capitalize transition-colors ${
            mode === m
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  )

  if (mode === 'week') {
    return (
      <>
        <div className="flex items-center justify-end mb-3">{modeToggle}</div>
        <WeekView
          items={items}
          currentDate={currentDate}
          onPrevWeek={goToPreviousWeek}
          onNextWeek={goToNextWeek}
          onToday={goToToday}
        />
        <KeyboardShortcutsHelp groups={CALENDAR_SHORTCUTS} />
      </>
    )
  }

  return (
    <>
      <div className="flex items-center justify-end mb-3">{modeToggle}</div>
      <div className="bg-white rounded-lg border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {monthNames[month]} {year}
            </h2>
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg"
            >
              Today
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousMonth}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToNextMonth}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {dayNames.map((day) => (
          <div
            key={day}
            className="px-2 py-3 text-center text-sm font-medium text-gray-500"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dateKey = day
            ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            : null
          const dayItems = dateKey ? itemsByDate.get(dateKey) || [] : []

          return (
            <div
              key={index}
              className={`min-h-[120px] border-b border-r border-gray-100 p-2 ${
                day === null ? 'bg-gray-50' : ''
              }`}
              onDragOver={day ? handleDragOver : undefined}
              onDrop={day ? (e) => handleDrop(e, day) : undefined}
            >
              {day !== null && (
                <>
                  <div
                    className={`text-sm font-medium mb-1 ${
                      isToday(day)
                        ? 'w-7 h-7 flex items-center justify-center bg-indigo-600 text-white rounded-full'
                        : 'text-gray-700'
                    }`}
                  >
                    {day}
                  </div>
                  <div className="space-y-1">
                    {dayItems.slice(0, 3).map((item) => (
                      <CalendarItem
                        key={item.id}
                        item={item}
                        isFocused={focusedItemId === item.id}
                        onDragStart={handleDragStart}
                        onClick={() => openDetailsPanel(item.id)}
                        onMouseEnter={() => setFocusedItemId(item.id)}
                      />
                    ))}
                    {dayItems.length > 3 && (
                      <div className="text-xs text-gray-500 pl-1">
                        +{dayItems.length - 3} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

        <KeyboardShortcutsHelp groups={CALENDAR_SHORTCUTS} />
      </div>
    </>
  )
}

function CalendarItem({
  item,
  isFocused,
  onDragStart,
  onClick,
  onMouseEnter,
}: {
  item: Item
  isFocused: boolean
  onDragStart: (e: React.DragEvent, itemId: string) => void
  onClick: () => void
  onMouseEnter: () => void
}) {
  const statusConfig = STATUS_CONFIG[item.status]

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`text-xs px-2 py-1 rounded cursor-pointer truncate ${statusConfig.bgColor} ${statusConfig.color} hover:opacity-80 ${
        isFocused ? 'ring-2 ring-indigo-500 ring-offset-1' : ''
      }`}
    >
      {item.title}
    </div>
  )
}
