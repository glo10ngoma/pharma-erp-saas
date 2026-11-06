import { useAuth } from '../../auth/AuthContext';
import { referenceService } from '../../services/reference.service';
import { SimpleCodeNamePage } from './SimpleCodeNamePage';

export function ProductUnitsPage() {
  const { currentUser } = useAuth();
  return (
    <SimpleCodeNamePage
      title="Unités de mesure"
      queryKey="product-units"
      codeLabel="Code"
      nameLabel="Libellé de l’unité"
      codeField="unitCode"
      nameField="unitLabel"
      idField="productUnitId"
      createPermission={currentUser?.role === 'SUPER_ADMIN' ? undefined : 'product_units.create'}
      getAll={referenceService.productUnits.getAll}
      create={referenceService.productUnits.create}
      update={referenceService.productUnits.update}
    />
  );
}
