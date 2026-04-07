'use client'

import { useState } from 'react'
import { Bell, ChevronDown, ChevronUp, Globe, Target, Clock } from 'lucide-react'
import type { Reminder } from '@/types'

interface SessionReminderPanelProps {
  reminders: Reminder[]
}

export function SessionReminderPanel({ reminders }: SessionReminderPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const globalReminders = reminders.filter((r) => r.source_type === 'global')
  const sessionReminders = reminders.filter((r) => r.source_type === 'session')
  const taskReminders = reminders.filter((r) => r.source_type === 'task')

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Bell className="w-4 h-4" />
          <span className="font-medium">
            Reminders ({reminders.filter((r) => r.is_active).length} active)
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-3">
          {globalReminders.length > 0 && (
            <ReminderGroup
              label="Global"
              icon={<Globe className="w-3.5 h-3.5" />}
              reminders={globalReminders}
            />
          )}
          {sessionReminders.length > 0 && (
            <ReminderGroup
              label="Session"
              icon={<Target className="w-3.5 h-3.5" />}
              reminders={sessionReminders}
            />
          )}
          {taskReminders.length > 0 && (
            <ReminderGroup
              label="Current task"
              icon={<Clock className="w-3.5 h-3.5" />}
              reminders={taskReminders}
            />
          )}
        </div>
      )}
    </div>
  )
}

function ReminderGroup({
  label,
  icon,
  reminders,
}: {
  label: string
  icon: React.ReactNode
  reminders: Reminder[]
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-gray-400 uppercase tracking-wider mb-1">
        {icon}
        {label}
      </div>
      <div className="space-y-1">
        {reminders.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg text-sm"
          >
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
  )
}
