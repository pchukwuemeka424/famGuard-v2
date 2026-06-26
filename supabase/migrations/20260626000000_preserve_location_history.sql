-- ============================================
-- Migration: Preserve full location_history
-- ============================================
-- Disables automatic deletion of location_history rows and prevents
-- client-side updates from overwriting existing history entries.

-- Unschedule the daily cleanup cron job (safe if job does not exist)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-location-history');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'cleanup-location-history cron job was not scheduled';
END;
$$;

-- Replace cleanup function with a no-op that preserves all history
CREATE OR REPLACE FUNCTION cleanup_location_history()
RETURNS void AS $$
BEGIN
  RAISE NOTICE 'Location history cleanup disabled — preserving full history at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Remove UPDATE policy so existing rows cannot be overwritten via the API
DROP POLICY IF EXISTS "Users can update their own location history" ON location_history;
