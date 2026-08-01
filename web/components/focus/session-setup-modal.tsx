'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, Play, Clock } from 'lucide-react'
import { useItems, useCreateItem } from '@/lib/hooks/use-items'
import { useCreateFocusSession, useUpdateFocusSession } from '@/lib/hooks/use-focus-sessions'
import { useCreateSessionTask } from '@/lib/hooks/use-session-tasks'
import { useSessionTemplates } from '@/lib/hooks/use-session-templates'
import { useGlobalReminders, useCreateReminder } from '@/lib/hooks/use-reminders'
import { useFocusSessionStore } from '@/lib/stores/focus-session-store'
import { TaskSelector } from './task-selector'
import { SessionQueue } from './session-queue'
import { TemplatePicker } from './template-picker'
import { ReminderSetup } from './reminder-setup'
import type { Item, SessionTemplate } from '@/types'

export interface QueuedTask {
  item: Item
  allocatedMinutes: number
  warningBufferSec: number
}

export function SessionSetupModal() {
  const router = useRouter()
  const { data: items } = useItems()
  const { data: templates } = useSessionTemplates()
  const { data: globalReminders } = useGlobalReminders()
  const createItem = useCreateItem()
  const createSession = useCreateFocusSession()
  const updateSession = useUpdateFocusSession()
  const createSessionTask = useCreateSessionTask()
  const createReminder = useCreateReminder()

  const setShowSetupModal = useFocusSessionStore((s) => s.setShowSetupModal)
  const initSession = useFocusSessionStore((s) => s.initSession)

  const [queue, setQueue] = useState<QueuedTask[]>([])
  const [search, setSearch] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [sessionReminders, setSessionReminders] = useState<
    Array<{ content: string; triggerType: 'interval' | 'moment'; intervalMinutes?: number; moment?: string }>
  >([])

  const totalMinutes = queue.reduce((sum, t) => sum + t.allocatedMinutes, 0)

  const availableItems = (items || []).filter(
    (item) =>
      (item.status === 'todo' || item.status === 'in_progress') &&
      !queue.some((q) => q.item.id === item.id) &&
      (search === '' ||
        item.title.toLowerCase().includes(search.toLowerCase()))
  )

  const addTask = useCallback((item: Item) => {
    setQueue((prev) => [
      ...prev,
      { item, allocatedMinutes: 15, warningBufferSec: 180 },
    ])
  }, [])

  const quickCreateTask = useCallback(
    async (title: string) => {
      try {
        const item = await createItem.mutateAsync({ title, status: 'todo' })
        addTask(item)
        setSearch('')
      } catch (error) {
        console.error('Failed to create task:', error)
      }
    },
    [createItem, addTask]
  )

  const removeTask = useCallback((index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateTask = useCallback(
    (index: number, updates: Partial<Omit<QueuedTask, 'item'>>) => {
      setQueue((prev) =>
        prev.map((t, i) => (i === index ? { ...t, ...updates } : t))
      )
    },
    []
  )

  const moveTask = useCallback((from: number, to: number) => {
    setQueue((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }, [])

  const loadTemplate = useCallback(
    (template: SessionTemplate, cloneExact: boolean) => {
      if (!items) return
      const newQueue: QueuedTask[] = []
      for (const slot of template.template_data.slots) {
        if (cloneExact && slot.task_id) {
          const item = items.find((i) => i.id === slot.task_id)
          if (item) {
            newQueue.push({
              item,
              allocatedMinutes: Math.round(slot.allocated_time_ms / 60000),
              warningBufferSec: slot.warning_buffer_sec,
            })
          }
        }
      }
      if (newQueue.length > 0) setQueue(newQueue)
    },
    [items]
  )

  const handleStart = async () => {
    if (queue.length === 0 || isStarting) return
    setIsStarting(true)

    try {
      // Create session in 'setup' status
      const session = await createSession.mutateAsync({})

      // Create all session tasks
      for (let i = 0; i < queue.length; i++) {
        const q = queue[i]
        await createSessionTask.mutateAsync({
          session_id: session.id,
          task_id: q.item.id,
          position: i + 1,
          allocated_time_ms: q.allocatedMinutes * 60000,
          warning_buffer_sec: q.warningBufferSec,
        })
      }

      // Create session-level reminders
      for (const r of sessionReminders) {
        await createReminder.mutateAsync({
          content: r.content,
          source_type: 'session',
          source_id: session.id,
          trigger_type: r.triggerType,
          trigger_interval_ms: r.triggerType === 'interval' && r.intervalMinutes
            ? r.intervalMinutes * 60000
            : null,
          trigger_moment: r.triggerType === 'moment' ? r.moment || 'start' : null,
        })
      }

      // Transition session to 'active' in the DB
      await updateSession.mutateAsync({
        id: session.id,
        status: 'active',
        started_at: new Date().toISOString(),
      })

      const totalAllocatedMs = queue.reduce(
        (sum, q) => sum + q.allocatedMinutes * 60000,
        0
      )

      setShowSetupModal(false)
      initSession(session.id, totalAllocatedMs)
      router.push('/focus')
    } catch (error) {
      console.error('Failed to create focus session:', error)
    } finally {
      setIsStarting(false)
    }
  }

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSetupModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setShowSetupModal])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            New Focus Session
          </h2>
          <button
            onClick={() => setShowSetupModal(false)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Template Picker */}
          {templates && templates.length > 0 && (
            <TemplatePicker
              templates={templates}
              onLoadTemplate={loadTemplate}
            />
          )}

          <div className="grid grid-cols-2 gap-6">
            {/* Task Selector */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Available Tasks
              </h3>
              <TaskSelector
                items={availableItems}
                search={search}
                onSearchChange={setSearch}
                onAddTask={addTask}
                onQuickCreate={quickCreateTask}
                isCreating={createItem.isPending}
              />
            </div>

            {/* Session Queue */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Session Queue ({queue.length} tasks)
              </h3>
              <SessionQueue
                queue={queue}
                onRemoveTask={removeTask}
                onUpdateTask={updateTask}
                onMoveTask={moveTask}
              />
            </div>
          </div>

          {/* Reminders */}
          <ReminderSetup
            globalReminders={globalReminders || []}
            sessionReminders={sessionReminders}
            onAddReminder={(r) => setSessionReminders((prev) => [...prev, r])}
            onRemoveReminder={(i) => setSessionReminders((prev) => prev.filter((_, idx) => idx !== i))}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              <span>
                Total: <strong>{totalMinutes} min</strong>
              </span>
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={queue.length === 0 || isStarting}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-4 h-4" />
            {isStarting ? 'Starting...' : 'Start Session'}
          </button>
        </div>
      </div>
    </div>
  )
}
