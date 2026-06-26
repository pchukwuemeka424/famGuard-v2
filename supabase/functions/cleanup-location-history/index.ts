// Supabase Edge Function: Cleanup Location History (disabled)
// Location history is preserved indefinitely — this function is a no-op.
// Deploy with: supabase functions deploy cleanup-location-history

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  console.log('Location history cleanup is disabled — preserving full history')

  return new Response(
    JSON.stringify({
      success: true,
      deleted: 0,
      message: 'Location history cleanup is disabled. All history rows are preserved.',
    }),
    {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    }
  )
})
