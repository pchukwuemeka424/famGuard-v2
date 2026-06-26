-- Store advert display duration in seconds (e.g. 10-30), not minutes
COMMENT ON COLUMN advert.timer IS 'How long the advert stays on screen, in seconds';

ALTER TABLE advert ALTER COLUMN timer SET DEFAULT 15;

-- Previous values were stored as minutes; convert known sample rows to seconds
UPDATE advert
SET timer = timer * 60
WHERE timer > 0 AND timer <= 5;
