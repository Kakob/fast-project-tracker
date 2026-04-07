'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  Clock,
  SkipForward,
  Pause,
  Plus,
  Target,
  Save,
} from 'lucide-react'
import { useFocusSessionStore } from '@/lib/stores/focus-session-store'
import { useSessionTasks } from '@/lib/hooks/use-session-tasks'
import { useItems } from '@/lib/hooks/use-items'
import { useLogEntries } from '@/lib/hooks/use-log-entries'
import { useLogTypes } from '@/lib/hooks/use-log-types'
import { useCreateSessionTemplate } from '@/lib/hooks/use-session-templates'
import { SessionReflection } from './session-reflection'

interface SessionSummaryProps {
  sessionId: string | null
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function SessionSummary({ sessionId }: SessionSummaryProps) {
  const router = useRouter()
  const sessionElapsedMs = useFocusSessionStore((s) => s.sessionElapsedMs)
  const totalPauseMs = useFocusSessionStore((s) => s.totalPauseMs)
  const totalBreakMs = useFocusSessionStore((s) => s.totalBreakMs)
  const sessionStatus = useFocusSessionStore((s) => s.sessionStatus)
  const clearSession = useFocusSessionStore((s) => s.clearSession)
  const setShowSetupModal = useFocusSessionStore((s) => s.setShowSetupModal)
  const { data: sessionTasks } = useSessionTasks(sessionId)
  const { data: items } = useItems()
  const { data: logEntries } = useLogEntries(sessionId)
  const { data: logTypes } = useLogTypes()
  const createTemplate = useCreateSessionTemplate()

  const [showReflection, setShowReflection] = useState(true)
  const [templateName, setTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)

  const completedTasks = sessionTasks?.filter((st) => st.status === 'completed') || []
  const returnedTasks =
    sessionTasks?.filter(
      (st) => st.status === 'paused_incomplete' || st.status === 'skipped'
    ) || []
  const totalExtensions = sessionTasks?.reduce((sum, st) => sum + st.extension_count, 0) || 0
  const totalExtensionMs = sessionTasks?.reduce((sum, st) => sum + st.extensions_ms, 0) || 0

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !sessionTasks) return

    await createTemplate.mutateAsync({
      name: templateName.trim(),
      template_data: {
        slots: sessionTasks.map((st) => ({
          task_id: st.task_id,
          allocated_time_ms: st.allocated_time_ms,
          warning_buffer_sec: st.warning_buffer_sec,
          position: st.position,
        })),
      },
    })

    setShowSaveTemplate(false)
    setTemplateName('')
  }

  const handleDone = () => {
    clearSession()
    router.push('/board')
  }

  const handleNewSession = () => {
    clearSession()
    setShowSetupModal(true)
    router.push('/focus')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Target className="w-6 h-6 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Session Complete</h2>
        <p className="text-sm text-gray-500 mt-1">
          {sessionStatus === 'abandoned' ? 'Session was ended early' : 'Great work!'}
        </p>
      </div>

      {/* Time breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-500 mb-3">
          Time Breakdown
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {formatDuration(sessionElapsedMs)}
            </div>
            <div className="text-xs text-gray-400 mt-1">Active work</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-500">
              {formatDuration(totalPauseMs)}
            </div>
            <div className="text-xs text-gray-400 mt-1">Paused</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">
              {formatDuration(totalBreakMs)}
            </div>
            <div className="text-xs text-gray-400 mt-1">Breaks</div>
          </div>
        </div>
      </div>

      {/* Tasks completed */}
      {completedTasks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            Completed ({completedTasks.length})
          </h3>
          <div className="space-y-2">
            {completedTasks.map((st) => {
              const item = items?.find((i) => i.id === st.task_id)
              return (
                <div key={st.id} className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 flex-1">
                    {item?.title || 'Unknown task'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDuration(st.actual_time_ms)} /{' '}
                    {formatDuration(st.allocated_time_ms)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tasks returned to Doing */}
      {returnedTasks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            Returned to Board ({returnedTasks.length})
          </h3>
          <div className="space-y-2">
            {returnedTasks.map((st) => {
              const item = items?.find((i) => i.id === st.task_id)
              return (
                <div key={st.id} className="flex items-center gap-3">
                  {st.status === 'skipped' ? (
                    <SkipForward className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <Pause className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  )}
                  <span className="text-sm text-gray-700 flex-1">
                    {item?.title || 'Unknown task'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDuration(st.actual_time_ms)} /{' '}
                    {formatDuration(st.allocated_time_ms)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Per-task breakdown */}
      {sessionTasks && sessionTasks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-500">
              Task Details
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="px-5 py-2 text-left font-medium">Task</th>
                <th className="px-3 py-2 text-right font-medium">Allocated</th>
                <th className="px-3 py-2 text-right font-medium">Actual</th>
                <th className="px-3 py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessionTasks.map((st) => {
                const item = items?.find((i) => i.id === st.task_id)
                return (
                  <tr key={st.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-2.5 text-gray-700">
                      {item?.title || 'Unknown'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-500">
                      {formatDuration(st.allocated_time_ms)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700 font-medium">
                      {formatDuration(st.actual_time_ms)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          st.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : st.status === 'skipped'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {st.status === 'completed'
                          ? 'Done'
                          : st.status === 'skipped'
                          ? 'Skipped'
                          : 'Incomplete'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Extensions */}
      {totalExtensions > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Plus className="w-4 h-4" />
          {totalExtensions} extension{totalExtensions !== 1 ? 's' : ''} (
          {formatDuration(totalExtensionMs)} added)
        </div>
      )}

      {/* Log entries */}
      {logEntries && logEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            Log Entries ({logEntries.length})
          </h3>
          <div className="space-y-2">
            {logEntries.map((entry) => {
              const logType = logTypes?.find((lt) => lt.id === entry.log_type_id)
              return (
                <div key={entry.id} className="flex items-center gap-3 text-sm">
                  <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-500 font-medium">
                    {logType?.name || 'Log'}:
                  </span>
                  <span className="text-gray-700">
                    {entry.value_numeric ?? entry.value_text ?? entry.value_choice ?? '-'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Reflection */}
      {showReflection && sessionId && (
        <SessionReflection
          sessionId={sessionId}
          onSkip={() => setShowReflection(false)}
        />
      )}

      {/* Save as template */}
      {showSaveTemplate ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">
            Save as Template
          </h3>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template name..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveTemplate}
              disabled={!templateName.trim()}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => setShowSaveTemplate(false)}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowSaveTemplate(true)}
          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
        >
          <Save className="w-4 h-4" />
          Save as template
        </button>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-center pt-4">
        <button
          onClick={handleNewSession}
          className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Start New Session
        </button>
        <button
          onClick={handleDone}
          className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          Back to Board
        </button>
      </div>
    </div>
  )
}
