import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-client'
import type { Reminder, CreateReminderInput, UpdateReminderInput, ReminderSourceType } from '@/types'

export const reminderKeys = {
  all: ['reminders'] as const,
  bySource: (sourceType: ReminderSourceType, sourceId?: string | null) =>
    ['reminders', sourceType, sourceId ?? 'global'] as const,
  global: ['reminders', 'global'] as const,
}

export function useReminders(sourceType?: ReminderSourceType, sourceId?: string | null) {
  return useQuery({
    queryKey: sourceType
      ? reminderKeys.bySource(sourceType, sourceId)
      : reminderKeys.all,
    queryFn: async (): Promise<Reminder[]> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let query = supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)

      if (sourceType) {
        query = query.eq('source_type', sourceType)
        if (sourceId) {
          query = query.eq('source_id', sourceId)
        } else if (sourceType === 'global') {
          query = query.is('source_id', null)
        }
      }

      const { data, error } = await query.order('created_at', { ascending: true })

      if (error) throw error
      return data || []
    },
  })
}

export function useGlobalReminders() {
  return useReminders('global')
}

export function useSessionReminders(sessionId: string | null) {
  return useReminders(sessionId ? 'session' : undefined, sessionId)
}

export function useCreateReminder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateReminderInput): Promise<Reminder> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('reminders')
        .insert({
          user_id: user.id,
          content: input.content,
          source_type: input.source_type,
          source_id: input.source_id || null,
          delivery: input.delivery || 'visual',
          trigger_type: input.trigger_type,
          trigger_interval_ms: input.trigger_interval_ms || null,
          trigger_moment: input.trigger_moment || null,
          trigger_timestamp_ms: input.trigger_timestamp_ms || null,
          triggers_log_type_id: input.triggers_log_type_id || null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: reminderKeys.all })
    },
  })
}

export function useUpdateReminder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: UpdateReminderInput & { id: string }): Promise<Reminder> => {
      const { data, error } = await supabase
        .from('reminders')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: reminderKeys.all })
    },
  })
}

export function useDeleteReminder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: reminderKeys.all })
    },
  })
}
