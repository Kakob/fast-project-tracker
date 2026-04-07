import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-client'
import type { LogType } from '@/types'

export const logTypeKeys = {
  all: ['log-types'] as const,
}

export function useLogTypes() {
  return useQuery({
    queryKey: logTypeKeys.all,
    queryFn: async (): Promise<LogType[]> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('log_types')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true })

      if (error) throw error
      return data || []
    },
  })
}
