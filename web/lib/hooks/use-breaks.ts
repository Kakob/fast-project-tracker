import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-client'
import type { Break, CreateBreakInput } from '@/types'

export const breakKeys = {
  bySession: (sessionId: string) => ['breaks', sessionId] as const,
}

export function useBreaks(sessionId: string | null) {
  return useQuery({
    queryKey: breakKeys.bySession(sessionId || ''),
    queryFn: async (): Promise<Break[]> => {
      if (!sessionId) return []

      const { data, error } = await supabase
        .from('breaks')
        .select('*')
        .eq('session_id', sessionId)
        .order('started_at', { ascending: true })

      if (error) throw error
      return data || []
    },
    enabled: !!sessionId,
  })
}

export function useCreateBreak() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateBreakInput): Promise<Break> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('breaks')
        .insert({
          user_id: user.id,
          session_id: input.session_id,
          started_at: new Date().toISOString(),
          planned_duration_sec: input.planned_duration_sec ?? null,
          break_type: input.break_type,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: breakKeys.bySession(variables.session_id),
      })
    },
  })
}

export function useEndBreak() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      sessionId,
    }: {
      id: string
      sessionId: string
    }): Promise<Break> => {
      const { data, error } = await supabase
        .from('breaks')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: breakKeys.bySession(variables.sessionId),
      })
    },
  })
}
