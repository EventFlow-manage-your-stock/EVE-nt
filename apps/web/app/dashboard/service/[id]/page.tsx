'use client';
import { EntityEditorPage, defaultTabs } from '../../../../components/EntityEditorPage';

export default function ServiceTicketEditorPage() {
  return <EntityEditorPage config={{
    moduleLabel: 'Serwis',
    title: 'Edycja zgłoszenia serwisowego',
    listHref: '/dashboard/service',
    getEndpoint: (id) => `/api/serwis/${id}`,
    updateEndpoint: (id) => `/api/serwis/${id}`,
    dictionaries: { id_statusu_serwisu: '/api/serwis/statusy' },
    tabs: defaultTabs.service,
    titleFromRecord: (r) => r.tytul || `Zgłoszenie #${r.id}`,
    subtitleFromRecord: (r) => [r.egzemplarz?.model?.nazwa, r.egzemplarz?.nazwa].filter(Boolean).join(' · '),
    fields: [
      { key: 'tytul', label: 'Tytuł' },
      { key: 'id_statusu_serwisu', label: 'Status zgłoszenia', type: 'select' },
      { key: 'opis', label: 'Opis usterki', type: 'textarea' },
      { key: 'rozwiazanie', label: 'Rozwiązanie', type: 'textarea' },
      { key: 'czy_rozwiazane', label: 'Zgłoszenie rozwiązane', type: 'checkbox' },
      { key: 'status_serwisowy_sprzetu', label: 'Status sprzętu po zapisie' },
    ],
  }} />;
}
