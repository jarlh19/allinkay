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
