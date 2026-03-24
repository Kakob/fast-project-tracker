'use client'

import { useEffect, useRef, useMemo } from 'react'
import { useItems, useUpdateItem } from '@/lib/hooks/use-items'
import { STATUS_ORDER, STATUS_CONFIG, PRIORITY_CONFIG } from '@/types'
import type { Item, ItemStatus } from '@/types'
import { useUIStore } from '@/lib/stores/ui-store'
import { Calendar, ChevronRight } from 'lucide-react'
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

export default function BoardPage() {
  const { data: items, isLoading } = useItems()
  const updateItem = useUpdateItem()
  const {
    openDetailsPanel,
    closeDetailsPanel,
    isDetailsPanelOpen,
    focusedItemId,
    setFocusedItemId,
  } = useUIStore()

  const lastFocusBeforeDetailsPanelRef = useRef<string | null>(null)

  // Group items by status (only show root items, not children)
  const itemsByStatus = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = items?.filter((item) => item.status === status && !item.parent_id) || []
    return acc
  }, {} as Record<ItemStatus, Item[]>)

  // Build flat focusable items array ordered by STATUS_ORDER columns, top-to-bottom within each
  const focusableItems = useMemo(() => {
    const result: Item[] = []
    for (const status of STATUS_ORDER) {
      const statusItems = items?.filter((item) => item.status === status && !item.parent_id) || []
      result.push(...statusItems)
    }
    return result
  }, [items])

  // Focus first item on mount (when items load)
  useEffect(() => {
    if (focusableItems.length > 0 && !focusedItemId) {
      setFocusedItemId(focusableItems[0].id)
    }
  }, [focusableItems, focusedItemId, setFocusedItemId])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tagName = (e.target as Element)?.tagName
      const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA'

      // Allow ArrowUp/ArrowDown even in inputs; block other shortcuts in inputs
      if (isInput && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
        return
      }

      if (focusableItems.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const currentIndex = focusableItems.findIndex((item) => item.id === focusedItemId)
        const nextIndex = currentIndex < focusableItems.length - 1 ? currentIndex + 1 : 0
        setFocusedItemId(focusableItems[nextIndex].id)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const currentIndex = focusableItems.findIndex((item) => item.id === focusedItemId)
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusableItems.length - 1
        setFocusedItemId(focusableItems[prevIndex].id)
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
          if (prev) {
            setFocusedItemId(prev)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    focusableItems,
    focusedItemId,
    setFocusedItemId,
    openDetailsPanel,
    closeDetailsPanel,
    isDetailsPanelOpen,
  ])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const handleStatusChange = async (itemId: string, newStatus: ItemStatus) => {
    await updateItem.mutateAsync({ id: itemId, status: newStatus })
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
      await handleStatusChange(itemId, status)
    }
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-4 h-[calc(100vh-8rem)]">
        {STATUS_ORDER.map((status) => (
          <div
            key={status}
            className="flex flex-col bg-gray-100 rounded-lg"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            {/* Column Header */}
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

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {itemsByStatus[status].map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
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
      <KeyboardShortcutsHelp groups={BOARD_SHORTCUTS} />
    </>
  )
}

function ItemCard({
  item,
  onDragStart,
  onClick,
  childCount,
  isFocused,
  onMouseEnter,
}: {
  item: Item
  onDragStart: (e: React.DragEvent, itemId: string) => void
  onClick: () => void
  childCount: number
  isFocused: boolean
  onMouseEnter: () => void
}) {
  const priorityConfig = PRIORITY_CONFIG[item.priority]

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
      {/* Title */}
      <h3 className="text-sm font-medium text-gray-900 mb-2">{item.title}</h3>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Priority */}
        {item.priority !== 'none' && (
          <span
            className={`px-1.5 py-0.5 text-xs font-medium rounded ${priorityConfig.bgColor} ${priorityConfig.color}`}
          >
            {priorityConfig.label}
          </span>
        )}

        {/* Due date */}
        {item.due_date && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="w-3 h-3" />
            {new Date(item.due_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}

        {/* Child count */}
        {childCount > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-gray-500">
            <ChevronRight className="w-3 h-3" />
            {childCount}
          </span>
        )}
      </div>
    </div>
  )
}
