BEGIN;

CREATE TABLE IF NOT EXISTS fefo_actions (
  fefo_action_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  site_id UUID NOT NULL REFERENCES sites(site_id),
  article_id UUID NOT NULL REFERENCES articles(article_id),
  lot_id UUID NOT NULL REFERENCES lots(lot_id),
  stock_movement_id UUID REFERENCES stock_movements(movement_id),
  priority_at_action VARCHAR(20) NOT NULL CHECK (
    priority_at_action IN ('EXPIRED', 'BLOCKED', 'RED', 'ORANGE', 'GREEN')
  ),
  action_type VARCHAR(50) NOT NULL CHECK (
    action_type IN ('HIGHLIGHT_CONFIRMED', 'SHELF_ROTATION_CONFIRMED', 'REMOVED_EXPIRED', 'COMMENT_ADDED')
  ),
  action_status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (
    action_status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')
  ),
  quantity NUMERIC(14,3),
  note TEXT,
  request_key VARCHAR(120),
  performed_by UUID REFERENCES users(user_id),
  performed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fefo_actions_tenant_site
  ON fefo_actions(tenant_id, site_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_fefo_actions_lot
  ON fefo_actions(lot_id, performed_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fefo_actions_request_key
  ON fefo_actions(tenant_id, request_key)
  WHERE request_key IS NOT NULL;

COMMIT;
