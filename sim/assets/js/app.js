/* ============================================================
   App — router, command interpreter, badges, source navigation
   ============================================================ */
(function () {
  'use strict';

  var el = function () { return window.$.el.apply(null, arguments); };
  var esc = function (s) { return window.$.esc(s); };

  /* ---------- Routing ---------- */
  function parseHash() {
    var h = (location.hash || '#/command').replace(/^#\/?/, '');
    var parts = h.split('/').map(decodeURIComponent);
    return { path: '/' + (parts[0] || 'command'), params: parts.slice(1) };
  }

  function go(hash) {
    if (location.hash === hash) { render(); return; }
    location.hash = hash;
  }

  /* Authentication / landing routes render as a clean,
     standalone experience without the authenticated
     application shell (sidebar, navigation, badges). */
  var AUTH_SHELL_ROUTES = { '/welcome': true, '/signin': true, '/signup': true };
  function isAuthShellRoute(path) { return !!AUTH_SHELL_ROUTES[path]; }

  /* ---------- Modal close routing ----------
     Detail routes (/tasks/:id, /contacts/:id, /documents/:id) render a
     modal. Their onClose must navigate back to the previous non-modal
     view. Calling render() here re-ran the same detail route and
     re-opened the modal, so Cancel closed it and it instantly came back. */
  var lastBaseRoute = '#/command';

  function isModalRoute(path) {
    return path === '/tasks' || path === '/contacts' || path === '/documents';
  }

  function closeModalToBase() {
    go(lastBaseRoute);
  }

  /* ---------- Modals for detail routes ---------- */
  /* Task detail — full content via the reusable Details modal,
     with manual editing in the action form. */
  function taskModal(id) {
    var t = window.Store.task(id);
    if (!t) { window.UI.toast('Task not found', 'err'); return; }
    window.Details.open({ kind: 'task', ref: id }, { onClose: closeModalToBase });
  }

  function contactModal(id) {
    var c = window.Store.contact(id);
    if (!c) return;
    var ks = window.Store.commitments().filter(function (k) { return k.personId === id; });
    var related = window.EnginesSearch.byPerson(id);

    var m = window.UI.modal({
      title: c.name,
      body: el('div.stack', [
        el('div.row', [
          window.UI.avatar(c.id, 44),
          el('div.grow', [
            el('div.t', { text: c.relationship + ' · ' + c.org }),
            el('div.s', { text: c.email + ' · last interaction ' + window.D.formatDate(c.lastInteraction) })
          ])
        ]),
        el('div.s', { text: c.notes }),
        el('div', [
          el('div.t-cap', { text: 'Commitments' }),
          el('div.stack', ks.length ? ks.map(function (k) { return window.UI.commitmentRow(k); })
            : [el('div.s.faint', { text: 'No commitments with this person.' })])
        ]),
        el('div', [
          el('div.t-cap', { text: 'Everything about ' + c.name.split(' ')[0] }),
          el('div.stack', related.length ? related.slice(0, 12).map(function (d) {
            var row = el('div.item.click', [
              el('span.dot.neutral'),
              el('div.grow', [el('div.t', { text: d.title }), el('div.s', { text: d.meta })])
            ]);
            row.onclick = function () { m.close(); go(routeFor(d)); };
            return row;
          }) : [el('div.s.faint', { text: 'Nothing found.' })])
        ])
      ]),
      onClose: closeModalToBase
    });
  }

  function routeFor(doc) {
    switch (doc.kind) {
      case 'email': return '#/mail/' + doc.id;
      case 'meeting': return '#/meetings/' + doc.id;
      case 'task': return '#/tasks/' + doc.id;
      case 'contact': return '#/contacts/' + doc.id;
      case 'document': return '#/documents/' + doc.id;
      case 'commitment': return '#/commitments';
      case 'event': return '#/calendar';
      case 'followup': return '#/waiting';
    }
    return '#/search';
  }

  function documentsModal(id) {
    var d = id ? window.Store.document(id) : null;
    var docs = window.Store.documents();

    var m = window.UI.modal({
      title: d ? d.filename : 'Documents',
      body: el('div.stack', d ? [
        el('div.row', [window.UI.chip(d.type, 'acc'), window.UI.chip(d.project || 'No project', 'muted'),
                       window.UI.chip('Updated ' + window.D.formatDate(d.updated), 'muted')]),
        el('p', { text: d.summary }),
        el('div.field', [
          el('label', { text: 'Deadlines in this document' }),
          el('div.row', (d.deadlines || []).map(function (x) { return window.UI.chip(window.D.dueLabel(x), window.D.isPast(x) ? 'danger' : 'muted'); }))
        ]),
        el('div.field', [
          el('label', { text: 'Actions it implies' }),
          el('ul.tidy', (d.actions || []).map(function (a) { return el('li', { text: a }); }))
        ]),
        el('div.row', d.contactIds.map(function (cid) {
          var c = window.Store.contact(cid);
          return el('button.source', { type: 'button', text: 'Shared with ' + c.name, onclick: function () { go('#/contacts/' + cid); } });
        }))
      ] : docs.map(function (doc) {
        var row = el('div.item.click', [
          el('span.dot.neutral'),
          el('div.grow', [el('div.t', { text: doc.filename }), el('div.s', { text: doc.summary })])
        ]);
        row.onclick = function () { go('#/documents/' + doc.id); };
        return row;
      })),
      onClose: closeModalToBase
    });
  }

  /* ---------- Source navigation ---------- */
  function openSource(s) {
    if (!s) return;
    if (s.kind === 'meeting') go('#/meetings/' + s.id);
    else if (s.kind === 'email') go('#/mail/' + s.id);
    else if (s.kind === 'event') go('#/calendar');
    else if (s.kind === 'document') go('#/documents/' + s.id);
  }

  /* ---------- Meeting briefing ---------- */
  function openEventBrief(eventId) {
    window.ViewMeetings.openBriefing(eventId);
  }

  /** Prepare every meeting that needs it — respects the autonomy level. */
  function prepareAll() {
    var need = window.EnginesTasks.needsPrep();
    if (!need.length) { window.UI.toast('Every meeting is already prepared', 'ok'); return; }
    var level = window.Store.user().autonomy;

    if (level < 3) {
      window.UI.toast('Autonomy is ' + window.UI.autonomyMeta(level).label + ' — raise it to Prepare first', 'err');
      return;
    }

    var doIt = function () {
      need.forEach(function (e) { window.Store.mut.markPrepared(e.id); });
      window.UI.toast(need.length + ' meeting' + (need.length === 1 ? '' : 's') + ' prepared', 'ok');
      render();
    };

    var m = window.UI.modal({
      title: 'Prepare ' + need.length + ' meeting' + (need.length === 1 ? '' : 's') + '?',
      body: el('div.stack', [
        el('p', { text: 'For each meeting the AI will read the last interaction, your open commitments and every prior decision, then produce a briefing.' }),
        el('ul.tidy', need.map(function (e) {
          return el('li', { text: window.D.formatDate(e.date) + ' ' + e.start + ' — ' + e.title });
        })),
        el('div.s.faint', {
          text: 'Preparation only ever creates drafts — nothing is sent, booked or shared.'
        })
      ]),
      actions: [el('button.btn.btn-primary', { type: 'button', text: 'Prepare now', onclick: function () { m.close(); doIt(); } })]
    });
  }

  /* ---------- Google OAuth callback ----------
     The app-internal route Google redirects back to (via the
     configurable, hosted redirect URI). It reads the authorization
     code or error from the URL query string and shows the result.
     It never stores the code, the state, or any token. */
  function oauthCallback(params) {
    var root = document.getElementById('view');
    window.$.clear(root);
    var service = (params && params[0]) || 'google';
    var result = window.OAuth.handleCallback(service, location.search);
    root.appendChild(window.UI.page(
      'Connecting Google',
      result.message,
      el('div.stack', [
        el('div.alert.' + (result.ok ? 'alert-info' : 'alert-warn'), { text: result.detail }),
        el('div.actions', [
          window.UI.btnSm('Back to Control', 'secondary', function () { go('#/control'); })
        ])
      ])
    ));
  }

  /* ---------- Command interpreter ---------- */
  var COMMANDS = [
    { re: /prepare (my )?day|brief me|start my day|daily briefing/i, run: function () {
        go('#/day'); window.UI.toast('Your day is ready — top item first', 'ok');
      } },
    { re: /what am i forgetting|forgot|forgotten|forgetting/i, run: function () {
        go('#/forget');
      } },
    { re: /waiting for|who am i waiting|blocked on/i, run: function () {
        go('#/waiting');
      } },
    { re: /what did i promise|my commitments|what have i promised/i, run: function () {
        go('#/commitments');
      } },
    { re: /summar(y|ise|ize) (my )?email|inbox|email/i, run: function () {
        go('#/mail');
      } },
    { re: /prepare my meetings|brief me for|meeting brief/i, run: function () {
        prepareAll();
      } },
    { re: /conflict|double.?book/i, run: function () {
        go('#/calendar');
      } },
    { re: /control|setting|autonomy|permission|integration/i, run: function () {
        go('#/control');
      } },
    { re: /search|find .*(file|document)/i, run: function (q) {
        go('#/search/' + encodeURIComponent(q));
      } }
  ];

  function runCommand(q) {
    for (var i = 0; i < COMMANDS.length; i++) {
      if (COMMANDS[i].re.test(q)) { COMMANDS[i].run(q); return; }
    }
    go('#/search/' + encodeURIComponent(q));
  }

  /* ---------- Badges ---------- */
  function setBadge(id, n) {
    var b = document.getElementById(id);
    if (!b) return;
    b.textContent = n > 0 ? String(n) : '';
  }

  function badges() {
    var unread = window.Store.emails().filter(function (e) { return e.unread; }).length;
    setBadge('badge-mail', unread);
    setBadge('badge-forget', window.EnginesForgetting.detect().length);
    var unconfirmed = window.EnginesCommitment.userOwed().filter(function (k) { return !k.confirmedByUser; }).length;
    setBadge('badge-commit', unconfirmed);
  }

  /* ---------- Render ---------- */
  var lastPath = null;

  function render() {
    var r = parseHash();
    /* Remember the last real (non-modal) view so a modal can return to it */
    if (!isModalRoute(r.path)) {
      lastBaseRoute = location.hash || '#/command';
    }
    var root = document.getElementById('view');
    window.$.clear(root);

    /* Demo session gate (assessment-safe). Public routes and the
       OAuth callback stay open; every app route requires a demo
       session. #/command is kept valid — it redirects to #/signin
       when unsigned in and opens the existing Command Center,
       unchanged, when signed in. */
    if (!window.Session.requireAuth(r.path)) {
      go('#/signin');
      return;
    }

    /* Route-aware application shell: the authentication /
       landing routes render as a clean, standalone
       experience without the authenticated sidebar; every
       app route keeps the normal shell and side navigation. */
    var shell = document.querySelector('.shell');
    if (shell) {
      shell.classList.toggle('is-auth', isAuthShellRoute(r.path));
    }

    switch (r.path) {
      case '/welcome':   window.ViewAuth.welcome(root); break;
      case '/signin':    window.ViewAuth.signIn(root); break;
      case '/signup':    window.ViewAuth.signUp(root); break;
      case '/day':       window.ViewDay.view(root); break;
      case '/mail':      window.ViewMail.view(root); break;
      case '/calendar':  window.ViewCalendar.view(root); break;
      case '/meetings':  window.ViewMeetings.view(root); break;
      case '/forget':    window.ViewForget.view(root); break;
      case '/search':    window.ViewSearch.view(root); break;
      case '/commitments':
      case '/waiting':   window.ViewCommitments.view(root); break;
      case '/control':   window.ViewControl.view(root); break;
      case '/settings':  window.ViewSettings.view(root); break;
      case '/oauth':     oauthCallback(r.params); break;
      case '/tasks':     taskModal(r.params[0]); break;
      case '/contacts':  contactModal(r.params[0]); break;
      case '/documents': documentsModal(r.params[0]); break;
      case '/command':
      default:           window.ViewCommand.view(root); break;
    }

    navState(r.path);
    badges();
    lastPath = r.path;
    window.scrollTo(0, 0);
  }

  function navState(path) {
    var nav = path === '/waiting' ? 'commitments' : path.replace('/', '');
    Array.prototype.forEach.call(document.querySelectorAll('.sidebar a'), function (a) {
      a.classList.toggle('active', a.getAttribute('data-nav') === nav);
    });
  }

  /* ---------- Boot ----------
     The synchronous part (store init, hashchange listener,
     render, keydown) runs immediately. The initial route
     decision waits for SupabaseAuth.bootstrap(): in demo
     mode that is a synchronous no-op (returns false), so
     boot finishes synchronously exactly as before; in
     production mode it returns a Promise that resolves
     once the stored Supabase session has been restored, so
     the protected/protected decision sees the real session
     before the first render. SupabaseAuth.bootstrap() is
     fail-closed — it never activates the demo adapter. */
  function finalizeBoot() {
    if (!location.hash) location.hash = window.Session.isAuthenticated() ? '#/command' : '#/welcome';
    render();
  }

  function boot() {
    window.Store.init();
    window.Store.subscribe(function () { render(); });

    window.addEventListener('hashchange', render);

    var auth = (window.SupabaseAuth && typeof window.SupabaseAuth.bootstrap === 'function')
      ? window.SupabaseAuth.bootstrap()
      : false;
    if (auth && typeof auth.then === 'function') {
      /* Production mode: restore the session first. */
      auth.then(finalizeBoot, finalizeBoot);
    } else {
      /* Demo mode (default): finish synchronously. */
      finalizeBoot();
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
        e.preventDefault();
        var bar = document.querySelector('.cmd-bar input');
        if (bar) bar.focus();
      }
    });
  }

  /* ---------- Sign Out ----------
     One shared, confirmed sign-out used by Settings and by
     the Control Center account area. It clears the demo
     session (the only auth state) and returns to the
     Welcome landing. The render() auth gate — not this
     function — is what keeps protected views unreachable
     afterwards, including via the browser Back button. */
  function signOut() {
    var m = window.UI.modal({
      title: 'Sign out?',
      body: el('p', { text: 'Are you sure you want to sign out?' }),
      actions: [
        window.UI.btn('Sign out', 'danger', function () {
          m.close();
          window.Session.signOut();         /* delegates to the active adapter */
          var prod = (window.SupabaseAuth && typeof window.SupabaseAuth.isProductionMode === 'function')
            ? window.SupabaseAuth.isProductionMode() : false;
          window.UI.toast(prod ? 'Signed out' : 'Signed out — demo session cleared', 'ok');
          go('#/welcome');                   /* Welcome / Sign-In landing */
        })
      ]
    });
  }

  window.App = {
    go: go,
    render: render,
    route: parseHash,
    isAuthShellRoute: isAuthShellRoute,
    runCommand: runCommand,
    openSource: openSource,
    openEventBrief: openEventBrief,
    prepareAll: prepareAll,
    badges: badges,
    signOut: signOut,
    boot: boot
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();