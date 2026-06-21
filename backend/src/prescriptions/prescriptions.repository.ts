import { Injectable } from '@nestjs/common';

@Injectable()
export class PrescriptionsRepository {
  async findAll() {
    // TODO: remplacer par Prisma, Kysely ou Supabase/PostgreSQL client.
    return [];
  }
}
