"""Función serverless de Vercel (Python) que arma un .xlsx a partir del JSON
que le manda el frontend. No toca Supabase ni ninguna otra fuente de datos:
solo recibe datos ya cargados por el cliente y los convierte a Excel.

Paso 1: solo la solapa "Tarjetas" (resumen del mes, evolución mensual con
gráfico nativo, y detalle opcional de cuotas/dólares/recurrentes por tarjeta).
"""

import io
import json
from datetime import datetime
from http.server import BaseHTTPRequestHandler

from openpyxl import Workbook
from openpyxl.chart import LineChart, Reference
from openpyxl.chart.axis import ChartLines
from openpyxl.chart.marker import Marker
from openpyxl.chart.shapes import GraphicalProperties
from openpyxl.chart.text import RichText, Text
from openpyxl.chart.title import Title
from openpyxl.drawing.line import LineProperties
from openpyxl.drawing.text import CharacterProperties, Paragraph, ParagraphProperties, RegularTextRun
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

MESES_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

HEADER_FILL = PatternFill("solid", fgColor="F2F2F2")
HEADER_FONT = Font(bold=True)
TOTAL_FONT = Font(bold=True)
TOTAL_FILL = PatternFill("solid", fgColor="FAFAFA")
THIN = Side(style="thin", color="D9D9D9")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

ARS_FMT = '#,##0" ARS"'
USD_FMT = '#,##0.00" USD"'


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


def autosize(ws, first_col, last_col, min_width=10, max_width=40):
    for col in range(first_col, last_col + 1):
        letter = get_column_letter(col)
        width = min_width
        for cell in ws[letter]:
            if cell.value is not None:
                width = max(width, len(str(cell.value)) + 2)
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


def build_workbook(payload):
    tarjetas = sorted(payload.get("tarjetas") or [], key=lambda t: t.get("orden") or 0)
    total_mensual = payload.get("totalMensual") or []
    incluir_detalle = bool(payload.get("incluirDetalleTarjetas"))

    wb = Workbook()
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
        chart.title = chart_title("Evolución mensual por tarjeta")
        chart.y_axis.title = "ARS"
        chart.x_axis.title = "Mes"
        chart.style = 2
        chart.width = 22
        chart.height = 11

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
