BEGIN;

CREATE TABLE IF NOT EXISTS product_units (
  product_unit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  unit_code VARCHAR(40) NOT NULL,
  unit_label VARCHAR(120) NOT NULL,
  normalized_label VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_units_tenant_code
  ON product_units (tenant_id, unit_code);

CREATE UNIQUE INDEX IF NOT EXISTS uq_product_units_tenant_normalized_label
  ON product_units (tenant_id, normalized_label);

CREATE TABLE IF NOT EXISTS dosages (
  dosage_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  dosage_label VARCHAR(120) NOT NULL,
  normalized_label VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dosages_tenant_normalized_label
  ON dosages (tenant_id, normalized_label);

CREATE TABLE IF NOT EXISTS active_ingredients (
  active_ingredient_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  canonical_name VARCHAR(180) NOT NULL,
  normalized_name VARCHAR(180) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_ingredients_tenant_normalized_name
  ON active_ingredients (tenant_id, normalized_name);

CREATE TABLE IF NOT EXISTS atc_codes (
  atc_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  atc_code VARCHAR(30) NOT NULL,
  atc_label VARCHAR(255) NOT NULL,
  atc_level VARCHAR(20),
  parent_code VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_atc_codes_tenant_code
  ON atc_codes (tenant_id, atc_code);

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS sales_unit_id UUID REFERENCES product_units(product_unit_id),
  ADD COLUMN IF NOT EXISTS packaging_unit_id UUID REFERENCES product_units(product_unit_id),
  ADD COLUMN IF NOT EXISTS dosage_id UUID REFERENCES dosages(dosage_id),
  ADD COLUMN IF NOT EXISTS dci_id UUID REFERENCES active_ingredients(active_ingredient_id),
  ADD COLUMN IF NOT EXISTS atc_id UUID REFERENCES atc_codes(atc_id);

CREATE INDEX IF NOT EXISTS idx_articles_sales_unit_id ON articles(sales_unit_id);
CREATE INDEX IF NOT EXISTS idx_articles_packaging_unit_id ON articles(packaging_unit_id);
CREATE INDEX IF NOT EXISTS idx_articles_dosage_id ON articles(dosage_id);
CREATE INDEX IF NOT EXISTS idx_articles_dci_id ON articles(dci_id);
CREATE INDEX IF NOT EXISTS idx_articles_atc_id ON articles(atc_id);

COMMIT;
