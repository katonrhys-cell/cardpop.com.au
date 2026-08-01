/**
 * CardPop — Weekly Ops Dashboard (Google Apps Script)
 * =====================================================
 * Appends one row per week to the "Weekly Metrics" tab of the
 * "CardPop — Weekly Ops Dashboard" spreadsheet, pulling live numbers from:
 *
 *   - Google Search Console  (clicks / impressions / CTR / avg position)   [no secret — uses your Google login]
 *   - Stripe                 (gross sales + payment count, last 7 days)     [Script Property: STRIPE_API_KEY]
 *   - Sentry                 (error events, last 7 days)                    [Script Properties: SENTRY_AUTH_TOKEN, SENTRY_ORG]
 *   - Supabase               (new users, active listings)  — optional       [Script Property: SUPABASE_SERVICE_KEY]
 *
 * Each source is independent: if its Script Property isn't set it's simply
 * left blank, and if a source errors the run still completes — the error is
 * recorded in the row's "Notes" column instead of aborting the whole snapshot.
 *
 * SETUP: see docs/ops-dashboard.md. In short — paste this file + appsscript.json
 * into the sheet's Apps Script project, add the Script Properties you want,
 * then run `setup` once (authorises + arms the weekly trigger).
 */

const SHEET_NAME = 'Weekly Metrics';

// Search Console property. This is the URL-prefix property for the site; if you
// use a Domain property instead, change this to 'sc-domain:cardpop.com.au'.
const GSC_SITE_URL = 'https://cardpop.com.au/';

const SUPABASE_URL = 'https://vrfsaazuqjxotnieqlkd.supabase.co';

const HEADERS = [
  'Week ending',
  'Run at',
  'GSC clicks (7d)',
  'GSC impressions (7d)',
  'GSC CTR %',
  'GSC avg position',
  'Stripe gross (7d, AUD)',
  'Stripe payments (7d)',
  'Sentry errors (7d)',
  'Supabase new users (7d)',
  'Supabase active listings',
  'Notes',
];

// ---------------------------------------------------------------------------
// Menu + setup
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('CardPop Ops')
    .addItem('Set up (sheet + weekly trigger)', 'setup')
    .addItem('Run snapshot now', 'weeklySnapshot')
    .addToUi();
}

/** Run once. Builds the sheet, then arms the weekly trigger. */
function setup() {
  setupSheet_();
  createWeeklyTrigger_();
  SpreadsheetApp.getActiveSpreadsheet()
    .toast('Setup complete — snapshot will run every Monday ~08:00 (Australia/Melbourne).', 'CardPop Ops', 8);
}

function setupSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  } else {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#0b3d91')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, HEADERS.length);

  // Drop the default empty "Sheet1" if it's still around and unused.
  const def = ss.getSheetByName('Sheet1');
  if (def && def.getName() !== SHEET_NAME && def.getLastRow() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(def);
  }
  return sheet;
}

function createWeeklyTrigger_() {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === 'weeklySnapshot') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('weeklySnapshot')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();
}

// ---------------------------------------------------------------------------
// The weekly snapshot
// ---------------------------------------------------------------------------

function weeklySnapshot() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || setupSheet_();
  const notes = [];

  const gsc = safe_(fetchGsc_, notes, 'GSC');
  const stripe = safe_(fetchStripe_, notes, 'Stripe');
  const sentry = safe_(fetchSentry_, notes, 'Sentry');
  const supa = safe_(fetchSupabase_, notes, 'Supabase');

  const row = [
    daysAgoIso_(1), // week ending = yesterday
    new Date(),
    gsc ? gsc.clicks : '',
    gsc ? gsc.impressions : '',
    gsc ? round2_(gsc.ctr * 100) : '',
    gsc ? round2_(gsc.position) : '',
    stripe ? stripe.gross : '',
    stripe ? stripe.count : '',
    sentry ? sentry.errors : '',
    supa && supa.newUsers != null ? supa.newUsers : '',
    supa && supa.activeListings != null ? supa.activeListings : '',
    notes.join(' | '),
  ];

  sheet.appendRow(row);
  sheet.autoResizeColumns(1, HEADERS.length);
}

/** Runs fn; on throw records the message in notes and returns null. */
function safe_(fn, notes, label) {
  try {
    return fn();
  } catch (e) {
    notes.push(label + ': ' + (e && e.message ? e.message : e));
    return null;
  }
}

// ---------------------------------------------------------------------------
// Data sources
// ---------------------------------------------------------------------------

/** Google Search Console — totals over the last 7 full days (allowing for the ~2-day data lag). */
function fetchGsc_() {
  const startDate = daysAgoIso_(9);
  const endDate = daysAgoIso_(2);
  const url = 'https://www.googleapis.com/webmasters/v3/sites/'
    + encodeURIComponent(GSC_SITE_URL) + '/searchAnalytics/query';
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({ startDate, endDate }), // no dimensions => grand totals
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error(res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
  }
  const data = JSON.parse(res.getContentText());
  const r = (data.rows && data.rows[0]) || {};
  return {
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  };
}

/** Stripe — gross of succeeded, non-refunded charges in the last 7 days. */
function fetchStripe_() {
  const key = prop_('STRIPE_API_KEY');
  if (!key) return null; // not configured -> leave blank, no note
  const gte = Math.floor((Date.now() - 7 * 24 * 3600 * 1000) / 1000);
  let grossCents = 0;
  let count = 0;
  let startingAfter = null;
  let guard = 0;
  do {
    let url = 'https://api.stripe.com/v1/charges?limit=100&created[gte]=' + gte;
    if (startingAfter) url += '&starting_after=' + startingAfter;
    const res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + key },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      throw new Error(res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
    }
    const data = JSON.parse(res.getContentText());
    (data.data || []).forEach((ch) => {
      if (ch.paid && !ch.refunded && ch.status === 'succeeded') {
        grossCents += ch.amount;
        count += 1;
      }
    });
    startingAfter = data.has_more && data.data.length ? data.data[data.data.length - 1].id : null;
  } while (startingAfter && ++guard < 20);
  return { gross: round2_(grossCents / 100), count };
}

/** Sentry — total error events over the last 7 days (matches the weekly email's "Total Errors"). */
function fetchSentry_() {
  const token = prop_('SENTRY_AUTH_TOKEN');
  const org = prop_('SENTRY_ORG');
  if (!token || !org) return null;
  const url = 'https://sentry.io/api/0/organizations/' + encodeURIComponent(org)
    + '/stats_v2/?category=error&field=sum(quantity)&interval=1d&statsPeriod=7d';
  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error(res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
  }
  const data = JSON.parse(res.getContentText());
  let total = 0;
  (data.groups || []).forEach((g) => {
    const series = (g.series && g.series['sum(quantity)']) || [];
    series.forEach((n) => { total += Number(n) || 0; });
  });
  return { errors: total };
}

/** Supabase — optional business metrics. Requires the service role key. */
function fetchSupabase_() {
  if (!prop_('SUPABASE_SERVICE_KEY')) return null;
  const gte = daysAgoIso_(7) + 'T00:00:00Z';
  const out = {};
  // Each metric is best-effort: a wrong table/column name yields blank, not a crash.
  try { out.newUsers = supaCount_('profiles?select=id&created_at=gte.' + encodeURIComponent(gte)); }
  catch (e) { out.newUsers = null; }
  try { out.activeListings = supaCount_('listings?select=id&status=eq.active'); }
  catch (e) { out.activeListings = null; }
  return out;
}

/** Exact row count for a PostgREST query via the Content-Range header. */
function supaCount_(pathAndQuery) {
  const key = prop_('SUPABASE_SERVICE_KEY');
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/' + pathAndQuery, {
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      Prefer: 'count=exact',
      Range: '0-0',
    },
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code !== 200 && code !== 206) {
    throw new Error(code + ' ' + res.getContentText().slice(0, 200));
  }
  const headers = res.getHeaders();
  const cr = headers['content-range'] || headers['Content-Range'] || '';
  const total = cr.split('/')[1];
  return total && total !== '*' ? parseInt(total, 10) : null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function prop_(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}

function daysAgoIso_(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}

function round2_(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
