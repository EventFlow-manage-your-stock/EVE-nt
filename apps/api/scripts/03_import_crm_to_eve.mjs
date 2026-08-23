#!/usr/bin/env node
/**
 * 03_import_crm_to_eve.mjs
 *
 * Importuje CRM_EVE_NT_MERGED.xlsx do aktualnego EVE-NT.
 * Domyślnie DRY RUN. Zapis: --apply.
 * Pełna wymiana CRM: --replace --apply.
 *
 * Przy --replace:
 * - zapamiętuje wszystkie FK z innych tabel do kontrahentów/kontaktów,
 * - zeruje tylko nullable FK,
 * - usuwa kontakty i kontrahentów organizacji,
 * - importuje finalny CRM,
 * - ponownie podłącza stare rekordy (wydarzenia/oferty/wynajmy/zadania/zapytania itd.)
 *   do nowych kontrahentów/kontaktów po NIP/nazwie/e-mailu/telefonie.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';
const require=createRequire(import.meta.url);
const XLSX=require('xlsx');
const prisma=new PrismaClient();

function arg(name,fallback=undefined){const i=process.argv.indexOf(`--${name}`);if(i<0)return fallback;const n=process.argv[i+1];if(!n||n.startsWith('--'))return true;return n;}
const opts={file:path.resolve(String(arg('file','CRM_EVE_NT_MERGED.xlsx'))),org:arg('org')?Number(arg('org')):null,apply:Boolean(arg('apply',false)),replace:Boolean(arg('replace',false)),allowNonlocal:Boolean(arg('allow-nonlocal',false))};
function text(v){return String(v??'').trim();}
function norm(v){return text(v).replace(/[łŁ]/g,ch=>ch==='Ł'?'L':'l').normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/&/g,' i ').replace(/[^a-z0-9]+/g,' ').trim();}
function digits(v){return text(v).replace(/\D/g,'');}
function phone(v){const d=digits(v);return d.length>=9?d.slice(-9):d;}
function mail(v){const s=text(v).toLowerCase();const m=s.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);return m?m[0].toLowerCase():'';}
const LEGAL=['spolka z ograniczona odpowiedzialnoscia','sp z o o','sp zoo','spolka akcyjna','s a','spolka jawna','sp j','spolka komandytowa','sp k'];
function companyNorm(v){let s=norm(v);for(const x of LEGAL)s=s.replace(new RegExp(`\\b${x.replace(/ /g,'\\s+')}\\b`,'g'),' ');return s.replace(/\s+/g,' ').trim();}
function bool(v,def=false){if(typeof v==='boolean')return v;const s=norm(v);if(!s)return def;if(['tak','yes','true','1'].includes(s))return true;if(['nie','no','false','0'].includes(s))return false;return def;}
function emptyToNull(v){const s=text(v);return s?s:null;}
function read(file){if(!fs.existsSync(file))throw new Error(`Brak pliku: ${file}`);if(!XLSX?.readFile)throw new Error('Pakiet xlsx nie udostępnia readFile');return XLSX.readFile(file,{raw:false,cellDates:true});}
function rows(wb,name){const ws=wb.Sheets[name];return ws?XLSX.utils.sheet_to_json(ws,{defval:'',raw:false}):[];}
function localGuard(){const raw=process.env.DATABASE_URL||'';if(!raw)throw new Error('Brak DATABASE_URL');const u=new URL(raw);console.log(`DB: ${u.hostname}${u.pathname}`);const local=new Set(['localhost','127.0.0.1','::1','postgres','wms_postgres']);if(!local.has(u.hostname)&&!opts.allowNonlocal)throw new Error('ODMOWA: baza nie wygląda na lokalną.');}
async function resolveOrg(){const xs=await prisma.organizacja.findMany({where:{data_usuniecia:null},orderBy:{id:'asc'}});if(opts.org){const o=xs.find(x=>x.id===opts.org);if(!o)throw new Error(`Brak org ${opts.org}`);return o;}if(xs.length===1)return xs[0];console.log(xs.map(x=>`${x.id}: ${x.nazwa}`).join('\n'));throw new Error('Podaj --org ID');}
async function varcharLimits(tx,table){const r=await tx.$queryRawUnsafe(`SELECT column_name, character_maximum_length FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1`,table);return new Map(r.map(x=>[String(x.column_name),x.character_maximum_length===null?null:Number(x.character_maximum_length)]));}
function fit(limits,col,v){if(v===null||v===undefined)return null;let s=text(v);const max=limits.get(col);if(max&&s.length>max)s=s.slice(0,max);return s||null;}
async function fkRefs(tx,target){return tx.$queryRawUnsafe(`SELECT tc.table_name,kcu.column_name,cols.is_nullable FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema JOIN information_schema.columns cols ON cols.table_schema=tc.table_schema AND cols.table_name=tc.table_name AND cols.column_name=kcu.column_name WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema=current_schema() AND ccu.table_name=$1 AND ccu.column_name='id'`,target);}
function qi(s){return `"${String(s).replace(/"/g,'""')}"`;}
async function hasColumn(tx,table,col){const r=await tx.$queryRawUnsafe(`SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 AND column_name=$2 LIMIT 1`,table,col);return r.length>0;}
async function collectRefs(tx,target,org,oldIds,exclude=new Set()){
  const refs=await fkRefs(tx,target);const out=[];const oldSet=new Set(oldIds.map(Number));
  for(const fk of refs){const table=String(fk.table_name),col=String(fk.column_name);if(exclude.has(table))continue;
    const hasId=await hasColumn(tx,table,'id');if(!hasId)continue;const hasOrg=await hasColumn(tx,table,'id_organizacji');
    const sql=`SELECT "id", ${qi(col)} AS target_id FROM ${qi(table)} WHERE ${qi(col)} IS NOT NULL${hasOrg?' AND "id_organizacji"=$1':''}`;
    const rr=hasOrg?await tx.$queryRawUnsafe(sql,org):await tx.$queryRawUnsafe(sql);
    for(const x of rr){const tid=Number(x.target_id);if(oldSet.has(tid))out.push({table,col,rowId:Number(x.id),oldTargetId:tid,nullable:String(fk.is_nullable).toUpperCase()==='YES'});}
  }
  return out;
}
function contractorFingerprint(c){return{nip:digits(c.nip).slice(0,10),name:companyNorm(c.nazwa),email:mail(c.email),phone:phone(c.telefon)};}
function contactFingerprint(c,contractor){return{company:contractorFingerprint(contractor||{}),email:mail(c.email),phone:phone(c.telefon),name:norm(`${c.imie||''} ${c.nazwisko||''}`)};}
function uniqueMap(items,keyFn){const m=new Map();for(const x of items){const k=keyFn(x);if(!k)continue;if(!m.has(k))m.set(k,[]);m.get(k).push(x);}return m;}
function one(m,k){const a=m.get(k)||[];return a.length===1?a[0]:null;}
function matchContractor(old,newList){const f=contractorFingerprint(old);let maps={nip:uniqueMap(newList,x=>contractorFingerprint(x).nip),name:uniqueMap(newList,x=>contractorFingerprint(x).name),email:uniqueMap(newList,x=>contractorFingerprint(x).email),phone:uniqueMap(newList,x=>contractorFingerprint(x).phone)};if(f.nip){const x=one(maps.nip,f.nip);if(x)return x;}if(f.name){const x=one(maps.name,f.name);if(x)return x;}if(f.email){const x=one(maps.email,f.email);if(x)return x;}if(f.phone){const x=one(maps.phone,f.phone);if(x)return x;}return null;}
function matchContact(old,oldContractor,newContacts,newContractor){const candidates=newContacts.filter(x=>x.id_kontrahenta===newContractor.id);const f=contactFingerprint(old,oldContractor);if(f.email){const a=candidates.filter(x=>mail(x.email)===f.email);if(a.length===1)return a[0];}if(f.phone){const a=candidates.filter(x=>phone(x.telefon)===f.phone);if(a.length===1)return a[0];}if(f.name){const a=candidates.filter(x=>norm(`${x.imie||''} ${x.nazwisko||''}`)===f.name);if(a.length===1)return a[0];}return null;}

async function main(){
 localGuard();const org=await resolveOrg();const wb=read(opts.file);const cs=rows(wb,'01_Kontrahenci'),ps=rows(wb,'02_Kontakty');if(!cs.length)throw new Error('Brak 01_Kontrahenci');
 console.log(`Tryb: ${opts.apply?'APPLY':'DRY RUN'}${opts.replace?' + REPLACE':''}`);console.log(`Firmy: ${cs.length}, kontakty: ${ps.length}, org: ${org.id}`);
 // validation
 const keys=new Set();for(const c of cs){const k=text(c.__import_key);if(!k)throw new Error('Kontrahent bez __import_key');if(keys.has(k))throw new Error(`Duplikat key ${k}`);keys.add(k);}
 for(const p of ps){if(!keys.has(text(p.__id_kontrahenta_import_key)))throw new Error(`Kontakt ${p.__import_key} wskazuje nieistniejącą firmę ${p.__id_kontrahenta_import_key}`);}
 if(!opts.apply){console.log('DRY RUN OK. Dodaj --apply; jeśli chcesz wyczyścić obecny CRM także --replace.');return;}
 const report=await prisma.$transaction(async tx=>{
   const kl=await varcharLimits(tx,'kontrahenci'),pl=await varcharLimits(tx,'kontakty_kontrahentow');
   const oldC=opts.replace?await tx.kontrahent.findMany({where:{id_organizacji:org.id}}):[];
   const oldP=opts.replace?await tx.kontaktKontrahenta.findMany({where:{id_organizacji:org.id}}):[];
   const oldCById=new Map(oldC.map(x=>[x.id,x]));
   // Przy --replace stare i nowe rekordy przez chwilę współistnieją.
   // Dzięki temu możemy przepiąć również NOT NULL FK bez zerowania relacji.
   let contractorRefs=[],contactRefs=[];
   const cMap=new Map(),newCompanies=[];
   for(const r of cs){
      const data={id_organizacji:org.id,nazwa:fit(kl,'nazwa',r.nazwa)||'BEZ NAZWY',nazwa_skrocona:fit(kl,'nazwa_skrocona',r.nazwa_skrocona),nip:digits(r.nip).slice(0,10)||null,regon:digits(r.regon).slice(0,14)||null,krs:digits(r.krs).slice(0,10)||null,ulica:fit(kl,'ulica',r.ulica),nr_budynku:fit(kl,'nr_budynku',r.nr_budynku),nr_lokalu:fit(kl,'nr_lokalu',r.nr_lokalu),kod_pocztowy:fit(kl,'kod_pocztowy',r.kod_pocztowy),miasto:fit(kl,'miasto',r.miasto),kraj:fit(kl,'kraj',r.kraj)||'Polska',email:fit(kl,'email',r.email),telefon:fit(kl,'telefon',r.telefon),uwagi:emptyToNull(r.uwagi),zrodlo_danych:fit(kl,'zrodlo_danych',r.zrodlo_danych)||'import',aktywny:bool(r.aktywny,true),czy_klient:bool(r.czy_klient,true),czy_dostawca:bool(r.czy_dostawca,false),nr_konta:fit(kl,'nr_konta',r.nr_konta)};
      let obj;
      if(!opts.replace){const f=contractorFingerprint(data);const existing=await tx.kontrahent.findMany({where:{id_organizacji:org.id,data_usuniecia:null}});obj=matchContractor(data,existing);if(obj)obj=await tx.kontrahent.update({where:{id:obj.id},data:{...data,data_usuniecia:null}});else obj=await tx.kontrahent.create({data});}
      else obj=await tx.kontrahent.create({data});
      cMap.set(text(r.__import_key),obj.id);newCompanies.push(obj);
   }
   const pMap=new Map(),newContacts=[];
   for(const r of ps){const contractorId=cMap.get(text(r.__id_kontrahenta_import_key));if(!contractorId)continue;const data={id_organizacji:org.id,id_kontrahenta:contractorId,imie:fit(pl,'imie',r.imie),nazwisko:fit(pl,'nazwisko',r.nazwisko),stanowisko:fit(pl,'stanowisko',r.stanowisko),email:fit(pl,'email',r.email),telefon:fit(pl,'telefon',r.telefon),telefon_2:fit(pl,'telefon_2',r.telefon_2),notatki_wewnetrzne:emptyToNull(r.notatki_wewnetrzne),glowny:bool(r.glowny,false),aktywny:bool(r.aktywny,true)};const obj=await tx.kontaktKontrahenta.create({data});pMap.set(text(r.__import_key),obj.id);newContacts.push(obj);}
   let contractorRelinked=0,contactRelinked=0,unmatchedContractorRefs=[],unmatchedContactRefs=[];
   if(opts.replace){
     const oldToNewC=new Map();
     for(const oc of oldC){const nc=matchContractor(oc,newCompanies);if(nc)oldToNewC.set(oc.id,nc.id);}

     const oldToNewP=new Map();
     for(const op of oldP){
       const oc=oldCById.get(op.id_kontrahenta);const ncid=oc?oldToNewC.get(oc.id):null;const nc=ncid?newCompanies.find(x=>x.id===ncid):null;
       if(!oc||!nc)continue;const np=matchContact(op,oc,newContacts,nc);if(np)oldToNewP.set(op.id,np.id);
     }

     // Pobieramy tylko referencje prowadzące do STARYCH rekordów.
     contactRefs=await collectRefs(tx,'kontakty_kontrahentow',org.id,oldP.map(x=>x.id));
     contractorRefs=await collectRefs(tx,'kontrahenci',org.id,oldC.map(x=>x.id),new Set(['kontakty_kontrahentow']));

     unmatchedContractorRefs=contractorRefs.filter(ref=>!oldToNewC.has(ref.oldTargetId));
     unmatchedContactRefs=contactRefs.filter(ref=>!oldToNewP.has(ref.oldTargetId));
     if(unmatchedContractorRefs.length||unmatchedContactRefs.length){
       throw new Error(`Nie można bezpiecznie wymienić CRM: niedopasowane aktywne relacje — kontrahenci=${unmatchedContractorRefs.length}, kontakty=${unmatchedContactRefs.length}. Transakcja zostanie wycofana.`);
     }

     // Przepinamy FK bezpośrednio stary -> nowy. Działa również dla NOT NULL.
     for(const ref of contractorRefs){const nid=oldToNewC.get(ref.oldTargetId);await tx.$executeRawUnsafe(`UPDATE ${qi(ref.table)} SET ${qi(ref.col)}=$1 WHERE "id"=$2`,nid,ref.rowId);contractorRelinked++;}
     for(const ref of contactRefs){const nid=oldToNewP.get(ref.oldTargetId);await tx.$executeRawUnsafe(`UPDATE ${qi(ref.table)} SET ${qi(ref.col)}=$1 WHERE "id"=$2`,nid,ref.rowId);contactRelinked++;}

     // Dopiero po przepięciu wszystkich relacji usuwamy stare rekordy.
     await tx.kontaktKontrahenta.deleteMany({where:{id_organizacji:org.id,id:{in:oldP.map(x=>x.id)}}});
     await tx.kontrahent.deleteMany({where:{id_organizacji:org.id,id:{in:oldC.map(x=>x.id)}}});
   }
   return{companies:newCompanies.length,contacts:newContacts.length,contractorRelinked,contactRelinked,unmatchedContractorRefs,unmatchedContactRefs};
 },{timeout:600000,maxWait:30000});
 const reportPath=path.join(path.dirname(opts.file),'CRM_IMPORT_REPORT.json');fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(report);console.log(`Raport: ${reportPath}`);
}
main().catch(e=>{console.error('\nIMPORT PRZERWANY:',e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
