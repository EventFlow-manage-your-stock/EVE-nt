'use client';
import Link from 'next/link';
import { Palette, Shield, SlidersHorizontal, Tags } from 'lucide-react';
import { PageTitle, Card } from '../../../components/ProductUI';

export default function SettingsPage(){
  return <div>
    <PageTitle eyebrow="Ustawienia" title="Personalizacja systemu" description="Konfiguracja widocznych elementów systemu: typy wydarzeń, statusy operacyjne, uprawnienia i personalizacja."/>
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
      <Card className="transition hover:border-cyan-200 hover:shadow-md">
        <Link href="/dashboard/settings/event-types" className="block">
          <Palette className="mb-3 text-cyan-600"/>
          <b>Typy wydarzeń</b>
          <p className="mt-2 text-sm text-slate-500">Edytuj nazwy, kolory i kolejność typów. Kolor typu steruje paskiem w kalendarzu.</p>
        </Link>
      </Card>
      <Card className="transition hover:border-cyan-200 hover:shadow-md">
        <Link href="/dashboard/settings/statuses" className="block">
          <Tags className="mb-3 text-cyan-600"/>
          <b>Statusy operacyjne</b>
          <p className="mt-2 text-sm text-slate-500">Edytuj statusy główne wydarzeń oraz statusy magazynowe i księgowe. Status ma ikonę, kolor i kolejność.</p>
        </Link>
      </Card>
      <Card className="transition hover:border-cyan-200 hover:shadow-md">
        <Link href="/dashboard/settings/permissions" className="block">
          <Shield className="mb-3 text-cyan-600"/>
          <b>Uprawnienia</b>
          <p className="mt-2 text-sm text-slate-500">Role i dostęp użytkowników.</p>
        </Link>
      </Card>
      <Card>
        <SlidersHorizontal className="mb-3 text-cyan-600"/>
        <b>Kolor systemu</b>
        <p className="mt-2 text-sm text-slate-500">Domyślny wariant 05 turkusowy. Rozbudujemy przy ustawieniach personalizacji.</p>
      </Card>
    </div>
  </div>
}
