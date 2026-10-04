/* ============================================================
   Store — state, mutations and localStorage persistence
   ------------------------------------------------------------
   Seed data is treated as read-only. Everything the user does
   (approvals, rejections, corrections, task changes) lives in a
   separate mutable layer that persists in the browser.
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'lifeos.sim.v1';

  var listeners = [];
  var state = null;

  /* ---------- Mutable layer (persisted) ---------- */
  function defaultMutable() {
    return {
      taskOverrides: {},      /* id -> { status, dueDate, priority, deleted }        */
      newTasks: [],           /* tasks created via approvals                        */
      commitmentDecisions: {},/* id -> { confirmed, rejected, editedDesc, decidedAt } */
      meetingStates: {},      /* id -> { prepDone, transcript }                      */
      emailRead: {},          /* id -> true                                          */
      scamFlagged: {},        /* id -> true (user confirmed a scam)                 */
      repliesSent: {},        /* id -> text                                          */
      eventPrep: {},          /* id -> true                                          */
      followUpStatus: {},     /* id -> status                                        */
      followUpLog: [],        /* follow-up actions taken                             */
      docDone: {},            /* id -> true                                          */
      integrationStatus: {},  /* id -> { status }                                    */
      oneTouchTemplates: [],  /* [{ id, name, useCase, body, recipients[],
                                   conditions, createdAt, consumed, revoked }] */
      actionLog: [],          /* [{ id, at, type, risk, mode, reason, detail }]    */
      permissions: [
        'Read email', 'Read calendar', 'Read documents',
        'Create tasks', 'Draft replies', 'Transcribe meetings'
      ],
      autonomy: 3,
      learnedPrefs: [],
      rejections: [],         /* learning log                                        */
      corrections: [],        /* "that's not my commitment" log                     */
      processed: {}           /* id -> true, for processed AI outputs               */
    };
  }

  function load() {
    var m = defaultMutable();
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return m;
      var parsed = JSON.parse(raw);
      Object.keys(m).forEach(function (k) {
        if (parsed[k] !== undefined) m[k] = parsed[k];
      });
    } catch (e) { /* corrupt storage — fall back to defaults */ }
    return m;
  }

  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state.mutable)); }
    catch (e) { /* quota / private mode — simulation continues without persistence */ }
  }

  /* ---------- Read helpers ---------- */
  function seed() { return window.SEED; }

  function contact(id) {
    if (!id) return null;
    for (var i = 0; i < seed().contacts.length; i++) {
      if (seed().contacts[i].id === id) return seed().contacts[i];
    }
    return null;
  }
  function contactName(id) {
    var c = contact(id);
    return c ? c.name : (id ? 'Unknown contact' : '—');
  }

  /** Tasks = seed tasks (with overrides applied) + user-created tasks */
  function tasks() {
    var out = [];
    seed().tasks.forEach(function (t) {
      var ov = state.mutable.taskOverrides[t.id] || {};
      if (ov.deleted) return;
      var copy = {};
      Object.keys(t).forEach(function (k) { copy[k] = t[k]; });
      if (ov.status) copy.status = ov.status;
      if (ov.dueDate !== undefined) copy.dueDate = ov.dueDate;
      if (ov.priority) copy.priority = ov.priority;
      out.push(copy);
    });
    state.mutable.newTasks.forEach(function (t) { out.push(t); });
    return out;
  }
  function task(id) {
    var all = tasks();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function activeTasks() {
    return tasks().filter(function (t) { return t.status !== 'Completed' && t.status !== 'Cancelled'; });
  }

  /** Commitments with user decisions applied */
  function commitments() {
    return seed().commitments.map(function (k) {
      var copy = {};
      Object.keys(k).forEach(function (x) { copy[x] = k[x]; });
      var d = state.mutable.commitmentDecisions[k.id];
      if (d) {
        if (d.confirmed) { copy.certainty = 'confirmed'; copy.confirmedByUser = true; }
        if (d.rejected) { copy.rejected = true; }
        if (d.editedDesc) { copy.description = d.editedDesc; copy.edited = true; }
      }
      return copy;
    }).filter(function (k) { return !k.rejected; });
  }
  function commitment(id) {
    var all = commitments();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function followUps() {
    return seed().followUps.map(function (f) {
      var copy = {};
      Object.keys(f).forEach(function (x) { copy[x] = f[x]; });
      if (state.mutable.followUpStatus[f.id]) copy.status = state.mutable.followUpStatus[f.id];
      return copy;
    });
  }

  function meetings() {
    return seed().meetings.map(function (m) {
      var copy = {};
      Object.keys(m).forEach(function (x) { copy[x] = m[x]; });
      var st = state.mutable.meetingStates[m.id] || {};
      copy.prepDone = !!st.prepDone;
      if (st.transcript) copy.transcript = st.transcript;   /* user-editable transcript */
      return copy;
    });
  }
  function meeting(id) {
    var all = meetings();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function events() {
    return seed().events.map(function (e) {
      var copy = {};
      Object.keys(e).forEach(function (x) { copy[x] = e[x]; });
      if (state.mutable.eventPrep[e.id]) { copy.prep = true; copy.prepDone = true; }
      return copy;
    });
  }
  function event(id) {
    var all = events();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function emails() {
    return seed().emails.map(function (e) {
      var copy = {};
      Object.keys(e).forEach(function (x) { copy[x] = e[x]; });
      if (state.mutable.emailRead[e.id]) copy.unread = false;
      return copy;
    });
  }
  function email(id) {
    var all = emails();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function documents() {
    return seed().documents.map(function (d) {
      var copy = {};
      Object.keys(d).forEach(function (x) { copy[x] = d[x]; });
      if (state.mutable.docDone[d.id]) copy.done = true;
      return copy;
    });
  }
  function document(id) {
    var all = documents();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function integrations() {
    return seed().integrations.map(function (i) {
      var copy = {};
      Object.keys(i).forEach(function (k) { copy[k] = i[k]; });
      var ov = state.mutable.integrationStatus[i.id];
      if (ov) copy.status = ov.status || copy.status;
      return copy;
    });
  }
  function user() {
    var u = {};
    Object.keys(seed().user).forEach(function (k) { u[k] = seed().user[k]; });
    u.autonomy = state.mutable.autonomy;
    u.learnedPrefs = seed().user.learnedPrefs.concat(state.mutable.learnedPrefs);
    u.permissions = state.mutable.permissions.slice();
    u.oneTouchTemplates = state.mutable.oneTouchTemplates.map(function (t) {
      var c = {}; Object.keys(t).forEach(function (k) { c[k] = t[k]; });
      c.recipients = (t.recipients || []).slice();
      return c;
    });
    return u;
  }

  /** Active (not consumed, not revoked) one-touch templates */
  function oneTouchTemplates() {
    return state.mutable.oneTouchTemplates
      .filter(function (t) { return !t.consumed && !t.revoked; })
      .map(function (t) {
        var c = {}; Object.keys(t).forEach(function (k) { c[k] = t[k]; });
        c.recipients = (t.recipients || []).slice();
        return c;
      });
  }
  function actionLog() {
    return state.mutable.actionLog.map(function (e) {
      var c = {}; Object.keys(e).forEach(function (k) { c[k] = e[k]; });
      return c;
    });
  }

  /** Resolve a source ref to a human label + object */
  function resolveSource(src) {
    if (!src) return { label: 'Unknown source', ref: null, kind: 'unknown' };
    if (src.type === 'meeting') {
      var m = meeting(src.ref);
      return { label: src.label || ('Meeting — ' + (m ? m.title : src.ref)), ref: m, kind: 'meeting', id: src.ref };
    }
    if (src.type === 'email') {
      var e = email(src.ref);
      return { label: src.label || ('Email — ' + (e ? e.subject : src.ref)), ref: e, kind: 'email', id: src.ref };
    }
    if (src.type === 'calendar') {
      var ev = event(src.ref);
      return { label: src.label || ('Calendar — ' + (ev ? ev.title : src.ref)), ref: ev, kind: 'event', id: src.ref };
    }
    if (src.type === 'document') {
      var d = document(src.ref);
      return { label: src.label || ('Document — ' + (d ? d.filename : src.ref)), ref: d, kind: 'document', id: src.ref };
    }
    return { label: src.label || 'Unknown source', ref: null, kind: src.type, id: src.ref };
  }

  /* ---------- Mutations ---------- */
  function uid(prefix) {
    return (prefix || 'x') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /** Append an authorization decision to the audit log. */
  function logAction(action, decision, detail) {
    state.mutable.actionLog.push({
      id: uid('act'),
      at: window.D.today(),
      type: action.type,
      risk: window.Actions ? window.Actions.riskFor(action.type) : 'medium',
      mode: decision.mode,
      reason: decision.reason,
      detail: detail || null
    });
    /* keep the log bounded */
    if (state.mutable.actionLog.length > 200) {
      state.mutable.actionLog = state.mutable.actionLog.slice(-200);
    }
  }

  var mut = {
    setAutonomy: function (level) {
      state.mutable.autonomy = level; commit();
    },
    markPrepared: function (id) {
      state.mutable.eventPrep[id] = true;
      var st = state.mutable.meetingStates[id] || {};
      st.prepDone = true;
      state.mutable.meetingStates[id] = st;
      commit();
    },
    markEmailRead: function (id) { state.mutable.emailRead[id] = true; commit(); },
    markScam: function (id) {
      state.mutable.scamFlagged[id] = true;
      state.mutable.processed['fgt-mail-' + id] = true;
      commit();
    },
    isScam: function (id) { return !!state.mutable.scamFlagged[id]; },
    sendEmail: function (id, body) {
      state.mutable.repliesSent[id] = body || '';
      state.mutable.emailRead[id] = true;
      commit();
    },
    replySent: function (id) { return state.mutable.repliesSent[id] || null; },
    /**
     * The single enforcement point for sending external email
     * (spec §6, §54). Runs the Action Authorization Layer and only
     * sends when the decision permits it.
     *
     *   approve  — the user has approved THIS send (the "Send" click)
     *   onetouch — a valid single-use template covers it; the
     *              authorization is consumed by this send
     *   block    — refuse; nothing is sent
     */
    sendEmailAuthorized: function (id, body, opts) {
      var e = email(id);
      if (!e) return { ok: false, mode: 'block', reason: 'Unknown message.' };
      if (mut.isScam(id)) {
        return { ok: false, mode: 'block', reason: 'This message is held as suspicious and can never be replied to automatically.' };
      }
      var c = e.contactId ? contact(e.contactId) : null;
      var recipient = c ? (c.email || c.name) : (e.external || '');
      var action = {
        type: 'send_external_email',
        recipient: recipient,
        templateId: (opts && opts.templateId) || null
      };
      var decision = window.Actions.decide(action, user());
      logAction(action, decision, e.subject);
      if (decision.mode === 'block') {
        return { ok: false, mode: 'block', reason: decision.reason };
      }
      if (decision.mode === 'onetouch') {
        var tpl = null;
        for (var i = 0; i < state.mutable.oneTouchTemplates.length; i++) {
          if (state.mutable.oneTouchTemplates[i].id === action.templateId) {
            tpl = state.mutable.oneTouchTemplates[i]; break;
          }
        }
        if (tpl) { tpl.consumed = true; tpl.consumedAt = window.D.today(); }
        mut.sendEmail(id, body);
        return { ok: true, mode: 'onetouch', consumedTemplate: action.templateId };
      }
      /* approve mode: the user approved this exact send */
      mut.sendEmail(id, body);
      return { ok: true, mode: 'approve' };
    },
    /** Ask the authorization layer whether an action may proceed.
        A pure query — it records nothing. Only the enforcement
        points (e.g. sendEmailAuthorized) write to the audit log. */
    proposeAction: function (action) {
      return window.Actions.decide(action, user());
    },
    createOneTouchTemplate: function (tpl) {
      var t = {
        id: uid('ot'),
        name: tpl.name || 'Untitled template',
        useCase: tpl.useCase || '',
        body: tpl.body || '',
        recipients: (tpl.recipients || []).slice(),
        conditions: tpl.conditions || '',
        createdAt: window.D.today(),
        consumed: false,
        consumedAt: null,
        revoked: false
      };
      state.mutable.oneTouchTemplates.unshift(t);
      commit();
      return t;
    },
    revokeOneTouchTemplate: function (id) {
      for (var i = 0; i < state.mutable.oneTouchTemplates.length; i++) {
        if (state.mutable.oneTouchTemplates[i].id === id) {
          state.mutable.oneTouchTemplates[i].revoked = true;
          commit();
          return true;
        }
      }
      return false;
    },
    setEventPrep: function (id) { state.mutable.eventPrep[id] = true; commit(); },
    setMeetingPrep: function (id) {
      var st = state.mutable.meetingStates[id] || {};
      st.prepDone = true;
      state.mutable.meetingStates[id] = st; commit();
    },
    updateTranscript: function (id, turns) {
      var st = state.mutable.meetingStates[id] || {};
      st.transcript = turns;
      state.mutable.meetingStates[id] = st; commit();
    },
    saveTranscript: function (id, turns) { mut.updateTranscript(id, turns); },
    updateTask: function (id, patch) {
      var ov = state.mutable.taskOverrides[id] || {};
      Object.keys(patch).forEach(function (k) { ov[k] = patch[k]; });
      state.mutable.taskOverrides[id] = ov; commit();
    },
    createTask: function (task) {
      var t = {
        id: uid('t'),
        title: task.title,
        status: task.status || 'Inbox',
        dueDate: task.dueDate || null,
        priority: task.priority || 'medium',
        source: task.source || null,
        contactId: task.contactId || null,
        project: task.project || null,
        blockedBy: task.blockedBy || null,
        created: window.D.today(),
        userCreated: true
      };
      state.mutable.newTasks.unshift(t);
      commit();
      return t;
    },
    addTask: function (task) { return mut.createTask(task); },
    /** Approve an AI-proposed task */
    approveSuggestion: function (sug) {
      return mut.createTask({
        title: sug.title,
        dueDate: sug.dueDate,
        priority: sug.priority,
        source: sug.source,
        contactId: sug.contactId,
        project: sug.project,
        status: 'Planned'
      });
    },
    decideCommitment: function (id, decision, editedDesc) {
      state.mutable.commitmentDecisions[id] = {
        confirmed: decision === 'confirm',
        rejected: decision === 'ignore',
        editedDesc: editedDesc || null,
        decidedAt: window.D.today()
      };
      if (decision === 'ignore') {
        state.mutable.rejections.push({ kind: 'commitment', id: id, at: window.D.today() });
      }
      commit();
    },
    /** "That's not my commitment." — correction learning */
    correctCommitment: function (id, correctDesc) {
      var k = commitment(id);
      state.mutable.commitmentDecisions[id] = {
        confirmed: false, rejected: true,
        editedDesc: correctDesc || null, decidedAt: window.D.today()
      };
      state.mutable.corrections.push({
        commitmentId: id,
        original: k ? k.description : id,
        corrected: correctDesc || '(removed)',
        at: window.D.today()
      });
      commit();
    },
    ignore: function (kind, id) {
      state.mutable.processed[id] = kind;
      state.mutable.rejections.push({ kind: kind, id: id, at: window.D.today() });
      commit();
    },
    isProcessed: function (id) { return !!state.mutable.processed[id]; },
    confirmCommitment: function (id, on) {
      if (on === false) {
        var d = state.mutable.commitmentDecisions[id] || {};
        d.confirmed = false;
        d.decidedAt = window.D.today();
        state.mutable.commitmentDecisions[id] = d;
        commit();
        return;
      }
      mut.decideCommitment(id, 'confirm');
    },
    setFollowUpStatus: function (id, status) {
      state.mutable.followUpStatus[id] = status; commit();
    },
    /** Chase someone: creates a follow-up record and logs the action. */
    followUp: function (commitmentId, note) {
      var k = commitment(commitmentId);
      state.mutable.followUpLog.push({
        commitmentId: commitmentId,
        personId: k ? k.personId : null,
        note: note || 'Follow-up sent',
        at: window.D.today()
      });
      if (k) {
        var match = seed().followUps.filter(function (f) { return f.contactId === k.personId; })[0];
        if (match) state.mutable.followUpStatus[match.id] = 'followup_due';
      }
      commit();
    },
    followUpLog: function () { return state.mutable.followUpLog; },
    resolveFollowUp: function (id) {
      state.mutable.followUpStatus[id] = 'completed'; commit();
    },
    completeDoc: function (id) { state.mutable.docDone[id] = true; commit(); },
    allow: function (perm) {
      if (state.mutable.permissions.indexOf(perm) === -1) state.mutable.permissions.push(perm);
      commit();
    },
    connectIntegration: function (id) {
      state.mutable.integrationStatus[id] = { status: 'connected', lastSync: 'just now', error: null };
      commit();
    },
    toggleLearnedPref: function (id) {
      var found = null;
      state.mutable.learnedPrefs.forEach(function (p) { if (p.id === id) found = p; });
      if (found) found.on = !found.on;
      commit();
    },
    reset: function () {
      try { window.localStorage.removeItem(KEY); } catch (e) {}
      location.reload();
    }
  };

  /* ---------- Notifications ---------- */
  function notify() { listeners.forEach(function (fn) { fn(); }); }
  function subscribe(fn) { listeners.push(fn); }

  function commit() { save(); notify(); }

  function init() {
    state = { mutable: load() };
  }

  window.Store = {
    init: init,
    subscribe: subscribe,
    seed: seed,
    mutable: function () { return state.mutable; },
    contacts: function () { return seed().contacts; },
    contact: contact, contactName: contactName,
    tasks: tasks, task: task, activeTasks: activeTasks,
    commitments: commitments, commitment: commitment,
    followUps: followUps,
    meetings: meetings, meeting: meeting,
    events: events, event: event,
    emails: emails, email: email,
    documents: documents, document: document,
    integrations: integrations,
    oneTouchTemplates: oneTouchTemplates,
    actionLog: actionLog,
    user: user,
    resolveSource: resolveSource,
    today: function () { return window.D.today(); },
    mut: mut,
    uid: uid
  };
})();