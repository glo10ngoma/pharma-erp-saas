import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
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
import { NewPurchasePage } from './modules/purchases/NewPurchasePage';
import { PurchaseDetailPage } from './modules/purchases/PurchaseDetailPage';
import { PurchasesPage } from './modules/purchases/PurchasesPage';
import { RolesPage } from './modules/roles/RolesPage';
import { SitesPage } from './modules/sites/SitesPage';
import { UsersPage } from './modules/users/UsersPage';
import { StocksPage } from './modules/stocks/StocksPage';
import { SalesPage } from './modules/sales/SalesPage';
import { PosPage } from './modules/sales/PosPage';
import { SaleDetailPage } from './modules/sales/SaleDetailPage';
import { CashPage } from './modules/cash/CashPage';
import { OrganizationsPage } from './modules/insurance/OrganizationsPage';
import { InsurancePlansPage } from './modules/insurance/InsurancePlansPage';
import { MembershipsPage } from './modules/insurance/MembershipsPage';
import { ReceivablesPage } from './modules/insurance/ReceivablesPage';
import { InventoriesPage } from './modules/inventories/InventoriesPage';
import { InventoryDetailPage } from './modules/inventories/InventoryDetailPage';
import { AccountsPage } from './modules/accounting/AccountsPage';
import { JournalsPage } from './modules/accounting/JournalsPage';
import { EntriesPage } from './modules/accounting/EntriesPage';
import { GeneralLedgerPage } from './modules/accounting/GeneralLedgerPage';
import { TrialBalancePage } from './modules/accounting/TrialBalancePage';
import { ReportsDashboardPage } from './modules/reports/ReportsDashboardPage';
import { ProfilePage } from './modules/profile/ProfilePage';

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" />} />
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
              <Route path="/stocks" element={<StocksPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/pos" element={<PosPage />} />
              <Route path="/sales/:id" element={<SaleDetailPage />} />
              <Route path="/cash" element={<CashPage />} />
              <Route path="/organizations" element={<OrganizationsPage />} />
              <Route path="/insurance-plans" element={<InsurancePlansPage />} />
              <Route path="/memberships" element={<MembershipsPage />} />
              <Route path="/receivables" element={<ReceivablesPage />} />
              <Route path="/inventories" element={<InventoriesPage />} />
              <Route path="/inventories/:id" element={<InventoryDetailPage />} />
              <Route path="/accounting/accounts" element={<AccountsPage />} />
              <Route path="/accounting/journals" element={<JournalsPage />} />
              <Route path="/accounting/entries" element={<EntriesPage />} />
              <Route path="/accounting/general-ledger" element={<GeneralLedgerPage />} />
              <Route path="/accounting/trial-balance" element={<TrialBalancePage />} />
              <Route path="/reports" element={<ReportsDashboardPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/permissions" element={<PermissionsPage />} />
              <Route path="/sites" element={<SitesPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
