/**
 * D-calorie tracker Google Apps Script API.
 * Set SPREADSHEET_ID and SCRIPT_SECRET in Script Properties, deploy as a web
 * app, then put the /exec URL and secret in the site's local config.js.
 */
const TAB = { tracker: 'Calorie Tracker' };

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
    throw new Error('This dashboard is read-only. Update entries in the Google Sheet.');
  } catch (error) { return json_({ ok: false, error: error.message }); }
}

function assertSecret_(secret) {
  const expected = PropertiesService.getScriptProperties().getProperty('SCRIPT_SECRET');
  if (!expected || secret !== expected) throw new Error('Unauthorized.');
}
function book_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Missing SPREADSHEET_ID script property.');
  return SpreadsheetApp.openById(id);
}
function iso_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid tracker date: ${value}`);
  return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }

function dashboard_() {
  const rows = book_().getSheetByName(TAB.tracker).getDataRange().getValues().slice(1).filter(row => row[0]);
  const meals = [], weights = [];
  let calorieTarget = 2300;
  rows.forEach((row) => {
    const date = iso_(row[0]);
    const calories = Number(row[4]) || 0;
    const target = Number(row[10]) || 0;
    if (target) calorieTarget = target;
    if (calories) meals.push({ date, id: `TRACKER-${date}`, name: 'Daily total', calories, protein: 0, carbs: 0, fats: 0 });
    if (row[5] !== '' && row[5] != null) weights.push({ date, value: Number(row[5]) || 0 });
  });
  return { ok: true, settings: { calories: calorieTarget, protein: 150, carbs: 250, fats: 70 }, meals, weights, exercises: [] };
}
