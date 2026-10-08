/* ============================================================
   View — Inbox (email triage)
   ============================================================ */
(function () {
  'use strict';

  var el = function () { return window.$.el.apply(null, arguments); };

  var state = { filter: 'All', selected: null, draft: false };

  var FILTERS = ['All', 'Urgent', 'Action Required', 'Important', 'Waiting', 'Newsletter', 'Promotion', 'Low Priority', 'Suspicious'];

  function filterBar(classified, onChange) {
    var bar = el('div.filter-bar');
    FILTERS.forEach(function (f) {
      var n = f === 'All' ? classified.length : classified.filter(function (r) { return r.category === f; }).length;
      bar.appendChild(el('button.chip.filter', {
        type: 'button',
        class: state.filter === f ? 'active' : '',
        html: window.$.esc(f) + ' <span class="tabnum">' + n + '</span>',
        onclick: function () { state.filter = f; onChange(); }
      }));
    });
    return bar;
  }

  function emailRow(r, onOpen) {
    var e = r.email;
    var kind = { 'Urgent': 'danger', 'Action Required': 'warn', 'Important': 'acc', 'Suspicious': 'danger' }[r.category] || 'muted';
    var row = el('div.item.click.email-row', {
      class: (state.selected === e.id ? 'selected ' : '') + (e.unread ? 'unread' : '')
    }, [
      window.UI.avatar(e.contactId),
      el('div.grow', [
        el('div.t', { text: e.subject }),
        el('div.s', { text: (e.contactId ? window.Store.contactName(e.contactId) : e.external) + ' · ' + window.D.agoLabel(e.received) + ' · ' + e.preview })
      ]),
      el('div.actions', [
        window.UI.chip(r.category, kind),
        r.category === 'Suspicious' ? window.UI.chip('Held', 'danger') : null
      ])
    ]);
    row.onclick = function () { onOpen(e.id); };
    return row;
  }

  /** Action-class editor for the email detail panel. Shows the current
      classification and lets the user pick another from the existing
      vocabulary. A Suspicious/Held message is locked — it can never be
      re-classified out of Suspicious. Saving is a local data change
      only; it never sends, replies, deletes, archives or forwards. */
  function classEditor(e, r, ctx) {
    var held = !!(r.suspicious || r.category === 'Suspicious');
    var sel = el('select.select', window.EnginesMail.CATEGORIES.map(function (c) {
      return el('option', { value: c, text: c });
    }));
    sel.value = r.category;
    sel.disabled = held;
    var save = window.UI.btnSm('Save class', 'primary', function () {
      var res = window.Store.mut.setEmailCategory(e.id, sel.value);
      if (!res.ok) { window.UI.toast(res.reason || 'Cannot save the action class', 'err'); return; }
      window.UI.toast('Action class set to ' + res.category, 'ok');
      /* Inside the Details popup, refresh it so the new class is
         visible at once; the inline panel re-renders itself via the
         store's change notification. */
      if (ctx) { ctx.swap(); window.Details.open({ kind: 'email', ref: e.id }, ctx.opts); }
    });
    save.disabled = held;
    return el('div.field', [
      el('label', { text: 'Action class' }),
      el('div.row', [
        sel,
        save,
        held ? window.UI.chip('Held', 'danger') : null
      ].filter(Boolean)),
      held ? el('div.s.faint', {
        text: 'Suspicious messages are held, never acted on — they cannot be re-classified. Use the scam review below.'
      }) : null
    ].filter(Boolean));
  }

  /** The actions available on an opened email. These are the existing,
      permitted Life OS email actions only — nothing here sends, replies,
      deletes, archives or forwards on its own; the reply path always goes
      through the Action Authorization Layer (draftFor → sendEmailAuthorized),
      and a Suspicious/Held message is offered no reply or task path. */
  function emailActions(e, r, ctx) {
    function refresh() {
      if (ctx) { ctx.swap(); window.Details.open({ kind: 'email', ref: e.id }, ctx.opts); }
    }
    if (r.category === 'Suspicious') {
      /* Held messages offer no reply or task path — acting on them is the
         exact failure this safeguard exists to prevent. */
      return [
        window.UI.btnSm('This is a scam', 'danger', function () {
          window.Store.mut.markScam(e.id, true);
          window.UI.toast('Marked as scam. Reminder suppressed.');
          refresh();
        }),
        window.UI.btnSm('Mark as safe', 'ghost', function () {
          window.Store.mut.markScam(e.id, false);
          window.UI.toast('Marked safe — it will be triaged normally', 'ok');
          refresh();
        })
      ];
    }
    var acts = [];
    acts.push(window.Store.mut.replySent(e.id)
      ? window.UI.chip('Reply sent', 'success')
      : window.UI.btnSm('Reply', 'primary', function () {
          /* Only ever a draft until the user sends it, and sending
             runs the Action Authorization Layer. */
          draftFor(e, r);
        }));
    acts.push(window.UI.btnSm('Add task', 'secondary', function () {
      window.Store.mut.addTask({
        title: 'Reply: ' + e.subject,
        project: 'Client work',
        dueDate: window.D.today(),
        priority: r.category === 'Urgent' ? 'high' : 'medium',
        source: { type: 'email', ref: e.id },
        contactId: e.contactId
      });
      window.UI.toast('Task added from email');
      refresh();
    }));
    if (e.unread) {
      acts.push(window.UI.btnSm('Mark as read', 'ghost', function () {
        window.Store.mut.markEmailRead(e.id);
        window.UI.toast('Marked as read', 'ok');
        refresh();
      }));
    }
    return acts;
  }

  function detail(e, r, onClose) {
    var c = e.contactId ? window.Store.contact(e.contactId) : null;
    var wrap = el('div.card.detail');

    wrap.appendChild(el('div.card-pad', [
      el('div.row.between', [
        el('div', [
          el('h2', { text: e.subject, style: { marginBottom: '4px' } }),
          el('div.sub', {
            text: (c ? c.name + ' · ' + c.org : e.external) + ' · ' + window.D.formatDateTime(e.received)
          }),
          el('div.s.faint', {
            text: 'To: ' + window.Store.user().name + ' (' + window.Store.user().email + ') · no attachments'
          })
        ]),
        el('div.actions', [window.UI.chip(e.unread ? 'Unread' : 'Read', e.unread ? 'warn' : 'muted'), window.UI.categoryChip(r.category), window.UI.btnSm('Close', 'ghost', onClose)])
      ])
    ]));

    var flags = [];
    if (r.category === 'Suspicious') {
      flags.push(el('div.alert.alert-danger', [
        el('strong', { text: '⚠ Held for your review. ' }),
        el('span', { html: 'This message looks like a payment-diversion scam. ' +
          'The request arrived in-thread and matches a known attack pattern, so it has not been treated as a real instruction.' })
      ]));
    } else if (r.category === 'Action Required' || r.category === 'Urgent') {
      flags.push(el('div.alert.alert-warn', [
        window.UI.aiNote(
          '<strong>Suggested reply:</strong> ' + window.$.esc(r.suggestedReply || 'Confirm you have received this and will respond shortly.'),
          'Source: received email · ' + window.$.esc(e.subject), 'AI')
      ]));
    }

    wrap.appendChild(el('div.card-pad.stack', [
      flags,
      el('div.email-body', { html: window.$.esc(e.body).replace(/\n\n/g, '<br><br>') }),
      el('div.divider'),
      classEditor(e, r),
      el('div.s.faint', { text: 'Classification: ' + r.reason }),
      el('div.actions', emailActions(e, r))
    ]));

    return wrap;
  }

  function recipientOf(e) {
    var c = e.contactId ? window.Store.contact(e.contactId) : null;
    return c ? (c.email || c.name) : (e.external || '');
  }

  /** A one-touch template the user has authorized for this recipient,
      if (and only if) the "Send external email" permission is granted. */
  function matchingOneTouch(e) {
    var u = window.Store.user();
    if ((u.permissions || []).indexOf('Send external email') === -1) return null;
    var recipient = recipientOf(e);
    var templates = window.Store.oneTouchTemplates();
    for (var i = 0; i < templates.length; i++) {
      if (window.Actions.templateMatches(recipient, templates[i])) return templates[i];
    }
    return null;
  }

  function draftFor(e, r) {
    var p = e.contactId ? window.Store.contact(e.contactId) : null;
    var name = p ? p.name.split(' ')[0] : 'there';
    var recipient = recipientOf(e);
    var manualBody = 'Hi ' + name + ',\n\nThanks for this. I have it and I will come back to you by ' +
      window.D.formatDate(window.D.addDays(window.D.today(), 1)) + '.\n\nBest,\n' + window.Store.user().name;
    var tpl = matchingOneTouch(e);
    var body = el('textarea.textarea', { rows: 7, value: tpl ? tpl.body : manualBody });

    var note, actions;
    if (tpl) {
      note = el('div.alert.alert-info', {
        html: '<strong>One-touch authorized.</strong> Template "' + window.$.esc(tpl.name) +
          '" (' + window.$.esc(tpl.useCase) + ') covers ' + window.$.esc(recipient) +
          '. One tap sends it, and the single-use authorization is then consumed — ' +
          'the next reply needs your approval again.'
      });
      actions = [
        el('button.btn.btn-primary', {
          type: 'button', text: 'Send now — one-touch', onclick: function () {
            var res = window.Store.mut.sendEmailAuthorized(e.id, body.value, { templateId: tpl.id });
            if (!res.ok) { window.UI.toast('Blocked: ' + res.reason, 'err'); return; }
            m.close();
            window.UI.toast('Sent via one-touch. Authorization consumed.', 'ok');
            window.App.render();
          }
        }),
        el('button.btn.btn-secondary', {
          type: 'button', text: 'Send after review', onclick: function () {
            var res = window.Store.mut.sendEmailAuthorized(e.id, body.value, {});
            if (!res.ok) { window.UI.toast('Blocked: ' + res.reason, 'err'); return; }
            m.close();
            window.UI.toast('Reply sent to ' + (p ? p.name : e.external));
            window.App.render();
          }
        })
      ];
    } else {
      note = el('div.s.faint', {
        text: 'Drafted by AI. Nothing is sent until you send it. Autonomy level: ' +
          window.UI.autonomyMeta(window.Store.user().autonomy).label +
          ' — you are sending this manually.'
      });
      actions = [
        el('button.btn.btn-primary', {
          type: 'button', text: 'Send reply', onclick: function () {
            var res = window.Store.mut.sendEmailAuthorized(e.id, body.value, {});
            if (!res.ok) { window.UI.toast('Blocked: ' + res.reason, 'err'); return; }
            m.close();
            window.UI.toast('Reply sent to ' + (p ? p.name : e.external));
            window.App.render();
          }
        })
      ];
    }

    var m = window.UI.modal({
      title: 'Reply: ' + e.subject,
      body: el('div.stack', [note, body]),
      actions: actions
    });
  }

  function render(root) {
    /* Deep links (#/mail/<id>) select the message being viewed */
    var routeId = window.App.route().params[0];
    if (routeId && routeId !== state.selected) state.selected = routeId;

    var classified = window.EnginesMail.classifyAll();
    var visible = state.filter === 'All'
      ? classified
      : classified.filter(function (r) { return r.category === state.filter; });

    root.appendChild(window.UI.page(
      'Inbox',
      '<strong>' + classified.length + '</strong> messages · categorised by AI · ' +
        '<span class="chip chip-warn">Suspicious messages are held, never acted on</span>',
      el('div', [
        filterBar(classified, function () { window.App.render(); })
      ])
    ));

    var list = el('div.card');
    var body = el('div.card-pad', { style: { paddingTop: '0' } });
    if (!visible.length) {
      body.appendChild(window.UI.empty('✓', 'Nothing in this category'));
    } else {
      visible.forEach(function (r) {
        body.appendChild(emailRow(r, function (id) {
          /* Clicking a message opens the existing reusable full-content
             Details popup — not merely the inline preview. The inline
             panel stays available via #/mail/<id> ("Open in Inbox"). */
          window.Details.open({ kind: 'email', ref: id });
        }));
      });
    }
    list.appendChild(body);
    root.appendChild(el('div.two-col', { style: { gridTemplateColumns: state.selected ? 'minmax(340px,1fr) minmax(420px,1.1fr)' : '1fr' } }, [
      list,
      state.selected ? detailFor(state.selected) : null
    ].filter(Boolean)));
  }

  function detailFor(id) {
    var e = window.Store.email(id);
    if (!e) return null;
    var r = window.EnginesMail.classify(e);
    return detail(e, r, function () { state.selected = null; window.App.render(); });
  }

  window.ViewMail = {
    view: render,
    open: function (id) { state.selected = id; state.filter = 'All'; window.App.go('#/mail/' + id); },
    state: state,
    /* Reused by the shared Details popup so the classification editor
       and the permitted email actions live in exactly one place (no
       second classification system, no duplicated action set). */
    classEditor: classEditor,
    emailActions: emailActions
  };
})();