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
    return el('div.item.click.email-row', {
      class: state.selected === e.id ? 'selected' : ''
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

  function detail(e, r, onClose) {
    var c = e.contactId ? window.Store.contact(e.contactId) : null;
    var wrap = el('div.card.detail');

    wrap.appendChild(el('div.card-pad', [
      el('div.row.between', [
        el('div', [
          el('h2', { text: e.subject, style: { marginBottom: '4px' } }),
          el('div.sub', {
            text: (c ? c.name + ' · ' + c.org : e.external) + ' · ' + window.D.formatDateTime(e.received)
          })
        ]),
        el('div.actions', [window.UI.categoryChip(r.category), window.UI.btnSm('Close', 'ghost', onClose)])
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
      el('div.s.faint', { text: 'Classification: ' + r.reason }),
      el('div.actions', r.category === 'Suspicious' ? [
        /* Held messages offer no reply or task path — acting on them is the
           exact failure this safeguard exists to prevent. */
        window.UI.btnSm('This is a scam', 'danger', function () {
          window.Store.mut.markScam(e.id, true);
          window.UI.toast('Marked as scam. Reminder suppressed.');
        }),
        window.UI.btnSm('Mark as safe', 'ghost', function () {
          window.Store.mut.markScam(e.id, false);
          window.UI.toast('Marked safe — it will be triaged normally', 'ok');
        })
      ] : [
        window.UI.btnSm('Reply', 'primary', function () {
          draftFor(e, r);
        }),
        window.UI.btnSm('Add task', 'secondary', function () {
          window.Store.mut.addTask({
            title: 'Reply: ' + e.subject,
            project: 'Client work',
            dueDate: window.D.today(),
            priority: r.category === 'Urgent' ? 'high' : 'normal',
            source: { type: 'email', ref: e.id },
            contactId: e.contactId
          });
          window.UI.toast('Task added from email');
        })
      ])
    ]));

    return wrap;
  }

  function draftFor(e, r) {
    var p = e.contactId ? window.Store.contact(e.contactId) : null;
    var name = p ? p.name.split(' ')[0] : 'there';
    var body = el('textarea.textarea', {
      rows: 7,
      value: 'Hi ' + name + ',\n\nThanks for this. I have it and I will come back to you by ' +
             window.D.formatDate(window.D.addDays(window.D.today(), 1)) + '.\n\nBest,\n' + window.Store.user().name
    });
    var m = window.UI.modal({
      title: 'Reply: ' + e.subject,
      body: el('div.stack', [
        el('div.s.faint', { text: 'Drafted by AI. Nothing is sent until you send it.' }),
        body,
        el('div.s.faint', { text: 'Autonomy level: ' + window.UI.autonomyMeta(window.Store.user().autonomy).label +
          ' — you are sending this manually.' })
      ]),
      actions: [
        el('button.btn.btn-primary', {
          type: 'button', text: 'Send reply', onclick: function () {
            window.Store.mut.sendEmail(e.id, body.value);
            m.close();
            window.UI.toast('Reply sent to ' + (p ? p.name : e.external));
            window.App.render();
          }
        })
      ]
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
          state.selected = id;
          window.App.render();
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
    state: state
  };
})();