'use client';

import { useEffect, useState } from 'react';
import { Shield, Plus, Save, Trash2, CheckCircle2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../components/ProductUI';
import { PERMISSIONS_LIST, PERMISSION_GROUPS } from '../../../../lib/permissions';

export default function PermissionsPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [form, setForm] = useState<any>({ nazwa: '', opis: '', uprawnienia: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    const r = await api.get('/api/ustawienia/role');
    setRoles(r.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function selectRole(role: any) {
    setSelectedRole(role);
    setForm({
      nazwa: role.nazwa,
      opis: role.opis || '',
      uprawnienia: role.uprawnienia || [],
    });
    setNotice('');
  }

  function createNew() {
    setSelectedRole({ id: 'new' });
    setForm({ nazwa: '', opis: '', uprawnienia: [] });
    setNotice('');
  }

  const togglePermission = (id: string) => {
    setForm((prev: any) => {
      const perms = prev.uprawnienia || [];
      return {
        ...prev,
        uprawnienia: perms.includes(id) ? perms.filter((p: string) => p !== id) : [...perms, id]
      };
    });
  };

  async function saveRole(e: any) {
    e.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      if (selectedRole.id === 'new') {
        await api.post('/api/ustawienia/role', form);
      } else {
        await api.put(`/api/ustawienia/role/${selectedRole.id}`, form);
      }
      setNotice('Zapisano rolę z powodzeniem.');
      await load();
      if (selectedRole.id === 'new') setSelectedRole(null);
    } catch (err) {
      alert('Wystąpił błąd podczas zapisywania.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole() {
    if (!confirm('Na pewno usunąć tę rolę? Użytkownicy stracą powiązane z nią dostępy.')) return;
    try {
      await api.delete(`/api/ustawienia/role/${selectedRole.id}`);
      setSelectedRole(null);
      load();
    } catch (err) {
      alert('Nie udało się usunąć roli.');
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageTitle 
        eyebrow="Ustawienia / Bezpieczeństwo" 
        title="Role i Uprawnienia (ACL)" 
        description="Zarządzaj dostępami do poszczególnych modułów. Role grupują uprawnienia, a następnie są przypisywane użytkownikom." 
      />

      <div className="grid gap-6 xl:grid-cols-[320px_1fr] items-start">
        {/* LEWY PANEL - LISTA RÓL */}
        <Card className="!p-0 overflow-hidden shadow-sm flex flex-col h-[calc(100vh-200px)]">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-black text-slate-800 flex items-center gap-2"><Shield size={16} className="text-cyan-600"/> Zdefiniowane role</h2>
            <button onClick={createNew} className="p-2 bg-cyan-100 text-cyan-700 rounded-lg hover:bg-cyan-200 transition" title="Nowa rola"><Plus size={16}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {loading ? <p className="text-center text-sm font-bold text-slate-400 mt-10">Ładowanie...</p> : roles.map((r) => (
              <button 
                key={r.id} 
                onClick={() => selectRole(r)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedRole?.id === r.id ? 'bg-cyan-600 text-white border-cyan-700 shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-cyan-300'}`}
              >
                <p className="font-black truncate">{r.nazwa}</p>
                <p className={`text-[11px] font-semibold mt-1 ${selectedRole?.id === r.id ? 'text-cyan-100' : 'text-slate-400'}`}>Zezwoleń: {(r.uprawnienia || []).length}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* PRAWY PANEL - EDYTOR ROLI */}
        <Card className="h-full min-h-[calc(100vh-200px)] shadow-sm flex flex-col">
          {selectedRole ? (
            <form onSubmit={saveRole} className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">{selectedRole.id === 'new' ? 'Kreator nowej roli' : `Edycja roli: ${form.nazwa}`}</h2>
                  {notice && <p className="text-sm font-bold text-emerald-600 mt-2 flex items-center gap-1.5"><CheckCircle2 size={16}/> {notice}</p>}
                </div>
                <div className="flex gap-2">
                  {selectedRole.id !== 'new' && <Button variant="danger" type="button" onClick={deleteRole}><Trash2 size={16} className="inline mr-1"/> Usuń</Button>}
                  <Button type="submit" disabled={saving}><Save size={16} className="inline mr-1"/> Zapisz uprawnienia</Button>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 mb-8">
                <Field label="Nazwa roli (np. Magazynier, Handlowiec)"><input className={inputClass} value={form.nazwa} onChange={e => setForm({...form, nazwa: e.target.value})} required/></Field>
                <Field label="Krótki opis (co ta rola potrafi?)"><input className={inputClass} value={form.opis} onChange={e => setForm({...form, opis: e.target.value})} /></Field>
              </div>

              <div className="flex-1 overflow-y-auto">
                <h3 className="text-[13px] font-black uppercase text-slate-400 tracking-wider mb-4">Matryca Zezwoleń</h3>
                <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                      <p className="font-black text-slate-800 border-b border-slate-200 pb-2 mb-3">{group}</p>
                      <div className="space-y-2.5">
                        {PERMISSIONS_LIST.filter(p => p.group === group).map(perm => {
                          const isChecked = form.uprawnienia.includes(perm.id);
                          return (
                            <label key={perm.id} className="flex items-start gap-3 cursor-pointer group hover:bg-slate-100 p-1.5 -mx-1.5 rounded-lg transition">
                              <input type="checkbox" checked={isChecked} onChange={() => togglePermission(perm.id)} className="mt-0.5 w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer" />
                              <div className="select-none">
                                <p className={`text-sm font-bold transition-colors ${isChecked ? 'text-cyan-800' : 'text-slate-600 group-hover:text-slate-900'}`}>{perm.label}</p>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{perm.id}</p>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
              <Shield size={64} className="text-slate-200 mb-4" />
              <h3 className="text-xl font-black text-slate-500">Wybierz rolę z listy po lewej</h3>
              <p className="text-sm font-bold text-slate-400 mt-2 max-w-md">Możesz stworzyć nowe role dopasowane do struktury Twojej firmy, a następnie włączyć im tylko określone sekcje i przyciski w systemie.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}