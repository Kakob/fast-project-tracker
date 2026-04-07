'use client'

import { useEffect, useRef } from 'react'
import { useActiveFocusSession } from '@/lib/hooks/use-focus-sessions'
import { useFocusSessionStore } from '@/lib/stores/focus-session-store'

export function FocusSessionProvider() {
  const { data: activeSession } = useActiveFocusSession()
  const setSessionElapsedMs = useFocusSessionStore((s) => s.setSessionElapsedMs)
  const setCurrentTaskElapsedMs = useFocusSessionStore((s) => s.setCurrentTaskElapsedMs)
  const setBreakElapsedMs = useFocusSessionStore((s) => s.setBreakElapsedMs)
  const endBreak = useFocusSessionStore((s) => s.endBreak)
  const isOnBreak = useFocusSessionStore((s) => s.isOnBreak)
  const breakPlannedDurationSec = useFocusSessionStore((s) => s.breakPlannedDurationSec)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const breakIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Session timer
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (activeSession && activeSession.status === 'active' && activeSession.started_at) {
      const startedAt = new Date(activeSession.started_at).getTime()

      const computeElapsed = () => {
        const elapsed = Date.now() - startedAt
        setSessionElapsedMs(elapsed)
        setCurrentTaskElapsedMs(elapsed)
      }

      computeElapsed()
      intervalRef.current = setInterval(computeElapsed, 1000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [activeSession, setSessionElapsedMs, setCurrentTaskElapsedMs])

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
      if (breakIntervalRef.current) {
        clearInterval(breakIntervalRef.current)
      }
    }
  }, [isOnBreak, breakPlannedDurationSec, setBreakElapsedMs, endBreak])

  return null
}
