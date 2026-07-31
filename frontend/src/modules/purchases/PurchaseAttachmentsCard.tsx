import { ChangeEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '../../services/apiError';
import { PurchaseAttachment } from '../../services/purchases.service';
import { formatDate } from '../../utils/date';

type AttachmentApi = {
  list: () => Promise<{ data: PurchaseAttachment[] }>;
  upload: (payload: { file: File; attachmentType?: string; description?: string }) => Promise<{ data: PurchaseAttachment }>;
  openUrl: (attachmentId: string) => Promise<{ data: { signedUrl: string } }>;
  remove: (attachmentId: string) => Promise<{ data: { deleted: boolean } }>;
};

const ATTACHMENT_TYPES = [
  'INVOICE',
  'DELIVERY_NOTE',
  'RECEIPT',
  'PAYMENT_PROOF',
  'PRODUCT_PHOTO',
  'CUSTOMS_DOCUMENT',
  'RETURN_NOTE',
  'CREDIT_NOTE',
  'OTHER',
];

export function PurchaseAttachmentsCard({
  title,
  queryKey,
  api,
  canCreate,
  canDelete,
}: {
  title: string;
  queryKey: unknown[];
  api: AttachmentApi;
  canCreate: boolean;
  canDelete: boolean;
}) {
  const qc = useQueryClient();
  const [attachmentType, setAttachmentType] = useState('OTHER');
  const [description, setDescription] = useState('');
  const [localError, setLocalError] = useState('');

  const query = useQuery({ queryKey, queryFn: async () => (await api.list()).data });
  const upload = useMutation({
    mutationFn: (payload: { file: File; attachmentType?: string; description?: string }) => api.upload(payload),
    onSuccess: async () => {
      setDescription('');
      setLocalError('');
      await qc.invalidateQueries({ queryKey });
    },
  });
  const remove = useMutation({
    mutationFn: (attachmentId: string) => api.remove(attachmentId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey });
    },
  });

  async function handleOpen(attachmentId: string) {
    try {
      const response = await api.openUrl(attachmentId);
      window.open(response.data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setLocalError(apiErrorMessage(error));
    }
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setLocalError('Fichier trop volumineux. Maximum 10 Mo.');
      return;
    }
    upload.mutate({ file, attachmentType, description });
  }

  return (
    <div className="card">
      <div className="toolbar compact-toolbar">
        <div>
          <h2>{title}</h2>
          <p className="muted">PDF, JPG, PNG, DOCX, XLSX. Maximum 10 Mo.</p>
        </div>
        {canCreate ? (
          <div className="inline-form-group">
            <select className="input compact-input" value={attachmentType} onChange={(event) => setAttachmentType(event.target.value)}>
              {ATTACHMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <input className="input compact-input" placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
            <label className="button compact-button" style={{ cursor: 'pointer' }}>
              {upload.isPending ? 'Upload...' : 'Ajouter fichier'}
              <input hidden type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" onChange={handleUpload} />
            </label>
          </div>
        ) : null}
      </div>
      {(localError || upload.isError || remove.isError) ? <p className="form-error">{localError || apiErrorMessage(upload.error) || apiErrorMessage(remove.error)}</p> : null}
      {!query.data?.length ? (
        <p className="muted">{query.isLoading ? 'Chargement...' : 'Aucune piece jointe.'}</p>
      ) : (
        <table className="data-table purchase-detail-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Type</th>
              <th>Taille</th>
              <th>Date</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {query.data.map((attachment) => (
              <tr key={attachment.purchaseAttachmentId}>
                <td>{attachment.originalFileName}</td>
                <td>{attachment.attachmentType}</td>
                <td>{formatBytes(attachment.fileSize)}</td>
                <td>{formatDate(attachment.uploadedAt)}</td>
                <td>{attachment.description ?? '-'}</td>
                <td className="table-actions">
                  <button className="ghost-button compact-button" type="button" onClick={() => handleOpen(attachment.purchaseAttachmentId)}>Ouvrir</button>
                  {canDelete ? (
                    <button className="ghost-button compact-button" type="button" onClick={() => remove.mutate(attachment.purchaseAttachmentId)} disabled={remove.isPending}>Supprimer</button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} o`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} Ko`;
  return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
}
