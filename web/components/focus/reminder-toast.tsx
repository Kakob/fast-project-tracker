'use client'

import { useEffect, useRef } from 'react'
import { Bell, FileEdit, X } from 'lucide-react'
import type { Reminder } from '@/types'

interface ReminderToastProps {
  reminder: Reminder
  onDismiss: () => void
  onLog: () => void
}

const AUTO_DISMISS_MS = 8000

export function ReminderToast({ reminder, onDismiss, onLog }: ReminderToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onDismiss])

  // Audio delivery via Web Speech API
  useEffect(() => {
    if (reminder.delivery === 'audio' || reminder.delivery === 'both') {
      try {
        const utterance = new SpeechSynthesisUtterance(reminder.content)
        utterance.rate = 0.9
        utterance.volume = 0.7
        speechSynthesis.speak(utterance)
      } catch {
        // TTS may not be available
      }
    }
  }, [reminder])

  // Only show visual if delivery includes visual
  if (reminder.delivery === 'audio') return null

  return (
    <div className="fixed top-20 right-4 z-50 animate-slide-in-right">
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 max-w-sm flex gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
          <Bell className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 mb-0.5">
            Reminder
          </div>
          <p className="text-sm text-gray-600">{reminder.content}</p>
          {reminder.triggers_log_type_id && (
            <button
              onClick={onLog}
              className="flex items-center gap-1 mt-2 text-xs text-indigo-600 hover:text-indigo-700"
            >
              <FileEdit className="w-3 h-3" />
              Log now
            </button>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
