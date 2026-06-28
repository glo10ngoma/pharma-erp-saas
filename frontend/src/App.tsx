import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { useAuth } from './auth/AuthContext';
import { landingPathForUser } from './auth/landing';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './modules/auth/LoginPage';
import { DashboardPage } from './modules/dashboard/DashboardPage';
import { ArticlesPage } from './modules/articles/ArticlesPage';
import { AdministrationRoutesPage } from './modules/reference/AdministrationRoutesPage';
import { CategoriesPage } from './modules/reference/CategoriesPage';
import { CustomersPage } from './modules/reference/CustomersPage';
import { GalenicFormsPage } from './modules/reference/GalenicFormsPage';
import { ProductTypesPage } from './modules/reference/ProductTypesPage';
import { SubCategoriesPage } from './modules/reference/SubCategoriesPage';
import { SuppliersPage } from './modules/reference/SuppliersPage';
import { PermissionsPage } from './modules/permissions/PermissionsPage';
import { LotsPage } from './modules/lots/LotsPage';
import { FefoHighlightPage } from './modules/fefo/FefoHighlightPage';
import { FefoRotationPage } from './modules/fefo/FefoRotationPage';
import { NewPurchasePage } from './modules/purchases/NewPurchasePage';
import { PurchaseDetailPage } from './modules/purchases/PurchaseDetailPage';
import { PurchasesPage } from './modules/purchases/PurchasesPage';
import { RolesPage } from './modules/roles/RolesPage';
import { SitesPage } from './modules/sites/SitesPage';
import { UsersPage } from './modules/users/UsersPage';
import { StocksPage } from './modules/stocks/StocksPage';
import { TransferDetailPage } from './modules/transfers/TransferDetailPage';
import { NewTransferPage } from './modules/transfers/NewTransferPage';
import { TransfersPage } from './modules/transfers/TransfersPage';
import { SalesPage } from './modules/sales/SalesPage';
import { PosPage } from './modules/sales/PosPage';
import { CustomerDisplayPage } from './modules/sales/CustomerDisplayPage';
import { SaleDetailPage } from './modules/sales/SaleDetailPage';
import { CashPage } from './modules/cash/CashPage';
import { OrganizationsPage } from './modules/insurance/OrganizationsPage';
import { InsurancePlansPage } from './modules/insurance/InsurancePlansPage';
import { MembershipsPage } from './modules/insurance/MembershipsPage';
import { ReceivablesPage } from './modules/insurance/ReceivablesPage';
import { InventoriesPage } from './modules/inventories/InventoriesPage';
import { InventoryDetailPage } from './modules/inventories/InventoryDetailPage';
import { ProfilePage } from './modules/profile/ProfilePage';
import { ExchangeRatePage } from './modules/settings/ExchangeRatePage';

const queryClient = new QueryClient();

const AccountsPage = lazy(() => import('./modules/accounting/AccountsPage').then((module) => ({ default: module.AccountsPage })));
const JournalsPage = lazy(() => import('./modules/accounting/JournalsPage').then((module) => ({ default: module.JournalsPage })));
const EntriesPage = lazy(() => import('./modules/accounting/EntriesPage').then((module) => ({ default: module.EntriesPage })));
const GeneralLedgerPage = lazy(() => import('./modules/accounting/GeneralLedgerPage').then((module) => ({ default: module.GeneralLedgerPage })));
const TrialBalancePage = lazy(() => import('./modules/accounting/TrialBalancePage').then((module) => ({ default: module.TrialBalancePage })));

const AnalyticsOverviewPage = lazy(() => import('./modules/analytics/AnalyticsPages').then((module) => ({ default: module.AnalyticsOverviewPage })));
const AnalyticsAbcPage = lazy(() => import('./modules/analytics/AnalyticsPages').then((module) => ({ default: module.AnalyticsAbcPage })));
const AnalyticsStockRotationPage = lazy(() => import('./modules/analytics/AnalyticsPages').then((module) => ({ default: module.AnalyticsStockRotationPage })));
const AnalyticsDormantProductsPage = lazy(() => import('./modules/analytics/AnalyticsPages').then((module) => ({ default: module.AnalyticsDormantProductsPage })));
const AnalyticsMarginsPage = lazy(() => import('./modules/analytics/AnalyticsPages').then((module) => ({ default: module.AnalyticsMarginsPage })));
const AnalyticsSuppliersPage = lazy(() => import('./modules/analytics/AnalyticsPages').then((module) => ({ default: module.AnalyticsSuppliersPage })));
const AnalyticsSellersPage = lazy(() => import('./modules/analytics/AnalyticsPages').then((module) => ({ default: module.AnalyticsSellersPage })));

const NotificationsPage = lazy(() => import('./modules/notifications/NotificationsPage').then((module) => ({ default: module.NotificationsPage })));
const ReportsDashboardPage = lazy(() => import('./modules/reports/ReportsDashboardPage').then((module) => ({ default: module.ReportsDashboardPage })));
const ReportsIndexPage = lazy(() => import('./modules/reports/ReportsIndexPage').then((module) => ({ default: module.ReportsIndexPage })));
const SalesReportPage = lazy(() => import('./modules/reports/StandardReportPages').then((module) => ({ default: module.SalesReportPage })));
const PurchasesReportPage = lazy(() => import('./modules/reports/StandardReportPages').then((module) => ({ default: module.PurchasesReportPage })));
const StocksReportPage = lazy(() => import('./modules/reports/StandardReportPages').then((module) => ({ default: module.StocksReportPage })));
const InventoriesReportPage = lazy(() => import('./modules/reports/StandardReportPages').then((module) => ({ default: module.InventoriesReportPage })));
const FefoReportPage = lazy(() => import('./modules/reports/StandardReportPages').then((module) => ({ default: module.FefoReportPage })));
const CashReportPage = lazy(() => import('./modules/reports/StandardReportPages').then((module) => ({ default: module.CashReportPage })));
const InsuranceReportPage = lazy(() => import('./modules/reports/StandardReportPages').then((module) => ({ default: module.InsuranceReportPage })));
const MarginsReportPage = lazy(() => import('./modules/reports/StandardReportPages').then((module) => ({ default: module.MarginsReportPage })));

const InsuranceDashboardPage = lazy(() => import('./modules/insurance-v2/InsuranceV2Pages').then((module) => ({ default: module.InsuranceDashboardPage })));
const InsuranceReceivablesV2Page = lazy(() => import('./modules/insurance-v2/InsuranceV2Pages').then((module) => ({ default: module.InsuranceReceivablesV2Page })));
const InsuranceBatchesPage = lazy(() => import('./modules/insurance-v2/InsuranceV2Pages').then((module) => ({ default: module.InsuranceBatchesPage })));
const InsurancePaymentsPage = lazy(() => import('./modules/insurance-v2/InsuranceV2Pages').then((module) => ({ default: module.InsurancePaymentsPage })));
const InsuranceDisputesPage = lazy(() => import('./modules/insurance-v2/InsuranceV2Pages').then((module) => ({ default: module.InsuranceDisputesPage })));
const InsuranceRemindersPage = lazy(() => import('./modules/insurance-v2/InsuranceV2Pages').then((module) => ({ default: module.InsuranceRemindersPage })));
const InsuranceHistoryPage = lazy(() => import('./modules/insurance-v2/InsuranceV2Pages').then((module) => ({ default: module.InsuranceHistoryPage })));

const CashRegistersAdminPage = lazy(() => import('./modules/administration/CashRegistersAdminPage').then((module) => ({ default: module.CashRegistersAdminPage })));
const GeneralSettingsPage = lazy(() => import('./modules/administration/GeneralSettingsPage').then((module) => ({ default: module.GeneralSettingsPage })));
const NumberingPage = lazy(() => import('./modules/administration/NumberingPage').then((module) => ({ default: module.NumberingPage })));
const AuditLogsPage = lazy(() => import('./modules/administration/AuditLogsPage').then((module) => ({ default: module.AuditLogsPage })));
const CompanySettingsPage = lazy(() => import('./modules/administration/CompanySettingsPage').then((module) => ({ default: module.CompanySettingsPage })));
const SystemBackupsPage = lazy(() => import('./modules/administration/SystemBackupsPage').then((module) => ({ default: module.SystemBackupsPage })));

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/pos/customer-display" element={<CustomerDisplayPage />} />
              <Route element={<DashboardLayout />}>
                <Route path="/" element={<HomeRedirect />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/articles" element={<ArticlesPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/sub-categories" element={<SubCategoriesPage />} />
                <Route path="/galenic-forms" element={<GalenicFormsPage />} />
                <Route path="/administration-routes" element={<AdministrationRoutesPage />} />
                <Route path="/product-types" element={<ProductTypesPage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/purchases" element={<PurchasesPage />} />
                <Route path="/purchases/new" element={<NewPurchasePage />} />
                <Route path="/purchases/:id" element={<PurchaseDetailPage />} />
                <Route path="/lots" element={<LotsPage />} />
                <Route path="/fefo/highlight" element={<FefoHighlightPage />} />
                <Route path="/fefo/rotation" element={<FefoRotationPage />} />
                <Route path="/stocks" element={<StocksPage />} />
                <Route path="/transfers" element={<TransfersPage />} />
                <Route path="/transfers/new" element={<NewTransferPage />} />
                <Route path="/transfers/:id" element={<TransferDetailPage />} />
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/pos" element={<PosPage />} />
                <Route path="/sales/:id" element={<SaleDetailPage />} />
                <Route path="/cash" element={<CashPage />} />
                <Route path="/organizations" element={<OrganizationsPage />} />
                <Route path="/insurance-plans" element={<InsurancePlansPage />} />
                <Route path="/memberships" element={<MembershipsPage />} />
                <Route path="/receivables" element={<ReceivablesPage />} />
                <Route path="/insurance/dashboard" element={<InsuranceDashboardPage />} />
                <Route path="/insurance/receivables" element={<InsuranceReceivablesV2Page />} />
                <Route path="/insurance/batches" element={<InsuranceBatchesPage />} />
                <Route path="/insurance/payments" element={<InsurancePaymentsPage />} />
                <Route path="/insurance/disputes" element={<InsuranceDisputesPage />} />
                <Route path="/insurance/reminders" element={<InsuranceRemindersPage />} />
                <Route path="/insurance/history" element={<InsuranceHistoryPage />} />
                <Route path="/inventories" element={<InventoriesPage />} />
                <Route path="/inventories/:id" element={<InventoryDetailPage />} />
                <Route path="/accounting/accounts" element={<AccountsPage />} />
                <Route path="/accounting/journals" element={<JournalsPage />} />
                <Route path="/accounting/entries" element={<EntriesPage />} />
                <Route path="/accounting/general-ledger" element={<GeneralLedgerPage />} />
                <Route path="/accounting/trial-balance" element={<TrialBalancePage />} />
                <Route path="/analytics" element={<AnalyticsOverviewPage />} />
                <Route path="/analytics/abc" element={<AnalyticsAbcPage />} />
                <Route path="/analytics/stock-rotation" element={<AnalyticsStockRotationPage />} />
                <Route path="/analytics/dormant-products" element={<AnalyticsDormantProductsPage />} />
                <Route path="/analytics/margins" element={<AnalyticsMarginsPage />} />
                <Route path="/analytics/suppliers" element={<AnalyticsSuppliersPage />} />
                <Route path="/analytics/sellers" element={<AnalyticsSellersPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/reports" element={<ReportsIndexPage />} />
                <Route path="/reports/dashboard" element={<ReportsDashboardPage />} />
                <Route path="/reports/sales-report" element={<SalesReportPage />} />
                <Route path="/reports/purchases-report" element={<PurchasesReportPage />} />
                <Route path="/reports/stocks-report" element={<StocksReportPage />} />
                <Route path="/reports/inventories-report" element={<InventoriesReportPage />} />
                <Route path="/reports/fefo-report" element={<FefoReportPage />} />
                <Route path="/reports/cash-report" element={<CashReportPage />} />
                <Route path="/reports/insurance-report" element={<InsuranceReportPage />} />
                <Route path="/reports/margins-report" element={<MarginsReportPage />} />
                <Route path="/settings/exchange-rate" element={<ExchangeRatePage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/roles" element={<RolesPage />} />
                <Route path="/permissions" element={<PermissionsPage />} />
                <Route path="/sites" element={<SitesPage />} />
                <Route path="/administration/cash-registers" element={<CashRegistersAdminPage />} />
                <Route path="/administration/general-settings" element={<GeneralSettingsPage />} />
                <Route path="/administration/numbering" element={<NumberingPage />} />
                <Route path="/administration/audit-logs" element={<AuditLogsPage />} />
                <Route path="/administration/company" element={<CompanySettingsPage />} />
                <Route path="/administration/backups" element={<SystemBackupsPage />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function HomeRedirect() {
  const { currentUser } = useAuth();
  return <Navigate to={landingPathForUser(currentUser)} replace />;
}

function RouteFallback() {
  return (
    <main className="content">
      <p className="loading-state">Chargement de la page...</p>
    </main>
  );
}
