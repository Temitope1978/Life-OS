/* ============================================================
   View — Demo authentication (welcome / sign in / sign up)
   ------------------------------------------------------------
   Assessment-safe demo screens. Clearly labelled as a demo
   environment. No real authentication, no password storage.
   Styling reuses the existing design system classes; the only
   inline styles are layout for the welcome hero, so app.css is
   untouched and the existing visual identity is preserved.
   ============================================================ */
(function () {
  'use strict';

  var el = function () { return window.$.el.apply(null, arguments); };

  var DEMO_NOTE = 'Demo Environment — Secure account authentication will be enabled in a future production phase.';
  var RECOVERY_NOTE = 'Password recovery will be available when secure account authentication is connected.';

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

  function demoNote() {
    return el('div.alert.alert-info', { text: DEMO_NOTE });
  }

  function navLink(text, hash) {
    return el('button.btn.btn-ghost.btn-sm', {
      type: 'button', text: text,
      onclick: function () { window.App.go(hash); }
    });
  }

  /* ---------- Welcome / landing ---------- */
  function welcome(root) {
    window.$.clear(root);
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
      el('div', {
        style: { display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '28px' }
      }, [
        window.UI.btn('Sign In', 'primary', function () { window.App.go('#/signin'); }),
        window.UI.btn('Create Account', 'secondary', function () { window.App.go('#/signup'); }),
        window.UI.btn('Continue as Demo', 'ghost', function () {
          var r = window.DemoAuth.continueDemo();
          if (r.ok) {
            window.UI.toast('Demo session started — welcome, ' + r.session.name, 'ok');
            window.App.go('#/command');
          } else {
            window.UI.toast('Could not start the demo session', 'err');
          }
        })
      ]),
      el('div', { style: { marginTop: '24px' } }, [demoNote()])
    ]);
    root.appendChild(hero);
  }

  /* ---------- Sign In ---------- */
  function signIn(root) {
    window.$.clear(root);
    var email = el('input.input', { type: 'email', placeholder: 'you@example.com', 'aria-label': 'Email address', autocomplete: 'email' });
    var password = el('input.input', { type: 'password', placeholder: 'Your password', 'aria-label': 'Password', autocomplete: 'current-password' });
    var errors = el('div.stack');

    function submit() {
      window.$.clear(errors);
      var r = window.DemoAuth.signIn({ email: email.value, password: password.value });
      if (r.ok) {
        window.UI.toast('Signed in as ' + r.session.name, 'ok');
        window.App.go('#/command');
      } else {
        var e = errorList(r.errors);
        if (e) errors.appendChild(e);
        /* the typed password is discarded; it is never stored */
        password.value = '';
      }
    }

    root.appendChild(el('div', { style: { maxWidth: '400px', margin: '36px auto 0' } }, [
      el('img', {
        src: 'assets/images/life-os-logo.png',
        alt: 'Life OS logo',
        class: 'auth-logo'
      }),
      el('div.card', [
        el('div.card-head', [
          el('h2', { text: 'Sign in' }),
          el('span.hint', { text: 'Demo session' })
        ]),
        el('div.card-pad.stack', [
          errors,
          field('Email Address', email),
          field('Password', password),
          el('button.btn.btn-primary', { type: 'button', text: 'Sign In', onclick: submit, style: { width: '100%', justifyContent: 'center' } }),
          el('div.row', [
            el('button.btn.btn-ghost.btn-sm', {
              type: 'button', text: 'Forgot Password?',
              onclick: function () { window.UI.toast(RECOVERY_NOTE, 'ok'); }
            }),
            navLink('Create Account', '#/signup')
          ]),
          demoNote()
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
    var errors = el('div.stack');

    function submit() {
      window.$.clear(errors);
      var r = window.DemoAuth.signUp({ name: name.value, email: email.value, password: password.value, confirm: confirm.value });
      if (r.ok) {
        window.UI.toast('Account created — welcome, ' + r.session.name, 'ok');
        window.App.go('#/command');
      } else {
        var e = errorList(r.errors);
        if (e) errors.appendChild(e);
        /* typed passwords are discarded; they are never stored */
        password.value = '';
        confirm.value = '';
      }
    }

    root.appendChild(el('div', { style: { maxWidth: '400px', margin: '36px auto 0' } }, [
      el('img', {
        src: 'assets/images/life-os-logo.png',
        alt: 'Life OS logo',
        class: 'auth-logo'
      }),
      el('div.card', [
        el('div.card-head', [
          el('h2', { text: 'Create Account' }),
          el('span.hint', { text: 'Demo session — no password is stored' })
        ]),
        el('div.card-pad.stack', [
          errors,
          field('Full Name', name),
          field('Email Address', email),
          field('Password', password),
          field('Confirm Password', confirm),
          el('button.btn.btn-primary', { type: 'button', text: 'Create Account', onclick: submit, style: { width: '100%', justifyContent: 'center' } }),
          el('div.row', [navLink('Sign In', '#/signin')]),
          demoNote()
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
