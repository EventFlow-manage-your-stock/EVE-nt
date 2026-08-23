#!/usr/bin/env node
/**
 * 03_import_rent_vac_review_to_eve.mjs
 *
 * Imports ONLY rows approved in NEW_RENT_VAC_REVIEW.xlsx.
 *
 * Run rentals first:
 *   --rentals-only --apply
 *
 * Then vacations:
 *   --vacations-only --apply
 *
 * Without --apply => validation / DRY-RUN only.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';

const require=createRequire(import.meta.url);
const XLSX=require('xlsx');
const prisma=new PrismaClient();

function arg(name,fallback=undefined){
  const i=process.argv.indexOf(`--${name}`);
  if(i<0)return fallback;
  const v=process.argv[i+1];
  if(!v||v.startsWith('--'))return true;
  return v;
}
const opts={
  file:arg('file'),
  orgId:Number(arg('org',0)),
  apply:Boolean(arg('apply',false)),
  rentalsOnly:Boolean(arg('rentals-only',false)),
  vacationsOnly:Boolean(arg('vacations-only',false)),
  allowNonlocal:Boolean(arg('allow-nonlocal',false)),
};
if(opts.rentalsOnly&&opts.vacationsOnly)throw new Error('Wybierz tylko jeden: --rentals-only albo --vacations-only');
if(!opts.rentalsOnly&&!opts.vacationsOnly)throw new Error('Wymagane: --rentals-only albo --vacations-only');

function text(v){return String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim()}
function norm(v){return text(v).replace(/[łŁ]/g,x=>x==='ł'?'l':'L').normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function approved(v){return ['importuj','tak','yes','1','merge'].includes(norm(v))}
function skipped(v){return ['pomin','pomij','skip','nie','no','0'].includes(norm(v))}
function parseDate(v){
  const s=text(v);if(!s)return null;
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if(m)return new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0),+(m[6]||0));
  const d=new Date(s);return Number.isNaN(d.getTime())?null:d;
}
function numberValue(v,fallback=1){
  const n=Number(text(v).replace(',','.'));return Number.isFinite(n)&&n>0?n:fallback;
}
function idValue(v){
  const n=Number(text(v));return Number.isInteger(n)&&n>0?n:null;
}
function parseIds(v){
  return [...new Set(text(v).split(/[,\s;|]+/).map(Number).filter(x=>Number.isInteger(x)&&x>0))];
}
function localDbGuard(){
  const raw=process.env.DATABASE_URL||'';if(!raw)throw new Error('Brak DATABASE_URL.');
  const u=new URL(raw);
  const allowed=new Set(['localhost','127.0.0.1','::1','postgres','wms_postgres']);
  console.log(`DB: ${u.hostname}${u.pathname}`);
  if(!allowed.has(u.hostname)&&!opts.allowNonlocal)throw new Error(`ODMOWA: ${u.hostname} nie jest lokalną bazą.`);
}
function rows(wb,name){
  const ws=wb.Sheets[name];if(!ws)throw new Error(`Brak arkusza ${name}`);
  return XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});
}
function groupBy(arr,fn){
  const m=new Map();for(const x of arr){const k=fn(x);if(!m.has(k))m.set(k,[]);m.get(k).push(x)}return m;
}
function rentalNotes(r){
  return [
    `[NEW_RENT_ID=${text(r.NEW_rent_id)}]`,
    `Nazwa NEW: ${text(r.Nazwa)}`,
    `Typ NEW: ${text(r.Typ_NEW)}`,
    `EventManager NEW: ${text(r.EventManager_NEW)}`,
    text(r.Kontakt_NEW)?`Kontakt NEW: ${text(r.Kontakt_NEW)}`:'',
    text(r.Kontakt_email_NEW)?`Kontakt e-mail NEW: ${text(r.Kontakt_email_NEW)}`:'',
    text(r.Kontakt_telefon_NEW)?`Kontakt telefon NEW: ${text(r.Kontakt_telefon_NEW)}`:'',
    text(r.Wartosc_NEW)?`Wartość NEW: ${text(r.Wartosc_NEW)}`:'',
    text(r.Opis_NEW)?`Opis NEW: ${text(r.Opis_NEW)}`:'',
    text(r.Uwagi_NEW)?`Uwagi NEW: ${text(r.Uwagi_NEW)}`:'',
    text(r.URL)?`Źródło: ${text(r.URL)}`:'',
  ].filter(Boolean).join('\n');
}
function quoteIdent(v){return `"${String(v).replace(/"/g,'""')}"`}
async function tableColumns(table){
  const rs=await prisma.$queryRawUnsafe(`
    SELECT column_name,data_type,udt_name,is_nullable,column_default,is_identity
    FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name=$1
    ORDER BY ordinal_position`,table);
  return rs.map(r=>({name:String(r.column_name),dataType:String(r.data_type),nullable:String(r.is_nullable)==='YES',default:r.column_default==null?null:String(r.column_default),identity:String(r.is_identity)==='YES'}));
}
function choose(cols,cands){const names=new Set(cols.map(c=>c.name));return cands.find(x=>names.has(x))||null}
function buildAbsenceSchema(cols){
  if(!cols.length)throw new Error('Brak tabeli nieobecnosci.');
  const s={
    org:choose(cols,['id_organizacji']),user:choose(cols,['id_uzytkownika']),
    type:choose(cols,['typ','rodzaj']),start:choose(cols,['data_od','data_start','od','start_date']),
    end:choose(cols,['data_do','data_koniec','do','end_date']),
    note:choose(cols,['opis','powod','uwagi','notatki_wewnetrzne','info']),
    active:choose(cols,['aktywny']),created:choose(cols,['data_utworzenia']),updated:choose(cols,['data_aktualizacji']),
  };
  for(const k of ['org','user','type','start','end'])if(!s[k])throw new Error(`Nie umiem dopasować ${k} w nieobecnosci.`);
  return s;
}
async function existingAbsence(tx,s,org,user,start,end,marker){
  if(s.note){
    const q=`SELECT id FROM ${quoteIdent('nieobecnosci')} WHERE ${quoteIdent(s.org)}=$1 AND ${quoteIdent(s.note)}::text LIKE $2 LIMIT 1`;
    const r=await tx.$queryRawUnsafe(q,org,`%${marker}%`);if(r.length)return Number(r[0].id);
  }
  const q=`SELECT id FROM ${quoteIdent('nieobecnosci')} WHERE ${quoteIdent(s.org)}=$1 AND ${quoteIdent(s.user)}=$2 AND ${quoteIdent(s.start)}=$3 AND ${quoteIdent(s.end)}=$4 LIMIT 1`;
  const r=await tx.$queryRawUnsafe(q,org,user,start,end);return r.length?Number(r[0].id):null;
}
async function insertAbsence(tx,s,org,user,v){
  const start=parseDate(v.Od),end=parseDate(v.Do);
  const marker=`[NEW_VACATION_ID=${text(v.NEW_vacation_id)}]`;
  const ex=await existingAbsence(tx,s,org,user,start,end,marker);
  if(ex)return{status:'EXISTING',id:ex};
  const vals=new Map([[s.org,org],[s.user,user],[s.type,text(v.Typ_NEW)||'Nieobecność'],[s.start,start],[s.end,end]]);
  if(s.note)vals.set(s.note,[marker,`Status NEW: ${text(v.Status_NEW)}`,text(v.Stawka_NEW)?`Stawka NEW: ${text(v.Stawka_NEW)}`:'',text(v.Info_NEW)?`Info NEW: ${text(v.Info_NEW)}`:'',text(v.URL)?`Źródło: ${text(v.URL)}`:''].filter(Boolean).join('\n'));
  if(s.active)vals.set(s.active,true);
  const now=new Date();if(s.created)vals.set(s.created,now);if(s.updated)vals.set(s.updated,now);
  const names=[...vals.keys()].filter(Boolean),params=names.map(n=>vals.get(n)),ph=params.map((_,i)=>`$${i+1}`).join(', ');
  const sql=`INSERT INTO ${quoteIdent('nieobecnosci')} (${names.map(quoteIdent).join(', ')}) VALUES (${ph}) RETURNING id`;
  const r=await tx.$queryRawUnsafe(sql,...params);return{status:'CREATED',id:Number(r[0].id)};
}

async function validateRentals(rents,gear){
  const errors=[];
  const selectedRents=rents.filter(r=>approved(r.AKCJA));
  const rentIds=new Set(selectedRents.map(r=>text(r.NEW_rent_id)));
  for(const r of rents){
    if(!approved(r.AKCJA)&&!skipped(r.AKCJA))errors.push(`Wynajem ${text(r.NEW_rent_id)}: AKCJA="${text(r.AKCJA)}" — ustaw IMPORTUJ albo POMIN.`);
  }
  for(const r of selectedRents){
    if(text(r.Klient_NEW)&&!idValue(r.EVE_KONTRAHENT_ID))errors.push(`Wynajem ${text(r.NEW_rent_id)}: brak EVE_KONTRAHENT_ID.`);
    if(!parseDate(r.Od)||!parseDate(r.Do))errors.push(`Wynajem ${text(r.NEW_rent_id)}: błędna data.`);
  }
  for(const g of gear){
    if(!rentIds.has(text(g.NEW_rent_id)))continue;
    if(!approved(g.AKCJA)&&!skipped(g.AKCJA))errors.push(`Sprzęt ${text(g.NEW_rent_id)}/${text(g.NEW_gear_id)}: AKCJA="${text(g.AKCJA)}".`);
    if(approved(g.AKCJA)&&!idValue(g.EVE_MODEL_ID))errors.push(`Sprzęt ${text(g.NEW_rent_id)}/${text(g.NEW_gear_id)}: brak EVE_MODEL_ID.`);
  }
  return{errors,selectedRents};
}
async function validateVacations(vacs){
  const errors=[],selected=vacs.filter(v=>approved(v.AKCJA));
  for(const v of vacs){
    if(!approved(v.AKCJA)&&!skipped(v.AKCJA))errors.push(`Urlop ${text(v.NEW_vacation_id)}: AKCJA="${text(v.AKCJA)}".`);
  }
  for(const v of selected){
    if(!idValue(v.EVE_USER_ID))errors.push(`Urlop ${text(v.NEW_vacation_id)}: brak EVE_USER_ID.`);
    if(!parseDate(v.Od)||!parseDate(v.Do))errors.push(`Urlop ${text(v.NEW_vacation_id)}: błędna data.`);
  }
  return{errors,selected};
}

async function main(){
  if(!opts.file)throw new Error('Podaj --file NEW_RENT_VAC_REVIEW.xlsx');
  if(!opts.orgId)throw new Error('Podaj --org N');
  localDbGuard();
  const file=path.resolve(String(opts.file));if(!fs.existsSync(file))throw new Error(`Brak ${file}`);
  const wb=XLSX.readFile(file,{raw:false,cellDates:false});
  const rents=rows(wb,'01_Wynajmy'),gear=rows(wb,'02_Sprzet'),vacs=rows(wb,'03_Urlopy');
  const org=await prisma.organizacja.findFirst({where:{id:opts.orgId,data_usuniecia:null}});
  if(!org)throw new Error(`Brak organizacji ${opts.orgId}`);

  if(opts.rentalsOnly){
    const {errors,selectedRents}=await validateRentals(rents,gear);
    if(errors.length){
      console.error('\nBŁĘDY WALIDACJI:');for(const e of errors.slice(0,200))console.error(' - '+e);
      throw new Error(`Popraw Excel: ${errors.length} problemów.`);
    }
    console.log(`Wynajmy zatwierdzone: ${selectedRents.length}`);
    console.log(`Tryb: ${opts.apply?'APPLY':'DRY-RUN'}`);
    if(!opts.apply){console.log('DRY-RUN OK — baza niezmieniona.');return;}

    const gearByRent=groupBy(gear.filter(g=>approved(g.AKCJA)),g=>text(g.NEW_rent_id));
    const result=await prisma.$transaction(async tx=>{
      let created=0,skippedCount=0,positions=0,exactItems=0;
      const statusCache=new Map((await tx.statusWynajmu.findMany({where:{id_organizacji:opts.orgId,data_usuniecia:null}})).map(s=>[s.id,s]));
      let statusOrder=Math.max(0,...[...statusCache.values()].map(s=>s.kolejnosc||0))+1;
      async function statusFor(r){
        const explicit=idValue(r.EVE_STATUS_ID);
        if(explicit){
          const s=await tx.statusWynajmu.findFirst({where:{id:explicit,id_organizacji:opts.orgId,data_usuniecia:null}});
          if(!s)throw new Error(`Wynajem ${text(r.NEW_rent_id)}: EVE_STATUS_ID=${explicit} nie istnieje.`);
          return s;
        }
        const src=norm(r.Status_NEW)||'nowy';
        for(const s of statusCache.values())if(norm(s.nazwa)===src)return s;
        const c=await tx.statusWynajmu.create({data:{id_organizacji:opts.orgId,nazwa:text(r.Status_NEW)||'Nowy',kolejnosc:statusOrder++,aktywny:true}});
        statusCache.set(c.id,c);return c;
      }

      for(const r of selectedRents){
        const rid=text(r.NEW_rent_id),marker=`[NEW_RENT_ID=${rid}]`;
        const existing=await tx.wynajem.findFirst({where:{id_organizacji:opts.orgId,data_usuniecia:null,notatki_wewnetrzne:{contains:marker}}});
        if(existing){console.log(`SKIP ${rid}: już zaimportowany jako wynajem ${existing.id}`);skippedCount++;continue;}

        const contractorId=idValue(r.EVE_KONTRAHENT_ID);
        if(contractorId){
          const c=await tx.kontrahent.findFirst({where:{id:contractorId,id_organizacji:opts.orgId,data_usuniecia:null}});
          if(!c)throw new Error(`Wynajem ${rid}: kontrahent ${contractorId} nie istnieje.`);
        }
        const number=text(r.Numer)||`NEW-WYNAJEM-${rid}`;
        const numberConflict=await tx.wynajem.findFirst({where:{id_organizacji:opts.orgId,data_usuniecia:null,numer:number}});
        if(numberConflict)throw new Error(`Wynajem ${rid}: numer ${number} już istnieje jako EVE wynajem ${numberConflict.id}.`);

        const st=await statusFor(r);
        const rental=await tx.wynajem.create({data:{
          id_organizacji:opts.orgId,id_wydarzenia:null,id_oferty:null,
          id_kontrahenta:contractorId,id_statusu_wynajmu:st.id,numer:number,
          data_wydania:parseDate(r.Od),data_zwrotu_planowana:parseDate(r.Do),
          data_zwrotu_rzeczywista:null,notatki_wewnetrzne:rentalNotes(r),aktywny:true
        }});

        for(const g of (gearByRent.get(rid)||[])){
          const mid=idValue(g.EVE_MODEL_ID);
          const model=await tx.modelSprzetu.findFirst({where:{id:mid,id_organizacji:opts.orgId,data_usuniecia:null}});
          if(!model)throw new Error(`Wynajem ${rid}: model ${mid} nie istnieje.`);
          const qty=numberValue(g.Ilosc,1),eids=parseIds(g.EVE_EGZEMPLARZE_IDS);
          const used=[];
          for(const eid of eids){
            const ex=await tx.egzemplarz.findFirst({where:{id:eid,id_organizacji:opts.orgId,id_modelu:mid,data_usuniecia:null}});
            if(!ex)throw new Error(`Wynajem ${rid}: egzemplarz ${eid} nie istnieje w modelu ${mid}.`);
            await tx.pozycjaWynajmu.create({data:{
              id_organizacji:opts.orgId,id_wynajmu:rental.id,id_modelu:mid,id_egzemplarza:eid,
              ilosc:1,notatki_wewnetrzne:`NEW gear_id=${text(g.NEW_gear_id)}; dokładny egzemplarz z review`,aktywny:true
            }});
            used.push(eid);positions++;exactItems++;
          }
          const remaining=Math.max(0,qty-used.length);
          if(remaining>0){
            await tx.pozycjaWynajmu.create({data:{
              id_organizacji:opts.orgId,id_wynajmu:rental.id,id_modelu:mid,id_egzemplarza:null,
              ilosc:remaining,notatki_wewnetrzne:[
                `NEW gear_id=${text(g.NEW_gear_id)}`,
                text(g.NEW_assignment_id)?`NEW assignment_id=${text(g.NEW_assignment_id)}`:'',
                text(g.Komentarz_NEW)?`Komentarz NEW: ${text(g.Komentarz_NEW)}`:''
              ].filter(Boolean).join('\n'),aktywny:true
            }});
            positions++;
          }
        }
        created++;
        console.log(`OK wynajem NEW ${rid} -> EVE ${rental.id}`);
      }
      return{created,skippedCount,positions,exactItems};
    },{maxWait:20000,timeout:600000});
    console.log('\nIMPORT WYNAJMÓW ZAKOŃCZONY');
    console.log(`Utworzone wynajmy: ${result.created}`);
    console.log(`Już istniejące: ${result.skippedCount}`);
    console.log(`Pozycje sprzętu: ${result.positions}`);
    console.log(`Dokładnie przypisane egzemplarze: ${result.exactItems}`);
    return;
  }

  if(opts.vacationsOnly){
    const {errors,selected}=await validateVacations(vacs);
    if(errors.length){
      console.error('\nBŁĘDY WALIDACJI:');for(const e of errors.slice(0,200))console.error(' - '+e);
      throw new Error(`Popraw Excel: ${errors.length} problemów.`);
    }
    console.log(`Urlopy zatwierdzone: ${selected.length}`);
    console.log(`Tryb: ${opts.apply?'APPLY':'DRY-RUN'}`);
    const cols=await tableColumns('nieobecnosci'),schema=buildAbsenceSchema(cols);
    if(!opts.apply){console.log('DRY-RUN OK — baza niezmieniona.');return;}

    const result=await prisma.$transaction(async tx=>{
      let created=0,existing=0;
      for(const v of selected){
        const uid=idValue(v.EVE_USER_ID);
        const u=await tx.uzytkownik.findFirst({where:{id:uid,id_organizacji:opts.orgId,data_usuniecia:null}});
        if(!u)throw new Error(`Urlop ${text(v.NEW_vacation_id)}: user ${uid} nie istnieje.`);
        const x=await insertAbsence(tx,schema,opts.orgId,uid,v);
        if(x.status==='CREATED')created++;else existing++;
        console.log(`${x.status} urlop NEW ${text(v.NEW_vacation_id)} -> EVE ${x.id}`);
      }
      return{created,existing};
    },{maxWait:20000,timeout:600000});
    console.log('\nIMPORT URLOPÓW ZAKOŃCZONY');
    console.log(`Utworzone: ${result.created}`);
    console.log(`Już istniejące: ${result.existing}`);
  }
}
main().catch(e=>{console.error('\nBŁĄD KRYTYCZNY:');console.error(e);process.exitCode=1})
.finally(async()=>{await prisma.$disconnect()});
