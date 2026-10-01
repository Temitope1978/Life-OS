/* ============================================================
   Priority Engine — deterministic, explainable scoring
   See DEMO BUILD SPEC §6.3
   ============================================================ */
(function () {
  'use strict';

  function scoreTask(t) {
    var factors = [];
    var score = 0;
    var due = t.dueDate;

    if (due && window.D.isPast(due)) {
      score += 40;
      factors.push({ pts: 40, why: 'Overdue by ' + window.D.daysPast(due) + ' day' + (window.D.daysPast(due) === 1 ? '' : 's') });
    } else if (due) {
      var diff = window.D.daysBetween(window.D.today(), due);
      if (diff === 0) { score += 30; factors.push({ pts: 30, why: 'Due today' }); }
      else if (diff !== null && diff <= 2) { score += 15; factors.push({ pts: 15, why: 'Due ' + window.D.dueLabel(due).toLowerCase() }); }
    }

    if (t.blockedBy) {
      var blocker = window.Store.commitment(t.blockedBy);
      score += 20;
      factors.push({
        pts: 20,
        why: 'Blocked — waiting on ' + (blocker ? blocker.description.toLowerCase() : 'a dependency')
      });
    }

    var c = t.contactId ? window.Store.contact(t.contactId) : null;
    if (c && /client/i.test(c.relationship)) {
      score += 10; factors.push({ pts: 10, why: 'External client (' + c.name + ')' });
    }

    /* "Explicitly marked urgent by the sender" — read from the source, never
       from the user's own priority flag, so the AI and the user cannot inflate
       the score together. */
    if (t.source && t.source.type === 'email') {
      var mail = window.Store.email(t.source.ref);
      if (mail && window.EnginesMail.classify(mail).category === 'Urgent') {
        score += 10;
        factors.push({ pts: 10, why: 'Sender marked this urgent' });
      }
    }

    /* Bands exactly as DEMO BUILD SPEC §6.3: High >= 60, Medium 30-59, Low < 30 */
    var band = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
    return { score: Math.min(100, score), band: band, factors: factors };
  }

  /** Active tasks ranked by priority score, highest first. */
  function ranked() {
    return window.Store.activeTasks().map(function (t) {
      var s = scoreTask(t);
      return { task: t, score: s.score, band: s.band, factors: s.factors };
    }).sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return (a.task.dueDate || '9999').localeCompare(b.task.dueDate || '9999');
    });
  }

  function top(n) { return ranked().slice(0, n || 4); }

  /**
   * Priority items for the Command Center and My Day.
   *
   * High and Medium both count: the seed story deliberately has two High
   * (overdue and blocked) plus two Medium (due today), and the briefing is
   * meant to lead with all four. Low is never surfaced as a priority item.
   */
  function priorityItems() {
    return ranked().filter(function (r) { return r.band !== 'low'; });
  }

  function explain(t) {
    var s = scoreTask(t);
    if (!s.factors.length) return 'No urgency signals — scheduled at low priority.';
    return s.factors.map(function (f) { return f.why + ' (+' + f.pts + ')'; }).join(' · ');
  }

  window.EnginesPriority = {
    scoreTask: scoreTask,
    ranked: ranked,
    top: top,
    priorityItems: priorityItems,
    explain: explain
  };
})();