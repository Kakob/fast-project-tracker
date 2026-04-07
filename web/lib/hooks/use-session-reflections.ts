import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-client'
import type { SessionReflection, CreateSessionReflectionInput } from '@/types'

export const sessionReflectionKeys = {
  bySession: (sessionId: string) => ['session-reflections', sessionId] as const,
}

export function useSessionReflection(sessionId: string | null) {
  return useQuery({
    queryKey: sessionReflectionKeys.bySession(sessionId || ''),
    queryFn: async (): Promise<SessionReflection | null> => {
      if (!sessionId) return null

      const { data, error } = await supabase
        .from('session_reflections')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle()

      if (error) throw error
      return data
    },
    enabled: !!sessionId,
  })
}

export function useCreateSessionReflection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateSessionReflectionInput): Promise<SessionReflection> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('session_reflections')
        .insert({
          user_id: user.id,
          session_id: input.session_id,
          how_it_went: input.how_it_went ?? null,
          wins: input.wins ?? null,
          friction: input.friction ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: sessionReflectionKeys.bySession(variables.session_id),
      })
    },
  })
}
