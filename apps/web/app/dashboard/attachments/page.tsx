'use client';

import { useEffect, useState, useMemo } from 'react';
import { Download, FileText, Link as LinkIcon, Trash2, Search, Clock, FileArchive } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button, Card, PageTitle, inputClass } from '../../../components/ProductUI';
import { DataTable } from '../../../components/DataTable';
import { SimpleModal } from '../../../components/SimpleModal';

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function AttachmentsGlobalPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [linkModal, setLinkModal] = useState<any>(null);
  const [generatedLink, setGeneratedLink] = useState('');
  const [expiresIn, setExpiresIn] = useState('3600'); // Domyślnie 1 godzina

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/api/storage/zalaczniki');
      setItems(res.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter((i) => 
      `${i.nazwa} ${i.nazwa_pliku} ${i.typ_obiektu}`.toLowerCase().includes(q)
    );
  }, [items, search]);

  async function handleDownload(id: number) {
    try {
      const res = await api.get(`/api/storage/download/${id}`);
      if (res.data?.url) window.open(res.data.url, '_blank');
    } catch (e: any) {
      alert('Błąd pobierania pliku.');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Na pewno usunąć ten plik trwale z chmury S3 i systemu? Operacja jest nieodwracalna.')) return;
    try {
      await api.delete(`/api/storage/zalaczniki/${id}`);
      load();
    } catch (e) {
      alert('Błąd usuwania pliku.');
    }
  }

  async function generateLink(e: any) {
    e.preventDefault();
    try {
      const res = await api.get(`/api/storage/download/${linkModal.id}?expiresIn=${expiresIn}`);
      setGeneratedLink(res.data.url);
    } catch (e) {
      alert('Błąd generowania linku.');
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageTitle 
        eyebrow="System" 
        title="Globalne Załączniki (Cloud)" 
        description="Wszystkie pliki wgrane do systemu (flota, wynajmy, wydarzenia, magazyn). Z poziomu tego modułu możesz zarządzać zajętym miejscem i generować linki dla klientów." 
      />
      
      <Card>
        <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input className={`${inputClass} pl-9`} placeholder="Szukaj pliku, nazwy lub powiązania..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-4 items-center">
            <div className="text-right">
               <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Razem plików</p>
               <p className="text-xl font-black text-cyan-700">{filtered.length}</p>
            </div>
            <div className="text-right border-l border-slate-200 pl-4">
               <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Zajętość dysku</p>
               <p className="text-xl font-black text-slate-900">{formatBytes(filtered.reduce((acc, curr) => acc + (curr.rozmiar_bajtow || 0), 0))}</p>
            </div>
          </div>
        </div>

        <DataTable 
          rows={filtered}
          empty="Brak wgranych załączników w chmurze."
          columns={[
            { key: 'nazwa', label: 'Nazwa pliku', value: (r) => <div className="flex items-center gap-3"><FileArchive size={20} className="text-indigo-500 shrink-0"/><div><b className="text-slate-900">{r.nazwa || r.nazwa_pliku}</b><p className="text-[11px] font-bold text-slate-500 mt-0.5 truncate">{r.nazwa_pliku}</p></div></div> },
            { key: 'rozmiar_bajtow', label: 'Rozmiar', value: (r) => <span className="font-bold text-slate-600">{formatBytes(r.rozmiar_bajtow)}</span> },
            { key: 'typ_obiektu', label: 'Moduł powiązany', value: (r) => <span className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-black text-slate-600 tracking-wider uppercase">{r.typ_obiektu} #{r.id_obiektu}</span> },
            { key: 'dodal', label: 'Wgrany przez', value: (r) => <span className="text-xs font-semibold text-slate-500">{r.dodal ? `${r.dodal.imie} ${r.dodal.nazwisko}` : 'System'}</span> },
            { key: 'data_utworzenia', label: 'Data uploadu', value: (r) => <span className="text-xs font-bold text-slate-500">{new Date(r.data_utworzenia).toLocaleString('pl-PL')}</span> },
            { key: 'akcje', label: 'Akcje', value: (r) => (
              <div className="flex gap-1 justify-end">
                <button onClick={(e) => { e.stopPropagation(); setLinkModal(r); setGeneratedLink(''); }} className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition" title="Wygeneruj publiczny link S3"><LinkIcon size={16}/></button>
                <button onClick={(e) => { e.stopPropagation(); handleDownload(r.id); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="Pobierz"><Download size={16}/></button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Usuń fizycznie z dysku"><Trash2 size={16}/></button>
              </div>
            )}
          ]}
        />
      </Card>

      {/* Modal generowania linków zewnętrznych */}
      {linkModal && (
        <SimpleModal title="Udostępnij plik" onClose={() => setLinkModal(null)}>
          <div className="space-y-5">
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
              <p className="text-[10px] font-black uppercase text-cyan-700 tracking-wider mb-1">Wybrany dokument</p>
              <p className="text-lg font-black text-slate-900 truncate">{linkModal.nazwa || linkModal.nazwa_pliku}</p>
            </div>
            
            {!generatedLink ? (
              <form onSubmit={generateLink} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3">Wybierz czas wygaśnięcia linku</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button type="button" onClick={() => setExpiresIn('3600')} className={`rounded-xl border p-4 text-sm font-black transition shadow-sm ${expiresIn === '3600' ? 'border-cyan-500 bg-cyan-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>1 godzina</button>
                    <button type="button" onClick={() => setExpiresIn('86400')} className={`rounded-xl border p-4 text-sm font-black transition shadow-sm ${expiresIn === '86400' ? 'border-cyan-500 bg-cyan-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>24 godziny</button>
                    <button type="button" onClick={() => setExpiresIn('604800')} className={`rounded-xl border p-4 text-sm font-black transition shadow-sm ${expiresIn === '604800' ? 'border-cyan-500 bg-cyan-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>7 dni</button>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <Button variant="secondary" onClick={() => setLinkModal(null)}>Anuluj</Button>
                  <Button type="submit"><LinkIcon size={16} className="inline mr-2"/> Wygeneruj link publiczny</Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 animate-fade-in-up">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                   <label className="block text-sm font-black text-emerald-800 mb-2">Gotowe! Skopiuj bezpieczny link do schowka</label>
                   <div className="flex gap-2">
                     <input className={inputClass} readOnly value={generatedLink} onFocus={(e) => e.target.select()} />
                     <Button onClick={() => { navigator.clipboard.writeText(generatedLink); alert('Link skopiowany do schowka!'); }}>Kopiuj</Button>
                   </div>
                </div>
                <p className="text-xs font-bold text-slate-500 flex items-center justify-center gap-1.5"><Clock size={14}/> Po ustalonym czasie link przestanie działać dla bezpieczeństwa danych.</p>
              </div>
            )}
          </div>
        </SimpleModal>
      )}
    </div>
  );
}