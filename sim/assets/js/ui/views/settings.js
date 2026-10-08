/* ============================================================
   View — Settings (profile, account, preferences, data)
   ------------------------------------------------------------
   A user-facing Settings area built entirely on the existing
    Life OS architecture. It reads the signed-in identity from
    the provider-neutral Identity/Session abstraction (today
    backed by the demo session) and reuses the existing UI
    components, cards, alerts and modal architecture.

   Sections with no backing store yet (Notifications, editable
   email preferences) are clearly marked "Coming soon" rather
   than showing switches that do nothing. No second auth
   system, no external provider, no invented user data.
   ============================================================ */
(function () {
  'use strict';

  var el = function () { return window.$.el.apply(null, arguments); };

  function section(title, hint, children) {
    return el('div.card', [
      el('div.card-head', [
        el('h2', { text: title }),
        hint ? el('span.hint', { text: hint }) : null
      ].filter(Boolean)),
      el('div.card-pad.stack', children.filter(Boolean))
    ]);
  }

  /* Label / value row — the same pattern the Control Center
     uses for its configuration rows. */
  function row(label, value) {
    return el('div.row.spread', [
      el('div.t', { text: label }),
      el('div.s', { text: value })
    ]);
  }

  function comingSoon(note) {
    return el('div.alert.alert-info', {
      text: note || 'Coming soon — not yet available in the current demo.'
    });
  }

  function initials(name) {
    return (name || '?').split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
  }

  /* True when a production (Supabase) adapter is active —
     either ready or fail-closed. Used only to label the
     auth/session facts accurately; it never changes what
     the view does. */
  function productionMode() {
    if (window.SupabaseAuth && typeof window.SupabaseAuth.isProductionMode === 'function') {
      return window.SupabaseAuth.isProductionMode();
    }
    var a = (window.Session && window.Session.getAdapter) ? window.Session.getAdapter() : null;
    return !!(a && (a.id === 'supabase' || a.id === 'misconfigured'));
  }

  /* Timezone is present in the demo profile but optional in
     a production profile, so guard it before formatting. */
  function tzLabel(tz) {
    return tz ? String(tz).replace('_', ' ') : 'Not set';
  }

  function avatar(name) {
    return el('span', {
      style: {
        width: '44px', height: '44px', borderRadius: '50%',
        background: 'var(--primary)', color: '#fff',
        display: 'grid', placeItems: 'center', fontWeight: '700', flex: 'none'
      },
      text: initials(name)
    });
  }

  /* Export the current state as JSON — the same payload the
     Control Center produces, read straight from the store. */
  function exportJson() {
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
  }

  /* Reset restores the original seeded demo. The data layer
     has its own confirmation; the sign-in session is kept —
     only the approved changes are discarded. */
  function resetData() {
    window.UI.modal({
      title: 'Reset the demo?',
      body: el('p', {
        text: 'Every approval, task, transcript edit and autonomy change will be discarded and the original seeded demo restored. Your sign-in session is kept.'
      }),
      actions: [el('button.btn.btn-danger', {
        type: 'button', text: 'Reset everything',
        onclick: function () { window.Store.mut.reset(); }
      })]
    });
  }

  function view(root) {
    var id = window.Identity.current();  /* signed-in identity + profile */
    /* Autonomy is a demo/Store fact; the production schema has no
       autonomy column, so it is undefined in production mode. */
    var autonomyAvailable = id.autonomy !== undefined && id.autonomy !== null;
    var meta = window.UI.autonomyMeta(autonomyAvailable ? id.autonomy : 0);
    var name = id.name;
    var email = id.email;

    root.appendChild(window.UI.page('Settings',
      'Your account, preferences and data.',
      el('div.stack', [

        /* ---------- Profile ---------- */
        section('Profile', 'Signed-in identity', [
          el('div.row', [
            avatar(name),
            el('div.grow', [
              el('div.t', { text: name }),
              el('div.s', { text: (email || '—') + ' · ' + tzLabel(id.timezone) })
            ])
          ]),
          row('Name', name),
          row('Email', email || '—'),
          row('Role', id.role || '—'),
          row('Timezone', tzLabel(id.timezone)),
          row('Plan', id.subscription || '—'),
          row('Account type', productionMode() ? 'Supabase account — password protected' : 'Demo session — no password is stored'),
          row('Session ID', id.userId || '—'),
          row('Signed in at', id.signedInAt ? window.D.formatDateTime(id.signedInAt) : '—'),
          el('div.s.faint', {
            text: 'Profile fields are read-only in the current build. Editable profiles arrive with secure account authentication.'
          })
        ]),

        /* ---------- Account & Security ---------- */
        section('Account & Security', 'Session status', [
          row('Authentication', productionMode() ? 'Supabase Auth' : 'Demo session'),
          row('Session storage', (window.Session.storageKey() || '—') + (productionMode() ? ' (managed by Supabase)' : ' (this browser only)')),
          row('Status', window.Session.isAuthenticated() ? 'Signed in' : 'Signed out'),
          el('div.s.faint', {
            text: productionMode()
              ? 'Your session is held by Supabase. No password, token or secret is stored by this app.'
              : 'No password, token or secret is stored. Password changes, MFA and account recovery arrive with secure account authentication.'
          }),
          el('div.row', [
            window.UI.btn('Sign Out', 'danger', function () { window.App.signOut(); })
          ])
        ]),

        /* ---------- Notifications ---------- */
        section('Notifications', 'Preferences', [
          comingSoon('Notification preferences are coming soon. The current demo does not store notification settings, so no switches are shown here.')
        ]),

        /* ---------- Email ---------- */
        section('Email', 'Life OS email', [
          row('Email mode', 'Demo — no external provider connected'),
          row('Action classes', window.EnginesMail.CATEGORIES.join(', ')),
          el('div.s.faint', {
            text: 'Email is simulated, so there are no connection settings to configure. One-touch send templates and the Action Authorization Layer are managed in the Control Center.'
          }),
          el('div.row', [
            window.UI.btnSm('Open Control Center', 'secondary', function () { window.App.go('#/control'); })
          ]),
          comingSoon('Editable email preferences are coming soon.')
        ]),

        /* ---------- AI & Privacy ---------- */
        section('AI & Privacy', 'Current controls', [
          row('Autonomy level', autonomyAvailable
            ? meta.label + ' (level ' + id.autonomy + ')'
            : 'Not set — arrives with the production preferences layer'),
          row('Permissions granted', (id.permissions && id.permissions.length)
            ? String(id.permissions.length)
            : (productionMode() ? '— (permission model is a later stage)' : '0')),
          row('Action Authorization Layer', 'Every action that reaches another person is held for approval'),
          row('Your data', productionMode() ? 'Stored in your Supabase project (Row Level Security)' : 'Stored locally in this browser (lifeos.sim.v1)'),
          el('div.s.faint', {
            text: 'These controls are managed in the Control Center. No additional AI or privacy controls are available in the current build.'
          }),
          el('div.row', [
            window.UI.btnSm('Manage in Control Center', 'secondary', function () { window.App.go('#/control'); })
          ])
        ]),

        /* ---------- Data ---------- */
        section('Data', 'Export & local data', [
          el('div.s.faint', {
            text: productionMode()
              ? 'Seed data plus every approval you make is stored in this browser; your account and profile live in your Supabase project. Export a local copy, or reset the demo data.'
              : 'Seed data plus every approval you make is stored in this browser. Export a copy, or reset to the original demo. There is no account to delete.'
          }),
          el('div.row', [
            window.UI.btnSm('Export JSON', 'secondary', exportJson),
            window.UI.btnSm('Reset demo data', 'danger', resetData)
          ])
        ])

      ])
    ));
  }

  window.ViewSettings = { view: view };
})();
