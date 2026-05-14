'use client'

import { useState, useEffect, useRef } from 'react'
import { useItem, useUpdateItem, useDeleteItem, useItems } from '@/lib/hooks/use-items'
import { useProjects } from '@/lib/hooks/use-projects'
import { useUIStore } from '@/lib/stores/ui-store'
import { STATUS_CONFIG, PRIORITY_CONFIG, STATUS_ORDER, PROJECT_COLORS } from '@/types'
import type { ItemStatus, ItemPriority } from '@/types'
import { useTimeEntriesByItem, useDeleteTimeEntry } from '@/lib/hooks/use-time-entries'
import { TimerButton } from '@/components/timer/timer-button'
import { formatDuration, formatDurationShort } from '@/lib/utils'
import { X, Trash2, Calendar, ChevronDown, FolderOpen, Clock } from 'lucide-react'

export function ItemDetailsPanel() {
  const { selectedItemId, isDetailsPanelOpen, closeDetailsPanel } = useUIStore()
  const autoClearTitleItemId = useUIStore((s) => s.autoClearTitleItemId)
  const setAutoClearTitleItemId = useUIStore((s) => s.setAutoClearTitleItemId)
  const { data: item, isLoading } = useItem(selectedItemId)
  const { data: allItems } = useItems()
  const { data: projects } = useProjects()
  const updateItem = useUpdateItem()
  const deleteItem = useDeleteItem()
  const { data: timeEntries } = useTimeEntriesByItem(selectedItemId)
  const deleteTimeEntry = useDeleteTimeEntry()
  const timerElapsedSeconds = useUIStore((s) => s.timerElapsedSeconds)
  const activeTimerItemId = useUIStore((s) => s.activeTimerItemId)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Sync local state with item data
  useEffect(() => {
    if (item) {
      setTitle(item.title)
      setDescription(item.description || '')
    }
  }, [item])

  // Auto-focus the title input when opened with a freshly-created task
  useEffect(() => {
    if (item && autoClearTitleItemId === item.id) {
      titleInputRef.current?.focus()
    }
  }, [item, autoClearTitleItemId])

  // Close panel on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDetailsPanelOpen) {
        closeDetailsPanel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDetailsPanelOpen, closeDetailsPanel])

  // Trap Tab focus inside the panel while it's open
  useEffect(() => {
    if (!isDetailsPanelOpen) return
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (!panel.contains(active)) {
        e.preventDefault()
        first.focus()
        return
      }
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleTab)
    return () => window.removeEventListener('keydown', handleTab)
  }, [isDetailsPanelOpen])

  const handleTitleBlur = async () => {
    if (item && title !== item.title && title.trim()) {
      await updateItem.mutateAsync({ id: item.id, title: title.trim() })
    }
  }

  const handleTitleFocus = () => {
    if (item && autoClearTitleItemId === item.id) {
      setTitle('')
      setAutoClearTitleItemId(null)
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleTitleBlur()
      closeDetailsPanel()
    }
  }

  const handleDescriptionBlur = async () => {
    if (item && description !== (item.description || '')) {
      await updateItem.mutateAsync({ id: item.id, description: description || null })
    }
  }

  const handleStatusChange = async (status: ItemStatus) => {
    if (item) {
      await updateItem.mutateAsync({ id: item.id, status })
    }
  }

  const handlePriorityChange = async (priority: ItemPriority) => {
    if (item) {
      await updateItem.mutateAsync({ id: item.id, priority })
    }
  }

  const handleDueDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (item) {
      const value = e.target.value || null
      await updateItem.mutateAsync({ id: item.id, due_date: value })
    }
  }

  const handleScheduledStartChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!item) return
    const value = e.target.value
    // datetime-local gives "YYYY-MM-DDTHH:mm" with no timezone — interpret as local
    const iso = value ? new Date(value).toISOString() : null
    await updateItem.mutateAsync({ id: item.id, scheduled_start: iso })
  }

  const handleDurationChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!item) return
    const minutes = Math.max(5, Math.round(Number(e.target.value) / 5) * 5)
    await updateItem.mutateAsync({ id: item.id, duration_minutes: minutes })
  }

  const handleProjectChange = async (projectId: string | null) => {
    if (item) {
      await updateItem.mutateAsync({ id: item.id, project_id: projectId })
    }
  }

  const handleDelete = async () => {
    if (item && confirm('Are you sure you want to delete this item?')) {
      await deleteItem.mutateAsync(item.id)
      closeDetailsPanel()
    }
  }

  // Get current project
  const currentProject = item?.project_id ? projects?.find((p) => p.id === item.project_id) : null
  const projectColorConfig = currentProject ? PROJECT_COLORS[currentProject.color] : null

  // Get child items
  const childItems = allItems?.filter((i) => i.parent_id === item?.id) || []

  if (!isDetailsPanelOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={closeDetailsPanel}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Item Details</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="p-2 text-gray-400 hover:text-red-500 rounded-lg"
              title="Delete item"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={closeDetailsPanel}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : item ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Title */}
            <div>
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onFocus={handleTitleFocus}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                className="w-full text-xl font-semibold text-gray-900 border-0 p-0 focus:ring-0 placeholder-gray-400"
                placeholder="Item title"
              />
            </div>

            {/* Status & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  Status
                </label>
                <div className="relative">
                  <select
                    value={item.status}
                    onChange={(e) => handleStatusChange(e.target.value as ItemStatus)}
                    className={`w-full appearance-none px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium ${STATUS_CONFIG[item.status].bgColor} ${STATUS_CONFIG[item.status].color}`}
                  >
                    {STATUS_ORDER.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_CONFIG[status].label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  Priority
                </label>
                <div className="relative">
                  <select
                    value={item.priority}
                    onChange={(e) => handlePriorityChange(e.target.value as ItemPriority)}
                    className={`w-full appearance-none px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium ${PRIORITY_CONFIG[item.priority].bgColor} ${PRIORITY_CONFIG[item.priority].color}`}
                  >
                    {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => (
                      <option key={priority} value={priority}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">
                Due Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={item.due_date || ''}
                  onChange={handleDueDateChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Scheduled time (week view) */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  Scheduled
                </label>
                <input
                  type="datetime-local"
                  step={300}
                  value={toLocalDatetimeInput(item.scheduled_start)}
                  onChange={handleScheduledStartChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  Duration (min)
                </label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={item.duration_minutes ?? 30}
                  onChange={handleDurationChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                />
              </div>
            </div>

            {/* Project */}
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">
                Project
              </label>
              <div className="relative">
                <select
                  value={item.project_id || ''}
                  onChange={(e) => handleProjectChange(e.target.value || null)}
                  className={`w-full appearance-none px-3 py-2 pl-9 rounded-lg border border-gray-200 text-sm font-medium ${
                    projectColorConfig
                      ? `${projectColorConfig.bgColor} ${projectColorConfig.textColor}`
                      : 'bg-white text-gray-600'
                  }`}
                >
                  <option value="">No project</option>
                  {projects?.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
                placeholder="Add a description..."
              />
            </div>

            {/* Time Tracking */}
            {item && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  Time Tracking
                </label>
                <div className="space-y-3">
                  {/* Timer button + total time */}
                  <div className="flex items-center justify-between">
                    <TimerButton itemId={item.id} size="md" />
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span>
                        Total:{' '}
                        {formatDurationShort(
                          (timeEntries?.reduce((sum, e) => sum + (e.duration_seconds || 0), 0) || 0) +
                          (activeTimerItemId === item.id ? timerElapsedSeconds : 0)
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Recent time entries */}
                  {timeEntries && timeEntries.length > 0 && (
                    <div className="space-y-1.5">
                      {timeEntries.slice(0, 10).map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded text-xs group/entry"
                        >
                          <div className="flex items-center gap-2 text-gray-600">
                            <span>
                              {new Date(entry.started_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <span className="text-gray-400">
                              {new Date(entry.started_at).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-gray-700">
                              {entry.duration_seconds != null
                                ? formatDuration(entry.duration_seconds)
                                : formatDuration(timerElapsedSeconds)}
                            </span>
                            {entry.ended_at && (
                              <button
                                onClick={() => deleteTimeEntry.mutate(entry.id)}
                                className="opacity-0 group-hover/entry:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-opacity"
                                title="Delete entry"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Child items */}
            {childItems.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  Sub-items ({childItems.length})
                </label>
                <div className="space-y-2">
                  {childItems.map((child) => (
                    <div
                      key={child.id}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          child.status === 'done'
                            ? 'bg-green-500'
                            : child.status === 'in_progress'
                            ? 'bg-blue-500'
                            : 'bg-gray-300'
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          child.status === 'done'
                            ? 'text-gray-400 line-through'
                            : 'text-gray-700'
                        }`}
                      >
                        {child.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="pt-4 border-t border-gray-200 text-xs text-gray-400 space-y-1">
              <p>Created: {new Date(item.created_at).toLocaleString()}</p>
              <p>Updated: {new Date(item.updated_at).toLocaleString()}</p>
              {item.completed_at && (
                <p>Completed: {new Date(item.completed_at).toLocaleString()}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Item not found
          </div>
        )}
      </div>
    </>
  )
}

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
