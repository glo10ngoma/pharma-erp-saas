import { Injectable } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { ReportFilterDto } from './dto/report-filter.dto';
import { ReportsRepository } from './reports.repository';

@Injectable()
export class ReportsService {
  constructor(private readonly repository: ReportsRepository) {}

  dashboard(user: AuthUser, filters: ReportFilterDto) { return this.repository.dashboard(user, filters); }
  sales(user: AuthUser, filters: ReportFilterDto) { return this.repository.sales(user, filters); }
  stock(user: AuthUser, filters: ReportFilterDto) { return this.repository.stock(user, filters); }
  margins(user: AuthUser, filters: ReportFilterDto) { return this.repository.margins(user, filters); }
  cash(user: AuthUser, filters: ReportFilterDto) { return this.repository.cash(user, filters); }
  receivables(user: AuthUser, filters: ReportFilterDto) { return this.repository.receivables(user, filters); }
  expiry(user: AuthUser, filters: ReportFilterDto) { return this.repository.expiry(user, filters); }
  topProducts(user: AuthUser, filters: ReportFilterDto) { return this.repository.topProducts(user, filters); }
}
