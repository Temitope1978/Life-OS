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

  /* ---------- Per-user scope ----------
     The browser-persisted layer is namespaced per authenticated user
     so that signing out and signing in as somebody else can never
     show the previous user's local approvals, notes or tasks.
     IMPORTANT: this is HYGIENE, not the security boundary. The
     security boundary for real accounts is the server: Supabase Auth
     for identity and Row Level Security (user_id = auth.uid()) for
     every record. Browser storage is never treated as a trust
     boundary anywhere in this app. */
  var scopeId = null;

  function storageKey() { return scopeId ? KEY + '.' + scopeId : KEY; }

  /* ---------- Mutable layer (persisted) ---------- */
  function defaultMutable() {
    return {
      taskOverrides: {},      /* id -> { status, dueDate, priority, deleted }        */
      newTasks: [],           /* tasks created via approvals                        */
      commitmentDecisions: {},/* id -> { confirmed, rejected, editedDesc, decidedAt } */
      meetingStates: {},      /* id -> { prepDone, transcript }                      */
      userMeetings: [],       /* meetings the user recorded/uploaded themselves     */
      emailRead: {},          /* id -> true                                          */
      emailCategory: {},      /* id -> category (user re-classification override)    */
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
      var raw = window.localStorage.getItem(storageKey());
      if (!raw) return m;
      var parsed = JSON.parse(raw);
      Object.keys(m).forEach(function (k) {
        if (parsed[k] !== undefined) m[k] = parsed[k];
      });
    } catch (e) { /* corrupt storage — fall back to defaults */ }
    return m;
  }

  function save() {
    try { window.localStorage.setItem(storageKey(), JSON.stringify(state.mutable)); }
    catch (e) { /* quota / private mode — simulation continues without persistence */ }
  }

  /* Switch the persisted layer to another authenticated user (or to
     the signed-out scope). The previous user's records are SAVED under
     their own key - logging out never erases them - but they are
     dropped from memory so the next account cannot see them. */
  function setUserScope(userId) {
    var next = userId || null;
    if (scopeId === next) return false;
    if (state) save();                       /* persist under the OLD scope */
    scopeId = next;
    state = { mutable: load() };            /* start from the new scope   */
    clearRemoteState();                     /* no cached rows cross users */
    notify();
    return true;
  }

  function currentScope() { return scopeId; }


  /* ---------- Remote task persistence (live mode) ----------
     In live mode, user-created tasks are written to and read from the
     public.tasks table (RLS-enforced). Demo mode keeps the existing
     localStorage behaviour unchanged. The remote list is loaded once
     after the auth session is restored; tasks() stays synchronous by
     merging seed + remote + local. */
  var remoteTasks = [];
  var remoteLoaded = false;
  var remoteError = null;
  var lastRemoteUserId = null;

  function isLiveMode() {
    var m = (window.Config && (window.Config.get('LIFEOS_MODE') || window.Config.get('LIFEOS_ENV'))) || '';
    m = String(m || 'demo').toLowerCase();
    return m === 'live' || m === 'production';
  }
  function currentUserId() {
    var id = (window.Identity && window.Identity.current) ? window.Identity.current().userId : null;
    if (id) return id;
    var u = (window.Session && window.Session.currentUser) ? window.Session.currentUser() : null;
    return (u && u.userId) || null;
  }
  function supabaseClient() {
    return (window.SupabaseAuth && typeof window.SupabaseAuth.client === 'function')
      ? window.SupabaseAuth.client() : null;
  }
  /* True for UUID strings only. The app's display fields (project
     names, legacy contact keys like 'c1', dependency keys like 'k2')
     are NOT valid foreign keys — sending them to uuid columns fails
     the insert, so they are nulled remotely and kept as local
     display overlays instead. */
  function isUuid(v) {
    return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  }
  /* Bidirectional status vocabulary: UI labels <-> public.tasks CHECK
     values. Round-trips are stable both ways. */
  var STATUS_TO_DB = {
    'Inbox': 'open', 'Planned': 'deferred', 'In Progress': 'in_progress',
    'Waiting': 'blocked', 'Completed': 'completed', 'Cancelled': 'cancelled',
    'Overdue': 'open',
    'open': 'open', 'in_progress': 'in_progress', 'blocked': 'blocked',
    'completed': 'completed', 'cancelled': 'cancelled', 'deferred': 'deferred'
  };
  var STATUS_FROM_DB = {
    'open': 'Inbox', 'deferred': 'Planned', 'in_progress': 'In Progress',
    'blocked': 'Waiting', 'completed': 'Completed', 'cancelled': 'Cancelled'
  };
  function toDbPriority(p) {
    if (p === 'high') return 80;
    if (p === 'low') return 20;
    if (typeof p === 'number' && isFinite(p)) return Math.max(0, Math.min(100, Math.round(p)));
    return 50;
  }
  function toDbSource(s) {
    if (s && typeof s === 'object') s = s.type;
    var valid = ['email', 'meeting', 'manual', 'followup', 'ai_suggested'];
    s = (s === undefined || s === null) ? 'manual' : String(s);
    return valid.indexOf(s) !== -1 ? s : 'manual';
  }
  /* Map the store's task shape to the public.tasks schema. */
  function toDbTask(t, userId) {
    var createdAt = null;
    if (t.created) {
      var cd = new Date(t.created.length > 10 ? t.created : t.created + 'T00:00:00Z');
      if (!isNaN(cd.getTime())) createdAt = cd.toISOString();
    }
    return {
      task_id: t.id,
      user_id: userId,
      title: t.title,
      description: t.description || null,
      status: STATUS_TO_DB[t.status] || 'open',
      priority: toDbPriority(t.priority),
      due_date: t.dueDate || null,
      source: toDbSource(t.source),
      project_id: isUuid(t.project) ? t.project : null,
      contact_id: isUuid(t.contactId) ? t.contactId : null,
      dependency_id: isUuid(t.blockedBy) ? t.blockedBy : null,
      created_at: createdAt
    };
  }
  /* Restore the in-memory copy of a remote task after a failed
     background save, with a user-safe notice. The next successful
     load clears the notice. */
  function rollbackRemoteTask(id, before) {
    for (var j = 0; j < remoteTasks.length; j++) {
      if (remoteTasks[j].id === id) remoteTasks[j] = before;
    }
    remoteError = 'Could not save the change. Please try again.';
    notify();
  }
  /* Drop all cached remote rows. Called on sign-out (see App.signOut)
     and superseded on account switch inside loadRemoteTasks: the next
     render must never show the previous account's tasks. */
  function clearRemoteState() {
    remoteTasks = []; remoteLoaded = false; lastRemoteUserId = null;
    remoteError = null; notify();
  }
  /* Map a public.tasks row back to the store's task shape. Statuses
     are mapped back to the UI vocabulary so list filters keep working. */
  function fromDbTask(row) {
    var priority = 'medium';
    if (row.priority >= 70) priority = 'high';
    else if (row.priority <= 30) priority = 'low';
    return {
      id: row.task_id,
      title: row.title,
      description: row.description,
      status: STATUS_FROM_DB[row.status] || row.status,
      priority: priority,
      dueDate: row.due_date,
      dueTime: null,
      source: row.source,
      contactId: row.contact_id,
      project: row.project_id,
      blockedBy: row.dependency_id,
      created: row.created_at ? row.created_at.slice(0, 10) : null,
      userCreated: true
    };
  }
  function loadRemoteTasks() {
    if (!isLiveMode()) { remoteLoaded = true; return Promise.resolve(); }
    var client = supabaseClient();
    var userId = currentUserId();
    if (!client || !userId) { remoteLoaded = true; return Promise.resolve(); }
    /* Account switch: drop the previous user's cached rows BEFORE the
       new fetch resolves so stale tasks are never rendered. */
    if (lastRemoteUserId && userId !== lastRemoteUserId) {
      remoteTasks = []; remoteError = null; notify();
    }
    lastRemoteUserId = userId;
    return client.from('tasks').select('*').eq('user_id', userId)
      .then(function (r) {
        /* A resolved response can still carry an error — treat it as a
           failure, never as a valid empty list. */
        if (r.error) {
          remoteLoaded = true;
          remoteError = (r.error.message || 'Could not load tasks');
          notify();
          return;
        }
        remoteTasks = ((r && r.data) || []).map(fromDbTask);
        remoteLoaded = true; remoteError = null; notify();
      })
      .catch(function (e) {
        remoteLoaded = true;
        remoteError = (e && e.message) || 'Could not load tasks';
        notify();
      });
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('supabase-auth-ready', function () { loadRemoteTasks(); });
  }

  /* ---------- Read helpers ---------- */
  function seed() { return window.SEED; }

  function contact(id) {
    if (!id) return null;
    /* Live mode has no seed address book: every account starts
       clean, and live contact references never match seed ids. */
    if (isLiveMode()) return null;
    for (var i = 0; i < seed().contacts.length; i++) {
      if (seed().contacts[i].id === id) return seed().contacts[i];
    }
    return null;
  }
  function contactName(id) {
    var c = contact(id);
    return c ? c.name : (id ? 'Unknown contact' : '—');
  }

  /** Tasks = seed tasks (with overrides applied) + user-created tasks.
     In live mode the global demo seed list and the shared local
     newTasks are EXCLUDED: remoteTasks (scoped to the signed-in user
     by RLS) is the source of truth, so one account never sees
     another's data or sample content. */
  function tasks() {
    var out = [];
    var live = isLiveMode();
    if (!live) {
    seed().tasks.forEach(function (t) {
      var ov = state.mutable.taskOverrides[t.id] || {};
      if (ov.deleted) return;
      var copy = {};
      Object.keys(t).forEach(function (k) { copy[k] = t[k]; });
      if (ov.title !== undefined) copy.title = ov.title;
      if (ov.status) copy.status = ov.status;
      if (ov.dueDate !== undefined) copy.dueDate = ov.dueDate;
      if (ov.dueTime !== undefined) copy.dueTime = ov.dueTime;
      if (ov.description !== undefined) copy.description = ov.description;
      if (ov.reminder !== undefined) copy.reminder = ov.reminder;
      if (ov.priority) copy.priority = ov.priority;
      if (ov.project !== undefined) copy.project = ov.project;
      out.push(copy);
    });
    } /* end demo-only seed list */
    remoteTasks.forEach(function (t) {
      /* Remote rows are canonical for DB-backed fields. Local-only
         display fields (no DB column) ride along as an overlay so
         edits to them are never silently dropped from the view. */
      var copy = {};
      Object.keys(t).forEach(function (k) { copy[k] = t[k]; });
      var ov = state.mutable.taskOverrides[t.id] || {};
      if (ov.dueTime !== undefined) copy.dueTime = ov.dueTime;
      if (ov.reminder !== undefined) copy.reminder = ov.reminder;
      if (ov.project !== undefined) copy.project = ov.project;
      if (ov.contactId !== undefined) copy.contactId = ov.contactId;
      if (ov.blockedBy !== undefined) copy.blockedBy = ov.blockedBy;
      out.push(copy);
    });
    if (!live) {
      state.mutable.newTasks.forEach(function (t) { out.push(t); });
    }
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
  /* Seeded collections below are demo-only. In live mode every
     account starts with a clean workspace: these readers return
     empty so no sample content can appear in a real account, and
     so it cannot reappear after restart, sign-out/sign-in, or
     account switching. Demo mode is unchanged. */
  function commitments() {
    if (isLiveMode()) return [];
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
    if (isLiveMode()) return [];
    return seed().followUps.map(function (f) {
      var copy = {};
      Object.keys(f).forEach(function (x) { copy[x] = f[x]; });
      if (state.mutable.followUpStatus[f.id]) copy.status = state.mutable.followUpStatus[f.id];
      return copy;
    });
  }

  function meetings() {
    /* In live mode the account's meetings are the ones the USER
       recorded or uploaded (their own workspace). The seeded
       narrative belongs to the demo persona only. */
    /* The user's OWN recordings sit alongside the seeded narrative in
       demo mode (they are marked userCreated), and are the only
       meetings a live account has. */
    var out = state.mutable.userMeetings.map(function (m) {
      var copy = {};
      Object.keys(m).forEach(function (x) { copy[x] = m[x]; });
      var st = state.mutable.meetingStates[m.id] || {};
      copy.prepDone = !!st.prepDone;
      if (st.transcript) copy.transcript = st.transcript;
      return copy;
    });
    if (isLiveMode()) return out;
    seed().meetings.forEach(function (m) {
      var copy = {};
      Object.keys(m).forEach(function (x) { copy[x] = m[x]; });
      var st = state.mutable.meetingStates[m.id] || {};
      copy.prepDone = !!st.prepDone;
      if (st.transcript) copy.transcript = st.transcript;   /* user-editable transcript */
      out.push(copy);
    });
    return out;
  }
  function meeting(id) {
    var all = meetings();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function events() {
    if (isLiveMode()) return [];
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
    if (isLiveMode()) return [];
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
  /** The user's persisted re-classification for an email, if any. */
  function emailCategory(id) { return state.mutable.emailCategory[id] || null; }

  function documents() {
    if (isLiveMode()) return [];
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
    /* Seeded integration health is a demo fixture. Real accounts get
       their real connection state from the server, so the seed list
       (Gmail/Zoom/transcription "connected") must never appear. */
    if (isLiveMode()) return [];
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
    var live = isLiveMode();
    if (live) {
      /* Real account: identity facts come from the AUTH session (the
         user's own Supabase profile). The demo seed profile — which
         carries the developer persona's name — belongs to nobody and
         must never be presented to a signed-in real user. */
      var s = (window.Session && window.Session.currentUser) ? window.Session.currentUser() : null;
      u.name = (s && s.name) || null;
      u.email = (s && s.email) || null;
      u.timezone = (s && s.timezone) ||
        (window.D && window.D.timeZone ? window.D.timeZone() : 'UTC');
      u.subscription = (s && s.subscription) || null;
      u.role = undefined;
    } else {
      Object.keys(seed().user).forEach(function (k) { u[k] = seed().user[k]; });
    }
    u.autonomy = state.mutable.autonomy;
    /* Seed learned-prefs are demo fixtures for the Control Center
       display. In live mode only the device's own learned prefs
       apply — a fresh account shows none. */
    u.learnedPrefs = live
      ? state.mutable.learnedPrefs.slice()
      : seed().user.learnedPrefs.concat(state.mutable.learnedPrefs);
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
    /** Re-classify an email. A local data change only — it never sends,
        replies, deletes, archives or forwards anything, and it never
        touches the Action Authorization Layer. Suspicious messages are
        held: they can never be re-classified out of Suspicious (the
        engine ignores any such override too, so this is defence in
        depth, not the only safeguard). */
    setEmailCategory: function (id, category) {
      var e = email(id);
      if (!e) return { ok: false, reason: 'Unknown message.' };
      if (window.EnginesMail && window.EnginesMail.classify(e).suspicious) {
        return { ok: false, reason: 'Held as suspicious — it cannot be re-classified.' };
      }
      if (!window.EnginesMail || window.EnginesMail.CATEGORIES.indexOf(category) === -1) {
        return { ok: false, reason: 'Unknown action class.' };
      }
      state.mutable.emailCategory[id] = category;
      commit();
      return { ok: true, category: category };
    },
    clearEmailCategory: function (id) {
      delete state.mutable.emailCategory[id];
      commit();
    },
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
    /* ---------- User-owned meetings (the AI notetaker) ----------
       A meeting the user recorded or uploaded belongs to the signed-in
       account. It is stored in the account's own scope, so it can
       never appear in another user's workspace. In demo mode these
       sit alongside the seeded narrative (clearly marked as the
       user's own recordings). */
    addUserMeeting: function (meeting) {
      if (!meeting || !meeting.title) return null;
      var m = {
        id: meeting.id || uid('um'),
        title: meeting.title,
        date: meeting.date || window.D.today(),
        start: meeting.start || null,
        end: meeting.end || null,
        contactIds: meeting.contactIds || [],
        audioRef: meeting.audioRef || null,
        source: meeting.source || 'Recorded in Life OS',
        summary: meeting.summary || '',
        decisions: meeting.decisions || [],
        actionItems: meeting.actionItems || [],
        deadlines: meeting.deadlines || [],
        followUps: meeting.followUps || [],
        transcript: meeting.transcript || [],
        extraction: meeting.extraction || 'demo',
        userCreated: true
      };
      state.mutable.userMeetings.unshift(m);
      commit();
      return m;
    },
    updateUserMeeting: function (id, patch) {
      for (var i = 0; i < state.mutable.userMeetings.length; i++) {
        if (state.mutable.userMeetings[i].id !== id) continue;
        Object.keys(patch).forEach(function (k) { state.mutable.userMeetings[i][k] = patch[k]; });
        commit();
        return state.mutable.userMeetings[i];
      }
      return null;
    },
    removeUserMeeting: function (id) {
      var before = state.mutable.userMeetings.length;
      state.mutable.userMeetings = state.mutable.userMeetings.filter(function (m) { return m.id !== id; });
      if (state.mutable.userMeetings.length !== before) { commit(); return true; }
      return false;
    },
    updateTask: function (id, patch) {
      /* User-created tasks live in newTasks — edit them in place
         (the override layer only applies to seed tasks). */
      var nt = state.mutable.newTasks;
      for (var i = 0; i < nt.length; i++) {
        if (nt[i].id === id) {
          Object.keys(patch).forEach(function (k) { nt[i][k] = patch[k]; });
          commit();
          return;
        }
      }
      /* Live mode: remote rows are canonical for DB-backed fields.
         Apply the patch to the in-memory copy immediately, persist
         the DB-backed fields to Supabase in the background, and keep
         local-only display fields (no DB column) as a persistent
         overlay (see tasks()). Signature stays synchronous; on
         failure the in-memory copy rolls back with a user-safe
         notice — never silent divergence. */
      if (isLiveMode()) {
        for (var r = 0; r < remoteTasks.length; r++) {
          if (remoteTasks[r].id !== id) continue;
          var before = {};
          Object.keys(remoteTasks[r]).forEach(function (k) { before[k] = remoteTasks[r][k]; });
          var dbPatch = {};
          Object.keys(patch).forEach(function (k) {
            if (k === 'title') { remoteTasks[r].title = patch[k]; dbPatch.title = patch[k]; }
            else if (k === 'description') { remoteTasks[r].description = patch[k]; dbPatch.description = patch[k]; }
            else if (k === 'status') { remoteTasks[r].status = patch[k]; dbPatch.status = STATUS_TO_DB[patch[k]] || 'open'; }
            else if (k === 'priority') { remoteTasks[r].priority = patch[k]; dbPatch.priority = toDbPriority(patch[k]); }
            else if (k === 'dueDate') { remoteTasks[r].dueDate = patch[k]; dbPatch.due_date = patch[k]; }
          });
          var ovLive = state.mutable.taskOverrides[id] || {};
          ['dueTime', 'reminder', 'project', 'contactId', 'blockedBy'].forEach(function (k) {
            if (patch[k] !== undefined) ovLive[k] = patch[k];
          });
          state.mutable.taskOverrides[id] = ovLive;
          commit();
          if (Object.keys(dbPatch).length > 0) {
            var liveClient = supabaseClient();
            if (liveClient) {
              liveClient.from('tasks').update(dbPatch).eq('task_id', id)
                .then(function (res) {
                  if (res && res.error) rollbackRemoteTask(id, before);
                })
                .catch(function () { rollbackRemoteTask(id, before); });
            }
          }
          return;
        }
      }
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
        dueTime: task.dueTime || null,
        description: task.description || null,
        reminder: task.reminder || null,
        priority: task.priority || 'medium',
        source: task.source || null,
        contactId: task.contactId || null,
        project: task.project || null,
        blockedBy: task.blockedBy || null,
        created: window.D.today(),
        userCreated: true
      };
      /* Live mode: persist to Supabase. Show success ONLY after the
         database confirms the write; surface a user-safe error on
         failure; never silently fall back to localStorage. */
      if (isLiveMode()) {
        var client = supabaseClient();
        var userId = currentUserId();
        if (!client || !userId) {
          return Promise.resolve({ ok: false, error: 'Not authenticated. Sign in to save tasks.' });
        }
        var dbTask = toDbTask(t, userId);
        /* The schema defines task_id as uuid with a database-generated
           default. Do NOT send the local t-… id — let Postgres assign
           the UUID, then use the returned row as canonical. */
        delete dbTask.task_id;
        return client.from('tasks').insert(dbTask).select('*').single()
          .then(function (r) {
            if (r.error) return { ok: false, error: (r.error.message || 'Could not save the task.') };
            var saved = fromDbTask(r.data);
            remoteTasks.unshift(saved);
            commit();
            return { ok: true, task: saved };
          })
          .catch(function (e) {
            return { ok: false, error: ((e && e.message) || 'Could not save the task.') };
          });
      }
      /* Demo mode: existing localStorage behaviour, synchronous. */
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
    /* Per-user scope (see the note above: hygiene, not the security
       boundary — the server enforces ownership with RLS). */
    setUserScope: setUserScope,
    currentScope: currentScope,
    storageKey: storageKey,
    contacts: function () { return isLiveMode() ? [] : seed().contacts; },
    /* Live-mode flag for call sites that read seed fixtures
       directly (reminders): they must stay empty in live mode too. */
    isLiveMode: isLiveMode,
    contact: contact, contactName: contactName,
    tasks: tasks, task: task, activeTasks: activeTasks,
    clearRemoteState: clearRemoteState,
    commitments: commitments, commitment: commitment,
    followUps: followUps,
    meetings: meetings, meeting: meeting,
    events: events, event: event,
    emails: emails, email: email, emailCategory: emailCategory,
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