-- ============================================================
-- ERP PHARMACEUTIQUE SaaS V2
-- SCHEMA POSTGRESQL FINAL V3 CONSOLIDE
-- Généré le : 2026-06-18 23:33:46
--
-- Ordre intégré :
-- 1. Schéma principal V1.1
-- 2. Add-on V2 : inventaires, transferts, notifications, pièces jointes
-- 3. Add-on SaaS Multi-Tenant
-- 4. Add-on Finance / Caisse / Reporting BI
--
-- Cible :
-- Supabase PostgreSQL + NestJS API + React Frontend
--
-- IMPORTANT :
-- - Exécuter idéalement sur une base vide.
-- - Pour Supabase, vérifier les politiques RLS avant production.
-- - Les migrations destructives doivent être évitées en production.
-- ============================================================

BEGIN;



-- ============================================================
-- SECTION 1
-- SOURCE : erp_pharmaceutique_v2_postgresql_schema_v1_1.sql
-- ============================================================

-- ============================================================
-- ERP PHARMACEUTIQUE V2 - SCHEMA POSTGRESQL
-- Version : 1.1
-- Ajout : entreprises partenaires, assurances santé, crédits clients, créances
-- Architecture : ERP Web + API + Supabase PostgreSQL
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE roles (
    role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
    permission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    permission_code VARCHAR(100) NOT NULL UNIQUE,
    permission_name VARCHAR(150) NOT NULL,
    module_name VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE sites (
    site_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_code VARCHAR(50) NOT NULL UNIQUE,
    site_name VARCHAR(150) NOT NULL,
    site_type VARCHAR(50) NOT NULL CHECK (site_type IN ('PHARMACY', 'WAREHOUSE', 'OFFICE', 'OTHER')),
    address TEXT,
    phone VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(site_id),
    role_id UUID REFERENCES roles(role_id),
    full_name VARCHAR(150) NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) UNIQUE,
    phone VARCHAR(50),
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_types (
    product_type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type_code VARCHAR(30) NOT NULL UNIQUE,
    type_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE categories (
    category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_code VARCHAR(30) NOT NULL UNIQUE,
    category_name VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE sub_categories (
    sub_category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(category_id),
    sub_category_code VARCHAR(30) NOT NULL,
    sub_category_name VARCHAR(150) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(category_id, sub_category_code),
    UNIQUE(category_id, sub_category_name)
);

CREATE TABLE galenic_forms (
    form_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_code VARCHAR(30) NOT NULL UNIQUE,
    form_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE administration_routes (
    route_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_code VARCHAR(30) NOT NULL UNIQUE,
    route_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE articles (
    article_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_code VARCHAR(80) NOT NULL UNIQUE,
    commercial_name VARCHAR(255) NOT NULL,
    dci VARCHAR(255),
    category_id UUID REFERENCES categories(category_id),
    sub_category_id UUID REFERENCES sub_categories(sub_category_id),
    form_id UUID REFERENCES galenic_forms(form_id),
    route_id UUID REFERENCES administration_routes(route_id),
    product_type_id UUID REFERENCES product_types(product_type_id),
    dosage VARCHAR(100),
    strength_value NUMERIC(12,3),
    strength_unit VARCHAR(30),
    packaging VARCHAR(150),
    units_per_package NUMERIC(12,2),
    atc_code VARCHAR(30),
    prescription_required BOOLEAN NOT NULL DEFAULT FALSE,
    who_essential_medicine BOOLEAN NOT NULL DEFAULT FALSE,
    barcode VARCHAR(100),
    manufacturer VARCHAR(150),
    default_stock_min NUMERIC(14,3) NOT NULL DEFAULT 0,
    default_stock_max NUMERIC(14,3),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE currencies (
    currency_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    currency_code VARCHAR(10) NOT NULL UNIQUE,
    currency_name VARCHAR(100) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE payment_methods (
    payment_method_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    method_code VARCHAR(30) NOT NULL UNIQUE,
    method_name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE suppliers (
    supplier_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_code VARCHAR(50) NOT NULL UNIQUE,
    supplier_name VARCHAR(200) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(150),
    address TEXT,
    rccm VARCHAR(100),
    nif VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
    customer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_code VARCHAR(50) NOT NULL UNIQUE,
    customer_name VARCHAR(200) NOT NULL,
    customer_type VARCHAR(50) NOT NULL DEFAULT 'INDIVIDUAL'
        CHECK (customer_type IN ('INDIVIDUAL', 'COMPANY_EMPLOYEE', 'COMPANY', 'HOSPITAL', 'NGO', 'INSURANCE_MEMBER', 'OTHER')),
    phone VARCHAR(50),
    email VARCHAR(150),
    address TEXT,
    credit_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Partenaires : entreprises, ONG, assurances, hôpitaux, cliniques, etc.
CREATE TABLE organizations (
    organization_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_code VARCHAR(50) NOT NULL UNIQUE,
    organization_name VARCHAR(200) NOT NULL,
    organization_type VARCHAR(50) NOT NULL CHECK (
        organization_type IN ('COMPANY', 'INSURANCE', 'NGO', 'HOSPITAL', 'CLINIC', 'CHURCH', 'GOVERNMENT', 'OTHER')
    ),
    phone VARCHAR(50),
    email VARCHAR(150),
    address TEXT,
    rccm VARCHAR(100),
    nif VARCHAR(100),
    credit_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
    payment_terms_days INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE insurance_plans (
    plan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
    plan_code VARCHAR(50) NOT NULL,
    plan_name VARCHAR(150) NOT NULL,
    coverage_percent NUMERIC(5,2) NOT NULL CHECK (coverage_percent >= 0 AND coverage_percent <= 100),
    patient_copay_percent NUMERIC(5,2) NOT NULL CHECK (patient_copay_percent >= 0 AND patient_copay_percent <= 100),
    monthly_limit NUMERIC(14,2),
    annual_limit NUMERIC(14,2),
    requires_authorization BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(organization_id, plan_code)
);

CREATE TABLE customer_memberships (
    membership_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(organization_id),
    plan_id UUID REFERENCES insurance_plans(plan_id),
    member_number VARCHAR(100),
    employee_number VARCHAR(100),
    relationship_type VARCHAR(50) DEFAULT 'MAIN'
        CHECK (relationship_type IN ('MAIN', 'DEPENDENT', 'EMPLOYEE', 'OTHER')),
    valid_from DATE,
    valid_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(customer_id, organization_id, member_number)
);

CREATE TABLE lots (
    lot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID NOT NULL REFERENCES articles(article_id),
    supplier_id UUID REFERENCES suppliers(supplier_id),
    lot_number VARCHAR(100) NOT NULL,
    manufacture_date DATE,
    expiry_date DATE NOT NULL,
    purchase_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency_id UUID REFERENCES currencies(currency_id),
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    block_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article_id, lot_number)
);

CREATE TABLE stocks (
    stock_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(site_id),
    lot_id UUID NOT NULL REFERENCES lots(lot_id),
    quantity_available NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
    quantity_reserved NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
    stock_min NUMERIC(14,3) NOT NULL DEFAULT 0,
    stock_max NUMERIC(14,3),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(site_id, lot_id)
);

CREATE TABLE stock_movements (
    movement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movement_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    site_id UUID NOT NULL REFERENCES sites(site_id),
    article_id UUID NOT NULL REFERENCES articles(article_id),
    lot_id UUID REFERENCES lots(lot_id),
    movement_type VARCHAR(50) NOT NULL CHECK (
        movement_type IN ('PURCHASE_IN', 'SALE_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_IN', 'RETURN_OUT', 'EXPIRED_OUT', 'INVENTORY_GAIN', 'INVENTORY_LOSS')
    ),
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    reference_type VARCHAR(50),
    reference_id UUID,
    notes TEXT,
    user_id UUID REFERENCES users(user_id)
);

CREATE TABLE purchases (
    purchase_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_number VARCHAR(80) NOT NULL UNIQUE,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_id UUID NOT NULL REFERENCES suppliers(supplier_id),
    site_id UUID NOT NULL REFERENCES sites(site_id),
    currency_id UUID REFERENCES currencies(currency_id),
    exchange_rate NUMERIC(14,4) NOT NULL DEFAULT 1,
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'VALIDATED', 'CANCELLED')),
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    validated_at TIMESTAMP
);

CREATE TABLE purchase_items (
    purchase_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES purchases(purchase_id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES articles(article_id),
    lot_number VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    purchase_unit_price NUMERIC(14,2) NOT NULL CHECK (purchase_unit_price >= 0),
    selling_unit_price NUMERIC(14,2) NOT NULL CHECK (selling_unit_price >= 0),
    line_total NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE sales (
    sale_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_number VARCHAR(80) NOT NULL UNIQUE,
    sale_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customer_id UUID REFERENCES customers(customer_id),
    organization_id UUID REFERENCES organizations(organization_id),
    membership_id UUID REFERENCES customer_memberships(membership_id),
    site_id UUID NOT NULL REFERENCES sites(site_id),
    currency_id UUID REFERENCES currencies(currency_id),
    exchange_rate NUMERIC(14,4) NOT NULL DEFAULT 1,
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    insurance_covered_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    customer_payable_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    credit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    sale_type VARCHAR(50) NOT NULL DEFAULT 'CASH'
        CHECK (sale_type IN ('CASH', 'CUSTOMER_CREDIT', 'ORGANIZATION_CREDIT', 'INSURANCE')),
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'VALIDATED', 'CANCELLED', 'RETURNED')),
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    validated_at TIMESTAMP
);

CREATE TABLE sale_items (
    sale_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(sale_id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES articles(article_id),
    lot_id UUID NOT NULL REFERENCES lots(lot_id),
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
    discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    coverage_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (coverage_percent >= 0 AND coverage_percent <= 100),
    covered_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    patient_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    line_total NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(sale_id) ON DELETE CASCADE,
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_method_id UUID NOT NULL REFERENCES payment_methods(payment_method_id),
    currency_id UUID NOT NULL REFERENCES currencies(currency_id),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    reference_payment VARCHAR(150),
    received_by UUID REFERENCES users(user_id)
);

-- Créances : crédits clients, crédits entreprises, prises en charge assurances
CREATE TABLE accounts_receivable (
    receivable_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES sales(sale_id),
    customer_id UUID REFERENCES customers(customer_id),
    organization_id UUID REFERENCES organizations(organization_id),
    currency_id UUID NOT NULL REFERENCES currencies(currency_id),
    receivable_type VARCHAR(50) NOT NULL CHECK (
        receivable_type IN ('CUSTOMER_CREDIT', 'ORGANIZATION_CREDIT', 'INSURANCE_CLAIM')
    ),
    invoice_number VARCHAR(100),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    amount_due NUMERIC(14,2) NOT NULL CHECK (amount_due >= 0),
    amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    balance NUMERIC(14,2) NOT NULL CHECK (balance >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED')),
    notes TEXT,
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE receivable_payments (
    receivable_payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receivable_id UUID NOT NULL REFERENCES accounts_receivable(receivable_id) ON DELETE CASCADE,
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_method_id UUID NOT NULL REFERENCES payment_methods(payment_method_id),
    currency_id UUID NOT NULL REFERENCES currencies(currency_id),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    reference_payment VARCHAR(150),
    received_by UUID REFERENCES users(user_id),
    notes TEXT
);

CREATE TABLE cash_sessions (
    cash_session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(site_id),
    user_id UUID NOT NULL REFERENCES users(user_id),
    opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    closing_balance NUMERIC(14,2),
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED'))
);

CREATE TABLE prescriptions (
    prescription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES sales(sale_id),
    customer_id UUID REFERENCES customers(customer_id),
    doctor_name VARCHAR(200),
    doctor_license_number VARCHAR(100),
    prescription_date DATE,
    scan_file_url TEXT,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE prescription_items (
    prescription_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(prescription_id) ON DELETE CASCADE,
    article_id UUID REFERENCES articles(article_id),
    dosage_instructions TEXT,
    quantity_prescribed NUMERIC(14,3),
    quantity_dispensed NUMERIC(14,3)
);

CREATE TABLE stock_alerts (
    stock_alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(site_id),
    article_id UUID NOT NULL REFERENCES articles(article_id),
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('LOW_STOCK', 'OUT_OF_STOCK', 'OVER_STOCK')),
    alert_level VARCHAR(30) NOT NULL CHECK (alert_level IN ('INFO', 'WARNING', 'CRITICAL')),
    alert_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMP
);

CREATE TABLE expiry_alerts (
    expiry_alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lot_id UUID NOT NULL REFERENCES lots(lot_id),
    expiry_date DATE NOT NULL,
    days_remaining INTEGER NOT NULL,
    alert_level VARCHAR(30) NOT NULL CHECK (alert_level IN ('180_DAYS', '90_DAYS', '30_DAYS', 'EXPIRED')),
    alert_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMP
);

CREATE TABLE audit_logs (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id UUID REFERENCES users(user_id),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    action_type VARCHAR(30) NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VALIDATE', 'CANCEL')),
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(100)
);

CREATE OR REPLACE VIEW v_stock_by_article_site AS
SELECT
    s.site_id,
    st.site_name,
    a.article_id,
    a.article_code,
    a.commercial_name,
    SUM(s.quantity_available) AS total_quantity_available,
    SUM(s.quantity_reserved) AS total_quantity_reserved
FROM stocks s
JOIN lots l ON l.lot_id = s.lot_id
JOIN articles a ON a.article_id = l.article_id
JOIN sites st ON st.site_id = s.site_id
GROUP BY s.site_id, st.site_name, a.article_id, a.article_code, a.commercial_name;

CREATE OR REPLACE VIEW v_expiring_lots AS
SELECT
    l.lot_id,
    a.article_code,
    a.commercial_name,
    l.lot_number,
    l.expiry_date,
    (l.expiry_date - CURRENT_DATE) AS days_remaining,
    l.is_blocked
FROM lots l
JOIN articles a ON a.article_id = l.article_id
WHERE l.expiry_date <= CURRENT_DATE + INTERVAL '180 days';

CREATE OR REPLACE VIEW v_receivables_summary AS
SELECT
    ar.receivable_type,
    ar.status,
    COALESCE(o.organization_name, c.customer_name, 'Non défini') AS debtor_name,
    ar.currency_id,
    SUM(ar.amount_due) AS total_due,
    SUM(ar.amount_paid) AS total_paid,
    SUM(ar.balance) AS total_balance,
    COUNT(*) AS number_of_receivables
FROM accounts_receivable ar
LEFT JOIN organizations o ON o.organization_id = ar.organization_id
LEFT JOIN customers c ON c.customer_id = ar.customer_id
GROUP BY ar.receivable_type, ar.status, debtor_name, ar.currency_id;

CREATE INDEX idx_articles_name ON articles(commercial_name);
CREATE INDEX idx_articles_dci ON articles(dci);
CREATE INDEX idx_articles_category ON articles(category_id);
CREATE INDEX idx_articles_barcode ON articles(barcode);
CREATE INDEX idx_lots_article ON lots(article_id);
CREATE INDEX idx_lots_expiry ON lots(expiry_date);
CREATE INDEX idx_stocks_site ON stocks(site_id);
CREATE INDEX idx_stocks_lot ON stocks(lot_id);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_site ON sales(site_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_organization ON sales(organization_id);
CREATE INDEX idx_receivables_customer ON accounts_receivable(customer_id);
CREATE INDEX idx_receivables_organization ON accounts_receivable(organization_id);
CREATE INDEX idx_receivables_status ON accounts_receivable(status);
CREATE INDEX idx_receivables_due_date ON accounts_receivable(due_date);
CREATE INDEX idx_memberships_customer ON customer_memberships(customer_id);
CREATE INDEX idx_memberships_organization ON customer_memberships(organization_id);

INSERT INTO roles(role_name, description) VALUES
('ADMIN', 'Administrateur système'),
('PHARMACIST', 'Pharmacien'),
('CASHIER', 'Caissier'),
('STOREKEEPER', 'Magasinier'),
('MANAGER', 'Responsable / Direction'),
('AUDITOR', 'Auditeur lecture seule')
ON CONFLICT DO NOTHING;

INSERT INTO currencies(currency_code, currency_name, is_default) VALUES
('USD', 'Dollar américain', TRUE),
('CDF', 'Franc congolais', FALSE)
ON CONFLICT DO NOTHING;

INSERT INTO payment_methods(method_code, method_name) VALUES
('CASH_USD', 'Cash USD'),
('CASH_CDF', 'Cash CDF'),
('MOBILE_MONEY', 'Mobile Money'),
('BANK', 'Banque'),
('CUSTOMER_CREDIT', 'Crédit client'),
('ORGANIZATION_CREDIT', 'Crédit entreprise / partenaire'),
('INSURANCE_CLAIM', 'Prise en charge assurance')
ON CONFLICT DO NOTHING;

INSERT INTO product_types(type_code, type_name) VALUES
('MED', 'Médicament'),
('CON', 'Consommable médical'),
('DMD', 'Dispositif médical'),
('LAB', 'Réactif / laboratoire'),
('COS', 'Cosmétique'),
('HYG', 'Hygiène / désinfection')
ON CONFLICT DO NOTHING;

INSERT INTO galenic_forms(form_code, form_name) VALUES
('CP', 'Comprimé'),
('GEL', 'Gélule'),
('SIR', 'Sirop'),
('SUS', 'Suspension'),
('INJ', 'Injectable'),
('CRM', 'Crème'),
('POM', 'Pommade'),
('COL', 'Collyre'),
('GTT', 'Gouttes'),
('SPR', 'Spray'),
('SOL', 'Solution'),
('PDR', 'Poudre')
ON CONFLICT DO NOTHING;

INSERT INTO administration_routes(route_code, route_name) VALUES
('ORAL', 'Orale'),
('IV', 'Intraveineuse'),
('IM', 'Intramusculaire'),
('SC', 'Sous-cutanée'),
('TOP', 'Cutanée / topique'),
('OPH', 'Ophtalmique'),
('ENT', 'ORL'),
('RECT', 'Rectale'),
('VAG', 'Vaginale')
ON CONFLICT DO NOTHING;

-- ============================================================
-- FIN DU SCRIPT V1.1
-- ============================================================





-- ============================================================
-- SECTION 2
-- SOURCE : erp_pharmaceutique_v2_postgresql_addon_v2.sql
-- ============================================================

-- ============================================================
-- ERP PHARMACEUTIQUE V2 - ADDON SCHEMA POSTGRESQL V2
-- Ajouts : inventaires, transferts, notifications, pièces jointes,
-- historique des prix, destructions/casses
-- Compatible avec le script V1.1 existant
-- ============================================================

-- ============================================================
-- 1. INVENTAIRES
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_sessions (
    inventory_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(site_id),
    inventory_number VARCHAR(80) NOT NULL UNIQUE,
    inventory_type VARCHAR(50) NOT NULL DEFAULT 'FULL'
        CHECK (inventory_type IN ('FULL', 'PARTIAL', 'CATEGORY', 'SENSITIVE_PRODUCTS', 'CONTROL')),
    inventory_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'CLOSED', 'VALIDATED', 'CANCELLED')),
    notes TEXT,
    created_by UUID REFERENCES users(user_id),
    validated_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    validated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_items (
    inventory_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_id UUID NOT NULL REFERENCES inventory_sessions(inventory_id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES articles(article_id),
    lot_id UUID NOT NULL REFERENCES lots(lot_id),
    system_quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
    counted_quantity NUMERIC(14,3),
    difference_quantity NUMERIC(14,3),
    reason TEXT,
    counted_by UUID REFERENCES users(user_id),
    counted_at TIMESTAMP,
    UNIQUE(inventory_id, lot_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_sessions_site ON inventory_sessions(site_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sessions_status ON inventory_sessions(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_inventory ON inventory_items(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_article ON inventory_items(article_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_lot ON inventory_items(lot_id);

-- ============================================================
-- 2. TRANSFERTS INTER-SITES
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_transfers (
    transfer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_number VARCHAR(80) NOT NULL UNIQUE,
    from_site_id UUID NOT NULL REFERENCES sites(site_id),
    to_site_id UUID NOT NULL REFERENCES sites(site_id),
    transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'SENT', 'RECEIVED', 'CANCELLED')),
    notes TEXT,
    created_by UUID REFERENCES users(user_id),
    sent_by UUID REFERENCES users(user_id),
    received_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    received_at TIMESTAMP,
    CHECK (from_site_id <> to_site_id)
);

CREATE TABLE IF NOT EXISTS stock_transfer_items (
    transfer_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id UUID NOT NULL REFERENCES stock_transfers(transfer_id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES articles(article_id),
    lot_id UUID NOT NULL REFERENCES lots(lot_id),
    quantity_requested NUMERIC(14,3) NOT NULL CHECK (quantity_requested > 0),
    quantity_sent NUMERIC(14,3),
    quantity_received NUMERIC(14,3),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_transfers_from_site ON stock_transfers(from_site_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_site ON stock_transfers(to_site_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON stock_transfer_items(transfer_id);

-- ============================================================
-- 3. HISTORIQUE DES PRIX
-- ============================================================

CREATE TABLE IF NOT EXISTS article_price_history (
    price_history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID NOT NULL REFERENCES articles(article_id),
    lot_id UUID REFERENCES lots(lot_id),
    currency_id UUID REFERENCES currencies(currency_id),
    old_purchase_price NUMERIC(14,2),
    new_purchase_price NUMERIC(14,2),
    old_selling_price NUMERIC(14,2),
    new_selling_price NUMERIC(14,2),
    change_reason TEXT,
    changed_by UUID REFERENCES users(user_id),
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_history_article ON article_price_history(article_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON article_price_history(changed_at);

-- ============================================================
-- 4. DESTRUCTIONS / CASSE / SORTIE POUR PEREMPTION
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_disposals (
    disposal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disposal_number VARCHAR(80) NOT NULL UNIQUE,
    site_id UUID NOT NULL REFERENCES sites(site_id),
    disposal_date DATE NOT NULL DEFAULT CURRENT_DATE,
    disposal_type VARCHAR(50) NOT NULL CHECK (
        disposal_type IN ('EXPIRED', 'DAMAGED', 'BROKEN', 'RECALL', 'LOSS', 'OTHER')
    ),
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'VALIDATED', 'CANCELLED')),
    reason TEXT NOT NULL,
    created_by UUID REFERENCES users(user_id),
    validated_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    validated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_disposal_items (
    disposal_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disposal_id UUID NOT NULL REFERENCES stock_disposals(disposal_id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES articles(article_id),
    lot_id UUID NOT NULL REFERENCES lots(lot_id),
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_disposals_site ON stock_disposals(site_id);
CREATE INDEX IF NOT EXISTS idx_disposals_status ON stock_disposals(status);
CREATE INDEX IF NOT EXISTS idx_disposal_items_disposal ON stock_disposal_items(disposal_id);

-- ============================================================
-- 5. PIECES JOINTES / DOCUMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS attachments (
    attachment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(100),
    file_size_bytes BIGINT,
    description TEXT,
    uploaded_by UUID REFERENCES users(user_id),
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);

-- Exemples entity_type :
-- PRESCRIPTION, SALE, PURCHASE, SUPPLIER, CUSTOMER, ORGANIZATION, ARTICLE, INVENTORY, DISPOSAL

-- ============================================================
-- 6. NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_templates (
    template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_code VARCHAR(80) NOT NULL UNIQUE,
    template_name VARCHAR(150) NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP')),
    subject VARCHAR(255),
    body_template TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    site_id UUID REFERENCES sites(site_id),
    notification_type VARCHAR(80) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(30) NOT NULL DEFAULT 'NORMAL'
        CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
    status VARCHAR(30) NOT NULL DEFAULT 'UNREAD'
        CHECK (status IN ('UNREAD', 'READ', 'ARCHIVED')),
    related_entity_type VARCHAR(80),
    related_entity_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_site ON notifications(site_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);

-- ============================================================
-- 7. VUES COMPLEMENTAIRES
-- ============================================================

CREATE OR REPLACE VIEW v_inventory_variances AS
SELECT
    inv.inventory_id,
    inv.inventory_number,
    inv.inventory_date,
    inv.status,
    st.site_name,
    a.article_code,
    a.commercial_name,
    l.lot_number,
    l.expiry_date,
    ii.system_quantity,
    ii.counted_quantity,
    ii.difference_quantity,
    ii.reason
FROM inventory_sessions inv
JOIN sites st ON st.site_id = inv.site_id
JOIN inventory_items ii ON ii.inventory_id = inv.inventory_id
JOIN articles a ON a.article_id = ii.article_id
JOIN lots l ON l.lot_id = ii.lot_id
WHERE COALESCE(ii.difference_quantity, 0) <> 0;

CREATE OR REPLACE VIEW v_stock_transfer_summary AS
SELECT
    tr.transfer_id,
    tr.transfer_number,
    fs.site_name AS from_site,
    ts.site_name AS to_site,
    tr.transfer_date,
    tr.status,
    COUNT(ti.transfer_item_id) AS total_lines,
    SUM(ti.quantity_requested) AS total_quantity_requested,
    SUM(COALESCE(ti.quantity_sent, 0)) AS total_quantity_sent,
    SUM(COALESCE(ti.quantity_received, 0)) AS total_quantity_received
FROM stock_transfers tr
JOIN sites fs ON fs.site_id = tr.from_site_id
JOIN sites ts ON ts.site_id = tr.to_site_id
LEFT JOIN stock_transfer_items ti ON ti.transfer_id = tr.transfer_id
GROUP BY tr.transfer_id, tr.transfer_number, fs.site_name, ts.site_name, tr.transfer_date, tr.status;

CREATE OR REPLACE VIEW v_disposal_summary AS
SELECT
    sd.disposal_id,
    sd.disposal_number,
    s.site_name,
    sd.disposal_date,
    sd.disposal_type,
    sd.status,
    COUNT(sdi.disposal_item_id) AS total_lines,
    SUM(sdi.quantity) AS total_quantity
FROM stock_disposals sd
JOIN sites s ON s.site_id = sd.site_id
LEFT JOIN stock_disposal_items sdi ON sdi.disposal_id = sd.disposal_id
GROUP BY sd.disposal_id, sd.disposal_number, s.site_name, sd.disposal_date, sd.disposal_type, sd.status;

-- ============================================================
-- 8. PERMISSIONS ADDITIONNELLES SUGGEREES
-- ============================================================

INSERT INTO permissions(permission_code, permission_name, module_name, description) VALUES
('inventories.read', 'Consulter les inventaires', 'Inventaires', 'Voir les sessions et lignes inventaire'),
('inventories.create', 'Créer un inventaire', 'Inventaires', 'Créer une session inventaire'),
('inventories.count', 'Saisir comptage inventaire', 'Inventaires', 'Saisir les quantités physiques'),
('inventories.validate', 'Valider inventaire', 'Inventaires', 'Valider et appliquer les écarts'),

('transfers.read', 'Consulter transferts', 'Transferts', 'Voir les transferts inter-sites'),
('transfers.create', 'Créer transfert', 'Transferts', 'Créer une demande de transfert'),
('transfers.send', 'Expédier transfert', 'Transferts', 'Sortir le stock du site source'),
('transfers.receive', 'Réceptionner transfert', 'Transferts', 'Entrer le stock dans le site destination'),

('disposals.read', 'Consulter destructions', 'Destructions', 'Voir les destructions/casses'),
('disposals.create', 'Créer destruction', 'Destructions', 'Créer une demande de sortie pour casse/péremption'),
('disposals.validate', 'Valider destruction', 'Destructions', 'Valider la sortie définitive'),

('attachments.upload', 'Uploader pièce jointe', 'Documents', 'Ajouter des fichiers liés aux documents'),
('attachments.read', 'Lire pièces jointes', 'Documents', 'Consulter les fichiers liés'),

('notifications.read', 'Lire notifications', 'Notifications', 'Consulter les notifications'),
('notifications.manage', 'Gérer notifications', 'Notifications', 'Paramétrer les notifications')
ON CONFLICT (permission_code) DO NOTHING;

-- ============================================================
-- FIN ADDON V2
-- ============================================================




-- ============================================================
-- SECTION 3
-- SOURCE : erp_pharmaceutique_v2_saas_multitenant_addon.sql
-- ============================================================

-- ERP PHARMACEUTIQUE V2 - ADDON SAAS MULTI-TENANT
-- À exécuter après schema_v1_1.sql et addon_v2.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLES SAAS CENTRALES

CREATE TABLE IF NOT EXISTS tenants (
    tenant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_code VARCHAR(80) NOT NULL UNIQUE,
    tenant_name VARCHAR(200) NOT NULL,
    tenant_type VARCHAR(50) NOT NULL DEFAULT 'PHARMACY'
        CHECK (tenant_type IN ('PHARMACY','PHARMACY_GROUP','WAREHOUSE','CLINIC','HOSPITAL','WHOLESALER','OTHER')),
    legal_name VARCHAR(250),
    phone VARCHAR(50),
    email VARCHAR(150),
    address TEXT,
    country VARCHAR(100) DEFAULT 'RDC',
    city VARCHAR(100),
    subscription_status VARCHAR(30) NOT NULL DEFAULT 'TRIAL'
        CHECK (subscription_status IN ('TRIAL','ACTIVE','SUSPENDED','CANCELLED')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscription_plans (
    plan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_code VARCHAR(50) NOT NULL UNIQUE,
    plan_name VARCHAR(100) NOT NULL,
    description TEXT,
    max_sites INTEGER NOT NULL DEFAULT 1,
    max_users INTEGER NOT NULL DEFAULT 5,
    max_articles INTEGER,
    max_storage_mb INTEGER DEFAULT 1024,
    allow_multi_site BOOLEAN NOT NULL DEFAULT FALSE,
    allow_insurance_module BOOLEAN NOT NULL DEFAULT FALSE,
    allow_inventory_module BOOLEAN NOT NULL DEFAULT TRUE,
    allow_advanced_reports BOOLEAN NOT NULL DEFAULT FALSE,
    allow_api_access BOOLEAN NOT NULL DEFAULT FALSE,
    monthly_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    yearly_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(plan_id),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    trial_end_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'TRIAL'
        CHECK (status IN ('TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED','EXPIRED')),
    billing_cycle VARCHAR(30) NOT NULL DEFAULT 'MONTHLY'
        CHECK (billing_cycle IN ('MONTHLY','YEARLY','CUSTOM')),
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_billing (
    billing_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES tenant_subscriptions(subscription_id),
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    billing_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    amount_due NUMERIC(14,2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
    balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED')),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_usage_logs (
    usage_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    sites_count INTEGER NOT NULL DEFAULT 0,
    users_count INTEGER NOT NULL DEFAULT 0,
    articles_count INTEGER NOT NULL DEFAULT 0,
    sales_count INTEGER NOT NULL DEFAULT 0,
    purchases_count INTEGER NOT NULL DEFAULT 0,
    storage_used_mb NUMERIC(14,2) NOT NULL DEFAULT 0,
    api_calls_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, usage_date)
);

CREATE TABLE IF NOT EXISTS tenant_settings (
    tenant_setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT NOT NULL,
    updated_by UUID REFERENCES users(user_id),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, setting_key)
);

-- 2. AJOUT tenant_id AUX TABLES METIER

ALTER TABLE sites ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_role_name_key;
ALTER TABLE roles ADD CONSTRAINT roles_tenant_id_role_name_key UNIQUE (tenant_id, role_name);
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS is_system_permission BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE categories ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE sub_categories ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE galenic_forms ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE administration_routes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE product_types ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE insurance_plans ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);

ALTER TABLE lots ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);

ALTER TABLE accounts_receivable ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE receivable_payments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE stock_alerts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE expiry_alerts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);

ALTER TABLE inventory_sessions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE article_price_history ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE stock_disposals ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE stock_disposal_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(tenant_id);

-- 3. INDEX TENANT

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(subscription_status);
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_key ON tenant_settings(tenant_id, setting_key);
CREATE INDEX IF NOT EXISTS idx_sites_tenant ON sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_articles_tenant ON articles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_organizations_tenant ON organizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lots_tenant ON lots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stocks_tenant ON stocks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_movements_tenant ON stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchases_tenant ON purchases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receivables_tenant ON accounts_receivable(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transfers_tenant ON stock_transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_disposals_tenant ON stock_disposals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attachments_tenant ON attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sites_tenant_code ON sites(tenant_id, site_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_tenant_username ON users(tenant_id, username);
CREATE UNIQUE INDEX IF NOT EXISTS uq_articles_tenant_code ON articles(tenant_id, article_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_tenant_code ON suppliers(tenant_id, supplier_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_tenant_code ON customers(tenant_id, customer_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_tenant_code ON organizations(tenant_id, organization_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_purchases_tenant_number ON purchases(tenant_id, purchase_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_tenant_number ON sales(tenant_id, sale_number);

-- 4. FONCTIONS RLS SUPABASE

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION current_user_site_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'site_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
    SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'role';
$$;

-- 5. RLS EXEMPLES - À généraliser progressivement

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_articles ON articles;
CREATE POLICY tenant_isolation_articles ON articles
FOR ALL USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_sales ON sales;
CREATE POLICY tenant_isolation_sales ON sales
FOR ALL USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_stocks ON stocks;
CREATE POLICY tenant_isolation_stocks ON stocks
FOR ALL USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_purchases ON purchases;
CREATE POLICY tenant_isolation_purchases ON purchases
FOR ALL USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_customers ON customers;
CREATE POLICY tenant_isolation_customers ON customers
FOR ALL USING (tenant_id = current_tenant_id())
WITH CHECK (tenant_id = current_tenant_id());

-- 6. PLANS INITIAUX

INSERT INTO subscription_plans (
    plan_code, plan_name, description, max_sites, max_users, max_articles,
    max_storage_mb, allow_multi_site, allow_insurance_module, allow_inventory_module,
    allow_advanced_reports, allow_api_access, monthly_price, yearly_price, currency_code
)
VALUES
('BASIC','Basic','Petite pharmacie : stock, ventes, caisse et rapports simples.',1,5,5000,1024,FALSE,FALSE,TRUE,FALSE,FALSE,49,490,'USD'),
('PRO','Pro','Pharmacie structurée : multi-sites, assurances, créances, inventaires et rapports avancés.',3,15,20000,5120,TRUE,TRUE,TRUE,TRUE,FALSE,129,1290,'USD'),
('ENTERPRISE','Enterprise','Réseau de pharmacies ou dépôt : sites étendus, API et support prioritaire.',999,999,NULL,51200,TRUE,TRUE,TRUE,TRUE,TRUE,0,0,'USD')
ON CONFLICT (plan_code) DO NOTHING;

-- 7. PERMISSIONS SAAS

INSERT INTO permissions(permission_code, permission_name, module_name, description, is_system_permission) VALUES
('saas.tenants.read','Consulter tenants','SaaS','Voir les clients SaaS',TRUE),
('saas.tenants.create','Créer tenant','SaaS','Créer un nouveau client SaaS',TRUE),
('saas.tenants.update','Modifier tenant','SaaS','Modifier un client SaaS',TRUE),
('saas.tenants.suspend','Suspendre tenant','SaaS','Suspendre un client SaaS',TRUE),
('saas.subscriptions.read','Consulter abonnements','SaaS','Voir les abonnements clients',TRUE),
('saas.subscriptions.manage','Gérer abonnements','SaaS','Créer, modifier ou suspendre les abonnements',TRUE),
('saas.billing.read','Consulter facturation SaaS','SaaS','Voir les factures SaaS',TRUE),
('saas.billing.manage','Gérer facturation SaaS','SaaS','Gérer paiements et factures SaaS',TRUE),
('saas.usage.read','Consulter usage SaaS','SaaS','Voir l’utilisation par tenant',TRUE)
ON CONFLICT (permission_code) DO NOTHING;

INSERT INTO permissions(permission_code, permission_name, module_name, description, is_system_permission) VALUES
('settings.exchange_rate.read','Consulter taux de change','Settings','Voir le taux USD/CDF du tenant',TRUE),
('settings.exchange_rate.update','Modifier taux de change','Settings','Modifier le taux USD/CDF du tenant',TRUE)
ON CONFLICT (permission_code) DO NOTHING;

-- 8. VUES SAAS

CREATE OR REPLACE VIEW v_tenant_overview AS
SELECT
    t.tenant_id,
    t.tenant_code,
    t.tenant_name,
    t.tenant_type,
    t.subscription_status,
    sp.plan_name,
    ts.status AS subscription_status_detail,
    COUNT(DISTINCT s.site_id) AS sites_count,
    COUNT(DISTINCT u.user_id) AS users_count,
    t.created_at
FROM tenants t
LEFT JOIN tenant_subscriptions ts ON ts.tenant_id = t.tenant_id
    AND ts.status IN ('TRIAL','ACTIVE','PAST_DUE')
LEFT JOIN subscription_plans sp ON sp.plan_id = ts.plan_id
LEFT JOIN sites s ON s.tenant_id = t.tenant_id
LEFT JOIN users u ON u.tenant_id = t.tenant_id
GROUP BY t.tenant_id, t.tenant_code, t.tenant_name, t.tenant_type,
         t.subscription_status, sp.plan_name, ts.status, t.created_at;

CREATE OR REPLACE VIEW v_tenant_usage_today AS
SELECT
    t.tenant_id,
    t.tenant_code,
    t.tenant_name,
    COALESCE(ul.usage_date, CURRENT_DATE) AS usage_date,
    COALESCE(ul.sites_count, 0) AS sites_count,
    COALESCE(ul.users_count, 0) AS users_count,
    COALESCE(ul.articles_count, 0) AS articles_count,
    COALESCE(ul.sales_count, 0) AS sales_count,
    COALESCE(ul.purchases_count, 0) AS purchases_count,
    COALESCE(ul.storage_used_mb, 0) AS storage_used_mb,
    COALESCE(ul.api_calls_count, 0) AS api_calls_count
FROM tenants t
LEFT JOIN tenant_usage_logs ul
    ON ul.tenant_id = t.tenant_id
   AND ul.usage_date = CURRENT_DATE;

-- NOTES :
-- 1. Remplir tenant_id sur les données existantes avant d'activer RLS partout.
-- 2. Dans NestJS, toujours imposer tenant_id depuis le JWT.
-- 3. Le frontend ne doit jamais décider librement du tenant_id.
-- 4. Pour utilisateurs limités à un site : filtrer tenant_id + site_id.
-- 5. Supabase Auth doit contenir tenant_id, site_id et role dans les custom claims JWT.




-- ============================================================
-- SECTION 4
-- SOURCE : erp_pharmaceutique_v2_finance_caisse_bi_addon.sql
-- ============================================================

-- ============================================================
-- ERP PHARMACEUTIQUE V2 - ADDON FINANCE / CAISSE / REPORTING BI
-- Version : 1.0
-- À exécuter après :
-- 1) schema_v1_1.sql
-- 2) addon_v2.sql
-- 3) saas_multitenant_addon.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. GESTION DE CAISSE AVANCEE
-- ============================================================

CREATE TABLE IF NOT EXISTS cash_registers (
    cash_register_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(tenant_id),
    site_id UUID NOT NULL REFERENCES sites(site_id),
    register_code VARCHAR(50) NOT NULL,
    register_name VARCHAR(150) NOT NULL,
    currency_id UUID REFERENCES currencies(currency_id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, site_id, register_code)
);

ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS cash_register_id UUID REFERENCES cash_registers(cash_register_id);
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS expected_closing_balance NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS difference_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES users(user_id);
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP;
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS cash_movements (
    cash_movement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(tenant_id),
    cash_session_id UUID NOT NULL REFERENCES cash_sessions(cash_session_id) ON DELETE CASCADE,
    movement_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    movement_type VARCHAR(50) NOT NULL CHECK (
        movement_type IN ('SALE_PAYMENT','RECEIVABLE_PAYMENT','CASH_IN','CASH_OUT','EXPENSE','BANK_DEPOSIT','ADVANCE','ADJUSTMENT')
    ),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency_id UUID NOT NULL REFERENCES currencies(currency_id),
    reference_type VARCHAR(80),
    reference_id UUID,
    description TEXT,
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cash_expenses (
    cash_expense_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(tenant_id),
    cash_session_id UUID NOT NULL REFERENCES cash_sessions(cash_session_id),
    expense_number VARCHAR(80) NOT NULL,
    expense_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expense_category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency_id UUID NOT NULL REFERENCES currencies(currency_id),
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','VALIDATED','CANCELLED')),
    created_by UUID REFERENCES users(user_id),
    validated_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    validated_at TIMESTAMP,
    UNIQUE(tenant_id, expense_number)
);

CREATE TABLE IF NOT EXISTS cash_denominations (
    denomination_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(tenant_id),
    cash_session_id UUID NOT NULL REFERENCES cash_sessions(cash_session_id) ON DELETE CASCADE,
    currency_id UUID NOT NULL REFERENCES currencies(currency_id),
    denomination_value NUMERIC(14,2) NOT NULL CHECK (denomination_value > 0),
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cash_reconciliations (
    reconciliation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(tenant_id),
    cash_session_id UUID NOT NULL REFERENCES cash_sessions(cash_session_id),
    reconciliation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_cash_in NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_cash_out NUMERIC(14,2) NOT NULL DEFAULT 0,
    expected_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    counted_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    difference_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','VALIDATED','REJECTED')),
    reconciled_by UUID REFERENCES users(user_id),
    validated_by UUID REFERENCES users(user_id),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    validated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cash_registers_tenant ON cash_registers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_tenant ON cash_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_expenses_session ON cash_expenses(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_cash_reconciliations_session ON cash_reconciliations(cash_session_id);

-- ============================================================
-- 2. COMPTABILITE PHARMACIE SIMPLIFIEE
-- ============================================================

CREATE TABLE IF NOT EXISTS chart_of_accounts (
    account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(tenant_id),
    account_code VARCHAR(50) NOT NULL,
    account_name VARCHAR(200) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (
        account_type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')
    ),
    parent_account_id UUID REFERENCES chart_of_accounts(account_id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, account_code)
);

CREATE TABLE IF NOT EXISTS accounting_journals (
    journal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(tenant_id),
    journal_code VARCHAR(50) NOT NULL,
    journal_name VARCHAR(150) NOT NULL,
    journal_type VARCHAR(50) NOT NULL CHECK (
        journal_type IN ('SALES','PURCHASES','CASH','BANK','GENERAL','INVENTORY')
    ),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(tenant_id, journal_code)
);

CREATE TABLE IF NOT EXISTS journal_entries (
    entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(tenant_id),
    journal_id UUID NOT NULL REFERENCES accounting_journals(journal_id),
    entry_number VARCHAR(80) NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference_type VARCHAR(80),
    reference_id UUID,
    description TEXT,
    total_debit NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_credit NUMERIC(14,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','POSTED','CANCELLED')),
    created_by UUID REFERENCES users(user_id),
    posted_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    posted_at TIMESTAMP,
    UNIQUE(tenant_id, entry_number),
    CHECK (total_debit = total_credit)
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
    entry_line_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(tenant_id),
    entry_id UUID NOT NULL REFERENCES journal_entries(entry_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(account_id),
    debit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
    description TEXT,
    CHECK (
        (debit > 0 AND credit = 0)
        OR
        (credit > 0 AND debit = 0)
    )
);

CREATE TABLE IF NOT EXISTS customer_account_ledger (
    ledger_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(tenant_id),
    customer_id UUID NOT NULL REFERENCES customers(customer_id),
    transaction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reference_type VARCHAR(80),
    reference_id UUID,
    description TEXT,
    debit NUMERIC(14,2) NOT NULL DEFAULT 0,
    credit NUMERIC(14,2) NOT NULL DEFAULT 0,
    balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency_id UUID REFERENCES currencies(currency_id)
);

CREATE TABLE IF NOT EXISTS supplier_account_ledger (
    ledger_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(tenant_id),
    supplier_id UUID NOT NULL REFERENCES suppliers(supplier_id),
    transaction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reference_type VARCHAR(80),
    reference_id UUID,
    description TEXT,
    debit NUMERIC(14,2) NOT NULL DEFAULT 0,
    credit NUMERIC(14,2) NOT NULL DEFAULT 0,
    balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency_id UUID REFERENCES currencies(currency_id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_tenant ON chart_of_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant ON journal_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_tenant ON customer_account_ledger(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_tenant ON supplier_account_ledger(tenant_id);

-- ============================================================
-- 3. REPORTING BI - VUES
-- ============================================================

CREATE OR REPLACE VIEW v_sales_dashboard AS
SELECT
    s.tenant_id,
    s.site_id,
    DATE(s.sale_date) AS sale_day,
    COUNT(*) AS sales_count,
    SUM(s.total_amount) AS total_sales,
    SUM(s.discount_amount) AS total_discount,
    SUM(s.customer_payable_amount) AS total_customer_payable,
    SUM(s.insurance_covered_amount) AS total_insurance,
    SUM(s.credit_amount) AS total_credit
FROM sales s
WHERE s.status = 'VALIDATED'
GROUP BY s.tenant_id, s.site_id, DATE(s.sale_date);

CREATE OR REPLACE VIEW v_cash_dashboard AS
SELECT
    cs.tenant_id,
    cs.site_id,
    cs.cash_session_id,
    cs.opened_at,
    cs.closed_at,
    cs.opening_balance,
    cs.expected_closing_balance,
    cs.closing_balance,
    cs.difference_amount,
    cs.status
FROM cash_sessions cs;

CREATE OR REPLACE VIEW v_stock_value_dashboard AS
SELECT
    st.tenant_id,
    st.site_id,
    SUM(st.quantity_available * l.purchase_price) AS stock_value_purchase,
    SUM(st.quantity_available * l.selling_price) AS stock_value_sale,
    COUNT(DISTINCT l.article_id) AS articles_count,
    COUNT(DISTINCT st.lot_id) AS lots_count
FROM stocks st
JOIN lots l ON l.lot_id = st.lot_id
GROUP BY st.tenant_id, st.site_id;

CREATE OR REPLACE VIEW v_margin_dashboard AS
SELECT
    s.tenant_id,
    s.site_id,
    DATE(s.sale_date) AS sale_day,
    SUM(si.line_total) AS sales_amount,
    SUM(si.quantity * l.purchase_price) AS cost_amount,
    SUM(si.line_total - (si.quantity * l.purchase_price)) AS gross_margin
FROM sale_items si
JOIN sales s ON s.sale_id = si.sale_id
JOIN lots l ON l.lot_id = si.lot_id
WHERE s.status = 'VALIDATED'
GROUP BY s.tenant_id, s.site_id, DATE(s.sale_date);

CREATE OR REPLACE VIEW v_top_products AS
SELECT
    s.tenant_id,
    s.site_id,
    a.article_id,
    a.article_code,
    a.commercial_name,
    SUM(si.quantity) AS total_quantity_sold,
    SUM(si.line_total) AS total_sales_amount
FROM sale_items si
JOIN sales s ON s.sale_id = si.sale_id
JOIN articles a ON a.article_id = si.article_id
WHERE s.status = 'VALIDATED'
GROUP BY s.tenant_id, s.site_id, a.article_id, a.article_code, a.commercial_name;

CREATE OR REPLACE VIEW v_slow_moving_products AS
SELECT
    st.tenant_id,
    st.site_id,
    a.article_id,
    a.article_code,
    a.commercial_name,
    SUM(st.quantity_available) AS stock_available,
    MAX(s.sale_date) AS last_sale_date
FROM stocks st
JOIN lots l ON l.lot_id = st.lot_id
JOIN articles a ON a.article_id = l.article_id
LEFT JOIN sale_items si ON si.article_id = a.article_id
LEFT JOIN sales s ON s.sale_id = si.sale_id AND s.status = 'VALIDATED'
GROUP BY st.tenant_id, st.site_id, a.article_id, a.article_code, a.commercial_name
HAVING MAX(s.sale_date) IS NULL OR MAX(s.sale_date) < CURRENT_DATE - INTERVAL '90 days';

CREATE OR REPLACE VIEW v_receivables_dashboard AS
SELECT
    ar.tenant_id,
    ar.organization_id,
    ar.customer_id,
    ar.receivable_type,
    ar.status,
    SUM(ar.amount_due) AS total_due,
    SUM(ar.amount_paid) AS total_paid,
    SUM(ar.balance) AS total_balance,
    COUNT(*) AS receivables_count
FROM accounts_receivable ar
GROUP BY ar.tenant_id, ar.organization_id, ar.customer_id, ar.receivable_type, ar.status;

CREATE OR REPLACE VIEW v_expiry_dashboard AS
SELECT
    l.tenant_id,
    st.site_id,
    a.article_id,
    a.article_code,
    a.commercial_name,
    l.lot_number,
    l.expiry_date,
    (l.expiry_date - CURRENT_DATE) AS days_remaining,
    st.quantity_available,
    CASE
        WHEN l.expiry_date < CURRENT_DATE THEN 'EXPIRED'
        WHEN l.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN '30_DAYS'
        WHEN l.expiry_date <= CURRENT_DATE + INTERVAL '90 days' THEN '90_DAYS'
        WHEN l.expiry_date <= CURRENT_DATE + INTERVAL '180 days' THEN '180_DAYS'
        ELSE 'OK'
    END AS expiry_status
FROM lots l
JOIN articles a ON a.article_id = l.article_id
JOIN stocks st ON st.lot_id = l.lot_id;

-- ============================================================
-- 4. PERMISSIONS FINANCE / CAISSE / BI
-- ============================================================

INSERT INTO permissions(permission_code, permission_name, module_name, description, is_system_permission) VALUES
('cash_registers.read','Consulter caisses','Caisse','Voir les caisses physiques',TRUE),
('cash_registers.create','Créer caisse','Caisse','Créer une caisse physique',TRUE),
('cash_sessions.open','Ouvrir session caisse','Caisse','Ouvrir une caisse journalière',TRUE),
('cash_sessions.close','Fermer session caisse','Caisse','Fermer une caisse journalière',TRUE),
('cash_sessions.validate','Valider clôture caisse','Caisse','Valider les écarts de caisse',TRUE),
('cash_movements.create','Créer mouvement caisse','Caisse','Entrée/sortie hors vente',TRUE),
('cash_expenses.create','Créer dépense caisse','Caisse','Saisir une dépense de caisse',TRUE),
('cash_expenses.validate','Valider dépense caisse','Caisse','Valider une dépense de caisse',TRUE),

('accounting.read','Consulter comptabilité','Comptabilité','Voir journaux et écritures',TRUE),
('accounting.post','Comptabiliser écriture','Comptabilité','Valider une écriture comptable',TRUE),
('accounting.manage_accounts','Gérer plan comptable','Comptabilité','Créer/modifier comptes comptables',TRUE),
('customer_ledger.read','Consulter compte client','Comptabilité','Voir compte client',TRUE),
('supplier_ledger.read','Consulter compte fournisseur','Comptabilité','Voir compte fournisseur',TRUE),

('bi.sales','BI ventes','Reporting BI','Consulter dashboard ventes',TRUE),
('bi.stock','BI stock','Reporting BI','Consulter dashboard stock',TRUE),
('bi.cash','BI caisse','Reporting BI','Consulter dashboard caisse',TRUE),
('bi.margin','BI marges','Reporting BI','Consulter dashboard marges',TRUE),
('bi.receivables','BI créances','Reporting BI','Consulter dashboard créances',TRUE),
('bi.expiry','BI péremptions','Reporting BI','Consulter dashboard péremptions',TRUE)
ON CONFLICT (permission_code) DO NOTHING;

-- ============================================================
-- 5. DONNEES INITIALES - PLAN COMPTABLE MODELE
-- tenant_id NULL = modèle système à copier pour chaque nouveau tenant
-- ============================================================

INSERT INTO chart_of_accounts(account_code, account_name, account_type, tenant_id) VALUES
('37', 'Stock marchandises pharmaceutiques', 'ASSET', NULL),
('40', 'Fournisseurs', 'LIABILITY', NULL),
('41', 'Clients / Créances', 'ASSET', NULL),
('52', 'Banque', 'ASSET', NULL),
('57', 'Caisse', 'ASSET', NULL),
('60', 'Achats marchandises', 'EXPENSE', NULL),
('70', 'Ventes marchandises', 'REVENUE', NULL),
('709', 'Remises accordées', 'EXPENSE', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO accounting_journals(journal_code, journal_name, journal_type, tenant_id) VALUES
('VEN', 'Journal des ventes', 'SALES', NULL),
('ACH', 'Journal des achats', 'PURCHASES', NULL),
('CAI', 'Journal de caisse', 'CASH', NULL),
('BAN', 'Journal de banque', 'BANK', NULL),
('OD', 'Opérations diverses', 'GENERAL', NULL),
('STK', 'Journal de stock', 'INVENTORY', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- FIN ADDON FINANCE / CAISSE / REPORTING BI
-- ============================================================



COMMIT;

-- ============================================================
-- FIN SCHEMA FINAL V3
-- ============================================================
