CREATE TABLE IF NOT EXISTS pos_workstations (
    workstation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(site_id) ON DELETE CASCADE,
    workstation_code VARCHAR(50) NOT NULL,
    workstation_name VARCHAR(120) NOT NULL,
    workstation_type VARCHAR(40) NOT NULL DEFAULT 'POS'
        CHECK (workstation_type IN ('POS', 'BACK_OFFICE', 'LAB', 'OFFICE', 'OTHER')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    device_uuid VARCHAR(120),
    offline_status VARCHAR(30) NOT NULL DEFAULT 'ONLINE'
        CHECK (offline_status IN ('ONLINE', 'OFFLINE_READY', 'OFFLINE_PENDING')),
    sync_state VARCHAR(30) NOT NULL DEFAULT 'SYNCED'
        CHECK (sync_state IN ('SYNCED', 'PENDING', 'CONFLICT', 'ERROR')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    client_generated_id VARCHAR(120),
    server_id VARCHAR(120),
    is_synced BOOLEAN NOT NULL DEFAULT TRUE,
    pending_operation VARCHAR(30),
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, workstation_code),
    UNIQUE (tenant_id, workstation_name)
);

ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS workstation_id UUID REFERENCES pos_workstations(workstation_id);
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS workstation_name VARCHAR(120);
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS opened_ip_address VARCHAR(100);
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS closed_ip_address VARCHAR(100);
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS device_uuid VARCHAR(120);
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS offline_status VARCHAR(30) NOT NULL DEFAULT 'ONLINE'
    CHECK (offline_status IN ('ONLINE', 'OFFLINE_READY', 'OFFLINE_PENDING'));
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS sync_state VARCHAR(30) NOT NULL DEFAULT 'SYNCED'
    CHECK (sync_state IN ('SYNCED', 'PENDING', 'CONFLICT', 'ERROR'));
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS sync_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS client_generated_id VARCHAR(120);
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS server_id VARCHAR(120);
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS is_synced BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS pending_operation VARCHAR(30);
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP;

ALTER TABLE sales ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES cash_sessions(cash_session_id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS workstation_id UUID REFERENCES pos_workstations(workstation_id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS workstation_name VARCHAR(120);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS device_uuid VARCHAR(120);

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS workstation_id UUID REFERENCES pos_workstations(workstation_id);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS workstation_name VARCHAR(120);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS device_uuid VARCHAR(120);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(site_id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS cash_session_id UUID REFERENCES cash_sessions(cash_session_id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS workstation_id UUID REFERENCES pos_workstations(workstation_id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS workstation_name VARCHAR(120);

CREATE TABLE IF NOT EXISTS entity_comments (
    comment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(site_id) ON DELETE SET NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    parent_comment_id UUID REFERENCES entity_comments(comment_id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    visibility_scope VARCHAR(20) NOT NULL DEFAULT 'PUBLIC'
        CHECK (visibility_scope IN ('PUBLIC', 'PRIVATE')),
    cash_session_id UUID REFERENCES cash_sessions(cash_session_id) ON DELETE SET NULL,
    workstation_id UUID REFERENCES pos_workstations(workstation_id) ON DELETE SET NULL,
    workstation_name VARCHAR(120),
    offline_status VARCHAR(30) NOT NULL DEFAULT 'ONLINE'
        CHECK (offline_status IN ('ONLINE', 'OFFLINE_READY', 'OFFLINE_PENDING')),
    sync_state VARCHAR(30) NOT NULL DEFAULT 'SYNCED'
        CHECK (sync_state IN ('SYNCED', 'PENDING', 'CONFLICT', 'ERROR')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    device_uuid VARCHAR(120),
    client_generated_id VARCHAR(120),
    server_id VARCHAR(120),
    is_synced BOOLEAN NOT NULL DEFAULT TRUE,
    pending_operation VARCHAR(30),
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_threads (
    thread_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(site_id) ON DELETE SET NULL,
    title VARCHAR(180) NOT NULL,
    thread_type VARCHAR(30) NOT NULL DEFAULT 'DIRECT'
        CHECK (thread_type IN ('DIRECT', 'GROUP', 'SITE', 'SYSTEM')),
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    offline_status VARCHAR(30) NOT NULL DEFAULT 'ONLINE'
        CHECK (offline_status IN ('ONLINE', 'OFFLINE_READY', 'OFFLINE_PENDING')),
    sync_state VARCHAR(30) NOT NULL DEFAULT 'SYNCED'
        CHECK (sync_state IN ('SYNCED', 'PENDING', 'CONFLICT', 'ERROR')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    device_uuid VARCHAR(120),
    client_generated_id VARCHAR(120),
    server_id VARCHAR(120),
    is_synced BOOLEAN NOT NULL DEFAULT TRUE,
    pending_operation VARCHAR(30),
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_thread_participants (
    thread_participant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES chat_threads(thread_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_code VARCHAR(30) NOT NULL DEFAULT 'MEMBER'
        CHECK (role_code IN ('OWNER', 'MEMBER')),
    last_read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
    message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES chat_threads(thread_id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(site_id) ON DELETE SET NULL,
    message_type VARCHAR(30) NOT NULL DEFAULT 'TEXT'
        CHECK (message_type IN ('TEXT', 'NOTICE', 'TEAM', 'SYSTEM')),
    message_text TEXT NOT NULL,
    cash_session_id UUID REFERENCES cash_sessions(cash_session_id) ON DELETE SET NULL,
    workstation_id UUID REFERENCES pos_workstations(workstation_id) ON DELETE SET NULL,
    workstation_name VARCHAR(120),
    offline_status VARCHAR(30) NOT NULL DEFAULT 'ONLINE'
        CHECK (offline_status IN ('ONLINE', 'OFFLINE_READY', 'OFFLINE_PENDING')),
    sync_state VARCHAR(30) NOT NULL DEFAULT 'SYNCED'
        CHECK (sync_state IN ('SYNCED', 'PENDING', 'CONFLICT', 'ERROR')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    device_uuid VARCHAR(120),
    client_generated_id VARCHAR(120),
    server_id VARCHAR(120),
    is_synced BOOLEAN NOT NULL DEFAULT TRUE,
    pending_operation VARCHAR(30),
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pos_workstations_tenant_site ON pos_workstations(tenant_id, site_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_workstation ON cash_sessions(workstation_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_sessions_open_workstation
    ON cash_sessions(site_id, workstation_id)
    WHERE status = 'OPEN' AND workstation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entity_comments_entity ON entity_comments(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_comments_author ON entity_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_tenant_site ON chat_threads(tenant_id, site_id);
CREATE INDEX IF NOT EXISTS idx_chat_thread_participants_user ON chat_thread_participants(user_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant ON chat_messages(tenant_id, created_at DESC);
