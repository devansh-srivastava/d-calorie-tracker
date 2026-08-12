/* Local-first repository with an optional Google Sheets sync layer. */
(() => {
  'use strict';

  const STORAGE_KEY = 'apex-health-v2';
  const DEFAULT_SETTINGS = { calories: 2300, protein: 150, carbs: 250, fats: 70 };
  const PROGRAMME = [
    { name: 'Upper body strength', meta: '4 sets x 8-12 reps', type: 'STRENGTH' },
    { name: 'Zone 2 cardio', meta: '30 minutes / easy pace', type: 'CARDIO' },
    { name: 'Core circuit', meta: '3 rounds x 4 movements', type: 'STABILITY' },
    { name: 'Mobility reset', meta: '10 minutes / full body', type: 'RECOVERY' },
  ];
  const $ = (selector) => document.querySelector(selector);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  const dateFormat = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  const longDateFormat = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  function localDateKey(date) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }
  function dateFromKey(key) { return new Date(`${key}T12:00:00`); }
  function shiftDate(key, days) { const date = dateFromKey(key); date.setDate(date.getDate() + days); return localDateKey(date); }
  function validNumber(value, min, max) { return Number.isFinite(value) && value >= min && value <= max; }
  function text(value) { return typeof value === 'string' ? value.trim() : ''; }
  function makeInitialState() { return { version: 2, settings: { ...DEFAULT_SETTINGS }, days: {} }; }
  function normaliseMeal(meal) {
    if (!meal || !text(meal.name) || !validNumber(meal.calories, 0, 10000)) return null;
    return { id: text(meal.id) || crypto.randomUUID(), name: text(meal.name).slice(0, 60), calories: meal.calories, protein: validNumber(meal.protein, 0, 1000) ? meal.protein : 0, carbs: validNumber(meal.carbs, 0, 1000) ? meal.carbs : 0, fats: validNumber(meal.fats, 0, 1000) ? meal.fats : 0, createdAt: text(meal.createdAt) || new Date().toISOString() };
  }
  function normaliseState(candidate) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return makeInitialState();
    const settings = { ...DEFAULT_SETTINGS };
    Object.keys(settings).forEach((key) => { if (validNumber(candidate.settings?.[key], key === 'calories' ? 500 : 1, key === 'calories' ? 10000 : 1000)) settings[key] = candidate.settings[key]; });
    const days = {};
    if (candidate.days && typeof candidate.days === 'object' && !Array.isArray(candidate.days)) {
      Object.entries(candidate.days).forEach(([key, day]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !day || typeof day !== 'object') return;
        const meals = Array.isArray(day.meals) ? day.meals.map(normaliseMeal).filter(Boolean) : [];
        const exercises = {};
        if (day.exercises && typeof day.exercises === 'object') PROGRAMME.forEach((_, index) => { exercises[index] = Boolean(day.exercises[index]); });
        const weight = validNumber(day.weight, 25, 300) ? day.weight : null;
        if (meals.length || Object.values(exercises).some(Boolean) || weight !== null) days[key] = { meals, exercises, weight };
      });
    }
    return { version: 2, settings, days };
  }
  const LocalRepository = {
    load() {
      try { return normaliseState(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); }
      catch { return makeInitialState(); }
    },
    save(nextState) { localStorage.setItem(STORAGE_KEY, JSON.stringify(normaliseState(nextState))); },
  };

  const REMOTE = window.APEX_CONFIG || {};
  const hasRemote = Boolean(REMOTE.API_URL && REMOTE.API_SECRET);
  const RemoteRepository = {
    async dashboard() {
      const url = new URL(REMOTE.API_URL);
      url.searchParams.set('action', 'dashboard');
      url.searchParams.set('secret', REMOTE.API_SECRET);
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Dashboard request failed (${response.status}).`);
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error || 'Dashboard request failed.');
      return payload;
    },
    async write(body) {
      const response = await fetch(REMOTE.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, secret: REMOTE.API_SECRET }) });
      if (!response.ok) throw new Error(`Sync request failed (${response.status}).`);
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error || 'Sync request failed.');
      return payload;
    }
  };

  let state = LocalRepository.load();
  let selectedDate = localDateKey(new Date());
  let toastTimeout;
  function save() { LocalRepository.save(state); }
  function setConnection(mode, message) { const status = $('#connectionStatus'); status.innerHTML = `<i aria-hidden="true"></i> ${mode}`; $('#dataMode').innerHTML = `DATA MODE: ${message} <b aria-hidden="true"></b>`; }
  function applyDashboard(remote) {
    state.settings = { ...DEFAULT_SETTINGS, ...(remote.settings || {}) };
    const days = {};
    (remote.meals || []).forEach((meal) => { const day = days[meal.date] ||= { meals: [], exercises: {}, weight: null }; day.meals.push(normaliseMeal({ ...meal, createdAt: meal.createdAt || new Date().toISOString() })); });
    (remote.weights || []).forEach((reading) => { const day = days[reading.date] ||= { meals: [], exercises: {}, weight: null }; day.weight = Number(reading.value); });
    (remote.exercises || []).forEach((exercise) => { const date = exercise.date || selectedDate; const index = PROGRAMME.findIndex((item) => item.name === exercise.name); if (index >= 0) (days[date] ||= { meals: [], exercises: {}, weight: null }).exercises[index] = Boolean(exercise.completed); });
    Object.entries(state.days).forEach(([date, localDay]) => { if (!days[date]) days[date] = localDay; });
    state.days = days; save();
  }
  async function syncDashboard() {
    if (!hasRemote) return;
    setConnection('SYNCING', 'GOOGLE SHEETS');
    try { applyDashboard(await RemoteRepository.dashboard()); render(); setConnection('SHEET CONNECTED', 'GOOGLE SHEETS'); showToast('Sheet data synced.'); }
    catch (error) { setConnection('OFFLINE FALLBACK', 'THIS DEVICE'); showToast(error.message); }
  }
  async function syncWrite(body) {
    if (!hasRemote) return;
    try { const result = await RemoteRepository.write(body); if (result.dashboard) { applyDashboard(result.dashboard); render(); } setConnection('SHEET CONNECTED', 'GOOGLE SHEETS'); }
    catch (error) { setConnection('OFFLINE FALLBACK', 'THIS DEVICE'); showToast(`Saved locally; sheet sync failed: ${error.message}`); }
  }
  function dayFor(key = selectedDate, create = true) {
    if (!state.days[key] && create) state.days[key] = { meals: [], exercises: {}, weight: null };
    return state.days[key];
  }
  function allWeights() {
    return Object.entries(state.days).filter(([, day]) => validNumber(day.weight, 25, 300)).map(([date, day]) => ({ date, value: day.weight })).sort((a, b) => a.date.localeCompare(b.date));
  }
  function mealTotals(meals) { return meals.reduce((sum, meal) => ({ calories: sum.calories + meal.calories, protein: sum.protein + meal.protein, carbs: sum.carbs + meal.carbs, fats: sum.fats + meal.fats }), { calories: 0, protein: 0, carbs: 0, fats: 0 }); }
  function create(tag, className, content) { const node = document.createElement(tag); if (className) node.className = className; if (content !== undefined) node.textContent = content; return node; }
  function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('visible'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => toast.classList.remove('visible'), 2600); }
  function setError(selector, message) { $(selector).textContent = message; }
  function setMetric(id, value, target, suffix) {
    $(`#${id}`).childNodes[0].nodeValue = numberFormat.format(value);
    $(`#${id}Percent`).textContent = `${Math.round((value / target) * 100)}%`;
    $(`#${id}Meter`).style.width = `${clamp((value / target) * 100, 0, 100)}%`;
  }

  function renderDate() {
    const chosen = dateFromKey(selectedDate); const isToday = selectedDate === localDateKey(new Date());
    $('#todayLabel').textContent = dateFormat.format(chosen).toUpperCase();
    $('#selectedDateLabel').textContent = isToday ? 'Today' : dateFormat.format(chosen);
    $('#selectedDateLong').textContent = longDateFormat.format(chosen);
  }
  function renderFuel() {
    const day = dayFor(selectedDate, false) || { meals: [] }; const totals = mealTotals(day.meals || []); const settings = state.settings;
    const metrics = [['calorie', 'calories', settings.calories], ['protein', 'protein', settings.protein], ['carbs', 'carbs', settings.carbs], ['fats', 'fats', settings.fats]];
    $('#remaining').textContent = numberFormat.format(Math.max(0, settings.calories - totals.calories));
    $('#caloriePercent').textContent = `${Math.round((totals.calories / settings.calories) * 100)}%`;
    $('#calorieMeter').style.width = `${clamp((totals.calories / settings.calories) * 100, 0, 100)}%`;
    metrics.slice(1).forEach(([id, prop, target]) => setMetric(id, totals[prop], target));
    $('#calorieTargetLabel').textContent = `kcal / target ${numberFormat.format(settings.calories)}`;
    $('#proteinTargetLabel').textContent = `target ${settings.protein}g`; $('#carbsTargetLabel').textContent = `target ${settings.carbs}g`; $('#fatsTargetLabel').textContent = `target ${settings.fats}g`;
    $('#caloriesTotal').textContent = numberFormat.format(totals.calories); $('#calorieRaceTarget').textContent = `/ ${numberFormat.format(settings.calories)} kcal`;
    $('#mealCount').textContent = `${day.meals.length} ${day.meals.length === 1 ? 'entry' : 'entries'}`; $('#fuelStatus').textContent = day.meals.length ? `${day.meals.length} ENTR${day.meals.length === 1 ? 'Y' : 'IES'}` : 'NO ENTRIES';
    const list = $('#mealList'); list.replaceChildren();
    if (!day.meals.length) { list.append(create('p', 'empty-state', 'No fuel logged for this day. Add your first meal above.')); return; }
    day.meals.forEach((meal) => {
      const row = create('article', 'meal-row'); const copy = create('div'); copy.append(create('strong', '', meal.name), create('small', '', `${numberFormat.format(meal.protein)}P / ${numberFormat.format(meal.carbs)}C / ${numberFormat.format(meal.fats)}F`));
      const kcal = create('b', 'meal-calories', `${numberFormat.format(meal.calories)} kcal`); const remove = create('button', 'delete-button', 'Remove'); remove.type = 'button'; remove.setAttribute('aria-label', `Delete ${meal.name}`); remove.addEventListener('click', () => { dayFor().meals = dayFor().meals.filter((item) => item.id !== meal.id); save(); render(); showToast('Meal removed.'); }); row.append(copy, kcal, remove); list.append(row);
    });
  }
  function renderExercises() {
    const day = dayFor(selectedDate, false) || { exercises: {} }; const list = $('#exerciseList'); list.replaceChildren(); let completed = 0;
    PROGRAMME.forEach((exercise, index) => {
      const checked = Boolean(day.exercises?.[index]); if (checked) completed += 1;
      const item = create('article', `exercise${checked ? ' is-complete' : ''}`); const label = create('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.checked = checked; input.setAttribute('aria-label', `Mark ${exercise.name} complete`);
      input.addEventListener('change', () => { dayFor().exercises[index] = input.checked; save(); render(); showToast(input.checked ? `${exercise.name} complete.` : `${exercise.name} reopened.`); syncWrite({ action: 'exercise', exercise: exercise.name, completed: input.checked, date: selectedDate }); });
      label.append(input, create('span', 'check', ''), create('span', 'exercise-index', String(index + 1).padStart(2, '0')), create('span', 'exercise-name', exercise.name)); item.append(label, create('span', 'exercise-meta', exercise.meta), create('span', 'exercise-type', exercise.type)); list.append(item);
    });
    $('#trainingStatus').textContent = `${completed} / ${PROGRAMME.length} COMPLETE`; $('#workoutsTotal').textContent = String(completed); $('#workoutRaceTarget').textContent = `/ ${PROGRAMME.length} complete`;
    return completed;
  }
  function renderWeight() {
    const readings = allWeights(); const recent = readings.slice(-7); const current = readings.at(-1); const selected = dayFor(selectedDate, false)?.weight;
    const currentWeight = $('#currentWeight'); currentWeight.replaceChildren(document.createTextNode(current ? current.value.toFixed(1) : '--'), create('small', '', 'kg'));
    $('#weightNote').textContent = selected ? `Selected day: ${selected.toFixed(1)} kg.` : current ? `Latest reading: ${longDateFormat.format(dateFromKey(current.date))}.` : 'Log a weigh-in to start the trace.';
    const change = recent.length > 1 ? recent.at(-1).value - recent[0].value : null; $('#weightChange').textContent = change === null ? '--' : `${change > 0 ? '+' : ''}${change.toFixed(1)} KG / ${recent.length}D`;
    $('#chartStart').textContent = recent[0] ? longDateFormat.format(dateFromKey(recent[0].date)).toUpperCase() : 'EARLIER'; $('#chartEnd').textContent = current ? longDateFormat.format(dateFromKey(current.date)).toUpperCase() : 'LATEST'; renderChart(recent);
    const list = $('#weightList'); list.replaceChildren(); if (!readings.length) { list.append(create('p', 'empty-state', 'No bodyweight readings yet.')); return; }
    readings.slice(-6).reverse().forEach(({ date, value }) => { const row = create('div', 'weight-row'); row.append(create('span', '', longDateFormat.format(dateFromKey(date))), create('strong', '', `${value.toFixed(1)} kg`)); list.append(row); });
  }
  function renderChart(readings) {
    const svg = $('#weightChart'); svg.replaceChildren(); const add = (tag, attrs) => { const element = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, String(value))); svg.append(element); return element; };
    if (!readings.length) { const empty = add('text', { x: 320, y: 112, 'text-anchor': 'middle', class: 'chart-empty' }); empty.textContent = 'AWAITING TELEMETRY'; return; }
    [45, 105, 165].forEach((y) => add('line', { x1: 24, y1: y, x2: 616, y2: y, class: 'chart-grid' })); const values = readings.map(({ value }) => value); const min = Math.min(...values) - 0.3; const max = Math.max(...values) + 0.3; const points = values.map((value, index) => { const x = 24 + index * (592 / Math.max(values.length - 1, 1)); const y = 165 - ((value - min) / (max - min || 1)) * 120; return [x, y]; });
    add('polyline', { points: points.map((point) => point.join(',')).join(' '), class: 'chart-line' }); points.forEach(([cx, cy]) => add('circle', { cx, cy, r: 4, class: 'chart-point' }));
  }
  function renderOverall(completed) {
    const day = dayFor(selectedDate, false) || { meals: [] }; const fuelProgress = clamp(mealTotals(day.meals || []).calories / state.settings.calories, 0, 1); const exerciseProgress = completed / PROGRAMME.length; const score = Math.round(((fuelProgress + exerciseProgress) / 2) * 100);
    $('#completion').textContent = `${score}%`; $('#lapScore').textContent = String(score); $('#progressBar').style.width = `${score}%`; $('#lapRing').style.setProperty('--score', `${score * 3.6}deg`);
  }
  function render() { renderDate(); renderFuel(); const completed = renderExercises(); renderWeight(); renderOverall(completed); }

  $('#fuelForm').addEventListener('submit', (event) => { event.preventDefault(); setError('#fuelError', ''); const data = new FormData(event.currentTarget); const name = text(data.get('meal')); const calories = Number(data.get('calories')); const optional = (key) => data.get(key) === '' ? 0 : Number(data.get(key)); const protein = optional('protein'); const carbs = optional('carbs'); const fats = optional('fats');
    if (!name || !validNumber(calories, 0, 10000) || ![protein, carbs, fats].every((value) => validNumber(value, 0, 1000))) { setError('#fuelError', 'Enter a meal, valid calories, and non-negative macro values.'); return; }
    dayFor().meals.push({ id: crypto.randomUUID(), name, calories, protein, carbs, fats, createdAt: new Date().toISOString() }); save(); event.currentTarget.reset(); render(); showToast('Fuel entry logged.'); syncWrite({ action: 'meal', meal: name, calories, protein, carbs, fats, date: selectedDate }); });
  $('#weightForm').addEventListener('submit', (event) => { event.preventDefault(); setError('#weightError', ''); const value = Number(new FormData(event.currentTarget).get('weight')); if (!validNumber(value, 25, 300)) { setError('#weightError', 'Enter a weight between 25 and 300 kg.'); return; } dayFor().weight = value; save(); event.currentTarget.reset(); render(); showToast('Weight reading saved.'); syncWrite({ action: 'weight', weight: value, date: selectedDate }); });
  $('#clearMeals').addEventListener('click', () => { const day = dayFor(selectedDate, false); if (!day?.meals.length) return; if (window.confirm('Remove all meal entries for the selected day?')) { day.meals = []; save(); render(); showToast('Meals cleared.'); } });
  $('#clearWeight').addEventListener('click', () => { if (!allWeights().length) return; if (window.confirm('Remove every saved weight reading?')) { Object.values(state.days).forEach((day) => { day.weight = null; }); save(); render(); showToast('Weight history cleared.'); } });
  $('#resetDay').addEventListener('click', () => { const day = dayFor(selectedDate, false); if (!day || (!day.meals.length && !Object.values(day.exercises).some(Boolean) && day.weight === null)) { showToast('This day has no data to reset.'); return; } if (window.confirm(`Reset meals, training, and weight for ${longDateFormat.format(dateFromKey(selectedDate))}?`)) { delete state.days[selectedDate]; save(); render(); showToast('Selected day reset.'); } });
  $('#previousDay').addEventListener('click', () => { selectedDate = shiftDate(selectedDate, -1); render(); }); $('#nextDay').addEventListener('click', () => { selectedDate = shiftDate(selectedDate, 1); render(); }); $('#jumpToday').addEventListener('click', () => { selectedDate = localDateKey(new Date()); render(); });
  const dialog = $('#settingsDialog'); $('#settingsButton').addEventListener('click', () => { Object.entries(state.settings).forEach(([key, value]) => { $('#settingsForm').elements[key].value = value; }); setError('#settingsError', ''); dialog.showModal(); }); $('#closeSettings').addEventListener('click', () => dialog.close()); $('#cancelSettings').addEventListener('click', () => dialog.close());
  $('#settingsForm').addEventListener('submit', (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const next = Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((key) => [key, Number(data.get(key))])); if (!validNumber(next.calories, 500, 10000) || !['protein', 'carbs', 'fats'].every((key) => validNumber(next[key], 1, 1000))) { setError('#settingsError', 'Use calories from 500 to 10,000 and macros from 1 to 1,000.'); return; } state.settings = next; save(); dialog.close(); render(); showToast('Daily targets updated.'); });
  setConnection(hasRemote ? 'CONNECTING' : 'LOCAL MODE', hasRemote ? 'GOOGLE SHEETS' : 'THIS DEVICE');
  render();
  syncDashboard();
})();
