import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-client'
import type { FocusSession, CreateFocusSessionInput, FocusSessionStatus, SessionEndReason } from '@/types'
import { sessionTaskKeys } from './use-session-tasks'
import { itemKeys } from './use-items'

export const focusSessionKeys = {
  all: ['focus-sessions'] as const,
  byId: (id: string) => ['focus-sessions', id] as const,
  active: ['focus-sessions', 'active'] as const,
}

export function useFocusSessions() {
  return useQuery({
    queryKey: focusSessionKeys.all,
    queryFn: async (): Promise<FocusSession[]> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
  })
}

export function useFocusSession(id: string | null) {
  return useQuery({
    queryKey: focusSessionKeys.byId(id || ''),
    queryFn: async (): Promise<FocusSession | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useActiveFocusSession() {
  return useQuery({
    queryKey: focusSessionKeys.active,
    queryFn: async (): Promise<FocusSession | null> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['setup', 'active', 'paused'])
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data
    },
  })
}

export function useCreateFocusSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateFocusSessionInput): Promise<FocusSession> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('focus_sessions')
        .insert({
          user_id: user.id,
          status: 'setup',
          template_id: input.template_id || null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: focusSessionKeys.all })
      queryClient.invalidateQueries({ queryKey: focusSessionKeys.active })
    },
  })
}

export function useUpdateFocusSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string
      status?: FocusSessionStatus
      started_at?: string | null
      paused_at?: string | null
      completed_at?: string | null
      total_pause_ms?: number
      total_break_ms?: number
      total_active_ms?: number
      ended_by?: SessionEndReason | null
    }): Promise<FocusSession> => {
      const { data, error } = await supabase
        .from('focus_sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: focusSessionKeys.active })
      const previousActive = queryClient.getQueryData<FocusSession | null>(focusSessionKeys.active)

      if (previousActive?.id === id) {
        queryClient.setQueryData<FocusSession | null>(focusSessionKeys.active, {
          ...previousActive,
          ...updates,
          updated_at: new Date().toISOString(),
        })
      }

      return { previousActive }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousActive) {
        queryClient.setQueryData(focusSessionKeys.active, context.previousActive)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: focusSessionKeys.all })
      queryClient.invalidateQueries({ queryKey: focusSessionKeys.active })
    },
  })
}

export function useEndFocusSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ended_by,
      total_active_ms,
      total_pause_ms,
      total_break_ms,
      session_tasks,
    }: {
      id: string
      ended_by: SessionEndReason
      total_active_ms: number
      total_pause_ms: number
      total_break_ms: number
      session_tasks: Array<{
        task_id: string
        actual_time_ms: number
        status: string
      }>
    }): Promise<FocusSession> => {
      // Update the session
      const { data: session, error: sessionError } = await supabase
        .from('focus_sessions')
        .update({
          status: ended_by === 'abandoned' ? 'abandoned' : 'completed',
          completed_at: new Date().toISOString(),
          ended_by,
          total_active_ms,
          total_pause_ms,
          total_break_ms,
        })
        .eq('id', id)
        .select()
        .single()

      if (sessionError) throw sessionError

      // Write back cumulative time and session count to items
      for (const st of session_tasks) {
        // Use RPC or direct update to increment
        const { error: itemError } = await supabase.rpc('increment_item_session_stats', {
          p_item_id: st.task_id,
          p_time_ms: st.actual_time_ms,
        })

        // Fallback: if RPC doesn't exist, do manual update
        if (itemError) {
          const { data: item } = await supabase
            .from('items')
            .select('cumulative_time_ms, session_count')
            .eq('id', st.task_id)
            .single()

          if (item) {
            await supabase
              .from('items')
              .update({
                cumulative_time_ms: item.cumulative_time_ms + st.actual_time_ms,
                session_count: item.session_count + 1,
                status: st.status === 'completed' ? 'done' : 'in_progress',
              })
              .eq('id', st.task_id)
          }
        }
      }

      return session
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: focusSessionKeys.all })
      queryClient.invalidateQueries({ queryKey: focusSessionKeys.active })
      queryClient.invalidateQueries({ queryKey: itemKeys.all })
    },
  })
}
