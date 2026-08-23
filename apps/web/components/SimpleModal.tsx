'use client';

import React from 'react';

export function SimpleModal({ title, children, onClose, className }: { title: string; children: React.ReactNode; onClose: () => void; className?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 ${className || 'max-w-3xl'}`}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="rounded-xl px-3 py-1 text-2xl font-black text-slate-400 hover:bg-slate-100">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
