'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
          // Ensure profile exists for this user
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', session.user.id)
            .single()

          if (!profile) {
            // Create profile if it doesn't exist
            await supabase.from('profiles').insert({
              id: session.user.id,
              email: session.user.email,
              display_name: session.user.user_metadata?.full_name ||
                           session.user.user_metadata?.name ||
                           session.user.email?.split('@')[0],
            })
          }

          router.push('/board')
        } else {
          router.push('/sign-in')
        }
      } catch (error) {
        console.error('Auth callback error:', error)
        router.push('/sign-in')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  )
}

