import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-client'
import type { TimeEntry, CreateTimeEntryInput } from '@/types'

// Query key factory
export const timeEntryKeys = {
  all: ['time-entries'] as const,
  byItem: (itemId: string) => ['time-entries', 'item', itemId] as const,
  active: ['time-entries', 'active'] as const,
}

// Fetch all time entries for the current user
export function useTimeEntries() {
  return useQuery({
    queryKey: timeEntryKeys.all,
    queryFn: async (): Promise<TimeEntry[]> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })

      if (error) throw error
      return data || []
    },
  })
}

// Fetch time entries for a specific item
export function useTimeEntriesByItem(itemId: string | null) {
  return useQuery({
    queryKey: timeEntryKeys.byItem(itemId || ''),
    queryFn: async (): Promise<TimeEntry[]> => {
      if (!itemId) return []

      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('item_id', itemId)
        .order('started_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!itemId,
  })
}

// Fetch the currently running timer (ended_at IS NULL)
export function useActiveTimeEntry() {
  return useQuery({
    queryKey: timeEntryKeys.active,
    queryFn: async (): Promise<TimeEntry | null> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', user.id)
        .is('ended_at', null)
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data
    },
  })
}

// Start timer — auto-stops any running timer first
export function useStartTimer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateTimeEntryInput): Promise<TimeEntry> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Stop any currently running timer
      const { data: running } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', user.id)
        .is('ended_at', null)
        .limit(1)
        .maybeSingle()

      if (running) {
        const now = new Date().toISOString()
        const durationSeconds = Math.floor(
          (new Date(now).getTime() - new Date(running.started_at).getTime()) / 1000
        )
        await supabase
          .from('time_entries')
          .update({ ended_at: now, duration_seconds: durationSeconds })
          .eq('id', running.id)
      }

      // Start new timer
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          user_id: user.id,
          item_id: input.item_id,
          started_at: input.started_at || new Date().toISOString(),
          note: input.note || null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: timeEntryKeys.all })
      await queryClient.cancelQueries({ queryKey: timeEntryKeys.active })

      const previousEntries = queryClient.getQueryData<TimeEntry[]>(timeEntryKeys.all)
      const previousActive = queryClient.getQueryData<TimeEntry | null>(timeEntryKeys.active)

      // Optimistic: set new active timer
      const optimisticEntry: TimeEntry = {
        id: `temp-${Date.now()}`,
        user_id: '',
        item_id: input.item_id,
        started_at: input.started_at || new Date().toISOString(),
        ended_at: null,
        duration_seconds: null,
        note: input.note || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      queryClient.setQueryData<TimeEntry | null>(timeEntryKeys.active, optimisticEntry)

      return { previousEntries, previousActive }
    },
    onError: (_err, _input, context) => {
      if (context?.previousEntries) {
        queryClient.setQueryData(timeEntryKeys.all, context.previousEntries)
      }
      if (context) {
        queryClient.setQueryData(timeEntryKeys.active, context.previousActive)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: timeEntryKeys.all })
      queryClient.invalidateQueries({ queryKey: timeEntryKeys.active })
    },
  })
}

// Stop the currently running timer
export function useStopTimer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<TimeEntry> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Find the running timer
      const { data: running, error: findError } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', user.id)
        .is('ended_at', null)
        .limit(1)
        .single()

      if (findError || !running) throw new Error('No active timer to stop')

      const now = new Date().toISOString()
      const durationSeconds = Math.floor(
        (new Date(now).getTime() - new Date(running.started_at).getTime()) / 1000
      )

      const { data, error } = await supabase
        .from('time_entries')
        .update({ ended_at: now, duration_seconds: durationSeconds })
        .eq('id', running.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: timeEntryKeys.active })
      const previousActive = queryClient.getQueryData<TimeEntry | null>(timeEntryKeys.active)

      // Optimistic: clear active timer
      queryClient.setQueryData<TimeEntry | null>(timeEntryKeys.active, null)

      return { previousActive }
    },
    onError: (_err, _input, context) => {
      if (context) {
        queryClient.setQueryData(timeEntryKeys.active, context.previousActive)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: timeEntryKeys.all })
      queryClient.invalidateQueries({ queryKey: timeEntryKeys.active })
    },
  })
}

// Delete a time entry
export function useDeleteTimeEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: timeEntryKeys.all })
      const previousEntries = queryClient.getQueryData<TimeEntry[]>(timeEntryKeys.all)

      queryClient.setQueryData<TimeEntry[]>(timeEntryKeys.all, (old) =>
        old?.filter((entry) => entry.id !== id)
      )

      return { previousEntries }
    },
    onError: (_err, _id, context) => {
      if (context?.previousEntries) {
        queryClient.setQueryData(timeEntryKeys.all, context.previousEntries)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: timeEntryKeys.all })
      queryClient.invalidateQueries({ queryKey: timeEntryKeys.active })
    },
  })
}
