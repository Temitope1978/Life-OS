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
    if (!d) return '';
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
    if (!d) return '';
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

  window.D = {
    parse: parse, iso: iso, addDays: addDays, daysBetween: daysBetween,
    today: today, tomorrow: tomorrow,
    weekdayName: weekdayName, monthName: monthName,
    formatDate: formatDate, formatLong: formatLong, formatShort: formatShort,
    formatDateTime: formatDateTime, weekdayShort: weekdayShort, dayNum: dayNum,
    overlaps: overlaps,
    dueLabel: dueLabel, dueClass: dueClass,
    isPast: isPast, daysPast: daysPast, agoLabel: agoLabel
  };
})();