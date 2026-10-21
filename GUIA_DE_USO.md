# Guía de uso

## Ahorros

### Importar resumen (carga inicial de tenencia)

En vez de tipear fila por fila, podés cargar tu tenencia actual de una cuenta de
Bolsa o Cripto pegando el resultado de un chat de IA:

1. En la tabla de la cuenta (Bolsa o Cripto), tocá **"Importar resumen"** (al lado de
   "+ agregar").
2. Tocá **"Copiar instrucciones"** para copiar el prompt al portapapeles.
3. Abrí el chat de IA que ya uses (Claude, ChatGPT, Gemini…), pegá las instrucciones y
   adjuntá el PDF o las fotos de tu resumen de broker/exchange.
4. Copiá la respuesta completa del chat y pegala en la app.
5. Revisá la tabla fila por fila antes de confirmar: podés destildar, editar cualquier
   valor o corregir lo que la IA haya interpretado mal. Nada se guarda hasta que tocás
   "Importar".

**Importante — privacidad:** tu resumen (PDF o fotos) se procesa en el chat de IA que
vos elijas, no en Gastala y Guardala. La app nunca recibe el archivo, solo el texto que
pegues en el paso 4. Revisá las condiciones de privacidad del servicio de chat que uses
antes de subirle datos sensibles.

Durante la revisión, la app marca automáticamente:
- **Precio ajustado (cada 100 nominales):** en bonos y ONs, si el precio informado no
  coincide con el valor total de la posición pero sí coincide dividido por 100, se
  ajusta solo y se avisa.
- **Moneda distinta a la cuenta** (en rojo, destildada): no se convierte, hay que
  importarlo a una cuenta en esa moneda o corregirlo a mano.
- **Ticker que ya existe en la cuenta** (amarillo, destildada): para evitar duplicar una
  posición.
- **Sin precio de compra** (amarillo, tildada): se importa igual, pero el P&L no se
  calcula hasta que completes el precio de compra.

USD/Stable y Pesos Líquidos no tienen importación (son cuentas de 1–2 filas, se cargan
a mano). Importar requiere conexión a internet.

### Carga manual: bonos y ONs

El precio de compra y el precio actual se cargan **por nominal**, no cada 100 VN. Si tu
broker informa el precio "cada 100 nominales" (por ejemplo, "$1.234 cada 100 VN"),
dividilo por 100 antes de cargarlo (en el ejemplo, precio = 12,34). Esto aplica tanto a
la carga manual como a lo que revisás al importar un resumen.
