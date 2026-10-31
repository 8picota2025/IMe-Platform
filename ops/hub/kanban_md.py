"""Tablero Kanban en markdown. Los carriles de destino salen del propio archivo."""

from __future__ import annotations

from dataclasses import dataclass, field, replace

PROHIBIDOS = frozenset({"ejecutadas", "cerradas"})
CARRILES_SEMILLA = ("Por aprobar", "Aprobados", "Ejecutados", "Rechazados")
ENTRADA = "Por aprobar"


class CarrilAusente(Exception):
    def __init__(self, prefijo: str):
        super().__init__(f"carril real ausente: {prefijo}")
        self.prefijo = prefijo


def normalizar_carril(nombre: str) -> str:
    return " ".join(nombre.strip().lower().split())


@dataclass
class Tarjeta:
    id: str
    titulo: str
    carril: str
    origen: str = ""
    ref: str = ""
    bot_dueno: str = ""
    cotizacion_id: str = ""
    usuario: str = ""
    decidido_at: str = ""
    decision: str = ""
    notas: str = ""
    tablero: str = ""


@dataclass
class Tablero:
    frontmatter: str
    carriles: list[str]
    tarjetas: list[Tarjeta] = field(default_factory=list)

    def carril(self, prefijo: str) -> str:
        encontrado = carril_por_prefijo(self.carriles, prefijo)
        if not encontrado:
            raise CarrilAusente(prefijo)
        return encontrado


def carril_por_prefijo(carriles: list[str], prefijo: str) -> str | None:
    buscado = normalizar_carril(prefijo)
    for carril in carriles:
        nombre = normalizar_carril(carril)
        if nombre in PROHIBIDOS:
            continue
        if nombre.startswith(buscado):
            return carril
    return None


def es_entrada(carril: str) -> bool:
    return normalizar_carril(carril) == normalizar_carril(ENTRADA)


def parse(texto: str) -> Tablero:
    frontmatter = ""
    cuerpo = texto
    if texto.startswith("---\n"):
        fin = texto.find("\n---\n", 4)
        if fin != -1:
            frontmatter = texto[: fin + 5]
            cuerpo = texto[fin + 5 :]
    carriles: list[str] = []
    tarjetas: list[Tarjeta] = []
    actual: str | None = None
    tarjeta: Tarjeta | None = None

    def cerrar() -> None:
        nonlocal tarjeta
        if tarjeta and actual:
            tarjeta.carril = actual
            tarjetas.append(tarjeta)
        tarjeta = None

    for cruda in cuerpo.splitlines():
        linea = cruda.rstrip()
        if linea.startswith("## "):
            cerrar()
            actual = linea[3:].strip()
            if actual and actual not in carriles:
                carriles.append(actual)
            continue
        if actual is None:
            continue
        if linea.startswith("- [ ] ") or linea.startswith("- [x] ") or linea.startswith("- [X] "):
            cerrar()
            tarjeta = Tarjeta(id="", titulo=linea[6:].strip(), carril=actual)
            continue
        if tarjeta is None or not linea.startswith("  - "):
            continue
        clave, _, valor = linea[4:].partition(":")
        valor = valor.strip()
        campo = clave.strip().lower()
        if campo == "id":
            tarjeta.id = valor
        elif campo == "origen":
            tarjeta.origen = valor
        elif campo == "ref":
            tarjeta.ref = valor
        elif campo in {"bot", "bot_dueno"}:
            tarjeta.bot_dueno = valor
        elif campo == "cotizacion_id":
            tarjeta.cotizacion_id = valor
        elif campo == "usuario":
            tarjeta.usuario = valor
        elif campo in {"hora", "decidido_at"}:
            tarjeta.decidido_at = valor
        elif campo == "decision":
            tarjeta.decision = valor
        elif campo == "notas":
            tarjeta.notas = valor
    cerrar()
    for tarjeta in tarjetas:
        if not tarjeta.id:
            tarjeta.id = "titulo:" + normalizar_carril(tarjeta.titulo).replace(" ", "-")
    if not carriles:
        carriles = list(CARRILES_SEMILLA)
    return Tablero(frontmatter=frontmatter, carriles=carriles, tarjetas=tarjetas)


def _campo(nombre: str, valor: str) -> str:
    return f"  - {nombre}: {valor}"


def render(tablero: Tablero) -> str:
    grupos: dict[str, list[Tarjeta]] = {carril: [] for carril in tablero.carriles}
    for tarjeta in tablero.tarjetas:
        grupos.setdefault(tarjeta.carril, []).append(tarjeta)
    lineas: list[str] = []
    if tablero.frontmatter:
        lineas.append(tablero.frontmatter.rstrip("\n"))
        lineas.append("")
    for carril in tablero.carriles:
        lineas.append(f"## {carril}")
        lineas.append("")
        for tarjeta in grupos.get(carril, []):
            hecho = "x" if tarjeta.decision in {"aprobada", "rechazada"} else " "
            lineas.append(f"- [{hecho}] {tarjeta.titulo}")
            lineas.append(_campo("id", tarjeta.id))
            for nombre, valor in (
                ("origen", tarjeta.origen),
                ("ref", tarjeta.ref),
                ("bot", tarjeta.bot_dueno),
                ("cotizacion_id", tarjeta.cotizacion_id),
                ("decision", tarjeta.decision),
                ("usuario", tarjeta.usuario),
                ("hora", tarjeta.decidido_at),
                ("notas", tarjeta.notas),
            ):
                if valor:
                    lineas.append(_campo(nombre, valor))
        lineas.append("")
    return "\n".join(lineas).rstrip() + "\n"


def tablero_vacio() -> Tablero:
    return Tablero(frontmatter="---\nkanban-plugin: basic\n---\n", carriles=list(CARRILES_SEMILLA))


def fusionar(existente: Tablero, fuentes: list[Tarjeta], decisiones: dict[str, dict]) -> Tablero:
    """Las fuentes refrescan la bandeja. Un carril que no es la entrada, o una decisión guardada, se queda."""
    entrada = carril_por_prefijo(existente.carriles, "por aprobar") or ENTRADA
    if entrada not in existente.carriles:
        existente.carriles.insert(0, entrada)
    por_id = {tarjeta.id: tarjeta for tarjeta in existente.tarjetas}
    salida: list[Tarjeta] = []
    vistos: set[str] = set()

    def con_decision(base: Tarjeta, decision: dict) -> Tarjeta:
        if decision["decision"] == "rechazada":
            carril = existente.carril("rechazados")
        elif decision.get("encolado_estado") == "enviado":
            carril = existente.carril("ejecutados")
        else:
            carril = carril_por_prefijo(existente.carriles, "aprobados") or existente.carril("ejecutados")
        return replace(
            base,
            carril=carril,
            decision=str(decision["decision"]),
            usuario=str(decision["usuario"]),
            decidido_at=str(decision["decidido_at"]),
            titulo=base.titulo or str(decision.get("titulo") or base.id),
        )

    for fuente in fuentes:
        vistos.add(fuente.id)
        previa = por_id.get(fuente.id)
        decision = decisiones.get(fuente.id)
        if decision:
            salida.append(con_decision(fuente, decision))
            continue
        if previa and not es_entrada(previa.carril):
            salida.append(replace(fuente, carril=previa.carril, titulo=fuente.titulo or previa.titulo))
            continue
        salida.append(replace(fuente, carril=entrada))

    for tarjeta_id, decision in decisiones.items():
        if tarjeta_id in vistos:
            continue
        previa = por_id.get(tarjeta_id)
        base = previa or Tarjeta(id=tarjeta_id, titulo=str(decision.get("titulo") or tarjeta_id), carril=entrada)
        salida.append(con_decision(base, decision))
        vistos.add(tarjeta_id)

    for tarjeta_id, previa in por_id.items():
        if tarjeta_id in vistos:
            continue
        if not es_entrada(previa.carril):
            salida.append(previa)
    return Tablero(existente.frontmatter, list(existente.carriles), salida)
