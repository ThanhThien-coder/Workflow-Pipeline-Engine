-- S04: thời điểm task Done được mở lại (Reopen); null nếu chưa từng mở lại.
ALTER TABLE node ADD COLUMN reopened_at TIMESTAMPTZ NULL;
