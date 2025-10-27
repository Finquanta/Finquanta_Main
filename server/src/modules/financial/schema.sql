-- Financial Transaction System Database Schema
-- This file creates all tables, indexes, and constraints for the financial transaction system

-- Financial Transactions Table
-- Core table for storing all financial transactions (income and expenses)
CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  date DATE NOT NULL,
  invoice VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for financial_transactions table
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON financial_transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON financial_transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON financial_transactions(user_id, category);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON financial_transactions(invoice) WHERE invoice IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_status ON financial_transactions(status);

-- Transaction Categories Table
-- Stores predefined and custom categories for transactions
CREATE TABLE IF NOT EXISTS transaction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  icon VARCHAR(50),
  color VARCHAR(7), -- hex color code
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, type)
);

-- Insert default income categories
INSERT INTO transaction_categories (name, type, icon, color, is_default) VALUES
  ('Salary', 'income', 'briefcase', '#10B981', true),
  ('Freelance', 'income', 'laptop', '#3B82F6', true),
  ('Investment', 'income', 'trending-up', '#8B5CF6', true),
  ('Business', 'income', 'store', '#F59E0B', true),
  ('Other Income', 'income', 'plus-circle', '#6B7280', true)
ON CONFLICT (name, type) DO NOTHING;

-- Insert default expense categories
INSERT INTO transaction_categories (name, type, icon, color, is_default) VALUES
  ('Food & Dining', 'expense', 'utensils', '#EF4444', true),
  ('Transportation', 'expense', 'car', '#F97316', true),
  ('Shopping', 'expense', 'shopping-bag', '#EC4899', true),
  ('Entertainment', 'expense', 'film', '#8B5CF6', true),
  ('Bills & Utilities', 'expense', 'file-text', '#3B82F6', true),
  ('Healthcare', 'expense', 'heart', '#06B6D4', true),
  ('Education', 'expense', 'book', '#84CC16', true),
  ('Business Expenses', 'expense', 'briefcase', '#F59E0B', true),
  ('Travel', 'expense', 'plane', '#14B8A6', true),
  ('Other Expenses', 'expense', 'minus-circle', '#6B7280', true)
ON CONFLICT (name, type) DO NOTHING;

-- Analytics Cache Table
-- Caches pre-calculated analytics data for performance
CREATE TABLE IF NOT EXISTS analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type VARCHAR(50) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  UNIQUE(user_id, report_type, period_start, period_end)
);

-- Indexes for analytics_cache table
CREATE INDEX IF NOT EXISTS idx_analytics_user_type ON analytics_cache(user_id, report_type);
CREATE INDEX IF NOT EXISTS idx_analytics_expires ON analytics_cache(expires_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_financial_transactions_updated_at
    BEFORE UPDATE ON financial_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for transaction summaries
CREATE OR REPLACE VIEW transaction_summary AS
SELECT
  user_id,
  type,
  category,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount,
  AVG(amount) as average_amount,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM financial_transactions
WHERE status = 'completed'
GROUP BY user_id, type, category;

-- Create view for monthly summaries
CREATE OR REPLACE VIEW monthly_summary AS
SELECT
  user_id,
  DATE_TRUNC('month', date)::DATE as month,
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses,
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) -
    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as net_income,
  COUNT(*) as transaction_count
FROM financial_transactions
WHERE status = 'completed'
GROUP BY user_id, DATE_TRUNC('month', date)
ORDER BY user_id, month DESC;