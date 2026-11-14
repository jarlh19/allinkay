# Decisiones

Cada entrada dice el problema, lo elegido, las alternativas descartadas y por qué. Las decidió Jorge Laban el 14 de noviembre de 2026.

## D-001 · Monolito modular con arquitectura hexagonal

- **Problema:** la app recibe datos de varias fuentes (sensores de campo, sensores de la nave, análisis de sangre, dosímetro y feedback de la Tierra) y debe funcionar a bordo sin internet.
- **Elegido:** un solo despliegue con un núcleo de dominio puro y un adaptador por fuente de datos (puertos y adaptadores), unidos por un bus de eventos interno.
- **Descartado:** microservicios, uno por componente.
- **Por qué:** recibir datos de varias fuentes es un problema de integración, no de despliegue. En 16 horas, con un solo desarrollador, los microservicios suman procesos, red, contratos y puntos de falla para la demo. Con los módulos separados por puertos, se pueden dividir más adelante si hace falta.

## D-002 · Python con FastAPI en el backend y React con Vite y TypeScript en el frontend

- **Problema:** el modelo (desviaciones, patrón combinado y pronóstico) es el centro del proyecto y la interfaz pesa en el juzgamiento.
- **Elegido:** FastAPI con NumPy y scikit-learn en el backend; React 19, Vite, TypeScript estricto y ECharts en el frontend.
- **Descartado:** todo en TypeScript, porque el machine learning es más limitado; y Python con Streamlit, porque da menos control del diseño del panel.
- **Por qué:** Python tiene las mejores librerías para el modelo, y React permite reproducir la maqueta del panel aprobada por el equipo.

## D-003 · Repositorio privado en la cuenta jarlh19 hasta la entrega

- **Problema:** la NASA exige un enlace público al proyecto al entregar, pero durante el desarrollo el repo puede exponer trabajo a medio hacer.
- **Elegido:** privado en jarlh19 y público antes del envío del domingo 15 de noviembre.
- **Descartado:** público desde el primer commit, y una organización del equipo.
- **Por qué:** protege el trabajo mientras se desarrolla y no depende de crear una organización en pleno evento.

## D-004 · Marte como escenario de la misión

- **Problema:** las cifras de demora y de radiación cambian mucho entre la Luna y Marte.
- **Elegido:** Marte. Demora de 0 a 22 minutos por trayecto (McBrayer et al., 2022), 1.8 mSv por día en el viaje (Zeitlin et al., 2013) y límite de carrera de 600 mSv (NASA-STD-3001).
- **Descartado:** la Luna, con 1.3 segundos de demora.
- **Por qué:** en Marte la autonomía a bordo es indispensable, y eso sostiene la problemática del equipo.

## D-005 · Datos sintéticos; el sensor real queda fuera de esta versión

- **Problema:** todavía no se sabe qué sensores tiene Aranza ni cómo se conectan.
- **Elegido:** un simulador con semilla fija, calibrado con rangos de referencia. El único dato real es el hemograma abierto de la NASA (OSD-569), usado como línea base. La interfaz del adaptador de sensores queda lista.
- **Descartado:** esperar los sensores para empezar.
- **Por qué:** el equipo confirmó que se puede trabajar con datos sintéticos, la demo no depende del hardware y no se tratan datos de personas reales.

## D-006 · Las testers prueban como usuarias externas y reportan dentro de la app

- **Problema:** Geraldine y Aranza revisan la app y piden correcciones, pero lo hacen como si fueran astronautas, no como colaboradoras del repositorio.
- **Elegido:** prueban la app en uso, sin acceso al repo, y reportan con un formulario «Reportar un problema» dentro de la app. El reporte guarda el contexto (pantalla, escenario y hora) en la base local. Jorge convierte cada reporte en un issue.
- **Descartado:** agregarlas como colaboradoras de GitHub.
- **Por qué:** así prueban como el usuario final, el repo sigue privado y cada reporte llega con el contexto necesario para reproducirlo.

## D-007 · Licencia Apache 2.0

- **Problema:** en Hack the Andes el código quedó sin licencia y después hubo dudas sobre una «patente».
- **Elegido:** Apache 2.0, con un archivo NOTICE que da el crédito y cita los datos de la NASA.
- **Descartado:** MIT y dejarlo sin licencia.
- **Por qué:** es abierta como MIT, pero además incluye una cesión explícita de patentes. Eso evita disputas sobre patentes como la de RoboLab.

## D-008 · Idioma

- **Problema:** NASA Space Apps exige inglés en la página del proyecto y en todo lo enlazado, pero las testers prueban en español.
- **Elegido:** el código, los identificadores, los commits y el README van en inglés. La interfaz carga en inglés y se puede cambiar a español. Los documentos de trabajo en español (SPEC y decisiones) pasan al inglés antes de hacer público el repo.
- **Descartado:** todo en español, y traducir la interfaz solo al final.
- **Por qué:** cumple la regla sin dejar a las testers sin una interfaz en su idioma.

## D-009 · Publicar la app en Render como un solo servicio

- **Problema:** las testers prueban la app desde su propio navegador, no en la laptop de Jorge.
- **Elegido:** un solo servicio web en Render (plan gratis) con una imagen Docker: el frontend compilado lo sirve el mismo FastAPI. Se despliega solo con cada cambio en `main`.
- **Descartado:**
  - Hugging Face Spaces: el código del Space queda público antes de tiempo.
  - Frontend y backend en servicios separados: dos despliegues y CORS.
  - Solo en la laptop: las testers no podrían usarla desde sus navegadores.
- **Por qué:** cuesta USD 0 y admite WebSocket. Un solo servicio simplifica la demo y la seguridad (mismo origen, sin CORS).
- **Límites del plan gratis:**
  - Se duerme tras 15 minutos sin tráfico; la primera visita tarda unos 30 a 60 segundos.
  - El disco no es persistente: los datos guardados se pierden al reiniciar. Por eso los reportes de las testers no pueden depender solo de SQLite.
- **Cambio sobre D-006:** las testers usan la URL publicada en vez de la laptop.

## D-010 · Varios tripulantes: una misión por persona

- **Problema:** con un solo tripulante, quien estaba en la nave y quien salía a campo compartían el mismo normal, las mismas alertas y el mismo modo. Además, todas las personas que abrían la web cambiaban el modo de todas.
- **Elegido:**
  - Un registro de la tripulación (`Crew`). Cada persona tiene su propia misión: sus lecturas, su normal, su modelo (nave o campo), su dosis acumulada y su canal en vivo.
  - Las rutas llevan el id de la persona: `/api/crew/{id}/…` y `/ws/crew/{id}/live`. Además, `/api/crew` da el resumen de todas.
  - La tabla de lecturas suma una columna `crew`, como cambio aditivo. Las filas anteriores pasan al comandante.
  - En la demo, cada vuelta del guion repite exactamente la primera. Así, lo que ven las testers es lo mismo que se comprobó en las pruebas.
  - El reloj de la demo avanza un paso exacto por tick, sin depender del tiempo real del servidor. Sin eso, una demora de milisegundos corría la secuencia simulada y aparecían alertas por ruido que las pruebas no veían.
- **Descartado:**
  - Un solo canal con eventos etiquetados por persona: cada navegador recibiría las lecturas de todos, el triple de datos por una conexión lenta.
  - Varios procesos, uno por persona: complica Render (D-009) sin ganar nada en la demo.
- **Por qué:** cada persona se evalúa contra su propio normal, que es la idea central del proyecto. Cambiar el modo de una no toca a las demás. El navegador solo recibe a quien está mirando.

## D-011 · Alertas confirmadas: cuántas falsas alarmas y cuántos cambios sin detectar

- **Problema:** la medición del 14 de noviembre mostró que, en la nave, 40 de 40 personas sanas simuladas tenían al menos una falsa alarma en 30 días. Venían de los exámenes y de las señales diarias. Las causas fueron tres:
  - Un solo examen fuera de rango bastaba para alertar, y el simulador usaba menos variación que la real.
  - El normal salía de 14 días y 3 análisis, pero se usaba como si fuera exacto.
  - El ánimo, una escala del 1 al 5, se trataba como una medida continua.
- **Lo que no se puede:** con datos finitos no existen a la vez cero falsas alarmas y cero cambios sin detectar. Al bajar uno sube el otro, y lo único que baja los dos es más información. Se midió con 200 000 personas simuladas.
- **Elegido por Jorge:** primero pidió priorizar que no se escaparan cambios reales. Con los números medidos en la app real eligió el umbral del 99.5 % para los exámenes, que da la mitad de falsas alarmas que el del 99 % a cambio de 1 baja de glóbulos blancos más cada 200 que tarda más de 10 días en detectarse. Las metas quedan así:
  - Como máximo 1 falsa alarma cada 10 años-astronauta.
  - Como máximo el 1 % de los cambios del guion sin detectar en los primeros 10 días. Un cambio que sigue se detecta en las lecturas siguientes.
- **Cómo:**
  - **Exámenes:**
    - El punto de ajuste es la media de 6 tomas antes del vuelo.
    - La dispersión es la variación biológica dentro de la persona más la variación analítica, ambas publicadas: EFLM Biological Variation Database, leucocitos CVI 11.1 % y glucosa CVI 4.9 %, con CVA = CVI / 2 (Fraser).
    - Un resultado más allá del valor de cambio de referencia al 99.5 % (2.81) pide repetir el examen al día siguiente. Solo alerta si la repetición lo confirma, y nunca alerta por un solo resultado.
    - El comandante usa las 3 tomas reales de OSD-569.
  - **Normal personal:**
    - Se juzga con un intervalo de predicción, que combina la t de Student con el factor 1 + 1/n.
    - La referencia es de 60 días antes del vuelo.
    - Con menos de 5 lecturas no hay alerta.
  - **Señales diarias:** alertan cuando 3 de los últimos 4 días pasan de 2.2. Un día común en medio de un cambio real ya no reinicia la cuenta.
  - **Señales continuas:** se mantiene la regla de 10 lecturas seguidas pasando de 1.5. Ya daba cero falsas alarmas.
  - **Ánimo:** el valor habitual es la mediana y cuentan pasos enteros. Alerta cuando el ánimo está 2 pasos por debajo en 3 de los últimos 4 días.
  - **Simulador y guion:**
    - Los exámenes varían como indica la EFLM.
    - Los cambios del guion del comandante son clínicamente significativos: glóbulos blancos −3.5 y ánimo −2.2.
    - En la demo hay exámenes cada 2 días.
- **Descartado:**
  - Solo subir los umbrales: bajaba las falsas alarmas, pero dejaba escapar cambios reales (12 de 60 en reacción).
  - CUSUM: no corregía un normal mal estimado.
  - Exigir días seguidos: un solo día normal cortaba un cambio real.
  - Dos repeticiones o el promedio del examen y su repetición: el error que comparten todas las tomas es el del normal, y repetir no lo quita.
- **Verificación:** `backend/validate_model.py` simula 200 personas sanas durante 90 días, en la nave y en campo, y 200 personas por cada guion de la tripulación. Mide la tasa de falsas alarmas por año-astronauta y la de cambios sin detectar, y falla si no se cumplen las metas. Una muestra menor corre en cada cambio, en `tests/validation`.
- **Resultado medido** (200 personas durante 90 días):
  - En la nave: 6 falsas alarmas en 60 años-astronauta, es decir, 1 cada 10 años. Cuatro son de exámenes y dos de señales diarias.
  - En campo: 0.
  - Cambios del guion sin detectar en 10 días: 5 de 1200 (0.42 %). Tres son bajas de glóbulos blancos.
  - Con el umbral del 99 % eran 11 falsas alarmas en la nave y 4 cambios sin detectar.
  - Con 200 personas, los conteos chicos tienen un margen de error amplio.
- **Límite:** los números salen de personas simuladas con ruido normal. Los datos reales traen valores atípicos y tendencias que esta prueba no cubre, así que antes de usarlo con personas hay que validarlo con datos reales.
