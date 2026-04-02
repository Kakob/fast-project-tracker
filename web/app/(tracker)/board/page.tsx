'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useItems, useUpdateItem } from '@/lib/hooks/use-items'
import { useProjects } from '@/lib/hooks/use-projects'
import { STATUS_CONFIG, PRIORITY_CONFIG, PROJECT_COLORS } from '@/types'
import type { Item, ItemStatus, Project } from '@/types'
import { useUIStore } from '@/lib/stores/ui-store'
import { Calendar, ChevronRight, Archive } from 'lucide-react'
import { TimerButton } from '@/components/timer/timer-button'
import { KeyboardShortcutsHelp } from '@/components/keyboard-shortcuts-help'
import type { ShortcutGroup } from '@/components/keyboard-shortcuts-help'

const BOARD_SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'Board',
    shortcuts: [
      { key: '\u2191 / \u2193', description: 'Navigate between cards' },
      { key: '\u2192 / Enter', description: 'Open details panel' },
      { key: '\u2190', description: 'Close details panel' },
    ],
  },
]

const ACTIVE_STATUSES: ItemStatus[] = ['todo', 'in_progress', 'done']

export default function BoardPage() {
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
  const [archiveHover, setArchiveHover] = useState(false)

  // Group non-archived items by status (only root items)
  const itemsByStatus = ACTIVE_STATUSES.reduce((acc, status) => {
    acc[status] = items?.filter((item) => item.status === status && !item.parent_id) || []
    return acc
  }, {} as Record<ItemStatus, Item[]>)

  const focusableItems = useMemo(() => {
    const result: Item[] = []
    for (const status of ACTIVE_STATUSES) {
      const statusItems = items?.filter((item) => item.status === status && !item.parent_id) || []
      result.push(...statusItems)
    }
    return result
  }, [items])

  useEffect(() => {
    if (focusableItems.length > 0 && !focusedItemId) {
      setFocusedItemId(focusableItems[0].id)
    }
  }, [focusableItems, focusedItemId, setFocusedItemId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tagName = (e.target as Element)?.tagName
      const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA'
      if (isInput && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      if (focusableItems.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const idx = focusableItems.findIndex((item) => item.id === focusedItemId)
        setFocusedItemId(focusableItems[idx < focusableItems.length - 1 ? idx + 1 : 0].id)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const idx = focusableItems.findIndex((item) => item.id === focusedItemId)
        setFocusedItemId(focusableItems[idx > 0 ? idx - 1 : focusableItems.length - 1].id)
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
          const prev = lastFocusBeforeDetailsPanelRef.current
          if (prev) setFocusedItemId(prev)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusableItems, focusedItemId, setFocusedItemId, openDetailsPanel, closeDetailsPanel, isDetailsPanelOpen])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('itemId', itemId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, status: ItemStatus) => {
    e.preventDefault()
    const itemId = e.dataTransfer.getData('itemId')
    if (itemId) {
      await updateItem.mutateAsync({ id: itemId, status })
    }
  }

  const handleArchiveDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setArchiveHover(false)
    const itemId = e.dataTransfer.getData('itemId')
    if (itemId) {
      await updateItem.mutateAsync({ id: itemId, status: 'archived' })
    }
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-4 h-[calc(100vh-8rem)]">
        {ACTIVE_STATUSES.map((status) => (
          <div
            key={status}
            className="flex flex-col bg-gray-100 rounded-lg"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_CONFIG[status].bgColor} ${STATUS_CONFIG[status].color}`}
                >
                  {STATUS_CONFIG[status].label}
                </span>
                <span className="text-sm text-gray-500">
                  {itemsByStatus[status].length}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {itemsByStatus[status].map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  project={projects?.find((p) => p.id === item.project_id)}
                  onDragStart={handleDragStart}
                  onClick={() => openDetailsPanel(item.id)}
                  childCount={items?.filter((i) => i.parent_id === item.id).length || 0}
                  isFocused={focusedItemId === item.id}
                  onMouseEnter={() => setFocusedItemId(item.id)}
                />
              ))}

              {itemsByStatus[status].length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No items
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Archive drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setArchiveHover(true)
        }}
        onDragLeave={() => setArchiveHover(false)}
        onDrop={handleArchiveDrop}
        className={`mt-3 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed transition-colors ${
          archiveHover
            ? 'border-red-400 bg-red-50 text-red-600'
            : 'border-gray-300 text-gray-400'
        }`}
      >
        <Archive className="w-4 h-4" />
        <span className="text-sm font-medium">
          {archiveHover ? 'Drop to archive' : 'Drag here to archive'}
        </span>
      </div>

      <KeyboardShortcutsHelp groups={BOARD_SHORTCUTS} />
    </>
  )
}

function ItemCard({
  item,
  project,
  onDragStart,
  onClick,
  childCount,
  isFocused,
  onMouseEnter,
}: {
  item: Item
  project?: Project
  onDragStart: (e: React.DragEvent, itemId: string) => void
  onClick: () => void
  childCount: number
  isFocused: boolean
  onMouseEnter: () => void
}) {
  const priorityConfig = PRIORITY_CONFIG[item.priority]
  const projectColor = project ? PROJECT_COLORS[project.color] : null

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
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

        {childCount > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-gray-500">
            <ChevronRight className="w-3 h-3" />
            {childCount}
          </span>
        )}

        <TimerButton itemId={item.id} size="sm" />
      </div>
    </div>
  )
}
