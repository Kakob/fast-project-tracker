'use client'

import { useState, useRef, useEffect } from 'react'
import { Timer } from 'lucide-react'
import { useTimeEntries } from '@/lib/hooks/use-time-entries'
import { useProjects } from '@/lib/hooks/use-projects'
import { useItems } from '@/lib/hooks/use-items'
import { useUIStore } from '@/lib/stores/ui-store'
import { PROJECT_COLORS } from '@/types'
import { formatDurationShort } from '@/lib/utils'
import { startOfDay, startOfWeek } from 'date-fns'

export function TimeSummaryButton() {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [isOpen])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        title="Time summary"
      >
        <Timer className="w-5 h-5" />
      </button>
      {isOpen && <TimeSummaryPopover onClose={() => setIsOpen(false)} />}
    </div>
  )
}

function TimeSummaryPopover({ onClose }: { onClose: () => void }) {
  const { data: entries } = useTimeEntries()
  const { data: projects } = useProjects()
  const { data: items } = useItems()
  const activeTimerItemId = useUIStore((s) => s.activeTimerItemId)
  const timerElapsedSeconds = useUIStore((s) => s.timerElapsedSeconds)

  const now = new Date()
  const todayStart = startOfDay(now).getTime()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).getTime()

  // Calculate completed entry durations
  const completedEntries = entries?.filter((e) => e.duration_seconds != null) || []

  // Today's time
  const todaySeconds = completedEntries
    .filter((e) => new Date(e.started_at).getTime() >= todayStart)
    .reduce((sum, e) => sum + (e.duration_seconds || 0), 0)
    + (activeTimerItemId ? timerElapsedSeconds : 0)

  // This week's time
  const weekSeconds = completedEntries
    .filter((e) => new Date(e.started_at).getTime() >= weekStart)
    .reduce((sum, e) => sum + (e.duration_seconds || 0), 0)
    + (activeTimerItemId ? timerElapsedSeconds : 0)

  // By project
  const projectTotals = new Map<string | null, number>()
  completedEntries.forEach((entry) => {
    const item = items?.find((i) => i.id === entry.item_id)
    const projectId = item?.project_id || null
    projectTotals.set(projectId, (projectTotals.get(projectId) || 0) + (entry.duration_seconds || 0))
  })
  // Add active timer to its project
  if (activeTimerItemId) {
    const activeItem = items?.find((i) => i.id === activeTimerItemId)
    const projectId = activeItem?.project_id || null
    projectTotals.set(projectId, (projectTotals.get(projectId) || 0) + timerElapsedSeconds)
  }

  const sortedProjects = [...projectTotals.entries()].sort((a, b) => b[1] - a[1])

  // Top items by time
  const itemTotals = new Map<string, number>()
  completedEntries.forEach((entry) => {
    itemTotals.set(entry.item_id, (itemTotals.get(entry.item_id) || 0) + (entry.duration_seconds || 0))
  })
  if (activeTimerItemId) {
    itemTotals.set(activeTimerItemId, (itemTotals.get(activeTimerItemId) || 0) + timerElapsedSeconds)
  }
  const topItems = [...itemTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Time Summary</h3>

      {/* Today / This Week */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Today</p>
          <p className="text-lg font-semibold text-gray-900">{formatDurationShort(todaySeconds)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">This Week</p>
          <p className="text-lg font-semibold text-gray-900">{formatDurationShort(weekSeconds)}</p>
        </div>
      </div>

      {/* By Project */}
      {sortedProjects.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">By Project</p>
          <div className="space-y-1.5">
            {sortedProjects.map(([projectId, seconds]) => {
              const project = projectId ? projects?.find((p) => p.id === projectId) : null
              const colorConfig = project ? PROJECT_COLORS[project.color] : null
              return (
                <div key={projectId || 'none'} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        colorConfig ? colorConfig.bgColor.replace('bg-', 'bg-') : 'bg-gray-300'
                      }`}
                      style={colorConfig ? undefined : undefined}
                    />
                    <span className="text-gray-700 truncate">{project?.title || 'No project'}</span>
                  </div>
                  <span className="text-gray-500 text-xs flex-shrink-0 ml-2">{formatDurationShort(seconds)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top Items */}
      {topItems.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Top Items</p>
          <div className="space-y-1.5">
            {topItems.map(([itemId, seconds]) => {
              const item = items?.find((i) => i.id === itemId)
              return (
                <div key={itemId} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate">{item?.title || 'Unknown'}</span>
                  <span className="text-gray-500 text-xs flex-shrink-0 ml-2">{formatDurationShort(seconds)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(!entries || entries.length === 0) && !activeTimerItemId && (
        <p className="text-sm text-gray-400 text-center py-2">No time tracked yet</p>
      )}
    </div>
  )
}
