'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { api } from '../../../../lib/api';
import { Button, Card, Field, inputClass, PageTitle } from '../../../../components/ProductUI';
import { SimpleModal } from '../../../../components/SimpleModal';

function flatten(items:any[], level=0): any[] { return items.flatMap(i => [{...i, level}, ...(i.dzieci ? flatten(i.dzieci, level+1) : [])]); }

export default function CategoriesPage(){
  const router = useRouter();
  const [items,setItems]=useState<any[]>([]); const [show,setShow]=useState(false); const [editing,setEditing]=useState<any>(null); const [form,setForm]=useState<any>({kolor:'#06B6D4'});
  async function load(){const r=await api.get('/api/magazyn/kategorie'); setItems(r.data||[])}
  useEffect(()=>{load()},[]);
  const flat = useMemo(()=>flatten(items),[items]);
  async function save(e:any){e.preventDefault(); if(editing) await api.put(`/api/magazyn/kategorie/${editing.id}`, form); else await api.post('/api/magazyn/kategorie', form); setShow(false); setEditing(null); setForm({kolor:'#06B6D4'}); load();}
  async function remove(id:number){ if(confirm('Usunąć kategorię? Podkategorie i modele zostają w bazie, ale kategoria zostanie ukryta.')) { await api.delete(`/api/magazyn/kategorie/${id}`); load(); } }
  async function move(cat:any, delta:number){ await api.put(`/api/magazyn/kategorie/${cat.id}`, {...cat, kolejnosc: Number(cat.kolejnosc||0)+delta}); load(); }
  function openAdd(parent?:any){ setEditing(null); setForm({kolor:'#06B6D4', id_rodzica: parent?.id || ''}); setShow(true); }
  function openEdit(cat:any){ router.push(`/dashboard/warehouse/categories/${cat.id}`); }
  return <div className="mx-auto max-w-[1300px] space-y-6"><PageTitle eyebrow="Magazyn" title="Kategorie sprzętu" description="Kategorie, podkategorie, usuwanie i ręczne ustawianie kolejności." action={<Button onClick={()=>openAdd()}><Plus size={16} className="inline"/> Dodaj</Button>}/><Card><div className="space-y-2">{flat.map((k:any)=><div key={k.id} className="flex items-center justify-between rounded-2xl border p-3" style={{marginLeft:k.level*24}}><button onClick={()=>openEdit(k)} className="text-left"><b><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{background:k.kolor||'#06B6D4'}}/> {k.nazwa}</b><p className="text-xs text-slate-500">kolejność: {k.kolejnosc ?? 0} {k.id_rodzica ? '· podkategoria' : '· kategoria główna'}</p></button><div className="flex gap-2"><button onClick={()=>move(k,-1)} className="rounded-lg border p-2"><ArrowUp size={15}/></button><button onClick={()=>move(k,1)} className="rounded-lg border p-2"><ArrowDown size={15}/></button><Button variant="secondary" onClick={()=>openAdd(k)}>Podkategoria</Button><button onClick={()=>remove(k.id)} className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600"><Trash2 size={15}/></button></div></div>)}</div></Card>{show&&<SimpleModal title={editing?'Edytuj kategorię':'Dodaj kategorię'} onClose={()=>setShow(false)}><form onSubmit={save} className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><Field label="Nazwa"><input className={inputClass} value={form.nazwa||''} onChange={e=>setForm({...form,nazwa:e.target.value})} required/></Field><Field label="Kategoria nadrzędna"><select className={inputClass} value={form.id_rodzica||''} onChange={e=>setForm({...form,id_rodzica:e.target.value})}><option value="">Brak - kategoria główna</option>{flat.filter((x:any)=>x.id!==editing?.id).map((x:any)=><option key={x.id} value={x.id}>{'—'.repeat(x.level)} {x.nazwa}</option>)}</select></Field><Field label="Kolor"><input type="color" className={inputClass} value={form.kolor||'#06B6D4'} onChange={e=>setForm({...form,kolor:e.target.value})}/></Field><Field label="Kolejność"><input type="number" className={inputClass} value={form.kolejnosc||0} onChange={e=>setForm({...form,kolejnosc:e.target.value})}/></Field></div><Field label="Opis"><textarea className={inputClass} value={form.opis||''} onChange={e=>setForm({...form,opis:e.target.value})}/></Field><div className="flex justify-end gap-2"><Button variant="secondary" onClick={()=>setShow(false)}>Anuluj</Button><Button type="submit">Zapisz</Button></div></form></SimpleModal>}</div>
}
