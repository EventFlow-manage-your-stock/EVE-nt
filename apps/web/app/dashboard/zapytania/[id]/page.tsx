'use client';

import { EntityEditorPage } from '../../../../components/EntityEditorPage';

export default function ZapytanieEditorPage() {
  return <EntityEditorPage config={{
    moduleLabel: 'Zapytania',
    title: 'Szczegóły zapytania',
    listHref: '/dashboard/zapytania',
    getEndpoint: (id) => `/api/zapytania/${id}`,
    createEndpoint: '/api/zapytania',
    updateEndpoint: (id) => `/api/zapytania/${id}`,
    deleteEndpoint: (id) => `/api/zapytania/${id}`,
    dictionaries: {
      id_kontrahenta: '/api/slowniki/kontrahenci', 
    },
    titleFromRecord: (r) => r.tytul || `Zapytanie #${r.id}`,
    fields: [
      { key: 'tytul', label: 'Tytuł zapytania' },
      { key: 'status', label: 'Status', type: 'select', options: [
        { id: 'nowe', nazwa: 'Nowe' },
        { id: 'w_wycenie', nazwa: 'W trakcie wyceny' },
        { id: 'wyslana', nazwa: 'Wycena wysłana' },
        { id: 'zaakceptowane', nazwa: 'Zaakceptowane' },
        { id: 'odrzucone', nazwa: 'Odrzucone' },
      ]},
      { 
        key: 'id_kontrahenta', 
        label: 'Kontrahent z bazy (Opcjonalnie)', 
        type: 'select', 
      },
      { key: 'kontrahent_reczny', label: 'Nazwa klienta (Jeśli nie ma go w bazie)' },
      { key: 'opis', label: 'Dodatkowe informacje / Notatki', type: 'textarea', colSpan: 'full' },
    ],
  }} />;
}