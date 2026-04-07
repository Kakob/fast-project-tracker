'use client'

import { useRouter } from 'next/navigation'
import { Target, Pause, Play } from 'lucide-react'
import { useFocusSessionStore } from '@/lib/stores/focus-session-store'
import { useSessionTasks } from '@/lib/hooks/use-session-tasks'
import { useItems } from '@/lib/hooks/use-items'

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function FocusSessionIndicator() {
  const router = useRouter()
  const store = useFocusSessionStore()
  const { data: sessionTasks } = useSessionTasks(store.activeSessionId)
  const { data: items } = useItems()

  if (!store.activeSessionId || !store.sessionStatus) return null
  if (store.sessionStatus === 'completed' || store.sessionStatus === 'abandoned') return null

  const currentTask = sessionTasks?.[store.currentTaskIndex]
  const currentItem = currentTask ? items?.find((i) => i.id === currentTask.task_id) : null
  const isPaused = store.sessionStatus === 'paused'

  return (
    <button
      onClick={() => router.push('/focus')}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
        isPaused
          ? 'bg-amber-100 text-amber-700'
          : 'bg-indigo-100 text-indigo-700'
      }`}
    >
      <Target className="w-4 h-4" />
      <span className="font-mono tabular-nums text-xs">
        {formatTime(store.sessionElapsedMs)}
      </span>
      {currentItem && (
        <span className="max-w-24 truncate text-xs">
          {currentItem.title}
        </span>
      )}
      {isPaused ? (
        <Pause className="w-3 h-3" />
      ) : (
        <Play className="w-3 h-3" />
      )}
    </button>
  )
}
