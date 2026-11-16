CREATE TABLE payment_notifications (
    source text NOT NULL,
    transaction_id text NOT NULL,
    order_id uuid NOT NULL REFERENCES records(id),
    amount bigint NOT NULL CHECK (amount > 0),
    received_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (source, transaction_id)
);

CREATE INDEX payment_notifications_order_id_idx ON payment_notifications (order_id);
