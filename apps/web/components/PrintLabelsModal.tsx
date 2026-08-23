'use client';

import React, { useState } from 'react';
import { QrCode, Barcode, Printer, Layers } from 'lucide-react';
import { SimpleModal } from './SimpleModal';
import { Button } from './ProductUI';

type PrintLabelsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  ids?: number[];
  modelId?: number;
};

export function PrintLabelsModal({ isOpen, onClose, ids, modelId }: PrintLabelsModalProps) {
  const [type, setType] = useState<'qr' | 'barcode' | 'both'>('qr');

  if (!isOpen) return null;

  function handlePrint() {
    const query = new URLSearchParams();
    query.set('type', type);
    if (ids?.length) query.set('ids', ids.join(','));
    if (modelId) query.set('modelId', String(modelId));
    
    window.open(`/dashboard/warehouse/labels?${query.toString()}`, '_blank', 'noopener,noreferrer');
    onClose();
  }

  return (
    <SimpleModal title="Generowanie Etykiet" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm font-bold text-slate-500">
          Wybierz format kodów, który ma zostać wygenerowany dla wybranych urządzeń. System automatycznie dopasuje układ do arkusza A4.
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          {/* Opcja: QR Kod */}
          <button
            type="button"
            onClick={() => setType('qr')}
            className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition text-center ${
              type === 'qr' ? 'border-cyan-500 bg-cyan-50 text-cyan-900' : 'border-slate-200 bg-white text-slate-500 hover:border-cyan-300 hover:bg-cyan-50/50'
            }`}
          >
            <QrCode size={32} className={type === 'qr' ? 'text-cyan-600' : 'text-slate-400'} />
            <div>
              <b className="block text-sm">Kod QR</b>
              <span className="text-[10px] font-bold opacity-80 mt-1 block leading-tight">Nowoczesny, zajmuje mało miejsca, łatwy do skanowania telefonem.</span>
            </div>
          </button>

          {/* Opcja: Kod kreskowy */}
          <button
            type="button"
            onClick={() => setType('barcode')}
            className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition text-center ${
              type === 'barcode' ? 'border-cyan-500 bg-cyan-50 text-cyan-900' : 'border-slate-200 bg-white text-slate-500 hover:border-cyan-300 hover:bg-cyan-50/50'
            }`}
          >
            <Barcode size={32} className={type === 'barcode' ? 'text-cyan-600' : 'text-slate-400'} />
            <div>
              <b className="block text-sm">Kod Kreskowy</b>
              <span className="text-[10px] font-bold opacity-80 mt-1 block leading-tight">Standardowy format, idealny dla fizycznych skanerów magazynowych.</span>
            </div>
          </button>

          {/* Opcja: Oba */}
          <button
            type="button"
            onClick={() => setType('both')}
            className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition text-center ${
              type === 'both' ? 'border-cyan-500 bg-cyan-50 text-cyan-900' : 'border-slate-200 bg-white text-slate-500 hover:border-cyan-300 hover:bg-cyan-50/50'
            }`}
          >
            <Layers size={32} className={type === 'both' ? 'text-cyan-600' : 'text-slate-400'} />
            <div>
              <b className="block text-sm">QR + Kreskowy</b>
              <span className="text-[10px] font-bold opacity-80 mt-1 block leading-tight">Maksymalna elastyczność. Generuje oba kody na jednej etykiecie.</span>
            </div>
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>Anuluj</Button>
          <Button onClick={handlePrint}>
            <Printer size={16} className="inline mr-2" />
            Generuj PDF do druku
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}