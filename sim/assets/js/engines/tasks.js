/* ============================================================
   Task Engine — dependencies, reminders, My Day grouping
   ============================================================ */
(function () {
  'use strict';

  var STATES = ['Inbox', 'Planned', 'In Progress', 'Waiting', 'Completed', 'Overdue', 'Cancelled'];

  /** Blocker detail for a task, or null. */
  function blocker(t) {
    if (!t.blockedBy) return null;
    var k = window.Store.commitment(t.blockedBy);
    if (!k) return null;
    return {
      commitment: k,
      person: window.Store.contact(k.personId),
      overdue: k.dueDate ? window.D.isPast(k.dueDate) : false,
      daysWaiting: k.dueDate ? window.D.daysBetween(k.dueDate, window.D.today()) : null
    };
  }

  /** Dependency insight — "The proposal is due Friday, but you are waiting for John's pricing." */
  function dependencyInsight(t) {
    var b = blocker(t);
    if (!b) return null;
    var p = b.person;
    var txt = 'Blocked — waiting on ' +
      (p ? p.name : 'someone') + ' to send ' +
      (b.commitment.description.split(' to send ').pop() || b.commitment.description.toLowerCase()) + '.';
    if (b.overdue) {
      txt += ' That has been outstanding for ' + window.D.daysPast(b.commitment.dueDate) + ' days.';
    }
    return {
      text: txt,
      suggestion: p ? 'Follow up with ' + p.name.split(' ')[0] + '?' : 'Follow up?',
      contactId: p ? p.id : null,
      commitment: b.commitment
    };
  }

  /** Overdue: tasks whose due date has passed but are not complete. */
  function overdue() {
    return window.Store.activeTasks().filter(function (t) {
      return t.dueDate && window.D.isPast(t.dueDate);
    });
  }

  /** Due today or overdue. */
  function dueSoon() {
    return window.Store.activeTasks().filter(function (t) {
      if (!t.dueDate) return false;
      var d = window.D.daysBetween(window.D.today(), t.dueDate);
      return d !== null && d <= 1;
    });
  }

  function eventsToday() {
    var today = window.D.today();
    return window.Store.events().filter(function (e) { return e.date === today; })
      .sort(function (a, b) { return a.start.localeCompare(b.start); });
  }
  function eventsTomorrow() {
    var tmr = window.D.tomorrow();
    return window.Store.events().filter(function (e) { return e.date === tmr; })
      .sort(function (a, b) { return a.start.localeCompare(b.start); });
  }
  /** Events on a given date, ordered by start time. */
  function eventsFor(date) {
    return window.Store.events().filter(function (e) { return e.date === date; })
      .sort(function (a, b) { return a.start.localeCompare(b.start); });
  }
  /** Meetings within the next 24 hours needing preparation. */
  function needsPrep() {
    return window.Store.events().filter(function (e) {
      return e.prep && !e.prepDone;
    }).sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
  }

  /** Overlapping events on the same date. */
  function conflicts() {
    var out = [];
    var byDate = {};
    window.Store.events().forEach(function (e) { (byDate[e.date] = byDate[e.date] || []).push(e); });
    Object.keys(byDate).forEach(function (date) {
      var list = byDate[date].slice().sort(function (a, b) { return a.start.localeCompare(b.start); });
      for (var i = 0; i < list.length - 1; i++) {
        for (var j = i + 1; j < list.length; j++) {
          if (list[i].start < list[j].end && list[j].start < list[i].end) {
            out.push({ date: date, a: list[i], b: list[j] });
          }
        }
      }
    });
    return out;
  }

  /** Tasks whose source is a given email — used by "turn this email into a task". */
  function tasksFromEmail(emailId) {
    return window.Store.tasks().filter(function (t) {
      return t.source && t.source.type === 'email' && t.source.ref === emailId;
    });
  }

  /** Tasks due on a given date, ordered by due time (nulls first). */
  function tasksFor(date) {
    return window.Store.tasks().filter(function (t) {
      return t.dueDate && t.dueDate === date && t.status !== 'Completed' && t.status !== 'Cancelled';
    }).sort(function (a, b) {
      var at = a.dueTime || '', bt = b.dueTime || '';
      return at.localeCompare(bt);
    });
  }

  /** Reminders due (simulated clock: today's reminders). */
  function remindersDue() {
    return window.SEED.reminders.filter(function (r) {
      return !r.done && r.dueAt.slice(0, 10) <= window.D.today();
    });
  }

  window.EnginesTasks = {
    STATES: STATES,
    blocker: blocker,
    dependencyInsight: dependencyInsight,
    overdue: overdue,
    dueSoon: dueSoon,
    eventsToday: eventsToday,
    eventsTomorrow: eventsTomorrow,
    eventsFor: eventsFor,
    needsPrep: needsPrep,
    conflicts: conflicts,
    tasksFromEmail: tasksFromEmail,
    tasksFor: tasksFor,
    remindersDue: remindersDue
  };
})();