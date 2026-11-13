CREATE TABLE customers(id uuid PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL, role text NOT NULL CHECK(role IN ('CUSTOMER','ADMIN')), name text NOT NULL, phone text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true, marketing boolean NOT NULL DEFAULT false);
CREATE TABLE sessions(token_hash text PRIMARY KEY, customer_id uuid NOT NULL REFERENCES customers(id), expires_at timestamptz NOT NULL);
CREATE TABLE records(id uuid PRIMARY KEY, kind text NOT NULL, owner_id uuid REFERENCES customers(id), data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX records_owner_kind ON records(owner_id,kind);
CREATE TABLE operations(actor_id uuid NOT NULL, key text NOT NULL, fingerprint text NOT NULL, result jsonb NOT NULL, PRIMARY KEY(actor_id,key));
CREATE TABLE audit(id bigserial PRIMARY KEY, actor_id uuid NOT NULL, subject text NOT NULL, action text NOT NULL, at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION immutable_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit is append only'; END $$;
CREATE TRIGGER audit_no_update BEFORE UPDATE OR DELETE ON audit FOR EACH ROW EXECUTE FUNCTION immutable_audit();
