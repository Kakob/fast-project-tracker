'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useFocusSessionStore } from '@/lib/stores/focus-session-store'
import { useSessionTasks, useUpdateSessionTask } from '@/lib/hooks/use-session-tasks'
import { useUpdateFocusSession, useEndFocusSession } from '@/lib/hooks/use-focus-sessions'
import { useCreateBreak, useEndBreak } from '@/lib/hooks/use-breaks'
import { useReminders } from '@/lib/hooks/use-reminders'
import { useItems } from '@/lib/hooks/use-items'
import { CurrentTaskCard } from './current-task-card'
import { SessionControls } from './session-controls'
import { TaskQueuePanel } from './task-queue-panel'
import { TaskTransition } from './task-transition'
import { BreakOverlay } from './break-overlay'
import { LogPrompt } from './log-prompt'
import { ReminderToast } from './reminder-toast'
import { SessionReminderPanel } from './session-reminder-panel'

interface ActiveSessionViewProps {
  sessionId: string
}

export function ActiveSessionView({ sessionId }: ActiveSessionViewProps) {
  const router = useRouter()
  const { data: sessionTasks } = useSessionTasks(sessionId)
  const { data: items } = useItems()
  const { data: allReminders } = useReminders()
  const updateSessionTask = useUpdateSessionTask()
  const updateFocusSession = useUpdateFocusSession()
  const endFocusSession = useEndFocusSession()
  const createBreak = useCreateBreak()
  const endBreakMutation = useEndBreak()

  // Read-only state for rendering
  const sessionStatus = useFocusSessionStore((s) => s.sessionStatus)
  const sessionElapsedMs = useFocusSessionStore((s) => s.sessionElapsedMs)
  const currentTaskElapsedMs = useFocusSessionStore((s) => s.currentTaskElapsedMs)
  const currentTaskIndex = useFocusSessionStore((s) => s.currentTaskIndex)
  const totalAllocatedMs = useFocusSessionStore((s) => s.totalAllocatedMs)
  const isInTransition = useFocusSessionStore((s) => s.isInTransition)
  const transitionFromTaskId = useFocusSessionStore((s) => s.transitionFromTaskId)
  const transitionToTaskId = useFocusSessionStore((s) => s.transitionToTaskId)
  const isWarningActive = useFocusSessionStore((s) => s.isWarningActive)
  const isOnBreak = useFocusSessionStore((s) => s.isOnBreak)
  const breakElapsedMs = useFocusSessionStore((s) => s.breakElapsedMs)
  const breakPlannedDurationSec = useFocusSessionStore((s) => s.breakPlannedDurationSec)
  const pendingReminderPrompt = useFocusSessionStore((s) => s.pendingReminderPrompt)
  const showLogPrompt = useFocusSessionStore((s) => s.showLogPrompt)
  const showBreakPrompt = useFocusSessionStore((s) => s.showBreakPrompt)
  const showEndConfirm = useFocusSessionStore((s) => s.showEndConfirm)
  const showExtendMenu = useFocusSessionStore((s) => s.showExtendMenu)

  const currentTask = sessionTasks?.[currentTaskIndex]
  const currentItem = currentTask ? items?.find((i) => i.id === currentTask.task_id) : null

  // Active reminders for this session
  const sessionReminders = (allReminders || []).filter((r) => {
    if (r.source_type === 'global') return true
    if (r.source_type === 'session' && r.source_id === sessionId) return true
    if (r.source_type === 'task' && currentTask && r.source_id === currentTask.task_id) return true
    return false
  })

  // Compute total allocated from session tasks
  useEffect(() => {
    if (sessionTasks && sessionTasks.length > 0) {
      const total = sessionTasks.reduce(
        (sum, st) => sum + st.allocated_time_ms + st.extensions_ms,
        0
      )
      useFocusSessionStore.getState().setTotalAllocatedMs(total)
    }
  }, [sessionTasks])

  // Mark first task as active on session start
  useEffect(() => {
    if (
      sessionTasks &&
      sessionTasks.length > 0 &&
      sessionStatus === 'active' &&
      sessionTasks[0].status === 'pending'
    ) {
      updateSessionTask.mutate({
        id: sessionTasks[0].id,
        sessionId,
        status: 'active',
        started_at: new Date().toISOString(),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionTasks, sessionStatus, sessionId])

  // All handlers use getState() to avoid stale closures
  const handleDone = useCallback(() => {
    const s = useFocusSessionStore.getState()
    if (!sessionTasks || s.isInTransition) return
    const task = sessionTasks[s.currentTaskIndex]
    if (!task) return

    updateSessionTask.mutate({
      id: task.id,
      sessionId,
      status: 'completed',
      actual_time_ms: s.currentTaskElapsedMs,
      completed_at: new Date().toISOString(),
    })

    const nextIndex = s.currentTaskIndex + 1
    if (nextIndex >= sessionTasks.length) {
      s.setSessionStatus('completed')
      return
    }

    const nextTask = sessionTasks[nextIndex]
    s.enterTransition(task.task_id, nextTask.task_id)

    setTimeout(() => {
      const st = useFocusSessionStore.getState()
      st.exitTransition()
      st.setCurrentTaskIndex(nextIndex)
      updateSessionTask.mutate({
        id: nextTask.id,
        sessionId,
        status: 'active',
        started_at: new Date().toISOString(),
      })
    }, 4000)
  }, [sessionTasks, sessionId, updateSessionTask])

  const handleSkip = useCallback(() => {
    const s = useFocusSessionStore.getState()
    if (!sessionTasks || s.isInTransition) return
    const task = sessionTasks[s.currentTaskIndex]
    if (!task) return

    updateSessionTask.mutate({
      id: task.id,
      sessionId,
      status: 'skipped',
      actual_time_ms: s.currentTaskElapsedMs,
    })

    const nextIndex = s.currentTaskIndex + 1
    if (nextIndex >= sessionTasks.length) {
      s.setSessionStatus('completed')
      return
    }

    const nextTask = sessionTasks[nextIndex]
    s.enterTransition(task.task_id, nextTask.task_id)

    setTimeout(() => {
      const st = useFocusSessionStore.getState()
      st.exitTransition()
      st.setCurrentTaskIndex(nextIndex)
      updateSessionTask.mutate({
        id: nextTask.id,
        sessionId,
        status: 'active',
        started_at: new Date().toISOString(),
      })
    }, 4000)
  }, [sessionTasks, sessionId, updateSessionTask])

  const handlePauseResume = useCallback(() => {
    const s = useFocusSessionStore.getState()
    if (s.sessionStatus === 'paused') {
      const pauseDuration = s.pauseStartedAt ? Date.now() - s.pauseStartedAt : 0
      const newTotalPause = s.totalPauseMs + pauseDuration
      s.endPause(newTotalPause)
      s.setSessionStatus('active')
      updateFocusSession.mutate({
        id: sessionId,
        status: 'active',
        paused_at: null,
        total_pause_ms: newTotalPause,
      })
    } else if (s.sessionStatus === 'active') {
      s.startPause()
      s.setSessionStatus('paused')
      updateFocusSession.mutate({
        id: sessionId,
        status: 'paused',
        paused_at: new Date().toISOString(),
      })
    }
  }, [sessionId, updateFocusSession])

  const handleExtendTime = useCallback(
    (minutes: number) => {
      const s = useFocusSessionStore.getState()
      const tasks = sessionTasks
      if (!tasks) return
      const task = tasks[s.currentTaskIndex]
      if (!task) return
      const extensionMs = minutes * 60000
      updateSessionTask.mutate({
        id: task.id,
        sessionId,
        extensions_ms: task.extensions_ms + extensionMs,
        extension_count: task.extension_count + 1,
      })
      s.setWarningActive(false)
      s.setShowExtendMenu(false)
    },
    [sessionTasks, sessionId, updateSessionTask]
  )

  const handleBreak = useCallback(
    async (durationSec: number | null) => {
      const s = useFocusSessionStore.getState()
      s.setShowBreakPrompt(false)
      const br = await createBreak.mutateAsync({
        session_id: sessionId,
        planned_duration_sec: durationSec,
        break_type: 'manual',
      })
      s.startBreak(br.id, durationSec)

      if (s.sessionStatus === 'active') {
        s.setSessionStatus('paused')
        updateFocusSession.mutate({
          id: sessionId,
          status: 'paused',
          paused_at: new Date().toISOString(),
        })
      }
    },
    [sessionId, createBreak, updateFocusSession]
  )

  const handleEndBreak = useCallback(() => {
    const s = useFocusSessionStore.getState()
    if (s.activeBreakId) {
      endBreakMutation.mutate({ id: s.activeBreakId, sessionId })
    }
    const newTotalBreak = s.totalBreakMs + s.breakElapsedMs
    s.endBreak()
    s.setSessionStatus('active')
    updateFocusSession.mutate({
      id: sessionId,
      status: 'active',
      paused_at: null,
      total_break_ms: newTotalBreak,
    })
  }, [sessionId, endBreakMutation, updateFocusSession])

  const handleEndSession = useCallback(
    async (abandoned: boolean) => {
      const s = useFocusSessionStore.getState()
      s.setShowEndConfirm(false)

      const tasks = sessionTasks
      const task = tasks?.[s.currentTaskIndex]

      if (task) {
        updateSessionTask.mutate({
          id: task.id,
          sessionId,
          actual_time_ms: s.currentTaskElapsedMs,
          status: task.status === 'active' ? 'paused_incomplete' : task.status,
        })
      }

      const taskData = (tasks || []).map((st) => ({
        task_id: st.task_id,
        actual_time_ms: st.id === task?.id ? s.currentTaskElapsedMs : st.actual_time_ms,
        status: st.id === task?.id && st.status === 'active' ? 'paused_incomplete' : st.status,
      }))

      await endFocusSession.mutateAsync({
        id: sessionId,
        ended_by: abandoned ? 'abandoned' : 'completed',
        total_active_ms: s.sessionElapsedMs,
        total_pause_ms: s.totalPauseMs,
        total_break_ms: s.totalBreakMs,
        session_tasks: taskData,
      })

      s.setSessionStatus(abandoned ? 'abandoned' : 'completed')
    },
    [sessionTasks, sessionId, updateSessionTask, endFocusSession]
  )

  // Keyboard shortcuts - use capture to prevent double-fire from focused buttons
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as Element)?.tagName
      )
      if (isInput) return

      const s = useFocusSessionStore.getState()
      if (s.showLogPrompt || s.showEndConfirm || s.isOnBreak || s.showBreakPrompt) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          // Prevent double-fire: blur any focused button
          if (document.activeElement instanceof HTMLButtonElement) {
            document.activeElement.blur()
          }
          handlePauseResume()
          break
        case 'd':
          e.preventDefault()
          handleDone()
          break
        case 'k':
          e.preventDefault()
          handleSkip()
          break
        case 'b':
          e.preventDefault()
          s.setShowBreakPrompt(true)
          break
        case 'l':
          e.preventDefault()
          s.setShowLogPrompt(true)
          break
        case '+':
        case '=':
          e.preventDefault()
          s.setShowExtendMenu(!s.showExtendMenu)
          break
        case 'Escape':
          e.preventDefault()
          if (s.showBreakPrompt) {
            s.setShowBreakPrompt(false)
          } else if (s.showExtendMenu) {
            s.setShowExtendMenu(false)
          } else {
            s.setShowEndConfirm(true)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePauseResume, handleDone, handleSkip])

  if (!sessionTasks || sessionTasks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Session progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-1000 ${
            isWarningActive ? 'bg-red-500' : 'bg-indigo-600'
          }`}
          style={{
            width: `${Math.min(100, totalAllocatedMs > 0 ? (sessionElapsedMs / totalAllocatedMs) * 100 : 0)}%`,
          }}
        />
      </div>

      {/* Transition overlay */}
      {isInTransition && (
        <TaskTransition
          fromTask={items?.find((i) => i.id === transitionFromTaskId) ?? null}
          toTask={items?.find((i) => i.id === transitionToTaskId) ?? null}
          onBreak={(durationSec) => handleBreak(durationSec)}
          onSkipBreak={() => {}}
        />
      )}

      {/* Current task */}
      {currentItem && currentTask && !isInTransition && (
        <CurrentTaskCard
          item={currentItem}
          sessionTask={currentTask}
          elapsedMs={currentTaskElapsedMs}
          isWarning={isWarningActive}
          isPaused={sessionStatus === 'paused'}
        />
      )}

      {/* Controls */}
      <SessionControls
        isPaused={sessionStatus === 'paused'}
        isInTransition={isInTransition}
        showExtendMenu={showExtendMenu}
        onDone={handleDone}
        onSkip={handleSkip}
        onPauseResume={handlePauseResume}
        onExtendTime={handleExtendTime}
        onToggleExtendMenu={() => useFocusSessionStore.getState().setShowExtendMenu(!showExtendMenu)}
        onBreak={() => useFocusSessionStore.getState().setShowBreakPrompt(true)}
        onLog={() => useFocusSessionStore.getState().setShowLogPrompt(true)}
        onEndSession={() => useFocusSessionStore.getState().setShowEndConfirm(true)}
      />

      {/* Task queue */}
      <TaskQueuePanel
        sessionTasks={sessionTasks}
        items={items || []}
        currentIndex={currentTaskIndex}
      />

      {/* Active reminders panel */}
      {sessionReminders.length > 0 && (
        <SessionReminderPanel reminders={sessionReminders} />
      )}

      {/* Break overlay */}
      {isOnBreak && (
        <BreakOverlay
          elapsedMs={breakElapsedMs}
          plannedDurationSec={breakPlannedDurationSec}
          onEndBreak={handleEndBreak}
        />
      )}

      {/* Break prompt */}
      {showBreakPrompt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Take a Break</h3>
            <p className="text-sm text-gray-500">
              Step away, stretch, hydrate. Your session will pause during the break.
            </p>
            <div className="flex flex-wrap gap-2">
              {[1, 3, 5].map((min) => (
                <button
                  key={min}
                  onClick={() => handleBreak(min * 60)}
                  className="px-4 py-2 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-200 transition-colors"
                >
                  {min} min
                </button>
              ))}
              <button
                onClick={() => handleBreak(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Until I&apos;m ready
              </button>
            </div>
            <button
              onClick={() => useFocusSessionStore.getState().setShowBreakPrompt(false)}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Log prompt */}
      {showLogPrompt && (
        <LogPrompt
          sessionId={sessionId}
          sessionTaskId={currentTask?.id ?? null}
          onClose={() => useFocusSessionStore.getState().setShowLogPrompt(false)}
        />
      )}

      {/* Reminder toast */}
      {pendingReminderPrompt && (
        <ReminderToast
          reminder={pendingReminderPrompt}
          onDismiss={() => useFocusSessionStore.getState().setPendingReminderPrompt(null)}
          onLog={() => {
            const s = useFocusSessionStore.getState()
            s.setPendingReminderPrompt(null)
            s.setShowLogPrompt(true)
          }}
        />
      )}

      {/* End session confirm */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">End Session?</h3>
            <p className="text-sm text-gray-500">
              Your progress will be saved. Incomplete tasks will return to your board.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleEndSession(false)}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
              >
                Complete Session
              </button>
              <button
                onClick={() => handleEndSession(true)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
              >
                Abandon
              </button>
            </div>
            <button
              onClick={() => useFocusSessionStore.getState().setShowEndConfirm(false)}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              Keep going
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
