CREATE TABLE IF NOT EXISTS offline_stock_allocations (
    allocation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(site_id) ON DELETE CASCADE,
    workstation_id UUID NOT NULL REFERENCES pos_workstations(workstation_id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES articles(article_id) ON DELETE CASCADE,
    lot_id UUID NOT NULL REFERENCES lots(lot_id) ON DELETE CASCADE,
    allocated_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (allocated_quantity >= 0),
    consumed_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (consumed_quantity >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'EXHAUSTED', 'SUSPENDED', 'REVOKED')),
    server_version BIGINT NOT NULL DEFAULT 1,
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    allocated_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_offline_allocations_consumed_not_greater
        CHECK (consumed_quantity <= allocated_quantity),
    CONSTRAINT uq_offline_allocations_workstation_lot
        UNIQUE (tenant_id, workstation_id, lot_id)
);

CREATE INDEX IF NOT EXISTS idx_offline_allocations_tenant ON offline_stock_allocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_offline_allocations_site ON offline_stock_allocations(site_id);
CREATE INDEX IF NOT EXISTS idx_offline_allocations_workstation ON offline_stock_allocations(workstation_id);
CREATE INDEX IF NOT EXISTS idx_offline_allocations_article ON offline_stock_allocations(article_id);
CREATE INDEX IF NOT EXISTS idx_offline_allocations_lot ON offline_stock_allocations(lot_id);
CREATE INDEX IF NOT EXISTS idx_offline_allocations_status ON offline_stock_allocations(status);

