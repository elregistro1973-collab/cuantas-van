# ¿Cuántas van?

Versión principal en Netlify: https://cuantas-van.netlify.app/

Copia en GitHub Pages: https://elregistro1973-collab.github.io/cuantas-van/

App personal para apuntar cervezas y comprobar la cuenta del bar, con identificación opcional de envases.

## Archivos editables

- `index.html`: pantalla, textos y formularios.
- `styles.css`: colores, tamaños y diseño adaptable.
- `app.js`: contador, ticket, historial y gestión de la foto.
- `portrait.js`: caricatura progresiva y vista previa.
- `recognition-core.js`: interpretación de códigos, etiquetas y datos del catálogo.
- `recognition.js`: cámara, lectura de imágenes y consulta de productos.
- `Cuantas-van.html`: copia original conservada como referencia.

Puedes pedir los cambios directamente en este chat. La versión de trabajo es `index.html`.

## Ver la app

Abre `index.html` con Safari o Chrome desde Finder. No requiere instalación ni compilación.

Si prefieres desarrollo mediante un servidor local, ejecuta desde esta carpeta:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Después abre http://127.0.0.1:8000 en tu navegador. Recarga la página tras cada cambio. Detén el servidor con Ctrl+C.

## Datos

Los datos y la foto se guardan en el almacenamiento local del navegador con la clave `cuantas-van-v1`. El retrato y la etiqueta no se suben a un servidor. Al identificar un código se envía ese identificador al catálogo Open Food Facts. Usar otro navegador, dirección o puerto puede mostrar un almacenamiento distinto. La copia original se conserva intacta.

## Identificar una cerveza

Desde «Escanear cerveza o fotografiar etiqueta» o desde el formulario de cerveza:

- Escaneo en directo de códigos de barras y QR con la cámara trasera.
- Lectura de un código desde una foto, también si no está disponible la cámara en directo.
- Foto de etiqueta con OCR local: propone la marca y el volumen legibles. Es aproximado, no reconocimiento visual de logotipos ni una identificación garantizada del producto.
- Introducción manual del código y edición manual de todos los datos.

Los códigos se consultan en [Open Food Facts](https://world.openfoodfacts.org), base colaborativa bajo ODbL; la cobertura puede ser incompleta. Los QR compatibles contienen un GTIN (incluidos enlaces GS1 Digital Link), un enlace de producto con identificador, o un JSON con `brand`/`marca`, `format`/`formato` y `cl`/`volume`/`volumen`. No se abren enlaces escaneados. Un QR de una web o carta no identifica necesariamente una cerveza.

Los datos se revisan antes de guardar. La identificación borra los datos del producto anterior y deja el precio en blanco. No se interpreta el volumen total de un pack como una cerveza cuando se detecta la ambigüedad. Las calorías sin una base explícita de 100 ml se dejan vacías.

El lector carga `html5-qrcode@2.3.8` y `tesseract.js@5.1.1` desde jsDelivr solo al solicitar su uso. El OCR descarga también el motor y los idiomas español/inglés; necesita conexión en su primera carga, aunque procesa la foto localmente. La identificación depende de red, permisos y capacidades del navegador. El contador y la entrada manual siguen funcionando sin estos servicios. Para publicar como app, habrá que empaquetar estos recursos y probar la cámara en dispositivos reales.

La cámara en directo requiere un contexto seguro y permiso. La cámara se detiene al cerrar el formulario, ocultar la página, detener el lector o leer un código. Cuando no está disponible se ofrecen foto y entrada manual.

## Retrato

Se muestra junto al contador; tocarlo abre «Mi foto». El motor MediaPipe Face Landmarker (`@mediapipe/tasks-vision@0.10.14`, modelo float16 versión 1 de Google) se carga bajo demanda para localizar ojos y boca. La inferencia ocurre en el navegador y solo se guardan la foto y los puntos en localStorage. La primera detección necesita conexión; si falla, «Ajustar rasgos» permite tocar los dos ojos y la boca sobre la foto. Los puntos guardados permiten seguir dibujando sin volver a cargar el detector.

La caricatura deforma los píxeles originales con interpolación bilineal: sonrisa progresiva, guiño, cejas asimétricas, mejillas y cierre de párpados hasta dormir en la séptima. El encuadre se acerca a la cara y cada etapa se almacena en memoria para reutilizarla al deshacer. No genera una cara nueva ni estima alcoholemia. El resultado depende de la foto; funciona mejor con un solo rostro frontal, visible y bien iluminado. Las fotos nuevas se guardan a 512 px; las anteriores se conservan y se analizan automáticamente. Sin foto se muestra una cara ilustrada.

El deslizador permite probar las ocho expresiones sin modificar el ticket. La detección se verificó con una foto pública de prueba en el navegador; las cámaras reales de iOS y Android todavía requieren prueba en dispositivos físicos.

## Comprobaciones

```sh
node --test tests/*.test.cjs
```

Pruebas de volúmenes, códigos, datos incompletos, QR, resultados tardíos, cierre durante permisos de cámara y liberación del lector/OCR. Las integraciones externas están simuladas en estas pruebas; queda pendiente validación con cámara, catálogo y etiquetas reales en Safari iOS y Chrome Android.

Documentación utilizada: [html5-qrcode](https://scanapp.org/html5-qrcode-docs/docs/intro), [Tesseract.js](https://github.com/naptha/tesseract.js/blob/master/docs/api.md), [API Open Food Facts](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorial-off-api/).

## Bares e historial

El nombre del bar es opcional y se guarda automáticamente en la visita activa. Al cerrar la visita se copia al ticket del historial y el campo se vacía para la siguiente. Los tickets antiguos sin bar siguen disponibles. Cada ticket cerrado incluye un botón «Borrar» con confirmación; elimina únicamente ese ticket y conserva la visita activa.

En «Mi foto» hay dos entradas: «Hacer un selfie» solicita captura de imagen con preferencia por la cámara frontal (`capture="user"`), y «Elegir del carrete» abre el selector de imágenes sin forzar captura. El selector y la cámara concreta dependen del móvil y navegador; en escritorio puede abrirse un selector de archivos. Ambas opciones utilizan el mismo recorte y guardado local.

## Entrada rápida y correcciones

«Añadir cerveza» registra directamente una cerveza genérica a 0 € si no hay una seleccionada. Todos los campos del formulario son opcionales: marca vacía se guarda como «Cerveza», precio vacío como cero y volumen/calorías vacíos como desconocidos. «Editar» en cada línea del ticket corrige solo esa cerveza, conserva su hora y recalcula los totales. Las nuevas visitas cerradas guardan sus líneas y permiten editarlas desde «Visitas». Los resúmenes antiguos no contenían líneas y siguen mostrándose como tales. La pantalla principal usa un diseño compacto y se adapta también a pantallas de poca altura, manteniendo controles táctiles de al menos 44 px.

## Icono y reapertura

Incluye una jarra de cerveza como favicon, icono de inicio iOS y en el manifiesto web para Android. Al volver a abrir desde la misma dirección y navegador se recuperan la visita en curso, el bar, las cervezas y la última pantalla. Cada cambio se guarda inmediatamente en localStorage, sin depender del evento de cierre. Solo «Cerrar visita» archiva la visita. El almacenamiento pertenece a ese navegador: borrar sus datos o usar navegación privada puede eliminarlo; no hay sincronización entre dispositivos.

## Consistencia de cuenta y ticket

La tarjeta principal representa la última cerveza anotada. «Editar última» corrige esa misma línea del ticket; «Otra igual» copia su marca, formato, volumen y precio ya corregidos. «Otra cerveza · escanear o escribir» añade una distinta y conserva las anteriores. Al deshacer se vuelve a mostrar la última que quede. El contador y el ticket comparten el mismo cálculo de unidades, importe, volumen y calorías. Las nuevas pruebas cubren los errores de edición desde la pantalla principal y repetición de datos antiguos tras corregir un ticket.

## Actualizaciones

`updates.js` comprueba el HTML publicado sin caché al abrir o volver a la app (máximo una comprobación por minuto). Una versión distinta muestra «Actualizar»; no recarga mientras el usuario está trabajando. «Mi foto → Buscar actualización» permite comprobar manualmente. La recarga usa la misma dirección con un parámetro nuevo y conserva localStorage. Cada publicación debe cambiar `app-version` en `index.html`, además de las versiones de los archivos modificados. Las instalaciones anteriores necesitan cargar esta versión una vez para disponer del detector; publicar no cambia una página antigua que siga abierta.

## Cierre seguro y Netlify

Cerrar un ticket escribe de forma atómica el historial completo y la nueva visita vacía en localStorage. Solo después de confirmar la escritura se limpia la pantalla y se abre Visitas. Si el dispositivo rechaza la escritura, el ticket sigue abierto y aparece un aviso para reintentar. Se conserva la clave anterior y los tickets existentes. Las pruebas cubren reapertura, conservación de todas las líneas, fallo de almacenamiento y reintento sin duplicados.

Los tickets pertenecen al dispositivo, navegador y origen web que los guardó. Cambiar de GitHub Pages a Netlify no traslada automáticamente los datos. Borrar datos del navegador o usar una sesión privada puede eliminarlos. No se envían los tickets al alojamiento.

Netlify usa `netlify.toml` y `node scripts/build-site.cjs` para publicar únicamente los recursos de la app en `dist/`, sin fuentes originales, pruebas ni archivos locales. El HTML se revalida para facilitar actualizaciones.

Publicación inicial en Netlify: proyecto `cuantas-van` del equipo `elregistro1973`, despliegue `6b03f660a4fe4f7782617890`, mediante carga manual del paquete estático del commit `c8c26c2`. El sitio no está conectado todavía a despliegues automáticos de GitHub. Actualizar este mismo proyecto conserva el origen y permite seguir recuperando los datos locales.
