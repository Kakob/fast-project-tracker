import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-client'
import type { SessionTemplate, CreateSessionTemplateInput } from '@/types'

export const sessionTemplateKeys = {
  all: ['session-templates'] as const,
}

export function useSessionTemplates() {
  return useQuery({
    queryKey: sessionTemplateKeys.all,
    queryFn: async (): Promise<SessionTemplate[]> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('session_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
  })
}

export function useCreateSessionTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateSessionTemplateInput): Promise<SessionTemplate> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('session_templates')
        .insert({
          user_id: user.id,
          name: input.name,
          description: input.description || null,
          template_data: input.template_data,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sessionTemplateKeys.all })
    },
  })
}

export function useDeleteSessionTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('session_templates')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: sessionTemplateKeys.all })
      const previous = queryClient.getQueryData<SessionTemplate[]>(sessionTemplateKeys.all)

      queryClient.setQueryData<SessionTemplate[]>(sessionTemplateKeys.all, (old) =>
        old?.filter((t) => t.id !== id)
      )

      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(sessionTemplateKeys.all, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sessionTemplateKeys.all })
    },
  })
}
