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
              'Autonomy never overrides a permission. Anything that reaches another person — ' +
              'email, documents, calendar invites — is held for approval regardless of level.'
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
          })
        ]),

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
