'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../components/ProductUI';
const defaults = [
  {nazwa:'Działa', kolor:'#22c55e', kolejnosc:1},
  {nazwa:'Wymaga serwisu (działa)', kolor:'#facc15', kolejnosc:2},
  {nazwa:'Wymaga serwisu (nie działa)', kolor:'#ef4444', kolejnosc:3},
  {nazwa:'W serwisie', kolor:'#2563eb', kolejnosc:4},
  {nazwa:'Naprawiony', kolor:'#16a34a', kolejnosc:5},
];
export default function ServiceStatusesPage(){
 const router = useRouter();
 const [items,setItems]=useState<any[]>([]); const [form,setForm]=useState<any>({kolor:'#ef4444'}); const [error,setError]=useState('');
 async function load(){const r=await api.get('/api/serwis/statusy'); setItems((r.data||[]).sort((a:any,b:any)=>Number(a.kolejnosc||0)-Number(b.kolejnosc||0)))}
 useEffect(()=>{load()},[]);
 async function save(e:any){e.preventDefault(); setError(''); try{await api.post('/api/serwis/statusy',{...form,kolejnosc: form.kolejnosc || items.length+1}); setForm({kolor:'#ef4444'}); load()}catch(err:any){setError(err?.response?.data?.message || err.message || 'Nie udało się dodać statusu.')}}
 async function seed(){for(const d of defaults){if(!items.some(i=>i.nazwa===d.nazwa)) await api.post('/api/serwis/statusy',d)} load()}
 async function update(id:number, data:any){await api.put(`/api/serwis/statusy/${id}`,data); load()}
 async function move(index:number, dir:-1|1){const a=items[index], b=items[index+dir]; if(!a||!b) return; await Promise.all([api.put(`/api/serwis/statusy/${a.id}`,{...a,kolejnosc:b.kolejnosc}), api.put(`/api/serwis/statusy/${b.id}`,{...b,kolejnosc:a.kolejnosc})]); load()}
 async function remove(s:any){if(!confirm(`Usunąć status "${s.nazwa}"?`)) return; await api.delete(`/api/serwis/statusy/${s.id}`); load()}
 return <div><PageTitle eyebrow="Serwis" title="Statusy serwisowe" description="Statusy można dodawać, edytować, usuwać i przesuwać względem kolejności." action={<Button variant="secondary" onClick={seed}>Ustaw domyślne statusy</Button>}/>{error&&<div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}<div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]"><Card><form onSubmit={save} className="space-y-3"><Field label="Nazwa"><input className={inputClass} value={form.nazwa||''} onChange={e=>setForm({...form,nazwa:e.target.value})} required/></Field><Field label="Kolor"><input type="color" className={inputClass} value={form.kolor||'#ef4444'} onChange={e=>setForm({...form,kolor:e.target.value})}/></Field><Field label="Kolejność"><input type="number" className={inputClass} value={form.kolejnosc||''} onChange={e=>setForm({...form,kolejnosc:e.target.value})}/></Field><Button type="submit">Dodaj status</Button></form></Card><Card>{items.map((s:any,index:number)=><div key={s.id} onDoubleClick={()=>router.push(`/dashboard/service/statuses/${s.id}`)} className="mb-2 grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border p-3 hover:bg-cyan-50"><div className="grid gap-3 md:grid-cols-[1fr_110px_110px]"><input className={inputClass} value={s.nazwa||''} onChange={e=>setItems(items.map(x=>x.id===s.id?{...x,nazwa:e.target.value}:x))} onBlur={()=>update(s.id,s)}/><input type="color" className={inputClass} value={s.kolor||'#ef4444'} onChange={e=>setItems(items.map(x=>x.id===s.id?{...x,kolor:e.target.value}:x))} onBlur={()=>update(s.id,s)}/><input type="number" className={inputClass} value={s.kolejnosc||0} onChange={e=>setItems(items.map(x=>x.id===s.id?{...x,kolejnosc:Number(e.target.value)}:x))} onBlur={()=>update(s.id,s)}/></div><div className="flex gap-1"><button className="rounded-lg border p-2 disabled:opacity-30" disabled={index===0} onClick={()=>move(index,-1)}><ArrowUp size={16}/></button><button className="rounded-lg border p-2 disabled:opacity-30" disabled={index===items.length-1} onClick={()=>move(index,1)}><ArrowDown size={16}/></button><button className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600" onClick={()=>remove(s)}><Trash2 size={16}/></button></div></div>)}</Card></div></div>
}
