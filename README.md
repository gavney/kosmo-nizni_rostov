# Polar Mesh

Веб-сервис проектирования устойчивой спутниковой группировки для КосмоХакатона 2026.

Пользователь загружает сценарий `cosmo-A-1.0`, выбирает очередь запуска, меняет RAAN и фазирование, задаёт отказы и смотрит, есть ли сквозной маршрут `клиент → спутники → шлюз` на суточной сетке 120 с. Цель — доступность не ниже 90% на каждом северном пункте.

## Запуск для жюри

Docker (нужен запущенный Docker Desktop):

```bash
docker compose up --build
```

Откройте http://localhost:8080

Локально без Docker (два терминала):

```bash
python -m pip install -r backend/requirements.txt
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

```bash
cd frontend
npm install
npm run dev
```

Откройте http://localhost:5173

Тесты:

```bash
python -m pytest backend/tests -q
```

## Демонстрационный сценарий

1. Открыть сервис — загружается `01_full_constellation.json`, на глобусе видна сеть.
2. Прокрутить шкалу времени, включить «Пуск»: день/ночь и маршрут до `G_MUR` обновляются.
3. Project → очередь 1 и сравнить доступность с полной группировкой (или загрузить `02_first_launch`).
4. Satellite → выбрать спутник текущего маршрута, задать отказ с 21600 с, пересчитать.
5. Сохранить два варианта и открыть Compare. Выгрузить JSON результата (`cosmo-A-result-1.0`).

Дополнительный файл того же формата можно загрузить в Project. Некорректный JSON покажет ошибку поля/схемы.

## API

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/health` | живость |
| GET | `/api/fixtures` | сценарии кейса |
| POST | `/api/scenarios/validate` | проверка входа |
| POST | `/api/simulate` | сутки: метрики и ряды |
| POST | `/api/snapshot` | сеть и маршруты в момент `t` |
| POST | `/api/export` | `cosmo-A-result-1.0` |
| POST | `/api/variants` | сохранить вариант |
| POST | `/api/compare` | сравнение двух сценариев |
| POST | `/api/scenarios/launch-stage` | очередь запуска |
| POST | `/api/scenarios/plane` | RAAN / phase |
| POST | `/api/scenarios/failure` | отказ аппарата |
| POST | `/api/scenarios/gateway-outage` | отказ шлюза |

Маршрутизация: `mode=bfs` (минимум hops) или `mode=dijkstra` (минимум км). Наземные пункты не ретранслируют.

Причины перерыва: нет видимого спутника, разрыв ISL, нет контакта со шлюзом, шлюз недоступен.

## Стек

- Расчёты: Python 3.12, FastAPI, NumPy, `geometry.py` организаторов
- UI: React 19, Vite, Three.js / React Three Fiber
- Деплой: Docker Compose, nginx → FastAPI

## Репозиторий

```
backend/app     расчёт, маршруты, варианты
backend/tests   pytest по фикстурам кейса
fixtures        01–04 JSON
frontend        консоль Polar Mesh
```
