'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, QrCode } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../components/ProductUI';
import { DataTable } from '../../../../components/DataTable';
import { SimpleModal } from '../../../../components/SimpleModal';
import { PrintLabelsModal } from '../../../../components/PrintLabelsModal';

export default function ItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [view, setView] = useState<'sprzet'|'opakowanie'|'wszystkie'>('sprzet');
  const [magazyny, setMagazyny] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false); // NOWY STAN
  const [form, setForm] = useState<any>({status_serwisowy:'Działa'});
  const [selected, setSelected] = useState<number[]>([]);

  async function load() {
    const [i,m,mag] = await Promise.all([
      api.get('/api/magazyn/wszystkie-egzemplarze'),
      api.get('/api/magazyn/modele'),
      api.get('/api/magazyn/slowniki/magazyny').catch(()=>({data:[]}))
    ]);
    setItems(i.data||[]); setModels(m.data||[]); setMagazyny(mag.data||[]);
  }
  
  useEffect(() => { load() }, []);

  const visibleItems = useMemo(()=>items.filter((x:any)=>view==='wszystkie'||x.model?.typ_sprzetu===view),[items,view]);
  const currentModel = useMemo(()=>models.find((m:any)=>String(m.id)===String(form.id_modelu)),[models,form.id_modelu]);

  useEffect(()=>{
    if(currentModel){
      const count=items.filter((i:any)=>String(i.id_modelu)===String(currentModel.id)).length+1;
      const code=`EF-${currentModel.id}-${count}`;
      setForm((f:any)=>({...f,nazwa:f.nazwa||currentModel.nazwa,numer_egzemplarza:f.numer_egzemplarza||String(count),numer_urzadzenia:f.numer_urzadzenia||String(count),wartosc:f.wartosc||currentModel.wartosc_domyslna_egzemplarza||currentModel.wartosc||'',zewnetrzny_kod_kreskowy:f.zewnetrzny_kod_kreskowy||code,zewnetrzny_qr_kod:f.zewnetrzny_qr_kod||code,kod_kreskowy:f.kod_kreskowy||code,qr_kod:f.qr_kod||code}));
    }
  },[currentModel?.id]);

  async function save(e:any){
    e.preventDefault(); 
    if(!form.id_modelu) return alert('Wybierz model.'); 
    await api.post(`/api/magazyn/modele/${form.id_modelu}/egzemplarze`,form); 
    setShow(false); setForm({status_serwisowy:'Działa'}); load();
  }

  function handleOpenPrintModal() {
    // Jeśli nic nie zaznaczono, pobieramy ID wszystkich aktualnie widocznych w tabeli
    if (selected.length === 0 && visibleItems.length > 0) {
      setSelected(visibleItems.map((i: any) => i.id));
    }
    setShowPrintModal(true);
  }

  return (
    <div className="mx-auto max-w-[1650px] space-y-6">
      <PageTitle 
        eyebrow="Magazyn" 
        title="Egzemplarze fizyczne" 
        description="Dodawanie egzemplarza przez wybór modelu, z kodem kreskowym/QR na egzemplarzu." 
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleOpenPrintModal} disabled={visibleItems.length === 0}>
              <QrCode size={16} className="inline mr-1" /> 
              Generuj naklejki {selected.length > 0 ? `(${selected.length})` : ''}
            </Button>
            <Button onClick={()=>setShow(true)}><Plus size={16} className="inline mr-1"/> Dodaj</Button>
          </div>
        }
      />
      <Card className="!p-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={()=>setView('sprzet')} className={`rounded-xl px-4 py-2 text-sm font-black ${view==='sprzet'?'bg-cyan-600 text-white shadow':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Sprzęt</button>
          <button onClick={()=>setView('opakowanie')} className={`rounded-xl px-4 py-2 text-sm font-black ${view==='opakowanie'?'bg-cyan-600 text-white shadow':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Opakowania/case</button>
          <button onClick={()=>setView('wszystkie')} className={`rounded-xl px-4 py-2 text-sm font-black ${view==='wszystkie'?'bg-cyan-600 text-white shadow':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Wszystkie</button>
        </div>
      </Card>
      
      <Card>
        <DataTable 
          rows={visibleItems} 
          onRowClick={(r:any)=>router.push(`/dashboard/warehouse/items/${r.id}`)} 
          columns={[
            {key:'select',label:'',value:(r:any)=><input type="checkbox" checked={selected.includes(r.id)} onChange={(e)=>setSelected(s=>e.target.checked?[...s,r.id]:s.filter(x=>x!==r.id))} onClick={e=>e.stopPropagation()}/>},
            {key:'nazwa',label:'Nazwa egzemplarza',value:(r:any)=><b>{r.nazwa || r.model?.nazwa || '-'}</b>},
            {key:'model',label:'Model',value:(r:any)=>r.model?.nazwa||'-'},
            {key:'kategoria',label:'Kategoria',value:(r:any)=>r.model?.kategoria?.nazwa||'-'},
            {key:'numer',label:'Nr',value:(r:any)=>r.numer_egzemplarza || r.numer_urzadzenia || '-'},
            {key:'kod_kreskowy',label:'Kod kreskowy', value: (r: any) => <span className="font-mono">{r.kod_kreskowy || r.zewnetrzny_kod_kreskowy || '-'}</span>},
            {key:'qr_kod',label:'QR', value: (r: any) => <span className="font-mono">{r.qr_kod || r.zewnetrzny_qr_kod || '-'}</span>},
            {key:'status_serwisowy',label:'Status'}
          ]}
        />
      </Card>

      {/* NASZ NOWY MODAL DRUKU */}
      <PrintLabelsModal 
        isOpen={showPrintModal} 
        onClose={() => { setShowPrintModal(false); setSelected([]); }} 
        ids={selected} 
      />

      {show && (
        <SimpleModal title="Dodaj egzemplarz" onClose={()=>setShow(false)}>
           <form onSubmit={save} className="space-y-5"><Field label="Model"><select className={inputClass} required value={form.id_modelu||''} onChange={e=>setForm({status_serwisowy:'Działa',id_modelu:e.target.value})}><option value="">Wybierz model</option>{models.map((m:any)=><option key={m.id} value={m.id}>{m.nazwa}</option>)}</select></Field><div className="grid gap-4 md:grid-cols-2"><Field label="Nazwa egzemplarza"><input className={inputClass} value={form.nazwa||''} onChange={e=>setForm({...form,nazwa:e.target.value})}/></Field><Field label="Numer egzemplarza"><input className={inputClass} value={form.numer_egzemplarza||''} onChange={e=>setForm({...form,numer_egzemplarza:e.target.value,numer_urzadzenia:e.target.value})}/></Field><Field label="S/N"><input className={inputClass} value={form.sn||''} onChange={e=>setForm({...form,sn:e.target.value})}/></Field><Field label="Data produkcji"><input type="date" className={inputClass} value={form.data_produkcji||''} onChange={e=>setForm({...form,data_produkcji:e.target.value})}/></Field></div><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={!!form.rozroznij_kod_qr} onChange={e=>setForm({...form,rozroznij_kod_qr:e.target.checked,zewnetrzny_qr_kod:e.target.checked?form.zewnetrzny_qr_kod:form.zewnetrzny_kod_kreskowy})}/> Rozróżnij zewnętrzny kod kreskowy i QR</label><div className="grid gap-4 md:grid-cols-2"><Field label="Zewnętrzny kod kreskowy"><input className={inputClass} value={form.zewnetrzny_kod_kreskowy||''} onChange={e=>setForm({...form,zewnetrzny_kod_kreskowy:e.target.value,kod_kreskowy:e.target.value,zewnetrzny_qr_kod:form.rozroznij_kod_qr?form.zewnetrzny_qr_kod:e.target.value,qr_kod:form.rozroznij_kod_qr?form.qr_kod:e.target.value})}/></Field><Field label="Zewnętrzny kod QR"><input className={inputClass} disabled={!form.rozroznij_kod_qr} value={form.zewnetrzny_qr_kod||''} onChange={e=>setForm({...form,zewnetrzny_qr_kod:e.target.value,qr_kod:e.target.value})}/></Field><Field label="Wartość"><input type="number" step="0.01" className={inputClass} value={form.wartosc||''} onChange={e=>setForm({...form,wartosc:e.target.value})}/></Field><Field label="Magazyn"><select className={inputClass} value={form.id_magazynu||''} onChange={e=>setForm({...form,id_magazynu:e.target.value})}><option value="">Brak</option>{magazyny.map((m:any)=><option key={m.id} value={m.id}>{m.nazwa}</option>)}</select></Field></div><Field label="Uwagi"><textarea className={inputClass} value={form.opis||''} onChange={e=>setForm({...form,opis:e.target.value})}/></Field><div className="flex justify-end gap-2"><Button variant="secondary" onClick={()=>setShow(false)}>Anuluj</Button><Button type="submit">Zapisz</Button></div></form>
        </SimpleModal>
      )}
    </div>
  );
}