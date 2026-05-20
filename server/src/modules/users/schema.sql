-- Users table schema
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    avatar TEXT,
    phone VARCHAR(50),
    job_title VARCHAR(120),
    company VARCHAR(160),
    industry VARCHAR(120),
    bio TEXT,
    address JSONB NOT NULL DEFAULT '{}',
    social_links JSONB NOT NULL DEFAULT '[]',
    company_email VARCHAR(255),
    linkedin TEXT,
    date_of_incorporation DATE,
    country VARCHAR(120),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notifications JSONB NOT NULL DEFAULT '{}',
    security JSONB NOT NULL DEFAULT '{}',
    language JSONB NOT NULL DEFAULT '{}',
    privacy JSONB NOT NULL DEFAULT '{}',
    backup JSONB NOT NULL DEFAULT '{}',
    integrations JSONB NOT NULL DEFAULT '{}',
    appearance JSONB NOT NULL DEFAULT '{}',
    help JSONB NOT NULL DEFAULT '{}',
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    current_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    target_amount DECIMAL(12,2) NOT NULL CHECK (target_amount > 0),
    color VARCHAR(40) NOT NULL DEFAULT 'bg-blue-600',
    period VARCHAR(40) NOT NULL DEFAULT 'This month',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
