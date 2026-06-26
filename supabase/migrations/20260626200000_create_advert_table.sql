-- Full-screen adverts shown after splash, filtered by Nigerian state
CREATE TABLE IF NOT EXISTS advert (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  state TEXT NOT NULL,
  image TEXT NOT NULL,
  action BOOLEAN DEFAULT false NOT NULL,
  timer INTEGER DEFAULT 15 NOT NULL CHECK (timer >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advert_state ON advert(state);
CREATE INDEX IF NOT EXISTS idx_advert_action ON advert(action);

DROP TRIGGER IF EXISTS update_advert_updated_at ON advert;
CREATE TRIGGER update_advert_updated_at
  BEFORE UPDATE ON advert
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE advert IS 'State-based full-screen adverts shown after app splash';
COMMENT ON COLUMN advert.state IS 'Nigerian state this advert targets';
COMMENT ON COLUMN advert.image IS 'Public URL of the full-screen advert image';
COMMENT ON COLUMN advert.action IS 'When false, advert is disabled; when true, advert may be shown';
COMMENT ON COLUMN advert.timer IS 'How long the advert stays on screen, in seconds';

ALTER TABLE advert ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active adverts" ON advert;
CREATE POLICY "Anyone can read active adverts"
  ON advert FOR SELECT
  USING (action = true);
