CREATE TABLE inventory_lots (
    id uuid PRIMARY KEY,
    product_id uuid NOT NULL REFERENCES records(id),
    code text NOT NULL,
    manufactured_on date NOT NULL,
    expires_on date NOT NULL CHECK (expires_on > manufactured_on),
    quantity integer NOT NULL CHECK (quantity >= 0),
    UNIQUE (product_id, code)
);

CREATE INDEX inventory_lots_fefo ON inventory_lots (product_id, expires_on, manufactured_on, id);
