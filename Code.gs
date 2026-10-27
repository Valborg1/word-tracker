/**
 * November Word Tracker: backend
 * Paste this into Extensions > Apps Script in your Google Sheet.
 * Run setup() once, then deploy as a web app (see README).
 * After any change to this file: Deploy > Manage deployments > Edit > Version: New version.
 */

// ===== Settings =====
const TIME_ZONE = 'America/Chicago';       // everyone's dates follow this time zone
const YEAR = 2026;
const MONTH = 11;                          // November
const DAYS_IN_CHALLENGE = 30;              // monthly goal = daily goal x this number
const REGISTRATION_DEADLINE = '2026-11-01'; // last day people can create an account
const MAX_DAILY_WORDS = 20000;             // largest count accepted for one day
const MAX_DAILY_GOAL = 10000;              // largest daily goal accepted
const HASH_ROUNDS = 200;
const FAKE_TODAY = '';                     // for testing only, e.g. '2026-11-05'. Leave '' for the real date.

const START_DATE = YEAR + '-' + pad(MONTH) + '-01';
const END_DATE = YEAR + '-' + pad(MONTH) + '-' + pad(DAYS_IN_CHALLENGE);

// Users columns:    username | passwordHash | salt | dailyGoal | projectTitle | isAdmin | createdAt
// Entries columns:  username | date | words | updatedAt
// Sessions columns: token | username | createdAt

// ===== One-time setup =====
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, 'Users', ['username', 'passwordHash', 'salt', 'dailyGoal', 'projectTitle', 'isAdmin', 'createdAt']);
  ensureSheet(ss, 'Entries', ['username', 'date', 'words', 'updatedAt']);
  ensureSheet(ss, 'Sessions', ['token', 'username', 'createdAt']);
}

function ensureSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.getRange('A:Z').setNumberFormat('@'); // store everything as plain text so dates stay as typed
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  sh.setFrozenRows(1);
}

// ===== Web endpoints =====
function doGet() {
  return ContentService.createTextOutput('November Word Tracker API is running.');
}

function doPost(e) {
  let out;
  const lock = LockService.getScriptLock();
  try {
    const req = JSON.parse(e.postData.contents);
    lock.waitLock(20000);
    out = handle(req);
  } catch (err) {
    if (err && err.userMessage) {
      out = { ok: false, error: err.userMessage, code: err.code || '' };
    } else {
      console.error(err);
      out = { ok: false, error: 'The server had a problem. Try again.' };
    }
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function handle(req) {
  const action = req.action;
  if (action === 'info') return { ok: true, today: today(), config: config() };
  if (action === 'register') return register(req);
  if (action === 'login') return login(req);

  const me = auth(req.token);
  switch (action) {
    case 'state':
      return state(me);
    case 'logout':
      deleteRowsWhere('Sessions', r => r.token === String(req.token));
      return { ok: true };
    case 'saveEntry':
      saveEntry(me.username, req.date, req.words);
      return state(me);
    case 'addWords': {
      const added = addWords(me.username, req.words);
      const out = state(me);
      out.added = added;
      return out;
    }
    case 'deleteEntry':
      deleteEntry(me.username, req.date);
      return state(me);
    case 'updateProfile':
      updateProfile(me, req.projectTitle);
      return state(me);
    case 'adminSaveEntry':
      requireAdmin(me);
      saveEntry(mustFindUser(req.username).username, req.date, req.words);
      return state(me);
    case 'adminDeleteEntry':
      requireAdmin(me);
      deleteEntry(mustFindUser(req.username).username, req.date);
      return state(me);
    case 'adminResetPassword':
      requireAdmin(me);
      resetPassword(mustFindUser(req.username), req.newPassword);
      return state(me);
    case 'adminRemoveUser':
      requireAdmin(me);
      removeUser(me, mustFindUser(req.username));
      return state(me);
  }
  fail('Unknown action.');
}

// ===== Accounts =====
function register(req) {
  if (today() > REGISTRATION_DEADLINE) fail('Registration is closed.');
  const username = cleanUsername(req.username);
  const password = String(req.password || '');
  if (password.length < 6) fail('Password must be at least 6 characters.');
  const goal = toInt(req.dailyGoal);
  if (!(goal >= 1 && goal <= MAX_DAILY_GOAL)) fail('Daily goal must be a whole number from 1 to ' + MAX_DAILY_GOAL + '.');
  const title = cleanTitle(req.projectTitle);
  if (findUser(username)) fail('That username is taken.');

  const salt = Utilities.getUuid();
  sheet('Users').appendRow([username, hashPassword(password, salt), salt, String(goal), title, 'FALSE', new Date().toISOString()]);
  return { ok: true, token: newSession(username) };
}

function login(req) {
  const user = findUser(req.username);
  const password = String(req.password || '');
  if (!user || hashPassword(password, user.salt) !== user.passwordHash) fail('Wrong username or password.');
  return { ok: true, token: newSession(user.username) };
}

function newSession(username) {
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  sheet('Sessions').appendRow([token, username, new Date().toISOString()]);
  return token;
}

function auth(token) {
  if (!token) failAuth();
  const session = readRows('Sessions').find(r => r.token === String(token));
  if (!session) failAuth();
  const user = findUser(session.username);
  if (!user) failAuth();
  return user;
}

function hashPassword(password, salt) {
  let h = salt + ':' + password;
  for (let i = 0; i < HASH_ROUNDS; i++) {
    h = Utilities.base64Encode(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8)
    );
  }
  return h;
}

function updateProfile(me, projectTitle) {
  const title = cleanTitle(projectTitle);
  sheet('Users').getRange(me._row, 5).setValue(title);
}

// ===== Entries =====
function saveEntry(username, date, words) {
  validateDate(date);
  const w = toInt(words);
  if (!(w >= 0 && w <= MAX_DAILY_WORDS)) fail('Word count must be a whole number from 0 to ' + MAX_DAILY_WORDS.toLocaleString('en-US') + '.');
  writeEntry(username, date, w, findEntry(username, date));
}

// Adds words to today's entry (negative to undo). The server's date is used so a page
// left open past midnight logs to the real day; the page is told which date was used.
function addWords(username, words) {
  const date = today();
  if (date < START_DATE || date > END_DATE) fail('Logging is only open during November.');
  const w = toInt(words);
  if (!(w !== 0 && Math.abs(w) <= MAX_DAILY_WORDS)) fail('Enter a whole number of words.');

  const existing = findEntry(username, date);
  const before = existing ? Number(existing.words) || 0 : 0;
  const after = Math.max(0, before + w);
  if (after > MAX_DAILY_WORDS) fail('That would make today ' + after.toLocaleString('en-US') + ' words. The daily limit is ' + MAX_DAILY_WORDS.toLocaleString('en-US') + '.');
  writeEntry(username, date, after, existing);
  return { date: date, words: after - before, before: before, after: after };
}

function findEntry(username, date) {
  const key = username.toLowerCase();
  return readRows('Entries').find(r => r.username.toLowerCase() === key && r.date === date) || null;
}

function writeEntry(username, date, w, existing) {
  const sh = sheet('Entries');
  if (w === 0) {
    if (existing) sh.deleteRow(existing._row);
    return;
  }
  const row = [username, date, String(w), new Date().toISOString()];
  if (existing) sh.getRange(existing._row, 1, 1, 4).setValues([row]);
  else sh.appendRow(row);
}

function deleteEntry(username, date) {
  validateDate(date);
  const key = username.toLowerCase();
  deleteRowsWhere('Entries', r => r.username.toLowerCase() === key && r.date === date);
}

function validateDate(date) {
  const d = String(date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) fail('Pick a valid date.');
  if (d < START_DATE || d > END_DATE) fail('Pick a date in November.');
  if (d > today()) fail('You can’t log words for a future date.');
}

// ===== Admin =====
function requireAdmin(me) {
  if (!isAdmin(me)) fail('Only the admin can do that.');
}

function isAdmin(user) {
  return String(user.isAdmin).trim().toUpperCase() === 'TRUE';
}

function resetPassword(user, newPassword) {
  const pw = String(newPassword || '');
  if (pw.length < 6) fail('Password must be at least 6 characters.');
  const salt = Utilities.getUuid();
  sheet('Users').getRange(user._row, 2, 1, 2).setValues([[hashPassword(pw, salt), salt]]);
  const key = user.username.toLowerCase();
  deleteRowsWhere('Sessions', r => r.username.toLowerCase() === key); // logs them out everywhere
}

function removeUser(me, user) {
  if (user.username.toLowerCase() === me.username.toLowerCase()) fail('You can’t remove your own account.');
  const key = user.username.toLowerCase();
  deleteRowsWhere('Entries', r => r.username.toLowerCase() === key);
  deleteRowsWhere('Sessions', r => r.username.toLowerCase() === key);
  deleteRowsWhere('Users', r => r.username.toLowerCase() === key);
}

// ===== State sent to the page =====
function state(me) {
  const byUser = {};
  readRows('Users').forEach(u => {
    byUser[u.username.toLowerCase()] = {
      username: u.username,
      dailyGoal: Number(u.dailyGoal) || 0,
      projectTitle: u.projectTitle,
      entries: {}
    };
  });
  readRows('Entries').forEach(e => {
    const u = byUser[e.username.toLowerCase()];
    if (u) u.entries[e.date] = Number(e.words) || 0;
  });
  return {
    ok: true,
    today: today(),
    config: config(),
    me: { username: me.username, isAdmin: isAdmin(me) },
    users: Object.keys(byUser).map(k => byUser[k])
  };
}

function config() {
  return {
    year: YEAR,
    month: MONTH,
    days: DAYS_IN_CHALLENGE,
    start: START_DATE,
    end: END_DATE,
    maxDailyWords: MAX_DAILY_WORDS,
    maxDailyGoal: MAX_DAILY_GOAL,
    registrationOpen: today() <= REGISTRATION_DEADLINE
  };
}

// ===== Helpers =====
function today() {
  return FAKE_TODAY || Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
}

function sheet(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) fail('Setup has not been run. Run setup() in the Apps Script editor.');
  return sh;
}

function readRows(name) {
  const values = sheet(name).getDataRange().getValues();
  const headers = values.shift() || [];
  return values.map((row, i) => {
    const o = { _row: i + 2 };
    headers.forEach((h, j) => { o[h] = normalize(row[j]); });
    return o;
  });
}

function deleteRowsWhere(name, test) {
  const sh = sheet(name);
  readRows(name).filter(test).map(r => r._row).sort((a, b) => b - a).forEach(r => sh.deleteRow(r));
}

function normalize(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TIME_ZONE, 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : String(v);
}

function findUser(name) {
  const key = String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!key) return null;
  return readRows('Users').find(u => u.username.toLowerCase() === key) || null;
}

function mustFindUser(name) {
  const u = findUser(name);
  if (!u) fail('That user doesn’t exist.');
  return u;
}

function cleanUsername(v) {
  const s = String(v || '').trim().replace(/\s+/g, ' ');
  if (s.length < 2 || s.length > 20) fail('Username must be 2 to 20 characters.');
  if (!/^[A-Za-z0-9 _.\-]+$/.test(s)) fail('Username can use letters, numbers, spaces, and _ . -');
  return s;
}

function cleanTitle(v) {
  // Drop leading = + - @ so the Sheet can never read a title as a formula.
  return String(v || '').replace(/\s+/g, ' ').replace(/^[\s=+\-@]+/, '').trim().slice(0, 80);
}

function toInt(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}

function pad(n) {
  return (n < 10 ? '0' : '') + n;
}

function fail(message, code) {
  const e = new Error(message);
  e.userMessage = message;
  e.code = code || '';
  throw e;
}

function failAuth() {
  fail('Your session has ended. Log in again.', 'AUTH');
}
