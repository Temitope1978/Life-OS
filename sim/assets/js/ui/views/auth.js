/* ============================================================
   View — Authentication (welcome / sign in / sign up)
   ------------------------------------------------------------
   The same screens serve both auth modes. In DEMO mode the
   underlying adapter is DemoAuth: assessment-safe demo
   sessions, clearly labelled, no password storage. In
   PRODUCTION mode the adapter is Supabase Auth: real
   email/password sign-in and sign-up, protected by Supabase
   Row Level Security. The view never calls an auth adapter
   directly — it always goes through Session.signIn /
   Session.signUp, so the active adapter is decided by
   Session (and SupabaseAuth.bootstrap), not here.

   The demo flow and the production flow never mix: each
   request is handled entirely by whichever adapter Session
   holds. The "Continue as Demo" shortcut is hidden in
   production mode so a real deployment can never silently
   fall back to a demo session.
   ============================================================ */
(function () {
  'use strict';

  var el = function () { return window.$.el.apply(null, arguments); };

  var DEMO_NOTE = 'Demo Environment — Secure account authentication will be enabled in a future production phase.';
  var PRODUCTION_NOTE = 'Production authentication is powered by Supabase. Your account and data are protected by Row Level Security.';
  var RECOVERY_NOTE = 'Password recovery will be available when secure account authentication is connected.';

  function productionMode() {
    if (window.SupabaseAuth && typeof window.SupabaseAuth.isProductionMode === 'function') {
      return window.SupabaseAuth.isProductionMode();
    }
    var a = (window.Session && window.Session.getAdapter) ? window.Session.getAdapter() : null;
    return !!(a && (a.id === 'supabase' || a.id === 'misconfigured'));
  }

  function field(labelText, input) {
    return el('div.field', [el('label', { text: labelText }), input]);
  }

  function errorList(errors) {
    if (!errors || !errors.length) return null;
    return el('div.alert.alert-warn', [
      el('strong', { text: 'Please check the following:' }),
      el('ul.tidy', errors.map(function (e) { return el('li', { text: e }); }))
    ]);
  }

  function modeNote() {
    return el('div.alert.alert-info', { text: productionMode() ? PRODUCTION_NOTE : DEMO_NOTE });
  }

  function navLink(text, hash) {
    return el('button.btn.btn-ghost.btn-sm', {
      type: 'button', text: text,
      onclick: function () { window.App.go(hash); }
    });
  }

  /* Run an auth call (sync from DemoAuth, or a Promise from
     Supabase) and handle the normalized result. Redirects only
     when the result is ok AND a real session now exists.
     `done` is an optional callback invoked once the result is
     handled (used to re-enable the submit button and discard
     typed secrets). */
  function handleAuthResult(r, successMsg, done) {
    function finish(res) {
      if (res.ok && window.Session.isAuthenticated()) {
        var u = window.Session.currentUser();
        window.UI.toast(successMsg + ((u && u.name) || ''), 'ok');
        window.App.go('#/command');
      } else if (res.ok && res.needsConfirmation) {
        /* Supabase may require email confirmation before a
           session is issued. The account exists but the user
           is not signed in yet. */
        window.UI.toast('Account created — check your email to confirm before signing in.', 'ok');
      } else {
        var e = errorList(res.errors);
        if (e) errorsBox.appendChild(e);
      }
      if (typeof done === 'function') done(res);
    }
    if (r && typeof r.then === 'function') { r.then(finish, finish); return; }
    finish(r);
  }

  var errorsBox = null; /* set by each view before submit */

  /* ---------- Welcome / landing ---------- */
  function welcome(root) {
    window.$.clear(root);
    var actions = [
      window.UI.btn('Sign In', 'primary', function () { window.App.go('#/signin'); }),
      window.UI.btn('Create Account', 'secondary', function () { window.App.go('#/signup'); })
    ];
    /* The demo shortcut is a demo-only affordance. It is
       hidden in production mode so a real deployment can
       never silently fall back to a demo session. */
    if (!productionMode()) {
      actions.push(window.UI.btn('Continue as Demo', 'ghost', function () {
        var r = window.DemoAuth.continueDemo();
        if (r.ok) {
          window.UI.toast('Demo session started — welcome, ' + r.session.name, 'ok');
          window.App.go('#/command');
        } else {
          window.UI.toast('Could not start the demo session', 'err');
        }
      }));
    }
    var hero = el('div', {
      style: { maxWidth: '580px', margin: '44px auto 0', textAlign: 'center', padding: '0 8px' }
    }, [
      el('img', {
        src: 'assets/images/life-os-logo.png',
        alt: 'Life OS logo',
        class: 'auth-logo'
      }),
      el('h1', {
        style: { fontFamily: 'var(--display)', fontWeight: '700', fontSize: '34px', letterSpacing: '-0.6px' },
        text: 'AI Life OS'
      }),
      el('p', {
        style: { fontSize: '16px', color: 'var(--text-mut)', marginTop: '6px' },
        text: 'Your Personal AI Chief of Staff'
      }),
      el('p', {
        style: { fontFamily: 'var(--display)', fontSize: '17px', color: 'var(--primary-ink)', marginTop: '20px' },
        text: '“Remember less. Organize less. Get more done.”'
      }),
      el('div', { style: { display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '28px' } }, actions),
      el('div', { style: { marginTop: '24px' } }, [modeNote()])
    ]);
    root.appendChild(hero);
  }

  /* ---------- Sign In ---------- */
  function signIn(root) {
    window.$.clear(root);
    var email = el('input.input', { type: 'email', placeholder: 'you@example.com', 'aria-label': 'Email address', autocomplete: 'email' });
    var password = el('input.input', { type: 'password', placeholder: 'Your password', 'aria-label': 'Password', autocomplete: 'current-password' });
    errorsBox = el('div.stack');
    var btn;

    function submit() {
      window.$.clear(errorsBox);
      if (btn) btn.disabled = true;
      /* Always through the Session interface — DemoAuth in
         demo mode, Supabase in production mode. */
      var r = window.Session.signIn({ email: email.value, password: password.value });
      handleAuthResult(r, 'Signed in as ', function (res) {
        if (btn) btn.disabled = false;
        if (!res.ok) password.value = ''; /* discard typed password */
      });
    }

    btn = el('button.btn.btn-primary', { type: 'button', text: 'Sign In', onclick: submit, style: { width: '100%', justifyContent: 'center' } });

    root.appendChild(el('div', { style: { maxWidth: '400px', margin: '36px auto 0' } }, [
      el('img', {
        src: 'assets/images/life-os-logo.png',
        alt: 'Life OS logo',
        class: 'auth-logo'
      }),
      el('div.card', [
        el('div.card-head', [
          el('h2', { text: 'Sign in' }),
          el('span.hint', { text: productionMode() ? 'Supabase Auth' : 'Demo session' })
        ]),
        el('div.card-pad.stack', [
          errorsBox,
          field('Email Address', email),
          field('Password', password),
          btn,
          el('div.row', [
            el('button.btn.btn-ghost.btn-sm', {
              type: 'button', text: 'Forgot Password?',
              onclick: function () { window.UI.toast(RECOVERY_NOTE, 'ok'); }
            }),
            navLink('Create Account', '#/signup')
          ]),
          modeNote()
        ])
      ])
    ]));
    email.focus();
  }

  /* ---------- Sign Up ---------- */
  function signUp(root) {
    window.$.clear(root);
    var name = el('input.input', { type: 'text', placeholder: 'Your full name', 'aria-label': 'Full name', autocomplete: 'name' });
    var email = el('input.input', { type: 'email', placeholder: 'you@example.com', 'aria-label': 'Email address', autocomplete: 'email' });
    var password = el('input.input', { type: 'password', placeholder: 'At least 8 characters', 'aria-label': 'Password', autocomplete: 'new-password' });
    var confirm = el('input.input', { type: 'password', placeholder: 'Repeat your password', 'aria-label': 'Confirm password', autocomplete: 'new-password' });
    errorsBox = el('div.stack');
    var btn;

    function submit() {
      window.$.clear(errorsBox);
      if (btn) btn.disabled = true;
      var r = window.Session.signUp({ name: name.value, email: email.value, password: password.value, confirm: confirm.value });
      handleAuthResult(r, 'Account created — welcome, ', function (res) {
        if (btn) btn.disabled = false;
        if (!res.ok) { password.value = ''; confirm.value = ''; } /* discard typed passwords */
      });
    }

    btn = el('button.btn.btn-primary', { type: 'button', text: 'Create Account', onclick: submit, style: { width: '100%', justifyContent: 'center' } });

    root.appendChild(el('div', { style: { maxWidth: '400px', margin: '36px auto 0' } }, [
      el('img', {
        src: 'assets/images/life-os-logo.png',
        alt: 'Life OS logo',
        class: 'auth-logo'
      }),
      el('div.card', [
        el('div.card-head', [
          el('h2', { text: 'Create Account' }),
          el('span.hint', { text: productionMode() ? 'Supabase Auth — password protected' : 'Demo session — no password is stored' })
        ]),
        el('div.card-pad.stack', [
          errorsBox,
          field('Full Name', name),
          field('Email Address', email),
          field('Password', password),
          field('Confirm Password', confirm),
          btn,
          el('div.row', [navLink('Sign In', '#/signin')]),
          modeNote()
        ])
      ])
    ]));
    name.focus();
  }

  window.ViewAuth = {
    welcome: welcome,
    signIn: signIn,
    signUp: signUp
  };
})();
