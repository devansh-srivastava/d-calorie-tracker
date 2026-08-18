(() => {
  'use strict';
  const STORAGE_KEY = 'apex-health-v2';
  const DEFAULT_SETTINGS = { calories: 2300, protein: 150, carbs: 250, fats: 70 };
  const $ = (selector) => document.querySelector(selector);
  const format = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(value));
  const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
  const weekday = new Intl.DateTimeFormat('en-IN', { weekday: 'short' });
  const localKey = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const atNoon = (key) => new Date(`${key}T12:00:00`);
  const weekKey = (key) => { const date = typeof key === 'string' ? atNoon(key) : new Date(key); const day = (date.getDay() + 6) % 7; date.setDate(date.getDate() - day); return localKey(date); };
  const shift = (key, days) => { const date = atNoon(key); date.setDate(date.getDate() + days); return localKey(date); };
  const daysInWeek = (start) => Array.from({ length: 7 }, (_, index) => shift(start, index));
  const total = (day) => (day?.meals || []).reduce((sum, meal) => sum + Number(meal.calories || 0), 0);
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || { settings: DEFAULT_SETTINGS, days: {} }; } catch { return { settings: DEFAULT_SETTINGS, days: {} }; } };
  let state = readLocal();
  let selectedWeek = weekKey(localKey(new Date()));

  function weekLabel(start) { const dates = daysInWeek(start); return `${dateFormat.format(atNoon(dates[0]))} – ${dateFormat.format(atNoon(dates[6]))}`; }
  function knownWeeks() { const weeks = new Set([weekKey(localKey(new Date())), ...Object.keys(state.days || {}).map(weekKey)]); return [...weeks].sort().reverse(); }
  function svgNode(tag, attributes, text) { const node = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value))); if (text) node.textContent = text; return node; }
  function lineChart(id, values, target, tone, emptyText) {
    const svg = $(id); svg.replaceChildren(); const width = 640, left = 32, right = 608, top = 28, bottom = 190;
    if (!values.some((value) => value !== null)) { svg.append(svgNode('text', { x: 320, y: 112, 'text-anchor': 'middle', class: 'chart-empty' }, emptyText)); return; }
    const numbers = values.filter((value) => value !== null); const ceiling = Math.max(target || 0, ...numbers) * 1.15 || 1;
    [top, (top + bottom) / 2, bottom].forEach((y) => svg.append(svgNode('line', { x1: left, y1: y, x2: right, y2: y, class: 'chart-grid' })));
    if (target) { const y = bottom - (target / ceiling) * (bottom - top); svg.append(svgNode('line', { x1: left, y1: y, x2: right, y2: y, class: 'chart-target' })); }
    const points = values.map((value, index) => value === null ? null : [left + index * ((right - left) / 6), bottom - (value / ceiling) * (bottom - top)]);
    let d = ''; points.forEach((point, index) => { if (!point) return; d += `${!points[index - 1] ? 'M' : 'L'}${point[0]} ${point[1]} `; });
    svg.append(svgNode('path', { d, class: tone })); points.filter(Boolean).forEach(([cx, cy]) => svg.append(svgNode('circle', { cx, cy, r: 4, class: `${tone}-point` })));
    daysInWeek(selectedWeek).forEach((date, index) => svg.append(svgNode('text', { x: left + index * ((right - left) / 6), y: 225, 'text-anchor': 'middle', class: 'chart-label' }, weekday.format(atNoon(date)))));
  }
  function renderCalendar() {
    const monthDate = atNoon(selectedWeek), first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12), count = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    $('#workout-month').textContent = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(first);
    const calendar = $('#workout-calendar'); calendar.replaceChildren(); Array.from({ length: (first.getDay() + 6) % 7 }, () => calendar.append(document.createElement('span')));
    let tracked = 0, completed = 0;
    for (let day = 1; day <= count; day += 1) { const key = localKey(new Date(first.getFullYear(), first.getMonth(), day, 12)); const exercises = state.days?.[key]?.exercises; const countDone = exercises ? Object.values(exercises).filter(Boolean).length : 0; const isTracked = exercises && Object.keys(exercises).length > 0; if (isTracked) tracked += 1; if (countDone) completed += 1; const stateClass = countDone ? 'done' : isTracked ? 'rest' : 'untracked'; const item = document.createElement('span'); item.className = `calendar-day ${stateClass}`; item.innerHTML = `<b>${day}</b><i></i>`; calendar.append(item); }
    $('#workout-count').textContent = tracked ? `${completed} of ${tracked} days` : 'Not logged yet';
  }
  function render() {
    const week = daysInWeek(selectedWeek), today = localKey(new Date()), weekDays = week.map((date) => state.days?.[date]); const values = weekDays.map((day) => day?.meals?.length ? total(day) : null); const weeklyTotal = values.reduce((sum, value) => sum + (value || 0), 0); const logged = values.filter((value) => value !== null).length; const target = Number(state.settings?.calories || DEFAULT_SETTINGS.calories); const todayDay = state.days?.[today]; const todayTotal = total(todayDay); const workoutDays = weekDays.filter((day) => day?.exercises && Object.keys(day.exercises).length); const workoutsDone = workoutDays.filter((day) => Object.values(day.exercises).some(Boolean)).length;
    $('#weekly-total').textContent = format(weeklyTotal); $('#target-total').textContent = format(target); $('#today-total').textContent = format(todayTotal); $('#today-status').textContent = todayDay?.meals?.length ? `${format(Math.max(target - todayTotal, 0))} kcal left` : 'No food logged'; $('#workout-total').textContent = `${workoutsDone}/${workoutDays.length}`; $('#workout-status').textContent = workoutDays.length ? `${workoutsDone} completed this week` : 'Not tracked yet';
    $('#weekly-status').textContent = logged ? `${format(weeklyTotal)} kcal across ${logged} logged ${logged === 1 ? 'day' : 'days'}.` : 'No calorie entries logged for this week yet.';
    lineChart('#calorie-chart', values, target, 'calorie-line', 'Awaiting calorie data');
    const weights = Object.entries(state.days || {}).filter(([, day]) => Number.isFinite(day.weight)).sort(([a], [b]) => a.localeCompare(b)).slice(-7); const weightValues = weights.map(([, day]) => day.weight); const latest = weightValues.at(-1); $('#weight-latest').textContent = latest ? latest.toFixed(1) : '--'; $('#weight-change').textContent = weightValues.length > 1 ? `${(latest - weightValues[0]).toFixed(1)} kg across your last ${weightValues.length} readings.` : latest ? 'Your latest recorded weight.' : 'No weight readings yet.'; lineChart('#weight-chart', weightValues.concat(Array(Math.max(0, 7 - weightValues.length)).fill(null)), null, 'weight-line', 'Awaiting weight data');
    window.chartData = { calories: { values, target, tone: 'calorie-line', empty: 'Awaiting calorie data', title: 'Calorie flow', legend: '<span><i class="intake"></i>Calories eaten</span><span><i class="target"></i>Daily target</span>' }, weight: { values: weightValues.concat(Array(Math.max(0, 7 - weightValues.length)).fill(null)), target: null, tone: 'weight-line', empty: 'Awaiting weight data', title: 'Weight progress', legend: '<span><i class="weight-key"></i>Weight readings</span>' } };
    renderCalendar();
  }
  function setWeekSelect() { const select = $('#week-select'); select.replaceChildren(...knownWeeks().map((week) => new Option(weekLabel(week), week, false, week === selectedWeek))); select.addEventListener('change', () => { selectedWeek = select.value; render(); }); }
  const SHEET_ID = '1AdPNuMGgiXVIY0KU7Tl_H-idR15SJEfD3ede9zjkdgE';
  const sheetFeed = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json;responseHandler:apexSheetResponse&sheet=Calorie%20Tracker`;
  const feedCell = (row, index) => row?.c?.[index]?.v;
  const feedDate = (value) => {
    const match = /^Date\((\d+),(\d+),(\d+)\)$/.exec(value || '');
    return match ? `${match[1]}-${String(Number(match[2]) + 1).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}` : null;
  };
  function applyDashboard(data) { state.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) }; state.days = {}; (data.meals || []).forEach((meal) => { const day = state.days[meal.date] ||= { meals: [], exercises: {}, weight: null }; day.meals.push(meal); }); (data.weights || []).forEach((reading) => { (state.days[reading.date] ||= { meals: [], exercises: {}, weight: null }).weight = Number(reading.value); }); (data.exercises || []).forEach((exercise) => { const day = state.days[exercise.date] ||= { meals: [], exercises: {}, weight: null }; day.exercises[exercise.name] = Boolean(exercise.completed); }); render(); }
  function dashboardFromSheet(feed) { const rows = feed.table?.rows || []; const meals = [], weights = []; let calories = DEFAULT_SETTINGS.calories; rows.forEach((row) => { const date = feedDate(feedCell(row, 0)); if (!date) return; const totalCalories = Number(feedCell(row, 4)) || 0; const weight = feedCell(row, 5); const target = Number(feedCell(row, 10)) || 0; if (target) calories = target; if (totalCalories) meals.push({ date, id: `TRACKER-${date}`, name: 'Daily total', calories: totalCalories }); if (weight !== null && weight !== undefined) weights.push({ date, value: Number(weight) || 0 }); }); return { settings: { ...DEFAULT_SETTINGS, calories }, meals, weights, exercises: [] }; }
  function loadSheetFeed() { return new Promise((resolve, reject) => { const script = document.createElement('script'); const timeout = setTimeout(() => finish(new Error('Google Sheets timed out.')), 10000); const finish = (error, data) => { clearTimeout(timeout); delete window.apexSheetResponse; script.remove(); error ? reject(error) : resolve(data); }; window.apexSheetResponse = (data) => finish(null, data); script.onerror = () => finish(new Error('Google Sheets could not be loaded.')); script.src = sheetFeed; document.head.append(script); }); }
  async function syncDashboard() { const remote = window.APEX_CONFIG || {}; try { if (remote.API_URL && remote.API_SECRET) { const url = new URL(remote.API_URL); url.searchParams.set('action', 'dashboard'); url.searchParams.set('secret', remote.API_SECRET); const response = await fetch(url, { cache: 'no-store' }); const data = await response.json(); if (data.ok) applyDashboard(data); return; } applyDashboard(dashboardFromSheet(await loadSheetFeed())); } catch { /* local data remains available */ } }
  function openChart(kind) { const data = window.chartData?.[kind]; if (!data) return; $('#expanded-chart-title').textContent = data.title; $('#expanded-chart-week').textContent = kind === 'calories' ? weekLabel(selectedWeek).toUpperCase() : 'RECENT READINGS'; $('#expanded-legend').innerHTML = data.legend; lineChart('#expanded-chart', data.values, data.target, data.tone, data.empty); $('#chart-dialog').showModal(); }
  $('#open-calorie-chart').addEventListener('click', () => openChart('calories')); $('#open-weight-chart').addEventListener('click', () => openChart('weight')); $('#close-chart').addEventListener('click', () => $('#chart-dialog').close()); $('#chart-dialog').addEventListener('click', (event) => { if (event.target === $('#chart-dialog')) $('#chart-dialog').close(); });
  setWeekSelect(); render(); syncDashboard();
})();
