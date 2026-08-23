#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Eksporter wydarzeń z NEW Systems -> dane lokalne (CSV/JSON/HTML + załączniki).

Domyślny zakres testowy:
    2026-06-01 .. 2026-06-30

Przykład pełnego eksportu:
    python new_systems_events_export.py --from 2026-06-01 --to 2027-12-31

Pierwsze uruchomienie otworzy Chromium. Jeżeli NEW poprosi o logowanie,
zaloguj się normalnie i wróć do terminala. Sesja zostanie zachowana
w katalogu .newsystems-browser-profile.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import unicodedata
from dataclasses import dataclass, asdict
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlencode, urljoin, urlparse, unquote, parse_qsl

from bs4 import BeautifulSoup, Tag
from playwright.sync_api import sync_playwright, BrowserContext, APIResponse
import xlsxwriter


BASE_URL = "https://pixel.newsystems.pl"
DEFAULT_FROM = "2026-06-01"
DEFAULT_TO = "2026-06-30"
EXPORTER_VERSION = "4.0-FINAL"

FILE_EXT_RE = re.compile(
    r"\.(pdf|jpe?g|png|gif|webp|svg|docx?|xlsx?|xls|csv|txt|rtf|zip|rar|7z|pptx?|mp4|mov|avi|mkv|mp3|wav)(?:$|[?#])",
    re.I,
)


@dataclass
class EventListItem:
    internal_id: str
    list_no: str
    event_name_list: str
    event_name: str
    event_code: str
    accounting: str
    status: str
    client: str
    customer_id: str
    event_manager: str
    start: str
    end: str
    accounting_date: str
    created_at: str
    detail_url: str


def clean_text(value: str | None) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", value.replace("\xa0", " ")).strip()


def safe_filename(value: str, max_len: int = 120) -> str:
    value = unicodedata.normalize("NFC", value or "")
    value = re.sub(r"[\x00-\x1f\x7f]", " ", value)
    value = re.sub(r'[\\/:*?"<>|]', "_", value)
    value = re.sub(r"\s+", " ", value).strip(" ._")
    if len(value) > max_len:
        value = value[:max_len].rstrip(" ._")
    return value or "bez_nazwy"


def parse_pl_datetime(text: str) -> datetime | None:
    text = clean_text(text)
    for fmt in (
        "%d.%m.%Y, %H:%M",
        "%d.%m.%Y %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
    ):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            pass
    return None


def iso_dt(dt: datetime | None) -> str:
    return dt.isoformat(sep=" ") if dt else ""


def parse_range_cell(td: Tag) -> tuple[str, str]:
    texts = list(td.stripped_strings)
    if len(texts) >= 2:
        s = parse_pl_datetime(texts[0])
        e = parse_pl_datetime(texts[1])
        return iso_dt(s), iso_dt(e)

    text = clean_text(td.get_text(" ", strip=True))
    matches = re.findall(r"\d{2}\.\d{2}\.\d{4},?\s+\d{2}:\d{2}", text)
    if len(matches) >= 2:
        return iso_dt(parse_pl_datetime(matches[0])), iso_dt(parse_pl_datetime(matches[1]))
    return "", ""


def split_event_name_code(name: str) -> tuple[str, str]:
    name = clean_text(name)
    m = re.search(r"\s*\[([^\]]+)\]\s*$", name)
    if not m:
        return name, ""
    return name[: m.start()].strip(), m.group(1).strip()


def parse_event_list(html: str, base_url: str = BASE_URL) -> list[EventListItem]:
    """Parser listy wydarzeń oparty o data-col-seq, a nie pozycję <td>."""
    soup = BeautifulSoup(html, "lxml")
    out: list[EventListItem] = []
    for tr in soup.select("tbody tr.events-grid"):
        link = tr.select_one("a.event-class[data-id]")
        if not link:
            continue
        by_seq: dict[str, Tag] = {}
        for td in tr.find_all("td", recursive=False):
            seq = td.get("data-col-seq")
            if seq is not None:
                by_seq[str(seq)] = td
        def cell(seq: str) -> Tag | None:
            return by_seq.get(seq)
        internal_id = clean_text(link.get("data-id"))
        event_name_list = clean_text(link.get_text(" ", strip=True))
        event_name, event_code = split_event_name_code(event_name_list)
        customer_id = clean_text(str(link.get("data-customer", "")))
        if not customer_id:
            customer_link = cell("6").find("a", href=True) if cell("6") else None
            if customer_link:
                m_customer = re.search(r"/admin/customer/view\?id=(\d+)", customer_link.get("href", ""))
                customer_id = m_customer.group(1) if m_customer else ""
        range_td = cell("8")
        start_dt, end_dt = parse_range_cell(range_td) if range_td else ("", "")
        out.append(EventListItem(
            internal_id=internal_id,
            list_no=clean_text(cell("3").get_text(" ", strip=True)) if cell("3") else "",
            event_name_list=event_name_list,
            event_name=event_name,
            event_code=event_code,
            accounting=clean_text(cell("0").get_text(" ", strip=True)) if cell("0") else "",
            status=clean_text(cell("1").get_text(" ", strip=True)) if cell("1") else "",
            client=clean_text(cell("6").get_text(" ", strip=True)) if cell("6") else "",
            customer_id=customer_id,
            event_manager=clean_text(cell("7").get_text(" ", strip=True)) if cell("7") else "",
            start=start_dt,
            end=end_dt,
            accounting_date=clean_text(cell("9").get_text(" ", strip=True)) if cell("9") else "",
            created_at=clean_text(cell("10").get_text(" ", strip=True)) if cell("10") else "",
            detail_url=urljoin(base_url, link.get("href", "")),
        ))
    return out

def selected_value(select: Tag | None) -> str:
    if not select:
        return ""
    opt = select.find("option", selected=True)
    if opt:
        return clean_text(opt.get_text(" ", strip=True))
    return ""


def html_fragment_to_text(value: str | None) -> str:
    if not value:
        return ""
    frag = BeautifulSoup(value, "html.parser")
    text = frag.get_text("\n", strip=True)
    lines = [clean_text(line) for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def extract_event_details(soup: BeautifulSoup) -> dict[str, Any]:
    description_node = (soup.select_one('textarea[name="Event[description]"]')
                        or soup.select_one('#first-editor-note-hidden')
                        or soup.select_one('#first-editor-note'))
    details_node = (soup.select_one('textarea[name="Event[details]"]')
                    or soup.select_one('#second-editor-note-hidden')
                    or soup.select_one('#second-editor-note'))
    description = html_fragment_to_text(description_node.get_text() if description_node else "")
    details = html_fragment_to_text(details_node.get_text() if details_node else "")
    custom_fields: dict[str, str] = {}
    for field in soup.select('.event-field'):
        field_id = field.get('id', '')
        label = soup.find('label', attrs={'for': field_id}) if field_id else None
        name = clean_text(label.get_text(' ', strip=True)) if label else clean_text(field.get('name', ''))
        if not name:
            name = f"Pole {clean_text(str(field.get('data-id', '')))}".strip()
        if field.name == 'select':
            value = selected_value(field)
        elif field.name == 'textarea':
            value = html_fragment_to_text(field.get_text())
        else:
            value = clean_text(field.get('value', ''))
        if name:
            custom_fields[name] = value
    return {'description': description, 'details': details, 'custom_fields': custom_fields}


def parse_location(soup: BeautifulSoup) -> str:
    dojazd = next((h for h in soup.find_all(['h3','h4'])
                   if clean_text(h.get_text(' ', strip=True)).lower() == 'dojazd'), None)
    candidates: list[Tag] = []
    if dojazd:
        nxt = dojazd.find_next_sibling()
        while nxt is not None and len(candidates) < 4:
            if isinstance(nxt, Tag):
                candidates.append(nxt)
                if nxt.name in {'hr','h3','h4'}:
                    break
            nxt = nxt.find_next_sibling()
    if not candidates:
        candidates = list(soup.find_all('p', class_='text-new'))
    for node in candidates:
        raw = node.get_text('\n', strip=True)
        lines = [clean_text(x) for x in raw.splitlines() if clean_text(x)]
        for i, line in enumerate(lines):
            if re.fullmatch(r'MIEJSCE\s*:?', line, flags=re.I):
                vals = []
                for nxt_line in lines[i+1:]:
                    if nxt_line.upper().startswith('STATUS:'):
                        break
                    if re.fullmatch(r'[A-ZĄĆĘŁŃÓŚŹŻ _-]+\s*:?', nxt_line) and nxt_line.endswith(':'):
                        break
                    vals.append(nxt_line)
                if vals:
                    return clean_text(' '.join(vals))
            m = re.match(r'MIEJSCE\s*:\s*(.+)$', line, flags=re.I)
            if m:
                return clean_text(m.group(1))
    return ''


def parse_status(soup: BeautifulSoup) -> str:
    row = soup.select_one('.event-status-row')
    if not row:
        return ''
    label = row.select_one('.ns-status-label')
    return clean_text(label.get_text(' ', strip=True)) if label else ''


def _field_visible_value(field: Tag) -> str:
    if field.name == "select":
        return selected_value(field)
    if field.name == "textarea":
        return html_fragment_to_text(field.get_text())
    return clean_text(field.get("value", ""))


def _form_field_label(soup: BeautifulSoup, field: Tag) -> str:
    ident = field.get("id", "")
    label = soup.find("label", attrs={"for": ident}) if ident else None
    if not label:
        group = field.find_parent(class_=lambda c: c and "form-group" in str(c))
        if group:
            label = group.find("label")
    return clean_text(label.get_text(" ", strip=True)) if label else ""


def _compose_location(venue: str = "", city: str = "", address: str = "") -> str:
    """Składa lokalizację bez duplikatów: obiekt, miasto, adres."""
    venue = clean_text(venue)
    city = clean_text(city)
    address = clean_text(address)

    # NEW często pokazuje wybraną lokalizację już jako "Obiekt, Miasto".
    # Rozbijamy to, żeby później móc dopisać pełny adres.
    if venue and not city and "," in venue:
        vparts = [clean_text(x) for x in venue.split(",") if clean_text(x)]
        if len(vparts) >= 2:
            venue = vparts[0]
            city = vparts[1]
            if len(vparts) >= 3 and not address:
                address = ", ".join(vparts[2:])

    # Jeśli venue kończy się już nazwą miasta, usuń tę część z venue.
    if venue and city:
        suffix = ", " + city
        if venue.casefold().endswith(suffix.casefold()):
            venue = venue[:-len(suffix)].strip(' ,')

    parts: list[str] = []
    for value in (venue, city, address):
        value = clean_text(value).strip(' ,')
        if not value:
            continue
        if any(value.casefold() == p.casefold() for p in parts):
            continue
        # Nie dodawaj wartości, która jest już dokładnym końcowym fragmentem poprzedniej.
        if any(p.casefold().endswith(', ' + value.casefold()) for p in parts):
            continue
        parts.append(value)
    return ", ".join(parts)


def _location_form_scope(soup: BeautifulSoup) -> Tag | BeautifulSoup:
    """Ogranicza wyszukiwanie do formularza edycji wydarzenia, jeśli jest dostępny."""
    forms = soup.find_all('form')
    for form in forms:
        action = clean_text(form.get('action', ''))
        ident = clean_text(form.get('id', ''))
        if '/admin/event/update' in action or re.search(r'event.*form', ident, re.I):
            return form
    return soup


def parse_location_ref_from_update(html: str) -> dict[str, str]:
    """
    Odczytuje z formularza wydarzenia wybraną lokalizację i jej ID.
    Zwraca: location_id, venue, city, address.
    """
    soup = BeautifulSoup(html, 'lxml')
    root = _location_form_scope(soup)
    venue = ''
    city = ''
    address = ''
    location_id = ''

    location_words = r'miejsce|lokalizac|location|venue|place|obiekt'
    city_words = r'miasto|city'
    address_words = r'adres|address|ulica|street'

    for field in root.find_all(['input', 'select', 'textarea']):
        name = clean_text(field.get('name', ''))
        ident = clean_text(field.get('id', ''))
        label = _form_field_label(soup, field)
        placeholder = clean_text(field.get('placeholder', ''))
        key = f'{name} {ident} {label} {placeholder}'.lower()
        value = _field_visible_value(field)

        if re.search(city_words, key, re.I) and value:
            city = city or value
            continue
        if re.search(address_words, key, re.I) and value:
            address = address or value
            continue

        if re.search(location_words, key, re.I):
            if re.search(r'lat|lng|longitude|latitude|koord|gps', key, re.I):
                continue
            if value and value.lower() not in {'wybierz', 'wybierz miejsce', '-', 'brak'}:
                venue = venue or value

            raw_value = clean_text(field.get('value', ''))
            if field.name == 'select':
                opt = field.find('option', selected=True)
                if opt:
                    raw_value = clean_text(opt.get('value', ''))
                    venue = venue or clean_text(opt.get_text(' ', strip=True))
                    city = city or clean_text(opt.get('data-city', '') or opt.get('data-miasto', ''))
                    address = address or clean_text(
                        opt.get('data-address', '') or opt.get('data-adres', '') or
                        opt.get('data-street', '') or opt.get('data-ulica', '')
                    )
            if raw_value.isdigit() and not location_id:
                location_id = raw_value

    # NEW potrafi trzymać id lokalizacji w ukrytym polu bez czytelnej etykiety.
    if not location_id:
        for field in root.find_all(['input', 'select']):
            key = f"{field.get('name','')} {field.get('id','')}".lower()
            if not re.search(location_words, key, re.I):
                continue
            raw = clean_text(field.get('value', ''))
            if field.name == 'select':
                opt = field.find('option', selected=True)
                raw = clean_text(opt.get('value', '')) if opt else raw
            if raw.isdigit():
                location_id = raw
                break

    return {
        'location_id': location_id,
        'venue': venue,
        'city': city,
        'address': address,
        'location': _compose_location(venue, city, address),
    }


def parse_full_location_from_update(html: str) -> str:
    return parse_location_ref_from_update(html).get('location', '')


def parse_location_details_page(html: str) -> dict[str, str]:
    """Wyciąga nazwę, miasto i adres z karty/edycji miejsca NEW."""
    soup = BeautifulSoup(html, 'lxml')
    venue = ''
    city = ''
    address = ''

    # 1) Formularze / pola wejściowe.
    for field in soup.find_all(['input', 'select', 'textarea']):
        label = _form_field_label(soup, field)
        key = f"{field.get('name','')} {field.get('id','')} {label} {field.get('placeholder','')}".lower()
        value = _field_visible_value(field)
        if not value:
            continue
        if re.search(r'miasto|city', key, re.I):
            city = city or value
        elif re.search(r'adres|address|ulica|street', key, re.I):
            address = address or value
        elif re.search(r'nazwa|name|miejsce|lokalizac|venue|place|obiekt', key, re.I):
            if not re.search(r'lat|lng|longitude|latitude|gps', key, re.I):
                venue = venue or value

    # 2) Typowy Yii DetailView: <th>Nazwa</th><td>...</td>.
    for tr in soup.find_all('tr'):
        cells = tr.find_all(['th', 'td'], recursive=False)
        if len(cells) < 2:
            continue
        label = clean_text(cells[0].get_text(' ', strip=True)).lower().rstrip(':')
        value = clean_text(cells[1].get_text(' ', strip=True))
        if not value:
            continue
        if re.search(r'^miasto$|\bcity\b', label, re.I):
            city = city or value
        elif re.search(r'adres|ulica|address|street', label, re.I):
            address = address or value
        elif re.search(r'^nazwa$|miejsce|lokalizac|venue|place|obiekt', label, re.I):
            venue = venue or value

    # 3) Definition list / zwykłe bloki label:value.
    for node in soup.find_all(['div', 'p', 'li']):
        text = clean_text(node.get_text(' ', strip=True))
        if len(text) > 250:
            continue
        m = re.match(r'^(Nazwa|Miejsce|Obiekt)\s*:\s*(.+)$', text, re.I)
        if m:
            venue = venue or clean_text(m.group(2))
        m = re.match(r'^Miasto\s*:\s*(.+)$', text, re.I)
        if m:
            city = city or clean_text(m.group(1))
        m = re.match(r'^(Adres|Ulica)\s*:\s*(.+)$', text, re.I)
        if m:
            address = address or clean_text(m.group(2))

    return {
        'venue': venue,
        'city': city,
        'address': address,
        'location': _compose_location(venue, city, address),
    }

def parse_nip_from_text(text: str) -> str:
    if not text:
        return ""
    # Polski NIP: 10 cyfr, opcjonalnie separatory.
    m = re.search(r"\bNIP\s*:?\s*([0-9][0-9\s.-]{8,16}[0-9])", text, re.I)
    if not m:
        return ""
    digits = re.sub(r"\D", "", m.group(1))
    return digits if len(digits) == 10 else clean_text(m.group(1))


def parse_customer_nip(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    # 1. Dedykowane pole formularza.
    for field in soup.find_all(["input", "textarea", "select"]):
        key = f"{field.get('name','')} {field.get('id','')} {_form_field_label(soup, field)}"
        if re.search(r"\bnip\b|tax.?id", key, re.I):
            value = _field_visible_value(field)
            nip = re.sub(r"\D", "", value)
            if len(nip) == 10:
                return nip
            if value:
                return clean_text(value)

    # 2. Wiersz/etykieta w widoku klienta.
    for row in soup.find_all(["tr", "div", "p", "li"]):
        txt = clean_text(row.get_text(" ", strip=True))
        if "nip" not in txt.lower():
            continue
        nip = parse_nip_from_text(txt)
        if nip:
            return nip

    return parse_nip_from_text(soup.get_text(" ", strip=True))


def extract_customer_id_from_event_html(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        m = re.search(r"/admin/customer/view\?id=(\d+)", href)
        if m:
            parent_text = clean_text(a.parent.get_text(" ", strip=True)) if a.parent else ""
            if "klient" in parent_text.lower():
                return m.group(1)
    return ""

def parse_event_header(html: str, list_item: EventListItem | None = None) -> dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")

    result: dict[str, Any] = {
        "internal_id": list_item.internal_id if list_item else "",
        "name": list_item.event_name if list_item else "",
        "event_code": list_item.event_code if list_item else "",
        "type": "",
        "location": "",
        "accounting": list_item.accounting if list_item else "",
        "status": list_item.status if list_item else "",
        "client": list_item.client if list_item else "",
        "client_nip": "",
        "event_manager": list_item.event_manager if list_item else "",
        "start": list_item.start if list_item else "",
        "end": list_item.end if list_item else "",
    }

    # Nazwa + termin
    term = soup.select_one("#event-termin")
    if term:
        text = clean_text(term.get_text(" ", strip=True))
        m = re.search(
            r"Termin:\s*(\d{2}\.\d{2}\.\d{4},\s*\d{2}:\d{2})\s*-\s*(\d{2}\.\d{2}\.\d{4},\s*\d{2}:\d{2})",
            text,
        )
        if m:
            result["start"] = iso_dt(parse_pl_datetime(m.group(1)))
            result["end"] = iso_dt(parse_pl_datetime(m.group(2)))

        h4 = term.find_parent("h4")
        if h4:
            own_texts = []
            for child in h4.contents:
                if isinstance(child, str):
                    own_texts.append(child)
                elif isinstance(child, Tag) and child.name == "br":
                    break
            candidate = clean_text(" ".join(own_texts))
            if candidate:
                result["name"] = candidate

    # Kod E...
    code = soup.select_one(".ibox-tools .label")
    if code:
        m = re.search(r"ID:\s*(.+)", clean_text(code.get_text(" ", strip=True)))
        if m:
            result["event_code"] = m.group(1).strip()

    # Klient
    client_h = next(
        (x for x in soup.find_all("h4") if clean_text(x.get_text(" ", strip=True)).startswith("Klient:")),
        None,
    )
    if client_h:
        raw_client_text = clean_text(client_h.get_text(" ", strip=True))
        inline_nip = parse_nip_from_text(raw_client_text)
        if inline_nip:
            result["client_nip"] = inline_nip
        text = re.sub(r"^Klient:\s*", "", raw_client_text)
        # NIP trafia do osobnej kolumny, więc usuwamy go z nazwy klienta.
        text = re.sub(r"\s*\(NIP:\s*[^)]*\)\s*$", "", text).strip()
        if text:
            result["client"] = text

    # Miejsce i status — osobne pola DOM.
    location = parse_location(soup)
    if location:
        result["location"] = location
    status = parse_status(soup)
    if status:
        result["status"] = status

    # Księgowe
    accounting_select = soup.select_one('.status-list-view select[name="status5"]')
    acc = selected_value(accounting_select)
    if acc:
        result["accounting"] = acc

    # EventManager
    for profile in soup.select(".profile-info"):
        if "EventManager" in clean_text(profile.get_text(" ", strip=True)):
            h4s = profile.find_all("h4")
            for h in h4s:
                txt = clean_text(h.get_text(" ", strip=True))
                if txt and txt != "EventManager":
                    result["event_manager"] = txt
                    break
            if result["event_manager"]:
                break

    readable = extract_event_details(soup)
    result["description"] = readable["description"]
    result["details"] = readable["details"]
    result["custom_fields"] = readable["custom_fields"]

    # Harmonogram
    result["schedule"] = parse_schedule(soup)

    return result


def parse_schedule(soup: BeautifulSoup) -> list[dict[str, str]]:
    schedules = []
    for form in soup.select('form[id^="schedule-"]'):
        sid = ""
        inp_id = form.select_one('input[name="EventSchedule[id]"]')
        if inp_id:
            sid = clean_text(inp_id.get("value"))

        start = form.select_one('input[name="EventSchedule[start_time]"]')
        end = form.select_one('input[name="EventSchedule[end_time]"]')

        row = form.find_parent("div", class_=lambda c: c and "row-bookmark" in c)
        label = ""
        if row:
            # Pierwszy sensowny tekst w wierszu (np. Montaż / Event / Demontaż)
            strings = [clean_text(x) for x in row.stripped_strings]
            strings = [x for x in strings if x]
            if strings:
                label = strings[0]

        schedules.append(
            {
                "id": sid,
                "name": label,
                "start": clean_text(start.get("value")) if start else "",
                "end": clean_text(end.get("value")) if end else "",
            }
        )
    return schedules


def parse_event_type_from_update(html: str) -> dict[str, str]:
    """
    NEW nie pokazuje typu w dostarczonym widoku wydarzenia.
    Próbujemy odczytać go z formularza edycji po nazwie pola Event[...].
    Zwracamy także nazwę pola, żeby łatwo zweryfikować mapowanie.
    """
    soup = BeautifulSoup(html, "lxml")
    candidates = []

    for select in soup.find_all("select"):
        name = select.get("name", "")
        ident = select.get("id", "")
        hay = f"{name} {ident}".lower()
        if not name.startswith("Event["):
            continue
        score = 0
        if "model" in hay:
            score += 5
        if "type" in hay or "rodzaj" in hay:
            score += 4
        if score:
            val = selected_value(select)
            if val:
                candidates.append((score, name or ident, val))

    for inp in soup.find_all("input"):
        name = inp.get("name", "")
        ident = inp.get("id", "")
        hay = f"{name} {ident}".lower()
        if not name.startswith("Event["):
            continue
        if "model" in hay or "type" in hay or "rodzaj" in hay:
            val = clean_text(inp.get("value"))
            if val:
                candidates.append((2, name or ident, val))

    candidates.sort(key=lambda x: x[0], reverse=True)
    if not candidates:
        return {"type": "", "field": ""}
    return {"type": candidates[0][2], "field": candidates[0][1]}


def serialize_controls(cell: Tag) -> list[dict[str, Any]]:
    controls = []
    for x in cell.find_all(["input", "select", "textarea"]):
        item: dict[str, Any] = {
            "tag": x.name,
            "name": x.get("name", ""),
            "id": x.get("id", ""),
        }
        if x.name == "select":
            item["selected"] = [
                clean_text(o.get_text(" ", strip=True))
                for o in x.find_all("option", selected=True)
            ]
            item["values"] = [o.get("value", "") for o in x.find_all("option", selected=True)]
        elif x.name == "textarea":
            item["value"] = clean_text(x.get_text())
        else:
            item["value"] = x.get("value", "")
            item["checked"] = x.has_attr("checked")
        controls.append(item)
    return controls


def serialize_table(table: Tag) -> dict[str, Any]:
    headers = [clean_text(th.get_text(" ", strip=True)) for th in table.find_all("th")]
    rows = []

    body_rows = table.select("tbody tr")
    if not body_rows:
        body_rows = table.find_all("tr")[1:]

    for tr in body_rows:
        cells = []
        for td in tr.find_all(["td", "th"], recursive=False):
            links = []
            for a in td.find_all("a", href=True):
                links.append(
                    {
                        "text": clean_text(a.get_text(" ", strip=True)),
                        "href": a.get("href", ""),
                        "data": {k: v for k, v in a.attrs.items() if k.startswith("data-")},
                    }
                )
            cells.append(
                {
                    "text": clean_text(td.get_text(" ", strip=True)),
                    "links": links,
                    "controls": serialize_controls(td),
                    "data": {k: v for k, v in td.attrs.items() if k.startswith("data-")},
                }
            )
        if cells:
            rows.append(
                {
                    "data_key": tr.get("data-key", ""),
                    "cells": cells,
                }
            )

    return {
        "id": table.get("id", ""),
        "class": table.get("class", []),
        "headers": headers,
        "rows": rows,
    }


def serialize_section_html(html: str, selector: str | None = None) -> dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    root: Tag | BeautifulSoup | None = soup.select_one(selector) if selector else soup
    if not root:
        return {"found": False, "text": "", "tables": [], "links": []}

    tables = [serialize_table(t) for t in root.find_all("table")]
    links = [
        {
            "text": clean_text(a.get_text(" ", strip=True)),
            "href": a.get("href", ""),
            "data": {k: v for k, v in a.attrs.items() if k.startswith("data-")},
        }
        for a in root.find_all("a", href=True)
    ]
    return {
        "found": True,
        "text": clean_text(root.get_text(" ", strip=True)),
        "tables": tables,
        "links": links,
    }


def write_section_html(html: str, selector: str | None, path: Path) -> None:
    soup = BeautifulSoup(html, "lxml")
    root = soup.select_one(selector) if selector else soup
    if root:
        path.write_text(str(root), encoding="utf-8")
    else:
        path.write_text("<!-- sekcja nie została znaleziona -->\n", encoding="utf-8")


def table_to_csv(table_obj: dict[str, Any], path: Path) -> None:
    headers = table_obj.get("headers", [])
    rows = table_obj.get("rows", [])
    max_cells = max([len(r.get("cells", [])) for r in rows] + [len(headers), 0])
    if not headers:
        headers = [f"kolumna_{i+1}" for i in range(max_cells)]
    elif len(headers) < max_cells:
        headers = headers + [f"kolumna_{i+1}" for i in range(len(headers), max_cells)]

    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(headers)
        for row in rows:
            vals = [c.get("text", "") for c in row.get("cells", [])]
            vals += [""] * (len(headers) - len(vals))
            w.writerow(vals[: len(headers)])


def save_section(section_name: str, html: str, selector: str | None, event_dir: Path) -> dict[str, Any]:
    section = serialize_section_html(html, selector)
    write_section_html(html, selector, event_dir / f"{section_name}.html")

    tables_dir = event_dir / "tables"
    tables_dir.mkdir(exist_ok=True)
    for idx, table in enumerate(section.get("tables", []), start=1):
        table_to_csv(table, tables_dir / f"{section_name}_{idx:02d}.csv")
    return section


def extract_attachment_candidates(html: str, selector: str = "#tab-attachment") -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "lxml")
    root = soup.select_one(selector)
    if not root:
        return []

    items: list[dict[str, str]] = []
    seen: set[str] = set()

    # Najpierw standardowa tabela attachmentTable: znamy ID i nazwę.
    for tr in root.select("tr[data-key]"):
        attachment_id = clean_text(tr.get("data-key"))
        filename = ""
        filename_cell = tr.select_one('td[data-col-seq="2"]')
        if filename_cell:
            filename = clean_text(filename_cell.get_text(" ", strip=True))

        dl = next(
            (
                a
                for a in tr.find_all("a", href=True)
                if "/admin/attachment/download" in a.get("href", "")
            ),
            None,
        )
        if dl:
            url = dl.get("href", "")
            key = urljoin(BASE_URL, url)
            if key not in seen:
                seen.add(key)
                items.append(
                    {
                        "attachment_id": attachment_id,
                        "filename": filename,
                        "url": key,
                        "source": "attachment_download",
                    }
                )
            continue

        # Fallback: bez endpointu download, np. plik czatu / bezpośredni uploads.
        for a in tr.find_all("a", href=True):
            href = a.get("href", "")
            absolute = urljoin(BASE_URL, href)
            if "/uploads/" in absolute or FILE_EXT_RE.search(absolute):
                if absolute not in seen:
                    seen.add(absolute)
                    items.append(
                        {
                            "attachment_id": attachment_id,
                            "filename": filename or filename_from_url(absolute),
                            "url": absolute,
                            "source": "direct",
                        }
                    )
                break

    # Druga tabela / pliki z czatu i inne linki plikowe.
    for a in root.find_all("a", href=True):
        # Jeśli link należy do standardowego wiersza, który ma endpoint download,
        # nie dodajemy drugi raz linku podglądu /uploads/ ani obrazka.
        parent_tr = a.find_parent("tr")
        if parent_tr and parent_tr.get("data-key"):
            if parent_tr.find("a", href=lambda h: h and "/admin/attachment/download" in h):
                continue

        href = a.get("href", "")
        absolute = urljoin(BASE_URL, href)
        if absolute in seen:
            continue
        if "/admin/attachment/download" in absolute or "/uploads/" in absolute or FILE_EXT_RE.search(absolute):
            seen.add(absolute)
            items.append(
                {
                    "attachment_id": clean_text(a.get("data-model")),
                    "filename": clean_text(a.get_text(" ", strip=True)) or filename_from_url(absolute),
                    "url": absolute,
                    "source": "direct_scan",
                }
            )

    return items


def filename_from_url(url: str) -> str:
    path = unquote(urlparse(url).path)
    return os.path.basename(path) or "plik"


def filename_from_content_disposition(headers: dict[str, str]) -> str:
    cd = headers.get("content-disposition", "") or headers.get("Content-Disposition", "")
    if not cd:
        return ""
    m = re.search(r"filename\*=UTF-8''([^;]+)", cd, re.I)
    if m:
        return unquote(m.group(1)).strip('"')
    m = re.search(r'filename="?([^";]+)"?', cd, re.I)
    if m:
        return m.group(1).strip()
    return ""


def month_iter(start: date, end: date) -> Iterable[tuple[int, int]]:
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        yield y, m
        if m == 12:
            y += 1
            m = 1
        else:
            m += 1


def in_requested_range(item: EventListItem, start: date, end: date) -> bool:
    s = datetime.fromisoformat(item.start).date() if item.start else None
    if not s:
        return True
    # Zakres rozumiemy jako datę rozpoczęcia wydarzenia.
    return start <= s <= end


def _parse_quantity(raw: str) -> float | int:
    raw = clean_text(raw).replace(" ", "").replace(",", ".")
    if not raw:
        return 0
    try:
        value = float(raw)
        return int(value) if value.is_integer() else value
    except ValueError:
        return 0


def parse_event_gear_rows(html: str) -> list[dict[str, Any]]:
    """
    Jedna pozycja na model sprzętu w wydarzeniu.
    Ilość jest sumowana, jeśli ten sam model pojawia się w kilku packlistach/grupach.
    """
    soup = BeautifulSoup(html, "lxml")
    aggregated: dict[tuple[str, str], dict[str, Any]] = {}
    seen_rows: set[tuple[str, str, str]] = set()

    for tr in soup.select('tr.packlist-gear-row[data-gear-id]'):
        gear_id = clean_text(str(tr.get('data-gear-id', '')))
        link = tr.select_one('a.gear-info-link')
        name = clean_text(link.get_text(' ', strip=True)) if link else ''
        if not name:
            td_name = tr.select_one('td[data-col-seq="4"]')
            name = clean_text(td_name.get_text(' ', strip=True)) if td_name else ''
        if not gear_id or not name:
            continue

        packlist_id = clean_text(str(tr.get('data-packlist', '')))
        row_id = clean_text(str(tr.get('data-key', '')))
        row_key = (packlist_id, row_id, gear_id)
        if row_key in seen_rows:
            continue
        seen_rows.add(row_key)

        qty_field = tr.select_one('input[name="GearAssignmentPacklist[quantity]"]')
        if not qty_field:
            qty_field = tr.select_one('td[data-col-seq="5"] input.gear-quantity')
        if qty_field:
            quantity = _parse_quantity(qty_field.get('value', ''))
        else:
            td_qty = tr.select_one('td[data-col-seq="5"]')
            quantity = _parse_quantity(td_qty.get_text(' ', strip=True) if td_qty else '')

        key = (gear_id, name)
        if key not in aggregated:
            aggregated[key] = {
                'gear_id': gear_id,
                'name': name,
                'quantity': quantity,
                'packlist_id': packlist_id,
                'packlist_gear_id': row_id,
            }
        else:
            aggregated[key]['quantity'] = (aggregated[key].get('quantity') or 0) + quantity

    return list(aggregated.values())

def parse_barcode_from_gear_info(html: str) -> str:
    soup = BeautifulSoup(html, 'lxml')
    for label in soup.find_all('label'):
        lt = clean_text(label.get_text(' ', strip=True))
        if not re.search(r'kod\s*kresk|barcode|bar\s*code', lt, re.I):
            continue
        target = label.get('for')
        field = soup.find(id=target) if target else None
        if field:
            if field.name == 'select': val = selected_value(field)
            elif field.name == 'textarea': val = clean_text(field.get_text())
            else: val = clean_text(field.get('value', ''))
            if val: return val
    for row in soup.find_all(['tr','div']):
        txt = clean_text(row.get_text(' ', strip=True))
        if not re.search(r'kod\s*kresk|barcode|bar\s*code', txt, re.I):
            continue
        cells = row.find_all(['th','td'], recursive=False)
        if len(cells) >= 2:
            val = clean_text(cells[-1].get_text(' ', strip=True))
            if val and not re.search(r'kod\s*kresk|barcode|bar\s*code', val, re.I):
                return val
    for field in soup.find_all(['input','textarea','select']):
        ident = f"{field.get('name','')} {field.get('id','')}"
        if not re.search(r'barcode|bar.?code|kod.?kresk', ident, re.I):
            continue
        if field.name == 'select': val = selected_value(field)
        elif field.name == 'textarea': val = clean_text(field.get_text())
        else: val = clean_text(field.get('value', ''))
        if val: return val
    text = soup.get_text('\n', strip=True)
    m = re.search(r'(?:Kod\s*kreskowy|Barcode|Bar\s*code)\s*:?\s*([^\n\r]+)', text, re.I)
    return clean_text(m.group(1)) if m else ''


def section_to_readable_text(section: dict[str, Any] | None) -> str:
    if not section:
        return ''
    lines: list[str] = []
    for table in section.get('tables', []) or []:
        headers = [clean_text(x) for x in table.get('headers', []) or []]
        for row in table.get('rows', []) or []:
            cells = row.get('cells', []) or []
            values: list[str] = []
            for i, cell in enumerate(cells):
                val = clean_text(str(cell.get('text', '')))
                header = headers[i] if i < len(headers) else ''
                if not val:
                    continue
                if 'Brak wyników' in val:
                    continue
                if header in {'#','Zdjęcie',''} and not re.search(r'[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]', val):
                    continue
                values.append(f"{header}: {val}" if header else val)
            if values:
                lines.append(' | '.join(values))
    if lines:
        return '\n'.join(lines)
    return ''


def parse_offer_rows(html: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, 'lxml')
    result: list[dict[str, str]] = []
    seen: set[str] = set()
    for tr in soup.select('tr[data-key]'):
        view = tr.select_one('a.system-link[href*="/admin/offer/default/view?id="]')
        if not view:
            continue
        offer_id = clean_text(str(tr.get('data-key', '')))
        if not offer_id:
            m = re.search(r'[?&]id=(\d+)', view.get('href', ''))
            offer_id = m.group(1) if m else ''
        if not offer_id or offer_id in seen:
            continue
        seen.add(offer_id)
        def col(seq: str) -> str:
            td = tr.select_one(f'td[data-col-seq="{seq}"]')
            return clean_text(td.get_text(' ', strip=True)) if td else ''
        result.append({
            'offer_id': offer_id,
            'name': clean_text(view.get_text(' ', strip=True)),
            'date': col('2'),
            'prepared_by': col('3'),
            'status': col('4'),
            'total': col('11'),
            'view_url': urljoin(BASE_URL, view.get('href', '')),
        })
    return result


def discover_offer_view_urls(html: str) -> list[str]:
    soup = BeautifulSoup(html, 'lxml')
    urls: list[str] = []
    for a in soup.find_all('a', href=True):
        href = urljoin(BASE_URL, a.get('href', ''))
        if '/admin/offer/default/view?' in href and re.search(r'[?&]id=\d+', href):
            urls.append(href)
    return list(dict.fromkeys(urls))


def discover_pdf_candidates(html: str, current_url: str) -> list[str]:
    soup = BeautifulSoup(html, 'lxml')
    urls: list[str] = []
    for a in soup.find_all('a', href=True):
        href = a.get('href', '')
        text = clean_text(a.get_text(' ', strip=True))
        cls = ' '.join(a.get('class', []))
        title = clean_text(a.get('title', ''))
        signal = f"{href} {text} {cls} {title}"
        if re.search(r'\bpdf\b|drukuj|pobierz|download|print', signal, re.I):
            absolute = urljoin(current_url, href)
            if absolute.startswith(BASE_URL):
                urls.append(absolute)
    # JS: proste adresy zawierające pdf lub print
    for m in re.finditer(r'["\']([^"\']*(?:pdf|print)[^"\']*)["\']', html, re.I):
        candidate = m.group(1)
        if candidate.startswith('/') or candidate.startswith(BASE_URL):
            urls.append(urljoin(current_url, candidate))
    return list(dict.fromkeys(urls))

class NewSystemsScraper:
    def __init__(
        self,
        context: BrowserContext,
        output_dir: Path,
        delay: float = 0.25,
        retries: int = 3,
    ) -> None:
        self.context = context
        self.request = context.request
        self.output_dir = output_dir
        self.delay = delay
        self.retries = retries
        self.gear_barcode_cache: dict[str, str] = {}
        self.location_cache: dict[str, dict[str, str]] = {}
        self.customer_nip_cache: dict[str, str] = {}

    def get_response(self, url: str) -> APIResponse:
        last_error: Exception | None = None
        for attempt in range(1, self.retries + 1):
            try:
                resp = self.request.get(url, timeout=60_000, fail_on_status_code=False)
                if resp.status == 429 or resp.status >= 500:
                    wait = min(10, attempt * 2)
                    print(f"  HTTP {resp.status}, ponawiam za {wait}s: {url}")
                    time.sleep(wait)
                    continue
                return resp
            except Exception as e:
                last_error = e
                time.sleep(min(10, attempt * 2))
        raise RuntimeError(f"Nie udało się pobrać {url}: {last_error}")

    def get_text(self, url: str) -> tuple[str, str]:
        resp = self.get_response(url)
        final_url = resp.url
        if resp.status >= 400:
            raise RuntimeError(f"HTTP {resp.status}: {url}")
        text = resp.text()
        time.sleep(self.delay)
        return text, final_url

    def get_bytes(self, url: str) -> tuple[bytes, dict[str, str]]:
        resp = self.get_response(url)
        if resp.status >= 400:
            raise RuntimeError(f"HTTP {resp.status}: {url}")
        body = resp.body()
        headers = resp.headers
        time.sleep(self.delay)
        return body, headers

    def fetch_month_events(self, year: int, month: int) -> list[EventListItem]:
        params = {
            "EventSearch[year]": str(year),
            "EventSearch[month]": str(month),
        }
        url = f"{BASE_URL}/admin/event/index?{urlencode(params)}"
        found: dict[str, EventListItem] = {}
        visited: set[str] = set()

        while url and url not in visited:
            visited.add(url)
            html, final_url = self.get_text(url)
            self.assert_authenticated(html, final_url)

            for item in parse_event_list(html):
                found[item.internal_id] = item

            soup = BeautifulSoup(html, "lxml")
            next_link = soup.select_one("li.next:not(.disabled) a[href], a[rel='next'][href]")
            url = urljoin(BASE_URL, next_link.get("href")) if next_link else ""

        return list(found.values())

    def assert_authenticated(self, html: str, final_url: str) -> None:
        low = final_url.lower()
        soup = BeautifulSoup(html, "lxml")
        has_password = bool(soup.select_one('input[type="password"]'))
        if "login" in low or has_password:
            raise RuntimeError("Sesja NEW wygasła / nastąpiło przekierowanie do logowania.")

    def fetch_all_variant(self, html: str, selector: str, default_url: str) -> tuple[str, str]:
        """
        Zbiera wszystkie linki "Wyświetl wszystko" w danej sekcji i składa ich
        parametry _tog...=all w jeden URL. Dzięki temu przy wielu GridView
        rozwijamy wszystkie tabele jednocześnie.
        """
        soup = BeautifulSoup(html, "lxml")
        root = soup.select_one(selector)
        if not root:
            return html, default_url

        toggle_params: dict[str, str] = {}
        for a in root.find_all("a", href=True):
            if clean_text(a.get_text(" ", strip=True)) != "Wyświetl wszystko":
                continue
            absolute = urljoin(BASE_URL, a.get("href"))
            for key, value in parse_qsl(urlparse(absolute).query, keep_blank_values=True):
                if key.startswith("_tog"):
                    toggle_params[key] = value

        if not toggle_params:
            return html, default_url

        parsed = urlparse(default_url)
        params = dict(parse_qsl(parsed.query, keep_blank_values=True))
        params.update(toggle_params)
        expanded_url = parsed._replace(query=urlencode(params)).geturl()

        expanded, final = self.get_text(expanded_url)
        self.assert_authenticated(expanded, final)
        return expanded, final

    def download_attachments(self, page_html: str, event_dir: Path) -> list[dict[str, Any]]:
        attachments_dir = event_dir / "attachments"
        attachments_dir.mkdir(exist_ok=True)

        candidates = extract_attachment_candidates(page_html)
        results = []
        used_names: set[str] = set()

        for idx, item in enumerate(candidates, start=1):
            url = item["url"]
            print(f"    załącznik {idx}/{len(candidates)}: {item.get('filename') or url}")
            try:
                body, headers = self.get_bytes(url)
                header_name = filename_from_content_disposition(headers)
                name = item.get("filename") or header_name or filename_from_url(url) or f"plik_{idx}"
                if header_name and (not item.get("filename") or "." not in item.get("filename", "")):
                    name = header_name
                name = safe_filename(name, 160)

                stem, ext = os.path.splitext(name)
                final_name = name
                n = 2
                while final_name.lower() in used_names or (attachments_dir / final_name).exists():
                    final_name = f"{stem}_{n}{ext}"
                    n += 1
                used_names.add(final_name.lower())

                path = attachments_dir / final_name
                path.write_bytes(body)

                results.append(
                    {
                        **item,
                        "saved_as": final_name,
                        "bytes": len(body),
                        "ok": True,
                    }
                )
            except Exception as e:
                results.append({**item, "ok": False, "error": str(e)})
        return results

    def get_customer_nip(self, customer_id: str) -> str:
        if not customer_id:
            return ""
        if customer_id in self.customer_nip_cache:
            return self.customer_nip_cache[customer_id]

        nip = ""
        for url in (
            f"{BASE_URL}/admin/customer/view?id={customer_id}",
            f"{BASE_URL}/admin/customer/update?id={customer_id}",
        ):
            try:
                html, final = self.get_text(url)
                self.assert_authenticated(html, final)
                nip = parse_customer_nip(html)
                if nip:
                    break
            except Exception:
                continue
        self.customer_nip_cache[customer_id] = nip
        return nip

    def get_location_details(self, location_id: str) -> dict[str, str]:
        if not location_id:
            return {'venue': '', 'city': '', 'address': '', 'location': ''}
        if location_id in self.location_cache:
            return self.location_cache[location_id]

        best = {'venue': '', 'city': '', 'address': '', 'location': ''}
        # Yii zwykle wystawia view?id=..., a update?id=... jest dobrym fallbackiem.
        for url in (
            f"{BASE_URL}/admin/location/view?id={location_id}",
            f"{BASE_URL}/admin/location/update?id={location_id}",
        ):
            try:
                html, final = self.get_text(url)
                self.assert_authenticated(html, final)
                parsed = parse_location_details_page(html)
                for key in ('venue', 'city', 'address'):
                    if parsed.get(key) and not best.get(key):
                        best[key] = parsed[key]
                best['location'] = _compose_location(best['venue'], best['city'], best['address'])
                if best.get('address'):
                    break
            except Exception:
                continue

        self.location_cache[location_id] = best
        return best

    def get_gear_barcode(self, gear_id: str, packlist_id: str = "", packlist_gear_id: str = "") -> str:
        if gear_id in self.gear_barcode_cache:
            return self.gear_barcode_cache[gear_id]
        urls = []
        if packlist_id:
            urls.append(f"{BASE_URL}/admin/gear/gear-info?id={gear_id}&packlist={packlist_id}&packlist_gear={packlist_gear_id}&ajax=1")
        urls += [
            f"{BASE_URL}/admin/gear/gear-info?id={gear_id}&ajax=1",
            f"{BASE_URL}/admin/gear/view?id={gear_id}",
            f"{BASE_URL}/admin/gear/update?id={gear_id}",
        ]
        barcode = ''
        for url in urls:
            try:
                html, final = self.get_text(url)
                self.assert_authenticated(html, final)
                barcode = parse_barcode_from_gear_info(html)
                if barcode:
                    break
            except Exception:
                continue
        self.gear_barcode_cache[gear_id] = barcode
        return barcode

    def enrich_gear_rows(self, gear_html: str) -> list[dict[str, str]]:
        rows = parse_event_gear_rows(gear_html)
        for pos, row in enumerate(rows, start=1):
            print(f"    model sprzętu {pos}/{len(rows)}: {row['name']}")
            row['model_barcode'] = self.get_gear_barcode(row['gear_id'], row.get('packlist_id',''), row.get('packlist_gear_id',''))
        return rows

    def _try_download_pdf(self, url: str, target: Path) -> tuple[bool, str]:
        try:
            body, headers = self.get_bytes(url)
            ctype = (headers.get('content-type') or headers.get('Content-Type') or '').lower()
            if body.startswith(b'%PDF') or 'application/pdf' in ctype:
                target.write_bytes(body)
                return True, ''
            return False, f"odpowiedź nie jest PDF ({ctype or 'brak content-type'})"
        except Exception as e:
            return False, str(e)

    def _render_offer_page_to_pdf(self, url: str, target: Path) -> tuple[bool, str]:
        page = self.context.new_page()
        try:
            page.goto(url, wait_until='networkidle', timeout=90_000)
            if 'login' in page.url.lower():
                return False, 'przekierowanie do logowania'
            page.emulate_media(media='print')
            page.pdf(path=str(target), format='A4', print_background=True,
                     margin={'top':'8mm','right':'8mm','bottom':'8mm','left':'8mm'})
            return target.exists() and target.stat().st_size > 1000, ''
        except Exception as e:
            return False, str(e)
        finally:
            page.close()

    def download_offer_pdfs(self, offer_html: str, event_dir: Path) -> list[dict[str, Any]]:
        offers_dir = event_dir / 'offers'
        offers_dir.mkdir(exist_ok=True)
        queue = parse_offer_rows(offer_html)
        known = {x['offer_id']: x for x in queue}
        processed: set[str] = set()
        results: list[dict[str, Any]] = []
        pos = 0
        while pos < len(queue):
            offer = queue[pos]
            pos += 1
            offer_id = offer['offer_id']
            if offer_id in processed:
                continue
            processed.add(offer_id)
            view_url = offer['view_url']
            print(f"    oferta PDF {len(processed)}: ID {offer_id} — {offer.get('name','')}")
            view_html = ''
            view_error = ''
            try:
                view_html, final = self.get_text(view_url)
                self.assert_authenticated(view_html, final)
                (offers_dir / f'offer_{offer_id}_source.html').write_text(view_html, encoding='utf-8')
                for extra_url in discover_offer_view_urls(view_html):
                    m = re.search(r'[?&]id=(\d+)', extra_url)
                    extra_id = m.group(1) if m else ''
                    if extra_id and extra_id not in known:
                        extra = {'offer_id':extra_id,'name':f'Wersja oferty {extra_id}','date':'','prepared_by':'','status':'','total':'','view_url':extra_url}
                        known[extra_id] = extra
                        queue.append(extra)
            except Exception as e:
                view_error = str(e)
            stem = f"offer_{offer_id}_{safe_filename(offer.get('name','oferta'), 90)}"
            pdf_path = offers_dir / f'{stem}.pdf'
            ok = False
            errors = []
            if view_html:
                for pdf_url in discover_pdf_candidates(view_html, view_url):
                    ok, err = self._try_download_pdf(pdf_url, pdf_path)
                    if ok:
                        break
                    if err:
                        errors.append(f'{pdf_url}: {err}')
            if not ok:
                ok, err = self._render_offer_page_to_pdf(view_url, pdf_path)
                if err:
                    errors.append(f'render PDF: {err}')
            if view_error:
                errors.append(f'widok oferty: {view_error}')
            results.append({**offer,
                'saved_as': pdf_path.name if ok else '',
                'bytes': pdf_path.stat().st_size if ok and pdf_path.exists() else 0,
                'ok': ok,
                'error': ' | '.join(errors) if not ok else '',
            })
        return results

    def scrape_event(self, item: EventListItem) -> tuple[dict[str, Any], Path]:
        main_html, final_url = self.get_text(item.detail_url)
        self.assert_authenticated(main_html, final_url)

        header = parse_event_header(main_html, item)

        customer_id = getattr(item, "customer_id", "") or extract_customer_id_from_event_html(main_html)
        if not header.get("client_nip") and customer_id:
            header["client_nip"] = self.get_customer_nip(customer_id)

        # Typ wydarzenia i pełne miejsce: pobieramy z formularza aktualizacji.
        update_url = f"{BASE_URL}/admin/event/update?id={item.internal_id}"
        try:
            update_html, update_final = self.get_text(update_url)
            self.assert_authenticated(update_html, update_final)
            type_info = parse_event_type_from_update(update_html)
            if type_info["type"]:
                header["type"] = type_info["type"]
            location_ref = parse_location_ref_from_update(update_html)
            location_details = self.get_location_details(location_ref.get("location_id", ""))

            # Składamy dane z dwóch źródeł: formularz wydarzenia + karta miejsca.
            # Karta miejsca ma pierwszeństwo dla adresu, bo formularz wydarzenia
            # często pokazuje tylko "Obiekt, Miasto".
            venue = location_details.get("venue") or location_ref.get("venue", "")
            city = location_details.get("city") or location_ref.get("city", "")
            address = location_details.get("address") or location_ref.get("address", "")
            full_location = _compose_location(venue, city, address)
            if full_location:
                header["location"] = full_location
            header["location_id"] = location_ref.get("location_id", "")
            header["location_venue"] = venue
            header["location_city"] = city
            header["location_address"] = address
            header["type_source_field"] = type_info["field"]
        except Exception as e:
            header["type_source_field"] = ""
            header["type_error"] = str(e)

        event_date = (header.get("start") or item.start or "bez-daty")[:10]
        folder_name = f"{item.internal_id}_{safe_filename(header.get('name') or item.event_name, 115)}_{event_date}"
        event_dir = self.output_dir / "wydarzenia" / folder_name
        event_dir.mkdir(parents=True, exist_ok=True)

        # Zawsze zachowujemy kompletną stronę źródłową.
        (event_dir / "event_full.html").write_text(main_html, encoding="utf-8")
        (event_dir / "event_update.html").write_text(update_html if "update_html" in locals() else "", encoding="utf-8")

        # Szczegóły
        details = save_section("szczegoly", main_html, "#tab-calendar", event_dir)

        # Dodatkowo zapis harmonogramu, który w NEW występuje poza samym tab-calendar.
        schedules = header.get("schedule", [])

        # Sprzęt (endpoint AJAX)
        gear_url = f"{BASE_URL}/admin/event/gear-tab?id={item.internal_id}"
        gear_html, gear_final = self.get_text(gear_url)
        self.assert_authenticated(gear_html, gear_final)
        gear_expanded_html, gear_expanded_url = self.fetch_all_variant(gear_html, "body", gear_url)
        gear = save_section("sprzet", gear_expanded_html, None, event_dir)
        gear_items = self.enrich_gear_rows(gear_expanded_html)
        (event_dir / "sprzet_raw.html").write_text(gear_html, encoding="utf-8")

        # Sprzęt zewnętrzny: oba podwidoki obecne na stronie wydarzenia.
        external_need_html, _ = self.fetch_all_variant(main_html, "#eventTabs-dd4-tab0", item.detail_url)
        external_need = save_section(
            "sprzet_zewnetrzny_zapotrzebowanie",
            external_need_html,
            "#eventTabs-dd4-tab0",
            event_dir,
        )
        external_reserved_html, _ = self.fetch_all_variant(main_html, "#eventTabs-dd4-tab1", item.detail_url)
        external_reserved = save_section(
            "sprzet_zewnetrzny_zarezerwowany",
            external_reserved_html,
            "#eventTabs-dd4-tab1",
            event_dir,
        )
        external_text = {
            "need": section_to_readable_text(external_need),
            "reserved_at_supplier": section_to_readable_text(external_reserved),
        }

        # Załączniki — pobieramy widok "Wyświetl wszystko", jeśli istnieje.
        attachments_html, _ = self.fetch_all_variant(main_html, "#tab-attachment", item.detail_url)
        attachments_section = save_section("zalaczniki", attachments_html, "#tab-attachment", event_dir)
        attachments = self.download_attachments(attachments_html, event_dir)

        # Oferty
        offer_url = f"{BASE_URL}/admin/event/offer-tab?id={item.internal_id}"
        offer_html, offer_final = self.get_text(offer_url)
        self.assert_authenticated(offer_html, offer_final)
        offers = save_section("oferty", offer_html, None, event_dir)
        offer_pdfs = self.download_offer_pdfs(offer_html, event_dir)

        # Ekipa
        crew_url = f"{BASE_URL}/admin/event/crew-tab?id={item.internal_id}"
        crew_html, crew_final = self.get_text(crew_url)
        self.assert_authenticated(crew_html, crew_final)
        crew = save_section("ekipa", crew_html, None, event_dir)

        # Flota
        vehicle_url = f"{BASE_URL}/admin/event/vehicle-tab?id={item.internal_id}"
        vehicle_html, vehicle_final = self.get_text(vehicle_url)
        self.assert_authenticated(vehicle_html, vehicle_final)
        fleet = save_section("flota", vehicle_html, None, event_dir)

        data = {
            "complete": True,
            "exporter_version": EXPORTER_VERSION,
            "scraped_at": datetime.now().isoformat(sep=" ", timespec="seconds"),
            "source": {
                "base_url": BASE_URL,
                "event_url": item.detail_url,
                "internal_id": item.internal_id,
            },
            "list": asdict(item),
            "summary": header,
            "schedule": schedules,
            "details": details,
            "gear": gear,
            "gear_items": gear_items,
            "external_gear": {
                "need": external_need,
                "reserved_at_supplier": external_reserved,
                "text": external_text,
            },
            "attachments_section": attachments_section,
            "attachments": attachments,
            "offers": offers,
            "offer_pdfs": offer_pdfs,
            "crew": crew,
            "fleet": fleet,
        }

        (event_dir / "event.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return data, event_dir


def ensure_login(context: BrowserContext) -> None:
    page = context.pages[0] if context.pages else context.new_page()
    page.goto(f"{BASE_URL}/admin/event/index", wait_until="domcontentloaded", timeout=60_000)

    def needs_login() -> bool:
        return "login" in page.url.lower() or page.locator('input[type="password"]').count() > 0

    if needs_login():
        print("\nNEW wymaga logowania.")
        print("Zaloguj się w otwartym oknie Chromium, aż zobaczysz panel NEW.")
        input("Po zalogowaniu naciśnij ENTER w terminalu... ")
        page.goto(f"{BASE_URL}/admin/event/index", wait_until="domcontentloaded", timeout=60_000)

    if needs_login():
        raise RuntimeError("Nadal widzę ekran logowania. Przerwano.")

    print("Sesja NEW: OK")


def write_summary_csv(items: list[dict[str, Any]], path: Path) -> None:
    fields = [
        "internal_id",
        "event_code",
        "list_no",
        "name",
        "type",
        "location",
        "accounting",
        "status",
        "client",
        "client_nip",
        "event_manager",
        "start",
        "end",
        "created_at",
        "folder",
        "attachments_ok",
        "attachments_errors",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, delimiter=";")
        w.writeheader()
        for x in items:
            w.writerow({k: x.get(k, "") for k in fields})



def _xlsx_cell_value(value: Any) -> Any:
    """Wartość bezpieczna dla XLSX; złożone obiekty zapisujemy jako JSON."""
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool, datetime, date)):
        return value
    return json.dumps(value, ensure_ascii=False)


def _normalize_headers(headers: list[str], cell_count: int) -> list[str]:
    """Nadaje unikalne nazwy pustym / powtarzającym się kolumnom tabel NEW."""
    out: list[str] = []
    used: dict[str, int] = {}
    total = max(len(headers), cell_count)
    for i in range(total):
        base = clean_text(headers[i]) if i < len(headers) else ""
        if not base:
            base = f"Kolumna {i+1}"
        n = used.get(base, 0) + 1
        used[base] = n
        out.append(base if n == 1 else f"{base} ({n})")
    return out


def _flatten_section_tables(
    event_data: dict[str, Any],
    section: dict[str, Any] | None,
    section_label: str = "",
) -> list[dict[str, Any]]:
    """Spłaszcza wszystkie tabele zapisane przez scraper do rekordów Excela."""
    if not section:
        return []
    summary = event_data.get("summary", {})
    event_id = clean_text(str(summary.get("internal_id") or event_data.get("source", {}).get("internal_id", "")))
    event_name = clean_text(str(summary.get("name", "")))
    event_code = clean_text(str(summary.get("event_code", "")))
    result: list[dict[str, Any]] = []

    for table_idx, table in enumerate(section.get("tables", []) or [], start=1):
        rows = table.get("rows", []) or []
        max_cells = max([len(r.get("cells", []) or []) for r in rows] + [0])
        headers = _normalize_headers(table.get("headers", []) or [], max_cells)
        for row_idx, row in enumerate(rows, start=1):
            record: dict[str, Any] = {
                "ID NEW": event_id,
                "Kod wydarzenia": event_code,
                "Wydarzenie": event_name,
                "Sekcja": section_label,
                "Tabela": table_idx,
                "Wiersz": row_idx,
                "Data key": clean_text(str(row.get("data_key", ""))),
            }
            cells = row.get("cells", []) or []
            for i, cell in enumerate(cells):
                header = headers[i] if i < len(headers) else f"Kolumna {i+1}"
                record[header] = clean_text(str(cell.get("text", "")))
                links = cell.get("links", []) or []
                if links:
                    urls = [clean_text(str(x.get("href", ""))) for x in links if x.get("href")]
                    if urls:
                        record[f"{header} — URL"] = "\n".join(urls)
                controls = cell.get("controls", []) or []
                if controls:
                    record[f"{header} — pola"] = json.dumps(controls, ensure_ascii=False)
            result.append(record)
    return result


def _collect_export_json(output_dir: Path) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for event_json in sorted((output_dir / "wydarzenia").glob("*/event.json")):
        try:
            data = json.loads(event_json.read_text(encoding="utf-8"))
            if data.get("complete") is True:
                data["_folder"] = str(event_json.parent.relative_to(output_dir))
                events.append(data)
        except Exception as e:
            print(f"  XLSX: pomijam uszkodzony {event_json}: {e}")
    return events


def _write_xlsx_sheet(
    workbook: "xlsxwriter.Workbook",
    name: str,
    rows: list[dict[str, Any]],
    preferred_columns: list[str] | None = None,
) -> None:
    ws = workbook.add_worksheet(name[:31])
    header_fmt = workbook.add_format({
        "bold": True,
        "font_color": "#FFFFFF",
        "bg_color": "#1F4E78",
        "border": 1,
        "align": "center",
        "valign": "vcenter",
    })
    text_fmt = workbook.add_format({"valign": "top"})
    wrap_fmt = workbook.add_format({"valign": "top", "text_wrap": True})
    date_fmt = workbook.add_format({"num_format": "yyyy-mm-dd hh:mm", "valign": "top"})
    error_fmt = workbook.add_format({"font_color": "#9C0006", "bg_color": "#FFC7CE"})

    # Kolejność: najpierw preferowane, potem wszystkie pozostałe w kolejności wystąpienia.
    columns: list[str] = []
    seen: set[str] = set()
    for c in preferred_columns or []:
        if c not in seen:
            columns.append(c)
            seen.add(c)
    for row in rows:
        for c in row.keys():
            if c not in seen:
                columns.append(c)
                seen.add(c)
    if not columns:
        columns = preferred_columns[:] if preferred_columns else ["Brak danych"]

    for col, title in enumerate(columns):
        ws.write(0, col, title, header_fmt)

    for r, row in enumerate(rows, start=1):
        for c, key in enumerate(columns):
            val = _xlsx_cell_value(row.get(key, ""))
            if isinstance(val, (datetime, date)):
                ws.write_datetime(r, c, val if isinstance(val, datetime) else datetime.combine(val, datetime.min.time()), date_fmt)
            else:
                text = str(val) if val is not None else ""
                fmt = wrap_fmt if ("URL" in key or "tekst" in key.lower() or key in {"Opis", "Szczegóły"} or "pola" in key.lower() or len(text) > 80) else text_fmt
                if name == "Bledy" and key == "Błąd":
                    fmt = error_fmt
                ws.write(r, c, val, fmt)

    ws.freeze_panes(1, 0)
    if not rows and columns:
        ws.autofilter(0, 0, 0, max(0, len(columns) - 1))
    ws.set_row(0, 24)

    # Szerokości ograniczone, żeby arkusze nie rozjeżdżały się na setki pikseli.
    for c, key in enumerate(columns):
        sample = [str(key)] + [str(row.get(key, "")) for row in rows[:250]]
        width = min(max(max((len(x.split("\n")[0]) for x in sample), default=8) + 2, 10), 42)
        if key in {"ID NEW", "#", "Tabela", "Wiersz", "Data key"}:
            width = min(width, 14)
        elif "URL" in key:
            width = 38
        elif key in {"Wydarzenie", "Klient", "Miejsce", "Folder", "Opis", "Szczegóły", "Zapotrzebowanie — tekst", "Zarezerwowany u wypożyczającego — tekst", "Błąd"}:
            width = 38
        ws.set_column(c, c, width)

    if rows and columns:
        # Excel Table daje filtry i czytelne pasy wierszy.
        try:
            ws.add_table(
                0,
                0,
                len(rows),
                len(columns) - 1,
                {
                    "columns": [{"header": c} for c in columns],
                    "style": "Table Style Medium 2",
                },
            )
        except Exception:
            pass


def write_export_xlsx(output_dir: Path, errors: list[dict[str, str]] | None = None) -> Path:
    event_data_list = _collect_export_json(output_dir)
    xlsx_path = output_dir / "NEW_wydarzenia.xlsx"
    tmp_xlsx_path = output_dir / ".NEW_wydarzenia.tmp.xlsx"
    if tmp_xlsx_path.exists():
        try:
            tmp_xlsx_path.unlink()
        except OSError:
            pass
    workbook = xlsxwriter.Workbook(str(tmp_xlsx_path))
    workbook.set_properties({"title":"Eksport wydarzeń NEW Systems","author":"Eksporter NEW Systems v3"})

    main_rows=[]; details_rows=[]; schedule_rows=[]; gear_rows=[]; external_rows=[]
    attachment_rows=[]; offer_rows=[]; crew_rows=[]; fleet_rows=[]

    all_custom_fields=[]; seen_custom=set()
    for data in event_data_list:
        for field_name in ((data.get('summary',{}) or {}).get('custom_fields',{}) or {}).keys():
            if field_name not in seen_custom:
                seen_custom.add(field_name); all_custom_fields.append(field_name)

    for data in event_data_list:
        summary=data.get('summary',{}) or {}; list_item=data.get('list',{}) or {}
        attachments=data.get('attachments',[]) or []; offer_pdfs=data.get('offer_pdfs',[]) or []
        event_id=clean_text(str(summary.get('internal_id') or data.get('source',{}).get('internal_id','')))
        event_name=clean_text(str(summary.get('name') or list_item.get('event_name','')))
        event_code=clean_text(str(summary.get('event_code') or list_item.get('event_code','')))
        main_rows.append({
            'ID NEW':event_id,'Kod wydarzenia':event_code,'Wydarzenie':event_name,
            'Typ':summary.get('type',''),'Miejsce':summary.get('location',''),'Księgowe':summary.get('accounting',list_item.get('accounting','')),
            'Status':summary.get('status',list_item.get('status','')),'Klient':summary.get('client',list_item.get('client','')),
            'NIP klienta':summary.get('client_nip',''),
            'EventManager':summary.get('event_manager',list_item.get('event_manager','')),'Od':summary.get('start',list_item.get('start','')),
            'Do':summary.get('end',list_item.get('end','')),'Data utworzenia':list_item.get('created_at',''),'Folder':data.get('_folder',''),
            'Załączniki OK':sum(1 for a in attachments if a.get('ok')),'Oferty PDF OK':sum(1 for a in offer_pdfs if a.get('ok')),
            'URL NEW':data.get('source',{}).get('event_url','')})
        detail={'ID NEW':event_id,'Kod wydarzenia':event_code,'Wydarzenie':event_name,
                'Opis':summary.get('description',''),'Szczegóły':summary.get('details',''),
                'Typ':summary.get('type',''),'Miejsce':summary.get('location',''),'Księgowe':summary.get('accounting',''),
                'Status':summary.get('status',''),'Klient':summary.get('client',''),'NIP klienta':summary.get('client_nip',''),'EventManager':summary.get('event_manager',''),
                'Od':summary.get('start',''),'Do':summary.get('end',''),'URL NEW':data.get('source',{}).get('event_url','')}
        cf=summary.get('custom_fields',{}) or {}
        for f in all_custom_fields: detail[f]=cf.get(f,'')
        details_rows.append(detail)
        for sch in data.get('schedule',[]) or []:
            schedule_rows.append({'ID NEW':event_id,'Kod wydarzenia':event_code,'Wydarzenie':event_name,'ID harmonogramu':sch.get('id',''),'Etap':sch.get('name',''),'Od':sch.get('start',''),'Do':sch.get('end','')})
        for item in data.get('gear_items',[]) or []:
            gear_rows.append({'ID NEW':event_id,'Wydarzenie':event_name,'Sprzęt':item.get('name',''),'Ilość':item.get('quantity',0),'Kod kreskowy modelu':item.get('model_barcode','')})
        external=data.get('external_gear',{}) or {}; txt=external.get('text',{}) or {}
        external_rows.append({'ID NEW':event_id,'Wydarzenie':event_name,'Zapotrzebowanie — tekst':txt.get('need',''),'Zarezerwowany u wypożyczającego — tekst':txt.get('reserved_at_supplier','')})
        for a in attachments:
            attachment_rows.append({'ID NEW':event_id,'Kod wydarzenia':event_code,'Wydarzenie':event_name,'ID załącznika':a.get('attachment_id',''),'Nazwa pliku':a.get('filename',''),'Zapisano jako':a.get('saved_as',''),'Rozmiar [B]':a.get('bytes',''),'Pobrano':'TAK' if a.get('ok') else 'NIE','Błąd':a.get('error',''),'URL':a.get('url',''),'Folder':f"{data.get('_folder','')}/attachments" if data.get('_folder') else ''})
        for offer in offer_pdfs:
            offer_rows.append({'ID NEW':event_id,'Wydarzenie':event_name,'ID oferty':offer.get('offer_id',''),'Nazwa / wersja':offer.get('name',''),'Data':offer.get('date',''),'Przygotował':offer.get('prepared_by',''),'Status':offer.get('status',''),'Suma':offer.get('total',''),'PDF':offer.get('saved_as',''),'Pobrano':'TAK' if offer.get('ok') else 'NIE','Rozmiar [B]':offer.get('bytes',''),'Błąd':offer.get('error',''),'Folder':f"{data.get('_folder','')}/offers" if data.get('_folder') else '','URL NEW':offer.get('view_url','')})
        crew_rows.extend(_flatten_section_tables(data,data.get('crew'),'Ekipa'))
        fleet_rows.extend(_flatten_section_tables(data,data.get('fleet'),'Flota'))

    _write_xlsx_sheet(workbook,'Wydarzenia',main_rows,['ID NEW','Kod wydarzenia','Wydarzenie','Typ','Miejsce','Księgowe','Status','Klient','NIP klienta','EventManager','Od','Do','Data utworzenia','Folder','Załączniki OK','Oferty PDF OK','URL NEW'])
    _write_xlsx_sheet(workbook,'Szczegoly',details_rows,['ID NEW','Kod wydarzenia','Wydarzenie','Opis','Szczegóły',*all_custom_fields,'Typ','Miejsce','Księgowe','Status','Klient','NIP klienta','EventManager','Od','Do','URL NEW'])
    _write_xlsx_sheet(workbook,'Harmonogram',schedule_rows,['ID NEW','Kod wydarzenia','Wydarzenie','ID harmonogramu','Etap','Od','Do'])
    _write_xlsx_sheet(workbook,'Sprzet',gear_rows,['ID NEW','Wydarzenie','Sprzęt','Ilość','Kod kreskowy modelu'])
    _write_xlsx_sheet(workbook,'Sprzet zewn',external_rows,['ID NEW','Wydarzenie','Zapotrzebowanie — tekst','Zarezerwowany u wypożyczającego — tekst'])
    _write_xlsx_sheet(workbook,'Zalaczniki',attachment_rows,['ID NEW','Kod wydarzenia','Wydarzenie','ID załącznika','Nazwa pliku','Zapisano jako','Rozmiar [B]','Pobrano','Błąd','URL','Folder'])
    _write_xlsx_sheet(workbook,'Oferty',offer_rows,['ID NEW','Wydarzenie','ID oferty','Nazwa / wersja','Data','Przygotował','Status','Suma','PDF','Pobrano','Rozmiar [B]','Błąd','Folder','URL NEW'])
    _write_xlsx_sheet(workbook,'Ekipa',crew_rows,['ID NEW','Kod wydarzenia','Wydarzenie','Sekcja','Tabela','Wiersz','Data key'])
    _write_xlsx_sheet(workbook,'Flota',fleet_rows,['ID NEW','Kod wydarzenia','Wydarzenie','Sekcja','Tabela','Wiersz','Data key'])
    error_rows=[{'ID NEW':e.get('internal_id',''),'Wydarzenie':e.get('event_name',''),'Błąd':e.get('error','')} for e in (errors or [])]
    _write_xlsx_sheet(workbook,'Bledy',error_rows,['ID NEW','Wydarzenie','Błąd'])
    workbook.close()
    os.replace(tmp_xlsx_path, xlsx_path)
    return xlsx_path

def _verify_xlsx_file(path: Path) -> None:
    """Sprawdza, czy zapisany plik jest faktycznie poprawnym XLSX."""
    import zipfile
    if not path.exists():
        raise RuntimeError(f"plik XLSX nie powstał: {path}")
    if path.stat().st_size < 1000:
        raise RuntimeError(f"plik XLSX jest podejrzanie mały ({path.stat().st_size} B): {path}")
    if not zipfile.is_zipfile(path):
        raise RuntimeError(f"plik nie jest poprawnym XLSX: {path}")


def update_xlsx_or_die(output_dir: Path, errors: list[dict[str, str]] | None = None) -> Path:
    path = write_export_xlsx(output_dir, errors or [])
    _verify_xlsx_file(path)
    print(f"  XLSX zapisany: {path.resolve()} ({path.stat().st_size} B)")
    return path


def safe_update_xlsx(output_dir: Path, errors: list[dict[str, str]] | None = None) -> Path | None:
    try:
        return update_xlsx_or_die(output_dir, errors or [])
    except Exception:
        import traceback
        print("\n  !!! BŁĄD ZAPISU XLSX !!!")
        traceback.print_exc()
        print(f"  Oczekiwany plik: {(output_dir / 'NEW_wydarzenia.xlsx').resolve()}\n")
        return None

def main() -> int:
    ap = argparse.ArgumentParser(description="Eksport wydarzeń NEW Systems")
    ap.add_argument("--from", dest="date_from", default=DEFAULT_FROM, help="YYYY-MM-DD")
    ap.add_argument("--to", dest="date_to", default=DEFAULT_TO, help="YYYY-MM-DD")
    ap.add_argument("--output", default="", help="Katalog wynikowy")
    ap.add_argument("--profile", default=".newsystems-browser-profile", help="Profil Chromium z sesją NEW")
    ap.add_argument("--delay", type=float, default=0.25, help="Przerwa między requestami w sekundach")
    ap.add_argument("--headless", action="store_true", help="Uruchom bez okna (tylko po zapisaniu sesji)")
    ap.add_argument("--force", action="store_true", help="Pobierz ponownie wydarzenia już oznaczone complete")
    ap.add_argument(
        "--xlsx-only",
        metavar="KATALOG_EKSPORTU",
        default="",
        help="Nie pobieraj danych. Zbuduj tylko NEW_wydarzenia.xlsx z istniejących wydarzenia/*/event.json.",
    )
    args = ap.parse_args()

    # Niezależny generator Excela z danych już pobranych.
    if args.xlsx_only:
        xlsx_dir = Path(args.xlsx_only).expanduser().resolve()
        if not xlsx_dir.exists():
            print(f"BŁĄD: katalog nie istnieje: {xlsx_dir}")
            return 4
        print("=" * 72)
        print(f"NEW SYSTEMS — XLSX ONLY — v{EXPORTER_VERSION}")
        print(f"Źródło: {xlsx_dir}")
        print("=" * 72)
        (xlsx_dir / "EXCEL_GENERATOR_V4.txt").write_text(
            f"Uruchomiono generator XLSX v{EXPORTER_VERSION}\nKatalog: {xlsx_dir}\n",
            encoding="utf-8",
        )
        try:
            path = update_xlsx_or_die(xlsx_dir, [])
        except Exception:
            import traceback
            traceback.print_exc()
            print("BŁĄD: nie udało się zbudować Excela.")
            return 5
        (xlsx_dir / "EXCEL_TUTAJ.txt").write_text(str(path.resolve()) + "\n", encoding="utf-8")
        print("\nGOTOWE.")
        print(f"EXCEL: {path.resolve()}")
        return 0

    d_from = datetime.strptime(args.date_from, "%Y-%m-%d").date()
    d_to = datetime.strptime(args.date_to, "%Y-%m-%d").date()
    if d_to < d_from:
        raise SystemExit("--to nie może być wcześniejsze niż --from")

    script_dir = Path(__file__).resolve().parent
    launch_dir = Path.cwd().resolve()
    output_dir = Path(args.output).expanduser().resolve() if args.output else (launch_dir / f"NEW_export_{d_from}_{d_to}").resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "wydarzenia").mkdir(exist_ok=True)
    (output_dir / "URUCHOMIONO_V4_FINAL.txt").write_text(
        f"NEW Systems exporter {EXPORTER_VERSION}\n"
        f"Katalog eksportu: {output_dir.resolve()}\n"
        f"Excel: {(output_dir / 'NEW_wydarzenia.xlsx').resolve()}\n",
        encoding="utf-8",
    )

    run_meta = {
        "date_from": str(d_from),
        "date_to": str(d_to),
        "base_url": BASE_URL,
        "started_at": datetime.now().isoformat(sep=" ", timespec="seconds"),
    }
    (output_dir / "run.json").write_text(json.dumps(run_meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=" * 72)
    print(f"NEW SYSTEMS EXPORTER — FINAL v{EXPORTER_VERSION}")
    print("JEŻELI NIE WIDZISZ TEGO NAPISU, URUCHAMIASZ STARY SKRYPT.")
    print("=" * 72)
    print(f"Eksporter NEW Systems v{EXPORTER_VERSION}")
    print(f"Uruchomiono z:    {launch_dir}")
    print(f"Katalog eksportu: {output_dir}")
    print(f"Plik XLSX:       {(output_dir / 'NEW_wydarzenia.xlsx').resolve()}")
    print("Test zapisu XLSX...")
    try:
        preflight_xlsx = update_xlsx_or_die(output_dir, [])
        (output_dir / "XLSX_PATH.txt").write_text(str(preflight_xlsx.resolve()) + "\n", encoding="utf-8")
        (output_dir / "EXCEL_TUTAJ.txt").write_text(
            f"Plik Excel znajduje się tutaj:\n{preflight_xlsx.resolve()}\n",
            encoding="utf-8",
        )
        print(f"XLSX GOTOWY PRZED SCRAPOWANIEM: {preflight_xlsx.resolve()}")
    except Exception:
        import traceback
        print("\nNIE UDAŁO SIĘ UTWORZYĆ XLSX. Eksport nie został rozpoczęty.")
        traceback.print_exc()
        print(f"Oczekiwany plik: {(output_dir / 'NEW_wydarzenia.xlsx').resolve()}")
        return 3

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(Path(args.profile).resolve()),
            headless=args.headless,
            accept_downloads=True,
        )
        try:
            ensure_login(context)
            scraper = NewSystemsScraper(context, output_dir, delay=args.delay)

            all_list_items: dict[str, EventListItem] = {}
            for year, month in month_iter(d_from, d_to):
                print(f"\nLista wydarzeń: {year}-{month:02d}")
                month_items = scraper.fetch_month_events(year, month)
                print(f"  znaleziono na liście: {len(month_items)}")
                for item in month_items:
                    if in_requested_range(item, d_from, d_to):
                        all_list_items[item.internal_id] = item

            items = sorted(
                all_list_items.values(),
                key=lambda x: (x.start or "9999", int(x.internal_id) if x.internal_id.isdigit() else 0),
            )
            print(f"\nDo eksportu po filtrze dat: {len(items)} wydarzeń\n")

            summary_rows: list[dict[str, Any]] = []
            errors: list[dict[str, str]] = []

            for pos, item in enumerate(items, start=1):
                print(f"[{pos}/{len(items)}] ID {item.internal_id}: {item.event_name}")

                # Resume: szukamy istniejącego folderu rozpoczynającego się od ID_
                existing = list((output_dir / "wydarzenia").glob(f"{item.internal_id}_*/event.json"))
                if existing and not args.force:
                    try:
                        old = json.loads(existing[0].read_text(encoding="utf-8"))
                        if old.get("complete") is True and str(old.get("exporter_version", "")) == EXPORTER_VERSION:
                            summary = old.get("summary", {})
                            attachments = old.get("attachments", [])
                            summary_rows.append(
                                {
                                    "internal_id": item.internal_id,
                                    "event_code": summary.get("event_code", item.event_code),
                                    "list_no": item.list_no,
                                    "name": summary.get("name", item.event_name),
                                    "type": summary.get("type", ""),
                                    "location": summary.get("location", ""),
                                    "accounting": summary.get("accounting", item.accounting),
                                    "status": summary.get("status", item.status),
                                    "client": summary.get("client", item.client),
                                    "client_nip": summary.get("client_nip", ""),
                                    "event_manager": summary.get("event_manager", item.event_manager),
                                    "start": summary.get("start", item.start),
                                    "end": summary.get("end", item.end),
                                    "created_at": item.created_at,
                                    "folder": str(existing[0].parent.relative_to(output_dir)),
                                    "attachments_ok": sum(1 for a in attachments if a.get("ok")),
                                    "attachments_errors": sum(1 for a in attachments if not a.get("ok")),
                                }
                            )
                            print(f"  pomijam — event.json z eksportera v{EXPORTER_VERSION} już istnieje")
                            update_xlsx_or_die(output_dir, errors)
                            continue
                    except Exception:
                        pass

                try:
                    data, event_dir = scraper.scrape_event(item)
                    summary = data["summary"]
                    attachments = data.get("attachments", [])
                    summary_rows.append(
                        {
                            "internal_id": item.internal_id,
                            "event_code": summary.get("event_code", item.event_code),
                            "list_no": item.list_no,
                            "name": summary.get("name", item.event_name),
                            "type": summary.get("type", ""),
                            "location": summary.get("location", ""),
                            "accounting": summary.get("accounting", item.accounting),
                            "status": summary.get("status", item.status),
                            "client": summary.get("client", item.client),
                            "client_nip": summary.get("client_nip", ""),
                            "event_manager": summary.get("event_manager", item.event_manager),
                            "start": summary.get("start", item.start),
                            "end": summary.get("end", item.end),
                            "created_at": item.created_at,
                            "folder": str(event_dir.relative_to(output_dir)),
                            "attachments_ok": sum(1 for a in attachments if a.get("ok")),
                            "attachments_errors": sum(1 for a in attachments if not a.get("ok")),
                        }
                    )
                except Exception as e:
                    err = {
                        "internal_id": item.internal_id,
                        "event_name": item.event_name,
                        "error": str(e),
                    }
                    errors.append(err)
                    print(f"  BŁĄD: {e}")

                # Nadpisujemy summary po każdym wydarzeniu — bezpieczniejsze przy długim eksporcie.
                write_summary_csv(summary_rows, output_dir / "wydarzenia.csv")
                (output_dir / "errors.json").write_text(
                    json.dumps(errors, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                update_xlsx_or_die(output_dir, errors)

            write_summary_csv(summary_rows, output_dir / "wydarzenia.csv")
            (output_dir / "wydarzenia.json").write_text(
                json.dumps(summary_rows, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            (output_dir / "errors.json").write_text(
                json.dumps(errors, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            print("\nKońcowa aktualizacja XLSX...")
            try:
                xlsx_path = update_xlsx_or_die(output_dir, errors)
            except Exception:
                import traceback
                print("NIE UDAŁO SIĘ WYKONAĆ KOŃCOWEGO ZAPISU XLSX")
                traceback.print_exc()
                return 3

            print("\nGOTOWE")
            print(f"Katalog: {output_dir.resolve()}")
            if xlsx_path:
                print(f"XLSX: {xlsx_path.resolve()}")
            else:
                print("XLSX: zapis nie powiódł się — sprawdź komunikat UWAGA powyżej")
            print(f"Wydarzenia OK: {len(summary_rows)}")
            print(f"Błędy: {len(errors)}")
            return 0 if not errors else 2
        finally:
            context.close()


if __name__ == "__main__":
    raise SystemExit(main())
