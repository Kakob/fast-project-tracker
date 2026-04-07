import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-client'
import type { SessionTask, CreateSessionTaskInput, UpdateSessionTaskInput } from '@/types'

export const sessionTaskKeys = {
  bySession: (sessionId: string) => ['session-tasks', sessionId] as const,
}

export function useSessionTasks(sessionId: string | null) {
  return useQuery({
    queryKey: sessionTaskKeys.bySession(sessionId || ''),
    queryFn: async (): Promise<SessionTask[]> => {
      if (!sessionId) return []

      const { data, error } = await supabase
        .from('session_tasks')
        .select('*')
        .eq('session_id', sessionId)
        .order('position', { ascending: true })

      if (error) throw error
      return data || []
    },
    enabled: !!sessionId,
  })
}

export function useCreateSessionTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateSessionTaskInput): Promise<SessionTask> => {
      const { data, error } = await supabase
        .from('session_tasks')
        .insert({
          session_id: input.session_id,
          task_id: input.task_id,
          position: input.position,
          allocated_time_ms: input.allocated_time_ms,
          warning_buffer_sec: input.warning_buffer_sec ?? 180,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: sessionTaskKeys.bySession(variables.session_id),
      })
    },
  })
}

export function useUpdateSessionTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      sessionId,
      ...updates
    }: UpdateSessionTaskInput & { id: string; sessionId: string }): Promise<SessionTask> => {
      const { data, error } = await supabase
        .from('session_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onMutate: async ({ id, sessionId, ...updates }) => {
      const key = sessionTaskKeys.bySession(sessionId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<SessionTask[]>(key)

      queryClient.setQueryData<SessionTask[]>(key, (old) =>
        old?.map((st) => (st.id === id ? { ...st, ...updates } : st))
      )

      return { previous, sessionId }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          sessionTaskKeys.bySession(context.sessionId),
          context.previous
        )
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: sessionTaskKeys.bySession(variables.sessionId),
      })
    },
  })
}

export function useDeleteSessionTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      sessionId,
    }: {
      id: string
      sessionId: string
    }): Promise<void> => {
      const { error } = await supabase
        .from('session_tasks')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onMutate: async ({ id, sessionId }) => {
      const key = sessionTaskKeys.bySession(sessionId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<SessionTask[]>(key)

      queryClient.setQueryData<SessionTask[]>(key, (old) =>
        old?.filter((st) => st.id !== id)
      )

      return { previous, sessionId }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          sessionTaskKeys.bySession(context.sessionId),
          context.previous
        )
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: sessionTaskKeys.bySession(variables.sessionId),
      })
    },
  })
}
