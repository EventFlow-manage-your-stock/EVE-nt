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


BASE_URL = "https://pixel.newsystems.pl"
DEFAULT_FROM = "2026-06-01"
DEFAULT_TO = "2026-06-30"

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
    soup = BeautifulSoup(html, "lxml")
    table = soup.find("table")
    if not table:
        return []

    out: list[EventListItem] = []
    for tr in table.select("tbody tr.events-grid"):
        link = tr.select_one("a.event-class[data-id]")
        if not link:
            continue

        tds = tr.find_all("td", recursive=False)
        if len(tds) < 11:
            continue

        internal_id = clean_text(link.get("data-id"))
        event_name_list = clean_text(link.get_text(" ", strip=True))
        event_name, event_code = split_event_name_code(event_name_list)
        start, end = parse_range_cell(tds[8])

        out.append(
            EventListItem(
                internal_id=internal_id,
                list_no=clean_text(tds[3].get_text(" ", strip=True)),
                event_name_list=event_name_list,
                event_name=event_name,
                event_code=event_code,
                accounting=clean_text(tds[0].get_text(" ", strip=True)),
                status=clean_text(tds[1].get_text(" ", strip=True)),
                client=clean_text(tds[6].get_text(" ", strip=True)),
                event_manager=clean_text(tds[7].get_text(" ", strip=True)),
                start=start,
                end=end,
                accounting_date=clean_text(tds[9].get_text(" ", strip=True)),
                created_at=clean_text(tds[10].get_text(" ", strip=True)),
                detail_url=urljoin(base_url, link.get("href", "")),
            )
        )
    return out


def selected_value(select: Tag | None) -> str:
    if not select:
        return ""
    opt = select.find("option", selected=True)
    if opt:
        return clean_text(opt.get_text(" ", strip=True))
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
        text = clean_text(client_h.get_text(" ", strip=True))
        text = re.sub(r"^Klient:\s*", "", text)
        # W widoku NEW zdarza się pusty fragment "(NIP:)"; nazwa z listy jest wtedy lepsza.
        text = re.sub(r"\s*\(NIP:\s*\)\s*$", "", text).strip()
        if text:
            result["client"] = text

    # Miejsce
    for p in soup.find_all(["p", "div", "span"]):
        txt = clean_text(p.get_text(" ", strip=True))
        if "MIEJSCE:" in txt and len(txt) < 500:
            m = re.search(r"MIEJSCE:\s*(.*?)(?:\s+STATUS:|$)", txt, re.I)
            if m and clean_text(m.group(1)):
                result["location"] = clean_text(m.group(1))
                break

    # Status wydarzenia
    status_row = soup.select_one(".event-status-row")
    if status_row:
        txt = clean_text(status_row.get_text(" ", strip=True))
        txt = re.sub(r"^STATUS:\s*", "", txt, flags=re.I)
        txt = re.sub(r"\s+Historia$", "", txt, flags=re.I)
        if txt:
            result["status"] = txt

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

    def scrape_event(self, item: EventListItem) -> tuple[dict[str, Any], Path]:
        main_html, final_url = self.get_text(item.detail_url)
        self.assert_authenticated(main_html, final_url)

        header = parse_event_header(main_html, item)

        # Typ wydarzenia: próbujemy z formularza aktualizacji.
        update_url = f"{BASE_URL}/admin/event/update?id={item.internal_id}"
        try:
            update_html, update_final = self.get_text(update_url)
            self.assert_authenticated(update_html, update_final)
            type_info = parse_event_type_from_update(update_html)
            if type_info["type"]:
                header["type"] = type_info["type"]
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

        # Załączniki — pobieramy widok "Wyświetl wszystko", jeśli istnieje.
        attachments_html, _ = self.fetch_all_variant(main_html, "#tab-attachment", item.detail_url)
        attachments_section = save_section("zalaczniki", attachments_html, "#tab-attachment", event_dir)
        attachments = self.download_attachments(attachments_html, event_dir)

        # Oferty
        offer_url = f"{BASE_URL}/admin/event/offer-tab?id={item.internal_id}"
        offer_html, offer_final = self.get_text(offer_url)
        self.assert_authenticated(offer_html, offer_final)
        offers = save_section("oferty", offer_html, None, event_dir)

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
            "external_gear": {
                "need": external_need,
                "reserved_at_supplier": external_reserved,
            },
            "attachments_section": attachments_section,
            "attachments": attachments,
            "offers": offers,
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


def main() -> int:
    ap = argparse.ArgumentParser(description="Eksport wydarzeń NEW Systems")
    ap.add_argument("--from", dest="date_from", default=DEFAULT_FROM, help="YYYY-MM-DD")
    ap.add_argument("--to", dest="date_to", default=DEFAULT_TO, help="YYYY-MM-DD")
    ap.add_argument("--output", default="", help="Katalog wynikowy")
    ap.add_argument("--profile", default=".newsystems-browser-profile", help="Profil Chromium z sesją NEW")
    ap.add_argument("--delay", type=float, default=0.25, help="Przerwa między requestami w sekundach")
    ap.add_argument("--headless", action="store_true", help="Uruchom bez okna (tylko po zapisaniu sesji)")
    ap.add_argument("--force", action="store_true", help="Pobierz ponownie wydarzenia już oznaczone complete")
    args = ap.parse_args()

    d_from = datetime.strptime(args.date_from, "%Y-%m-%d").date()
    d_to = datetime.strptime(args.date_to, "%Y-%m-%d").date()
    if d_to < d_from:
        raise SystemExit("--to nie może być wcześniejsze niż --from")

    output_dir = Path(args.output) if args.output else Path(f"NEW_export_{d_from}_{d_to}")
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "wydarzenia").mkdir(exist_ok=True)

    run_meta = {
        "date_from": str(d_from),
        "date_to": str(d_to),
        "base_url": BASE_URL,
        "started_at": datetime.now().isoformat(sep=" ", timespec="seconds"),
    }
    (output_dir / "run.json").write_text(json.dumps(run_meta, ensure_ascii=False, indent=2), encoding="utf-8")

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
                        if old.get("complete") is True:
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
                                    "event_manager": summary.get("event_manager", item.event_manager),
                                    "start": summary.get("start", item.start),
                                    "end": summary.get("end", item.end),
                                    "created_at": item.created_at,
                                    "folder": str(existing[0].parent.relative_to(output_dir)),
                                    "attachments_ok": sum(1 for a in attachments if a.get("ok")),
                                    "attachments_errors": sum(1 for a in attachments if not a.get("ok")),
                                }
                            )
                            print("  pomijam — kompletny event.json już istnieje")
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

            write_summary_csv(summary_rows, output_dir / "wydarzenia.csv")
            (output_dir / "wydarzenia.json").write_text(
                json.dumps(summary_rows, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            (output_dir / "errors.json").write_text(
                json.dumps(errors, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            print("\nGOTOWE")
            print(f"Katalog: {output_dir.resolve()}")
            print(f"Wydarzenia OK: {len(summary_rows)}")
            print(f"Błędy: {len(errors)}")
            return 0 if not errors else 2
        finally:
            context.close()


if __name__ == "__main__":
    raise SystemExit(main())
