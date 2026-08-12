# Apex Health — build and Google Sheets handoff

## Product brief

Build **Apex Health**, a private F1-inspired wellness dashboard. It tracks daily food/macros, a short exercise run sheet with completion ticks, and bodyweight. The tone is a focused race-engineer pit wall: dark neutral surfaces, white telemetry, and one racing-red accent. It is for a single person, not a shared client product.

## Roles

### GPT-5.6 Luna — Google Sheets/data tasks

- [ ] Import the supplied `Apex-Health-Tracker.xlsx` into Google Sheets, retaining its tab names and formulas.
- [ ] Share/configure the sheet for the owner only, and record the spreadsheet ID.
- [ ] Keep these four tabs as the source of truth: `Daily Log`, `Exercise Plan`, `Weight Log`, and `Settings`.
- [ ] Add a Google Apps Script web-app API with `GET` (`action=dashboard`) and `POST` (`action=meal`, `action=exercise`, `action=weight`) handlers. Validate a private shared secret in the request body before writing.
- [ ] Return JSON with CORS headers and ISO-8601 dates. Never expose the sheet publicly without the secret.
- [ ] Give Terra the deployed web-app URL, the expected request/response JSON, and a test secret through a private channel — never commit the secret to the repository.
- [ ] Test three writes: a meal, a checked exercise, and a weight reading; then verify that dashboard totals change.

### GPT-5.6 Terra — website tasks

- [x] Build the F1/cockpit visual foundation and responsive personal dashboard.
- [x] Implement local interactive logging for meals, exercise completion, and weight telemetry.
- [ ] Replace local storage in `app.js` with a small `dataClient` that calls Luna’s Apps Script endpoint. Keep local storage as an offline fallback.
- [ ] Add a `config.js` ignored by Git for `API_URL` and `API_SECRET`; provide `config.example.js` with empty values.
- [ ] On page load, hydrate totals, today’s exercises and the 7-day weight trace from `GET ?action=dashboard`.
- [ ] Add inline loading/error states to sync controls; do not lose an entry if the network call fails.
- [ ] Verify mobile layout, keyboard controls and a complete read/write round-trip against the live sheet.

## Sheet contract

| Tab | Columns / purpose |
| --- | --- |
| `Daily Log` | Date, Meal, Calories, Protein (g), Carbs (g), Fats (g), Notes. One row per entry. |
| `Exercise Plan` | Day, Exercise, Prescription, Type, Completed, Completed At. One row per prescribed exercise. |
| `Weight Log` | Date, Weight (kg), Notes. One row per weigh-in. |
| `Settings` | Nutrition targets (calories 2,300; protein 150g; carbs 250g; fats 70g) plus an editable exercise template. |

## Example API payloads

```json
{ "action":"meal", "secret":"PRIVATE", "meal":"Greek yogurt", "calories":180, "protein":18, "carbs":12, "fats":5, "date":"2026-08-10" }
```

```json
{ "action":"exercise", "secret":"PRIVATE", "exercise":"Upper body strength", "completed":true, "date":"2026-08-10" }
```

```json
{ "action":"weight", "secret":"PRIVATE", "weight":74.2, "date":"2026-08-10" }
```

## Done when

- A food entry updates calorie/macros on the website and `Daily Log`.
- An exercise toggle persists into `Exercise Plan` for the date.
- A weight entry renders in the seven-day trace and appears in `Weight Log`.
- Changing targets or exercises in the Sheet updates the next website load.
