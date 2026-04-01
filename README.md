# Web Dashboard MVP

Статическая веб-витрина для управленческого отчёта.

## Что умеет
- Загружает CSV или JSON из Google Sheets/Apps Script endpoint
- Показывает KPI по period_type
- Показывает таблицу по менеджерам
- Есть фильтр по периоду и менеджеру

## Как использовать
1. Опубликовать источник `REPORT_DASHBOARD` как CSV или JSON.
2. Открыть `index.html` локально или задеплоить папку на GitHub Pages / Netlify / Vercel.
3. Вставить URL источника данных в поле `Источник данных`.
4. Нажать `Загрузить`.

## Ожидаемые поля источника
- manager_name
- period_type
- period_label
- plan_amount
- fact_payments
- plan_percent
- new_deals_count
- new_deals_amount
- active_deals_count
- active_pipeline_amount
- won_count
- won_amount
- lost_count
- lost_amount

## Деплой на GitHub Pages
- Создать репозиторий
- Загрузить содержимое папки `web-dashboard`
- Включить GitHub Pages для ветки main / root
