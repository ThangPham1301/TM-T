CREATE TABLE packing_photos (
    order_id uuid PRIMARY KEY REFERENCES records(id) ON DELETE CASCADE,
    id uuid NOT NULL UNIQUE,
    order_revision integer NOT NULL,
    content bytea NOT NULL,
    uploaded_at timestamptz NOT NULL DEFAULT now()
);
