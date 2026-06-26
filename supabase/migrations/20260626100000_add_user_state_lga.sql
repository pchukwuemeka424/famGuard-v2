-- Add state and LGA columns to users table for Nigerian location during signup
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS lga TEXT;

CREATE INDEX IF NOT EXISTS idx_users_state ON users(state);
CREATE INDEX IF NOT EXISTS idx_users_lga ON users(lga);

COMMENT ON COLUMN users.state IS 'Nigerian state selected during signup';
COMMENT ON COLUMN users.lga IS 'Local Government Area selected during signup';
