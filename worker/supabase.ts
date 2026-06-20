import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

export function createWorkerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: ws },
    }
  )
}
