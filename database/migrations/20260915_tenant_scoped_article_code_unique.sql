BEGIN;

ALTER TABLE articles
  DROP CONSTRAINT IF EXISTS articles_article_code_key;

DROP INDEX IF EXISTS articles_article_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_articles_tenant_code
  ON articles (tenant_id, article_code);

COMMIT;
