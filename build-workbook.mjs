import fs from 'node:fs/promises';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = 'outputs/apex-health';
await fs.mkdir(outputDir, { recursive: true });
const workbook = Workbook.create();
const daily = workbook.worksheets.add('Daily Log');
const exercise = workbook.worksheets.add('Exercise Plan');
const weight = workbook.worksheets.add('Weight Log');
const settings = workbook.worksheets.add('Settings');
const red = '#ED1C24', black = '#111111', dark = '#1B1B1B', white = '#F4F3F0', gray = '#777777', lime = '#C7F36B';
const title = (sheet, label, subtitle, width) => {
  sheet.showGridLines = false;
  sheet.getRange(`A1:${width}1`).merge(); sheet.getRange('A1').values = [[label]];
  sheet.getRange(`A2:${width}2`).merge(); sheet.getRange('A2').values = [[subtitle]];
  sheet.getRange(`A1:${width}1`).format = { fill: black, font: { bold: true, color: white, size: 18 }, horizontalAlignment: 'left', verticalAlignment: 'center' };
  sheet.getRange(`A2:${width}2`).format = { fill: dark, font: { color: '#B5B5B5', size: 10 }, horizontalAlignment: 'left' };
  sheet.getRange('A1').format.rowHeight = 30; sheet.getRange('A2').format.rowHeight = 21;
};
const header = (sheet, range) => sheet.getRange(range).format = { fill: red, font: { bold: true, color: white }, horizontalAlignment: 'center', verticalAlignment: 'center' };

title(daily, 'APEX HEALTH / DAILY FUEL LOG', 'One row per food entry. Keep this tab as the source of truth for the dashboard.', 'H');
daily.getRange('A4:H8').values = [
  ['Date', 'Meal', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fats (g)', 'Notes', 'Entry ID'],
  [new Date('2026-08-10T12:00:00'), 'Greek yogurt + berries', 220, 20, 28, 4, 'Breakfast', 'DL-001'],
  [new Date('2026-08-10T12:00:00'), 'Chicken rice bowl', 640, 48, 74, 14, 'Lunch', 'DL-002'],
  [new Date('2026-08-10T12:00:00'), 'Whey protein shake', 140, 25, 5, 2, 'Post-workout', 'DL-003'],
  [new Date('2026-08-10T12:00:00'), 'Salmon, potatoes & greens', 590, 42, 58, 18, 'Dinner', 'DL-004']
];
header(daily, 'A4:H4'); daily.getRange('A5:A8').format.numberFormat = 'yyyy-mm-dd'; daily.getRange('C5:F8').format.numberFormat = '#,##0'; daily.getRange('A4:H8').format.borders = { preset: 'insideHorizontal', style: 'thin', color: '#D8D8D8' }; daily.getRange('A4:H8').format.wrapText = true; daily.getRange('A:A').format.columnWidth = 14; daily.getRange('B:B').format.columnWidth = 28; daily.getRange('C:F').format.columnWidth = 12; daily.getRange('G:G').format.columnWidth = 18; daily.getRange('H:H').format.columnWidth = 12; daily.freezePanes.freezeRows(4); daily.tables.add('A4:H8', true, 'DailyLogTable');

title(exercise, 'APEX HEALTH / TRAINING RUN SHEET', 'Update prescriptions in this tab. Completed data is read by date and exercise name.', 'F');
exercise.getRange('A4:F8').values = [
  ['Day', 'Exercise', 'Prescription', 'Type', 'Completed', 'Completed At'],
  ['Monday', 'Upper body strength', '4 sets × 8–12 reps', 'STRENGTH', true, new Date('2026-08-10T18:15:00')],
  ['Tuesday', 'Zone 2 cardio', '30 minutes / easy pace', 'CARDIO', false, null],
  ['Wednesday', 'Core circuit', '3 rounds × 4 movements', 'STABILITY', false, null],
  ['Thursday', 'Mobility reset', '10 minutes / full body', 'RECOVERY', false, null]
];
header(exercise, 'A4:F4'); exercise.getRange('F5:F8').format.numberFormat = 'yyyy-mm-dd hh:mm'; exercise.getRange('A4:F8').format.borders = { preset: 'insideHorizontal', style: 'thin', color: '#D8D8D8' }; exercise.getRange('A4:F8').format.autofitColumns(); exercise.getRange('C:C').format.columnWidth = 25; exercise.getRange('D:D').format.columnWidth = 14; exercise.getRange('E5:E200').dataValidation = { rule: { type: 'list', values: ['TRUE', 'FALSE'] } }; exercise.getRange('E5:E200').conditionalFormats.add('cellIs', { operator: 'equal', formula: 'TRUE', format: { fill: lime, font: { bold: true, color: black } } }); exercise.freezePanes.freezeRows(4); exercise.tables.add('A4:F8', true, 'ExercisePlanTable');

title(weight, 'APEX HEALTH / BODYWEIGHT TELEMETRY', 'One row per weigh-in. The dashboard displays the latest seven readings.', 'D');
weight.getRange('A4:D10').values = [
  ['Date', 'Weight (kg)', 'Notes', 'Trend vs prior (kg)'],
  [new Date('2026-08-04T12:00:00'), 74.8, 'Morning fasted', null], [new Date('2026-08-05T12:00:00'), 74.6, 'Morning fasted', null], [new Date('2026-08-06T12:00:00'), 74.7, 'Morning fasted', null], [new Date('2026-08-07T12:00:00'), 74.4, 'Morning fasted', null], [new Date('2026-08-08T12:00:00'), 74.3, 'Morning fasted', null], [new Date('2026-08-10T12:00:00'), 74.2, 'Morning fasted', null]
];
weight.getRange('D6').formulas = [['=B6-B5']]; weight.getRange('D6:D10').fillDown(); header(weight, 'A4:D4'); weight.getRange('A5:A10').format.numberFormat = 'yyyy-mm-dd'; weight.getRange('B5:B10').format.numberFormat = '0.0'; weight.getRange('D5:D10').format.numberFormat = '+0.0;-0.0;0.0'; weight.getRange('A4:D10').format.borders = { preset: 'insideHorizontal', style: 'thin', color: '#D8D8D8' }; weight.getRange('A4:D10').format.autofitColumns(); weight.getRange('C:C').format.columnWidth = 20; weight.getRange('D5:D200').conditionalFormats.add('cellIs', { operator: 'lessThan', formula: 0, format: { font: { bold: true, color: '#16803C' } } }); weight.freezePanes.freezeRows(4); weight.tables.add('A4:D10', true, 'WeightLogTable');

title(settings, 'APEX HEALTH / RACE SETTINGS', 'Editable targets used by the dashboard and its Google Sheets API.', 'C');
settings.getRange('A4:C8').values = [
  ['Setting', 'Value', 'Unit / notes'],
  ['Daily calorie target', 2300, 'kcal'], ['Protein target', 150, 'g'], ['Carbs target', 250, 'g'], ['Fat target', 70, 'g']
];
header(settings, 'A4:C4'); settings.getRange('A4:C8').format.borders = { preset: 'insideHorizontal', style: 'thin', color: '#D8D8D8' }; settings.getRange('A4:C8').format.autofitColumns(); settings.getRange('A1:C8').format.wrapText = true;
settings.getRange('A11:C12').values = [['INTEGRATION NOTES', null, null], ['Dashboard source', 'Google Sheets → Apps Script API', 'See GOOGLE_SHEETS_HANDOFF.md']]; settings.getRange('A11:C11').merge(); settings.getRange('A11:C11').format = { fill: dark, font: { bold: true, color: white } }; settings.getRange('A12:C12').format = { fill: '#F2F2F2', font: { color: gray } }; settings.getRange('A12:C12').format.autofitColumns();

const inspect = await workbook.inspect({ kind: 'table', range: 'Weight Log!A4:D10', include: 'values,formulas', tableMaxRows: 10, tableMaxCols: 4 });
console.log(inspect.ndjson);
const errors = await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A', options: { useRegex: true, maxResults: 100 }, summary: 'formula errors' });
console.log(errors.ndjson);
for (const sheetName of ['Daily Log', 'Exercise Plan', 'Weight Log', 'Settings']) { const preview = await workbook.render({ sheetName, autoCrop: 'all', scale: 1, format: 'png' }); await fs.writeFile(`${outputDir}/${sheetName.replaceAll(' ', '-')}.png`, new Uint8Array(await preview.arrayBuffer())); }
const out = await SpreadsheetFile.exportXlsx(workbook); await out.save(`${outputDir}/Apex-Health-Tracker.xlsx`);
