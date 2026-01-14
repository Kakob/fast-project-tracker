'use client'

import { useState, useMemo } from 'react'
import { useItems, useUpdateItem } from '@/lib/hooks/use-items'
import { PRIORITY_CONFIG, STATUS_CONFIG } from '@/types'
import type { Item } from '@/types'
import { useUIStore } from '@/lib/stores/ui-store'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function CalendarPage() {
  const { data: items, isLoading } = useItems()
  const updateItem = useUpdateItem()
  const { openDetailsPanel } = useUIStore()

  const [currentDate, setCurrentDate] = useState(new Date())

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

  // Group items by due date
  const itemsByDate = useMemo(() => {
    const map = new Map<string, Item[]>()
    items?.forEach((item) => {
      if (item.due_date) {
        const dateKey = item.due_date
        if (!map.has(dateKey)) {
          map.set(dateKey, [])
        }
        map.get(dateKey)!.push(item)
      }
    })
    return map
  }, [items])

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

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

  return (
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
                        onDragStart={handleDragStart}
                        onClick={() => openDetailsPanel(item.id)}
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
    </div>
  )
}

function CalendarItem({
  item,
  onDragStart,
  onClick,
}: {
  item: Item
  onDragStart: (e: React.DragEvent, itemId: string) => void
  onClick: () => void
}) {
  const statusConfig = STATUS_CONFIG[item.status]

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
      onClick={onClick}
      className={`text-xs px-2 py-1 rounded cursor-pointer truncate ${statusConfig.bgColor} ${statusConfig.color} hover:opacity-80`}
    >
      {item.title}
    </div>
  )
}
