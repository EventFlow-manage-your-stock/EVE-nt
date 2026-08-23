'use client';
import { EntityEditorPage } from '../../../../../components/EntityEditorPage';

export default function ServiceStatusEditorPage() {
  return <EntityEditorPage config={{
    moduleLabel: 'Statusy serwisowe',
    title: 'Edycja statusu serwisowego',
    listHref: '/dashboard/service/statuses',
    getEndpoint: (id) => `/api/serwis/statusy/${id}`,
    updateEndpoint: (id) => `/api/serwis/statusy/${id}`,
    deleteEndpoint: (id) => `/api/serwis/statusy/${id}`,
    titleFromRecord: (r) => r.nazwa || `Status #${r.id}`,
    fields: [
      { key: 'nazwa', label: 'Nazwa' },
      { key: 'kolor', label: 'Kolor', type: 'color' },
      { key: 'kolejnosc', label: 'Kolejność', type: 'number' },
      { key: 'aktywny', label: 'Aktywny', type: 'checkbox' },
    ],
  }} />;
}
