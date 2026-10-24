// Contenido de Ayuda (FAQ del menú ⋯) y de la ayuda contextual (HelpTip).
// Una sola fuente: cada pregunta puede tener `tip` (texto corto del "?" junto
// a un campo) o `tips` ({ variante: texto }) si aparece en más de un campo.
//
// Fuente de verdad: lo que hace el código, no GUIA_DE_USO.md. Respuestas
// cortas (2-3 líneas), en tono rioplatense y sin jerga técnica. El nombre de
// la app va siempre "Gastala y Guardala", sin tildes. Nada de números que
// envejezcan (tasas, spreads). Revisar este archivo al cerrar cada feature.

export const AYUDA = [
  {
    id: "tarjetas",
    titulo: "Tarjetas",
    preguntas: [
      {
        id: "cuotas-monto",
        pregunta: "¿Cómo cargo una compra en cuotas?",
        respuesta:
          "Cargá el monto total de la compra (no el valor de una cuota) y la cantidad de cuotas. La app calcula cuánto pagás por mes y en qué cuota vas según la fecha de compra. Cuando pasa la última cuota, la compra deja de sumar sola; podés borrarla cuando quieras. Las compras en un pago se cargan con 1 cuota.",
        tip: "El monto total de la compra, no el de una cuota. La app lo divide por la cantidad de cuotas.",
      },
      {
        id: "dolares",
        pregunta: "¿Cómo funcionan los gastos en dólares?",
        respuesta:
          "Cargalos en dólares, tal cual figuran en el resumen. La app los pasa a pesos con la cotización que pusiste arriba en esa tarjeta. Actualizala cuando cambie, así el total del mes se acerca a lo que vas a pagar.",
        tip: "Se usa para pasar a pesos los gastos en dólares de esta tarjeta. Actualizala cuando cambie.",
      },
      {
        id: "suscripciones",
        pregunta: "¿Cómo funcionan las suscripciones?",
        respuesta:
          "Se suman todos los meses al total de la tarjeta mientras estén activas. Si pausás una, destildá “Activo”: deja de sumar pero queda guardada para cuando la retomes.",
      },
      {
        id: "registrar",
        pregunta: "¿Para qué sirve “Registrar este mes”?",
        respuesta:
          "Guarda una foto del total a pagar de esa tarjeta en el historial de Total mensual. Si lo volvés a tocar en el mismo mes, la foto nueva reemplaza a la anterior. Lo ideal es registrarlo cuando ya cerró el resumen. En el gráfico, el mes actual muestra el valor en vivo; la tabla, la foto registrada de los últimos 12 meses (el Excel trae toda la historia). Un mes que no registraste queda como hueco en el gráfico.",
      },
      {
        id: "linea-punteada",
        pregunta: "¿Qué es la línea punteada del gráfico?",
        respuesta:
          "El gráfico muestra los 2 meses anteriores, el actual y los próximos 3. El tramo punteado es lo que ya tenés comprometido para esos 3 meses: las cuotas que te quedan y las suscripciones activas. Es un mínimo: no incluye compras que todavía no hiciste, ni gastos en un pago o en dólares. El mes actual se calcula en vivo con lo que tenés cargado. En la tabla, esos meses aparecen aparte como “Comprometido” y no suman al total.",
      },
      {
        id: "total-a-pagar",
        pregunta: "¿Qué suma “Total a pagar”?",
        respuesta:
          "Las cuotas que te tocan este mes, las suscripciones activas y los gastos en dólares pasados a pesos con la cotización de la tarjeta. Por eso, si cambiás la cotización, cambia el total.",
      },
      {
        id: "salario",
        pregunta: "¿Cómo se calcula el % del salario?",
        respuesta:
          "Cargás tu salario neto una sola vez, arriba de las tarjetas. Cada tarjeta muestra qué parte del salario se lleva su “Total a pagar” (pesos más dólares convertidos con la cotización de esa tarjeta), y la franja de arriba muestra la suma de todas. Se marca en rojo cuando pasa del 30%. Si no cargaste el salario, ves “—”.",
        tip: "Tu salario neto del mes, uno solo para todas las tarjetas. Se usa para calcular el % del salario de cada tarjeta y el total.",
      },
      {
        id: "calculadora",
        pregunta: "¿Cómo uso “¿Cuotas o contado?”?",
        respuesta:
          "Cargás el precio de contado, las cuotas y el valor de la cuota (o el recargo). Te dice cuánto tiene que rendir tu plata por mes para que convenga pagar en cuotas: si rinde más que eso, conviene cuotas. Supone que la plata que no gastás queda rindiendo esa tasa hasta la última cuota. Si la plata queda quieta en el banco, rinde 0%.",
      },
      {
        id: "importar",
        pregunta: "¿Cómo importo un resumen?",
        respuesta:
          "Copiás unas instrucciones, las pegás en el chat de IA que uses junto con el PDF o las fotos del resumen, y pegás la respuesta en la app. El archivo se procesa en ese chat, no en Gastala y Guardala. Revisá todo antes de confirmar: nada se guarda hasta que tocás “Importar”. Con PDF suele salir mejor que con fotos. Se puede usar en tarjetas y en cuentas de Bolsa y Cripto. En tarjetas, si el resumen no trae la fecha de cierre te la pide, las suscripciones repetidas se juntan en una, podés pasar un gasto entre “Un pago” y “Suscripciones”, y si lo leído no suma lo mismo que el total del resumen, te avisa.",
      },
    ],
  },
  {
    id: "ahorros",
    titulo: "Ahorros",
    preguntas: [
      {
        id: "tipo-moneda",
        pregunta: "¿Puedo cambiar el tipo o la moneda de una cuenta?",
        respuesta:
          "No. Se eligen al crearla porque definen cómo se calculan sus valores; sí podés cambiarle el nombre y el color. Si te equivocaste, creá otra cuenta y borrá la anterior, pero ojo: borrar una cuenta borra también todos sus activos.",
        tip: "El tipo y la moneda no se pueden cambiar después. Elegí la moneda en la que tu broker o exchange te muestra los precios.",
      },
      {
        id: "moneda-precios",
        pregunta: "¿En qué moneda van los precios y el P&L?",
        respuesta:
          "En la moneda de la cuenta, tal cual los ves en tu broker o exchange, sin conversión. Así el P&L muestra cuánto ganaste o perdiste en esa moneda, sin mezclarlo con la suba o la baja del dólar.",
      },
      {
        id: "bonos",
        pregunta: "¿Cómo cargo bonos y obligaciones negociables?",
        respuesta:
          "El precio va por cada nominal, no cada 100. Si tu broker dice “$1.234 cada 100 VN”, cargá 12,34. Al importar un resumen, la app detecta ese caso y lo ajusta sola.",
      },
      {
        id: "otra-moneda",
        pregunta: "¿De dónde sale la columna en la otra moneda?",
        respuesta:
          "Es el valor convertido con las cotizaciones que cargás arriba en Ahorros: dólar (CCL/MEP) para Bolsa y Pesos, y USDT para Cripto y USD/Stable. Siempre usa la cotización de hoy, así que cambia aunque tus activos no cambien.",
      },
      {
        id: "saldo-tna",
        pregunta: "¿Cómo cargo USD/Stable y Pesos remunerados?",
        respuesta:
          "En “Saldo aportado” poné el total que tenés hoy en la cuenta, no solo lo que agregaste. En “TNA” poné la tasa anual tal cual la muestra tu banco o billetera, y actualizala cuando cambie. La app calcula en vivo, día a día, el interés ganado desde la última vez que los actualizaste.",
        tips: {
          saldo:
            "El total que tenés hoy, no lo que agregaste. Para un aporte o retiro, partí del “Saldo actual” y escribí el total nuevo.",
          tna: "La tasa anual tal cual la muestra tu banco. Actualizala cuando cambie: el interés ganado hasta hoy no se pierde.",
        },
      },
      {
        id: "usdt",
        pregunta: "¿Por qué el valor en USDT no coincide con mi exchange?",
        respuesta:
          "Es la cotización que cargás arriba en Ahorros y se usa de referencia para todas las cuentas de Cripto y USD/Stable. Tu exchange puede mostrar otro precio en cada momento (compra, venta, comisiones). Actualizala cuando quieras acercar los valores.",
      },
    ],
  },
  {
    id: "cuenta",
    titulo: "Cuenta y seguridad",
    preguntas: [
      {
        id: "login",
        pregunta: "¿Cómo entro a la app?",
        respuesta:
          "Con tu email: te mandamos un código y lo ingresás, sin contraseña. El código vence al rato; si no te llegó o se venció, tocá “¿No te llegó o venció? Pedir un código nuevo”. Cada dispositivo o navegador nuevo te lo va a pedir.",
      },
      {
        id: "desbloqueo",
        pregunta: "¿Qué es el desbloqueo con Face ID o PIN?",
        respuesta:
          "Es un candado extra para no pedirte un código por mail cada vez que abrís la app. Se pide al abrirla y al volver después de más de 5 minutos en segundo plano. Con Face ID, el teléfono muestra su propio cuadro de confirmación: es una medida de seguridad del sistema y la app no puede evitarla. Si te olvidás el PIN, tocá “Cerrar sesión y entrar con código” y volvé a entrar con el código por mail.",
      },
      {
        id: "privacidad",
        pregunta: "¿Quién puede ver mis datos?",
        respuesta:
          "Otros usuarios no: cada cuenta ve solo sus propios datos. Los datos se guardan en servidores de Supabase, el servicio que usa la app. El administrador de la app tiene acceso a los datos guardados, pero no los usa ni los comparte con nadie.",
      },
      {
        id: "instalar",
        pregunta: "¿Cómo la instalo como app?",
        respuesta:
          "En iPhone: abrila en Safari, tocá Compartir y después “Agregar a inicio”. En Android: en Chrome, abrí el menú ⋮ y elegí “Instalar app” o “Agregar a pantalla principal”. Queda con su ícono y se abre a pantalla completa.",
      },
      {
        id: "sin-conexion",
        pregunta: "¿Puedo cargar datos sin conexión?",
        respuesta:
          "Sí. Si se corta la conexión con la app abierta, lo que cargues o edites queda guardado en el dispositivo y se sincroniza solo cuando vuelve; mientras tanto vas a ver un aviso con los cambios pendientes. Importar resúmenes y exportar a Excel sí necesitan conexión.",
      },
      {
        id: "nueva-version",
        pregunta: "¿Qué es “Nueva versión disponible”?",
        respuesta:
          "Aparece cuando hay una actualización de Gastala y Guardala. Tocá “Recargar” para usarla. Si lo cerrás, vuelve a aparecer cuando regreses a la app; no se recarga sola para no cortarte algo que estés cargando.",
      },
      {
        id: "excel",
        pregunta: "¿Cómo exporto a Excel?",
        respuesta:
          "Desde el menú ⋯ → “Exportar a Excel”. Baja un archivo con el resumen de Tarjetas y de Ahorros y su evolución mensual con gráficos. Si querés, podés sumar el detalle completo de cada tarjeta y de cada cuenta.",
      },
      {
        id: "borrar",
        pregunta: "¿Puedo recuperar una tarjeta o una cuenta borrada?",
        respuesta:
          "No. Borrar una tarjeta borra todo lo cargado en ella, incluido su historial de totales; borrar una cuenta de ahorro borra todos sus activos. No se puede deshacer, por eso la app te pide confirmar.",
      },
    ],
  },
];

export function buscarPregunta(id) {
  for (const seccion of AYUDA) {
    const p = seccion.preguntas.find((q) => q.id === id);
    if (p) return p;
  }
  return null;
}
