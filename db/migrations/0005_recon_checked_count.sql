-- How many items a check-up looked at (settlements, bill lines and missing days), so the page shows it without re-deriving it.
ALTER TABLE recon_runs
  ADD COLUMN checked_count INT NOT NULL DEFAULT 0 AFTER matched_count;
