import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please create a .env.local file in the web/ directory with:\n' +
    'NEXT_PUBLIC_SUPABASE_URL=your_supabase_url\n' +
    'NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

