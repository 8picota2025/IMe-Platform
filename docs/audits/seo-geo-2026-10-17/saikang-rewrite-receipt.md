# Saikang rewrite receipt — 2026-10-17

Rewrote **26** SKUs in `src/data/fichas-enriquecimiento/saikang.json` to Criticool-quality SEO copy.

Rules: PDF-backed specs only (merged from prior enrichment); no invented INVIMA/prices/clinical claims; ES+EN complete fields; beneficios×4; faq×3; seo_keywords 6–8; aplicaciones when relevant.

| SKU | Primary keyword (ES) |
|-----|----------------------|
| `SKD-C-CQ8k` | cama pediátrica eléctrica hospitalaria |
| `SK-A3-X01` | cuna neonatal hospitalaria |
| `SKC-3B5-SKB039D` | camilla para ambulancia hospitalaria |
| `SKM-G-SKB037C` | camilla para pacientes hospitalaria |
| `SKR-AT625-1` | carro de anestesia hospitalario |
| `SKE011-1` | silla de espera hospitalaria 3 plazas |
| `SKE942` | sillón reclinable hospitalario |
| `SKB039-H` | camilla transportadora ambulancia |
| `SKE020-1` | taburete escalera hospitalario |
| `SKB3A104` | camilla blanda de rescate |
| `SKH046-2` | mesa de cama hospitalaria ajustable |
| `SKS009-2` | mesita de noche hospitalaria fenólica |
| `SKA-1C-SKB1A01` | camilla plegable de emergencia |
| `SKE001-19` | sofá de acompañante hospitalario |
| `SKE011` | silla de espera clínica 3 plazas |
| `SKH042` | mesa de sobrecama hospitalaria |
| `SKM-A-SKR-IB00` | carro para computador hospitalario |
| `SKB-1A-SKB2A10` | tablero espinal de emergencia |
| `SK-C1-V2k` | cama manual hospitalaria |
| `SKA-1B-SKB1A02` | camilla transportadora plegable |
| `SKE001` | silla reclinable de acompañante |
| `SKP011` | colchón viscoelástico hospitalario |
| `SKS036` | mesa de noche hospitalaria acero |
| `SK-AD3-X01-1` | cuna neonatal ajustable hospitalaria |
| `SKE941` | silla reclinable para diálisis |
| `SKS008` | mesita de noche hospitalaria ABS |

Sources: `tmp/saikang-pdf-text/*.txt` + `index.json`; prior `especificaciones` retained/merged.
Not applied / not committed (parent will run apply-fichas).

