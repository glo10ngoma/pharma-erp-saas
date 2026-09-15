BEGIN;

ALTER TABLE categories
  DROP CONSTRAINT categories_category_name_key,
  DROP CONSTRAINT categories_category_code_key;

ALTER TABLE categories
  ADD CONSTRAINT categories_tenant_category_name_key
  UNIQUE (tenant_id, category_name);

ALTER TABLE categories
  ADD CONSTRAINT categories_tenant_category_code_key
  UNIQUE (tenant_id, category_code);

ALTER TABLE categories
  ADD CONSTRAINT categories_tenant_category_id_key
  UNIQUE (tenant_id, category_id);

ALTER TABLE sub_categories
  ADD CONSTRAINT sub_categories_tenant_category_fkey
  FOREIGN KEY (tenant_id, category_id)
  REFERENCES categories (tenant_id, category_id);

ALTER TABLE galenic_forms
  DROP CONSTRAINT galenic_forms_form_name_key,
  DROP CONSTRAINT galenic_forms_form_code_key;

CREATE UNIQUE INDEX galenic_forms_tenant_form_name_uidx
  ON galenic_forms (tenant_id, form_name)
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX galenic_forms_tenant_form_code_uidx
  ON galenic_forms (tenant_id, form_code)
  WHERE tenant_id IS NOT NULL;

COMMIT;
