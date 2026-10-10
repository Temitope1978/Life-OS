/* ============================================================
   Date utilities â€” all relative to the simulated TODAY
   ============================================================ */
(function () {
  'use strict';

  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  var SIM_TODAY = window.SEED.TODAY;

  function parse(iso) {
    if (!iso) return null;
    var p = String(iso).slice(0, 10).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function iso(d) {
    if (!d) return null;
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function addDays(isoStr, n) {
    var d = parse(isoStr);
    if (!d) return null;
    d.setDate(d.getDate() + n);
    return iso(d);
  }
  function daysBetween(fromIso, toIso) {
    var a = parse(fromIso), b = parse(toIso);
    if (!a || !b) return null;
    return Math.round((b - a) / 86400000);
  }
  function today() { return SIM_TODAY; }
  function tomorrow() { return addDays(SIM_TODAY, 1); }
  function weekdayName(isoStr) { var d = parse(isoStr); return d ? DAYS[d.getDay()] : ''; }
  function monthName(isoStr) { var d = parse(isoStr); return d ? MONTHS[d.getMonth()] : ''; }

  /** "22 September" */
  function formatDate(isoStr) {
    var d = parse(isoStr);
    if (!d) return '';
    return d.getDate() + ' ' + MONTHS[d.getMonth()];
  }
  /** "Tuesday, 22 September" */
  function formatLong(isoStr) {
    var d = parse(isoStr);
    if (!d) return '';
    return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  }
  /** "15 Sept" */
  function formatShort(isoStr) {
    var d = parse(isoStr);
    if (!d || isNaN(d.getTime())) return '';
    return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 4);
  }
  /** Relative due label: "Overdue 4 days" / "Today" / "Tomorrow" / "in 3 days" / "Friday" */
  function dueLabel(dueIso) {
    if (!dueIso) return '';
    var diff = daysBetween(SIM_TODAY, dueIso);
    if (diff === null) return '';
    if (diff < 0) {
      var n = Math.abs(diff);
      return 'Overdue ' + n + (n === 1 ? ' day' : ' days');
    }
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff < 7) return weekdayName(dueIso);
    return formatDate(dueIso);
  }
  /** CSS class for due emphasis */
  function dueClass(dueIso) {
    if (!dueIso) return '';
    var diff = daysBetween(SIM_TODAY, dueIso);
    if (diff === null) return '';
    if (diff < 0) return 'over';
    if (diff === 0) return 'today';
    return '';
  }
  function isPast(dueIso) {
    if (!dueIso) return false;
    var diff = daysBetween(SIM_TODAY, dueIso);
    return diff !== null && diff < 0;
  }
  function daysPast(dueIso) {
    var diff = daysBetween(SIM_TODAY, dueIso);
    return (diff !== null && diff < 0) ? Math.abs(diff) : 0;
  }
  /** "22 Sept 2026, 16:42" */
  function formatDateTime(ts) {
    if (!ts) return '';
    var d = parse(String(ts).slice(0, 10));
    if (!d || isNaN(d.getTime())) return '';
    return formatShort(String(ts).slice(0, 10)) + ', ' + String(ts).slice(11, 16);
  }
  /** "Tue" */
  function weekdayShort(isoStr) { var d = parse(isoStr); return d ? DAYS[d.getDay()].slice(0, 3) : ''; }
  /** Day number only */
  function dayNum(isoStr) { var d = parse(isoStr); return d ? String(d.getDate()) : ''; }
  /** Do two same-day events overlap? */
  function overlaps(a, b) {
    if (!a || !b || a.date !== b.date) return false;
    return a.start < b.end && b.start < a.end;
  }
  /** "3 days ago" */
  function agoLabel(isoTs) {
    if (!isoTs) return '';
    var dStr = String(isoTs).slice(0, 10);
    var diff = daysBetween(dStr, SIM_TODAY);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff > 1 && diff < 7) return diff + ' days ago';
    return formatDate(dStr);
  }

  /* ============================================================
     REAL USER-LOCAL CLOCK
     ------------------------------------------------------------
     The seeded narrative stays anchored to the fixed simulated
     today (SIM_TODAY) so the demo is deterministic. These
     functions expose the user's ACTUAL local date, time and
     timezone, detected from the browser via Intl — no hard-coded
     city, country or timezone, and no server timezone. They are
     used for the dashboard clock and the calendar grid only.
     `setRealToday` lets the deterministic self-test pin the
     real date so calendar assertions are reproducible. */
  var REAL_TODAY = null; /* null => use the browser's real local date */

  function realNow() { return new Date(); }
  function realToday() { return REAL_TODAY || iso(realNow()); }
  function setRealToday(isoStr) { REAL_TODAY = isoStr || null; }

  /** IANA timezone name from the browser, e.g. "Europe/Oslo". */
  function timeZone() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz || '';
    } catch (e) { return ''; }
  }
  /** Human-readable timezone, e.g. "Western European Summer Time". */
  function timeZoneLabel() {
    try {
      var parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'long' }).formatToParts(realNow());
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === 'timeZoneName') return parts[i].value;
      }
    } catch (e) { /* fall through */ }
    return timeZone();
  }
  /** Local time, e.g. "14:30". */
  function localTime() {
    try {
      return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(realNow());
    } catch (e) {
      var d = realNow();
      return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }
  }
  /** "4 October 2026" — the user's real local date. */
  function realDateLong() {
    var d = realNow();
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  /** "Sunday" — the user's real local day of week. */
  function realDayName() { return DAYS[realNow().getDay()]; }

  /* ---------- Calendar grid helpers (real local date) ---------- */
  /**
   * Build a month grid for the month containing `todayIso`.
   * Returns { year, month (0-based), startWeekday (0=Sun),
   *   daysInMonth, cells (null=leading/trailing blank), todayIso }.
   * Handles month length and leap years via the Date constructor. */
  function buildMonth(todayIso) {
    var d = parse(todayIso);
    if (!d) return null;
    var year = d.getFullYear();
    var month = d.getMonth();
    var startWeekday = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var cells = [];
    var i;
    for (i = 0; i < startWeekday; i++) cells.push(null);
    for (i = 1; i <= daysInMonth; i++) cells.push(iso(new Date(year, month, i)));
    while (cells.length % 7 !== 0) cells.push(null);
    return { year: year, month: month, startWeekday: startWeekday,
             daysInMonth: daysInMonth, cells: cells, todayIso: iso(d) };
  }
  /** ISO date `n` months away from `isoStr` (day clamped to the target month). */
  function addMonths(isoStr, n) {
    var d = parse(isoStr);
    if (!d) return null;
    var day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    var dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, dim));
    return iso(d);
  }
  /** ISO date for a (year, 0-based month, day) triple. */
  function monthDate(year, month, day) {
    return iso(new Date(year, month, day));
  }

  window.D = {
    parse: parse, iso: iso, addDays: addDays, daysBetween: daysBetween,
    today: today, tomorrow: tomorrow,
    weekdayName: weekdayName, monthName: monthName,
    formatDate: formatDate, formatLong: formatLong, formatShort: formatShort,
    formatDateTime: formatDateTime, weekdayShort: weekdayShort, dayNum: dayNum,
    overlaps: overlaps,
    dueLabel: dueLabel, dueClass: dueClass,
    isPast: isPast, daysPast: daysPast, agoLabel: agoLabel,
    /* real user-local clock */
    realNow: realNow, realToday: realToday, setRealToday: setRealToday,
    timeZone: timeZone, timeZoneLabel: timeZoneLabel,
    localTime: localTime, realDateLong: realDateLong, realDayName: realDayName,
    /* calendar grid */
    buildMonth: buildMonth, addMonths: addMonths, monthDate: monthDate
  };
})();