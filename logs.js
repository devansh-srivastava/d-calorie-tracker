(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const STORAGE_KEY = 'apex-health-v2';
  const SHEET_ID = '1AdPNuMGgiXVIY0KU7Tl_H-idR15SJEfD3ede9zjkdgE';
  const sheetFeed = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json;responseHandler:apexLogResponse&sheet=Calorie%20Tracker`;
  const format = (value) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(value));
  const local = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const noon = (key) => new Date(`${key}T12:00:00`);
  const weekKey = (value) => { const date = typeof value === 'string' ? noon(value) : new Date(value); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return local(date); };
  const shift = (key, days) => { const date = noon(key); date.setDate(date.getDate() + days); return local(date); };
  const label = (start) => { const formatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }); return `${formatter.format(noon(start))} – ${formatter.format(noon(shift(start, 6)))}`; };
  const feedCell = (row, index) => row?.c?.[index]?.v;
  const feedDate = (value) => { const match = /^Date\((\d+),(\d+),(\d+)\)$/.exec(value || ''); return match ? `${match[1]}-${String(Number(match[2]) + 1).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}` : null; };
  let state;
  try { state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || { days: {} }; } catch { state = { days: {} }; }
  let selected = weekKey(local(new Date()));
  const select = $('#week-select');

  function setWeeks() {
    const weeks = [...new Set([weekKey(local(new Date())), ...Object.keys(state.days || {}).map(weekKey)])].sort().reverse();
    if (!weeks.includes(selected)) selected = weeks[0];
    select.replaceChildren(...weeks.map((week) => new Option(label(week), week, false, week === selected)));
  }
  function render() {
    $('#log-period').textContent = `${label(selected)} · daily calorie totals.`;
    const list = $('#log-list'); list.replaceChildren();
    for (let index = 0; index < 7; index += 1) {
      const date = shift(selected, index), meals = state.days?.[date]?.meals || [];
      const total = meals.reduce((sum, meal) => sum + Number(meal.calories || 0), 0);
      const item = document.createElement('details'); item.className = 'log-card'; if (index === 0) item.open = true;
      const dateLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }).format(noon(date));
      item.innerHTML = `<summary><span><b>${dateLabel}</b><small>${meals.length ? `${meals.length} ${meals.length === 1 ? 'entry' : 'entries'}` : 'Not logged yet'}</small></span><strong>${meals.length ? format(total) : '—'}<small>${meals.length ? ' kcal' : ''}</small></strong></summary>${meals.length ? `<div class="meal-grid">${meals.map((meal) => `<p>${meal.name}<strong>${format(meal.calories)}</strong></p>`).join('')}</div>` : ''}`;
      list.append(item);
    }
  }
  function loadSheetFeed() { return new Promise((resolve, reject) => { const script = document.createElement('script'); const timeout = setTimeout(() => finish(new Error('Google Sheets timed out.')), 10000); const finish = (error, data) => { clearTimeout(timeout); delete window.apexLogResponse; script.remove(); error ? reject(error) : resolve(data); }; window.apexLogResponse = (data) => finish(null, data); script.onerror = () => finish(new Error('Google Sheets could not be loaded.')); script.src = sheetFeed; document.head.append(script); }); }
  async function syncLogs() {
    try {
      const nextDays = {};
      (await loadSheetFeed()).table?.rows?.forEach((row) => { const date = feedDate(feedCell(row, 0)); const calories = Number(feedCell(row, 4)) || 0; if (date && calories) nextDays[date] = { meals: [{ id: `TRACKER-${date}`, name: 'Daily total', calories }] }; });
      state.days = nextDays; setWeeks(); render();
    } catch { setWeeks(); render(); }
  }
  select.addEventListener('change', () => { selected = select.value; render(); });
  setWeeks(); render(); syncLogs();
})();
