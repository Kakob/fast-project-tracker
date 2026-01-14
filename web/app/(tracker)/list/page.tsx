'use client'

import { useState, useRef, useEffect } from 'react'
import { useItems, useCreateItem, useUpdateItem, useDeleteItem, buildItemTree, flattenItemTree } from '@/lib/hooks/use-items'
import { useProjects } from '@/lib/hooks/use-projects'
import { STATUS_CONFIG, PRIORITY_CONFIG, PROJECT_COLORS } from '@/types'
import type { ItemWithChildren, ItemStatus, ItemPriority, Project } from '@/types'
import { useUIStore } from '@/lib/stores/ui-store'
import { ChevronRight, ChevronDown, Plus, Trash2, Calendar } from 'lucide-react'

export default function ListPage() {
  const { data: items, isLoading } = useItems()
  const { data: projects } = useProjects()
  const createItem = useCreateItem()
  const updateItem = useUpdateItem()
  const deleteItem = useDeleteItem()
  const { expandedItemIds, toggleExpanded, editingItemId, setEditingItemId, openDetailsPanel } = useUIStore()

  const [newItemTitle, setNewItemTitle] = useState('')
  const newItemRef = useRef<HTMLInputElement>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const tree = buildItemTree(items || [])
  const flatItems = flattenItemTree(tree)

  const handleCreateItem = async (parentId?: string) => {
    if (!newItemTitle.trim()) return
    await createItem.mutateAsync({
      title: newItemTitle.trim(),
      parent_id: parentId || null,
    })
    setNewItemTitle('')
  }

  const handleTitleChange = async (id: string, title: string) => {
    if (!title.trim()) return
    await updateItem.mutateAsync({ id, title: title.trim() })
    setEditingItemId(null)
  }

  const handleStatusCycle = async (item: ItemWithChildren) => {
    const statuses: ItemStatus[] = ['todo', 'in_progress', 'done']
    const currentIndex = statuses.indexOf(item.status)
    const nextStatus = statuses[(currentIndex + 1) % statuses.length]
    await updateItem.mutateAsync({ id: item.id, status: nextStatus })
  }

  const handleDelete = async (id: string) => {
    await deleteItem.mutateAsync(id)
  }

  // Filter to only show visible items (based on expanded state)
  const visibleItems = flatItems.filter((item) => {
    if (!item.parent_id) return true
    // Check if all ancestors are expanded
    let current = items?.find((i) => i.id === item.parent_id)
    while (current) {
      if (!expandedItemIds.has(current.id)) return false
      current = items?.find((i) => i.id === current?.parent_id)
    }
    return true
  })

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-200 bg-gray-50 text-sm font-medium text-gray-500">
        <div className="col-span-5">Title</div>
        <div className="col-span-2">Project</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">Priority</div>
        <div className="col-span-1">Due</div>
      </div>

      {/* Items */}
      <div className="divide-y divide-gray-100">
        {visibleItems.map((item) => (
          <ListRow
            key={item.id}
            item={item}
            project={projects?.find((p) => p.id === item.project_id)}
            isExpanded={expandedItemIds.has(item.id)}
            isEditing={editingItemId === item.id}
            onToggleExpand={() => toggleExpanded(item.id)}
            onStartEdit={() => setEditingItemId(item.id)}
            onTitleChange={(title) => handleTitleChange(item.id, title)}
            onStatusCycle={() => handleStatusCycle(item)}
            onDelete={() => handleDelete(item.id)}
            onClick={() => openDetailsPanel(item.id)}
          />
        ))}

        {visibleItems.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No items yet. Add one below!
          </div>
        )}
      </div>

      {/* Add new item row */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-200">
        <Plus className="w-4 h-4 text-gray-400" />
        <input
          ref={newItemRef}
          type="text"
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCreateItem()
            }
          }}
          placeholder="Add new item..."
          className="flex-1 text-sm border-0 focus:ring-0 p-0 bg-transparent text-gray-900 placeholder-gray-400"
        />
      </div>
    </div>
  )
}

function ListRow({
  item,
  project,
  isExpanded,
  isEditing,
  onToggleExpand,
  onStartEdit,
  onTitleChange,
  onStatusCycle,
  onDelete,
  onClick,
}: {
  item: ItemWithChildren
  project?: Project
  isExpanded: boolean
  isEditing: boolean
  onToggleExpand: () => void
  onStartEdit: () => void
  onTitleChange: (title: string) => void
  onStatusCycle: () => void
  onDelete: () => void
  onClick: () => void
}) {
  const [editValue, setEditValue] = useState(item.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const hasChildren = item.children.length > 0
  const statusConfig = STATUS_CONFIG[item.status]
  const priorityConfig = PRIORITY_CONFIG[item.priority]

  const projectColor = project ? PROJECT_COLORS[project.color] : null

  return (
    <div
      className="grid grid-cols-12 gap-4 px-4 py-2 items-center hover:bg-gray-50 group"
      style={{ paddingLeft: `${1 + item.depth * 1.5}rem` }}
    >
      {/* Title */}
      <div className="col-span-5 flex items-center gap-2">
        {/* Expand/collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand()
          }}
          className={`w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 ${
            !hasChildren ? 'invisible' : ''
          }`}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {/* Title (editable) */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => onTitleChange(editValue)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onTitleChange(editValue)
              } else if (e.key === 'Escape') {
                setEditValue(item.title)
                onTitleChange(item.title)
              }
            }}
            className="flex-1 text-sm border border-indigo-500 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-200"
          />
        ) : (
          <span
            className={`text-sm cursor-pointer hover:text-indigo-600 ${
              item.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'
            }`}
            onClick={onClick}
            onDoubleClick={(e) => {
              e.stopPropagation()
              onStartEdit()
            }}
          >
            {item.title}
          </span>
        )}

        {/* Delete button (shown on hover) */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Project */}
      <div className="col-span-2">
        {project && projectColor && (
          <span
            className={`px-2 py-1 text-xs font-medium rounded truncate inline-block max-w-full ${projectColor.bgColor} ${projectColor.textColor}`}
          >
            {project.title}
          </span>
        )}
      </div>

      {/* Status */}
      <div className="col-span-2">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onStatusCycle()
          }}
          className={`px-2 py-1 text-xs font-medium rounded ${statusConfig.bgColor} ${statusConfig.color} hover:opacity-80`}
        >
          {statusConfig.label}
        </button>
      </div>

      {/* Priority */}
      <div className="col-span-2">
        {item.priority !== 'none' && (
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${priorityConfig.bgColor} ${priorityConfig.color}`}
          >
            {priorityConfig.label}
          </span>
        )}
      </div>

      {/* Due Date */}
      <div className="col-span-1 text-sm text-gray-500">
        {item.due_date && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(item.due_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}
      </div>
    </div>
  )
}
