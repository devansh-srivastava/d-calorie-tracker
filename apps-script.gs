/**
 * Apex Health Google Apps Script API.
 * Bind this script to the tracker Sheet, set SCRIPT_SECRET in Script Properties,
 * deploy as a web app, then put its /exec URL in config.js.
 */
const TAB = { meals: 'Daily Log', exercises: 'Exercise Plan', weights: 'Weight Log', settings: 'Settings' };

function doGet(e) {
  try {
    assertSecret_(e?.parameter?.secret);
    if ((e?.parameter?.action || 'dashboard') !== 'dashboard') throw new Error('Unsupported GET action.');
    return json_(dashboard_());
  } catch (error) { return json_({ ok: false, error: error.message }); }
}

function doPost(e) {
  try {
    const body = JSON.parse(e?.postData?.contents || '{}');
    assertSecret_(body.secret);
    if (body.action === 'meal') appendMeal_(body);
    else if (body.action === 'exercise') updateExercise_(body);
    else if (body.action === 'weight') appendWeight_(body);
    else throw new Error('Unsupported POST action.');
    return json_({ ok: true, dashboard: dashboard_() });
  } catch (error) { return json_({ ok: false, error: error.message }); }
}

function assertSecret_(secret) {
  const expected = PropertiesService.getScriptProperties().getProperty('SCRIPT_SECRET');
  if (!expected || secret !== expected) throw new Error('Unauthorized.');
}
function sheet_(name) { return SpreadsheetApp.getActive().getSheetByName(name); }
function iso_(value) { return Utilities.formatDate(new Date(value), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }

function dashboard_() {
  const book = SpreadsheetApp.getActive();
  const daily = sheet_(TAB.meals).getDataRange().getValues().slice(4).filter(r => r[0] && r[1]);
  const exercise = sheet_(TAB.exercises).getDataRange().getValues().slice(4).filter(r => r[1]);
  const weights = sheet_(TAB.weights).getDataRange().getValues().slice(4).filter(r => r[0] && r[1] !== '');
  const settingRows = sheet_(TAB.settings).getDataRange().getValues().slice(4, 8);
  const settings = { calories: Number(settingRows[0]?.[1]) || 2300, protein: Number(settingRows[1]?.[1]) || 150, carbs: Number(settingRows[2]?.[1]) || 250, fats: Number(settingRows[3]?.[1]) || 70 };
  return { ok: true, settings, meals: daily.map(r => ({ date: iso_(r[0]), id: String(r[7] || ''), name: String(r[1]), calories: Number(r[2]) || 0, protein: Number(r[3]) || 0, carbs: Number(r[4]) || 0, fats: Number(r[5]) || 0 })), exercises: exercise.map(r => ({ date: iso_(r[0] || new Date()), name: String(r[1]), completed: Boolean(r[4]), type: String(r[3] || ''), meta: String(r[2] || '') })), weights: weights.map(r => ({ date: iso_(r[0]), value: Number(r[1]) || 0 })) };
}
function appendMeal_(b) { sheet_(TAB.meals).appendRow([b.date || iso_(new Date()), b.meal, Number(b.calories), Number(b.protein) || 0, Number(b.carbs) || 0, Number(b.fats) || 0, b.notes || 'Dashboard entry', 'WEB-' + Date.now()]); }
function appendWeight_(b) { sheet_(TAB.weights).appendRow([b.date || iso_(new Date()), Number(b.weight), b.notes || 'Dashboard entry', '']); }
function updateExercise_(b) {
  const sh = sheet_(TAB.exercises); const rows = sh.getDataRange().getValues();
  for (let i = 4; i < rows.length; i++) if (String(rows[i][1]).trim() === String(b.exercise).trim()) { sh.getRange(i + 1, 5).setValue(Boolean(b.completed)); sh.getRange(i + 1, 6).setValue(b.completed ? new Date() : ''); return; }
  throw new Error('Exercise not found in Exercise Plan.');
}
