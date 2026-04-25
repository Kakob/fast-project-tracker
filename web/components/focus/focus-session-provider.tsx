'use client'

import { useEffect, useRef } from 'react'
import { useActiveFocusSession } from '@/lib/hooks/use-focus-sessions'
import { useSessionTasks, useUpdateSessionTask } from '@/lib/hooks/use-session-tasks'
import { useReminders } from '@/lib/hooks/use-reminders'
import { useFocusSessionStore } from '@/lib/stores/focus-session-store'

const TRANSITION_DURATION_MS = 4000

export function FocusSessionProvider() {
  const { data: activeSession } = useActiveFocusSession()
  const activeSessionId = useFocusSessionStore((s) => s.activeSessionId)
  const { data: sessionTasks } = useSessionTasks(activeSessionId)
  const updateSessionTask = useUpdateSessionTask()

  const setSessionElapsedMs = useFocusSessionStore((s) => s.setSessionElapsedMs)
  const setCurrentTaskElapsedMs = useFocusSessionStore((s) => s.setCurrentTaskElapsedMs)
  const setWarningActive = useFocusSessionStore((s) => s.setWarningActive)
  const setBreakElapsedMs = useFocusSessionStore((s) => s.setBreakElapsedMs)
  const endBreak = useFocusSessionStore((s) => s.endBreak)
  const isOnBreak = useFocusSessionStore((s) => s.isOnBreak)
  const breakPlannedDurationSec = useFocusSessionStore((s) => s.breakPlannedDurationSec)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const breakIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const warningFiredForTaskRef = useRef(-1)
  const autoAdvancedForTaskRef = useRef(-1)
  const warningAudioRef = useRef<AudioContext | null>(null)

  // Refs for data the tick callback needs
  const sessionTasksRef = useRef(sessionTasks)
  sessionTasksRef.current = sessionTasks
  const updateSessionTaskRef = useRef(updateSessionTask)
  updateSessionTaskRef.current = updateSessionTask

  // Session timer
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (activeSession && activeSession.status === 'active' && activeSession.started_at) {
      const startedAt = new Date(activeSession.started_at).getTime()
      const pauseAndBreakMs = activeSession.total_pause_ms + activeSession.total_break_ms

      const computeElapsed = () => {
        const sessionElapsed = Date.now() - startedAt - pauseAndBreakMs
        setSessionElapsedMs(sessionElapsed)

        // Per-task elapsed
        const s = useFocusSessionStore.getState()
        const taskElapsed = sessionElapsed - s.taskStartSessionElapsedMs
        setCurrentTaskElapsedMs(taskElapsed)

        // Warning zone + auto-advance
        const tasks = sessionTasksRef.current
        const currentTask = tasks?.[s.currentTaskIndex]
        if (currentTask && tasks) {
          const totalAllocated = currentTask.allocated_time_ms + currentTask.extensions_ms
          const remaining = totalAllocated - taskElapsed
          const warningMs = currentTask.warning_buffer_sec * 1000

          // Warning
          if (remaining <= warningMs && remaining > 0 && warningFiredForTaskRef.current !== s.currentTaskIndex) {
            warningFiredForTaskRef.current = s.currentTaskIndex
            setWarningActive(true)
            playWarningSound(warningAudioRef)
          }

          // Auto-advance when time expires
          if (taskElapsed >= totalAllocated && autoAdvancedForTaskRef.current !== s.currentTaskIndex) {
            autoAdvancedForTaskRef.current = s.currentTaskIndex

            updateSessionTaskRef.current.mutate({
              id: currentTask.id,
              sessionId: s.activeSessionId!,
              status: 'paused_incomplete',
              actual_time_ms: taskElapsed,
            })

            const nextIndex = s.currentTaskIndex + 1
            if (nextIndex >= tasks.length) {
              s.setSessionStatus('completed')
              return
            }

            const nextTask = tasks[nextIndex]
            s.enterTransition(currentTask.task_id, nextTask.task_id)

            setTimeout(() => {
              const st = useFocusSessionStore.getState()
              st.exitTransition()
              st.setCurrentTaskIndex(nextIndex, st.sessionElapsedMs)
              warningFiredForTaskRef.current = -1
              autoAdvancedForTaskRef.current = -1
              updateSessionTaskRef.current.mutate({
                id: nextTask.id,
                sessionId: st.activeSessionId!,
                status: 'active',
                started_at: new Date().toISOString(),
              })
            }, TRANSITION_DURATION_MS)
          }
        }
      }

      computeElapsed()
      intervalRef.current = setInterval(computeElapsed, 1000)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [activeSession, setSessionElapsedMs, setCurrentTaskElapsedMs, setWarningActive])

  // Break timer
  useEffect(() => {
    if (breakIntervalRef.current) {
      clearInterval(breakIntervalRef.current)
      breakIntervalRef.current = null
    }

    if (isOnBreak) {
      const breakStart = Date.now()

      const computeBreakElapsed = () => {
        const elapsed = Date.now() - breakStart
        setBreakElapsedMs(elapsed)
        if (breakPlannedDurationSec && elapsed >= breakPlannedDurationSec * 1000) {
          endBreak()
        }
      }

      computeBreakElapsed()
      breakIntervalRef.current = setInterval(computeBreakElapsed, 1000)
    }

    return () => {
      if (breakIntervalRef.current) clearInterval(breakIntervalRef.current)
    }
  }, [isOnBreak, breakPlannedDurationSec, setBreakElapsedMs, endBreak])

  // Interval-based reminder scheduling
  const { data: allReminders } = useReminders()

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'active' || !allReminders) return

    const s = useFocusSessionStore.getState()
    const tasks = sessionTasksRef.current
    const currentTask = tasks?.[s.currentTaskIndex]

    const relevant = allReminders.filter((r) => {
      if (!r.is_active) return false
      if (r.source_type === 'global') return true
      if (r.source_type === 'session' && r.source_id === activeSession.id) return true
      if (r.source_type === 'task' && currentTask && r.source_id === currentTask.task_id) return true
      return false
    })

    const timeouts: ReturnType<typeof setTimeout>[] = []

    relevant.forEach((reminder) => {
      if (reminder.trigger_type === 'interval' && reminder.trigger_interval_ms) {
        const interval = reminder.trigger_interval_ms
        const elapsed = s.sessionElapsedMs
        const nextFire = Math.ceil((elapsed + 1) / interval) * interval
        const delay = nextFire - elapsed

        if (delay > 0 && delay < 3600000) {
          const timeout = setTimeout(() => {
            const st = useFocusSessionStore.getState()
            st.addFiredReminder(reminder.id)
            st.setPendingReminderPrompt(reminder)
          }, delay)
          timeouts.push(timeout)
        }
      }
    })

    return () => timeouts.forEach((t) => clearTimeout(t))
  }, [activeSession, allReminders])

  // Cleanup audio
  useEffect(() => {
    return () => { if (warningAudioRef.current) warningAudioRef.current.close() }
  }, [])

  return null
}

function playWarningSound(audioRef: React.MutableRefObject<AudioContext | null>) {
  try {
    if (!audioRef.current) audioRef.current = new AudioContext()
    const ctx = audioRef.current
    if (ctx.state === 'suspended') ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(800, ctx.currentTime)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  } catch {
    // Audio may be blocked
  }
}
