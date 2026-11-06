import { referenceService } from '../../services/reference.service';
import { SimpleCodeNamePage } from './SimpleCodeNamePage';

export function ProductUnitsPage() {
  return (
    <SimpleCodeNamePage
      title="Unités de mesure"
      queryKey="product-units"
      codeLabel="Code"
      nameLabel="Libellé de l’unité"
      codeField="unitCode"
      nameField="unitLabel"
      idField="productUnitId"
      createPermission="product_units.create"
      getAll={referenceService.productUnits.getAll}
      create={referenceService.productUnits.create}
    />
  );
}
