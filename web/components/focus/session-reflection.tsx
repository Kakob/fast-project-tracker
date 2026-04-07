'use client'

import { useState } from 'react'
import { useCreateSessionReflection } from '@/lib/hooks/use-session-reflections'

interface SessionReflectionProps {
  sessionId: string
  onSkip: () => void
}

const RATING_LABELS = ['Rough', 'Hard', 'OK', 'Good', 'Great']

export function SessionReflection({ sessionId, onSkip }: SessionReflectionProps) {
  const createReflection = useCreateSessionReflection()
  const [howItWent, setHowItWent] = useState<number | null>(null)
  const [wins, setWins] = useState('')
  const [friction, setFriction] = useState('')
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    await createReflection.mutateAsync({
      session_id: sessionId,
      how_it_went: howItWent,
      wins: wins.trim() || null,
      friction: friction.trim() || null,
      notes: notes.trim() || null,
    })
    setSaved(true)
  }

  if (saved) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
        <p className="text-sm text-green-700 font-medium">
          Reflection saved
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          How did it go?
        </h3>
        <button
          onClick={onSkip}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Skip
        </button>
      </div>

      {/* Rating */}
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setHowItWent(n)}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              howItWent === n
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {n}
            <div className="text-xs mt-0.5 opacity-70">
              {RATING_LABELS[n - 1]}
            </div>
          </button>
        ))}
      </div>

      {/* Wins */}
      <div>
        <label className="block text-sm text-gray-600 mb-1">Wins</label>
        <textarea
          value={wins}
          onChange={(e) => setWins(e.target.value)}
          rows={2}
          placeholder="What went well?"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none bg-white text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
        />
      </div>

      {/* Friction */}
      <div>
        <label className="block text-sm text-gray-600 mb-1">Friction</label>
        <textarea
          value={friction}
          onChange={(e) => setFriction(e.target.value)}
          rows={2}
          placeholder="What was difficult?"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none bg-white text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm text-gray-600 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Anything else..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none bg-white text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={createReflection.isPending}
        className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {createReflection.isPending ? 'Saving...' : 'Save Reflection'}
      </button>
    </div>
  )
}
