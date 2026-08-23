'use client';
import { EntityEditorPage } from '../../../../../components/EntityEditorPage';

export default function CategoryEditorPage() {
  return <EntityEditorPage config={{
    moduleLabel: 'Kategorie sprzętu',
    title: 'Edycja kategorii',
    listHref: '/dashboard/warehouse/categories',
    getEndpoint: (id) => `/api/magazyn/kategorie/${id}`,
    updateEndpoint: (id) => `/api/magazyn/kategorie/${id}`,
    deleteEndpoint: (id) => `/api/magazyn/kategorie/${id}`,
    dictionaries: { id_rodzica: '/api/magazyn/kategorie/plasko' },
    titleFromRecord: (r) => r.nazwa || `Kategoria #${r.id}`,
    fields: [
      { key: 'nazwa', label: 'Nazwa' },
      { key: 'id_rodzica', label: 'Kategoria nadrzędna', type: 'select' },
      { key: 'kolor', label: 'Kolor', type: 'color' },
      { key: 'kolejnosc', label: 'Kolejność', type: 'number' },
      { key: 'opis', label: 'Opis', type: 'textarea' },
    ],
  }} />;
}
