import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-client'
import type { LogEntry, CreateLogEntryInput } from '@/types'

export const logEntryKeys = {
  bySession: (sessionId: string) => ['log-entries', sessionId] as const,
}

export function useLogEntries(sessionId: string | null) {
  return useQuery({
    queryKey: logEntryKeys.bySession(sessionId || ''),
    queryFn: async (): Promise<LogEntry[]> => {
      if (!sessionId) return []

      const { data, error } = await supabase
        .from('log_entries')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data || []
    },
    enabled: !!sessionId,
  })
}

export function useCreateLogEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateLogEntryInput): Promise<LogEntry> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('log_entries')
        .insert({
          user_id: user.id,
          session_id: input.session_id,
          session_task_id: input.session_task_id || null,
          log_type_id: input.log_type_id,
          value_numeric: input.value_numeric ?? null,
          value_text: input.value_text ?? null,
          value_choice: input.value_choice ?? null,
          source: input.source,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: logEntryKeys.bySession(variables.session_id),
      })
    },
  })
}
