'use client'

import { useState, useEffect } from 'react'
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

  // Sync local state with item data
  useEffect(() => {
    if (item) {
      setTitle(item.title)
      setDescription(item.description || '')
    }
  }, [item])

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

  const handleTitleBlur = async () => {
    if (item && title !== item.title && title.trim()) {
      await updateItem.mutateAsync({ id: item.id, title: title.trim() })
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
      <div className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-xl z-50 flex flex-col">
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
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
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
