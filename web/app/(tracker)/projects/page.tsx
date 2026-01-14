'use client'

import { useState, useRef, useEffect } from 'react'
import { useProjects, useCreateProject, useDeleteProject } from '@/lib/hooks/use-projects'
import { useItems, useCreateItem, buildItemTree } from '@/lib/hooks/use-items'
import { PROJECT_COLORS, STATUS_CONFIG } from '@/types'
import type { Project, Item, ItemWithChildren, ProjectColor } from '@/types'
import { useUIStore } from '@/lib/stores/ui-store'
import { ChevronRight, ChevronDown, Plus, Trash2, FolderOpen, Inbox } from 'lucide-react'

type FocusableItem = {
  type: 'create-project' | 'project' | 'item'
  id: string
  projectId?: string
}

export default function ProjectsPage() {
  const { data: projects, isLoading: projectsLoading } = useProjects()
  const { data: items, isLoading: itemsLoading } = useItems()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()
  const createItem = useCreateItem()
  const {
    expandedProjectIds,
    expandedItemIds,
    toggleProjectExpanded,
    toggleExpanded,
    openDetailsPanel,
    closeDetailsPanel,
    isDetailsPanelOpen,
    focusedItemId,
    focusedProjectId,
    setFocusedItemId,
    setFocusedProjectId,
  } = useUIStore()

  const [newProjectTitle, setNewProjectTitle] = useState('')
  const [selectedColor, setSelectedColor] = useState<ProjectColor>('blue')
  // Subtask add/edit state (global across projects/unassigned)
  const [addingSubtaskForItemId, setAddingSubtaskForItemId] = useState<string | null>(null)
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string>>({})
  const [addingTaskForProjectId, setAddingTaskForProjectId] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isCreateProjectFocused, setIsCreateProjectFocused] = useState(false)
  const subtaskInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const taskInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const createProjectInputRef = useRef<HTMLInputElement>(null)
  const lastFocusBeforeDetailsPanelRef = useRef<{
    focusedItemId: string | null
    focusedProjectId: string | null
    isCreateProjectFocused: boolean
  } | null>(null)
  const isLoading = projectsLoading || itemsLoading

  // Group items by project (only root items - items without parents)
  const rootItemsByProject = new Map<string | null, Item[]>()
  items?.forEach((item) => {
    // Only include root items (no parent) in project grouping
    if (!item.parent_id) {
      const key = item.project_id
      if (!rootItemsByProject.has(key)) {
        rootItemsByProject.set(key, [])
      }
      rootItemsByProject.get(key)!.push(item)
    }
  })

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) return
    await createProject.mutateAsync({
      title: newProjectTitle.trim(),
      color: selectedColor,
    })
    setNewProjectTitle('')
  }

  const handleCreateSubtask = async (parentId: string, projectId: string | null) => {
    const draft = subtaskDrafts[parentId] || ''
    if (!draft.trim()) return
    await createItem.mutateAsync({
      title: draft.trim(),
      parent_id: parentId,
      project_id: projectId,
    })
    setSubtaskDrafts((prev) => {
      const next = { ...prev }
      delete next[parentId]
      return next
    })
    setAddingSubtaskForItemId(null)
  }

  const handleCreateTask = async (projectId: string) => {
    if (!newTaskTitle.trim()) return
    await createItem.mutateAsync({
      title: newTaskTitle.trim(),
      project_id: projectId,
      parent_id: null,
    })
    setNewTaskTitle('')
    setAddingTaskForProjectId(null)
  }

  // Build flattened list of focusable items for keyboard navigation
  const focusableItems: FocusableItem[] = []
  // Add create new project area at the beginning
  focusableItems.push({ type: 'create-project', id: 'create-project' })
  
  projects?.forEach((project) => {
    focusableItems.push({ type: 'project', id: project.id })
    if (expandedProjectIds.has(project.id)) {
      const projectItems = items?.filter((item) => item.project_id === project.id) || []
      const tree = buildItemTree(projectItems)
      const addItemsToFocusable = (items: ItemWithChildren[]) => {
        items.forEach((item) => {
          focusableItems.push({ type: 'item', id: item.id, projectId: project.id })
          if (expandedItemIds.has(item.id) && item.children.length > 0) {
            addItemsToFocusable(item.children)
          }
        })
      }
      addItemsToFocusable(tree)
    }
  })
  // Add unassigned section if it has items
  const unassignedRootItems = rootItemsByProject.get(null) || []
  if (unassignedRootItems.length > 0) {
    focusableItems.push({ type: 'project', id: 'unassigned' })
    if (expandedProjectIds.has('unassigned')) {
      const unassignedItems = items?.filter((item) => item.project_id === null) || []
      const tree = buildItemTree(unassignedItems)
      const addItemsToFocusable = (items: ItemWithChildren[]) => {
        items.forEach((item) => {
          focusableItems.push({ type: 'item', id: item.id })
          if (expandedItemIds.has(item.id) && item.children.length > 0) {
            addItemsToFocusable(item.children)
          }
        })
      }
      addItemsToFocusable(tree)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs, except for navigation keys
      const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as Element)?.tagName) ||
        (e.target as Element)?.getAttribute('contenteditable') === 'true'
      
      // Allow navigation keys (ArrowUp/ArrowDown) even when in inputs
      // This allows navigation from subtask inputs when they have text
      // But don't handle 's' key when already in an input - let it type normally
      if (isInput && !['ArrowUp', 'ArrowDown'].includes(e.key)) {
        return
      }

      // Determine current focus index
      // Check focusedItemId first, since items can have both focusedItemId and focusedProjectId set
      let currentFocusIndex = -1
      if (isCreateProjectFocused) {
        currentFocusIndex = 0
      } else if (focusedItemId) {
        currentFocusIndex = focusableItems.findIndex(
          (item) => item.type === 'item' && item.id === focusedItemId
        )
      } else if (focusedProjectId) {
        currentFocusIndex = focusableItems.findIndex(
          (item) => item.type === 'project' && item.id === focusedProjectId
        )
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        // Leaving any subtask typing state when navigating
        if (addingSubtaskForItemId) {
          subtaskInputRefs.current.get(addingSubtaskForItemId)?.blur()
          setAddingSubtaskForItemId(null)
        }
        if (currentFocusIndex === -1) {
          // No focus, start at create project
          setIsCreateProjectFocused(true)
          setFocusedProjectId(null)
          setFocusedItemId(null)
        } else if (currentFocusIndex === 0 && isCreateProjectFocused) {
          // At create project, move to next item
          createProjectInputRef.current?.blur()
          if (focusableItems.length > 1) {
            const next = focusableItems[1]
            setIsCreateProjectFocused(false)
            if (next.type === 'project') {
              setFocusedProjectId(next.id)
              setFocusedItemId(null)
            } else {
              setFocusedItemId(next.id)
              setFocusedProjectId(next.projectId || null)
            }
          }
        } else {
          // At some other item, move to next
          const nextIndex = currentFocusIndex + 1
          if (nextIndex >= focusableItems.length) {
            // Navigated below the last item - loop back to create project
            setIsCreateProjectFocused(true)
            setFocusedProjectId(null)
            setFocusedItemId(null)
          } else {
            const next = focusableItems[nextIndex]
            setIsCreateProjectFocused(false)
            if (next.type === 'project') {
              setFocusedProjectId(next.id)
              setFocusedItemId(null)
            } else {
              setFocusedItemId(next.id)
              setFocusedProjectId(next.projectId || null)
            }
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        // Leaving any subtask typing state when navigating
        if (addingSubtaskForItemId) {
          subtaskInputRefs.current.get(addingSubtaskForItemId)?.blur()
          setAddingSubtaskForItemId(null)
        }
        if (currentFocusIndex === -1) {
          // No focus, go to create project (top position)
          setIsCreateProjectFocused(true)
          setFocusedProjectId(null)
          setFocusedItemId(null)
        } else if (currentFocusIndex === 0) {
          // Already at create project, stay there (top position)
          setIsCreateProjectFocused(true)
          setFocusedProjectId(null)
          setFocusedItemId(null)
        } else {
          // Move to previous item
          const prevIndex = currentFocusIndex - 1
          const prev = focusableItems[prevIndex]
          if (prev.type === 'create-project') {
            setIsCreateProjectFocused(true)
            setFocusedProjectId(null)
            setFocusedItemId(null)
          } else if (prev.type === 'project') {
            setIsCreateProjectFocused(false)
            setFocusedProjectId(prev.id)
            setFocusedItemId(null)
          } else {
            setIsCreateProjectFocused(false)
            setFocusedItemId(prev.id)
            setFocusedProjectId(prev.projectId || null)
          }
        }
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (focusedItemId) {
          // If an item is focused, toggle expansion (show/hide subitems)
          toggleExpanded(focusedItemId)
        } else if (focusedProjectId) {
          // If only a project is focused (no item), toggle project expansion
          toggleProjectExpanded(focusedProjectId)
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (focusedItemId) {
          // Remember where navigation focus was before opening details
          lastFocusBeforeDetailsPanelRef.current = {
            focusedItemId,
            focusedProjectId,
            isCreateProjectFocused,
          }
          // Right arrow opens the item details panel
          openDetailsPanel(focusedItemId)
        }
      } else if (e.key === 'ArrowLeft') {
        if (isDetailsPanelOpen) {
          e.preventDefault()
          closeDetailsPanel()
          // Restore navigation focus to what it was before the panel opened
          const prev = lastFocusBeforeDetailsPanelRef.current
          if (prev) {
            setIsCreateProjectFocused(prev.isCreateProjectFocused)
            setFocusedProjectId(prev.focusedProjectId)
            setFocusedItemId(prev.focusedItemId)
          }
        }
      } else if (e.key === 's' && focusedItemId) {
        // Only handle 's' key if we're not already in any input
        const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as Element)?.tagName) ||
          (e.target as Element)?.getAttribute('contenteditable') === 'true'
        
        if (!isInput) {
          e.preventDefault()
          const item = items?.find((i) => i.id === focusedItemId)
          if (item) {
            // Expand the item if it's not already expanded (so the input will be visible)
            if (!expandedItemIds.has(focusedItemId)) {
              toggleExpanded(focusedItemId)
            }
            // Set adding state - the input will be rendered and auto-focused
            setAddingSubtaskForItemId(focusedItemId)
            // Ensure there's a draft entry (do not clear existing draft)
            setSubtaskDrafts((prev) => (prev[focusedItemId] !== undefined ? prev : { ...prev, [focusedItemId]: '' }))
            // Focus the input after a brief delay to ensure it's rendered
            setTimeout(() => {
              const input = subtaskInputRefs.current.get(focusedItemId)
              if (input) {
                input.focus()
              }
            }, 0)
          }
        }
        // If we're already in an input, let the 's' key through normally (don't prevent default)
      } else if (e.key === 't' && focusedProjectId) {
        e.preventDefault()
        setAddingTaskForProjectId(focusedProjectId)
        setNewTaskTitle('')
        // Focus the input after a brief delay to ensure it's rendered
        setTimeout(() => {
          const input = taskInputRefs.current.get(focusedProjectId)
          input?.focus()
        }, 0)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusableItems, focusedItemId, focusedProjectId, isCreateProjectFocused, items, toggleProjectExpanded, toggleExpanded, openDetailsPanel, closeDetailsPanel, isDetailsPanelOpen, expandedItemIds, addingSubtaskForItemId, setFocusedItemId, setFocusedProjectId, subtaskDrafts])

  // Focus first item on mount
  useEffect(() => {
    if (focusableItems.length > 0 && !focusedProjectId && !focusedItemId && !isCreateProjectFocused) {
      const first = focusableItems[0]
      if (first.type === 'create-project') {
        setIsCreateProjectFocused(true)
      } else if (first.type === 'project') {
        setFocusedProjectId(first.id)
      } else {
        setFocusedItemId(first.id)
        setFocusedProjectId(first.projectId || null)
      }
    }
  }, [focusableItems.length, focusedProjectId, focusedItemId, isCreateProjectFocused, setFocusedItemId, setFocusedProjectId])

  // Auto-focus input when create project area is focused via keyboard
  useEffect(() => {
    if (isCreateProjectFocused && createProjectInputRef.current) {
      // Use requestAnimationFrame to ensure the input is rendered
      requestAnimationFrame(() => {
        createProjectInputRef.current?.focus()
      })
    } else if (!isCreateProjectFocused && createProjectInputRef.current) {
      // Blur the input when navigating away from create project area
      createProjectInputRef.current.blur()
    }
  }, [isCreateProjectFocused])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Create new project */}
      <div
        className={`bg-white rounded-lg border p-4 ${
          isCreateProjectFocused ? 'ring-2 ring-indigo-500 ring-offset-2 border-indigo-300' : 'border-gray-200'
        }`}
        onMouseEnter={() => {
          setIsCreateProjectFocused(true)
          setFocusedProjectId(null)
          setFocusedItemId(null)
          // Don't auto-focus the input on mouse enter
        }}
        onMouseLeave={() => {
          // Only clear if not actually focused (user might be typing or navigating)
          if (document.activeElement !== createProjectInputRef.current && 
              !isCreateProjectFocused) {
            setIsCreateProjectFocused(false)
          }
        }}
      >
        <div className="flex items-center gap-4">
          <input
            ref={createProjectInputRef}
            type="text"
            value={newProjectTitle}
            onChange={(e) => setNewProjectTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateProject()
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                e.stopPropagation()
                createProjectInputRef.current?.blur()
                setIsCreateProjectFocused(false)
                if (focusableItems.length > 1) {
                  const next = focusableItems[1]
                  if (next.type === 'project') {
                    setFocusedProjectId(next.id)
                    setFocusedItemId(null)
                  } else {
                    setFocusedItemId(next.id)
                    setFocusedProjectId(next.projectId || null)
                  }
                }
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                e.stopPropagation()
                // Stay at create project when pressing up
                setIsCreateProjectFocused(true)
                setFocusedProjectId(null)
                setFocusedItemId(null)
              }
            }}
            onFocus={() => {
              // Only set focus state if user actually clicked/focused the input
              setIsCreateProjectFocused(true)
              setFocusedProjectId(null)
              setFocusedItemId(null)
            }}
            onBlur={() => {
              // Don't clear focus immediately on blur - let mouse events handle it
              setTimeout(() => {
                if (document.activeElement !== createProjectInputRef.current && 
                    document.activeElement !== createProjectInputRef.current?.parentElement) {
                  setIsCreateProjectFocused(false)
                }
              }, 100)
            }}
            placeholder="New project name..."
            className="flex-1 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <div className="flex gap-1">
            {(Object.keys(PROJECT_COLORS) as ProjectColor[]).map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-6 h-6 rounded-full ${PROJECT_COLORS[color].bgColor} ${
                  selectedColor === color ? 'ring-2 ring-offset-1 ring-gray-400' : ''
                } hover:scale-110 transition-transform`}
                title={PROJECT_COLORS[color].label}
              />
            ))}
          </div>
          <button
            onClick={handleCreateProject}
            disabled={!newProjectTitle.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Project cards */}
      <div className="space-y-4">
        {projects?.map((project) => {
          const projectRootItems = rootItemsByProject.get(project.id) || []
          // Get all items for this project (including children) for the tree
          const projectAllItems = items?.filter((item) => item.project_id === project.id) || []

          return (
            <ProjectCard
              key={project.id}
              project={project}
              rootItems={projectRootItems}
              allItems={projectAllItems}
              isExpanded={expandedProjectIds.has(project.id)}
              isFocused={focusedProjectId === project.id}
              onToggleExpand={() => toggleProjectExpanded(project.id)}
              onDelete={() => deleteProject.mutate(project.id)}
              onItemClick={(itemId) => openDetailsPanel(itemId)}
              onFocus={() => {
                setFocusedProjectId(project.id)
                setFocusedItemId(null)
              }}
              addingTask={addingTaskForProjectId === project.id}
              newTaskTitle={newTaskTitle}
              onNewTaskTitleChange={setNewTaskTitle}
              onNewTaskSubmit={() => handleCreateTask(project.id)}
              onNewTaskCancel={() => {
                setAddingTaskForProjectId(null)
                setNewTaskTitle('')
              }}
              onStartAddTask={() => {
                setAddingTaskForProjectId(project.id)
                setNewTaskTitle('')
              }}
              taskInputRef={(el) => {
                if (el) taskInputRefs.current.set(project.id, el)
                else taskInputRefs.current.delete(project.id)
              }}
              addingSubtaskForItemId={addingSubtaskForItemId}
              setAddingSubtaskForItemId={setAddingSubtaskForItemId}
              subtaskDrafts={subtaskDrafts}
              setSubtaskDraft={(itemId, title) =>
                setSubtaskDrafts((prev) => ({ ...prev, [itemId]: title }))
              }
              clearSubtaskDraft={(itemId) =>
                setSubtaskDrafts((prev) => {
                  const next = { ...prev }
                  delete next[itemId]
                  return next
                })
              }
              onCreateSubtask={(parentId) => handleCreateSubtask(parentId, project.id)}
              subtaskInputRef={(itemId, el) => {
                if (el) subtaskInputRefs.current.set(itemId, el)
                else subtaskInputRefs.current.delete(itemId)
              }}
            />
          )
        })}

        {/* Unassigned items section */}
        {unassignedRootItems.length > 0 && (
          <UnassignedCard
            rootItems={unassignedRootItems}
            allItems={items?.filter((item) => item.project_id === null) || []}
            isExpanded={expandedProjectIds.has('unassigned')}
            isFocused={focusedProjectId === 'unassigned'}
            onToggleExpand={() => toggleProjectExpanded('unassigned')}
            onItemClick={(itemId) => openDetailsPanel(itemId)}
            onFocus={() => {
              setFocusedProjectId('unassigned')
              setFocusedItemId(null)
            }}
            addingTask={addingTaskForProjectId === 'unassigned'}
            newTaskTitle={newTaskTitle}
            onNewTaskTitleChange={setNewTaskTitle}
            onNewTaskSubmit={() => handleCreateTask('unassigned')}
            onNewTaskCancel={() => {
              setAddingTaskForProjectId(null)
              setNewTaskTitle('')
            }}
            onStartAddTask={() => {
              setAddingTaskForProjectId('unassigned')
              setNewTaskTitle('')
            }}
            taskInputRef={(el) => {
              if (el) taskInputRefs.current.set('unassigned', el)
              else taskInputRefs.current.delete('unassigned')
            }}
            addingSubtaskForItemId={addingSubtaskForItemId}
            setAddingSubtaskForItemId={setAddingSubtaskForItemId}
            subtaskDrafts={subtaskDrafts}
            setSubtaskDraft={(itemId, title) =>
              setSubtaskDrafts((prev) => ({ ...prev, [itemId]: title }))
            }
            clearSubtaskDraft={(itemId) =>
              setSubtaskDrafts((prev) => {
                const next = { ...prev }
                delete next[itemId]
                return next
              })
            }
            onCreateSubtask={(parentId) => handleCreateSubtask(parentId, null)}
            subtaskInputRef={(itemId, el) => {
              if (el) subtaskInputRefs.current.set(itemId, el)
              else subtaskInputRefs.current.delete(itemId)
            }}
          />
        )}
      </div>

      {projects?.length === 0 && unassignedRootItems.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No projects yet. Create one above!
        </div>
      )}
    </div>
  )
}

function ProjectCard({
  project,
  rootItems,
  allItems,
  isExpanded,
  isFocused,
  onToggleExpand,
  onDelete,
  onItemClick,
  onFocus,
  addingTask,
  newTaskTitle,
  onNewTaskTitleChange,
  onNewTaskSubmit,
  onNewTaskCancel,
  onStartAddTask,
  taskInputRef,
  addingSubtaskForItemId,
  setAddingSubtaskForItemId,
  subtaskDrafts,
  setSubtaskDraft,
  clearSubtaskDraft,
  onCreateSubtask,
  subtaskInputRef,
}: {
  project: Project
  rootItems: Item[]
  allItems: Item[]
  isExpanded: boolean
  isFocused: boolean
  onToggleExpand: () => void
  onDelete: () => void
  onItemClick: (itemId: string) => void
  onFocus: () => void
  addingTask: boolean
  newTaskTitle: string
  onNewTaskTitleChange: (title: string) => void
  onNewTaskSubmit: () => void
  onNewTaskCancel: () => void
  onStartAddTask: () => void
  taskInputRef: (el: HTMLInputElement | null) => void
  addingSubtaskForItemId: string | null
  setAddingSubtaskForItemId: (id: string | null) => void
  subtaskDrafts: Record<string, string>
  setSubtaskDraft: (itemId: string, title: string) => void
  clearSubtaskDraft: (itemId: string) => void
  onCreateSubtask: (parentId: string) => Promise<void>
  subtaskInputRef: (itemId: string, el: HTMLInputElement | null) => void
}) {
  const colorConfig = PROJECT_COLORS[project.color]
  const tree = buildItemTree(allItems)
  const { expandedItemIds, toggleExpanded, focusedItemId, setFocusedItemId, setFocusedProjectId } = useUIStore()

  const completedCount = allItems.filter((i) => i.status === 'done').length
  const totalCount = allItems.length

  return (
    <div
      className={`bg-white rounded-lg border-2 ${colorConfig.borderColor} overflow-hidden group ${
        isFocused ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 cursor-pointer ${colorConfig.bgColor} ${
          isFocused ? 'ring-2 ring-indigo-500' : ''
        }`}
        onClick={onToggleExpand}
        onMouseEnter={onFocus}
      >
        <div className="flex items-center gap-3">
          <button className="text-gray-600">
            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
          {project.icon && <span className="text-lg">{project.icon}</span>}
          <FolderOpen className={`w-5 h-5 ${colorConfig.textColor}`} />
          <h3 className="font-medium text-gray-900">{project.title}</h3>
          <span className="text-sm text-gray-500">
            {completedCount}/{totalCount} items
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (confirm('Delete this project? Items will become unassigned.')) {
              onDelete()
            }
          }}
          className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="divide-y divide-gray-100">
          {tree.length > 0 ? (
            tree.map((item) => (
              <ProjectItemRow
                key={item.id}
                item={item}
                projectId={project.id}
                onClick={() => onItemClick(item.id)}
                isFocused={focusedItemId === item.id}
                onFocus={() => {
                  setFocusedItemId(item.id)
                  setFocusedProjectId(project.id)
                }}
                addingSubtaskForItemId={addingSubtaskForItemId}
                setAddingSubtaskForItemId={setAddingSubtaskForItemId}
                subtaskDrafts={subtaskDrafts}
                setSubtaskDraft={setSubtaskDraft}
                clearSubtaskDraft={clearSubtaskDraft}
                onCreateSubtask={onCreateSubtask}
                subtaskInputRef={subtaskInputRef}
              />
            ))
          ) : (
            <div className="px-4 py-6 text-center text-gray-400 text-sm">
              No items in this project
            </div>
          )}

          {/* Add task row - visible on hover/focus */}
          {(isFocused || addingTask) && (
            <div className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50">
              <Plus className="w-4 h-4 text-gray-400" />
              {addingTask ? (
                <input
                  ref={taskInputRef}
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => onNewTaskTitleChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onNewTaskSubmit()
                    } else if (e.key === 'Escape') {
                      onNewTaskCancel()
                    }
                  }}
                  onBlur={onNewTaskCancel}
                  placeholder="Add new task..."
                  className="flex-1 text-sm border-0 focus:ring-0 p-0 bg-transparent text-gray-900 placeholder-gray-400"
                  autoFocus
                />
              ) : (
                <span
                  className="text-sm text-gray-400 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    onStartAddTask()
                    setTimeout(() => {
                      // Focus will be handled by autoFocus on the input
                    }, 0)
                  }}
                >
                  Add new task...
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ProjectItemRow({
  item,
  projectId,
  onClick,
  isFocused,
  onFocus,
  addingSubtaskForItemId,
  setAddingSubtaskForItemId,
  subtaskDrafts,
  setSubtaskDraft,
  clearSubtaskDraft,
  onCreateSubtask,
  subtaskInputRef,
}: {
  item: ItemWithChildren
  projectId: string
  onClick: () => void
  isFocused: boolean
  onFocus: () => void
  addingSubtaskForItemId: string | null
  setAddingSubtaskForItemId: (id: string | null) => void
  subtaskDrafts: Record<string, string>
  setSubtaskDraft: (itemId: string, title: string) => void
  clearSubtaskDraft: (itemId: string) => void
  onCreateSubtask: (parentId: string) => Promise<void>
  subtaskInputRef: (itemId: string, el: HTMLInputElement | null) => void
}) {
  const statusConfig = STATUS_CONFIG[item.status]
  const { expandedItemIds, toggleExpanded, setFocusedItemId, setFocusedProjectId, focusedItemId: currentFocusedItemId } = useUIStore()
  const isExpanded = expandedItemIds.has(item.id)
  const hasChildren = item.children.length > 0

  const draft = subtaskDrafts[item.id] || ''
  const isAddingThis = addingSubtaskForItemId === item.id

  const handleSubmitSubtask = async () => {
    if (!draft.trim()) return
    await onCreateSubtask(item.id)
    clearSubtaskDraft(item.id)
    setAddingSubtaskForItemId(null)
  }

  // Focus the input when addingSubtask becomes true
  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (isAddingThis && isExpanded) {
      // Use requestAnimationFrame to ensure the input is rendered and visible
      requestAnimationFrame(() => {
        setTimeout(() => {
          inputRef.current?.focus()
          inputRef.current?.select()
        }, 0)
      })
    }
  }, [isAddingThis, isExpanded])

  return (
    <>
      <div
        className={`flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer ${
          isFocused ? 'bg-indigo-50 ring-1 ring-indigo-200' : ''
        }`}
        style={{ paddingLeft: `${1 + item.depth * 1.5}rem` }}
        onClick={onClick}
        onMouseEnter={onFocus}
      >
        {/* Chevron for expand/collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleExpanded(item.id)
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

        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusConfig.bgColor}`} />
        <span className={`text-sm ${item.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {item.title}
        </span>
        {hasChildren && (
          <span className="text-xs text-gray-400">({item.children.length})</span>
        )}
      </div>

      {/* Render children if expanded */}
      {isExpanded && hasChildren && (
        <>
          {item.children.map((child) => {
            const childIsFocused = currentFocusedItemId === child.id
            return (
              <ProjectItemRow
                key={child.id}
                item={child}
                projectId={projectId}
                onClick={onClick}
                isFocused={childIsFocused}
                onFocus={() => {
                  setFocusedItemId(child.id)
                  setFocusedProjectId(projectId)
                }}
                addingSubtaskForItemId={addingSubtaskForItemId}
                setAddingSubtaskForItemId={setAddingSubtaskForItemId}
                subtaskDrafts={subtaskDrafts}
                setSubtaskDraft={setSubtaskDraft}
                clearSubtaskDraft={clearSubtaskDraft}
                onCreateSubtask={onCreateSubtask}
                subtaskInputRef={subtaskInputRef}
              />
            )
          })}
        </>
      )}

      {/* Add subtask row - only visible when focused AND started via 's' (or returning with a draft) */}
      {isExpanded && isFocused && (isAddingThis || draft.trim()) && (
        <div
          className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50"
          style={{ paddingLeft: `${1 + (item.depth + 1) * 1.5}rem` }}
        >
          <Plus className="w-4 h-4 text-gray-400" />
          <input
            ref={(el) => {
              inputRef.current = el
              subtaskInputRef(item.id, el)
            }}
            type="text"
            value={draft}
            onChange={(e) => setSubtaskDraft(item.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
                void handleSubmitSubtask()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                // Stop editing; keep draft so it reappears when returning
                setAddingSubtaskForItemId(null)
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                // Arrow keys should navigate list, not move caret
                e.preventDefault()
              }
            }}
            onBlur={() => {
              // Hide when leaving, but keep draft if any
              setAddingSubtaskForItemId(null)
            }}
            placeholder="Add subtask..."
            className="flex-1 text-sm border-0 focus:ring-0 p-0 bg-transparent text-gray-900 placeholder-gray-400"
          />
        </div>
      )}
    </>
  )
}

function UnassignedCard({
  rootItems,
  allItems,
  isExpanded,
  isFocused,
  onToggleExpand,
  onItemClick,
  onFocus,
  addingTask,
  newTaskTitle,
  onNewTaskTitleChange,
  onNewTaskSubmit,
  onNewTaskCancel,
  onStartAddTask,
  taskInputRef,
  addingSubtaskForItemId,
  setAddingSubtaskForItemId,
  subtaskDrafts,
  setSubtaskDraft,
  clearSubtaskDraft,
  onCreateSubtask,
  subtaskInputRef,
}: {
  rootItems: Item[]
  allItems: Item[]
  isExpanded: boolean
  isFocused: boolean
  onToggleExpand: () => void
  onItemClick: (itemId: string) => void
  onFocus: () => void
  addingTask: boolean
  newTaskTitle: string
  onNewTaskTitleChange: (title: string) => void
  onNewTaskSubmit: () => void
  onNewTaskCancel: () => void
  onStartAddTask: () => void
  taskInputRef: (el: HTMLInputElement | null) => void
  addingSubtaskForItemId: string | null
  setAddingSubtaskForItemId: (id: string | null) => void
  subtaskDrafts: Record<string, string>
  setSubtaskDraft: (itemId: string, title: string) => void
  clearSubtaskDraft: (itemId: string) => void
  onCreateSubtask: (parentId: string) => Promise<void>
  subtaskInputRef: (itemId: string, el: HTMLInputElement | null) => void
}) {
  const tree = buildItemTree(allItems)
  const { expandedItemIds, toggleExpanded, focusedItemId, setFocusedItemId, setFocusedProjectId } = useUIStore()

  return (
    <div
      className={`bg-white rounded-lg border-2 border-gray-200 overflow-hidden ${
        isFocused ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
      }`}
    >
      <div
        className={`flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer ${
          isFocused ? 'ring-2 ring-indigo-500' : ''
        }`}
        onClick={onToggleExpand}
        onMouseEnter={onFocus}
      >
        {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-600" /> : <ChevronRight className="w-5 h-5 text-gray-600" />}
        <Inbox className="w-5 h-5 text-gray-500" />
        <h3 className="font-medium text-gray-600">Unassigned</h3>
        <span className="text-sm text-gray-400">{allItems.length} items</span>
      </div>

      {isExpanded && (
        <div className="divide-y divide-gray-100">
          {tree.length > 0 ? (
            tree.map((item) => (
              <ProjectItemRow
                key={item.id}
                item={item}
                projectId="unassigned"
                onClick={() => onItemClick(item.id)}
                isFocused={focusedItemId === item.id}
                onFocus={() => {
                  setFocusedItemId(item.id)
                  setFocusedProjectId('unassigned')
                }}
                addingSubtaskForItemId={addingSubtaskForItemId}
                setAddingSubtaskForItemId={setAddingSubtaskForItemId}
                subtaskDrafts={subtaskDrafts}
                setSubtaskDraft={setSubtaskDraft}
                clearSubtaskDraft={clearSubtaskDraft}
                onCreateSubtask={onCreateSubtask}
                subtaskInputRef={subtaskInputRef}
              />
            ))
          ) : (
            <div className="px-4 py-6 text-center text-gray-400 text-sm">
              No unassigned items
            </div>
          )}

          {/* Add task row - visible on hover/focus */}
          {(isFocused || addingTask) && (
            <div className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50">
              <Plus className="w-4 h-4 text-gray-400" />
              {addingTask ? (
                <input
                  ref={taskInputRef}
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => onNewTaskTitleChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onNewTaskSubmit()
                    } else if (e.key === 'Escape') {
                      onNewTaskCancel()
                    }
                  }}
                  onBlur={onNewTaskCancel}
                  placeholder="Add new task..."
                  className="flex-1 text-sm border-0 focus:ring-0 p-0 bg-transparent text-gray-900 placeholder-gray-400"
                  autoFocus
                />
              ) : (
                <span
                  className="text-sm text-gray-400 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation()
                    onStartAddTask()
                    setTimeout(() => {
                      // Focus will be handled by autoFocus on the input
                    }, 0)
                  }}
                >
                  Add new task...
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
