-- What a check-up problem is about, so the page can show it without re-running the check.
-- `message` is the plain-English sentence; `day` and `channel` say which sales it concerns.
-- (`note` stays the merchant's own words from "Mark as sorted".)
ALTER TABLE recon_exceptions
  ADD COLUMN day DATE NULL AFTER transaction_id,
  ADD COLUMN channel ENUM('nets_qr','nets_click','enets','card','sgqr') NULL AFTER day,
  ADD COLUMN message VARCHAR(300) NULL AFTER channel;
