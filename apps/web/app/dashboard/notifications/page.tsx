'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Bell, 
  Send, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Plus, 
  Users, 
  Filter, 
  Repeat, 
  ShieldAlert, 
  Loader2, 
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { api } from '../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../components/ProductUI';
import { SimpleModal } from '../../../components/SimpleModal';

export default function NotificationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'historia' | 'cykliczne'>('historia');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [cyclicRules, setCyclicRules] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  // Filtry historii
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modale
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCyclicModal, setShowCyclicModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Formularze
  const [manualForm, setManualForm] = useState<any>({
    priorytet: 'normalny',
    dla_wszystkich: true,
    odbiorcy_ids: [],
    tytul: '',
    tresc: '',
    link: '',
  });

  const [cyclicForm, setCyclicForm] = useState<any>({
    priorytet: 'normalny',
    cykl: 'codziennie',
    godzina: '08:00',
    dla_wszystkich: true,
    odbiorcy_ids: [],
    tytul: '',
    tresc: '',
  });

  async function loadData() {
    setLoading(true);
    try {
      const [nRes, cRes, uRes] = await Promise.all([
        api.get('/api/powiadomienia?limit=100'),
        api.get('/api/powiadomienia/cykliczne'),
        api.get('/api/slowniki/uzytkownicy').catch(() => ({ data: [] })),
      ]);
      setNotifications(nRes.data?.items || []);
      setCyclicRules(cRes.data || []);
      setUsers(uRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n: any) => {
      if (filterPriority !== 'all' && n.priorytet !== filterPriority) return false;
      if (filterType !== 'all' && n.typ !== filterType) return false;
      if (filterStatus === 'unread' && n.przeczytane) return false;
      if (filterStatus === 'read' && !n.przeczytane) return false;
      return true;
    });
  }, [notifications, filterPriority, filterType, filterStatus]);

  async function handleSendManual(e: any) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/api/powiadomienia/reczne', manualForm);
      setShowManualModal(false);
      setManualForm({ priorytet: 'normalny', dla_wszystkich: true, odbiorcy_ids: [], tytul: '', tresc: '', link: '' });
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Błąd wysyłki powiadomienia.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCyclic(e: any) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/api/powiadomienia/cykliczne', cyclicForm);
      setShowCyclicModal(false);
      setCyclicForm({ priorytet: 'normalny', cykl: 'codziennie', godzina: '08:00', dla_wszystkich: true, odbiorcy_ids: [], tytul: '', tresc: '' });
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Błąd zapisu reguły cyklicznej.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteNotification(id: number) {
    try {
      await api.delete(`/api/powiadomienia/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  }

  async function handleDeleteCyclicRule(id: number) {
    if (!confirm('Usunąć tę regułę powiadomień cyklicznych?')) return;
    try {
      await api.delete(`/api/powiadomienia/cykliczne/${id}`);
      setCyclicRules((prev) => prev.filter((r) => r.id !== id));
    } catch {}
  }

  async function handleMarkRead(id: number) {
    try {
      await api.patch(`/api/powiadomienia/${id}/read`);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, przeczytane: true } : n));
    } catch {}
  }

  return (
    <div className="mx-auto max-w-[1700px] space-y-6 animate-fade-in-up">
      <PageTitle
        eyebrow="Komunikacja"
        title="Centrum Powiadomień i Alertów"
        description="Zarządzaj komunikatami wewnętrznymi, alertami serwisowymi i flotowymi, twórz powiadomienia masowe do pracowników oraz harmonogramy cykliczne."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setShowCyclicModal(true)}>
              <Repeat size={16} className="inline mr-1 text-cyan-600" /> Dodaj powiadomienie cykliczne
            </Button>
            <Button onClick={() => setShowManualModal(true)}>
              <Send size={16} className="inline mr-1" /> Wyślij powiadomienie do zespołu
            </Button>
          </div>
        }
      />

      {/* ZAKŁADKI GŁÓWNE */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
        <button
          onClick={() => setActiveTab('historia')}
          className={`px-5 py-2.5 rounded-xl font-black text-sm transition ${
            activeTab === 'historia'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
          }`}
        >
          Historia i Alerty ({notifications.length})
        </button>
        <button
          onClick={() => setActiveTab('cykliczne')}
          className={`px-5 py-2.5 rounded-xl font-black text-sm transition ${
            activeTab === 'cykliczne'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
          }`}
        >
          Powiadomienia Cykliczne ({cyclicRules.length})
        </button>
      </div>

      {activeTab === 'historia' && (
        <div className="space-y-4">
          {/* FILTRY */}
          <Card className="!p-4">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <select className={inputClass} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
                  <option value="all">Wszystkie priorytety</option>
                  <option value="krytyczny">Priorytet: Krytyczny</option>
                  <option value="wysoki">Priorytet: Wysoki</option>
                  <option value="normalny">Priorytet: Normalny</option>
                  <option value="niski">Priorytet: Niski</option>
                </select>

                <select className={inputClass} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="all">Wszystkie typy</option>
                  <option value="manual">Komunikaty ręczne</option>
                  <option value="fleet">Flota (SKP/OC)</option>
                  <option value="service">Serwis sprzętu</option>
                  <option value="event">Wydarzenia</option>
                  <option value="task">Zadania</option>
                </select>

                <select className={inputClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="all">Wszystkie statusy</option>
                  <option value="unread">Tylko nieprzeczytane</option>
                  <option value="read">Przeczytane</option>
                </select>
              </div>

              <span className="text-xs font-black text-slate-400">
                Wyświetlono: {filteredNotifications.length} pozycji
              </span>
            </div>
          </Card>

          {/* LISTA POWIADOMIEŃ */}
          <div className="space-y-3">
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-cyan-600 w-8 h-8" /></div>
            ) : filteredNotifications.map((n: any) => {
              const isCrit = n.priorytet === 'krytyczny';
              const isHigh = n.priorytet === 'wysoki';

              return (
                <div
                  key={n.id}
                  className={`rounded-2xl border p-5 transition-all shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    !n.przeczytane
                      ? 'bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800/60'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10'
                  }`}
                >
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className={`p-3 rounded-2xl shrink-0 ${
                      isCrit ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400' :
                      isHigh ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' :
                      'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-[#04e0ff]'
                    }`}>
                      {isCrit ? <AlertTriangle size={20} /> : isHigh ? <Clock size={20} /> : <Bell size={20} />}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          isCrit ? 'bg-rose-600 text-white' :
                          isHigh ? 'bg-amber-500 text-white' :
                          'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          {n.priorytet}
                        </span>

                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {n.tytul}
                        </span>

                        {n.nadawca && (
                          <span className="text-[11px] font-semibold text-slate-400">
                            od: {n.nadawca.imie} {n.nadawca.nazwisko}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {n.tresc}
                      </p>

                      <p className="text-[10px] font-bold text-slate-400">
                        {new Date(n.data_utworzenia).toLocaleString('pl-PL')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {n.link && (
                      <Button variant="secondary" onClick={() => { handleMarkRead(n.id); router.push(n.link); }}>
                        <ExternalLink size={14} className="inline mr-1" /> Otwórz moduł
                      </Button>
                    )}
                    {!n.przeczytane && (
                      <button onClick={() => handleMarkRead(n.id)} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-xl transition" title="Oznacz jako przeczytane">
                        <CheckCircle2 size={18} />
                      </button>
                    )}
                    <button onClick={() => handleDeleteNotification(n.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition" title="Usuń">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

            {!loading && filteredNotifications.length === 0 && (
              <div className="p-12 border border-dashed border-slate-200 dark:border-white/10 rounded-3xl text-center text-slate-400 font-bold bg-slate-50/50 dark:bg-black/20">
                Brak powiadomień spełniających wybrane kryteria.
              </div>
            )}
          </div>
        </div>
      )}

      {/* POWIADOMIENIA CYKLICZNE */}
      {activeTab === 'cykliczne' && (
        <Card className="space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-white/5 pb-4">
            <div>
              <h3 className="font-black text-lg text-slate-900 dark:text-white">Aktywne reguły powiadomień cyklicznych</h3>
              <p className="text-xs font-bold text-slate-500">Automatyczne przypomnienia generowane w zadanym harmonogramie dla zespołu.</p>
            </div>
            <Button onClick={() => setShowCyclicModal(true)}><Plus size={16} className="inline mr-1" /> Nowa reguła</Button>
          </div>

          <div className="space-y-3">
            {cyclicRules.map((rule: any) => (
              <div key={rule.id} className="rounded-2xl border border-slate-200 dark:border-white/10 p-5 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-[#04e0ff] text-xs font-black px-2.5 py-1">
                      Cykl: {rule.cykl} ({rule.godzina})
                    </span>
                    <span className="font-black text-slate-900 dark:text-white text-sm">{rule.tytul}</span>
                  </div>
                  <p className="text-xs font-medium text-slate-500 mt-1">{rule.tresc}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-2">
                    Odbiorcy: {rule.dla_wszystkich ? 'Cała firma' : `Wybrane osoby (${rule.odbiorcy_ids?.length || 0})`}
                  </p>
                </div>

                <button onClick={() => handleDeleteCyclicRule(rule.id)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition" title="Usuń regułę">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            {cyclicRules.length === 0 && (
              <div className="p-10 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center text-slate-400 font-bold">
                Brak zdefiniowanych powiadomień cyklicznych.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* MODAL WYSYŁKI RĘCZNEJ */}
      {showManualModal && (
        <SimpleModal title="Wyślij powiadomienie do zespołu" onClose={() => setShowManualModal(false)}>
          <form onSubmit={handleSendManual} className="space-y-4">
            <Field label="Tytuł powiadomienia *">
              <input className={inputClass} required value={manualForm.tytul} onChange={(e) => setManualForm({ ...manualForm, tytul: e.target.value })} placeholder="np. Pilna odprawa techniczna / Zmiana grafiku" />
            </Field>

            <Field label="Treść komunikatu *">
              <textarea required className={`${inputClass} min-h-[100px]`} value={manualForm.tresc} onChange={(e) => setManualForm({ ...manualForm, tresc: e.target.value })} placeholder="Wpisz pełną treść powiadomienia dla pracowników..." />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Priorytet ważności">
                <select className={inputClass} value={manualForm.priorytet} onChange={(e) => setManualForm({ ...manualForm, priorytet: e.target.value })}>
                  <option value="niski">Niski (Informacyjny)</option>
                  <option value="normalny">Normalny</option>
                  <option value="wysoki">Wysoki (Ważne)</option>
                  <option value="krytyczny">Krytyczny (Alarm natychmiastowy)</option>
                </select>
              </Field>

              <Field label="Link docelowy (Opcjonalnie)">
                <input className={inputClass} value={manualForm.link} onChange={(e) => setManualForm({ ...manualForm, link: e.target.value })} placeholder="np. /dashboard/events/12" />
              </Field>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4 space-y-3 bg-slate-50 dark:bg-white/5">
              <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                <input type="checkbox" checked={manualForm.dla_wszystkich} onChange={(e) => setManualForm({ ...manualForm, dla_wszystkich: e.target.checked })} className="w-4 h-4 rounded text-cyan-600" />
                Wyślij do wszystkich pracowników w firmie
              </label>

              {!manualForm.dla_wszystkich && (
                <div className="pt-2">
                  <p className="text-xs font-bold text-slate-500 mb-2">Zaznacz konkretnych odbiorców:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {users.map((u: any) => {
                      const isSelected = manualForm.odbiorcy_ids.includes(u.id);
                      return (
                        <label key={u.id} className="flex items-center gap-2 text-xs font-semibold p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const arr = manualForm.odbiorcy_ids;
                              setManualForm({
                                ...manualForm,
                                odbiorcy_ids: isSelected ? arr.filter((x: number) => x !== u.id) : [...arr, u.id],
                              });
                            }}
                            className="rounded text-cyan-600"
                          />
                          {u.imie} {u.nazwisko} ({u.email})
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-white/10">
              <Button variant="secondary" type="button" onClick={() => setShowManualModal(false)} disabled={saving}>Anuluj</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Wysyłanie...' : 'Wyślij komunikat'}</Button>
            </div>
          </form>
        </SimpleModal>
      )}

      {/* MODAL POWIADOMIENIA CYKLICZNEGO */}
      {showCyclicModal && (
        <SimpleModal title="Utwórz powiadomienie cykliczne" onClose={() => setShowCyclicModal(false)}>
          <form onSubmit={handleCreateCyclic} className="space-y-4">
            <Field label="Tytuł reguły *">
              <input className={inputClass} required value={cyclicForm.tytul} onChange={(e) => setCyclicForm({ ...cyclicForm, tytul: e.target.value })} placeholder="np. Poranne przypomnienie o WZ / Raport magazynowy" />
            </Field>

            <Field label="Treść powiadomienia *">
              <textarea required className={`${inputClass} min-h-[90px]`} value={cyclicForm.tresc} onChange={(e) => setCyclicForm({ ...cyclicForm, tresc: e.target.value })} placeholder="Treść komunikatu..." />
            </Field>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Częstotliwość">
                <select className={inputClass} value={cyclicForm.cykl} onChange={(e) => setCyclicForm({ ...cyclicForm, cykl: e.target.value })}>
                  <option value="codziennie">Codziennie</option>
                  <option value="co_tydzien">Co tydzień</option>
                  <option value="co_miesiac">Co miesiąc</option>
                </select>
              </Field>

              <Field label="Godzina uruchomienia">
                <input type="time" className={inputClass} value={cyclicForm.godzina} onChange={(e) => setCyclicForm({ ...cyclicForm, godzina: e.target.value })} required />
              </Field>

              <Field label="Priorytet">
                <select className={inputClass} value={cyclicForm.priorytet} onChange={(e) => setCyclicForm({ ...cyclicForm, priorytet: e.target.value })}>
                  <option value="niski">Niski</option>
                  <option value="normalny">Normalny</option>
                  <option value="wysoki">Wysoki</option>
                  <option value="krytyczny">Krytyczny</option>
                </select>
              </Field>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-white/10">
              <Button variant="secondary" type="button" onClick={() => setShowCyclicModal(false)} disabled={saving}>Anuluj</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Zapisywanie...' : 'Zapisz regułę cykliczną'}</Button>
            </div>
          </form>
        </SimpleModal>
      )}
    </div>
  );
}