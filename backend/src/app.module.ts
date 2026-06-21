import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { ArticlesModule } from './articles/articles.module';
import { CategoriesModule } from './categories/categories.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AdministrationRoutesModule } from './administration-routes/administration-routes.module';
import { PermissionGuard } from './common/guards/permission.guard';
import { CustomersModule } from './customers/customers.module';
import { DatabaseModule } from './database/database.module';
import { GalenicFormsModule } from './galenic-forms/galenic-forms.module';
import { PermissionsModule } from './permissions/permissions.module';
import { ProductTypesModule } from './product-types/product-types.module';
import { PurchasesModule } from './purchases/purchases.module';
import { RolesModule } from './roles/roles.module';
import { SitesModule } from './sites/sites.module';
import { SubCategoriesModule } from './sub-categories/sub-categories.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { LotsModule } from './lots/lots.module';
import { StocksModule } from './stocks/stocks.module';
import { StockMovementsModule } from './stock-movements/stock-movements.module';
import { UsersModule } from './users/users.module';
import { SalesModule } from './sales/sales.module';
import { PaymentsModule } from './payments/payments.module';
import { CashModule } from './cash/cash.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { InsurancePlansModule } from './insurance-plans/insurance-plans.module';
import { MembershipsModule } from './memberships/memberships.module';
import { ReceivablesModule } from './receivables/receivables.module';
import { InventoriesModule } from './inventories/inventories.module';
import { AccountingModule } from './accounting/accounting.module';
import { ReportsModule } from './reports/reports.module';
import { CodeGeneratorModule } from './code-generator/code-generator.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    ArticlesModule,
    CategoriesModule,
    SubCategoriesModule,
    GalenicFormsModule,
    AdministrationRoutesModule,
    ProductTypesModule,
    SuppliersModule,
    CustomersModule,
    PurchasesModule,
    LotsModule,
    StocksModule,
    StockMovementsModule,
    SalesModule,
    PaymentsModule,
    CashModule,
    OrganizationsModule,
    InsurancePlansModule,
    MembershipsModule,
    ReceivablesModule,
    InventoriesModule,
    AccountingModule,
    ReportsModule,
    CodeGeneratorModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    SitesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule {}
