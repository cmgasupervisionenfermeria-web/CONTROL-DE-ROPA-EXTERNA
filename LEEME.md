# Control de Ropa Externa · CMGA (PRO-ENF-ROP-001 v1.0)

App para la etapa con **lavandería externa (proveedor)**, vigente hasta febrero de 2027. La app de lavandería propia está en el repositorio `CONTROL-DE-ROPA`.

**Backend compartido:** las dos apps usan el mismo proyecto de Apps Script "CONTROL DE ROPA" y la misma URL `/exec`. Esta app manda `app=ext` en cada petición y el backend la atiende con las hojas Envios, Recepciones, Ajustes, Conteos, Surtidos y Config. El `Code.gs` de este repositorio es el mismo que el del repositorio `CONTROL-DE-ROPA`.

Hay dos archivos:

- `index.html`: la app (se publica en GitHub Pages).
- `Code.gs`: el backend en Google Apps Script, que guarda todo en Google Sheets.

## Instalación (unos 10 minutos)

1. **Hoja de cálculo.** Cree una hoja nueva en Google Sheets llamada "Control de Ropa CMGA". Vaya a Extensiones → Apps Script.
2. **Backend.** Borre el contenido de `Código.gs` y pegue todo `Code.gs`. Guarde. Ejecute una vez la función `inicializarHojas` y autorice los permisos. Se crean las hojas Envios, Recepciones, Ajustes, Conteos y Config.
3. **Publicar.** Implementar → Nueva implementación → tipo **Aplicación web**. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier usuario**. Copie la URL que termina en `/exec`.
4. **Conectar la app.** En `index.html`, al inicio del bloque `<script>`, pegue esa URL:
   ```js
   const GAS_URL = 'https://script.google.com/macros/s/XXXX/exec';
   const PINS = { 'ROPA1':'admin', 'SUP1':'sup', 'VIG1':'vig' };
   ```
5. **GitHub Pages.** Cree el repositorio (por ejemplo `cmgasupervisionenfermeria-web/Control-Ropa`), suba `index.html`, y active Pages en Settings → Pages → rama `main`.

Si deja `GAS_URL` vacía, la app funciona igual, pero los datos se quedan solo en ese navegador.

Para actualizar el backend sin cambiar la URL: Implementar → Administrar implementaciones → ✏️ → Nueva versión.

## Perfiles y PIN

| PIN | Perfil | Qué puede hacer |
| --- | --- | --- |
| `ROPA1` | Compras y Recursos Humanos | Todo: envíos, recepciones, resurtidos, conteos, stock, ajustes con el proveedor, configuración, corregir y eliminar |
| `SUP1` | Supervisión de Enfermería | Resurtir los stocks de los servicios desde Paliativos y registrar conteos físicos; no edita ni borra |
| `VIG1` | Vigilancia | Solo ve Envíos y Recepciones; registra entregas de ropa sucia y recepciones de limpia con foto de la nota; no edita ni borra |

Sin PIN la app es de solo lectura (Gerencia de Enfermería y Dirección la consultan así). Una captura con error de Vigilancia o de Supervisión se corrige con `ROPA1`.

## Primer uso

1. Entre con `ROPA1` (botón **🔒 Entrar con PIN**).
2. **Configuración:** revise el catálogo de prendas, los servicios y escriba el nombre del proveedor.
3. **Stock y conteos:** la app ya trae el stock autorizado de cada servicio (Hospitalización, UCI, UCIM, Quirófano/Recuperación, Urgencias/Endoscopia e Imagen). Si cambia, se corrige ahí y se pulsa **Guardar stock**.
4. **Saldo en lavandería → + Saldo inicial:** si el proveedor ya tenía ropa de CMGA al arrancar, regístrela una sola vez.
5. **Stock y conteos → Registrar stock del proveedor** (solo `ROPA1`): capture las piezas por prenda que el proveedor entregó, con la fecha y el número de acta o remisión.
6. **Inventario físico inicial**, todo el mismo día y en el mismo horario (imprima **🖨 Hojas de inventario físico** para contar en papel):
   - **Paliativos:** toda la ropa limpia de la ropería. Este conteo es el punto de partida; a partir de ahí la existencia se mueve sola.
   - **Cada servicio:** en **+ Registrar conteo** deje marcada la casilla *Incluir la ropa en uso*. Se capturan dos columnas: **Gabinete** (ropa limpia del stock) y **En uso** (camas y pacientes).
7. La tabla **Stock entregado por el proveedor · inventario físico** compara lo entregado con lo localizado (Paliativos + gabinetes + en uso + saldo en lavandería) y muestra la diferencia por prenda. Use **🖨 Conciliación** para imprimirla con firmas.

## Uso diario

| Momento | Pestaña | Botón |
| --- | --- | --- |
| Vigilancia cuenta la ropa sucia en el Tanatorio y la entrega al proveedor | Envíos | + Nuevo envío → imprimir remisión (🖨) y firmar |
| Llega ropa limpia: Vigilancia la cuenta contra la nota de lavandería | Recepciones | + Nueva recepción (según nota, aceptadas, rechazadas y motivo) |
| Supervisión resurte un servicio | Paliativos | + Resurtir un servicio (contar gabinete → la app propone lo que falta) → 🖨 Vale |
| Revisión del día | Tablero | Piezas con más de 3 días = reclamar al proveedor |
| Fin de mes | Paliativos y Stock y conteos | Conteo físico de Paliativos (la app muestra la diferencia contra lo esperado) y de cada servicio |
| Fin de mes | Saldo en lavandería | Imprimir para conciliación → registrar faltantes reconocidos con su acta |
| Fin de mes | Concentrado | Imprimir / PDF de los seis indicadores |

## Cómo se mueve la existencia de Paliativos

Existencia = último conteo físico de Paliativos + ropa limpia aceptada en recepciones posteriores − lo surtido a servicios después.
Por eso cada movimiento lleva fecha **y hora**. Cada conteo físico reinicia el cálculo y muestra cuánto difiere de lo esperado.

## Fotos de las notas del proveedor

Vigilancia puede tomar con el celular o la tableta una foto de la nota del proveedor al entregar ropa sucia y al recibir limpia. La app la reduce (unos 150 KB) y la sube a una carpeta de Google Drive llamada **"Control de Ropa CMGA - Fotos de notas"**, en la cuenta de quien implementó el Apps Script. Cada envío o recepción queda con su 📷 para abrir la foto, y la foto sale en la remisión impresa.

Para activarla, después de pegar el nuevo `Code.gs` ejecute **una vez** la función `autorizarDrive` y acepte el permiso de Google Drive. Luego publique una nueva versión de la implementación. Si no hay internet, la foto queda guardada en el equipo y se sube sola al reconectarse.

## Si ya había instalado la versión anterior del backend

Reemplace `Code.gs` (ahora incluye la hoja **Surtidos**), ejecute `inicializarHojas` una vez y publique una **nueva versión** de la implementación.

## Notas técnicas

- Los datos se guardan primero en el navegador y después se envían a Sheets. Si no hay internet, quedan en cola y se reenvían solos; el indicador del encabezado muestra cuántos cambios faltan.
- En la hoja de cálculo, cada registro ocupa una fila con un resumen legible y la columna "datos (JSON)", que es la que lee la app. No edite esa columna a mano.
- **Configuración → Descargar respaldo** genera un archivo JSON con todo.
- localStorage: `ropa_cmga_v2` (datos) y `ropa_cmga_queue_v2` (cola de envío).
