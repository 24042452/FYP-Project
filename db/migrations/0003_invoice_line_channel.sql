-- Which payment channel an MDR invoice line belongs to (NULL for terminal rental / portal fee).
ALTER TABLE invoice_lines
  ADD COLUMN channel ENUM('nets_qr','nets_click','enets','card','sgqr') NULL AFTER charge_type;
