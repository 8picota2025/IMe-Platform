#!/usr/bin/env python3
"""Fetch manufacturer product pages and build resto-paginas-fabricante enrichment JSON."""
from __future__ import annotations

import json
import re
import subprocess
import ssl
import urllib.error
import urllib.request
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEED = ROOT / "docs/audits/fichas-faltantes-2026-10-18/need-page-enrich.json"
MOCK = ROOT / "src/data/mock-productos.json"
MANIFEST = ROOT / "src/data/fichas-enriquecimiento/manifest.json"
OUT = ROOT / "src/data/fichas-enriquecimiento/resto-paginas-fabricante-20261018.json"
URL_MAP_OUT = ROOT / "docs/audits/fichas-faltantes-2026-10-18/paginas-fabricante-restantes.json"
NOTES = ROOT / "docs/audits/fichas-faltantes-2026-10-18/enrich-resto-paginas-notes.json"

UA = "Mozilla/5.0 (compatible; IME-landing-audit/2026-10-18)"
CTX = ssl.create_default_context()

# slug -> optional URL override (need-page pagina wins if set)
URL_OVERRIDES: dict[str, str | list[str]] = {
    "rx-techo-dinamico-qomo": "https://en.szangell.com/product/qomo-series/",
    "rx-techo-dinamico-changfeng": "https://en.szangell.com/product/changfeng-series/",
    "rx-multifuncional-uc-arm-ref-dtp580": "https://angell-tech.com/en/dtp-580-dynamic-uc-arm-digital-r-f/",
    "rx-piso-mtp": "https://en.szangell.com/product/mtp-series/",
    "arco-c-movil-dinamico-hua-ii": "https://en.szangell.com/product/hua-ii-series/",
    "mesita-de-noche-ref-sks002-saikang": "https://saikangmedical.com/en/product/skso2-w-abs-hospital-bedside-cabinet/",
    "monitor-de-paciente-ref-s12-biolight": "http://www.blt.com.cn/product1-ebeea5e0075f445b8d24586413e5927d",
    "bomba-de-jeringa-precision-microdosis": "https://advanced-inst.com/syringe-pump/",
    "cama-de-hospital-plana-r00-ref-sk-c1-r00-saikang": "https://saikangmedical.com/en/product/k2k-manual-bed/",
    "camilla-manual-de-una-funcion-r000w-ref-sk-c1-r000w-saikang": "https://saikangmedical.com/en/product/k2k-manual-bed/",
    "silla-de-espera-ref-ske008-1-saikang": "https://saikangmedical.com/en/product/ske011-1-treat-waiting-chair/",
}

REF_ALIASES: dict[str, list[str]] = {
    "sks002": ["SKS002", "SKS02", "SKS02-W", "SKSO2"],
    "sk-c1-r00": ["SK-C1", "K2K", "R00"],
    "sk-c1-r000w": ["SK-C1", "K2K", "R000W"],
    "ske008-1": ["SKE008-1", "SKE008", "SKE011"],
    "dtp580": ["DTP580", "DTP-580", "580"],
}

# Series mapping: page validates series token, not exact IME ref
SERIES_TOKENS: dict[str, list[str]] = {
    "arco-en-c-alc-280-series-ref-alc-280-angell": ["ALC280", "ALC-280", "HUA II", "HUA-II"],
    "sistema-de-rayos-x-dr-montado-en-techo-ref-dr-ceiling-angell": ["QOMO"],
    "sistema-de-rayos-x-dr-montado-en-suelo-ref-dr-floor-angell": ["MTP"],
    "rx-techo-dinamico-qomo": ["QOMO"],
    "rx-techo-dinamico-changfeng": ["CHANGFENG", "Changfeng"],
    "rx-piso-mtp": ["MTP"],
    "arco-c-movil-dinamico-hua-ii": ["HUA II", "HUA-II", "ALC280"],
    "rx-multifuncional-uc-arm-ref-dtp580": ["DTP580", "DTP-580"],
    "sistema-de-rayos-x-dr-movil-ref-dr-mobile-angell": ["DTP326", "DP326", "326"],
    "sistema-dr-de-mesa-telecomandada-ref-dr-telecomand-angell": ["DTP576", "576"],
    "dr-dinamico-de-brazo-ref-dr-uc-arm-angell": ["DTP580", "580"],
    "dr-dinamico-ref-dtp573-angell": ["DTP573", "573"],
    "detector-plano-inalambrico-ref-tcq-iii-angell": ["TCQ-III", "TCQ III"],
    "sistema-de-ultrasonido-ref-dus-3000-advanced": ["DUS-3000", "DUS 3000"],
    "rx-multifuncional-uc-arm-ref-dtp580": ["DTP580", "DTP-580", "580"],
}

# Do not enrich from a different catalog model (e.g. V-1000T Plus for IME V-1000).
BLOCK_IF_PAGE_CONTAINS: dict[str, list[str]] = {
    "ventilador-para-uci-ref-v-1000-advanced": ["V-1000T", "V1000T", "1000T PLUS", "1000T Plus"],
}

SKIP_SLUGS = {"test"}


def fetch(url: str, timeout: int = 120) -> tuple[int | None, str]:
    try:
        proc = subprocess.run(
            ["curl", "-sL", "--compressed", "-A", UA, "-w", "\n%{http_code}", url],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        out = proc.stdout
        if not out and proc.returncode != 0:
            return None, proc.stderr or "curl_error"
        if not out:
            return None, "empty"
        *body_parts, status_line = out.rsplit("\n", 1)
        body = "\n".join(body_parts)
        try:
            status = int(status_line.strip())
        except ValueError:
            return 200, out
        return status, body
    except subprocess.TimeoutExpired:
        return None, "timeout"
    except FileNotFoundError:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip, deflate"})
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
                return resp.status, resp.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            try:
                body = e.read().decode("utf-8", "replace")
            except Exception:
                body = ""
            return e.code, body
        except Exception as e:
            return None, str(e)


def strip_html(s: str) -> str:
    s = unescape(re.sub(r"<script[^>]*>.*?</script>", " ", s, flags=re.I | re.S))
    s = unescape(re.sub(r"<style[^>]*>.*?</style>", " ", s, flags=re.I | re.S))
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = unescape(re.sub(r"\s+", " ", s)).strip()
    return s


def page_title(html: str) -> str:
    m = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)', html, re.I)
    if m:
        return strip_html(m.group(1))
    m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
    if m:
        return strip_html(m.group(1))
    m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
    return strip_html(m.group(1)) if m else ""


def extract_specs(html: str) -> list[tuple[str, str]]:
    specs: list[tuple[str, str]] = []
    for row in re.finditer(r"<tr[^>]*>(.*?)</tr>", html, re.I | re.S):
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row.group(1), re.I | re.S)
        if len(cells) >= 2:
            k, v = strip_html(cells[0]), strip_html(cells[1])
            if k and v and len(k) < 120 and len(v) < 500:
                specs.append((k, v))
    # dl dt/dd
    for dl in re.finditer(r"<dl[^>]*>(.*?)</dl>", html, re.I | re.S):
        dts = re.findall(r"<dt[^>]*>(.*?)</dt>", dl.group(1), re.I | re.S)
        dds = re.findall(r"<dd[^>]*>(.*?)</dd>", dl.group(1), re.I | re.S)
        for k, v in zip(dts, dds):
            k2, v2 = strip_html(k), strip_html(v)
            if k2 and v2:
                specs.append((k2, v2))
    # dedupe
    seen = set()
    out = []
    for k, v in specs:
        key = (k.lower(), v.lower())
        if key in seen:
            continue
        seen.add(key)
        out.append((k, v))
    return out[:40]


def extract_bullets(html: str) -> list[str]:
    bullets = []
    for li in re.findall(r"<li[^>]*>(.*?)</li>", html, re.I | re.S):
        t = strip_html(li)
        if 15 < len(t) < 280:
            bullets.append(t)
    # unique preserve order
    seen = set()
    out = []
    for b in bullets:
        bl = b.lower()
        if bl in seen:
            continue
        seen.add(bl)
        out.append(b)
    return out[:8]


def extract_codes(html: str, ref: str, title: str) -> list[str]:
    text = f"{title} {strip_html(html)}"
    codes = set()
    if ref:
        codes.add(ref.upper())
        codes.add(ref)
    for m in re.finditer(r"\b(SK[A-Z0-9][A-Z0-9\-_/]{2,20}|DTP\d{3}|DP\d{3}|BME\d{3}|YRBB-\d+|TCS[-\w]+|EBSA-\d+|RGT[-\w.]+|ZT-\d+[A-Z]?|TCQ[-\w]+|S12|M12|DUS-\d+|V-\d+[A-Z]*)\b", text, re.I):
        codes.add(m.group(1))
    return sorted(codes, key=str.lower)[:12]


def model_ok(slug: str, ref: str, html: str, title: str) -> tuple[bool, str]:
    blob = (title + " " + strip_html(html)).upper()
    for bad in BLOCK_IF_PAGE_CONTAINS.get(slug, []):
        if bad.upper() in blob:
            return False, f"blocked_distinct_model:{bad}"
    ref_u = (ref or "").upper().replace("_", "-")
    for alias in REF_ALIASES.get((ref or "").lower(), []):
        if alias.upper() in blob:
            return True, f"alias:{alias}"
    if ref_u and ref_u in blob.replace("_", "-"):
        return True, "ref_on_page"
    if ref_u and ref_u.replace("-", "") in blob.replace("-", ""):
        return True, "ref_normalized_on_page"
    for tok in SERIES_TOKENS.get(slug, []):
        if tok.upper() in blob:
            return True, f"series_token:{tok}"
    # BM BME002 on brother page
    if "BME002" in slug.upper() and "BME002" in blob:
        return True, "bme002"
    if slug == "bomba-de-jeringa-precision-microdosis" and (
        "SYRINGE" in blob and "PUMP" in blob or "MICRO" in blob
    ):
        return True, "syringe_pump_category"
    if "YRBB-20" in ref.upper() and "YRBB-20" in blob:
        return True, "yrbb20"
    if slug == "monitor-de-paciente-ref-s12-biolight" and ("S12" in blob or "型号" in html):
        if re.search(r"S12", blob):
            return True, "s12"
    # Perlong: require exact model token when ref looks like product code
    if "perlong" in slug and ref:
        variants = {ref.upper(), ref.upper().replace(".", ""), ref.replace(".", "-").upper()}
        for v in variants:
            if v and v in blob:
                return True, "perlong_ref"
    return False, "no_match"


def sku_from_mock(product: dict | None, item: dict) -> str:
    if product:
        for k in ("sku", "ref", "codigo"):
            if product.get(k):
                return str(product[k])
        refs = product.get("referencias") or product.get("refs")
        if isinstance(refs, list) and refs:
            return str(refs[0])
    return item.get("ref") or item["slug"].split("-ref-")[-1].split("-")[0]


def fab_name(marca: str) -> str:
    return marca.split("(")[0].strip()


def spec_row(grupo: str, clave: str, valor: str) -> dict:
    return {"grupo": grupo, "clave": clave, "valor": valor}


def build_entry(
    item: dict,
    product: dict | None,
    url: str,
    title: str,
    specs: list[tuple[str, str]],
    bullets: list[str],
    codigos: list[str],
    match_note: str,
) -> dict:
    sku = sku_from_mock(product, item)
    slug = item["slug"]
    nombre = item["nombre"]
    marca = fab_name(item["marca"])
    ref = item.get("ref") or ""

    nombre_ime = nombre
    if product:
        nombre_ime = product.get("nombre_es") or nombre

    spec_lines = [f"{k}: {v}" for k, v in specs]
    specs_summary = "; ".join(spec_lines[:8])

    grupo_fab = f"Página fabricante ({marca})"
    intro_extra = ""
    if match_note.startswith("series_token") or match_note.startswith("alias:"):
        intro_extra = (
            f"En IME la referencia comercial es {ref or sku}; la página del fabricante describe la serie indicada. Confirme equivalencia al cotizar."
        )
    if match_note == "syringe_pump_category":
        intro_extra = (
            "En IME el producto se cotiza como bomba de jeringa de precisión microdosis; la página Advanced es la categoría Syringe Pump (sin SKU único publicado)."
        )

    descripcion_es_parts = [
        f"{nombre_ime} ({marca}) en catálogo IME Colombia para instituciones de salud.",
        intro_extra,
        f"Según la página oficial {marca}: {title}." if title else "",
        f"Códigos visibles en fabricante: {', '.join(codigos)}." if codigos else "",
        (
            f"Parámetros publicados: {'; '.join(spec_lines)}."
            if spec_lines
            else "Parámetros: la página consultada no mostró tabla estructurada; revise el enlace del fabricante."
        ),
        f"Referencia: {url}",
    ]
    descripcion_es = "\n\n".join(p for p in descripcion_es_parts if p)

    descripcion_en_parts = [
        f"{nombre_ime} ({marca}) in the IME Colombia catalog for healthcare institutions.",
        (
            intro_extra.replace("En IME la referencia comercial es", "In IME the commercial reference is")
            .replace("Confirme equivalencia al cotizar.", "Confirm equivalence when requesting a quote.")
            .replace("la página del fabricante describe la serie indicada.", "the manufacturer page describes the indicated series.")
            .replace("la categoría Syringe Pump (sin SKU único publicado).", "the Syringe Pump category (no single published SKU).")
        )
        if intro_extra
        else "",
        f"Per {marca} official page: {title}." if title else "",
        f"Codes on manufacturer page: {', '.join(codigos)}." if codigos else "",
        (
            f"Published parameters: {'; '.join(spec_lines)}."
            if spec_lines
            else "Parameters: the consulted page had no structured table; see manufacturer link."
        ),
        f"Reference: {url}",
    ]
    descripcion_en = "\n\n".join(p for p in descripcion_en_parts if p)

    highlights = bullets[:3] if bullets else [f"Dato fabricante: {l}" for l in spec_lines[:3]]
    highlights = [f"{h} (página {marca})" if "página" not in h.lower() else h for h in highlights[:3]]

    aplicaciones = []
    if product:
        aplicaciones = (product.get("aplicaciones_es") or product.get("aplicaciones_en") or [])[:4]
    if not aplicaciones:
        aplicaciones = ["Hospitalización", "Servicios clínicos"]

    faq_es = [
        {"q": f"¿Qué producto es {nombre_ime}?", "a": f"Equipo {marca} en catálogo IME Colombia. Referencia oficial: {url}."},
        {
            "q": f"¿Qué datos técnicos publica {marca} en su página?",
            "a": specs_summary or "Sin tabla de parámetros visible; IME puede confirmar al cotizar.",
        },
        {"q": "¿Hay ficha PDF en IME?", "a": "Este landing se enriquece con la página del fabricante; IME puede confirmar PDF al cotizar."},
        {"q": "¿Aplicaciones habituales?", "a": "; ".join(aplicaciones) if aplicaciones else "Según área clínica."},
        {
            "q": "¿Cómo cotizar con IME Colombia?",
            "a": f"Indique el modelo {sku} y el uso clínico; IME valida referencia {marca} y disponibilidad.",
        },
    ]
    faq_en = [
        {"q": f"What is {nombre_ime}?", "a": f"{marca} device in IME Colombia catalog. Manufacturer page: {url}."},
        {
            "q": f"What specs does {marca} publish on its product page?",
            "a": specs_summary or "No parameter table visible; confirm with IME when quoting.",
        },
        {"q": "Is there a PDF datasheet on IME?", "a": "This landing uses the manufacturer page; IME can confirm PDF when quoting."},
        {"q": "Typical applications?", "a": "; ".join(aplicaciones) if aplicaciones else "Per clinical area."},
        {
            "q": "How to quote with IME Colombia?",
            "a": f"Provide model {sku} and clinical use; IME validates {marca} reference and availability.",
        },
    ]

    keywords_es = list(
        dict.fromkeys(
            [nombre_ime, f"{nombre_ime} {marca}", *codigos[:4], "equipo médico Colombia", "IME Colombia", marca]
        )
    )
    keywords_en = list(dict.fromkeys([nombre_ime, f"{nombre_ime} {marca}", "medical equipment Colombia", "IME Colombia"]))

    especificaciones = [
        spec_row("Identificación", "Fabricante", marca),
        spec_row("Identificación", "Modelo IME / SKU", sku),
    ]
    for c in codigos[:6]:
        especificaciones.append(spec_row("Identificación", f"Código {marca} (página)", c))
    for k, v in specs:
        especificaciones.append(spec_row(grupo_fab, k, v))

    return {
        "sku": sku,
        "slug": slug,
        "descripcion_larga_es": descripcion_es,
        "descripcion_larga_en": descripcion_en,
        "beneficios_es": highlights,
        "beneficios_en": highlights,
        "valor_es": f"{nombre_ime} ({marca}) — contenido SEO desde página oficial, sin PDF en mock IME.",
        "valor_en": f"{nombre_ime} ({marca}) — SEO content from official page, no PDF in IME mock.",
        "aplicaciones_es": aplicaciones,
        "aplicaciones_en": aplicaciones,
        "faq_es": faq_es,
        "faq_en": faq_en,
        "seo_keywords_es": keywords_es,
        "seo_keywords_en": keywords_en,
        "especificaciones": especificaciones,
        "append_descripcion": False,
    }


def load_perlong_product_urls() -> list[str]:
    st, body = fetch("https://www.perlong-china.com/sitemap.xml")
    if st != 200:
        return []
    return re.findall(r"<loc>(https://www\.perlong-china\.com/[^<]+\.html)</loc>", body)


def load_saikang_sitemap_urls() -> list[str]:
    urls: list[str] = []
    for sm in (
        "https://saikangmedical.com/product-sitemap1.xml",
        "https://saikangmedical.com/product-sitemap2.xml",
    ):
        st, body = fetch(sm)
        if st == 200:
            urls.extend(re.findall(r"<loc>(https://saikangmedical.com/en/product/[^<]+)</loc>", body))
    return urls


def discover_url_by_content(ref: str, candidate_urls: list[str], extra_tokens: list[str] | None = None) -> str | None:
    if not ref and not extra_tokens:
        return None
    tokens = []
    if ref:
        r = ref.upper()
        tokens.extend([r, r.replace("-", ""), r.replace(".", ""), r.replace("_", "-")])
    if extra_tokens:
        tokens.extend([t.upper() for t in extra_tokens])
    for u in candidate_urls:
        ul = u.lower()
        if ref and ref.lower().replace("_", "-") in ul.replace("_", "-"):
            st, html = fetch(u)
            if st == 200 and model_ok("", ref, html, page_title(html))[0]:
                return u
            continue
        st, html = fetch(u)
        if st != 200:
            continue
        blob = strip_html(html).upper()
        if any(t for t in tokens if t and t in blob):
            return u
    return None


def saikang_url_for_ref(ref: str, sitemap_urls: list[str]) -> str | None:
    if not ref:
        return None
    r = ref.lower().replace("_", "-")
    tokens = [r, r.replace("-", "")]
    for u in sitemap_urls:
        ul = u.lower()
        for t in tokens:
            if t and t in ul.replace("_", "-"):
                return u
    return None


def resolve_url(slug: str, item: dict) -> str | None:
    ov = URL_OVERRIDES.get(slug)
    if isinstance(ov, list):
        return ov[0]
    if isinstance(ov, str):
        return ov
    if item.get("pagina"):
        return item["pagina"]
    return None


def is_priority(item: dict) -> bool:
    m = item.get("marca") or ""
    if m in ("Saikang", "Angell Technology", "Perlong", "BM", "Northern Meditec", "Advanced Instrumentations"):
        return True
    if m == "Biolight":
        return item["slug"] == "monitor-de-paciente-ref-s12-biolight"
    if item["slug"] == "monitor-de-paciente-ref-s12-biolight":
        return True
    if "Angell" in m:
        return True
    return False


def main() -> None:
    need = json.loads(NEED.read_text())
    mock = json.loads(MOCK.read_text())
    by_slug = {p["slug"]: p for p in mock}
    manifest: list[dict] = json.loads(MANIFEST.read_text())
    man_index = {m["slug"]: i for i, m in enumerate(manifest)}

    items = [i for i in need["items"] if i["slug"] not in SKIP_SLUGS and is_priority(i)]
    if not any(i["slug"] == "monitor-de-paciente-ref-s12-biolight" for i in items):
        items.append(
            {
                "slug": "monitor-de-paciente-ref-s12-biolight",
                "nombre": "Monitor de paciente Biolight S12",
                "marca": "Biolight",
                "ref": "s12",
                "pagina": URL_OVERRIDES["monitor-de-paciente-ref-s12-biolight"],
            }
        )
    saikang_sitemap = load_saikang_sitemap_urls()
    perlong_urls = load_perlong_product_urls()

    enriched: list[dict] = []
    url_map: dict[str, str | None] = {}
    sources: list[dict] = []
    failed: list[dict] = []

    for item in items:
        slug = item["slug"]
        url = resolve_url(slug, item)
        ref = item.get("ref") or ""
        if not url and item.get("marca") == "Saikang":
            url = saikang_url_for_ref(ref, saikang_sitemap)
        if not url and item.get("marca") == "Perlong":
            url = saikang_url_for_ref(ref, perlong_urls)
        if not url and item.get("marca") == "Saikang":
            path_hits = [
                u
                for u in saikang_sitemap
                if ref and ref.lower().replace("_", "-") in u.lower().replace("_", "-")
            ]
            url = discover_url_by_content(
                ref, path_hits, REF_ALIASES.get(ref.lower(), [])
            )
        url_map[slug] = url
        if not url:
            failed.append({"slug": slug, "reason": "no_url"})
            continue

        status, html = fetch(url)
        if status != 200 or not html or html.startswith("http"):
            failed.append({"slug": slug, "url": url, "http_status": status, "reason": "fetch_failed"})
            continue

        title = page_title(html)
        ok, match_note = model_ok(slug, item.get("ref") or "", html, title)
        if not ok:
            failed.append(
                {
                    "slug": slug,
                    "url": url,
                    "http_status": status,
                    "title": title,
                    "reason": "model_not_on_page",
                    "match_note": match_note,
                }
            )
            continue

        specs = extract_specs(html)
        bullets = extract_bullets(html)
        codigos = extract_codes(html, item.get("ref") or "", title)
        entry = build_entry(item, by_slug.get(slug), url, title, specs, bullets, codigos, match_note)
        enriched.append(entry)
        sources.append(
            {
                "slug": slug,
                "sku": entry["sku"],
                "url": url,
                "http_status": status,
                "title": title,
                "match": match_note,
                "specs_n": len(specs),
            }
        )

        if slug in man_index:
            manifest[man_index[slug]]["origen_local"] = ""
            manifest[man_index[slug]]["url"] = url

    OUT.write_text(json.dumps(enriched, ensure_ascii=False, indent=2) + "\n")
    URL_MAP_OUT.write_text(json.dumps(url_map, ensure_ascii=False, indent=2) + "\n")
    NOTES.write_text(
        json.dumps(
            {
                "fecha": "2026-10-18",
                "archivo": str(OUT.relative_to(ROOT)),
                "n_enriquecidos": len(enriched),
                "n_intentados": len(items),
                "sources": sources,
                "failed_fetches": failed,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"enriched={len(enriched)} failed={len(failed)} attempted={len(items)}")


if __name__ == "__main__":
    main()
