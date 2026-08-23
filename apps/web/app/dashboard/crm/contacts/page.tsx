'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, PageTitle } from '../../../../components/ProductUI';
import { DataTable } from '../../../../components/DataTable';

export default function ContactsListPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/api/crm/kontakty');
      setItems(res.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="mx-auto max-w-[1650px] space-y-6 animate-fade-in-up">
      <PageTitle
        eyebrow="CRM"
        title="Osoby Kontaktowe"
        description="Katalog wizytówek przypisanych do Twoich Klientów i Podwykonawców. Przejdź w szczegóły, by zobaczyć powiązane z nimi projekty."
        action={<Button onClick={() => router.push('/dashboard/crm/contacts/new')}><Plus size={16} className="inline mr-1" /> Dodaj nowy kontakt</Button>}
      />
      <Card className="!p-0 border-transparent bg-transparent shadow-none">
        {loading ? <p className="p-8 text-center font-bold text-slate-400">Pobieranie kontaktów...</p> : (
          <DataTable
            rows={items}
            searchPlaceholder="Szukaj imienia, stanowiska, telefonu..."
            onRowClick={(r: any) => router.push(`/dashboard/crm/contacts/${r.id}`)}
            columns={[
              { key: 'imie', label: 'Imię i nazwisko', value: (r: any) => <b className="text-cyan-700">{r.imie} {r.nazwisko}</b> },
              { key: 'kontrahent', label: 'Firma / Kontrahent', value: (r: any) => r.kontrahent?.nazwa ? <span className="font-black text-slate-800">{r.kontrahent.nazwa}</span> : <span className="text-slate-400 font-semibold">Brak przypisania</span> },
              { key: 'stanowisko', label: 'Stanowisko', value: (r: any) => r.stanowisko || '-' },
              { key: 'email', label: 'E-mail', value: (r: any) => r.email || '-' },
              { key: 'telefon', label: 'Telefon', value: (r: any) => r.telefon || '-' },
              { key: 'glowny', label: 'Typ', value: (r: any) => r.glowny ? <span className="rounded bg-amber-100 text-amber-700 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm">Główny</span> : '-' }
            ]}
          />
        )}
      </Card>
    </div>
  );
}