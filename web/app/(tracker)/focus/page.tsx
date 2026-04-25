'use client'

import { useEffect } from 'react'
import { Target, Plus } from 'lucide-react'
import { useActiveFocusSession } from '@/lib/hooks/use-focus-sessions'
import { useFocusSessionStore } from '@/lib/stores/focus-session-store'
import { ActiveSessionView } from '@/components/focus/active-session-view'
import { SessionSummary } from '@/components/focus/session-summary'

export default function FocusPage() {
  const { data: activeSession, isLoading } = useActiveFocusSession()

  const activeSessionId = useFocusSessionStore((s) => s.activeSessionId)
  const sessionStatus = useFocusSessionStore((s) => s.sessionStatus)
  const initSession = useFocusSessionStore((s) => s.initSession)
  const setSessionStatus = useFocusSessionStore((s) => s.setSessionStatus)
  const setShowSetupModal = useFocusSessionStore((s) => s.setShowSetupModal)
  const clearSession = useFocusSessionStore((s) => s.clearSession)

  // Sync session from DB on page refresh (store is empty but DB has an active session)
  useEffect(() => {
    if (activeSession && !activeSessionId) {
      if (activeSession.status === 'active' || activeSession.status === 'paused') {
        initSession(activeSession.id, 0)
        setSessionStatus(activeSession.status)
      }
      // If DB session is 'setup', it was never started -- ignore it
    }
  }, [activeSession, activeSessionId, initSession, setSessionStatus])

  // If the store says completed/abandoned but DB still shows active,
  // clear the store so we can start fresh after viewing the summary
  useEffect(() => {
    if (!activeSession && activeSessionId && sessionStatus !== 'completed' && sessionStatus !== 'abandoned') {
      // Session was cleaned up from DB but store still has it -- clear store
      clearSession()
    }
  }, [activeSession, activeSessionId, sessionStatus, clearSession])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  // Session completed/abandoned - show summary
  if (sessionStatus === 'completed' || sessionStatus === 'abandoned') {
    return <SessionSummary sessionId={activeSessionId} />
  }

  // Active or paused session
  if (activeSession && activeSessionId) {
    return <ActiveSessionView sessionId={activeSession.id} />
  }

  // No active session - show empty state
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
        <Target className="w-8 h-8 text-indigo-600" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Focus Sessions
      </h2>
      <p className="text-gray-500 max-w-md mb-6">
        Create a focused work session with timed tasks, reminders, and breaks.
        Track your progress and build better work habits.
      </p>
      <button
        onClick={() => setShowSetupModal(true)}
        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <Plus className="w-4 h-4" />
        New Focus Session
      </button>
    </div>
  )
}
