/* ============================================================
   View — Commitments & Waiting For
   ============================================================ */
(function () {
  'use strict';

  var el = function () { return window.$.el.apply(null, arguments); };

  function openCommitment(id) { window.Details.open({ kind: 'commitment', ref: id }); }
  function openFollowUp(id) { window.Details.open({ kind: 'followup', ref: id }); }

  /* Make a row open its full detail, ignoring clicks on its action buttons. */
  function clickable(row, onclick) {
    row.classList.add('click');
    row.addEventListener('click', function (e) {
      if (e.target.closest('.actions')) return;
      onclick();
    });
    return row;
  }

  function view(root) {
    var route = window.App.route();
    var tab = route.path === '/waiting' ? 'waiting' : 'commitments';
    var userOwed = window.EnginesCommitment.userOwed();
    var othersOwed = window.EnginesFollowUp.othersOwedDetailed();
    var openFollowUps = window.EnginesFollowUp.followUps();
    var unconfirmed = userOwed.filter(function (k) { return !k.confirmedByUser; });

    var tabs = el('div.filter-bar', [
      el('button.chip.filter' + (tab === 'commitments' ? '.active' : ''), {
        type: 'button', html: 'Commitments <span class="tabnum">' + userOwed.length + '</span>',
        onclick: function () { window.App.go('#/commitments'); }
      }),
      el('button.chip.filter' + (tab === 'waiting' ? '.active' : ''), {
        type: 'button', html: 'Waiting for <span class="tabnum">' + othersOwed.length + '</span>',
        onclick: function () { window.App.go('#/waiting'); }
      })
    ]);

    var body = el('div.stack');

    if (tab === 'commitments') {
      if (unconfirmed.length) {
        body.appendChild(el('div.alert.alert-warn', {
          html: '<strong>' + unconfirmed.length + ' commitment' + (unconfirmed.length === 1 ? '' : 's') +
            ' the AI extracted are not yet confirmed.</strong> ' +
            'Confirm them so the system knows they are real, or leave them as suggestions.'
        }));
      }

      body.appendChild(el('div.card', [
        el('div.card-head', [
          el('h2', { text: 'You promised' }),
          el('span.hint', { text: 'Every item traces back to its source' })
        ]),
        el('div.card-pad.stack', userOwed.length ? userOwed.map(function (k) {
          return clickable(window.UI.commitmentRow(k, {
            actions: [
              k.confirmedByUser
                ? window.UI.btnSm('Unconfirm', 'ghost', function () {
                    window.Store.mut.confirmCommitment(k.id, false);
                    window.App.render();
                  })
                : window.UI.btnSm('Confirm', 'primary', function () {
                    window.Store.mut.confirmCommitment(k.id);
                    window.UI.toast('Commitment confirmed', 'ok');
                    window.App.render();
                  }),
              k.dueDate ? window.UI.btnSm('Add task', 'secondary', function () {
                window.Store.mut.addTask({
                  title: k.description,
                  project: 'Client work',
                  dueDate: k.dueDate,
                  priority: window.D.isPast(k.dueDate) ? 'high' : 'normal',
                  source: k.source,
                  contactId: k.personId
                });
                window.UI.toast('Task added', 'ok');
                window.App.render();
              }) : null
            ].filter(Boolean)
          }), function () { openCommitment(k.id); });
        }) : [window.UI.empty('✓', 'No outstanding promises')])
      ]));

      body.appendChild(el('div.card', [
        el('div.card-head', [el('h2', { text: 'They promised you' }), el('span.hint', { text: othersOwed.length + ' items' })]),
        el('div.card-pad.stack', othersOwed.length ? othersOwed.map(function (x) {
          return clickable(window.UI.commitmentRow(x.commitment), function () {
            openCommitment(x.commitment.id);
          });
        }) : [window.UI.empty('✓', 'You are not waiting on anyone')])
      ]));
    } else {
      var overdue = window.EnginesFollowUp.overdue();
      if (overdue.length) {
        body.appendChild(el('div.alert.alert-danger', {
          html: '<strong>' + overdue.length + ' follow-up' + (overdue.length === 1 ? ' is' : 's are') + ' overdue.</strong> ' +
            overdue.map(function (f) { return window.$.esc(f.subject) + ' — ' + (f.person ? window.$.esc(f.person.name) : 'contact'); }).join('; ') + '.'
        }));
      }

      body.appendChild(el('div.card', [
        el('div.card-head', [el('h2', { text: 'Waiting for' }), el('span.hint', { text: othersOwed.length + ' commitments from other people' })]),
        el('div.card-pad.stack', othersOwed.length ? othersOwed.map(function (x) {
          var row = clickable(window.UI.commitmentRow(x.commitment, {
            actions: [
              x.overdue ? window.UI.chip('Overdue ' + x.daysOverdue + 'd', 'danger') : null,
              window.UI.btnSm('Follow up', 'primary', function () {
                window.Store.mut.followUp(x.commitment.id, 'Follow-up sent');
                window.UI.toast('Follow-up drafted for ' + (x.person ? x.person.name : 'contact'), 'ok');
                window.App.render();
              })
            ].filter(Boolean)
          }), function () { openCommitment(x.commitment.id); });
          return el('div', [row]);
        }) : [window.UI.empty('✓', 'Not waiting on anyone', 'Every commitment you are tracking has an answer.')])
      ]));

      body.appendChild(el('div.card', [
        el('div.card-head', [el('h2', { text: 'Active follow-ups' })]),
        el('div.card-pad.stack', openFollowUps.length ? openFollowUps.map(function (f) {
          var row = el('div.item', [
            el('span.dot.' + (f.derived === 'followup_due' ? 'hi' : 'mid')),
            el('div.grow', [
              el('div.t', { text: f.subject }),
              el('div.s', { text: f.detail }),
              el('div.s.faint', { text: f.meta.label + (f.person ? ' · ' + f.person.name : '') })
            ]),
            el('div.actions', [
              window.UI.chip(f.meta.label, f.meta.chip),
              window.UI.btnSm('Mark received', 'ghost', function () {
                window.Store.mut.resolveFollowUp(f.id);
                window.UI.toast('Marked as received', 'ok');
                window.App.render();
              })
            ])
          ]);
          return clickable(row, function () { openFollowUp(f.id); });
        }) : [window.UI.empty('✓', 'No follow-ups open')])
      ]));
    }

    root.appendChild(window.UI.page(
      tab === 'waiting' ? 'Waiting for' : 'Commitments',
      'Direction, certainty and deadlines extracted from email and meeting transcripts.',
      el('div.stack', [tabs, body])
    ));
  }

  window.ViewCommitments = { view: view };
})();