ALTER TABLE inventory_lots
    ADD COLUMN quarantined_at timestamptz,
    ADD COLUMN quarantine_reference text;
