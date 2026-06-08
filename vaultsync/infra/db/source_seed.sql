-- Sample application database for VaultSync backup testing

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  sku         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  price       NUMERIC(10,2) NOT NULL,
  stock       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id          SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  total       NUMERIC(10,2) NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed rows
INSERT INTO products (sku, name, price, stock) VALUES
  ('PRD-001', 'Widget Alpha',  9.99,  100),
  ('PRD-002', 'Widget Beta',  19.99,   50),
  ('PRD-003', 'Gadget Gamma', 49.99,   25),
  ('PRD-004', 'Doohickey',    4.99,  200),
  ('PRD-005', 'Thingamajig', 99.99,   10)
ON CONFLICT DO NOTHING;

INSERT INTO customers (email, full_name) VALUES
  ('alice@example.com', 'Alice Nguyen'),
  ('bob@example.com',   'Bob Okafor'),
  ('carol@example.com', 'Carol Smith')
ON CONFLICT DO NOTHING;

INSERT INTO orders (customer_id, total, status) VALUES
  (1, 29.98, 'completed'),
  (1, 49.99, 'shipped'),
  (2,  9.99, 'pending'),
  (3, 119.98, 'completed')
ON CONFLICT DO NOTHING;
