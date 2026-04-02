'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useItems, useUpdateItem } from '@/lib/hooks/use-items'
import { useProjects } from '@/lib/hooks/use-projects'
import { PRIORITY_CONFIG, PROJECT_COLORS, STATUS_CONFIG } from '@/types'
import type { Item, ItemStatus, Project } from '@/types'
import { useUIStore } from '@/lib/stores/ui-store'
import { Calendar, ChevronRight, ArchiveRestore } from 'lucide-react'
import { TimerButton } from '@/components/timer/timer-button'
import { KeyboardShortcutsHelp } from '@/components/keyboard-shortcuts-help'
import type { ShortcutGroup } from '@/components/keyboard-shortcuts-help'

const ARCHIVE_SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Archive',
    shortcuts: [
      { key: '\u2191 / \u2193', description: 'Navigate between items' },
      { key: '\u2192 / Enter', description: 'Open details panel' },
      { key: '\u2190', description: 'Close details panel' },
    ],
  },
]

export default function ArchivePage() {
  const { data: items, isLoading } = useItems()
  const { data: projects } = useProjects()
  const updateItem = useUpdateItem()
  const {
    openDetailsPanel,
    closeDetailsPanel,
    isDetailsPanelOpen,
    focusedItemId,
    setFocusedItemId,
  } = useUIStore()

  const lastFocusBeforeDetailsPanelRef = useRef<string | null>(null)

  const archivedItems = useMemo(() => {
    return (items?.filter((item) => item.status === 'archived' && !item.parent_id) || [])
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [items])

  useEffect(() => {
    if (archivedItems.length > 0 && !focusedItemId) {
      setFocusedItemId(archivedItems[0].id)
    }
  }, [archivedItems, focusedItemId, setFocusedItemId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tagName = (e.target as Element)?.tagName
      const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA'
      if (isInput && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      if (archivedItems.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const idx = archivedItems.findIndex((item) => item.id === focusedItemId)
        setFocusedItemId(archivedItems[idx < archivedItems.length - 1 ? idx + 1 : 0].id)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const idx = archivedItems.findIndex((item) => item.id === focusedItemId)
        setFocusedItemId(archivedItems[idx > 0 ? idx - 1 : archivedItems.length - 1].id)
      } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        if (focusedItemId) {
          e.preventDefault()
          lastFocusBeforeDetailsPanelRef.current = focusedItemId
          openDetailsPanel(focusedItemId)
        }
      } else if (e.key === 'ArrowLeft') {
        if (isDetailsPanelOpen) {
          e.preventDefault()
          closeDetailsPanel()
          if (lastFocusBeforeDetailsPanelRef.current) {
            setFocusedItemId(lastFocusBeforeDetailsPanelRef.current)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [archivedItems, focusedItemId, setFocusedItemId, openDetailsPanel, closeDetailsPanel, isDetailsPanelOpen])

  const handleRestore = async (itemId: string, status: ItemStatus) => {
    await updateItem.mutateAsync({ id: itemId, status })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">
            Archive
            <span className="ml-2 text-sm font-normal text-gray-500">
              {archivedItems.length} {archivedItems.length === 1 ? 'item' : 'items'}
            </span>
          </h1>
        </div>

        {archivedItems.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            No archived items
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {archivedItems.map((item) => {
              const project = projects?.find((p) => p.id === item.project_id)
              const projectColor = project ? PROJECT_COLORS[project.color] : null
              const priorityConfig = PRIORITY_CONFIG[item.priority]
              const isFocused = focusedItemId === item.id

              return (
                <div
                  key={item.id}
                  onClick={() => openDetailsPanel(item.id)}
                  onMouseEnter={() => setFocusedItemId(item.id)}
                  className={`bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow ${
                    isFocused ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
                  }`}
                >
                  {project && projectColor && (
                    <span
                      className={`px-1.5 py-0.5 text-xs font-medium rounded truncate inline-block max-w-full mb-1.5 ${projectColor.bgColor} ${projectColor.textColor}`}
                    >
                      {project.title}
                    </span>
                  )}

                  <h3 className="text-sm font-medium text-gray-900 mb-2">{item.title}</h3>

                  <div className="flex items-center gap-2 flex-wrap">
                    {item.priority !== 'none' && (
                      <span
                        className={`px-1.5 py-0.5 text-xs font-medium rounded ${priorityConfig.bgColor} ${priorityConfig.color}`}
                      >
                        {priorityConfig.label}
                      </span>
                    )}

                    {item.due_date && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.due_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}

                    {(items?.filter((i) => i.parent_id === item.id).length || 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-gray-500">
                        <ChevronRight className="w-3 h-3" />
                        {items?.filter((i) => i.parent_id === item.id).length}
                      </span>
                    )}

                    <TimerButton itemId={item.id} size="sm" />

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRestore(item.id, 'todo')
                      }}
                      className="ml-auto p-1 text-gray-400 hover:text-indigo-600 rounded"
                      title="Restore to Todo"
                    >
                      <ArchiveRestore className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <KeyboardShortcutsHelp groups={ARCHIVE_SHORTCUTS} />
    </>
  )
}
