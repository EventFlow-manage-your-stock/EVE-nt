'use client';
import { EntityEditorPage } from '../../../../../components/EntityEditorPage';

export default function EventTypeEditorPage() {
  return <EntityEditorPage config={{
    moduleLabel: 'Typy wydarzeń',
    title: 'Edycja typu wydarzenia',
    listHref: '/dashboard/settings/event-types',
    getEndpoint: (id) => `/api/slowniki/typy-wydarzen/${id}`,
    updateEndpoint: (id) => `/api/slowniki/typy-wydarzen/${id}`,
    deleteEndpoint: (id) => `/api/slowniki/typy-wydarzen/${id}`,
    titleFromRecord: (r) => r.nazwa || `Typ #${r.id}`,
    fields: [
      { key: 'nazwa', label: 'Nazwa' },
      { key: 'kolor', label: 'Kolor paska w kalendarzu', type: 'color' },
      { key: 'kolejnosc', label: 'Kolejność', type: 'number' },
      { key: 'aktywny', label: 'Aktywny', type: 'checkbox' },
    ],
  }} />;
}
