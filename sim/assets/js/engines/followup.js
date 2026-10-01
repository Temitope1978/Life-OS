/* ============================================================
   Follow-Up Engine + Waiting-For state machine
   See DEMO BUILD SPEC §5 (Waiting For is a distinct state)
   ============================================================ */
(function () {
  'use strict';

  var STATUSES = [
    { id: 'waiting',      label: 'Waiting',        chip: 'muted' },
    { id: 'followup_due', label: 'Follow-up due',  chip: 'danger' },
    { id: 'responded',    label: 'Responded',      chip: 'success' },
    { id: 'completed',    label: 'Completed',      chip: 'success' },
    { id: 'cancelled',    label: 'Cancelled',      chip: 'muted' },
    { id: 'unknown',      label: 'Unknown',        chip: 'warn' }
  ];

  function statusMeta(id) {
    for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i].id === id) return STATUSES[i];
    return STATUSES[0];
  }

  /**
   * Derive follow-up state from data rather than trusting the stored status.
   * An item is "followup_due" when its due date has passed and it is still open.
   */
  function followUps() {
    return window.Store.followUps().map(function (f) {
      var copy = {};
      Object.keys(f).forEach(function (k) { copy[k] = f[k]; });

      if (copy.status === 'responded' || copy.status === 'completed' || copy.status === 'cancelled') {
        copy.derived = copy.status;
      } else if (copy.dueDate && window.D.isPast(copy.dueDate)) {
        copy.status = 'followup_due';
        copy.derived = 'followup_due';
        copy.daysOverdue = window.D.daysPast(copy.dueDate);
      } else {
        copy.derived = copy.status;
      }
      copy.meta = statusMeta(copy.status);
      copy.person = window.Store.contact(copy.contactId);
      return copy;
    }).sort(function (a, b) {
      var rank = { followup_due: 0, waiting: 1, unknown: 2, responded: 3, completed: 4, cancelled: 5 };
      var d = (rank[a.derived] || 9) - (rank[b.derived] || 9);
      if (d !== 0) return d;
      return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
    });
  }

  /** Open items only — the "Who Am I Waiting For" list. */
  function waitingOn() {
    return followUps().filter(function (f) {
      return f.derived === 'waiting' || f.derived === 'followup_due';
    });
  }

  function overdue() {
    return followUps().filter(function (f) { return f.derived === 'followup_due'; });
  }

  function dueToday() {
    return followUps().filter(function (f) {
      return f.dueDate === window.D.today() && f.derived !== 'completed';
    });
  }

  /** Commitments others owe, with their person and state. */
  function othersOwedDetailed() {
    return window.EnginesCommitment.othersOwed().map(function (k) {
      var p = window.Store.contact(k.personId);
      return {
        commitment: k,
        person: p,
        overdue: k.dueDate ? window.D.isPast(k.dueDate) : false,
        daysOverdue: k.dueDate ? window.D.daysPast(k.dueDate) : 0,
        noDate: !k.dueDate
      };
    }).sort(function (a, b) {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return (a.commitment.dueDate || '9999').localeCompare(b.commitment.dueDate || '9999');
    });
  }

  /** Distinct statuses available for a follow-up. */
  function nextStatuses(f) {
    return STATUSES.filter(function (s) {
      return s.id !== f.status;
    });
  }

  window.EnginesFollowUp = {
    STATUSES: STATUSES,
    statusMeta: statusMeta,
    followUps: followUps,
    waitingOn: waitingOn,
    overdue: overdue,
    dueToday: dueToday,
    othersOwedDetailed: othersOwedDetailed,
    nextStatuses: nextStatuses
  };
})();