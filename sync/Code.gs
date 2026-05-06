const SPREADSHEET_ID = '1TytY22P4QKRtMbJ1SbtIlq7dVL3gTx6_WtjmVZ8YYfo';
const STATE_SHEET = 'State';
const LOG_SHEET = 'Log';

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action || 'get';
  const callback = params.callback || '';
  const userId = String(params.userId || '').trim();

  let result;
  try {
    if (action !== 'get') throw new Error('Unsupported action');
    if (!userId) throw new Error('Missing userId');
    result = { ok: true, state: getState_(userId) };
    appendLog_(userId, 'pull', params.deviceLabel || '', '');
  } catch (error) {
    result = { ok: false, error: error.message };
  }

  const body = callback
    ? `${callback}(${JSON.stringify(result)});`
    : JSON.stringify(result);
  const mime = callback
    ? ContentService.MimeType.JAVASCRIPT
    : ContentService.MimeType.JSON;
  return ContentService.createTextOutput(body).setMimeType(mime);
}

function doPost(e) {
  let payload = {};
  let result;
  try {
    payload = JSON.parse(e.postData.contents || '{}');
    if (!payload.userId) throw new Error('Missing userId');
    saveState_(payload);
    appendLog_(payload.userId, 'push', payload.deviceLabel || '', '');
    result = { ok: true, updatedAt: new Date().toISOString() };
  } catch (error) {
    result = { ok: false, error: error.message };
    appendLog_(payload.userId || '', 'error', payload.deviceLabel || '', error.message);
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function getState_(userId) {
  const sheet = getSheet_(STATE_SHEET);
  const values = sheet.getDataRange().getValues();
  for (let row = 1; row < values.length; row += 1) {
    if (String(values[row][0]) === userId) {
      return {
        userId,
        wrongIds: parseJson_(values[row][1], []),
        history: parseJson_(values[row][2], []),
        updatedAt: values[row][3] || '',
        deviceLabel: values[row][4] || '',
        version: values[row][5] || 1,
      };
    }
  }
  return { userId, wrongIds: [], history: [], updatedAt: '', deviceLabel: '', version: 1 };
}

function saveState_(payload) {
  const sheet = getSheet_(STATE_SHEET);
  const userId = String(payload.userId).trim();
  const now = new Date().toISOString();
  const row = findStateRow_(sheet, userId);
  const values = [[
    userId,
    JSON.stringify(payload.wrongIds || []),
    JSON.stringify(payload.history || []),
    now,
    payload.deviceLabel || '',
    payload.version || 1,
  ]];
  if (row) {
    sheet.getRange(row, 1, 1, values[0].length).setValues(values);
  } else {
    sheet.appendRow(values[0]);
  }
}

function findStateRow_(sheet, userId) {
  const values = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 1).getValues();
  for (let index = 1; index < values.length; index += 1) {
    if (String(values[index][0]) === userId) return index + 1;
  }
  return 0;
}

function appendLog_(userId, action, deviceLabel, note) {
  getSheet_(LOG_SHEET).appendRow([
    new Date().toISOString(),
    userId,
    action,
    deviceLabel,
    note || '',
  ]);
}

function getSheet_(name) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error(`Missing sheet: ${name}`);
  return sheet;
}

function parseJson_(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}
