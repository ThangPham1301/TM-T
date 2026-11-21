CREATE TABLE guest_sessions (
    id uuid PRIMARY KEY,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL
);

ALTER TABLE records
    ADD COLUMN guest_owner_id uuid REFERENCES guest_sessions(id),
    ADD COLUMN guest_lookup_hash text,
    ADD CONSTRAINT guest_record_ownership CHECK (
        guest_owner_id IS NULL OR (owner_id IS NULL AND kind IN ('cart', 'order'))
    ),
    ADD CONSTRAINT guest_lookup_ownership CHECK (
        guest_lookup_hash IS NULL OR (kind = 'order' AND guest_owner_id IS NOT NULL)
    );

CREATE INDEX records_guest_owner_kind ON records(guest_owner_id, kind)
    WHERE guest_owner_id IS NOT NULL;
CREATE INDEX records_order_number ON records((data->>'number')) WHERE kind = 'order';
CREATE INDEX records_guest_orders_recent ON records(created_at)
    WHERE kind = 'order' AND guest_owner_id IS NOT NULL;

CREATE TABLE guest_order_grants (
    token_hash text PRIMARY KEY,
    order_id uuid NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
);
CREATE INDEX guest_order_grants_expiry ON guest_order_grants(expires_at);

CREATE TABLE guest_rate_limits (
    scope text PRIMARY KEY,
    window_start timestamptz NOT NULL,
    attempts integer NOT NULL
);
