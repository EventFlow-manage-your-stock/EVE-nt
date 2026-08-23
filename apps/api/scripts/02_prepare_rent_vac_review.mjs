#!/usr/bin/env node
/**
 * 02_prepare_rent_vac_review.mjs
 *
 * Reads NEW_RENT_VAC_EXPORT.xlsx and CURRENT local EVE-NT database.
 * Produces an EDITABLE review workbook:
 *
 *   NEW_RENT_VAC_REVIEW.xlsx
 *
 * Sheets:
 *  - 01_Wynajmy
 *  - 02_Sprzet
 *  - 03_Urlopy
 *  - 99_Problemy
 *
 * Nothing is written to EVE-NT by this script.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const prisma = new PrismaClient();

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = process.argv[i + 1];
  if (!v || v.startsWith('--')) return true;
  return v;
}

const opts = {
  file: arg('file'),
  orgId: Number(arg('org', 0)),
  output: arg('output'),
  allowNonlocal: Boolean(arg('allow-nonlocal', false)),
};

function text(v) {
  return String(v ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}
function norm(v) {
  return text(v)
    .replace(/[łŁ]/g, (x) => x === 'ł' ? 'l' : 'L')
    .normalize('NFKD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function digits(v) {
  let d = text(v).replace(/\D/g, '');
  if (d.startsWith('48') && d.length === 11) d = d.slice(2);
  return d;
}
function email(v) {
  const m = text(v).toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return m ? m[0].toLowerCase() : '';
}
function companyNorm(v) {
  let s = norm(v);
  const forms = [
    'spolka z ograniczona odpowiedzialnoscia','sp z oo','spolka akcyjna',
    'spolka jawna','spolka komandytowa','sp j','sp k','sa'
  ];
  for (const f of forms) {
    s = s.replace(new RegExp(`\\b${f.replace(/\s+/g,'\\s+')}\\b`, 'g'), ' ');
  }
  return s.replace(/\s+/g,' ').trim();
}
function packageBase(v) {
  let s = text(v);
  s = s.replace(/^\s*\[\s*\d+\s*\]\s+/, '');
  s = s.replace(/\s*\(\s*(?:zestaw|case|rack|opakowanie|skrzynia)\s*(?:nr\.?\s*)?#?\s*\d+.*\)\s*$/i, '');
  s = s.replace(/\s+\[\s*\d+\s*\]\s*$/i, '');
  return text(s);
}
function extractNumber(v) {
  const s = text(v);
  let m = s.match(/\[\s*0*(\d+)\s*\]\s*$/);
  if (m) return String(Number(m[1]));
  m = s.match(/\(\s*(?:zestaw|case|rack|opakowanie|skrzynia)\s*(?:nr\.?\s*)?#?\s*0*(\d+)/i);
  return m ? String(Number(m[1])) : '';
}
function levenshtein(a,b) {
  a=norm(a); b=norm(b);
  const m=a.length,n=b.length;
  if(!m)return n;if(!n)return m;
  const prev=Array.from({length:n+1},(_,i)=>i),cur=new Array(n+1);
  for(let i=1;i<=m;i++){
    cur[0]=i;
    for(let j=1;j<=n;j++){
      cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    }
    for(let j=0;j<=n;j++)prev[j]=cur[j];
  }
  return prev[n];
}
function similarity(a,b) {
  const aa=norm(a),bb=norm(b);
  if(!aa&&!bb)return 1;
  const n=Math.max(aa.length,bb.length);
  return n ? 1-levenshtein(aa,bb)/n : 1;
}
function readRaw(file) {
  const wb=XLSX.readFile(file,{raw:false,cellDates:false});
  const rows=(name)=>{
    const ws=wb.Sheets[name];
    if(!ws)throw new Error(`Brak arkusza ${name}`);
    return XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});
  };
  return {
    rents: rows('01_Wynajmy'),
    items: rows('02_Zawartosc_wynajmow'),
    vacations: rows('03_Urlopy'),
  };
}
function localDbGuard() {
  const raw=process.env.DATABASE_URL||'';
  if(!raw)throw new Error('Brak DATABASE_URL.');
  const u=new URL(raw);
  const allowed=new Set(['localhost','127.0.0.1','::1','postgres','wms_postgres']);
  console.log(`DB: ${u.hostname}${u.pathname}`);
  if(!allowed.has(u.hostname)&&!opts.allowNonlocal){
    throw new Error(`ODMOWA: ${u.hostname} nie jest lokalną bazą. --allow-nonlocal tylko świadomie.`);
  }
}
function sourceCompanyCandidates(v,city){
  const a=[],full=text(v);
  if(full)a.push(full);
  if(city&&full.toLowerCase().endsWith(`, ${text(city).toLowerCase()}`)){
    a.push(text(full.slice(0,-(text(city).length+2))));
  }else if(full.includes(',')){
    a.push(text(full.slice(0,full.lastIndexOf(','))));
  }
  return [...new Set(a.filter(Boolean))];
}
function resolveContractor(r,contractors,contacts){
  const em=email(r.Kontakt_email), ph=digits(r.Kontakt_telefon);
  if(em){
    const ids=[...new Set(contacts.filter(c=>email(c.email)===em).map(c=>c.id_kontrahenta))];
    if(ids.length===1){
      const c=contractors.find(x=>x.id===ids[0]);if(c)return{value:c,method:'CONTACT_EMAIL'};
    }
  }
  if(ph&&ph.length>=9){
    const ids=[...new Set(contacts.filter(c=>digits(c.telefon)===ph||digits(c.telefon_2)===ph).map(c=>c.id_kontrahenta))];
    if(ids.length===1){
      const c=contractors.find(x=>x.id===ids[0]);if(c)return{value:c,method:'CONTACT_PHONE'};
    }
  }
  const candidates=sourceCompanyCandidates(r.Klient,r.Miasto_klienta);
  for(const source of candidates){
    const sn=companyNorm(source);
    const ms=contractors.filter(c=>companyNorm(c.nazwa)===sn||companyNorm(c.nazwa_skrocona)===sn);
    if(ms.length===1)return{value:ms[0],method:'COMPANY_NAME'};
  }
  let best=null,bestScore=0,second=0;
  for(const source of candidates){
    for(const c of contractors){
      const score=Math.max(
        similarity(companyNorm(source),companyNorm(c.nazwa)),
        similarity(companyNorm(source),companyNorm(c.nazwa_skrocona||''))
      );
      if(score>bestScore){second=bestScore;bestScore=score;best=c}
      else if(score>second)second=score;
    }
  }
  if(best&&bestScore>=0.96&&bestScore-second>=0.04)return{value:best,method:`COMPANY_FUZZY_${bestScore.toFixed(3)}`};
  return{value:null,method:`UNRESOLVED_CONTRACTOR_${bestScore.toFixed(3)}`};
}
function resolveModel(sourceName,models){
  const src=norm(sourceName),base=norm(packageBase(sourceName));
  const exact=models.filter(m=>norm(m.nazwa)===src);
  if(exact.length===1)return{value:exact[0],method:'NAME_EXACT'};
  if(exact.length>1)return{value:null,method:'AMBIGUOUS_MODEL_EXACT'};
  const bm=models.filter(m=>norm(m.nazwa)===base||norm(packageBase(m.nazwa))===base);
  if(bm.length===1)return{value:bm[0],method:'PACKAGE_BASE'};
  if(bm.length>1)return{value:null,method:'AMBIGUOUS_MODEL_BASE'};
  let best=null,bestScore=0,second=0;
  for(const m of models){
    const score=Math.max(similarity(sourceName,m.nazwa),similarity(packageBase(sourceName),packageBase(m.nazwa)));
    if(score>bestScore){second=bestScore;bestScore=score;best=m}
    else if(score>second)second=score;
  }
  if(best&&bestScore>=0.965&&bestScore-second>=0.04)return{value:best,method:`NAME_FUZZY_${bestScore.toFixed(3)}`};
  return{value:null,method:`UNRESOLVED_MODEL_${bestScore.toFixed(3)}`};
}
function resolveUser(sourceName,users){
  const sn=norm(sourceName),st=[...sn.split(' ')].sort().join(' ');
  const ex=users.filter(u=>{
    const f=norm(`${u.imie} ${u.nazwisko}`);
    const r=norm(`${u.nazwisko} ${u.imie}`);
    return sn===f||sn===r||st===[...f.split(' ')].sort().join(' ');
  });
  if(ex.length===1)return{value:ex[0],method:'NAME_EXACT'};
  if(ex.length>1)return{value:null,method:'AMBIGUOUS_USER'};
  let best=null,bestScore=0,second=0;
  for(const u of users){
    const score=similarity(sourceName,`${u.imie} ${u.nazwisko}`);
    if(score>bestScore){second=bestScore;bestScore=score;best=u}
    else if(score>second)second=score;
  }
  if(best&&bestScore>=0.96&&bestScore-second>=0.04)return{value:best,method:`NAME_FUZZY_${bestScore.toFixed(3)}`};
  return{value:null,method:`UNRESOLVED_USER_${bestScore.toFixed(3)}`};
}
function parsePhysical(v){
  const s=text(v);
  if(!s)return[];
  try{
    const x=JSON.parse(s);
    return Array.isArray(x)?x:[];
  }catch{return[]}
}
function resolvePhysical(physical,modelId,exemplars){
  if(!physical.length||!modelId)return{ids:[],method:''};
  const pool=exemplars.filter(e=>e.id_modelu===modelId);
  const used=new Set(),ids=[],methods=[];
  for(const p of physical){
    const pn=norm(p.name);
    let matches=pool.filter(e=>!used.has(e.id)&&pn&&norm(e.nazwa)===pn);
    let method='NAME_EXACT';
    if(matches.length!==1){
      const nr=extractNumber(p.name);
      matches=nr?pool.filter(e=>!used.has(e.id)&&text(e.numer_egzemplarza).replace(/^0+/,'')===nr):[];
      method='NUMBER_IN_MODEL';
    }
    if(matches.length!==1)return{ids:[],method:`UNRESOLVED_PHYSICAL:${text(p.name)}`};
    used.add(matches[0].id);ids.push(matches[0].id);methods.push(method);
  }
  return{ids,method:[...new Set(methods)].join('+')};
}
function autosize(ws){
  const ref=ws['!ref'];
  if(!ref)return;
  const range=XLSX.utils.decode_range(ref), widths=[];
  for(let c=range.s.c;c<=range.e.c;c++){
    let max=10;
    for(let r=range.s.r;r<=Math.min(range.e.r,200);r++){
      const cell=ws[XLSX.utils.encode_cell({r,c})];
      max=Math.max(max,Math.min(55,text(cell?.v).length+2));
    }
    widths[c]={wch:max};
  }
  ws['!cols']=widths;
  ws['!freeze']={xSplit:0,ySplit:1};
}
function addSheet(wb,name,rows){
  const ws=XLSX.utils.json_to_sheet(rows,{skipHeader:false});
  autosize(ws);
  XLSX.utils.book_append_sheet(wb,ws,name);
}
async function main(){
  if(!opts.file)throw new Error('Podaj --file NEW_RENT_VAC_EXPORT.xlsx');
  if(!opts.orgId)throw new Error('Podaj --org N');
  localDbGuard();
  const file=path.resolve(String(opts.file));
  if(!fs.existsSync(file))throw new Error(`Brak pliku: ${file}`);
  const output=path.resolve(String(opts.output||path.join(path.dirname(file),'NEW_RENT_VAC_REVIEW.xlsx')));
  const raw=readRaw(file);

  const org=await prisma.organizacja.findFirst({where:{id:opts.orgId,data_usuniecia:null}});
  if(!org)throw new Error(`Brak organizacji ${opts.orgId}`);

  const [models,exemplars,contractors,contacts,users,statuses]=await Promise.all([
    prisma.modelSprzetu.findMany({
      where:{id_organizacji:opts.orgId,data_usuniecia:null},
      select:{id:true,nazwa:true,typ_sprzetu:true,tryb_ewidencji:true}
    }),
    prisma.egzemplarz.findMany({
      where:{id_organizacji:opts.orgId,data_usuniecia:null},
      select:{id:true,id_modelu:true,nazwa:true,numer_egzemplarza:true}
    }),
    prisma.kontrahent.findMany({
      where:{id_organizacji:opts.orgId,data_usuniecia:null},
      select:{id:true,nazwa:true,nazwa_skrocona:true,miasto:true}
    }),
    prisma.kontaktKontrahenta.findMany({
      where:{id_organizacji:opts.orgId,data_usuniecia:null},
      select:{id:true,id_kontrahenta:true,email:true,telefon:true,telefon_2:true}
    }),
    prisma.uzytkownik.findMany({
      where:{id_organizacji:opts.orgId,data_usuniecia:null},
      select:{id:true,imie:true,nazwisko:true,email:true}
    }),
    prisma.statusWynajmu.findMany({
      where:{id_organizacji:opts.orgId,data_usuniecia:null},
      select:{id:true,nazwa:true}
    }),
  ]);

  const rentById=new Map(raw.rents.map(r=>[text(r.NEW_rent_id),r]));
  const problems=[];

  const rentRows=raw.rents.map(r=>{
    const rr=resolveContractor(r,contractors,contacts);
    const st=statuses.find(s=>norm(s.nazwa)===norm(r.Status_NEW));
    const action=(!text(r.Klient)||rr.value)?'IMPORTUJ':'SPRAWDZ';
    if(action==='SPRAWDZ')problems.push({TYP:'KONTRAHENT',NEW_ID:text(r.NEW_rent_id),ZRODLO:text(r.Klient),PROBLEM:rr.method});
    return {
      AKCJA:action,
      NEW_rent_id:text(r.NEW_rent_id),
      Numer:text(r.Numer),
      Nazwa:text(r.Nazwa),
      Typ_NEW:text(r.Typ_NEW),
      Klient_NEW:text(r.Klient),
      EVE_KONTRAHENT_ID:rr.value?.id??'',
      EVE_KONTRAHENT:rr.value?.nazwa??'',
      MAPOWANIE_KONTRAHENTA:rr.method,
      Status_NEW:text(r.Status_NEW),
      EVE_STATUS_ID:st?.id??'',
      EVE_STATUS:st?.nazwa??'',
      Od:text(r.Od),
      Do:text(r.Do),
      EventManager_NEW:text(r.EventManager),
      Kontakt_NEW:text(r.Kontakt),
      Kontakt_email_NEW:text(r.Kontakt_email),
      Kontakt_telefon_NEW:text(r.Kontakt_telefon),
      Wartosc_NEW:text(r.Wartosc_NEW),
      Opis_NEW:text(r.Opis),
      Uwagi_NEW:text(r.Uwagi),
      URL:text(r.URL),
    };
  });

  const gearRows=raw.items.map(item=>{
    const rent=rentById.get(text(item.NEW_rent_id))||{};
    const rm=resolveModel(item.Model_NEW,models);
    const physical=parsePhysical(item.Fizyczne_NEW);
    const rp=resolvePhysical(physical,rm.value?.id,exemplars);
    let action=rm.value?'IMPORTUJ':'SPRAWDZ';
    if(!rm.value)problems.push({TYP:'MODEL',NEW_ID:`${text(item.NEW_rent_id)}/${text(item.NEW_gear_id)}`,ZRODLO:text(item.Model_NEW),PROBLEM:rm.method});
    if(physical.length&&rm.value&&!rp.ids.length){
      problems.push({TYP:'EGZEMPLARZE',NEW_ID:`${text(item.NEW_rent_id)}/${text(item.NEW_gear_id)}`,ZRODLO:text(item.Fizyczne_NEW),PROBLEM:rp.method});
    }
    return {
      AKCJA:action,
      NEW_rent_id:text(item.NEW_rent_id),
      Wynajem_NEW:text(rent.Nazwa),
      Numer_wynajmu_NEW:text(rent.Numer),
      NEW_assignment_id:text(item.NEW_assignment_id),
      NEW_gear_id:text(item.NEW_gear_id),
      Model_NEW:text(item.Model_NEW),
      Ilosc:text(item.Ilosc),
      EVE_MODEL_ID:rm.value?.id??'',
      EVE_MODEL:rm.value?.nazwa??'',
      MAPOWANIE_MODELU:rm.method,
      Fizyczne_NEW:text(item.Fizyczne_NEW),
      EVE_EGZEMPLARZE_IDS:rp.ids.join(','),
      MAPOWANIE_EGZEMPLARZY:rp.method,
      Kategoria_NEW:text(item.Kategoria_NEW),
      Komentarz_NEW:text(item.Komentarz),
      URL:text(item.URL),
    };
  });

  const vacationRows=raw.vacations.map(v=>{
    const ru=resolveUser(v.Pracownik,users);
    const action=ru.value?'IMPORTUJ':'SPRAWDZ';
    if(!ru.value)problems.push({TYP:'UZYTKOWNIK',NEW_ID:text(v.NEW_vacation_id),ZRODLO:text(v.Pracownik),PROBLEM:ru.method});
    return {
      AKCJA:action,
      NEW_vacation_id:text(v.NEW_vacation_id),
      Pracownik_NEW:text(v.Pracownik),
      EVE_USER_ID:ru.value?.id??'',
      EVE_USER:ru.value?`${ru.value.imie} ${ru.value.nazwisko}`:'',
      MAPOWANIE_UZYTKOWNIKA:ru.method,
      Typ_NEW:text(v.Typ_NEW),
      Stawka_NEW:text(v.Stawka_NEW),
      Od:text(v.Od),
      Do:text(v.Do),
      Status_NEW:text(v.Status_NEW),
      Info_NEW:text(v.Info),
      URL:text(v.URL),
    };
  });

  const wb=XLSX.utils.book_new();
  addSheet(wb,'01_Wynajmy',rentRows);
  addSheet(wb,'02_Sprzet',gearRows);
  addSheet(wb,'03_Urlopy',vacationRows);
  addSheet(wb,'99_Problemy',problems.length?problems:[{TYP:'OK',NEW_ID:'',ZRODLO:'',PROBLEM:'Brak nierozwiązanych mapowań'}]);
  XLSX.writeFile(wb,output);

  console.log('GOTOWE — BAZA NIE ZMIENIONA');
  console.log(`Wynajmy: ${rentRows.length}`);
  console.log(`Pozycje sprzętu: ${gearRows.length}`);
  console.log(`Urlopy: ${vacationRows.length}`);
  console.log(`Problemy: ${problems.length}`);
  console.log(`Excel do kontroli: ${output}`);
  console.log('');
  console.log('Do importu ustaw AKCJA=IMPORTUJ. POMIN = świadomie nie importuj.');
}
main().catch(e=>{console.error('\nBŁĄD KRYTYCZNY:');console.error(e);process.exitCode=1})
.finally(async()=>{await prisma.$disconnect()});
