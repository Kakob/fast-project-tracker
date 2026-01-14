import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-client'
import type { Project, CreateProjectInput, UpdateProjectInput } from '@/types'

// Query key factory
export const projectKeys = {
  all: ['projects'] as const,
  byId: (id: string) => ['projects', id] as const,
}

// Fetch all projects for the current user
export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: async (): Promise<Project[]> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true })

      if (error) throw error
      return data || []
    },
  })
}

// Fetch a single project
export function useProject(id: string | null) {
  return useQuery({
    queryKey: projectKeys.byId(id || ''),
    queryFn: async (): Promise<Project | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

// Create project mutation
export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateProjectInput): Promise<Project> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          title: input.title,
          description: input.description || null,
          color: input.color || 'blue',
          icon: input.icon || null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    // Optimistic update
    onMutate: async (newProject) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.all })
      const previousProjects = queryClient.getQueryData<Project[]>(projectKeys.all)

      // Create optimistic project
      const optimisticProject: Project = {
        id: `temp-${Date.now()}`,
        user_id: '',
        title: newProject.title,
        description: newProject.description || null,
        color: newProject.color || 'blue',
        icon: newProject.icon || null,
        position: (previousProjects?.length || 0) + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      queryClient.setQueryData<Project[]>(projectKeys.all, (old) => [
        ...(old || []),
        optimisticProject,
      ])

      return { previousProjects }
    },
    onError: (err, newProject, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(projectKeys.all, context.previousProjects)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

// Update project mutation
export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateProjectInput & { id: string }): Promise<Project> => {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    // Optimistic update
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.all })
      const previousProjects = queryClient.getQueryData<Project[]>(projectKeys.all)

      queryClient.setQueryData<Project[]>(projectKeys.all, (old) =>
        old?.map((project) =>
          project.id === id
            ? {
                ...project,
                ...updates,
                updated_at: new Date().toISOString(),
              }
            : project
        )
      )

      return { previousProjects }
    },
    onError: (err, variables, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(projectKeys.all, context.previousProjects)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

// Delete project mutation
export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    // Optimistic update
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.all })
      const previousProjects = queryClient.getQueryData<Project[]>(projectKeys.all)

      queryClient.setQueryData<Project[]>(projectKeys.all, (old) =>
        old?.filter((project) => project.id !== id)
      )

      return { previousProjects }
    },
    onError: (err, id, context) => {
      if (context?.previousProjects) {
        queryClient.setQueryData(projectKeys.all, context.previousProjects)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}
