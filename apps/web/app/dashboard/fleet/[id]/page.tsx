'use client';
import { EntityEditorPage, defaultTabs } from '../../../../components/EntityEditorPage';

export default function FleetVehicleEditorPage() {
  return <EntityEditorPage config={{
    moduleLabel: 'Flota',
    title: 'Edycja pojazdu',
    listHref: '/dashboard/fleet',
    getEndpoint: (id) => `/api/flota/pojazdy/${id}`,
    updateEndpoint: (id) => `/api/flota/pojazdy/${id}`,
    deleteEndpoint: (id) => `/api/flota/pojazdy/${id}`,
    tabs: defaultTabs.fleet,
    titleFromRecord: (r) => r.nazwa || r.nr_rejestracyjny || `Pojazd #${r.id}`,
    subtitleFromRecord: (r) => [r.nr_rejestracyjny, r.vin ? `VIN ${r.vin}` : null].filter(Boolean).join(' · '),
    fields: [
      { key: 'zdjecie', label: 'Zdjęcie pojazdu', type: 'image', colSpan: 'full' },
      { key: 'nazwa', label: 'Nazwa' },
      { key: 'nr_rejestracyjny', label: 'Nr rejestracyjny' },
      { key: 'marka', label: 'Marka' },
      { key: 'model', label: 'Model' },
      { key: 'rok_produkcji', label: 'Rok produkcji', type: 'number' },
      { key: 'vin', label: 'VIN' },
      { key: 'przebieg_km', label: 'Przebieg km', type: 'number' },
      { key: 'data_przegladu', label: 'Data przeglądu', type: 'date' },
      { key: 'data_oc', label: 'Data OC', type: 'date' },
      { key: 'numer_polisy_oc', label: 'Numer polisy OC' },
      { key: 'ubezpieczyciel', label: 'Ubezpieczyciel' },
      { key: 'ladownosc_kg', label: 'Ładowność kg', type: 'number' },
      { key: 'objetosc_m3', label: 'Objętość m³', type: 'number' },
      { key: 'notatki', label: 'Notatki', type: 'textarea' },
    ],
  }} />;
}