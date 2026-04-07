'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useLogTypes } from '@/lib/hooks/use-log-types'
import { useCreateLogEntry } from '@/lib/hooks/use-log-entries'
import type { LogType } from '@/types'

interface LogPromptProps {
  sessionId: string
  sessionTaskId: string | null
  onClose: () => void
  source?: 'manual' | 'reminder_prompt' | 'session_end'
}

interface LogValue {
  logTypeId: string
  numeric: number | null
  text: string
  choice: string | null
}

export function LogPrompt({
  sessionId,
  sessionTaskId,
  onClose,
  source = 'manual',
}: LogPromptProps) {
  const { data: logTypes } = useLogTypes()
  const createLogEntry = useCreateLogEntry()
  const [values, setValues] = useState<Map<string, LogValue>>(new Map())

  useEffect(() => {
    if (logTypes) {
      const initial = new Map<string, LogValue>()
      logTypes.forEach((lt) => {
        initial.set(lt.id, {
          logTypeId: lt.id,
          numeric: null,
          text: '',
          choice: null,
        })
      })
      setValues(initial)
    }
  }, [logTypes])

  const updateValue = (id: string, update: Partial<LogValue>) => {
    setValues((prev) => {
      const next = new Map(prev)
      const current = next.get(id)
      if (current) {
        next.set(id, { ...current, ...update })
      }
      return next
    })
  }

  const handleSave = async () => {
    const entries = Array.from(values.values()).filter(
      (v) => v.numeric !== null || v.text.trim() !== '' || v.choice !== null
    )

    for (const entry of entries) {
      await createLogEntry.mutateAsync({
        session_id: sessionId,
        session_task_id: sessionTaskId,
        log_type_id: entry.logTypeId,
        value_numeric: entry.numeric,
        value_text: entry.text.trim() || null,
        value_choice: entry.choice,
        source,
      })
    }

    onClose()
  }

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Quick Log</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {logTypes?.map((logType) => (
            <LogTypeInput
              key={logType.id}
              logType={logType}
              value={values.get(logType.id) ?? null}
              onChange={(update) => updateValue(logType.id, update)}
            />
          ))}
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Skip
          </button>
          <button
            onClick={handleSave}
            disabled={createLogEntry.isPending}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function LogTypeInput({
  logType,
  value,
  onChange,
}: {
  logType: LogType
  value: LogValue | null
  onChange: (update: Partial<LogValue>) => void
}) {
  const config = logType.config as Record<string, unknown>

  if (logType.input_type === 'numeric_scale') {
    const min = (config.min as number) || 1
    const max = (config.max as number) || 5
    const minLabel = (config.min_label as string) || ''
    const maxLabel = (config.max_label as string) || ''
    const range = Array.from({ length: max - min + 1 }, (_, i) => min + i)

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {logType.name}
        </label>
        <div className="flex items-center gap-1">
          {minLabel && (
            <span className="text-xs text-gray-400 mr-1">{minLabel}</span>
          )}
          {range.map((n) => (
            <button
              key={n}
              onClick={() => onChange({ numeric: n })}
              className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                value?.numeric === n
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {n}
            </button>
          ))}
          {maxLabel && (
            <span className="text-xs text-gray-400 ml-1">{maxLabel}</span>
          )}
        </div>
      </div>
    )
  }

  if (logType.input_type === 'text') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {logType.name}
        </label>
        <textarea
          value={value?.text || ''}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={2}
          placeholder={`Add ${logType.name.toLowerCase()}...`}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none bg-white text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
        />
      </div>
    )
  }

  if (logType.input_type === 'multiple_choice') {
    const options = ((config.options as string[]) || [])

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {logType.name}
        </label>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => onChange({ choice: option })}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                value?.choice === option
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return null
}
