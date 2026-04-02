'use client'

import { useEffect, useRef } from 'react'
import { useActiveTimeEntry } from '@/lib/hooks/use-time-entries'
import { useUIStore } from '@/lib/stores/ui-store'

export function TimerProvider() {
  const { data: activeEntry } = useActiveTimeEntry()
  const setActiveTimer = useUIStore((s) => s.setActiveTimer)
  const clearActiveTimer = useUIStore((s) => s.clearActiveTimer)
  const setTimerElapsed = useUIStore((s) => s.setTimerElapsed)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (activeEntry) {
      setActiveTimer(activeEntry.item_id, activeEntry.started_at)

      // Compute elapsed immediately
      const computeElapsed = () => {
        const elapsed = Math.floor(
          (Date.now() - new Date(activeEntry.started_at).getTime()) / 1000
        )
        setTimerElapsed(Math.max(0, elapsed))
      }

      computeElapsed()
      intervalRef.current = setInterval(computeElapsed, 1000)
    } else {
      clearActiveTimer()
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [activeEntry, setActiveTimer, clearActiveTimer, setTimerElapsed])

  return null
}
