'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Barcode from 'react-barcode';
import QRCode from 'react-qr-code';
import { api } from '../../../../lib/api';

function labelTitle(item: any) {
  const model = item.model?.nazwa || item.model_nazwa || '';
  const name = item.nazwa || model || `Sprzęt #${item.id}`;
  const nr = item.numer_egzemplarza || item.numer_urzadzenia;
  return nr ? `${name} (${nr})` : name;
}

function labelCode(item: any) {
  // Pobieramy priorytetowo kod własny, zewnętrzny lub generujemy fallback
  return item.zewnetrzny_kod_kreskowy || item.kod_kreskowy || item.zewnetrzny_qr_kod || item.qr_kod || item.sn || `EF-${item.id}`;
}

export default function LabelsPage() {
  const params = useSearchParams();
  const type = params.get('type') || 'qr'; // 'qr', 'barcode', 'both'
  const ids = (params.get('ids') || '').split(',').filter(Boolean).map(Number);
  const modelId = params.get('modelId');
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => { 
    api.get('/api/magazyn/wszystkie-egzemplarze')
      .then(r => setItems(r.data || []))
      .catch(() => setItems([])); 
  }, []);

  const data = useMemo(() => items.filter((i: any) => 
    ids.length ? ids.includes(i.id) : modelId ? String(i.id_modelu) === String(modelId) : true
  ), [items, ids.join(','), modelId]);

  return (
    <div className="min-h-screen bg-slate-100 text-black print:bg-white">
      <style>{`
        @page { size: A4; margin: 8mm; }
        @media print { 
          .no-print { display: none !important; } 
          body { background: white; } 
          .label-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
          .label { break-inside: avoid; page-break-inside: avoid; border: 1px dashed #ccc; padding: 4mm; border-radius: 8px;} 
        }
      `}</style>
      
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4 shadow-sm">
        <h1 className="text-xl font-black">Etykiety EventFlow</h1>
        <button onClick={() => window.print()} className="rounded-lg bg-cyan-600 px-5 py-2.5 font-bold text-white shadow-md hover:bg-cyan-700">Drukuj / Zapisz PDF</button>
      </div>

      <div className="mx-auto max-w-[210mm] bg-white p-6 shadow-xl print:shadow-none print:p-0 mt-6 print:mt-0">
        <div className="label-grid grid grid-cols-2 md:grid-cols-3 gap-4">
          {data.map((item: any) => {
            const code = labelCode(item);
            return (
              <section key={item.id} className="label flex flex-col items-center justify-center border border-slate-200 rounded-xl p-4 text-center bg-white h-[65mm]">
                <h2 className="mb-3 text-[14px] font-black uppercase tracking-wide leading-tight line-clamp-2">{labelTitle(item)}</h2>
                
                <div className="flex flex-col items-center justify-center flex-1 gap-2">
                  {(type === 'qr' || type === 'both') && (
                    <QRCode value={code} size={type === 'both' ? 65 : 100} />
                  )}
                  
                  {(type === 'barcode' || type === 'both') && (
                    <Barcode value={code} width={type === 'both' ? 1.2 : 1.8} height={type === 'both' ? 40 : 60} fontSize={12} margin={0} displayValue={true} />
                  )}
                </div>

                {type === 'qr' && <p className="mt-2 text-[10px] font-black tracking-wider text-slate-600">{code}</p>}
              </section>
            );
          })}
        </div>
        
        {data.length === 0 && <p className="p-12 text-center font-bold text-slate-400">Brak egzemplarzy do wygenerowania etykiet. Upewnij się, że zaznaczyłeś sprzęt.</p>}
      </div>
    </div>
  );
}