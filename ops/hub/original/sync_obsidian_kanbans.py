#!/usr/bin/env python3
"""
Sincroniza en tiempo real los tableros Kanban de Obsidian (IME-Vault) y ops-hub.db
con la base de datos SQLite del enjambre Hermes (kanban.db), enviados.db e IMAP auditado.
"""
import os
import sqlite3
from datetime import datetime, timezone, timedelta
from pathlib import Path

VAULT = Path("/home/shoky/IME-Vault")
PANEL = VAULT / "00-Panel-Control"
DB_PATH = Path("/home/shoky/.hermes/kanban/boards/ime-enjambre/kanban.db")
ENVIADOS_DB = Path("/home/shoky/.hermes/shared/correo/salida/enviados.db")
OPS_HUB_DB = Path("/home/shoky/ime-ops-stack/ops-hub.db")

BOGOTA = timezone(timedelta(hours=-5))

def now_cot() -> str:
    return datetime.now(BOGOTA).strftime("%Y-%m-%d %H:%M COT")

def get_sent_map() -> dict:
    if not ENVIADOS_DB.exists():
        return {}
    conn = sqlite3.connect(str(ENVIADOS_DB))
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT ap_id, message_id, utc, to_norm, subj_norm FROM env").fetchall()
    conn.close()
    return {r["ap_id"]: dict(r) for r in rows}

def build_kanban_3() -> str:
    if not DB_PATH.exists():
        return ""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    def fetch(statuses, limit=50):
        placeholders = ",".join("?" for _ in statuses)
        q = f"""
            SELECT id, status, assignee, priority, title, substr(created_at, 1, 16) as dt,
                   substr(completed_at, 1, 16) as comp_dt, result
            FROM tasks
            WHERE status IN ({placeholders})
            ORDER BY created_at DESC
            LIMIT ?
        """
        return cur.execute(q, (*statuses, limit)).fetchall()

    ready_tasks = fetch(["ready", "todo", "in_progress"], 50)
    blocked_tasks = fetch(["blocked", "needs_input"], 50)
    done_tasks = fetch(["done", "completed"], 35)

    counts = dict(cur.execute("SELECT status, COUNT(*) FROM tasks GROUP BY status").fetchall())
    conn.close()

    total_done = counts.get("done", 0) + counts.get("completed", 0)
    total_ready = counts.get("ready", 0) + counts.get("todo", 0) + counts.get("in_progress", 0)
    total_blocked = counts.get("blocked", 0) + counts.get("needs_input", 0)

    lines = [
        "---",
        "kanban-plugin: board",
        "tags: [ime, kanban, hermes, enjambre]",
        f"updated: {now_cot()}",
        "---",
        "",
        "## 1. En Cola / Listas para Ejecutar (Ready & Todo)",
        "",
    ]
    for r in ready_tasks:
        title = (r["title"] or "").replace("\n", " ").strip()
        lines.append(f"- [ ] **{r['id']}** · `{r['assignee']}` ({r['status']}, prio {r['priority']}) — {title} *(creada: {r['dt']})*")

    lines.extend([
        "",
        "## 2. En Espera de Insumo / Bloqueadas (Pendientes de Bot / Datos)",
        "",
    ])
    for r in blocked_tasks:
        title = (r["title"] or "").replace("\n", " ").strip()
        lines.append(f"- [ ] **{r['id']}** · `{r['assignee']}` — {title} *(creada: {r['dt']})*")

    lines.extend([
        "",
        f"## 3. Completadas Recientemente ({total_done} históricas en total)",
        "",
    ])
    for r in done_tasks:
        title = (r["title"] or "").replace("\n", " ").strip()
        res_note = f" — *{r['result']}*" if r["result"] else ""
        lines.append(f"- [x] **{r['id']}** · `{r['assignee']}` — {title}{res_note} *(completada: {r['comp_dt'] or r['dt']})*")

    lines.extend([
        "",
        "%% kanban:settings",
        "```",
        '{"kanban-plugin":"board","list-collapse":[false,false,false]}',
        "```",
        "%%",
        "",
        f"> **Resumen en vivo (`kanban.db`):** `{total_ready}` listas/en cola · `{total_blocked}` pendientes de insumo/costeo · `{total_done}` completadas.",
        "> Ver [[00-Panel-Control/Dashboard-Operativo|Dashboard Operativo]] y [[00-Panel-Control/AUDITORIA-CORREOS-PROVEEDORES-CLIENTES-2026-10-24|Auditoría Forense 24-Oct-2026]].",
        ""
    ])
    return "\n".join(lines)

def build_kanban_1() -> str:
    return f"""---
kanban-plugin: board
tags: [ime, kanban, comercial, cotizaciones, clientes]
updated: {now_cot()}
---

## 1. Lead Entrante / En Calificación y Búsqueda de Precio

- [ ] **CLAOMA / ECCI** (`claoma3@yahoo.com`, tel. `+57 322 210 1312`) — Monitor multiparámetro **Biolight M12** o equivalente **Mindray BeneVision N12** · Descarga de ficha técnica en web el `2026-10-23 06:30 COT` (`<f94c0576bf94524a89098f91065bc4fa@i-me.com.co>`) · **RFQs enviadas el 23-oct 19:10 COT a EMCO (`ventas@emco.com.co`, `ENC-Shoky-2026-10-23d`) y Promedco (`comercial@promedco.com`, `ENC-Shoky-2026-10-23e`)**. Pendiente respuesta de distribuidores y costeo de oferta automática (`t_ed585d71`, `t_33762bf5`).
- [ ] **Lead WhatsApp `+57 320 275 9337`** — Mesas de cirugía electrohidráulicas **Saikang** (`Fichas_tecnicas_IME_mesas_Saikang.pdf`) · [[20-Clientes-y-Cotizaciones/INDICE-CLIENTES-Y-OPORTUNIDADES|Ver índice]] · En calificación técnica.
- [ ] **Lead MTP-580B3** — Alternativas de equipamiento evaluadas (`alternativas.md` / `alternativas.csv`) · En validación técnica.

## 2. Esperando Cotización de Proveedor / En Costeo Interno

- [ ] **IME-Q-2026-000052 · Cima Ocupacional — Camila Buriticá Ríos** (`camilaburiticarios@gmail.com`) — **Detector Flat Panel DR inalámbrico 43×43 cm CsI** · **Aviso de estado YA ENVIADO al cliente el `2026-10-24 09:16:47 COT`** (`<179285140787.268615.16102007062165020522@i-me.com.co>`) · **7 RFQs YA ENVIADAS el `2026-10-24 09:16–09:17 COT` (`AP-PROV-0159` a `AP-PROV-0165`)** a iRay, CareRay, DRTECH, Vieworks, DRGEM, CMedical y TMédica · Esperando cotizaciones de fabricantes/distribuidores para costear.
- [ ] **IME-Q-2026-000042 · 2M Trading Qatar — Essam Yaseen** (`bdm@2mqatar.com`) — **3 × OR Integration + 3 × 4K Laparoscopy Tower (Sidra Medicine Tender `20172,2`)** · [[20-Clientes-y-Cotizaciones/2M_QATAR/_ficha|Ficha]] · **NOVEDAD 24-Oct (`05:09 COT`, `<225443571714360320.0.v2@titan.email>`):** Essam envió **Amendment 2 (`20172,2_SUPPLIER.pdf`)** con planos AutoCAD y **nuevo cierre ampliado al `19-nov-2026 17:11 AST`** · **Ofertas recibidas:** SonoScape `SV-M4K220Exp` **USD 42,400 EXW/u** (22-oct) y Barzan Medical Mindray `UX5` **QAR 225,000/u** preliminar (cotización formal con integración OR prometida para dom 25-oct).
- [ ] **IME-Q-2026-000033 · Universidad de La Guajira (UniGuajira)** — Lote dotación laboratorio biomédico y simulación · [[20-Clientes-y-Cotizaciones/UNIGUAJIRA/_ficha|Ficha]] · Precios recibidos: **Dental Store Miniklav 12L ($3.360.000 COP IVA inc.) y 5.5L ($2.850.000 COP IVA inc.)**, **Saikang mobiliario EXW/FOB (`Offer 20261013-2`)**, **Allers COMEN S5 ($9.215.954 + IVA)**, **Jmedics ZOLL M2 ($24.620.000 + IVA)** · Relanzamiento enviado a Industrias Gustavo Vergara (`AP-PROV-0158`, 24-oct `09:16 COT`) · Pendiente autorización de Shoky para enviar 6 RFQs de ampliación (`UNI-01..06`).
- [ ] **IME-Q-2026-000041 · CENEMED S.A.S. (Santander de Quilichao)** — Lote hospitalario y monitor signos vitales (`Comen V3 Pro` / `Advanced A4051`) · [[20-Clientes-y-Cotizaciones/CENEMED_QUILICHAO/_ficha|Ficha]] · Comen envió specs `V3 Pro` (20-oct, falta lista de precios); pendiente pre-costeo `FASE2-OV-03` (`t_2c711ad7`).
- [ ] **IME-Q-2026-000043 · IJEMA IPS** — Cabina de flujo laminar / VersaFlow `VF-4USP` (`AP-PROV-0087..0090`: Germfree, Esco, CI Colombian Med, Biored) · [[20-Clientes-y-Cotizaciones/IJEMA_IPS/_ficha|Ficha]] · En espera de cotizaciones técnicas con INVIMA.
- [ ] **Tout Aman (Jordania — Lic. JFDA)** — Ecógrafo Doppler (`SonoScape X5` / `DUS 5000 Plus`) · [[20-Clientes-y-Cotizaciones/TOUT_AMAN/_ficha|Ficha]] · En consolidación de certificados JFDA/FDA.
- [ ] **IPS CMT** — Propuesta de precios en estructuración (`propuesta_precios_ips_cmt.md`) · [[20-Clientes-y-Cotizaciones/IPS_CMT/_ficha|Ficha]].

## 3. Cotización / Respuesta Comercial Enviada — En Seguimiento Activo

- [ ] **Laura Katherine Gutiérrez Vargas (Neiva, Huila)** (`kathevargas2208@gmail.com`) — **Robots autónomos de limpieza 24/7 para clínicas y oficinas** · [[20-Clientes-y-Cotizaciones/LAURA_KATHERINE_NEIVA/_ficha|Ficha]] · **CORREO YA ENVIADO el `2026-10-24 09:16:44 COT`** desde `comercial1@i-me.com.co` (`Message-ID: <179285140445.268615.12891028648368524769@i-me.com.co>`, ref. `ENC-Shoky-2026-10-24-laura-katherine-neiva`) · Esperando respuesta de la cliente con m² y tipo de áreas en Neiva para dimensionar y cotizar modelo.
- [ ] **IME-Q-2026-000036 · Cardiocenter — Carlos Germán Calderón Alarcón** (`c_calderon9@yahoo.com`) — Cotización por **COP 4.530.000 sin IVA** (vigente hasta `28-oct-2026`) · Enviada el `14-oct-2026` (`<179199374836.3229.15201053960452333804@i-me.com.co>`) · Pendiente completar NIT y ciudad (`t_cd37ffd3`) y seguimiento antes del vencimiento.
- [ ] **IME-Q-2026-000046 · SolioSalud** — Seguimiento comercial enviado (`AP-CRM-0001`, `16-oct-2026`, `<179217798377.11013.4898033319954771746@i-me.com.co>`) · [[20-Clientes-y-Cotizaciones/SOLIOSALUD/_ficha|Ficha]] · Plantillas Día 5 y Día 10 (`AP-CRM-0008`) ya aprobadas por Shoky.
- [ ] **IME-Q-2026-000038 / 000039 · Deyanira Padilla (`deyanirapadilla2015@gmail.com`)** — Cotización final `KP-153` enviada el `15-oct-2026` (`<179209961630.6742.5488930404462678067@i-me.com.co>`) · [[20-Clientes-y-Cotizaciones/DEYANIRA_PADILLA/_ficha|Ficha]] · En seguimiento Día 5 / Día 10.
- [ ] **IME-Q-2026-000037 · SaludTrec (`compras@saludtrec.com`)** — 3 × Ventiladores `Crius V6` (Opción A) / `Crius V8` (Opción B) · Enviada el `15-oct-2026` (`<179207980344.1322.17237705279075498443@i-me.com.co>`) + `AP-PROV-0075..0079` · [[20-Clientes-y-Cotizaciones/SALUDTREC/_ficha|Ficha]] · Nota: Gilmédica cotizó 3 × Neumovent GraphNet TS en $161.085.432 COP IVA inc. (23-oct) e Aeonmed cotizó VG70 en USD 4,350 CIF Medellín (21-oct).
- [ ] **IME-Q-2026-000034 · JELT (`directoracomercial@jelt.com.co`)** — Ventilador `Crius V6` · Enviada el `14-oct-2026` (`<179199374347.3229.10599585723232510796@i-me.com.co>`) · [[20-Clientes-y-Cotizaciones/JELT/_ficha|Ficha]] · En seguimiento comercial.
- [ ] **AMAIPS (`compras@amaips.com`)** — Mamógrafo digital **Angell `DM156A`** · Costeo `PI_AO2026101001-902351` (**USD 54,000 CIF Buenaventura**) · [[20-Clientes-y-Cotizaciones/AMAIPS/_ficha|Ficha]] · Reunión con Sherry Lee (Angell) contrapropuesta hoy 24-oct para el **lunes 26-oct-2026 a las 15:00 COT**.
- [ ] **IME-Q-2026-000035 · Welcome UK (Liraglutide)** — Propuesta `v9 ES-EN` y Contrato `v7.1 ES-EN` · [[20-Clientes-y-Cotizaciones/WELCOME_UK_LIRAGLUTIDE/_ficha|Ficha]] · En revisión contractual e inteligencia regulatoria (`UK-GLP1` / `ENGLAND-SEMAGLUTIDE`).
- [ ] **Rionegro — Johan (`johan@rionegro...`)** — `Presupuesto_IME_Rionegro_v3_enviado.pdf` enviado el `08-oct-2026` (`<179147720312.66064.18193138246834169022@i-me.com.co>`) · [[20-Clientes-y-Cotizaciones/RIONEGRO/_ficha|Ficha]] · En seguimiento institucional.

## 4. Cerradas / Resueltas / Históricas Verificadas

- [x] **AP-CRM-0008 · Plantillas de seguimiento post-cotización Día 5 y Día 10** — **APROBADA por Shoky** (`[t341u]` / `[t344u]`, 24-oct-2026). Sustituye a `AP-CRM-0002` y `AP-CRM-0003`.
- [x] **AP-PROV-0075 · Gilmédica S.A.S. (3 × Ventilador Neumovent GraphNet TS)** — Oferta formal recibida el `23-oct-2026 09:11 COT` por **$161.085.432 COP IVA incluido** (`<CAF=PTgXog_9STpE92KM2D6W519P9xn3nt5xO4DnYtpmN2xTP6g@mail.gmail.com>`). Proyecto cerrado por Shoky el 23-oct.
- [x] **Prueba de salida Correo Hermes (`ENC-Shoky-2026-10-23-PRUEBA-0ba7f7da`)** — Enviada el `23-oct-2026 09:03 COT` a `jfmpapillon@gmail.com` (`<179276422173.3324215.13890569195093712786@i-me.com.co>`).

%% kanban:settings
```
{{"kanban-plugin":"board","list-collapse":[false,false,false,false]}}
```
%%
"""

def build_kanban_2() -> str:
    return f"""---
kanban-plugin: board
tags: [ime, kanban, proveedores, invima, compras]
updated: {now_cot()}
---

## 1. RFQs Enviados — Esperando Respuesta / Cotización del Proveedor

- [ ] **Industrias Gustavo Vergara S.A.S. (`autoclaves.miniclave@gmail.com`)** — Autoclaves **Miniklav-GV 5,5 L y 12 L** (precio distribuidor, flete a Bogotá/Riohacha, INVIMA `2017DM-0016797`) · **YA ENVIADOS:** `ENC-Shoky-2026-10-23` el `23-oct 10:03 COT` (`<179276779338.3570961.4997632613116511035@i-me.com.co>`) y **`AP-PROV-0158` el `24-oct 09:16:40 COT`** (`<179285140082.268615.1054358503463007170@i-me.com.co>`). Esperando respuesta del fabricante.
- [ ] **7 Fabricantes/Distribuidores de Detector Flat Panel DR 43×43 cm (`AP-PROV-0159` a `AP-PROV-0165`)** — **LOS 7 CORREOS YA SE ENVIARON el `2026-10-24 09:16:51–09:17:16 COT`** desde `proveedores@i-me.com.co`:
  - `AP-PROV-0159` · **iRay** (`market@iraygroup.com`) · `<179285141112.268615.10493248471491821932@i-me.com.co>`
  - `AP-PROV-0160` · **CareRay** (`globalsales@careray.com`) · `<179285141538.268615.8533315051703062183@i-me.com.co>`
  - `AP-PROV-0161` · **DRTECH** (`drtech@drtech.com`) · `<179285142053.268615.9094032354074864928@i-me.com.co>`
  - `AP-PROV-0162` · **Vieworks** (`MedicalImagingSalesTeam@vieworks.com`) · `<179285142473.268615.3812379453854506372@i-me.com.co>` *(rebote parcial solo del buzón individual `jseong0904@vieworks.com` por buzón lleno; entregado al grupo)*
  - `AP-PROV-0163` · **DRGEM** (`sales@drgemhealthcare.com`, CC `sales@drgem.co.kr`) · `<179285142800.268615.9153230879217754808@i-me.com.co>`
  - `AP-PROV-0164` · **CMedical / Pixxgen** (`ventas@cmedical.com.co`) · `<179285143227.268615.7906120713822022081@i-me.com.co>`
  - `AP-PROV-0165` · **TMédica** (`info@tmedica.com.co`) · `<179285143695.268615.12170746950533189972@i-me.com.co>`
- [ ] **EMCO S.A.S. (`ventas@emco.com.co`) y Promedco S.A.S. (`comercial@promedco.com`)** — Monitor **Mindray BeneVision N12** (INVIMA `2016EBC-0014959`) para CLAOMA/ECCI · **YA ENVIADOS el `2026-10-23 19:10 COT`** (`ENC-Shoky-2026-10-23d` `<179280060128.1709461.2191344836418968431@i-me.com.co>` y `ENC-Shoky-2026-10-23e` `<179280060387.1709461.10128975357539610074@i-me.com.co>`). Esperando cotización formal.
- [ ] **Woson Medical (`coco@woson.com.cn`)** — Autoclaves clase B `TANZO` · **YA ENVIADA** respuesta con tamaño de mercado e INVIMA el `2026-10-23 10:03:11 COT` (`ENC-Shoky-2026-10-23a`, `<179276779187.3570961.9999235087274814824@i-me.com.co>`). Esperando tabla FOB Ningbo/Shanghai.
- [ ] **INTCO Medical (`alkaidwang@intcomedical.com`)** — Sillas de ruedas manuales `Doly` y eléctricas `E-Star` (`AP-PROV-0136`, enviado `21-oct 22:08 COT`, `<179263851598.1815578.10185081900246041763@i-me.com.co>`). Esperando lista FOB/EXW y CE/ISO/FDA.
- [ ] **Harbin Howell Medical (`abby@howellmedical.com`)** — Mesas quirúrgicas y lámparas cialíticas (`AP-PROV-0137`, enviado `21-oct 22:08 COT`, `<179263851835.1815578.8037959718499825838@i-me.com.co>`). Esperando catálogo y precios FOB.
- [ ] **Shenzhen Zuowei Technology (`yingying@zuowei.com`)** — Robótica de rehabilitación y cuidado inteligente (`AP-PROV-0139`, enviado `21-oct 22:08 COT`, `<179263852256.1815578.14076450966524921899@i-me.com.co>`). Esperando precios FOB por nivel de volumen.
- [ ] **B. Braun (`$IME_CONTACTO_BBRAUN`) y Fresenius Kabi (`$IME_CONTACTO_FRESENIUS`)** — Bombas de infusión (`AP-PROV-0155` y `AP-PROV-0156`, enviados `21-oct 22:18 COT`). Esperando asignación de ejecutivo comercial.
- [ ] **Dawei Medical (`daweimed@daweimed.com`) y Lepu Medical (`international@lepumedical.com`)** — Desfibriladores y monitores (`AP-PROV-0154` y `AP-PROV-0157`, enviados `21-oct 22:18 COT`). Esperando cotización FOB.

## 2. Oferta / Respuesta Recibida — En Evaluación Técnica, Costeo o Decisión

- [ ] **Shenzhen Angell Technology (`sherry@szangell.com`, Sherry Lee)** — Mamógrafo `DM156A` (**PI `AO2026101001-902351`: USD 54,000 CIF Buenaventura**; DR dinámico `PLX8600`: USD 63,000 EXW) + inclusión de I-ME como importador en `INVIMA 2023EBC-0027980` · **NUEVA RESPUESTA HOY `2026-10-24 04:00 COT` (`<92381024-67AE-45B4-9F1D-6DEF16707AB0@szangell.com>`):** Sherry está viajando a LATAM y **contrapropone reunión para el lunes `26-oct-2026 a las 15:00 COT` (3:00 p.m. Colombia)**. Pendiente OK de Shoky para confirmar agenda.
- [ ] **Promek Medical (`export@promekmedical.com.tr`, I. Dansoko)** — Camas hospitalarias y mobiliario clínico en Dropshipping · **NUEVA RESPUESTA HOY `2026-10-24 12:49 COT` (`<154501dd63e0$0ac59d10$2050d730$@promekmedical.com.tr>`):** Confirmó viabilidad de envíos directos a clientes finales en Colombia y documentación a nombre de I-ME; base EXW İzmir (FOB İzmir y CIF Cartagena bajo pedido), pago anticipado, producción 2–5 semanas; enviarán cotización modelo por modelo en USD corrigiendo códigos duplicados (`P-KT-008/009`, `P-SD-002/003`).
- [ ] **SonoScape Medical (`jim.cai@sonoscape.net`, Jim Cai)** — Torre de laparoscopia 4K + fluorescencia ICG `SV-M4K220Exp` (para 2M Qatar / Sidra Medicine) · **PRECIO VERIFICADO EN PDF (`INBOX [166]`, 22-oct 22:31 COT):** **USD $42,400 EXW Shenzhen** por sistema completo (procesador $15,750 + cabezal 4K NIR $6,750 + fuente luz $6,750 + monitor 32" 4K $6,300 + carro $1,000 + ópticas 0° y 30° $3,300 + fibra $400 + insuflador $2,150). Plazo 3 semanas, CE MDR `HZ 2027206-1`.
- [ ] **Barzan Medical Qatar (`shahabaskm@barzanmedical.com`, Shahabas K M)** — Torre laparoscópica 4K **Mindray UX5** (`INBOX [159]`, 22-oct 11:23 COT): precio presupuestario preliminar **QAR 225,000/u × 3 = QAR 675,000** (~USD $61,813/u); cotización formal con integración OR prometida para el domingo 25-oct.
- [ ] **Dental Store / Grupo Dental de Colombia (`contacto@dentalstore.com.co`)** — **PRECIO VERIFICADO EN PDF (`Cotización C-1-417`, `INBOX [138]`, 20-oct 12:41 COT):** Autoclave **Miniklav-GV 12 L = $3.360.000 COP IVA inc.** ($2.823.529 antes de IVA) y **Miniklav-GV 5,5 L = $2.850.000 COP IVA inc.** ($2.394.958 antes de IVA). Total ambas: **$6.210.000 COP IVA inc.** Entrega 4–10 días hábiles, garantía 1 año, contado 100%.
- [ ] **Allers Group S.A.S. (`dquintanilla@allers.com.co`, Daniela Quintanilla)** — Desfibrilador **COMEN S5** (`Cot. 1082815` del 22-oct, `INBOX [160]`): **$9.215.954 COP + IVA = $10.966.985 COP** (1 unidad en remate, entrega 2 días, INVIMA `2021EBC-0023576`). No lista SpO2 ni electrodos; pendiente decisión de Shoky (`PROV-ALLERS-S5`).
- [ ] **Jmedics S.A.S. (`ventas3@jmedics.com`, Leidy Cárdenas)** — Monitor desfibrilador **ZOLL M2** (`Cot. 4657` del 21-oct, `INBOX [153]`): **$24.620.000 COP + IVA = $29.297.800 COP** (INVIMA `2020EBC-0021777`, entrega 30–45 días).
- [ ] **Heyer Medical / Aeonmed (`tianyuan@heyermed.com`, Tian Yuan)** — Ventilador UCI **Aeonmed VG70** (`PI Aeon20261021`, `INBOX [145]`): **USD $3,850 FOB + $490 flete + $10 seguro = USD $4,350 CIF Medellín** (validez PI hasta 30-oct-2026).
- [ ] **Beijing Siriusmed Medical (`diana@siriusmedica.com`, Diana / Zhao)** — Ventilador UCI **R55** (`INBOX [75]`, 11-oct): **USD $4,300 EXW Beijing** (sin compresor) / **USD $5,100 EXW Beijing** (con compresor). INVIMA en trámite por Siriusmed.
- [ ] **Shenzhen Comen Medical (`leonardo@szcomen.com`)** — Monitor **V3 Pro** (`INBOX [133]`, 20-oct): envió brochure y especificaciones técnicas (`V3 Pro specifications V1.0`); falta lista de precios FOB.
- [ ] **Jiangsu Saikang Medical (`sofia@saikangmedical.com`, `echo@saikangmedical.com`)** — Mobiliario hospitalario (`Saikang Offer_for IME_20261013-2.pdf`, `INBOX [131]`): SKS02-W USD 46, SKH042 USD 38, SKH046-14 USD 76 EXW/FOB Shanghai; INVIMA `2025DM-0030878` vigente.
- [ ] **UniX AI (`skye.li@unix-group.ai`, Skye Li)** — Robots humanoides y de servicio (`Wanda 2.0 / 3.0`, `Panther`, `Martian`) · **Precios verificados (`INBOX [139]`, 20-oct):** entre **USD $8,840 y USD $65,000** según modelo. Reprogramó llamada (`INBOX [167]`, 23-oct) proponiendo lun 26-oct o mar 27-oct 09:00 China (`20:00 COT` del dom 25 o lun 26). Pendiente confirmación de Shoky (`PROV-UNIX-CALL`).
- [ ] **Nanjing AMIS Medical (`sales@amismed.com`, Lily Song)** — **NUEVA RESPUESTA HOY `2026-10-24 19:17 COT` (`INBOX [173]`, `<1991839782.3082754.1792887422319@smtp.qiye.163.com>`):** Envió `AMIS catalogue 2026.pdf` y consulta si I-ME aún acepta su oferta B2B para Ecógrafos Doppler, Rayos X / DR, Analizadores de laboratorio y Autoclaves. Pendiente decisión (`PROV-AMIS-EVAL`).
- [ ] **QuickMind / YIWEI VR (`suyii.huang@quickmindstore.com`, Suyii Huang)** — Simulador médico VR (`INBOX [137]` y `[157]`, 20-oct y 22-oct): **Hardware USD $2,600/set (1–3 u.) | Software vitalicio USD $10,800 (1–3 u.) = USD $13,400/set completo EXW** (MOQ 1, entrega 15–30 días). En evaluación de mercado.
- [ ] **Axio Biosolutions (`info@axiobio.com`, Anupama)** — Hemostáticos de quitosano `Axiostat` (`comercial1@ INBOX [9]`, 18-oct): consulta sobre interés de distribución en Colombia.

## 3. Pendientes de Aprobación de Shoky (Reuniones / Nuevos RFQs)

- [ ] **PROV-ANGELL-CALL-20261026** — Confirmar reunión virtual con **Sherry Lee (Angell Technology, `sherry@szangell.com`)** para el **lunes 26 de octubre de 2026 a las 15:00 COT** (contrapropuesta recibida hoy 24-oct a las 04:00 COT).
- [ ] **PROV-UNIX-CALL** — Confirmar fecha/hora de reunión reprogramada con **Skye Li (UniX AI, `skye.li@unix-group.ai`)**: domingo 25-oct `20:00 COT` o lunes 26-oct `20:00 COT` (09:00 AM China del día siguiente).
- [ ] **PROV-ALLERS-S5** — Decidir si consultar a **Allers (`dquintanilla@allers.com.co`)** por módulo SpO2 + electrodos en el COMEN S5 de remate ($9.215.954 + IVA) o priorizar alternativa Ambulanc/AMOUL (`INVIMA 2024EBC-0028718`) / ZOLL M2 ($24.620.000 + IVA).
- [ ] **PROV-UNIGUAJIRA-AMP-6RFQ (`UNI-01..06`)** — Autorizar envío de las 6 RFQs de ampliación de UniGuajira (`IME-Q-2026-000033`: Mubi, Saikang, Fisiotech, GMD/Impormedical, Equitronic, SECA).

## 4. Cerrados / Resueltos / Descartados

- [x] **Gilmédica S.A.S. (`lisbeth.narvaez@gilmedica.com`, `AP-PROV-0075`)** — Cotización formal recibida el `23-oct 09:11 COT` (`INBOX [168]`): **3 × Ventilador Neumovent GraphNet TS = $161.085.432 COP IVA inc.** (INVIMA `2019EBC-0020481`). Cerrado por Shoky el 23-oct.
- [x] **Lote duplicado `AP-PROV-0131..0134` (INTCO, Howell, Bewatec, Zuowei)** — Cerrado/descartado por Shoky (sustituido por `AP-PROV-0136..0139`, ya enviados el 21-oct).
- [x] **Fazzini S.r.l. (`info@fazzini.it`)** — Respondido el `13-oct-2026` cerrando hilo de carros de paro por falta de registro INVIMA vigente en Colombia.

%% kanban:settings
```
{{"kanban-plugin":"board","list-collapse":[false,false,false,false]}}
```
%%
"""

def build_kanban_aprobaciones() -> str:
    return f"""---
kanban-plugin: board
tags: [ime, kanban, aprobaciones]
updated: {now_cot()}
---

## 1. Pendientes de Decisión de Shoky / Gerencia (Únicos Pendientes Reales Hoy)

- [ ] **PROV-ANGELL-CALL-20261026 · Angell Technology (`sherry@szangell.com`)** — **Contrapropuesta recibida hoy 24-oct 04:00 COT (`INBOX [169]`):** Sherry Lee está viajando a LATAM y propone reunión para el **lunes 26 de octubre de 2026 a las 15:00 COT (3:00 p. m. Colombia)** para revisar el mamógrafo `DM156A` (USD 54,000 CIF) y la inclusión de I-ME como importador en `INVIMA 2023EBC-0027980`. *(Elimina el conflicto de horario del domingo con UniX AI).*
- [ ] **PROV-UNIX-CALL · UniX AI (`skye.li@unix-group.ai`)** — Confirmar reunión reprogramada para robots humanoides (`Wanda 2.0/3.0`, `Panther`, `Martian`, USD 8,840–65,000): elegir **domingo 25-oct 20:00 COT** (lunes 26-oct 09:00 China) o **lunes 26-oct 20:00 COT** (martes 27-oct 09:00 China).
- [ ] **PROV-ALLERS-S5 · Allers (`dquintanilla@allers.com.co`) vs. Alternativas Desfibrilador** — Decidir si enviar consulta a Allers sobre inclusión de SpO2 y electrodos en el COMEN S5 de remate ($9.215.954 + IVA, `Cot. 1082815`) o solicitar cotización a Ambulanc/AMOUL (`INVIMA 2024EBC-0028718`).
- [ ] **PROV-UNIGUAJIRA-AMP-6RFQ (`UNI-01` a `UNI-06`)** — Autorizar envío de las 6 RFQs de ampliación de UniGuajira (`IME-Q-2026-000033`): Mubi (`UNI-01`), Saikang (`UNI-02`), Fisiotech (`UNI-03`), GMD/Impormedical (`UNI-04`), Equitronic (`UNI-05`) y SECA (`UNI-06`).
- [ ] **PROV-AMIS-EVAL · Nanjing AMIS Medical (`sales@amismed.com`)** — **Correo recibido hoy 24-oct 19:17 COT (`INBOX [173]`):** Lily Song envió `AMIS catalogue 2026.pdf` y pregunta si aún aceptamos su oferta para la evaluación de proveedores 2026/2027 (Ecógrafos Doppler, Rayos X / DR, Analizadores de laboratorio y Autoclaves).

## 2. Ejecutados y Enviados Hoy (24-Oct-2026) — Verificados en IMAP `INBOX.Sent`

- [x] **LEAD-NEIVA-LK-20261024 (`ENC-Shoky-2026-10-24-laura-katherine-neiva`) · Laura Katherine Gutiérrez Vargas (Neiva — Robots de limpieza)** — **ENVIADO el `2026-10-24 09:16:44 COT`** desde `comercial1@i-me.com.co` a `kathevargas2208@gmail.com` · `Message-ID: <179285140445.268615.12891028648368524769@i-me.com.co>`.
- [x] **ENC-Shoky-2026-10-24-camila-cima-fpd · Camila Buriticá Ríos (Cima Ocupacional — `IME-Q-2026-000052`)** — **ENVIADO el `2026-10-24 09:16:47 COT`** desde `comercial1@i-me.com.co` a `camilaburiticarios@gmail.com` · `Message-ID: <179285140787.268615.16102007062165020522@i-me.com.co>`.
- [x] **AP-PROV-0158 · Industrias Gustavo Vergara / Miniklav (`autoclaves.miniclave@gmail.com`)** — **ENVIADO el `2026-10-24 09:16:40 COT`** desde `proveedores@i-me.com.co` · `Message-ID: <179285140082.268615.1054358503463007170@i-me.com.co>` *(adicional a `ENC-Shoky-2026-10-23` del 23-oct 10:03 COT)*.
- [x] **AP-PROV-0159 · iRay (`market@iraygroup.com`)** — **ENVIADO el `2026-10-24 09:16:51 COT`** · `Message-ID: <179285141112.268615.10493248471491821932@i-me.com.co>`.
- [x] **AP-PROV-0160 · CareRay (`globalsales@careray.com`)** — **ENVIADO el `2026-10-24 09:16:55 COT`** · `Message-ID: <179285141538.268615.8533315051703062183@i-me.com.co>`.
- [x] **AP-PROV-0161 · DRTECH (`drtech@drtech.com`)** — **ENVIADO el `2026-10-24 09:17:00 COT`** · `Message-ID: <179285142053.268615.9094032354074864928@i-me.com.co>`.
- [x] **AP-PROV-0162 · Vieworks (`MedicalImagingSalesTeam@vieworks.com`)** — **ENVIADO el `2026-10-24 09:17:04 COT`** · `Message-ID: <179285142473.268615.3812379453854506372@i-me.com.co>`.
- [x] **AP-PROV-0163 · DRGEM (`sales@drgemhealthcare.com`)** — **ENVIADO el `2026-10-24 09:17:08 COT`** · `Message-ID: <179285142800.268615.9153230879217754808@i-me.com.co>`.
- [x] **AP-PROV-0164 · CMedical (`ventas@cmedical.com.co`)** — **ENVIADO el `2026-10-24 09:17:12 COT`** · `Message-ID: <179285143227.268615.7906120713822022081@i-me.com.co>`.
- [x] **AP-PROV-0165 · TMédica (`info@tmedica.com.co`)** — **ENVIADO el `2026-10-24 09:17:16 COT`** · `Message-ID: <179285143695.268615.12170746950533189972@i-me.com.co>`.
- [x] **AP-CRM-0008 · Plantillas de seguimiento Día 5 y Día 10** — **APROBADA Y CERRADA por Shoky** (`[t341u]` / `[t344u]`, 24-oct-2026).

## 3. Ejecutados y Cerrados el 21–23 Oct 2026 — Verificados en IMAP `INBOX.Sent`

- [x] **ENC-Shoky-2026-10-23d · EMCO (`ventas@emco.com.co`) — RFQ Mindray BeneVision N12** — **ENVIADO el `2026-10-23 19:10:01 COT`** · `Message-ID: <179280060128.1709461.2191344836418968431@i-me.com.co>`.
- [x] **ENC-Shoky-2026-10-23e · Promedco (`comercial@promedco.com`) — RFQ Mindray BeneVision N12** — **ENVIADO el `2026-10-23 19:10:03 COT`** · `Message-ID: <179280060387.1709461.10128975357539610074@i-me.com.co>`.
- [x] **ENC-Shoky-2026-10-23 · Industrias Gustavo Vergara (`autoclaves.miniclave@gmail.com`)** — **ENVIADO el `2026-10-23 10:03:13 COT`** · `Message-ID: <179276779338.3570961.4997632613116511035@i-me.com.co>`.
- [x] **ENC-Shoky-2026-10-23a · Woson Medical (`coco@woson.com.cn`)** — **ENVIADO el `2026-10-23 10:03:11 COT`** · `Message-ID: <179276779187.3570961.9999235087274814824@i-me.com.co>`.
- [x] **ENC-Shoky-2026-10-23b · Promek Medical (`export@promekmedical.com.tr`)** — **ENVIADO el `2026-10-23 10:03:10 COT`** (`<179276779080.3570961.17996119888243033557@i-me.com.co>`) y **RESPONDIDO hoy 24-oct 12:49 COT** (`<154501dd63e0$0ac59d10$2050d730$@promekmedical.com.tr>`).
- [x] **ENC-Shoky-2026-10-23c · Angell Technology (`sherry@szangell.com`)** — **ENVIADO el `2026-10-23 10:03:13 COT`** (`<179276779369.3570961.9698531975274802793@i-me.com.co>`) y **RESPONDIDO hoy 24-oct 04:00 COT** (`<92381024-67AE-45B4-9F1D-6DEF16707AB0@szangell.com>`).
- [x] **AP-PROV-0136 a 0157 (16 correos: INTCO, Howell, Bewatec, Zuowei, Lote FOB 0143..0157)** — **ENVIADOS el `2026-10-21 22:08 a 22:18 COT`** desde `proveedores@i-me.com.co`.
- [x] **AP-PROV-0131 a 0134 (Lote duplicado)** — **DESCARTADOS / CERRADOS por Shoky**.
- [x] **AP-PROV-0075 · Gilmédica S.A.S.** — **CERRADO por Shoky el 23-oct** tras recibir oferta formal ($161.085.432 COP IVA inc.).

%% kanban:settings
```
{{"kanban-plugin":"board","list-collapse":[false,false,false]}}
```
%%
"""

def sync_ops_hub_db():
    OPS_HUB_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(OPS_HUB_DB))
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS approvals (
            code TEXT PRIMARY KEY,
            category TEXT,
            title TEXT,
            recipient TEXT,
            mailbox TEXT,
            status TEXT,
            evidence_message_id TEXT,
            sent_at_cot TEXT,
            updated_at TEXT,
            notes TEXT
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS kanban_tasks (
            id TEXT PRIMARY KEY,
            board TEXT,
            column_name TEXT,
            title TEXT,
            status TEXT,
            assignee TEXT,
            evidence TEXT,
            updated_at TEXT
        )
    """)
    cur.execute("DELETE FROM approvals")
    cur.execute("DELETE FROM kanban_tasks")

    ts = now_cot()
    approvals_data = [
        # PENDING (Only real human decisions required today)
        ("PROV-ANGELL-CALL-20261026", "PROVEEDOR", "Confirmar reunión virtual con Sherry Lee (Angell Technology) — Lunes 26-oct-2026 15:00 COT",
         "sherry@szangell.com", "proveedores@i-me.com.co", "PENDING",
         "<92381024-67AE-45B4-9F1D-6DEF16707AB0@szangell.com>", "", ts,
         "Sherry Lee respondió hoy 24-oct 04:00 COT que viaja a LATAM y contrapropone lunes 26-oct a las 15:00 COT (elimina conflicto con UniX AI)."),
        ("PROV-UNIX-CALL", "PROVEEDOR", "Confirmar fecha/hora de reunión con Skye Li (UniX AI — Robots humanoides Wanda/Panther/Martian)",
         "skye.li@unix-group.ai", "proveedores@i-me.com.co", "PENDING",
         "<240201dd630b$5d3df120$17b9d360$@unix-group.ai>", "", ts,
         "Elegir domingo 25-oct 20:00 COT (lun 09:00 China) o lunes 26-oct 20:00 COT (mar 09:00 China)."),
        ("PROV-ALLERS-S5", "PROVEEDOR", "Decidir consulta a Allers por SpO2 + electrodos en COMEN S5 ($9.215.954 + IVA) o alternativa AMOUL",
         "dquintanilla@allers.com.co", "proveedores@i-me.com.co", "PENDING",
         "Cotización Allers 1082815", "", ts,
         "Unidad única de remate COMEN S5 por $9.215.954 + IVA; ficha no incluye SpO2 ni electrodos."),
        ("PROV-UNIGUAJIRA-AMP-6RFQ", "PROVEEDOR", "Autorizar envío de 6 RFQs de ampliación UniGuajira (UNI-01..06: Mubi, Saikang, Fisiotech, GMD, Equitronic, SECA)",
         "Varios (6 proveedores)", "proveedores@i-me.com.co", "PENDING",
         "IME-Q-2026-000033", "", ts,
         "Borradores listos en /workspace/ime-drafts/clientes/uniguajira_ampliacion_2026-10-16/."),
        ("PROV-AMIS-EVAL", "PROVEEDOR", "Decidir si aceptar oferta tardía de evaluación 2026/2027 de Nanjing AMIS Medical",
         "sales@amismed.com", "proveedores@i-me.com.co", "PENDING",
         "<1991839782.3082754.1792887422319@smtp.qiye.163.com>", "", ts,
         "Recibido hoy 24-oct 19:17 COT con AMIS catalogue 2026.pdf (Ecógrafos, Rayos X, Laboratorio, Autoclaves)."),

        # EXECUTED / APPROVED / CLOSED
        ("LEAD-NEIVA-LK-20261024", "CLIENTE", "Respuesta comercial a Laura Katherine Gutiérrez Vargas (Neiva — Robots autónomos de limpieza 24/7)",
         "kathevargas2208@gmail.com", "comercial1@i-me.com.co", "EXECUTED",
         "<179285140445.268615.12891028648368524769@i-me.com.co>", "2026-10-24 09:16:44 COT", ts,
         "Enviado y verificado en comercial1@ INBOX.Sent [23]. En seguimiento comercial."),
        ("ENC-Shoky-2026-10-24-camila-cima-fpd", "CLIENTE", "Aviso de estado de cotización IME-Q-2026-000052 — Camila Buriticá Ríos (Cima Ocupacional)",
         "camilaburiticarios@gmail.com", "comercial1@i-me.com.co", "EXECUTED",
         "<179285140787.268615.16102007062165020522@i-me.com.co>", "2026-10-24 09:16:47 COT", ts,
         "Enviado y verificado en comercial1@ INBOX.Sent [24]."),
        ("AP-PROV-0158", "PROVEEDOR", "Relanzamiento RFQ Autoclaves Miniklav 5.5 L y 12 L — Industrias Gustavo Vergara",
         "autoclaves.miniclave@gmail.com", "proveedores@i-me.com.co", "EXECUTED",
         "<179285140082.268615.1054358503463007170@i-me.com.co>", "2026-10-24 09:16:40 COT", ts,
         "Enviado en INBOX.Sent [299] (adicional a ENC-Shoky-2026-10-23 en INBOX.Sent [295])."),
        ("AP-PROV-0159", "PROVEEDOR", "RFQ Detector Flat Panel 43x43 cm CsI (Mars 1717V/1717X) — iRay",
         "market@iraygroup.com", "proveedores@i-me.com.co", "EXECUTED",
         "<179285141112.268615.10493248471491821932@i-me.com.co>", "2026-10-24 09:16:51 COT", ts,
         "Enviado en proveedores@ INBOX.Sent [300]."),
        ("AP-PROV-0160", "PROVEEDOR", "RFQ Detector Flat Panel 17x17\" CsI (CareView 1800Cw) — CareRay",
         "globalsales@careray.com", "proveedores@i-me.com.co", "EXECUTED",
         "<179285141538.268615.8533315051703062183@i-me.com.co>", "2026-10-24 09:16:55 COT", ts,
         "Enviado en proveedores@ INBOX.Sent [301]."),
        ("AP-PROV-0161", "PROVEEDOR", "RFQ Detector Flat Panel 43x43 cm CsI (EXPD 1717W / EVS 4343W) — DRTECH",
         "drtech@drtech.com", "proveedores@i-me.com.co", "EXECUTED",
         "<179285142053.268615.9094032354074864928@i-me.com.co>", "2026-10-24 09:17:00 COT", ts,
         "Enviado en proveedores@ INBOX.Sent [302]."),
        ("AP-PROV-0162", "PROVEEDOR", "RFQ Detector Flat Panel 43x43 cm CsI (VIVIX-S 1717N/1717V) — Vieworks",
         "MedicalImagingSalesTeam@vieworks.com", "proveedores@i-me.com.co", "EXECUTED",
         "<179285142473.268615.3812379453854506372@i-me.com.co>", "2026-10-24 09:17:04 COT", ts,
         "Enviado en proveedores@ INBOX.Sent [303]."),
        ("AP-PROV-0163", "PROVEEDOR", "RFQ Detector Flat Panel 43x43 cm CsI + RADMAX — DRGEM",
         "sales@drgemhealthcare.com", "proveedores@i-me.com.co", "EXECUTED",
         "<179285142800.268615.9153230879217754808@i-me.com.co>", "2026-10-24 09:17:08 COT", ts,
         "Enviado en proveedores@ INBOX.Sent [304]."),
        ("AP-PROV-0164", "PROVEEDOR", "RFQ Detector Flat Panel 43x43 cm CsI (Pixxgen Prudent 1717) — CMedical",
         "ventas@cmedical.com.co", "proveedores@i-me.com.co", "EXECUTED",
         "<179285143227.268615.7906120713822022081@i-me.com.co>", "2026-10-24 09:17:12 COT", ts,
         "Enviado en proveedores@ INBOX.Sent [305]."),
        ("AP-PROV-0165", "PROVEEDOR", "RFQ Detector Flat Panel 43x43 cm CsI con software — TMédica",
         "info@tmedica.com.co", "proveedores@i-me.com.co", "EXECUTED",
         "<179285143695.268615.12170746950533189972@i-me.com.co>", "2026-10-24 09:17:16 COT", ts,
         "Enviado en proveedores@ INBOX.Sent [306]."),
        ("ENC-Shoky-2026-10-23d", "PROVEEDOR", "RFQ Urgente Monitor Mindray BeneVision N12 — EMCO S.A.S.",
         "ventas@emco.com.co", "proveedores@i-me.com.co", "EXECUTED",
         "<179280060128.1709461.2191344836418968431@i-me.com.co>", "2026-10-23 19:10:01 COT", ts,
         "Enviado en proveedores@ INBOX.Sent [297]."),
        ("ENC-Shoky-2026-10-23e", "PROVEEDOR", "RFQ Urgente Monitor Mindray BeneVision N12 — Promedco S.A.S.",
         "comercial@promedco.com", "proveedores@i-me.com.co", "EXECUTED",
         "<179280060387.1709461.10128975357539610074@i-me.com.co>", "2026-10-23 19:10:03 COT", ts,
         "Enviado en proveedores@ INBOX.Sent [298]."),
        ("ENC-Shoky-2026-10-23a", "PROVEEDOR", "Respuesta volumen e INVIMA Autoclaves TANZO — Woson Medical",
         "coco@woson.com.cn", "proveedores@i-me.com.co", "EXECUTED",
         "<179276779187.3570961.9999235087274814824@i-me.com.co>", "2026-10-23 10:03:11 COT", ts,
         "Enviado en proveedores@ INBOX.Sent [293]."),
        ("ENC-Shoky-2026-10-23b", "PROVEEDOR", "Consulta Dropshipping Camas Hospitalarias — Promek Medical",
         "export@promekmedical.com.tr", "proveedores@i-me.com.co", "EXECUTED",
         "<179276779080.3570961.17996119888243033557@i-me.com.co>", "2026-10-23 10:03:10 COT", ts,
         "Enviado el 23-oct y RESPONDIDO por Promek hoy 24-oct 12:49 COT (<154501dd63e0$0ac59d10$2050d730$@promekmedical.com.tr>)."),
        ("ENC-Shoky-2026-10-23c", "PROVEEDOR", "Propuesta de llamada Mamógrafo DM156A — Angell Technology",
         "sherry@szangell.com", "proveedores@i-me.com.co", "EXECUTED",
         "<179276779369.3570961.9698531975274802793@i-me.com.co>", "2026-10-23 10:03:13 COT", ts,
         "Enviado el 23-oct y RESPONDIDO por Sherry Lee hoy 24-oct 04:00 COT proponiendo lun 26-oct 15:00 COT."),
        ("AP-CRM-0008", "CRM", "Plantillas de seguimiento post-cotización Día hábil 5 y Día hábil 10",
         "Clientes Colombia", "comercial1@i-me.com.co", "APPROVED",
         "t341u / t344u", "2026-10-24", ts,
         "Aprobada por Shoky. Sustituye a AP-CRM-0002 y AP-CRM-0003."),
        ("AP-PROV-0131..0134", "PROVEEDOR", "Lote duplicado INTCO, Howell, Bewatec, Zuowei",
         "Varios", "proveedores@i-me.com.co", "CLOSED",
         "Sustituido por AP-PROV-0136..0139", "2026-10-21", ts,
         "Cerrado/descartado por Shoky; lote definitivo AP-PROV-0136..0139 enviado el 21-oct."),
        ("AP-PROV-0075", "PROVEEDOR", "Cotización 3 Ventiladores Neumovent GraphNet TS — Gilmédica S.A.S.",
         "lisbeth.narvaez@gilmedica.com", "proveedores@i-me.com.co", "CLOSED",
         "<CAF=PTgXog_9STpE92KM2D6W519P9xn3nt5xO4DnYtpmN2xTP6g@mail.gmail.com>", "2026-10-23 09:11 COT", ts,
         "Oferta recibida por $161.085.432 COP IVA inc. Proyecto cerrado por Shoky el 23-oct."),
    ]
    cur.executemany("""
        INSERT INTO approvals (code, category, title, recipient, mailbox, status, evidence_message_id, sent_at_cot, updated_at, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, approvals_data)

    kanban_rows = [
        ("K1-LAURA-NEIVA", "Kanban-1", "Resuelto / Enviado (En Seguimiento)", "Laura Katherine Gutiérrez Vargas (Neiva — Robots de limpieza 24/7)", "EXECUTED", "correo", "<179285140445.268615.12891028648368524769@i-me.com.co> (24-oct 09:16 COT)", ts),
        ("K1-CIMA-0052", "Kanban-1", "En espera de respuesta del proveedor", "IME-Q-2026-000052 · Cima Ocupacional (Camila Buriticá) — Detector Flat Panel 43x43 cm", "WAITING_SUPPLIER", "proveedores", "Aviso al cliente <179285140787.268615.16102007062165020522@i-me.com.co> + 7 RFQs AP-PROV-0159..0165 enviados 24-oct", ts),
        ("K1-2M-QATAR-0042", "Kanban-1", "Cotización recibida / En costeo", "IME-Q-2026-000042 · 2M Trading Qatar (Sidra Medicine Tender 20172,2 — nuevo cierre 19-nov-2026)", "IN_COSTING", "gestor-presupuestos", "Amendment 2 recibido hoy 24-oct 05:09 COT; ofertas SonoScape USD 42,400 EXW y Barzan QAR 225,000/u", ts),
        ("K1-UNIGUAJIRA-0033", "Kanban-1", "Cotización recibida / En costeo", "IME-Q-2026-000033 · Universidad de La Guajira — Lote laboratorio biomédico", "IN_COSTING", "gestor-presupuestos", "Dental Store $6.210.000 COP IVA inc., Allers S5 $9.215.954+IVA, ZOLL M2 $24.620.000+IVA; AP-PROV-0158 enviado 24-oct", ts),
        ("K1-CLAOMA-ECCI", "Kanban-1", "En espera de respuesta del proveedor", "CLAOMA / ECCI (claoma3@yahoo.com) — Monitor Biolight M12 / Mindray BeneVision N12", "WAITING_SUPPLIER", "proveedores", "RFQs enviados a EMCO y Promedco el 23-oct 19:10 COT (ENC-Shoky-2026-10-23d/e)", ts),
        ("K2-ANGELL-DM156A", "Kanban-2", "Acción requerida (Decisión Shoky)", "Shenzhen Angell Technology (Sherry Lee) — Mamógrafo DM156A USD 54,000 CIF + Reunión lun 26-oct 15:00 COT", "ACTION_REQUIRED", "shoky", "Respuesta recibida hoy 24-oct 04:00 COT (<92381024-67AE-45B4-9F1D-6DEF16707AB0@szangell.com>)", ts),
        ("K2-PROMEK-BEDS", "Kanban-2", "Cotización recibida / En costeo", "Promek Medical (Turquía) — Camas hospitalarias en Dropshipping directo a Colombia", "IN_COSTING", "proveedores", "Respuesta positiva recibida hoy 24-oct 12:49 COT (<154501dd63e0$0ac59d10$2050d730$@promekmedical.com.tr>)", ts),
        ("K2-SONOSCAPE-4K", "Kanban-2", "Cotización recibida / En costeo", "SonoScape Medical — Torre Laparoscopia 4K + ICG SV-M4K220Exp (USD $42,400 EXW)", "IN_COSTING", "gestor-presupuestos", "PDF SV-M4K220Exp Price List verificado (INBOX [166], 22-oct)", ts),
        ("K2-DENTALSTORE-MINIKLAV", "Kanban-2", "Cotización recibida / En costeo", "Dental Store — Autoclaves Miniklav 12L ($3.360.000 IVA inc.) y 5.5L ($2.850.000 IVA inc.)", "IN_COSTING", "gestor-presupuestos", "PDF Cotización C-1-417 verificado (INBOX [138], 20-oct)", ts),
        ("K2-GILMEDICA-0075", "Kanban-2", "Resuelto / Enviado", "Gilmédica S.A.S. (AP-PROV-0075) — 3 × Ventilador Neumovent GraphNet TS ($161.085.432 COP IVA inc.)", "CLOSED", "proveedores", "Oferta recibida 23-oct 09:11 COT (INBOX [168]); proyecto cerrado por Shoky", ts),
        ("K2-FPD-8RFQS", "Kanban-2", "En espera de respuesta del proveedor", "AP-PROV-0158..0165 (Vergara, iRay, CareRay, DRTECH, Vieworks, DRGEM, CMedical, TMédica)", "WAITING_SUPPLIER", "proveedores", "8 correos enviados hoy 24-oct 09:16–09:17 COT desde proveedores@i-me.com.co", ts),
    ]
    cur.executemany("""
        INSERT INTO kanban_tasks (id, board, column_name, title, status, assignee, evidence, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, kanban_rows)

    conn.commit()
    conn.close()

def main():
    PANEL.mkdir(parents=True, exist_ok=True)
    k1 = build_kanban_1()
    k2 = build_kanban_2()
    k3 = build_kanban_3()
    ka = build_kanban_aprobaciones()

    (PANEL / "Kanban-1-Cotizaciones-y-RFQs.md").write_text(k1, encoding="utf-8")
    (PANEL / "Kanban-Comercial.md").write_text(k1, encoding="utf-8")
    (PANEL / "Kanban-2-Proveedores-e-INVIMA.md").write_text(k2, encoding="utf-8")
    (PANEL / "Kanban-Proveedores.md").write_text(k2, encoding="utf-8")
    if k3:
        (PANEL / "Kanban-3-Cola-Enjambre-Hermes.md").write_text(k3, encoding="utf-8")
    (PANEL / "Kanban-Aprobaciones.md").write_text(ka, encoding="utf-8")
    sync_ops_hub_db()

if __name__ == "__main__":
    main()
