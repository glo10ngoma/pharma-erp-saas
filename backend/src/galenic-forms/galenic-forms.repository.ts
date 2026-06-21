import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { DatabaseService } from '../database/database.service';
import { CreateGalenicFormDto } from './dto/create-galenic-form.dto';
import { UpdateGalenicFormDto } from './dto/update-galenic-form.dto';

type Row = { form_id: string; tenant_id: string; form_code: string; form_name: string };

@Injectable()
export class GalenicFormsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(user: AuthUser) {
    const result = await this.db.query<Row>(
      `SELECT form_id, tenant_id, form_code, form_name FROM galenic_forms WHERE tenant_id=$1 ORDER BY form_name`,
      [user.tenantId],
    );
    return result.rows.map(this.toDto);
  }

  async findOne(user: AuthUser, id: string) {
    const result = await this.db.query<Row>(
      `SELECT form_id, tenant_id, form_code, form_name FROM galenic_forms WHERE tenant_id=$1 AND form_id=$2 LIMIT 1`,
      [user.tenantId, id],
    );
    return result.rows[0] ? this.toDto(result.rows[0]) : null;
  }

  async create(user: AuthUser, dto: CreateGalenicFormDto) {
    const result = await this.db.query<Row>(
      `INSERT INTO galenic_forms (tenant_id, form_code, form_name) VALUES ($1,$2,$3)
       RETURNING form_id, tenant_id, form_code, form_name`,
      [user.tenantId, dto.formCode, dto.formName],
    );
    return this.toDto(result.rows[0]);
  }

  async update(user: AuthUser, id: string, dto: UpdateGalenicFormDto) {
    const current = await this.findOne(user, id);
    if (!current) return null;
    const result = await this.db.query<Row>(
      `UPDATE galenic_forms SET form_code=$3, form_name=$4 WHERE tenant_id=$1 AND form_id=$2
       RETURNING form_id, tenant_id, form_code, form_name`,
      [user.tenantId, id, dto.formCode ?? current.formCode, dto.formName ?? current.formName],
    );
    return result.rows[0] ? this.toDto(result.rows[0]) : null;
  }

  async remove(user: AuthUser, id: string) {
    const result = await this.db.query<Row>(
      `DELETE FROM galenic_forms WHERE tenant_id=$1 AND form_id=$2 RETURNING form_id, tenant_id, form_code, form_name`,
      [user.tenantId, id],
    );
    return result.rows[0] ? this.toDto(result.rows[0]) : null;
  }

  private toDto(row: Row) {
    return { formId: row.form_id, tenantId: row.tenant_id, formCode: row.form_code, formName: row.form_name };
  }
}
