'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Car } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../components/ProductUI';
import { DataTable } from '../../../components/DataTable';
import { SimpleModal } from '../../../components/SimpleModal';

function d(v:any){return v?new Date(v).toLocaleDateString('pl-PL'):'-'}
function num(v:any){return v === '' || v == null ? null : Number(v)}
function payload(form:any){return {...form, przebieg_km:num(form.przebieg_km), rok_produkcji:num(form.rok_produkcji), ladownosc_kg:num(form.ladownosc_kg), objetosc_m3:num(form.objetosc_m3), zdjecie: form.zdjecie || null}}

export default function FleetPage(){
  const router = useRouter();
  const [items,setItems]=useState<any[]>([]); 
  const [show,setShow]=useState(false); 
  const [form,setForm]=useState<any>({}); 
  const [error,setError]=useState('');
  const [preview, setPreview] = useState('');

  async function load(){const r=await api.get('/api/flota/pojazdy').catch(()=>({data:[]})); setItems(r.data||[])}
  useEffect(()=>{load()},[]);

  const calendar = useMemo(()=>items.flatMap((p:any)=>[
    p.data_przegladu ? {id:`p-${p.id}`, date:p.data_przegladu, title:`Przegląd: ${p.nazwa}`} : null,
    p.data_oc ? {id:`oc-${p.id}`, date:p.data_oc, title:`OC: ${p.nazwa}`} : null,
    ...(p.serwisy_pojazdu||[]).map((s:any)=>({id:`s-${s.id}`, date:s.data_serwisu, title:`Serwis: ${p.nazwa}`})),
    ...(p.przeglady_pojazdu||[]).map((x:any)=>({id:`hist-${x.id}`, date:x.data_przegladu, title:`Przegląd ${x.typ}: ${p.nazwa}`})),
  ].filter(Boolean)),[items]);

  async function save(e:any){
    e.preventDefault(); 
    setError(''); 
    try{
      await api.post('/api/flota/pojazdy',payload(form)); 
      setShow(false); 
      setForm({}); 
      setPreview('');
      load();
    }catch(err:any){
      setError(err?.response?.data?.message || err.message || 'Nie udało się zapisać pojazdu.')
    }
  }

  async function updateRow(row:any){await api.put(`/api/flota/pojazdy/${row.id}`, payload(row)); await load();}

  return <div className="mx-auto max-w-[1650px] space-y-6">
    <PageTitle eyebrow="Flota" title="Pojazdy" description="Zarządzaj pojazdami firmowymi, rejestracjami, badaniami oraz przeglądami. Wyświetlane zdjęcia ułatwiają szybką identyfikację maszyn." action={<Button onClick={()=>setShow(true)}><Plus size={16} className="inline mr-1"/> Dodaj pojazd</Button>}/>
    
    <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
      <Card>
        <DataTable 
          rows={items} 
          onRowClick={(r:any)=>router.push(`/dashboard/fleet/${r.id}`)} 
          onSaveRow={updateRow} 
          columns={[
            {
              key: 'pojazd', 
              label: 'Pojazd i model', 
              value: (r:any) => (
                <div className="flex items-center gap-4 py-1">
                  <div className="h-12 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center shadow-sm">
                    {r.zdjecie ? (
                      <img src={r.zdjecie} alt={r.nazwa} className="h-full w-full object-cover" />
                    ) : (
                      <Car size={20} className="text-slate-300" />
                    )}
                  </div>
                  <div>
                    <b className="text-[14px] text-slate-900 group-hover:text-cyan-700 transition">{r.nazwa}</b>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">{r.marka || ''} {r.model || ''}</p>
                  </div>
                </div>
              )
            },
            {key:'nr_rejestracyjny',label:'Rejestracja', value: (r:any) => <span className="font-bold text-slate-700 uppercase">{r.nr_rejestracyjny}</span>},
            {key:'vin',label:'VIN', value: (r:any) => <span className="text-xs font-mono text-slate-400">{r.vin || '-'}</span>},
            {key:'przebieg_km',label:'Przebieg',value:(r:any)=>r.przebieg_km ? <span className="font-bold">{r.przebieg_km} <span className="text-xs text-slate-400 font-semibold">km</span></span> : '-'},
            {key:'data_przegladu',label:'Przegląd',value:(r:any)=>d(r.data_przegladu),sortValue:(r:any)=>r.data_przegladu},
            {key:'data_oc',label:'OC',value:(r:any)=>d(r.data_oc),sortValue:(r:any)=>r.data_oc},
            {key:'ladownosc_kg',label:'Ładowność', value: (r:any)=>r.ladownosc_kg ? `${r.ladownosc_kg} kg` : '-'}
          ]}
        />
      </Card>
      
      <Card>
        <h2 className="mb-4 text-lg font-black text-slate-900">Kalendarz floty</h2>
        <div className="space-y-3">
          {calendar.map((e:any)=><div key={e.id} className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 shadow-sm">
            <b className="text-sm text-cyan-900">{e.title}</b>
            <p className="text-xs font-bold text-cyan-700 mt-1">{d(e.date)} · Wpis informacyjny, nieedytowalny</p>
          </div>)}
          {calendar.length===0 && <p className="font-bold text-slate-400 border border-dashed border-slate-200 rounded-2xl p-6 text-center text-sm">Brak dat przeglądów, OC i serwisów.</p>}
        </div>
      </Card>
    </div>
    
    {show&&<SimpleModal title="Dodaj nowy pojazd" onClose={()=>{setShow(false); setPreview(''); setForm({});}}>
      {error&&<div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
      <form onSubmit={save} className="space-y-5">
        
        <div className="flex flex-col sm:flex-row items-start gap-5 p-5 rounded-2xl bg-slate-50 border border-slate-200">
           <div className="aspect-video w-full sm:w-56 bg-white rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
              {preview || form.zdjecie ? <img src={preview || form.zdjecie} className="w-full h-full object-cover"/> : <Car size={32} className="text-slate-300"/>}
           </div>
           <div className="space-y-3 w-full pt-2">
              <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wider">Zdjęcie pojazdu</label>
              <input type="file" accept="image/*" onChange={async e => {
                 const file = e.target.files?.[0];
                 if(file) {
                    const reader = new FileReader();
                    reader.onload = () => { setPreview(reader.result as string); setForm({...form, zdjecie: reader.result}) };
                    reader.readAsDataURL(file);
                 }
              }} className="block w-full text-sm font-bold text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-600 file:px-4 file:py-2.5 file:font-black file:text-white cursor-pointer hover:file:bg-cyan-700 transition shadow-sm"/>
              <p className="text-xs font-semibold text-slate-400">Proporcje 16:9. Maks. waga to kilka megabajtów.</p>
           </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nazwa (Identyfikator wewn.) *"><input className={inputClass} required value={form.nazwa||''} onChange={e=>setForm({...form,nazwa:e.target.value})} placeholder="np. Bus Długi Ford"/></Field>
          <Field label="Nr rejestracyjny *"><input className={inputClass} required value={form.nr_rejestracyjny||''} onChange={e=>setForm({...form,nr_rejestracyjny:e.target.value})} placeholder="WZ 12345" className={`${inputClass} uppercase`}/></Field>
          <Field label="Marka"><input className={inputClass} value={form.marka||''} onChange={e=>setForm({...form,marka:e.target.value})} placeholder="np. Ford"/></Field>
          <Field label="Model"><input className={inputClass} value={form.model||''} onChange={e=>setForm({...form,model:e.target.value})} placeholder="np. Transit L4H3"/></Field>
          <Field label="Przebieg [km]"><input type="number" className={inputClass} value={form.przebieg_km||''} onChange={e=>setForm({...form,przebieg_km:e.target.value})}/></Field>
          <Field label="Rok produkcji"><input type="number" className={inputClass} value={form.rok_produkcji||''} onChange={e=>setForm({...form,rok_produkcji:e.target.value})}/></Field>
          <Field label="Numer VIN"><input className={inputClass} value={form.vin||''} onChange={e=>setForm({...form,vin:e.target.value})} className={`${inputClass} uppercase`}/></Field>
          <Field label="Polisa OC"><input className={inputClass} value={form.numer_polisy_oc||''} onChange={e=>setForm({...form,numer_polisy_oc:e.target.value})}/></Field>
          <Field label="Ważność przeglądu technicznego"><input type="date" className={inputClass} value={form.data_przegladu||''} onChange={e=>setForm({...form,data_przegladu:e.target.value})}/></Field>
          <Field label="Ważność ubezpieczenia OC"><input type="date" className={inputClass} value={form.data_oc||''} onChange={e=>setForm({...form,data_oc:e.target.value})}/></Field>
          <Field label="Ładowność [kg]"><input type="number" step="0.01" className={inputClass} value={form.ladownosc_kg||''} onChange={e=>setForm({...form,ladownosc_kg:e.target.value})}/></Field>
          <Field label="Pojemność / Kubatura [m3]"><input type="number" step="0.01" className={inputClass} value={form.objetosc_m3||''} onChange={e=>setForm({...form,objetosc_m3:e.target.value})}/></Field>
        </div>
        <Field label="Notatki i specyfikacja"><textarea className={`${inputClass} min-h-[100px]`} value={form.notatki||''} onChange={e=>setForm({...form,notatki:e.target.value})} placeholder="Dodatkowe informacje o pojeździe..."/></Field>
        
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={()=>{setShow(false); setPreview('');}}>Anuluj</Button>
          <Button type="submit">Zapisz nowy pojazd</Button>
        </div>
      </form>
    </SimpleModal>}
  </div>;
}