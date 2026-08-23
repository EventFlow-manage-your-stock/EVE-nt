// EVENTFLOW_PRODUCT_POLISH_V4: Etykiety są generowane w osobnej karcie jako widok A4.
// Użytkownik może z okna drukowania zapisać je jako PDF albo od razu wydrukować.
export function openLabelsPage(params: { ids?: number[]; modelId?: number; type?: 'qr' | 'barcode' }) {
  const chosen = params.type || (window.confirm('OK = QR, Anuluj = kod kreskowy') ? 'qr' : 'barcode');
  const query = new URLSearchParams();
  query.set('type', chosen);
  if (params.ids?.length) query.set('ids', params.ids.join(','));
  if (params.modelId) query.set('modelId', String(params.modelId));
  window.open(`/dashboard/warehouse/labels?${query.toString()}`, '_blank', 'noopener,noreferrer');
}
