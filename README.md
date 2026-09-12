# Polar Mesh

**Команда:** Ростов

**Презентация:** —

**Деплой:** —

## Стек

- **Backend:** Python, FastAPI, Uvicorn, NumPy
- **Frontend:** React, TypeScript, Vite
- **3D:** Three.js, React Three Fiber, Drei
- **Инфра:** Docker, nginx

## Библиотеки

**Backend:** `fastapi`, `uvicorn`, `numpy`, `httpx`, `pytest`

**Frontend:** `react`, `react-dom`, `@react-three/fiber`, `@react-three/drei`, `three`, `vite`, `typescript`

## API

| Метод | Путь | Назначение |
| --- | --- | --- |
| `GET` | `/api/health` | здоровье сервиса |
| `GET` | `/api/fixtures` | список сценариев |
| `GET` | `/api/fixtures/{id}` | сценарий по id |
| `POST` | `/api/scenarios/validate` | валидация сценария |
| `POST` | `/api/snapshot` | снимок сети на момент `t` |
| `POST` | `/api/route` | маршрут клиента |
| `POST` | `/api/simulate` | полный расчёт на сетке |
| `GET` | `/api/simulate/{sim_id}` | сохранённый расчёт |
| `POST` | `/api/export` | выгрузка `cosmo-A-result-1.0` |
| `GET` | `/api/export/{sim_id}` | выгрузка по sim_id |
| `POST` | `/api/scenarios/launch-stage` | очередь запуска 1–3 |
| `POST` | `/api/scenarios/plane` | RAAN / фаза плоскости |
| `POST` | `/api/scenarios/failure` | отказ КА |
| `POST` | `/api/scenarios/gateway-outage` | простой шлюза |
| `POST` | `/api/variants` | сохранить вариант |
| `GET` | `/api/variants` | список вариантов |
| `GET` | `/api/variants/{id}` | вариант |
| `DELETE` | `/api/variants/{id}` | удалить вариант |
| `POST` | `/api/compare` | сравнить два сценария |
| `POST` | `/api/compare/ids` | сравнить два варианта по id |
