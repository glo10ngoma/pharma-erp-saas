import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;
  private readonly connectionString: string;

  constructor(private readonly config: ConfigService) {
    const configured = this.config.get<string>('DATABASE_URL');
    const connectionString = this.sanitizeConnectionString(configured);
    this.connectionString = connectionString;

    this.pool = new Pool({
      connectionString,
      ssl: this.resolveSsl(connectionString),
      max: Number(this.config.get<string>('DATABASE_POOL_MAX') ?? 10),
      connectionTimeoutMillis: Number(this.config.get<string>('DATABASE_CONNECT_TIMEOUT_MS') ?? 10000),
      idleTimeoutMillis: Number(this.config.get<string>('DATABASE_IDLE_TIMEOUT_MS') ?? 30000),
      keepAlive: true,
    });

    this.pool.on('error', (error) => {
      this.logger.error('DATABASE_POOL_ERROR', this.serializeError(error));
    });

    if (this.isDev()) {
      this.logger.log(`DATABASE_CONFIG ${JSON.stringify(this.connectionSummary())}`);
    }
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async transaction<T>(
    callback: (client: Pick<PoolClient, 'query'>) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async ping() {
    await this.query('SELECT 1');
    return true;
  }

  connectionSummary() {
    const url = this.safeUrl();
    return {
      nodeEnv: process.env.NODE_ENV ?? null,
      appEnv: process.env.APP_ENV ?? null,
      cwd: process.cwd(),
      envFileLoaded: Boolean(this.config.get<string>('DATABASE_URL')),
      protocol: url?.protocol?.replace(':', '') ?? null,
      host: url?.hostname ?? null,
      port: url?.port ?? null,
      database: url?.pathname?.replace(/^\//, '') ?? null,
      hasSslParam: url?.searchParams.has('sslmode') || url?.searchParams.has('pgbouncer') || false,
      sslConfigured: Boolean(this.resolveSsl(this.connectionString)),
      usesPooler: (url?.hostname ?? '').includes('pooler.supabase.com') || (url?.searchParams.get('pgbouncer') === 'true'),
      connectionStringLength: this.connectionString.length,
    };
  }

  private resolveSsl(connectionString?: string) {
    const sslMode = this.config.get<string>('DATABASE_SSL');

    if (sslMode === 'true') return { rejectUnauthorized: false };
    if (sslMode === 'false') return undefined;

    if (connectionString?.includes('supabase.co')) {
      return { rejectUnauthorized: false };
    }

    return undefined;
  }

  private sanitizeConnectionString(connectionString?: string) {
    const raw = String(connectionString ?? '').trim();
    if (!raw) return raw;
    if (
      (raw.startsWith('"') && raw.endsWith('"'))
      || (raw.startsWith("'") && raw.endsWith("'"))
    ) {
      return raw.slice(1, -1).trim();
    }
    return raw;
  }

  private safeUrl() {
    try {
      return new URL(this.connectionString);
    } catch {
      return null;
    }
  }

  private serializeError(error: unknown) {
    if (!(error instanceof Error)) return { value: String(error) };
    const anyError = error as Error & {
      code?: string;
      errno?: number | string;
      address?: string;
      port?: number | string;
      cause?: unknown;
      errors?: unknown[];
    };
    return {
      name: anyError.name,
      message: anyError.message,
      code: anyError.code,
      errno: anyError.errno,
      address: anyError.address,
      port: anyError.port,
      cause: this.serializeNested(anyError.cause),
      errors: Array.isArray(anyError.errors) ? anyError.errors.map((entry) => this.serializeNested(entry)) : undefined,
      stack: this.isDev() ? anyError.stack : undefined,
    };
  }

  private serializeNested(value: unknown) {
    if (!value) return value;
    if (value instanceof Error) {
      const nested = value as Error & {
        code?: string;
        errno?: number | string;
        address?: string;
        port?: number | string;
      };
      return {
        name: nested.name,
        message: nested.message,
        code: nested.code,
        errno: nested.errno,
        address: nested.address,
        port: nested.port,
        stack: this.isDev() ? nested.stack : undefined,
      };
    }
    return value;
  }

  private isDev() {
    return (process.env.APP_ENV ?? 'development') !== 'production' && (process.env.NODE_ENV ?? 'development') !== 'production';
  }
}
