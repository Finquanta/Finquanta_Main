CREATE TABLE IF NOT EXISTS document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  parent_id UUID REFERENCES document_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES document_folders(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  document_type VARCHAR(60) NOT NULL,
  category VARCHAR(60) NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  storage_key TEXT NOT NULL,
  public_url TEXT,
  thumbnail_url TEXT,
  author VARCHAR(160) NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]',
  share_status VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (share_status IN ('private', 'shared', 'public')),
  shared_with JSONB NOT NULL DEFAULT '[]',
  starred BOOLEAN NOT NULL DEFAULT false,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_folder ON documents(user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_type ON documents(user_id, document_type);
CREATE INDEX IF NOT EXISTS idx_documents_user_category ON documents(user_id, category);
