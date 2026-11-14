# Spec: ALLINKAY — monitoreo de salud a bordo

> Borrador del 14 de noviembre de 2026. Antes de hacer público el repositorio, este documento y todo el repo pasan al inglés (regla de NASA Space Apps: todo lo enlazado va en inglés).

## Objetivo

Una aplicación que el astronauta usa a bordo, sin depender de la Tierra, para entender a tiempo cómo los cambios en su salud afectan su rendimiento y qué hacer al respecto. Responde a la problemática del equipo (`problematica.md`) y al reto «Create Health Monitoring Software for Astronauts on Space Missions».

**Quién la usa:** un tripulante en una misión larga, en la nave o en campo (caminata o superficie). En la demo, «Tripulante 1».

**Qué la hace distinta:**
- Compara cada señal con **el normal de la persona**, no con un rango general.
- Detecta **patrones combinados** entre sistemas.
- **Pronostica** con horizonte.
- Incluye la **radiación**: dosis, tormenta solar y órganos en riesgo.
- **Funciona sin la Tierra.** La respuesta de la Tierra llega con demora y se integra cuando llega.

**Criterios de aceptación (historias del astronauta):**
1. Veo en un panel el estado de mis sistemas (cardiovascular, neurológico, inmunológico, ambiente y radiación), actualizado en vivo.
2. Si una señal se aleja de mi normal, recibo una alerta temprana que dice qué señal, cuánto se alejó, por qué importa (con su fuente de la NASA) y qué rutina hacer.
3. Si varias señales se alejan a la vez, la alerta lo dice como un patrón combinado.
4. Veo un pronóstico de las próximas noches de sueño y en cuántos días llegaría al límite de radiación de carrera.
5. Ante una emergencia o una tormenta solar, la app me da una guía de acción paso a paso, sin esperar a la Tierra.
6. Puedo pasar del modo «en la nave» al modo «en campo». En campo, el modelo es más liviano.
7. El feedback de la Tierra aparece cuando llega, con la demora visible, y el modelo lo integra.
8. Si algo falla o no se entiende, lo reporto desde la misma app con «Reportar un problema».

## Mapa de módulos (monolito modular, arquitectura hexagonal)

| Id | Responsabilidad | Depende de |
|---|---|---|
| `domain` | Núcleo puro, sin entrada ni salida: tipos de lectura, línea base personal, desviación, patrón combinado, pronóstico, reglas de alerta explicables y dosis de radiación | — |
| `storage` | Guardar lecturas, línea base y alertas (SQLite, patrón Repository) | `domain` |
| `ingestion` | Adaptadores de entrada: simulador con semilla, cargador del hemograma OSD-569 y, más adelante, el sensor real (USB o Bluetooth) | `domain` |
| `earth-link` | Simulador de la Tierra: guarda y reenvía con una demora configurable | `domain` |
| `feedback` | Reportes de las testers dentro de la app: formulario, contexto (pantalla, escenario y hora) y exportación para convertirlos en issues | `domain`, `storage` |
| `api` | FastAPI: REST para consultar y WebSocket para lo en vivo; arma los casos de uso | `domain`, `storage`, `ingestion`, `earth-link`, `feedback` |
| `web` | React: el panel de la maqueta, la figura humana, el modelo, la radiación y las acciones, con textos en inglés y español | `api` |

Orden de construcción: `domain` → `storage` → `ingestion` (simulador) → `api` → `web` → `earth-link` → `feedback`.

**Patrones:**
- Adapter: un adaptador por fuente de datos.
- Strategy: detectores y pronosticadores intercambiables (modelo liviano y modelo completo).
- Observer, con un bus de eventos interno: lectura → evaluación → alerta → pantalla.
- Repository: para guardar los datos.
- Reglas tipo Specification: cada regla devuelve su explicación.

## Stack

- **Backend:** Python 3.12 o 3.13, FastAPI, Pydantic 2, NumPy, scikit-learn (Isolation Forest para el modelo completo), SQLite (módulo estándar `sqlite3`), Uvicorn. Versiones fijas en `backend/requirements.lock` (producción) y `backend/requirements-dev.lock` (desarrollo). Pruebas de API con httpx2, el cliente que recomienda Starlette.
- **Frontend:** React 19, Vite, TypeScript estricto, ECharts 5.5.1 (copia local, ya verificada), fuentes IBM Plex locales. `package-lock.json` en el repo.
- **Calidad:** Ruff (lint y formato), pytest, ESLint, Vitest y Testing Library, gitleaks. CI en GitHub Actions (`.github/workflows/ci.yml`) que corre `scripts/verify.py` y `npm audit`, con las acciones fijadas por hash.

## Comandos

```
Backend, preparar:  python -m venv backend/.venv
                    backend/.venv/Scripts/python -m pip install -r backend/requirements-dev.lock
                    (requirements.lock = solo producción; requirements-dev.lock = producción + pruebas y lint)
Backend, correr:    backend/.venv/Scripts/python -m uvicorn app.main:create_app --factory --app-dir backend --port 8000
Backend, lint:      backend/.venv/Scripts/python -m ruff check backend
Backend, pruebas:   backend/.venv/Scripts/python -m pytest backend/tests -q
Frontend:           npm ci --prefix frontend
                    npm run dev --prefix frontend
                    npm run lint --prefix frontend
                    npm test --prefix frontend -- --run
                    npm run build --prefix frontend
Todo junto:         python scripts/verify.py      (lint, pruebas, build y gitleaks)
Demo sin internet:  python scripts/demo.py        (levanta backend y frontend con el simulador)
```

## Estructura del proyecto

```
backend/app/domain/        → lógica pura: baseline.py, deviation.py, patterns.py, forecast.py, rules.py, radiation.py
backend/app/application/   → casos de uso: ingerir lectura, evaluar, pronosticar, recibir feedback
backend/app/ports/         → interfaces (Protocol): ReadingSource, ReadingRepository, EarthLink, Clock
backend/app/adapters/      → simulator.py, osdr_csv.py, sqlite_repo.py, earth_link_sim.py (y luego serial o ble)
backend/app/api/           → rutas FastAPI y WebSocket, esquemas Pydantic
backend/tests/             → pruebas unitarias del dominio y de la API
frontend/src/features/     → panel, figura, modelo, radiación, acciones
frontend/src/i18n/         → textos en inglés y español
frontend/src/api/          → cliente REST y WebSocket
data/osdr/                 → CSV de OSD-569, con su fuente y su licencia en un README
docs/decisiones.md         → decisiones de arquitectura (D-001 a D-008)
scripts/                   → verify.py y demo.py
.github/ISSUE_TEMPLATE/    → plantillas «error» y «mejora» para convertir los reportes de las testers en issues
LICENSE, NOTICE            → Apache 2.0 y créditos, incluida la cita de los datos de la NASA
```

## Estilo de código

- **Dominio:** sin importar FastAPI, SQLite ni nada de entrada o salida. Tipos inmutables y funciones puras:

```python
@dataclass(frozen=True)
class Deviation:
    signal: Signal
    value: float
    baseline_mean: float
    z_score: float

    @property
    def outside_normal(self) -> bool:
        return abs(self.z_score) >= Z_THRESHOLD
```

- **Alertas:** toda alerta lleva qué detectó, con qué dato, contra qué normal, por qué importa (con su fuente de la NASA) y qué hacer.
- **Errores:** nada de `except` vacío ni valores por defecto que oculten una falla. Una lectura inválida se rechaza con un error claro y queda registrada.
- **Nombres y textos:** el código, los commits y los identificadores van en inglés. Los textos de la pantalla se toman de `i18n`.
- **Frontend:** TypeScript estricto, sin `any`, sin `innerHTML` con datos de afuera. Los colores de estado (verde, ámbar y rojo) van siempre con ícono y texto.

## Estrategia de pruebas

- **Dominio con pytest**, que es lo más importante: línea base, puntaje z, umbral de ±1.5, patrón combinado, pronóstico con una serie conocida, proyección de dosis (256 mSv a 1.8 mSv por día dan 191 días) y el límite de 250 mSv por evento.
- **API con el TestClient de FastAPI:** las rutas y el WebSocket con el simulador con semilla.
- **Web con Vitest y Testing Library:** los estados del panel (bien, atención, emergencia) y el cambio de idioma.
- **Escenario de demo reproducible:** la misión acelerada con semilla fija produce primero la alerta temprana y luego la emergencia. Lo verifica una prueba.
- **Todo bug encontrado por las testers se reproduce primero con una prueba que falla.**

## Límites

- **Siempre:**
  - Correr `python scripts/verify.py` antes de cada commit, y gitleaks antes de cada push.
  - Usar solo datos simulados o abiertos de la NASA.
  - Que cada alerta se explique.
  - Validar las entradas.
- **Preguntar primero:**
  - Agregar dependencias.
  - Hacer público el repositorio.
  - Agregar colaboradores.
  - Desplegar en la nube.
  - Cambiar el CI.
- **Nunca:**
  - Subir secretos (`.env`) ni datos de personas reales.
  - Borrar una prueba que falla sin aprobación.
  - Hacer push sin que Jorge lo pida.
  - Mencionar IA en archivos, commits o PRs.
  - Presentar una alerta como diagnóstico.

## Criterios de éxito

1. En un clon limpio, `python scripts/verify.py` pasa completo.
2. Con la red apagada, `python scripts/demo.py` levanta la app y el panel se actualiza en vivo cada segundo con el simulador.
3. Con una línea base y lecturas de prueba, el modelo marca las señales fuera de ±1.5 desviaciones estándar. Si dos o más sistemas se desvían a la vez, aparece el patrón combinado. Cada alerta muestra la señal, el valor, su normal, la razón y la fuente.
4. El pronóstico de sueño a 3 noches y la proyección de días hasta 600 mSv coinciden con los cálculos de las pruebas.
5. Una tormenta solar simulada dispara el camino de emergencia con la guía de acción.
6. El feedback de la Tierra llega con la demora configurada y la pantalla muestra cuánto falta.
7. El escenario de demo (misión acelerada con semilla) es repetible: muestra primero la alerta temprana y luego la emergencia.
8. La interfaz carga en inglés y cambia a español.
9. La línea base de glóbulos blancos sale del CSV de OSD-569, con la cita visible en la pantalla.
10. La app está publicada en una URL de Render y se actualiza sola con cada cambio en `main` (D-009).
11. Geraldine y Aranza, usando la app como astronautas desde su navegador, pueden enviar un reporte con «Reportar un problema». El reporte queda guardado con su contexto y se puede exportar para crear el issue.

## Fuera de alcance

- **Diagnóstico médico real:** es apoyo a la decisión.
- **Login, cuentas y varios tripulantes a la vez.**
- **App móvil.** La web publicada funciona en el navegador del celular.
- **Datos de personas reales.** Los datos de Aranza solo sirven para calibrar rangos, sin guardarse en el repo.
- **Sensores reales.** Se trabaja con datos sintéticos (D-005). La interfaz del adaptador queda lista para cuando Aranza confirme.
- **Acceso de las testers al repositorio.** Prueban como usuarias externas (D-006).
- **Una app para el lado de la Tierra:** es un simulador.
- **El protocolo DTN real:** se simula la demora.
- **Mecánica orbital:** las demoras son configurables, no se calculan.

## Decisiones

En `docs/decisiones.md`:
- D-001: monolito modular hexagonal.
- D-002: Python con FastAPI y React con TypeScript.
- D-003: repositorio privado hasta la entrega.
- D-004: Marte.
- D-005: datos sintéticos.
- D-006: testers como usuarias externas con reporte dentro de la app.
- D-007: licencia Apache 2.0.
- D-008: idioma.
- D-009: publicación en Render como un solo servicio.

## Preguntas abiertas

1. **Los sensores de Aranza:** cuáles son y cómo se conectan. Cuando ella confirme, se agrega su adaptador sin tocar el dominio.
2. **Cuenta de Render:** Jorge la crea entrando con GitHub y le da acceso solo al repositorio `allinkay` (D-009).
