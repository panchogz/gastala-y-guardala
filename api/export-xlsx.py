"""Función serverless de Vercel (Python) que arma un .xlsx a partir del JSON
que le manda el frontend. No toca Supabase ni ninguna otra fuente de datos:
solo recibe datos ya cargados por el cliente y los convierte a Excel.

Solapa "Tarjetas" (resumen del mes, evolución mensual con gráfico nativo, y
detalle opcional de cuotas/dólares/recurrentes por tarjeta) y solapa
"Ahorros" (resumen de 3 niveles activo→cuenta→tipo, distribución por tipo y
por cuenta en gráficos de torta, evolución mensual con gráfico nativo, y
detalle opcional de activos por cuenta).
"""

import io
import json
from datetime import datetime
from http.server import BaseHTTPRequestHandler

from openpyxl import Workbook
from openpyxl.chart import LineChart, PieChart, Reference
from openpyxl.chart.axis import ChartLines
from openpyxl.chart.label import DataLabelList
from openpyxl.chart.marker import Marker
from openpyxl.chart.series import DataPoint
from openpyxl.chart.shapes import GraphicalProperties
from openpyxl.chart.text import RichText, Text
from openpyxl.chart.title import Title
from openpyxl.drawing.line import LineProperties
from openpyxl.drawing.spreadsheet_drawing import AnchorMarker, OneCellAnchor
from openpyxl.drawing.text import CharacterProperties, Paragraph, ParagraphProperties, RegularTextRun
from openpyxl.drawing.xdr import XDRPositiveSize2D
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.utils.units import cm_to_EMU

MESES_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

TIPO_AHORRO_LABEL = {"bolsa": "Bolsa", "cripto": "Cripto", "usdt": "USD / Stable"}
TIPO_AHORRO_COLOR = {"bolsa": "5B9BE8", "cripto": "35D0A0", "usdt": "E8A855"}

HEADER_FILL = PatternFill("solid", fgColor="F2F2F2")
HEADER_FONT = Font(bold=True)
TOTAL_FONT = Font(bold=True)
TOTAL_FILL = PatternFill("solid", fgColor="FAFAFA")
THIN = Side(style="thin", color="D9D9D9")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

ARS_FMT = '#,##0" ARS"'
USD_FMT = '#,##0.00" USD"'


def darken_hex(hex_color, factor=0.75):
    hex_color = (hex_color or "").lstrip("#")
    r, g, b = (int(hex_color[i : i + 2], 16) for i in (0, 2, 4))
    return "".join(f"{max(0, round(c * factor)):02X}" for c in (r, g, b))


def mes_label(mes_iso):
    try:
        y, m = mes_iso.split("-")[:2]
        return f"{MESES_ES[int(m) - 1]}-{y[2:]}"
    except Exception:
        return mes_iso or ""


def style_header_row(ws, row, first_col, last_col):
    for col in range(first_col, last_col + 1):
        cell = ws.cell(row=row, column=col)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.border = BORDER
        cell.alignment = Alignment(horizontal="left" if col == first_col else "right")


def style_total_row(ws, row, first_col, last_col):
    for col in range(first_col, last_col + 1):
        cell = ws.cell(row=row, column=col)
        cell.font = TOTAL_FONT
        cell.fill = TOTAL_FILL
        cell.border = BORDER


def chart_title(text, size=1400, bold=True):
    cp = CharacterProperties(sz=size, b=bold)
    run = RegularTextRun(rPr=cp, t=text)
    para = Paragraph(pPr=ParagraphProperties(defRPr=cp), r=[run])
    return Title(tx=Text(rich=RichText(p=[para])))


def legend_text(size=1000):
    cp = CharacterProperties(sz=size)
    return RichText(p=[Paragraph(pPr=ParagraphProperties(defRPr=cp), endParaRPr=cp)])


def style_line_chart_axes(chart):
    # Mismos ajustes ya validados en el gráfico de Tarjetas: Excel real (a
    # diferencia de LibreOffice) oculta las etiquetas de eje cuando estas
    # propiedades quedan en None, porque openpyxl las omite del XML.
    chart.x_axis.delete = False
    chart.y_axis.delete = False
    chart.x_axis.majorTickMark = "out"
    chart.y_axis.majorTickMark = "out"
    chart.x_axis.minorTickMark = "none"
    chart.y_axis.minorTickMark = "none"
    chart.x_axis.tickLblPos = "nextTo"
    chart.y_axis.tickLblPos = "nextTo"
    chart.y_axis.numFmt = "#,##0"
    chart.y_axis.scaling.min = 0
    chart.y_axis.majorGridlines = ChartLines(
        spPr=GraphicalProperties(ln=LineProperties(solidFill="E6E6E6", w=6350))
    )
    chart.x_axis.majorGridlines = None
    chart.legend.overlay = False
    chart.legend.txPr = legend_text()


def style_line_series(chart, items, color_of):
    for i, item in enumerate(items):
        color = (color_of(item) or "5B9BE8").lstrip("#").upper()
        series = chart.series[i]
        series.graphicalProperties.line.solidFill = color
        series.graphicalProperties.line.width = 28575
        series.smooth = False
        series.marker = Marker(symbol="circle", size=6)
        series.marker.graphicalProperties = GraphicalProperties(
            solidFill=color, ln=LineProperties(solidFill=color)
        )


def _display_width(cell):
    # len(str(valor_crudo)) no sirve para celdas numéricas con formato: un
    # float como 149000.0 mide 8 caracteres como string, pero Excel lo
    # muestra como "149.000 ARS" (11). Subestimar ese ancho es lo que
    # termina mostrando ####### en las columnas con montos.
    value = cell.value
    fmt = cell.number_format or "General"
    if isinstance(value, (int, float)) and fmt != "General":
        if "ARS" in fmt:
            return len(f"{value:,.0f} ARS")
        if "USD" in fmt:
            return len(f"{value:,.2f} USD")
        if fmt == "0.0%":
            return len(f"{value * 100:.1f}%")
    return len(str(value))


def autosize(ws, first_col, last_col, min_width=10, max_width=40):
    for col in range(first_col, last_col + 1):
        letter = get_column_letter(col)
        width = min_width
        for cell in ws[letter]:
            if cell.value is not None:
                width = max(width, _display_width(cell) + 2)
        ws.column_dimensions[letter].width = min(width, max_width)


def _write_table(ws, row, title, headers, formats, data_rows):
    ws.cell(row=row, column=1, value=title).font = Font(bold=True, size=12)
    row += 1
    if not data_rows:
        ws.cell(row=row, column=1, value="Sin datos").font = Font(italic=True, color="8B93A1")
        return row + 2
    header_row = row
    for i, h in enumerate(headers):
        ws.cell(row=header_row, column=1 + i, value=h)
    style_header_row(ws, header_row, 1, len(headers))
    row += 1
    for data in data_rows:
        for i, value in enumerate(data):
            c = ws.cell(row=row, column=1 + i, value=value)
            fmt = formats[i] if i < len(formats) else None
            if fmt:
                c.number_format = fmt
        row += 1
    autosize(ws, 1, len(headers))
    return row + 2


def _write_detalle_tarjeta(ws, row, t):
    nombre = t.get("nombre") or ""

    cuotas_rows = [
        [
            c.get("fecha"),
            c.get("comercio"),
            float(c.get("monto") or 0),
            int(c.get("cuotas") or 1),
            int(c.get("cuotaActual") or 0),
            int(c.get("cuotasPendientes") or 0),
            float(c.get("montoPorCuota") or 0),
            float(c.get("saldoPagado") or 0),
        ]
        for c in (t.get("cuotas") or [])
    ]
    row = _write_table(
        ws,
        row,
        f"{nombre} — Compras en cuotas",
        ["Fecha", "Comercio", "Monto", "Cuotas", "Cuota actual", "Pendientes", "$/cuota", "Pagado"],
        [None, None, ARS_FMT, None, None, None, ARS_FMT, ARS_FMT],
        cuotas_rows,
    )

    dolares_rows = [
        [d.get("fecha"), d.get("comercio"), float(d.get("monto") or 0), float(d.get("montoARS") or 0)]
        for d in (t.get("dolares") or [])
    ]
    row = _write_table(
        ws,
        row,
        f"{nombre} — Gastos en dólares",
        ["Fecha", "Comercio", "Monto USD", "En pesos"],
        [None, None, USD_FMT, ARS_FMT],
        dolares_rows,
    )

    recurrentes_rows = [
        [r.get("concepto"), float(r.get("monto") or 0), "Sí" if r.get("activo") else "No"]
        for r in (t.get("recurrentes") or [])
    ]
    row = _write_table(
        ws,
        row,
        f"{nombre} — Recurrentes / Suscripciones",
        ["Concepto", "Monto", "Activo"],
        [None, ARS_FMT, None],
        recurrentes_rows,
    )

    return row


def _build_tarjetas_sheet(wb, payload):
    tarjetas = sorted(payload.get("tarjetas") or [], key=lambda t: t.get("orden") or 0)
    total_mensual = payload.get("totalMensual") or []
    incluir_detalle = bool(payload.get("incluirDetalleTarjetas"))

    ws = wb.active
    ws.title = "Tarjetas"
    ws.sheet_view.showGridLines = False

    row = 1

    # ---- Resumen del mes (el más reciente con datos registrados) ----
    ws.cell(row=row, column=1, value="Resumen del mes").font = Font(bold=True, size=13)
    row += 1
    ultimo_mes = total_mensual[-1] if total_mensual else None
    if ultimo_mes:
        ws.cell(row=row - 1, column=2, value=mes_label(ultimo_mes.get("mes", ""))).font = Font(
            italic=True, color="8B93A1"
        )

    ws.cell(row=row, column=1, value="Tarjeta")
    ws.cell(row=row, column=2, value="Total")
    style_header_row(ws, row, 1, 2)
    row += 1
    for t in tarjetas:
        monto = float((ultimo_mes.get("porTarjeta", {}) if ultimo_mes else {}).get(t.get("id"), 0) or 0)
        ws.cell(row=row, column=1, value=t.get("nombre") or "")
        c = ws.cell(row=row, column=2, value=monto)
        c.number_format = ARS_FMT
        row += 1
    ws.cell(row=row, column=1, value="TOTAL")
    c = ws.cell(row=row, column=2, value=float(ultimo_mes.get("total", 0)) if ultimo_mes else 0)
    c.number_format = ARS_FMT
    style_total_row(ws, row, 1, 2)
    row += 3

    # ---- Evolución mensual ----
    ws.cell(row=row, column=1, value="Evolución mensual").font = Font(bold=True, size=13)
    row += 1
    evo_header_row = row
    ws.cell(row=row, column=1, value="Mes")
    for i, t in enumerate(tarjetas):
        ws.cell(row=row, column=2 + i, value=t.get("nombre") or "")
    total_col = 2 + len(tarjetas)
    ws.cell(row=row, column=total_col, value="Total")
    style_header_row(ws, row, 1, total_col)
    row += 1
    evo_first_data_row = row
    for m in total_mensual:
        ws.cell(row=row, column=1, value=mes_label(m.get("mes", "")))
        for i, t in enumerate(tarjetas):
            monto = float((m.get("porTarjeta") or {}).get(t.get("id"), 0) or 0)
            c = ws.cell(row=row, column=2 + i, value=monto)
            c.number_format = ARS_FMT
        c = ws.cell(row=row, column=total_col, value=float(m.get("total", 0) or 0))
        c.number_format = ARS_FMT
        row += 1
    evo_last_data_row = row - 1

    autosize(ws, 1, total_col)

    chart_anchor_row = row + 2
    if total_mensual and tarjetas:
        chart = LineChart()
        # El título rotado del eje Y ("ARS") se solapaba con los números del
        # eje en Excel real (no en LibreOffice) por falta de margen propio;
        # en vez de ajustar el layout manual del título, se saca del eje y
        # se suma al título general del gráfico.
        chart.title = chart_title("Evolución mensual por tarjeta (ARS)")
        # El título del eje X ("Mes") se solapaba con las etiquetas
        # (jun-26/jul-26/...) con 3+ meses cargados; se saca por el mismo
        # motivo que el título del eje Y de arriba, además de ser redundante.
        chart.style = 2
        chart.width = 22
        chart.height = 11

        # Excel real (a diferencia de LibreOffice) oculta las etiquetas de eje
        # cuando estas propiedades quedan en None: openpyxl las omite del XML
        # y Excel no asume el default "visible" que sí asume LibreOffice.
        chart.x_axis.delete = False
        chart.y_axis.delete = False
        chart.x_axis.majorTickMark = "out"
        chart.y_axis.majorTickMark = "out"
        chart.x_axis.minorTickMark = "none"
        chart.y_axis.minorTickMark = "none"
        chart.x_axis.tickLblPos = "nextTo"
        chart.y_axis.tickLblPos = "nextTo"

        chart.y_axis.numFmt = "#,##0"
        chart.y_axis.scaling.min = 0
        chart.y_axis.majorGridlines = ChartLines(
            spPr=GraphicalProperties(ln=LineProperties(solidFill="E6E6E6", w=6350))
        )
        chart.x_axis.majorGridlines = None

        chart.legend.overlay = False
        chart.legend.txPr = legend_text()

        cats = Reference(ws, min_col=1, min_row=evo_first_data_row, max_row=evo_last_data_row)
        for i, _t in enumerate(tarjetas):
            col = 2 + i
            data = Reference(ws, min_col=col, min_row=evo_header_row, max_row=evo_last_data_row)
            chart.add_data(data, titles_from_data=True)
        chart.set_categories(cats)

        for i, t in enumerate(tarjetas):
            color = (t.get("color") or "5B9BE8").lstrip("#").upper()
            series = chart.series[i]
            series.graphicalProperties.line.solidFill = color
            series.graphicalProperties.line.width = 28575
            series.smooth = False
            series.marker = Marker(symbol="circle", size=6)
            series.marker.graphicalProperties = GraphicalProperties(
                solidFill=color, ln=LineProperties(solidFill=color)
            )

        ws.add_chart(chart, f"A{chart_anchor_row}")
        row = chart_anchor_row + 24
    else:
        row += 2

    if incluir_detalle:
        for t in tarjetas:
            ws.cell(row=row, column=1, value=f"Detalle — {t.get('nombre') or ''}").font = Font(
                bold=True, size=14
            )
            row += 2
            row = _write_detalle_tarjeta(ws, row, t)

    # autosize() recorre la columna entera cada vez que se llama: las tablas
    # de detalle (más angostas, más abajo) pueden terminar dejando más
    # angosta una columna que en "Evolución mensual" tenía valores más
    # anchos (ej. columna D = "Cuotas" en el detalle vs. "Total" en ARS en
    # evolución), mostrando ####### en Excel. Se repite el autosize acá con
    # el rango máximo usado en toda la hoja para que gane el ancho correcto.
    max_col = max(total_col, 8) if incluir_detalle else total_col
    autosize(ws, 1, max_col)

    return ws


# ---------------------------------------------------------------------------
# Ahorros
# ---------------------------------------------------------------------------


def _write_resumen_ahorros(ws, row, resumen):
    ws.cell(row=row, column=1, value="Resumen general de ahorros").font = Font(bold=True, size=13)
    row += 1
    headers = ["Activo", "USD", "ARS", "% cuenta", "% total"]
    for i, h in enumerate(headers):
        ws.cell(row=row, column=1 + i, value=h)
    style_header_row(ws, row, 1, len(headers))
    row += 1

    grupos = resumen.get("grupos") or []
    for g in grupos:
        cuentas = g.get("cuentas") or []
        for c in cuentas:
            for a in c.get("activos") or []:
                ws.cell(row=row, column=1, value=a.get("label") or "")
                ws.cell(row=row, column=2, value=float(a.get("usd") or 0)).number_format = USD_FMT
                ws.cell(row=row, column=3, value=float(a.get("ars") or 0)).number_format = ARS_FMT
                ws.cell(row=row, column=4, value=float(a.get("pctCuenta") or 0)).number_format = "0.0%"
                ws.cell(row=row, column=5, value=float(a.get("pctTotal") or 0)).number_format = "0.0%"
                row += 1
            if c.get("showSubtotal"):
                ws.cell(row=row, column=1, value=f"Subtotal {c.get('nombre') or ''}")
                ws.cell(row=row, column=2, value=float(c.get("totalUSD") or 0)).number_format = USD_FMT
                ws.cell(row=row, column=3, value=float(c.get("totalARS") or 0)).number_format = ARS_FMT
                ws.cell(row=row, column=4, value="—")
                ws.cell(row=row, column=5, value=float(c.get("pctTotal") or 0)).number_format = "0.0%"
                style_total_row(ws, row, 1, 5)
                row += 1
        ws.cell(row=row, column=1, value=f"Subtotal {TIPO_AHORRO_LABEL.get(g.get('tipo'), g.get('tipo'))}")
        ws.cell(row=row, column=2, value=float(g.get("subtotalUSD") or 0)).number_format = USD_FMT
        ws.cell(row=row, column=3, value=float(g.get("subtotalARS") or 0)).number_format = ARS_FMT
        ws.cell(row=row, column=4, value="—")
        ws.cell(row=row, column=5, value=float(g.get("pctTotal") or 0)).number_format = "0.0%"
        style_total_row(ws, row, 1, 5)
        row += 1

    ws.cell(row=row, column=1, value="TOTAL")
    ws.cell(row=row, column=2, value=float(resumen.get("totalUSD") or 0)).number_format = USD_FMT
    ws.cell(row=row, column=3, value=float(resumen.get("totalARS") or 0)).number_format = ARS_FMT
    ws.cell(row=row, column=4, value="—")
    ws.cell(row=row, column=5, value=1.0).number_format = "0.0%"
    style_total_row(ws, row, 1, 5)
    row += 1

    autosize(ws, 1, len(headers))
    return row + 2


def _pie_data_labels(show_cat_name=False):
    return DataLabelList(
        showPercent=True,
        showVal=False,
        showCatName=show_cat_name,
        showSerName=False,
        showLegendKey=False,
    )


PIE_WIDTH_CM = 10
PIE_HEIGHT_CM = 8
DEFAULT_COL_WIDTH_CHARS = 8.43


def _col_width_emu(ws, col_idx_1based):
    dim = ws.column_dimensions.get(get_column_letter(col_idx_1based))
    width_chars = dim.width if dim and dim.width else DEFAULT_COL_WIDTH_CHARS
    px = round(width_chars * 7) + 5
    return px * 9525  # pixels_to_EMU


def _emu_to_anchor(ws, target_emu):
    # Convierte una posición horizontal absoluta (en EMU, medida desde el
    # borde izquierdo de la columna A) a un par (columna, offset) válido.
    #
    # La primera versión de este anclaje ponía todo el offset dentro de la
    # columna A (col=0, colOff=varios cm), asumiendo que Excel lo interpreta
    # como una posición absoluta sin importar cuánto exceda el ancho real de
    # esa columna. En Excel real ese colOff "desbordado" no se respetó y los
    # dos gráficos terminaron superpuestos — spec de OOXML dice que colOff
    # debería ser menor al ancho de esa columna. Acá se camina columna por
    # columna (con su ancho real ya fijado por autosize) hasta encontrar en
    # cuál cae la posición pedida, para que el offset final quede siempre
    # dentro del ancho de esa columna.
    col = 1
    remaining = target_emu
    while True:
        w = _col_width_emu(ws, col)
        if remaining < w:
            return col - 1, round(remaining)  # -1: los anchors son 0-indexed
        remaining -= w
        col += 1


def _write_pie_chart(ws, row0, col0, col_off_emu, title, data_ref, cats_ref, colors, show_cat_name=False):
    chart = PieChart()
    chart.title = chart_title(title)
    chart.height = PIE_HEIGHT_CM
    chart.width = PIE_WIDTH_CM
    chart.dataLabels = _pie_data_labels(show_cat_name)
    chart.legend.overlay = False
    chart.legend.txPr = legend_text()

    chart.add_data(data_ref, titles_from_data=True)
    chart.set_categories(cats_ref)

    series = chart.series[0]
    # Contorno más oscuro que el relleno en cada porción: sin esto, cuentas
    # del mismo tipo (mismo color base, ej. dos cuentas de Bolsa) se
    # confunden entre sí en "Distribución por cuenta".
    series.data_points = [
        DataPoint(
            idx=i,
            spPr=GraphicalProperties(solidFill=color, ln=LineProperties(solidFill=darken_hex(color), w=9525)),
        )
        for i, color in enumerate(colors)
    ]

    chart.anchor = OneCellAnchor(
        _from=AnchorMarker(col=col0, colOff=col_off_emu, row=row0, rowOff=0),
        ext=XDRPositiveSize2D(cx=cm_to_EMU(PIE_WIDTH_CM), cy=cm_to_EMU(PIE_HEIGHT_CM)),
    )
    ws.add_chart(chart)


def _write_distribucion_tipo(ws, row, resumen):
    # Tabla "tipo" en A/B y tabla "cuenta" en D/E, lado a lado en la misma
    # franja de filas; los dos gráficos van debajo, también lado a lado.
    #
    # Los gráficos NO se crean acá: _emu_to_anchor necesita el ancho FINAL
    # de las columnas para ubicar el segundo gráfico justo al lado del
    # primero sin superponerlos, pero autosize() vuelve a recalcular esas
    # mismas columnas más abajo (evolución mensual, y detalle de cuentas si
    # se pidió) recorriendo la columna entera — así que cualquier ancho
    # vigente en este punto todavía puede cambiar antes de terminar la hoja.
    # Se devuelven las specs y quien arma la hoja los crea al final, cuando
    # ya no va a haber más autosize() de por medio.
    grupos = [g for g in (resumen.get("grupos") or []) if float(g.get("subtotalUSD") or 0) > 0]
    cuentas_flat = [
        (c, g.get("tipo")) for g in (resumen.get("grupos") or []) for c in (g.get("cuentas") or [])
        if float(c.get("totalUSD") or 0) > 0
    ]

    ws.cell(row=row, column=1, value="Distribución por tipo").font = Font(bold=True, size=13)
    ws.cell(row=row, column=4, value="Distribución por cuenta").font = Font(bold=True, size=13)
    row += 1

    header_row = row
    ws.cell(row=header_row, column=1, value="Tipo")
    ws.cell(row=header_row, column=2, value="Total USD")
    style_header_row(ws, header_row, 1, 2)
    ws.cell(row=header_row, column=4, value="Cuenta")
    ws.cell(row=header_row, column=5, value="Total USD")
    style_header_row(ws, header_row, 4, 5)
    row += 1

    first_data_row = row
    for i in range(max(len(grupos), len(cuentas_flat))):
        r = first_data_row + i
        if i < len(grupos):
            g = grupos[i]
            ws.cell(row=r, column=1, value=TIPO_AHORRO_LABEL.get(g.get("tipo"), g.get("tipo")))
            ws.cell(row=r, column=2, value=float(g.get("subtotalUSD") or 0)).number_format = USD_FMT
        if i < len(cuentas_flat):
            c, _tipo = cuentas_flat[i]
            ws.cell(row=r, column=4, value=c.get("nombre") or "")
            ws.cell(row=r, column=5, value=float(c.get("totalUSD") or 0)).number_format = USD_FMT
    last_tipo_row = first_data_row + len(grupos) - 1
    last_cuenta_row = first_data_row + len(cuentas_flat) - 1
    row = first_data_row + max(len(grupos), len(cuentas_flat))
    autosize(ws, 1, 2)
    autosize(ws, 4, 5)
    row += 2

    section_end_row = row
    row0 = row - 1  # anchors son 0-indexed

    pending_charts = []

    if grupos:
        data = Reference(ws, min_col=2, min_row=header_row, max_row=last_tipo_row)
        cats = Reference(ws, min_col=1, min_row=first_data_row, max_row=last_tipo_row)
        colors = [TIPO_AHORRO_COLOR.get(g.get("tipo"), "5B9BE8") for g in grupos]
        pending_charts.append(
            {
                "row0": row0,
                "title": "Distribución por tipo",
                "data": data,
                "cats": cats,
                "colors": colors,
                "show_cat_name": False,
                "primary": True,
            }
        )
        section_end_row = max(section_end_row, row + 20)

    if cuentas_flat:
        data = Reference(ws, min_col=5, min_row=header_row, max_row=last_cuenta_row)
        cats = Reference(ws, min_col=4, min_row=first_data_row, max_row=last_cuenta_row)
        colors = [(c.get("color") or "5B9BE8").lstrip("#").upper() for c, _tipo in cuentas_flat]
        pending_charts.append(
            {
                "row0": row0,
                "title": "Distribución por cuenta",
                "data": data,
                "cats": cats,
                "colors": colors,
                "show_cat_name": True,
                "primary": False,
            }
        )
        section_end_row = max(section_end_row, row + 20)

    return section_end_row, pending_charts


def _place_distribucion_charts(ws, pending_charts):
    pie_gap_cm = 1.5  # separación moderada entre los dos gráficos
    for spec in pending_charts:
        if spec["primary"]:
            col0, col_off = 0, 0
        else:
            target_emu = cm_to_EMU(PIE_WIDTH_CM + pie_gap_cm)
            col0, col_off = _emu_to_anchor(ws, target_emu)
        _write_pie_chart(
            ws,
            spec["row0"],
            col0,
            col_off,
            spec["title"],
            spec["data"],
            spec["cats"],
            spec["colors"],
            show_cat_name=spec["show_cat_name"],
        )


def _write_evolucion_ahorros(ws, row, evolucion, cuentas):
    ws.cell(row=row, column=1, value="Evolución mensual de ahorros (USD)").font = Font(bold=True, size=13)
    row += 1

    cuentas_con_datos = [
        c
        for c in cuentas
        if any((m.get("porCuenta") or {}).get(c.get("id")) is not None for m in evolucion)
    ]

    header_row = row
    ws.cell(row=row, column=1, value="Mes")
    for i, c in enumerate(cuentas_con_datos):
        ws.cell(row=row, column=2 + i, value=c.get("nombre") or "")
    total_col = 2 + len(cuentas_con_datos)
    ws.cell(row=row, column=total_col, value="Total USD")
    style_header_row(ws, row, 1, total_col)
    row += 1

    first_data_row = row
    for m in evolucion:
        ws.cell(row=row, column=1, value=mes_label(m.get("mes", "")))
        por_cuenta = m.get("porCuenta") or {}
        for i, c in enumerate(cuentas_con_datos):
            val = por_cuenta.get(c.get("id"))
            cell = ws.cell(row=row, column=2 + i, value=float(val) if val is not None else None)
            cell.number_format = USD_FMT
        ws.cell(row=row, column=total_col, value=float(m.get("total", 0) or 0)).number_format = USD_FMT
        row += 1
    last_data_row = row - 1

    autosize(ws, 1, total_col)

    chart_anchor_row = row + 2
    if evolucion and cuentas_con_datos:
        chart = LineChart()
        # El título del eje X ("Mes") se solapaba con las etiquetas jun-26/
        # jul-26/... al haber 3+ meses (mismo problema que el título del eje
        # Y en Tarjetas) — se saca porque además es redundante, las
        # etiquetas del eje ya se entienden solas.
        chart.title = chart_title("Evolución mensual de ahorros (USD)")
        chart.style = 2
        chart.width = 22
        chart.height = 11

        style_line_chart_axes(chart)

        cats = Reference(ws, min_col=1, min_row=first_data_row, max_row=last_data_row)
        for i, _c in enumerate(cuentas_con_datos):
            col = 2 + i
            data = Reference(ws, min_col=col, min_row=header_row, max_row=last_data_row)
            chart.add_data(data, titles_from_data=True)
        chart.set_categories(cats)

        style_line_series(chart, cuentas_con_datos, lambda c: c.get("color"))

        ws.add_chart(chart, f"A{chart_anchor_row}")
        row = chart_anchor_row + 24
    else:
        row += 2

    return row


def _write_detalle_cuenta_ahorro(ws, row, cuenta):
    nombre = cuenta.get("nombre") or ""
    tipo = cuenta.get("tipo")
    activos = cuenta.get("activos") or []

    if tipo == "usdt":
        # costoTotal/valorActual del payload son en realidad saldo cerrado (capital a
        # fecha_ultimo_calculo) y saldo actual (capitalizado día a día hasta hoy) —
        # interés compuesto diario sobre TNA, no un costo/valor de compra-venta.
        headers = ["Activo / Plataforma", "Saldo (USD)", "Saldo actual (USD)", "Rendimiento (USD)"]
        formats = [None, USD_FMT, USD_FMT, USD_FMT]
        data_rows = [
            [
                a.get("label"),
                float(a.get("costoTotal") or 0),
                float(a.get("valorActual") or 0),
                float(a["rendimiento"]) if a.get("rendimiento") is not None else "—",
            ]
            for a in activos
        ]
    else:
        moneda = cuenta.get("moneda") or ("ARS" if tipo == "bolsa" else "USD")
        moneda_fmt = ARS_FMT if moneda == "ARS" else USD_FMT
        headers = ["Activo", "Cantidad", "Precio compra", "Precio actual", "Valor actual", "P&L", "P&L %"]
        formats = [None, None, moneda_fmt, moneda_fmt, moneda_fmt, moneda_fmt, "0.0%"]
        data_rows = [
            [
                a.get("label"),
                float(a.get("cantidad") or 0),
                float(a.get("precioCompra") or 0),
                float(a.get("precioActual") or 0),
                float(a.get("valorActual") or 0),
                float(a["pl"]) if a.get("pl") is not None else "—",
                float(a["plPct"]) if a.get("plPct") is not None else "—",
            ]
            for a in activos
        ]

    return _write_table(ws, row, f"{nombre} — Detalle de activos", headers, formats, data_rows)


def _build_ahorros_sheet(wb, payload):
    ahorros = payload.get("ahorros") or {}
    resumen = ahorros.get("resumen") or {"grupos": [], "totalUSD": 0, "totalARS": 0}
    evolucion = ahorros.get("evolucionMensual") or []
    cuentas = ahorros.get("cuentas") or []
    incluir_detalle = bool(payload.get("incluirDetalleAhorros"))

    ws = wb.create_sheet("Ahorros")
    ws.sheet_view.showGridLines = False

    row = 1
    row = _write_resumen_ahorros(ws, row, resumen)
    row, pending_charts = _write_distribucion_tipo(ws, row, resumen)
    row = _write_evolucion_ahorros(ws, row, evolucion, cuentas)

    if incluir_detalle:
        for c in cuentas:
            row = _write_detalle_cuenta_ahorro(ws, row, c)

    # Recién acá, con todas las tablas ya escritas y sin más autosize() por
    # delante, se conoce el ancho final de las columnas: ver comentario en
    # _write_distribucion_tipo.
    _place_distribucion_charts(ws, pending_charts)

    return ws


def build_workbook(payload):
    wb = Workbook()
    _build_tarjetas_sheet(wb, payload)
    if payload.get("ahorros"):
        _build_ahorros_sheet(wb, payload)
    return wb


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            body = self.rfile.read(length) if length else b"{}"
            payload = json.loads(body or b"{}")

            wb = build_workbook(payload)
            buf = io.BytesIO()
            wb.save(buf)
            data = buf.getvalue()

            mes_actual = datetime.now().strftime("%Y-%m")
            filename = f"GastalaYGuardala_{mes_actual}.xlsx"

            self.send_response(200)
            self.send_header(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:  # noqa: BLE001 — se reporta cualquier error al frontend
            msg = json.dumps({"error": str(e)}).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Allow", "POST, OPTIONS")
        self.end_headers()
