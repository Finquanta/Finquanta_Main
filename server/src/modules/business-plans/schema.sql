CREATE TABLE IF NOT EXISTS business_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  template VARCHAR(120) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'Draft',
  description TEXT NOT NULL DEFAULT '',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  share_status VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (share_status IN ('private', 'shared', 'public')),
  shared_with JSONB NOT NULL DEFAULT '[]',
  target_audience TEXT NOT NULL DEFAULT '',
  industry VARCHAR(160) NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_plan_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,
  section_type VARCHAR(120) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  word_count INTEGER NOT NULL DEFAULT 0,
  template_content TEXT,
  guidance JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_plan_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  target_date DATE NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  category VARCHAR(40) NOT NULL CHECK (category IN ('product', 'marketing', 'financial', 'operational')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_plan_financial_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  revenue DECIMAL(14,2) NOT NULL DEFAULT 0,
  expenses DECIMAL(14,2) NOT NULL DEFAULT 0,
  profit DECIMAL(14,2) NOT NULL DEFAULT 0,
  profit_margin DECIMAL(6,2) NOT NULL DEFAULT 0,
  growth_rate DECIMAL(6,2) NOT NULL DEFAULT 0,
  employees INTEGER NOT NULL DEFAULT 0,
  customer_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, year)
);
