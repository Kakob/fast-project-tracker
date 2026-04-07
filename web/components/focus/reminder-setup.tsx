'use client'

import { useState } from 'react'
import { Bell, Plus, X, Globe } from 'lucide-react'
import type { Reminder } from '@/types'

interface SessionReminderDraft {
  content: string
  triggerType: 'interval' | 'moment'
  intervalMinutes?: number
  moment?: string
}

interface ReminderSetupProps {
  globalReminders: Reminder[]
  sessionReminders: SessionReminderDraft[]
  onAddReminder: (reminder: SessionReminderDraft) => void
  onRemoveReminder: (index: number) => void
}

export function ReminderSetup({
  globalReminders,
  sessionReminders,
  onAddReminder,
  onRemoveReminder,
}: ReminderSetupProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [content, setContent] = useState('')
  const [triggerType, setTriggerType] = useState<'interval' | 'moment'>('interval')
  const [intervalMinutes, setIntervalMinutes] = useState(20)
  const [moment, setMoment] = useState('start')

  const handleAdd = () => {
    if (!content.trim()) return
    onAddReminder({
      content: content.trim(),
      triggerType,
      intervalMinutes: triggerType === 'interval' ? intervalMinutes : undefined,
      moment: triggerType === 'moment' ? moment : undefined,
    })
    setContent('')
    setIsAdding(false)
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
        <Bell className="w-4 h-4" />
        Reminders
      </h3>

      {/* Global reminders (read-only) */}
      {globalReminders.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">
            Global (always active)
          </div>
          <div className="space-y-1">
            {globalReminders.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm"
              >
                <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-gray-600 flex-1">{r.content}</span>
                <span className="text-xs text-gray-400">
                  {r.trigger_type === 'interval' && r.trigger_interval_ms
                    ? `every ${Math.round(r.trigger_interval_ms / 60000)}m`
                    : r.trigger_type === 'moment'
                    ? r.trigger_moment
                    : 'manual'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session reminders */}
      {sessionReminders.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">
            This session
          </div>
          <div className="space-y-1">
            {sessionReminders.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg text-sm"
              >
                <Bell className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <span className="text-gray-700 flex-1">{r.content}</span>
                <span className="text-xs text-gray-400">
                  {r.triggerType === 'interval'
                    ? `every ${r.intervalMinutes}m`
                    : r.moment}
                </span>
                <button
                  onClick={() => onRemoveReminder(i)}
                  className="p-0.5 text-gray-400 hover:text-red-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add reminder form */}
      {isAdding ? (
        <div className="border border-gray-200 rounded-lg p-3 space-y-3">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Reminder message... (e.g., &quot;Stay focused on the goal&quot;)"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
            autoFocus
          />

          <div className="flex items-center gap-3">
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as 'interval' | 'moment')}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700"
            >
              <option value="interval">Repeat every...</option>
              <option value="moment">At a moment...</option>
            </select>

            {triggerType === 'interval' ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(parseInt(e.target.value) || 1)}
                  className="w-16 px-2 py-1.5 text-sm border border-gray-200 rounded-lg text-center bg-white text-gray-700"
                />
                <span className="text-sm text-gray-500">minutes</span>
              </div>
            ) : (
              <select
                value={moment}
                onChange={(e) => setMoment(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700"
              >
                <option value="start">Task start</option>
                <option value="halfway">Halfway</option>
                <option value="end">Near end</option>
              </select>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!content.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              Add Reminder
            </button>
            <button
              onClick={() => { setIsAdding(false); setContent('') }}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Add session reminder
        </button>
      )}
    </div>
  )
}
