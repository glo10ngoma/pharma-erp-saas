import { referenceService } from '../../services/reference.service';
import { SimpleCodeNamePage } from './SimpleCodeNamePage';

export function GalenicFormsPage() {
  return <SimpleCodeNamePage title="Formes galeniques" queryKey="galenic-forms" entity="galenic_forms" codeLabel="Code" nameLabel="Nom" codeField="formCode" nameField="formName" idField="formId" getAll={referenceService.galenicForms.getAll} create={referenceService.galenicForms.create} />;
}
