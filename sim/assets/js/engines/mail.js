/* ============================================================
   Mail Engine — deterministic email classification (rules R-1…R-7)
   See DEMO BUILD SPEC §6.1
   ============================================================ */
(function () {
  'use strict';

  var ACTION_WORDS = ['invoice', 'approval', 'approve', 'document', 'numbers draft',
                      'clause', 'sign-off', 'leave request', 'brief me', 'worth a call',
                      'what do you need', 'template'];
  var DEFER_PHRASES = ['come back to you', 'let me know', 'no rush', 'i will send',
                       'will confirm', 'let me check', 'let us know', 'get back to you',
                       'once i hear', 'i\'ll send', 'i will get back'];
  var MARKETING = ['linkedin', 'stripe', 'growthstack', 'newsletter', 'promo', 'unsub'];
  var AUTOMATED = ['zoom', 'aws', 'figma', 'calendar', 'security', 'verification code', 'receipt'];
  var URGENCY_WORDS = ['urgent', 'suspended', 'verify', 'immediately', 'within 24 hours',
                       'failure to comply', 'permanently'];

  function lower(s) { return String(s || '').toLowerCase(); }
  function countMatches(text, words) {
    var hits = [];
    words.forEach(function (w) { if (text.indexOf(w) !== -1) hits.push(w); });
    return hits;
  }

  /**
   * Classify one email.
   * @returns {{category,confidence,reason,source,actionRequired,suspicious}}
   */
  function classify(email) {
    var subj = lower(email.subject);
    var body = lower(email.body);
    var prev = lower(email.preview);
    var all = subj + ' ' + body + ' ' + prev;
    var sender = lower(email.contactId ? '' : (email.external || ''));
    var fromLine = sender + ' ' + subj;

    var known = !!email.contactId;
    var hasDeadline = !!email.deadline;

    /* R-1 — Suspicious. Unknown sender + urgency/threat language. */
    var urgency = countMatches(all, URGENCY_WORDS);
    if (!known && urgency.length >= 2) {
      return {
        category: 'Suspicious',
        confidence: 'high',
        reason: 'Sender is not a known contact and the message uses threat language (' +
                urgency.slice(0, 3).join(', ') + '). The send address is not on any of your known domains.',
        source: email.subject,
        actionRequired: false,
        suspicious: true
      };
    }

    /* R-2 — Action Required. Request language from a known contact or an internal source. */
    var actionHits = countMatches(all, ACTION_WORDS);
    if (known && actionHits.length >= 1) {
      var reason = 'The sender asked you for something' +
        (hasDeadline ? ' and specified a deadline' : '') + ' — matched "' + actionHits[0] + '"';
      if (hasDeadline) {
        var dd = window.D.daysBetween(window.D.today(), email.deadline);
        if (dd === 0) reason += '. That deadline is today.';
        else if (dd !== null && dd > 0 && dd <= 3) reason += '. That deadline is ' + window.D.dueLabel(email.deadline).toLowerCase() + '.';
      }
      return {
        category: 'Action Required', confidence: 'high', reason: reason,
        source: email.subject, actionRequired: true, suspicious: false
      };
    }
    if (!known && actionHits.length >= 1 && !isMarketing(fromLine, all)) {
      return {
        category: 'Action Required', confidence: 'medium',
        reason: 'The message requests action from you — matched "' + actionHits[0] + '".',
        source: email.subject, actionRequired: true, suspicious: false
      };
    }

    /* R-3 — Waiting. The contact has deferred, or is waiting on us. */
    var deferral = countMatches(all, DEFER_PHRASES);
    if (known && deferral.length >= 1) {
      return {
        category: 'Waiting', confidence: 'high',
        reason: window.Store.contactName(email.contactId) + ' deferred the ball to their side — "' +
                deferral[0] + '". You are waiting on a reply.',
        source: email.subject, actionRequired: false, suspicious: false
      };
    }
    if (known && /^(re: )*re:/.test(subj) && isAwaitingUs(email.contactId)) {
      return {
        category: 'Waiting', confidence: 'high',
        reason: 'This contact is waiting on you — you have an open commitment with ' +
                window.Store.contactName(email.contactId) + '.',
        source: email.subject, actionRequired: false, suspicious: false
      };
    }

    /* R-4 — Urgent. Known contact with a deadline today or overdue. */
    if (known && hasDeadline) {
      var diff = window.D.daysBetween(window.D.today(), email.deadline);
      if (diff !== null && diff <= 0) {
        return {
          category: 'Urgent', confidence: 'high',
          reason: window.Store.contactName(email.contactId) + ' set a deadline of ' +
                  window.D.dueLabel(email.deadline).toLowerCase() + ' (' +
                  (diff < 0 ? window.D.daysPast(email.deadline) + ' days ago' : 'today') + ').',
          source: email.subject, actionRequired: true, suspicious: false
        };
      }
    }

    /* R-5 — Marketing / newsletter. */
    var mkt = countMatches(fromLine, MARKETING);
    if (mkt.length >= 1 || /unsubscribe/.test(all)) {
      return {
        category: /newsletter|outlook|linkedin/.test(all + ' ' + sender) ? 'Newsletter' : 'Promotion',
        confidence: 'high',
        reason: 'Bulk/automated sender (' + (email.external || sender) + ') with unsubscribe language.',
        source: email.subject, actionRequired: false, suspicious: false
      };
    }

    /* R-6 — Automated notifications. */
    if (countMatches(sender, AUTOMATED).length >= 1) {
      var important = /security|new sign-in/i.test(email.subject);
      return {
        category: important ? 'Important' : 'Low Priority',
        confidence: 'high',
        reason: 'Automated notification from ' + (email.external || sender) + ' — no personal response expected.',
        source: email.subject, actionRequired: false, suspicious: false
      };
    }

    /* R-7 — Fallback. */
    return {
      category: 'Low Priority', confidence: 'low',
      reason: 'No action language, deadline, or known commitment detected. Defaulted to low priority — you can re-classify.',
      source: email.subject, actionRequired: false, suspicious: false
    };
  }

  function isMarketing(fromLine, all) {
    return countMatches(fromLine, MARKETING).length >= 1 || /unsubscribe/.test(all);
  }

  /** Is this contact currently awaiting a reply from the user? */
  function isAwaitingUs(contactId) {
    var ks = window.Store.commitments();
    for (var i = 0; i < ks.length; i++) {
      if (ks[i].personId === contactId && ks[i].direction === 'user_to_others' && ks[i].status === 'active') {
        return true;
      }
    }
    return false;
  }

  /** Classify all emails, returning a list with reasons attached. */
  function classifyAll() {
    return window.Store.emails().map(function (e) {
      var c = classify(e);
      return {
        email: e, category: c.category, confidence: c.confidence,
        reason: c.reason, actionRequired: c.actionRequired, suspicious: c.suspicious
      };
    });
  }

  function byCategory() {
    var buckets = {
      'Urgent': [], 'Action Required': [], 'Important': [], 'Waiting': [],
      'Newsletter': [], 'Promotion': [], 'Low Priority': [], 'Suspicious': []
    };
    classifyAll().forEach(function (r) { buckets[r.category].push(r); });
    return buckets;
  }

  window.EnginesMail = {
    classify: classify,
    classifyAll: classifyAll,
    byCategory: byCategory
  };
})();