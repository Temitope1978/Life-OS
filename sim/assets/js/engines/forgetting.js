/* ============================================================
   Forgetting Engine — cross-checks all sources for gaps
   See DEMO BUILD SPEC §6.4
   ============================================================ */
(function () {
  'use strict';

  /** The rules, surfaced in the UI so the AI is never a black box. */
  var EXPLAINERS = {
    'F-1': 'A promise you made has passed its deadline and no completed task covers it.',
    'F-2': 'You committed to something in a meeting, it is due within 72 hours, and nothing has started.',
    'F-3': 'A meeting is within 24 hours and has no preparation.',
    'F-4': 'A follow-up you owe is overdue and is not already tracked as a commitment.',
    'F-5': 'An email asked for something by a date, and no task was ever created from it.',
    'F-6': 'A task has been sitting in Waiting for more than 5 days without a chase.'
  };

  /**
   * Turn a commitment description into a noun phrase.
   * "Send the revised ABC proposal" -> "the revised ABC proposal"
   * "Send supplier summary to Mary" -> "the supplier summary"
   */
  function nounPhrase(description, personName) {
    var s = String(description || '');
    if (personName) {
      var names = personName.split(' ').filter(Boolean);
      names.forEach(function (n) {
        s = s.replace(new RegExp('\\s+to\\s+' + n + '$', 'i'), '');
      });
    }
    s = s.replace(/^(send|share|deliver|reply to|follow up on|prepare|draft|review|approve|confirm)\s+/i, '');
    s = s.replace(/^(the|a|an)\s+/i, '');
    s = s.trim();
    return 'the ' + (s ? s.charAt(0).toLowerCase() + s.slice(1) : 'thing');
  }

  /** Best-effort date from a source label such as "Meeting — Kickoff, 15 Sept". */
  function dateFromLabel(label) {
    if (!label) return null;
    var m = String(label).match(/(\d{1,2})\s+([A-Za-z]{3,9})/);
    if (!m) return null;
    var months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    var mi = months.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi === -1) return null;
    /* Source labels describe something that already happened, so a date later
       than today belongs to the previous year — never the next one. */
    var base = window.D.parse(window.D.today());
    var candidate = new Date(base.getFullYear(), mi, Number(m[1]));
    if (candidate > base) candidate = new Date(base.getFullYear() - 1, mi, Number(m[1]));
    return window.D.iso(candidate);
  }

  /**
   * Detect items the user may have forgotten.
   *
   * Rules (in priority order):
   *   F-1  An overdue commitment the user owes, with no completed task
   *   F-2  A commitment made in a meeting, due within 72h, not started
   *   F-3  A meeting within 24h that needs preparation and has none
   *   F-4  A follow-up overdue where no commitment is already tracked
   *        (avoids duplicating F-1)
   *   F-5  An email with an extracted deadline and no linked task
   *   F-6  A task Waiting on someone for more than 5 days
   */
  function detect() {
    var out = [];
    var tasks = window.Store.tasks();
    var byCommit = {};
    tasks.forEach(function (t) { if (t.source) byCommit[t.source.type + ':' + t.source.ref] = t; });

    /* ---- F-1: overdue commitment the user owes ---- */
    window.EnginesCommitment.userOwed().forEach(function (k) {
      if (!k.dueDate || !window.D.isPast(k.dueDate)) return;
      var linked = tasks.filter(function (t) {
        return t.blockedBy === k.id ||
               (t.source && t.source.type === k.source.type && t.source.ref === k.source.ref);
      });
      var done = linked.some(function (t) { return t.status === 'Completed'; });
      if (done) return;
      var p = window.Store.contact(k.personId);
      var days = window.D.daysPast(k.dueDate);
      var promisedOn = dateFromLabel(k.source && k.source.label);
      out.push({
        id: 'fgt-' + k.id,
        rule: 'F-1',
        title: (p ? p.name.split(' ')[0] : 'Someone') + ' is waiting for ' +
               nounPhrase(k.description, p ? p.name : null),
        detail: 'You committed on ' + (promisedOn ? window.D.formatDate(promisedOn) : 'an earlier conversation') +
                '. It is ' + days + ' day' + (days === 1 ? '' : 's') + ' overdue' +
                (linked.length ? ' and the task is still "' + linked[0].status + '".' : ' and no task exists.'),
        source: k.source,
        confidence: k.confidence,
        dueDate: k.dueDate,
        contactId: k.personId,
        commitmentId: k.id,
        project: p ? 'ABC proposal' : null,
        priority: 'high',
        task: {
          title: k.description,
          dueDate: k.dueDate,
          priority: 'high',
          source: k.source,
          contactId: k.personId
        }
      });
    });

    /* ---- F-2: meeting commitment due soon, not started ---- */
    window.EnginesCommitment.userOwed().forEach(function (k) {
      if (!k.dueDate) return;
      var diff = window.D.daysBetween(window.D.today(), k.dueDate);
      if (diff === null || diff < 0 || diff > 3) return;
      if (k.source && k.source.type !== 'meeting') return;   /* email commitments are visible */
      var linked = tasks.filter(function (t) {
        return t.blockedBy === k.id || (t.source && t.source.type === 'meeting' && t.source.ref === (k.source && k.source.ref));
      });
      var notStarted = linked.some(function (t) { return t.status === 'Inbox' || t.status === 'Planned'; });
      if (!notStarted) return;
      var p = window.Store.contact(k.personId);
      out.push({
        id: 'fgt-' + k.id + '-soon',
        rule: 'F-2',
        title: 'You promised ' + (p ? p.name.split(' ')[0] : 'someone') + ' ' +
               nounPhrase(k.description, p ? p.name : null),
        detail: 'Agreed verbally in a meeting — no email reminder exists. Due ' +
                window.D.dueLabel(k.dueDate).toLowerCase() + '. The task is still "' +
                (linked[0] ? linked[0].status : 'not started') + '".',
        source: k.source,
        confidence: k.confidence,
        dueDate: k.dueDate,
        contactId: k.personId,
        commitmentId: k.id,
        priority: 'high',
        task: { title: k.description, dueDate: k.dueDate, priority: 'high', source: k.source, contactId: k.personId }
      });
    });

    /* ---- F-3: meeting within 24h needing preparation ---- */
    var tmr = window.D.tomorrow();
    window.Store.events().forEach(function (e) {
      if (!e.prep || e.prepDone) return;
      if (e.date !== tmr) return;
      var hasTask = tasks.some(function (t) {
        return t.source && t.source.type === 'calendar' && t.source.ref === e.id;
      });
      var names = e.attendeeIds.map(function (id) { return window.Store.contactName(id); }).join(', ');
      out.push({
        id: 'fgt-evt-' + e.id,
        rule: 'F-3',
        title: 'Your ' + window.D.formatDate(e.date) + ' ' + e.start + ' meeting with ' + names + ' needs preparation',
        detail: 'This meeting has no agenda and no briefing prepared' +
                (hasTask ? '. A task exists but preparation has not been started.' : '.'),
        source: { type: 'calendar', ref: e.id, label: 'Calendar — ' + e.title + ', ' + window.D.formatDate(e.date) },
        confidence: 'high',
        dueDate: e.date,
        contactId: e.attendeeIds[0] || null,
        priority: 'high',
        task: {
          title: 'Prepare ' + e.title,
          dueDate: e.date,
          priority: 'high',
          source: { type: 'calendar', ref: e.id },
          contactId: e.attendeeIds[0] || null
        }
      });
    });

    /* ---- F-4: overdue follow-up with no tracked commitment ---- */
    window.EnginesFollowUp.overdue().forEach(function (f) {
      var hasCommitment = window.Store.commitments().some(function (k) { return k.personId === f.contactId; });
      if (hasCommitment) return;    /* already represented — avoid duplicate noise */
      out.push({
        id: 'fgt-fu-' + f.id,
        rule: 'F-4',
        title: 'Follow up with ' + (f.person ? f.person.name : 'someone') + ' — ' + f.subject.toLowerCase(),
        detail: (f.detail || '') + ' Overdue by ' + f.daysOverdue + ' days.',
        source: f.source,
        confidence: 'high',
        dueDate: f.dueDate,
        contactId: f.contactId,
        priority: 'high',
        task: {
          title: 'Follow up with ' + (f.person ? f.person.name : 'contact') + ' — ' + f.subject,
          dueDate: window.D.today(),
          priority: 'medium',
          source: f.source,
          contactId: f.contactId
        }
      });
    });

    /* ---- F-5: email deadline with no linked task ---- */
    window.EnginesMail.classifyAll().forEach(function (r) {
      if (!r.email.deadline) return;
      if (!r.actionRequired) return;
      if (r.suspicious) return;
      var linked = window.EnginesTasks.tasksFromEmail(r.email.id);
      if (linked.length) return;
      /* already represented by a higher-priority finding for the same person */
      if (out.some(function (i) { return i.contactId && i.contactId === r.email.contactId; })) return;
      var p = window.Store.contact(r.email.contactId);
      out.push({
        id: 'fgt-mail-' + r.email.id,
        rule: 'F-5',
        title: (p ? 'Reply to ' + p.name.split(' ')[0] : 'Reply') + ' — ' + r.email.subject,
        detail: r.reason + ' No task has been created from this email.',
        source: { type: 'email', ref: r.email.id, label: 'Email — ' + (p ? p.name : r.email.external) + ', ' + window.D.agoLabel(r.email.received) },
        confidence: r.confidence,
        dueDate: r.email.deadline,
        contactId: r.email.contactId,
        priority: 'medium',
        task: {
          title: r.email.subject,
          dueDate: r.email.deadline,
          priority: 'medium',
          source: { type: 'email', ref: r.email.id },
          contactId: r.email.contactId
        }
      });
    });

    /* ---- F-6: task Waiting > 5 days ---- */
    tasks.forEach(function (t) {
      if (t.status !== 'Waiting') return;
      var created = t.created;
      if (!created) return;
      var waited = window.D.daysBetween(created, window.D.today());
      if (waited === null || waited <= 5) return;
      /* the dependency is already reported by a stronger rule — avoid noise */
      if (t.blockedBy && out.some(function (i) { return i.commitmentId === t.blockedBy; })) return;
      if (out.some(function (i) { return i.contactId && i.contactId === t.contactId; })) return;
      var b = window.EnginesTasks.blocker(t);
      out.push({
        id: 'fgt-wait-' + t.id,
        rule: 'F-6',
        title: '"' + t.title + '" has been waiting ' + waited + ' days',
        detail: (b ? 'Blocked on ' + (b.person ? b.person.name : 'someone') + '. ' : '') +
                'Status has been Waiting since ' + window.D.formatDate(created) + '.',
        source: t.source,
        confidence: 'medium',
        dueDate: t.dueDate,
        contactId: t.contactId,
        priority: 'low',
        task: { title: 'Chase ' + t.title.toLowerCase(), dueDate: window.D.today(), priority: 'low', source: t.source, contactId: t.contactId }
      });
    });

    /* de-duplicate by id, then drop anything the user already handled */
    var seen = {};
    return out.filter(function (i) {
      if (seen[i.id]) return false;
      seen[i.id] = true;
      return !window.Store.mut.isProcessed(i.id);
    });
  }

  window.EnginesForgetting = { detect: detect, EXPLAINERS: EXPLAINERS };
})();