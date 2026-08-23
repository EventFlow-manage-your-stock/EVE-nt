#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'apps/web/components/EntityEditorPage.tsx');

if (!fs.existsSync(file)) {
  console.error('❌ Nie znaleziono pliku: apps/web/components/EntityEditorPage.tsx');
  console.error('Uruchom skrypt z katalogu głównego projektu EventFlow_v2.');
  process.exit(1);
}

let text = fs.readFileSync(file, 'utf8');
const before = text;

// 1) Jeśli defaultTabs istnieje, ale nie jest eksportowany — eksportujemy go.
text = text.replace(/(^|\n)\s*const\s+defaultTabs\s*=/, '$1export const defaultTabs =');

// 2) Jeśli dalej nie ma eksportu defaultTabs — dodajemy kompatybilny fallback po "use client".
if (!/export\s+const\s+defaultTabs\s*=/.test(text)) {
  const block = `
// EVENTFLOW_PATCH_03: domyślne zakładki dla stron edycji encji
// Używane m.in. przez /dashboard/service/[id] i /dashboard/crm/contacts/[id].
export const defaultTabs = [
  { id: 'dane', key: 'dane', label: 'Dane' },
  { id: 'notatki', key: 'notatki', label: 'Notatki' },
  { id: 'historia', key: 'historia', label: 'Historia' },
];
`;

  if (text.startsWith("'use client';")) {
    text = text.replace("'use client';", "'use client';\n" + block);
  } else if (text.startsWith('"use client";')) {
    text = text.replace('"use client";', '"use client";\n' + block);
  } else if (text.startsWith("'use client'")) {
    text = text.replace("'use client'", "'use client'\n" + block);
  } else if (text.startsWith('"use client"')) {
    text = text.replace('"use client"', '"use client"\n' + block);
  } else {
    text = block + '\n' + text;
  }
}

// 3) Dodatkowo usuwamy ewentualny duplicate import defaultTabs z samego EntityEditorPage w tym samym pliku — bezpiecznik.
text = text.replace(/import\s*\{\s*defaultTabs\s*\}\s*from\s*['\"]\.\/EntityEditorPage['\"];?\n/g, '');

if (text !== before) {
  fs.writeFileSync(file, text, 'utf8');
  console.log('✅ Naprawiono export defaultTabs w apps/web/components/EntityEditorPage.tsx');
} else {
  console.log('✅ defaultTabs już był poprawnie eksportowany — brak zmian.');
}

console.log('Gotowe. Wyczyść cache Nexta i odpal frontend ponownie.');
