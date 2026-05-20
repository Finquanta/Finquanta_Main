CREATE TABLE IF NOT EXISTS payroll_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  company VARCHAR(160),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES payroll_clients(id) ON DELETE SET NULL,
  employee_name VARCHAR(160) NOT NULL,
  company VARCHAR(160),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  transaction_date DATE NOT NULL,
  transaction_time TIME,
  invoice_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('completed', 'pending', 'failed')),
  avatar_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_transactions_user_date ON payroll_transactions(user_id, transaction_date DESC);
