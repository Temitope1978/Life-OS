/* ============================================================
   View — Control: autonomy, permissions, integrations, data
   ============================================================ */
(function () {
  'use strict';

  var el = function () { return window.$.el.apply(null, arguments); };

  var PERMISSION_NOTES = {
    'Send external email': 'Blocked at every autonomy level until you explicitly allow it.',
    'Send internal email': 'Can be prepared automatically once you reach Confirm.',
    'Create calendar events': 'Drafted, never booked without approval.',
    'Create or edit documents': 'Drafts only.'
  };

  var ALL_PERMISSIONS = [
    'Read email', 'Read calendar', 'Read documents', 'Create tasks',
    'Draft replies', 'Transcribe meetings', 'Send external email',
    'Send internal email', 'Create calendar events', 'Create or edit documents'
  ];

  function section(title, hint, children) {
    return el('div.card', [
      el('div.card-head', [el('h2', { text: title }), hint ? el('span.hint', { text: hint }) : null]),
      el('div.card-pad.stack', children)
    ]);
  }

  function modeChip(mode) {
    return window.UI.chip(mode,
      mode === 'execute' ? 'success'
      : mode === 'approve' ? 'warn'
      : mode === 'onetouch' ? 'acc'
      : 'danger');
  }
  function riskChip(risk) {
    return window.UI.chip(risk,
      risk === 'high' ? 'danger' : risk === 'medium' ? 'warn' : 'muted');
  }

  /* One-touch templates: single-use authorizations the user can
     create, inspect and revoke. Mirrors the hard rule that no
     permanent auto-send can ever be set up. */
  function oneTouchSection() {
    var templates = window.Store.mutable().oneTouchTemplates;

    var name = el('input.input', { type: 'text', placeholder: 'e.g. ABC invoice acknowledgment' });
    var useCase = el('input.input', { type: 'text', placeholder: 'e.g. Confirm receipt of an ABC Ltd invoice' });
    var recipients = el('input.input', { type: 'text', placeholder: 'e.g. @abcltd.com or sarah@abcltd.com (comma-separated)' });
    var conditions = el('input.input', { type: 'text', placeholder: 'e.g. only when the message is an invoice receipt' });
    var body = el('textarea.textarea', { rows: 4, placeholder: 'Template body…' });

    var list = el('div.stack');
    function renderList() {
      window.$.clear(list);
      if (!templates.length) {
        list.appendChild(window.UI.empty('✓', 'No one-touch templates. Create one below to allow a single pre-authorized send.'));
        return;
      }
      templates.forEach(function (t) {
        var stateChip = t.consumed ? window.UI.chip('Used — consumed', 'muted')
          : t.revoked ? window.UI.chip('Revoked', 'danger')
          : window.UI.chip('Active — single use', 'warn');
        list.appendChild(el('div.row.spread', [
          el('div.grow', [
            el('div.t', { text: t.name }),
            el('div.s.faint', { text: t.useCase + ' · To: ' + (t.recipients.join(', ') || 'nobody') }),
            el('div.s.faint', { text: (t.conditions ? 'When: ' + t.conditions : 'No conditions set') + (t.consumed ? ' · consumed ' + t.consumedAt : '') })
          ]),
          el('div.actions', [
            stateChip,
            (!t.consumed && !t.revoked) ? window.UI.btnSm('Revoke', 'ghost', function () {
              window.Store.mut.revokeOneTouchTemplate(t.id);
              window.UI.toast('One-touch authorization revoked', 'ok');
              window.App.render();
            }) : null
          ].filter(Boolean))
        ]));
      });
    }
    renderList();

    return section('One-touch email templates', 'Single-use authorizations', [
      el('div.alert.alert-warn', {
        html: '<strong>Never permanent.</strong> A one-touch template authorizes exactly ' +
          '<strong>one</strong> send to a defined recipient set. After that send it is ' +
          'consumed and normal human approval resumes. There is no way to set up ' +
          'unrestricted automatic sending.'
      }),
      el('div.stack', [
        el('div.field', [el('label', { text: 'Template name' }), name]),
        el('div.field', [el('label', { text: 'Use case' }), useCase]),
        el('div.field', [el('label', { text: 'Permitted recipients' }), recipients]),
        el('div.field', [el('label', { text: 'Conditions' }), conditions]),
        el('div.field', [el('label', { text: 'Template body' }), body]),
        el('button.btn.btn-primary', {
          type: 'button', text: 'Authorize template (single-use)', onclick: function () {
            var recips = recipients.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
            if (!name.value.trim()) { window.UI.toast('Give the template a name', 'err'); return; }
            if (!recips.length) { window.UI.toast('Add at least one permitted recipient', 'err'); return; }
            if (!body.value.trim()) { window.UI.toast('Add a template body', 'err'); return; }
            window.Store.mut.createOneTouchTemplate({
              name: name.value.trim(),
              useCase: useCase.value.trim(),
              recipients: recips,
              conditions: conditions.value.trim(),
              body: body.value
            });
            window.UI.toast('One-touch template authorized (single-use)', 'ok');
            window.App.render();
          }
        }),
        list
      ])
    ]);
  }

  /* Audit trail of every proposed action and how the authorization
     layer decided it. */
  function actionLogSection() {
    var log = window.Store.actionLog().slice().reverse();
    var recent = log.slice(0, 12);
    return section('Action authorization log', 'Every proposed action and its decision', [
      el('div.s.faint', {
        text: 'Nothing reaches another person without a decision recorded here. ' +
              '"approve" means a human approved it; "onetouch" means a single-use ' +
              'template covered it; "block" means it was refused.'
      }),
      (function () {
        if (!recent.length) return window.UI.empty('✓', 'No actions proposed yet.');
        var wrap = el('div.stack');
        recent.forEach(function (a) {
          wrap.appendChild(el('div.row.spread', [
            el('div.grow', [
              el('div.t', { text: a.type.replace(/_/g, ' ') + (a.detail ? ' — ' + a.detail : '') }),
              el('div.s.faint', { text: a.reason })
            ]),
            el('div.actions', [riskChip(a.risk), modeChip(a.mode)])
          ]));
        });
        return wrap;
      })()
    ]);
  }

  /* Providers: the configuration + failure layer that sits in front of
     every external service. Distinct from the simulated integration
     health below — this shows the real config status and the §55
     failure taxonomy. */
  function providerRow(p) {
    var st = p.status();
    var connected = st.config.status === 'CONNECTED';
    var invalid = st.config.status === 'INVALID_CONFIGURATION';
    var dot = connected ? 'ok' : invalid ? 'err' : 'warn';

    var configChip = connected ? window.UI.chip('Connected', 'success')
      : invalid ? window.UI.chip('Invalid configuration', 'danger')
      : window.UI.chip('Not configured', 'warn');

    var failChip = st.failure ? window.UI.chip(st.failure.replace(/_/g, ' '), 'danger') : null;

    var values = ['none'].concat(Object.keys(window.Providers.FAILURE).map(function (k) {
      return window.Providers.FAILURE[k];
    }));
    var sel = el('select.select', values.map(function (v) {
      return el('option', { value: v, text: v === 'none' ? 'Simulate state…' : v.replace(/_/g, ' ') });
    }));
    sel.value = st.failure || 'none';
    sel.onchange = function () {
      var v = sel.value;
      if (v === 'none') p.clearFailure();
      else p.simulateFailure(v);
      window.App.render();
    };

    return el('div.health-row', [
      el('span.health-dot.' + dot),
      el('div.nm', { text: p.name }),
      el('div.st', [
        el('div', { text: p.description }),
        el('div.faint', { text: 'Requires: ' + p.requiredConfig.join(', ') }),
        el('div', { text: st.message })
      ]),
      el('div.actions', [configChip, failChip, sel].filter(Boolean))
    ]);
  }

  function providerSection() {
    var providers = window.Providers.all();
    var demo = window.Providers.demoMode();
    return section('Providers', demo ? 'Demo mode — no live providers connected' : 'Live providers', [
      el('div.alert.alert-info', {
        html: '<strong>' + (demo ? 'Demo mode.' : 'Live mode.') + '</strong> ' +
          'Business logic reaches every external provider through one interface. ' +
          'In demo mode the AI is served by the simulated provider — no external ' +
          'credentials are required and no live calls are made. Configuration is ' +
          'read from environment variables and is never hard-coded.'
      }),
      el('div.s.faint', {
        text: 'Configuration status is one of Connected · Not configured · Invalid ' +
              'configuration. Use the selector on a provider to preview each failure ' +
              'state (§55) and the safe message shown to the user.'
      }),
      providers.map(function (p) { return providerRow(p); })
    ]);
  }

  /* Google sign-in: one coherent OAuth architecture for Gmail +
     Calendar with explicit, granular scopes. Preparation only — no
     live credentials, no automatic connection. */
  function oauthConfigRow(label, value) {
    return el('div.row.spread', [
      el('div.t', { text: label }),
      el('div.s', { text: value })
    ]);
  }

  function oauthServiceRow(name, state) {
    var kind = state === 'connected' ? 'success'
      : state === 'auth_required' ? 'warn'
      : state === 'not_configured' ? 'muted' : 'danger';
    return el('div.row.spread', [
      el('div.t', { text: name }),
      el('div.actions', [window.UI.chip(state.replace(/_/g, ' '), kind)])
    ]);
  }

  function googleSection() {
    var cfg = window.OAuth.browserConfig();
    var configured = window.OAuth.isConfigured();
    var gmailState = window.OAuth.authState('gmail');
    var calState = window.OAuth.authState('calendar');

    return section('Google sign-in', configured ? 'Configured' : 'Not configured', [
      el('div.alert.alert-info', {
        html: '<strong>' + (cfg.mode === 'live' ? 'Live mode.' : 'Demo mode.') + '</strong> ' +
          'One Google authorization covers Gmail and Calendar. Only the scopes for ' +
          'the first live test are requested — read-only email intelligence and ' +
          'calendar read. No send or calendar-write permission is requested. The ' +
          'Client Secret and every token stay server-side; the browser never holds them.'
      }),
      el('div.stack', [
        oauthConfigRow('Client ID', cfg.clientId ? 'set (' + String(cfg.clientId).length + ' chars)' : 'not set'),
        oauthConfigRow('Redirect URI', cfg.redirectUri ? cfg.redirectUri : 'not set — never guessed'),
        oauthConfigRow('Callback route', cfg.callbackRoute),
        oauthConfigRow('Enabled services', cfg.services.join(', ')),
        oauthConfigRow('First live test scopes', cfg.firstLiveTestScopes.length ? cfg.firstLiveTestScopes.join(' ') : 'none')
      ]),
      el('div.stack', [
        oauthServiceRow('Gmail', gmailState),
        oauthServiceRow('Google Calendar', calState)
      ]),
      el('div.actions', [
        window.UI.btnSm('Connect Google', 'primary', function () {
          var url = window.OAuth.authorizationUrl();
          if (!url) {
            window.UI.toast('Google is not configured — add Client ID and redirect URI', 'err');
            return;
          }
          /* Show the exact request that would go to Google. The app does
             not auto-navigate or auto-connect — the user initiates it. */
          var m = window.UI.modal({
            title: 'Google authorization request',
            body: el('div.stack', [
              el('div.s.faint', {
                text: 'In production this URL opens Google\'s consent screen. The ' +
                      'redirect URI must be registered in Google Cloud Console and ' +
                      'point to the hosted deployment. No secret appears in this URL.'
              }),
              el('div.s', { text: url })
            ]),
            actions: [window.UI.btnSm('Close', 'ghost', function () { m.close(); })]
          });
        })
      ])
    ]);
  }

  function integrationRow(i) {
    var kind = i.status === 'connected' ? 'ok' : (i.status === 'failed' ? 'err' : 'warn');
    var label = i.status === 'connected' ? 'Connected'
              : i.status === 'failed' ? 'Sync failed'
              : i.status === 'error' ? 'Needs reconnect' : 'Not connected';
    return el('div.health-row', [
      el('span.health-dot.' + kind),
      el('div.nm', { text: i.provider }),
      el('div.st', [
        el('div', { text: i.error || 'Permissions: ' + i.permissions }),
        el('div.faint', { text: 'Last sync: ' + i.lastSync })
      ]),
      el('div.actions', [
        window.UI.chip(label, kind === 'ok' ? 'success' : kind === 'warn' ? 'warn' : 'danger'),
        i.status !== 'connected' ? window.UI.btnSm('Reconnect', 'secondary', function () {
          window.Store.mut.connectIntegration(i.id);
          window.UI.toast(i.provider + ' reconnected', 'ok');
          window.App.render();
        }) : null
      ].filter(Boolean))
    ]);
  }

  function view(root) {
    var u = window.Store.user();
    var meta = window.UI.autonomyMeta(u.autonomy);
    var integrations = window.Store.integrations();
    var failed = integrations.filter(function (i) { return i.status !== 'connected'; }).length;

    var userInitials = u.name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();

    root.appendChild(window.UI.page('Control',
      'Your system, your rules. Nothing leaves this browser.',
      el('div.stack', [

        section('Autonomy', 'How much the AI may do without asking', [
          el('div.s', { text: meta.desc }),
          window.UI.autonomySegmented(function (lvl) {
            window.UI.toast('Autonomy set to ' + window.UI.autonomyMeta(lvl).label);
            window.App.render();
          }),
          el('div.alert.alert-info', {
            html: '<strong>Currently ' + window.$.esc(meta.label) + '.</strong> ' +
              'Every action passes through the Action Authorization Layer. Autonomy never ' +
              'overrides a permission, and anything that reaches another person — email, ' +
              'documents, calendar invites — is held for approval regardless of level.'
          }),
          el('div.s.faint', {
            text: 'Level 4 (Confirm) asks once and remembers. Level 5 (Automate) only ever runs ' +
                  'pre-approved low-risk actions such as filing and labelling.'
          })
        ]),

        section('Permissions', 'Granted to the AI', ALL_PERMISSIONS.map(function (p) {
          var granted = (u.permissions || []).indexOf(p) !== -1;
          var sensitive = /send/i.test(p);
          return el('div.row.spread', [
            el('div', [
              el('div.t', { text: p }),
              el('div.s.faint', { text: PERMISSION_NOTES[p] || (sensitive ? 'Reaches people outside your accounts.' : 'Read or draft only.') })
            ]),
            el('div.actions', [
              granted ? window.UI.chip('Granted', 'success') : window.UI.chip('Ask every time', 'warn'),
              granted ? null : window.UI.btnSm('Grant', 'ghost', function () {
                window.Store.mut.allow(p);
                window.UI.toast('Granted: ' + p, 'ok');
                window.App.render();
              })
            ].filter(Boolean))
          ]);
        })),

        oneTouchSection(),
        actionLogSection(),

        section('Account', null, [
          el('div.row', [
            el('span', {
              style: {
                width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)',
                color: '#fff', display: 'grid', placeItems: 'center', fontWeight: '700'
              },
              text: userInitials
            }),
            el('div.grow', [
              el('div.t', { text: u.name }),
              el('div.s', { text: u.email + ' · ' + u.timezone.replace('_', ' ') })
            ])
          ]),
          el('div.s.faint', {
            text: 'Simulation only — no real account, no authentication, no network calls. ' +
                  'Everything you approve is stored in this browser under "lifeos.sim.v1".'
          }),
          el('div.row', [
            window.UI.btnSm('Sign Out', 'danger', function () {
              /* Clears only the demo session (lifeos_demo_session).
                 The underlying demo data and seed are untouched. */
              window.DemoAuth.signOut();
              window.UI.toast('Signed out — demo session cleared', 'ok');
              window.App.go('#/signin');
            })
          ])
        ]),

        providerSection(),
        googleSection(),

        section('Integrations', failed ? failed + ' need attention' : 'All healthy', integrations.map(integrationRow)),

        section('Learned preferences', 'The AI adapts to what you accept and reject', (u.learnedPrefs || []).map(function (p) {
          var on = p.on !== false;
          return el('div.row.spread', [
            el('div', [
              el('div.t', { text: p.label }),
              el('div.s.faint', { text: p.value + ' · ' + p.source })
            ]),
            el('div.actions', [
              window.UI.chip(p.confidence + ' confidence', p.confidence === 'high' ? 'acc' : 'muted'),
              el('label.toggle', [
                el('input', { type: 'checkbox', checked: on, onchange: function (e) {
                  window.Store.mut.toggleLearnedPref(p.id);
                  window.UI.toast('Preference ' + (e.target.checked ? 'kept' : 'ignored'));
                } }),
                el('span.track')
              ])
            ])
          ]);
        })),

        section('Your data', 'Everything lives in this browser', [
          el('div.s.faint', {
            text: 'Seed data plus every change you approve is stored in localStorage. ' +
                  'Resetting restores the original demo exactly.'
          }),
          el('div.row', [
            window.UI.btnSm('Reset demo data', 'danger', function () {
              window.UI.modal({
                title: 'Reset the demo?',
                body: el('p', { text: 'Every approval, task, transcript edit and autonomy change will be discarded and the original seeded demo restored.' }),
                actions: [el('button.btn.btn-danger', { type: 'button', text: 'Reset everything', onclick: function () { window.Store.mut.reset(); } })]
              });
            }),
            window.UI.btnSm('Export JSON', 'secondary', function () {
              var payload = {
                exportedFrom: 'AI Life OS simulation',
                simulatedToday: window.D.today(),
                user: window.Store.user(),
                mutable: window.Store.mutable()
              };
              var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
              var a = el('a', { href: URL.createObjectURL(blob), download: 'life-os-state.json' });
              document.body.appendChild(a);
              a.click();
              a.remove();
              window.UI.toast('Exported', 'ok');
            })
          ])
        ]),

        section('About this build', null, [
          el('p.s.faint', {
            text: 'AI Life OS is a personal operating system that knows your commitments, protects ' +
                  'your attention and refuses to let anything slip. This simulation runs a ' +
                  'deterministic intelligence behind the same provider seam a real model will use, ' +
                  'so every result is reproducible and every claim is traceable to a source.'
          }),
          el('div.actions', [
            window.UI.chip('Seam: SimulatedProvider', 'acc'),
            window.UI.chip('Fixed date: ' + window.D.today(), 'muted'),
            window.UI.chip(window.Store.activeTasks().length + ' active tasks', 'muted'),
            window.UI.chip(window.EnginesForgetting.detect().length + ' forgotten items', 'muted')
          ])
        ])
      ])
    ));
  }

  window.ViewControl = { view: view };
})();
