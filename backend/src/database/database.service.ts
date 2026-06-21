import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly config: ConfigService) {
    const connectionString = this.config.get<string>('DATABASE_URL');

    this.pool = new Pool({
      connectionString,
      ssl: this.resolveSsl(connectionString),
    });
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

  private resolveSsl(connectionString?: string) {
    const sslMode = this.config.get<string>('DATABASE_SSL');

    if (sslMode === 'true') return { rejectUnauthorized: false };
    if (sslMode === 'false') return undefined;

    if (connectionString?.includes('supabase.co')) {
      return { rejectUnauthorized: false };
    }

    return undefined;
  }
}
