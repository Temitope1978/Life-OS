/* ============================================================
   View — AI Command Center (home)
   ============================================================ */
(function () {
  'use strict';

  var el = function () { return window.$.el.apply(null, arguments); };

  function greeting() {
    var h = window.D.realNow().getHours();
    var u = window.Store.user();
    var part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    var tz = window.D.timeZoneLabel() || window.D.timeZone();
    return {
      text: part + ', ' + u.name,
      sub: window.D.realDayName() + ', ' + window.D.realDateLong() + ' · ' +
           window.D.localTime() + ' · ' + tz
    };
  }

  function statCard(n, label, kind, ref) {
    return el('div.stat' + (kind ? '.' + kind : ''), {
      style: ref ? { cursor: 'pointer' } : null,
      onclick: ref ? function () { window.App.go(ref); } : null
    }, [
      el('div.n.tabnum', { text: String(n) }),
      el('div.l', { text: label })
    ]);
  }

  function statsRow() {
    var b = window.EnginesBriefing.build();
    return el('div.stat-row', [
      statCard(b.stats.meetings, 'Meetings today', '', '#/day'),
      statCard(b.stats.priority, 'Priority items', 'warn', '#/day'),
      statCard(b.stats.waiting, 'Waiting for', 'warn', '#/waiting'),
      statCard(b.stats.dueToday, 'Due or overdue', 'crit', '#/day'),
      statCard(b.stats.forgotten, 'Possible forgotten', b.stats.forgotten ? 'crit' : 'ok', '#/forget')
    ]);
  }

  /** Priority list with inline dependency explanation. */
  function priorityCard() {
    var top = window.EnginesPriority.top(4);
    var body = el('div.card-pad');
    if (!top.length) {
      body.appendChild(window.UI.empty('✓', 'Nothing needs attention', 'No priority items right now.'));
    } else {
      top.forEach(function (r) {
        var ins = window.EnginesTasks.dependencyInsight(r.task);
        var actions = [];
        if (ins && ins.contactId) {
          actions.push(window.UI.btnSm('Follow up?', 'ghost', function () {
            window.App.go('#/waiting');
          }));
        }
        body.appendChild(window.UI.taskRow(r, {
          clickable: true, showWhy: true,
          actions: actions
        }));
        if (ins) {
          body.appendChild(el('div.why', {
            html: '<strong>Dependency:</strong> ' + window.$.esc(ins.text) +
                  ' <em>' + window.$.esc(ins.suggestion) + '</em>'
          }));
        }
      });
    }
    return el('div.card', [
      el('div.card-head', [
        el('h2', { text: 'Priority items' }),
        el('span.hint', { text: 'Ranked by urgency, deadline, dependency and client involvement' })
      ]),
      body
    ]);
  }

  /** The daily briefing — the "Prepare My Day" magic moment. */
  function briefingCard(briefing) {
    var body = el('div.card-pad.stack');
    body.appendChild(window.UI.aiNote(briefing.lead, null, 'AI'));
    briefing.sections.forEach(function (s) {
      var sec = el('div');
      sec.appendChild(el('div.t-cap', { text: s.title, style: { marginBottom: '6px' } }));
      s.items.forEach(function (it) {
        var line = el('div.item', [
          el('span.dot.lo'),
          el('div.grow', [
            el('div.t', { text: it.text }),
            it.why ? el('div.s.faint', { text: it.why }) : null
          ]),
          el('div.actions', it.action ? [
            window.UI.btnSm(it.action, 'ghost', function () { window.App.go(it.ref.view === 'event' ? '#/calendar' : it.ref.view); })
          ] : [])
        ]);
        sec.appendChild(line);
      });
      body.appendChild(sec);
    });
    return el('div.card', [
      el('div.card-head', [
        el('h2', { text: 'Your daily briefing' }),
        el('span.hint', { text: 'Prepared from calendar, email, tasks, follow-ups and deadlines' })
      ]),
      body
    ]);
  }

  /** Forgetting preview — 1 item, with a link to the full list. */
  function forgottenCard() {
    var list = window.EnginesForgetting.detect();
    var body = el('div.card-pad');
    if (!list.length) {
      body.appendChild(window.UI.empty('✓', 'Nothing forgotten', 'All commitments and deadlines are tracked.'));
    } else {
      var f = list[0];
      body.appendChild(el('div.item', [
        el('span.dot.hi'),
        el('div.grow', [
          el('div.t', { text: f.title }),
          el('div.s', { text: f.detail })
        ])
      ]));
      body.appendChild(window.UI.sourceBtn(f.source));
      if (list.length > 1) {
        body.appendChild(el('div.row.mt', [
          el('span.chip.muted', { text: (list.length - 1) + ' more' }),
          el('button.btn.btn-ghost.btn-sm', {
            type: 'button', text: 'See all',
            onclick: function () { window.App.go('#/forget'); }
          })
        ]));
      }
    }
    return el('div.card', [
      el('div.card-head', [
        el('h2', { text: 'Possible forgotten items' }),
        el('span.hint', { text: list.length ? 'Found by cross-checking all sources' : 'All sources cross-checked' })
      ]),
      body
    ]);
  }

  /** Reminders due now. */
  function remindersCard() {
    var list = window.EnginesTasks.remindersDue();
    if (!list.length) return null;
    var body = el('div.card-pad');
    list.forEach(function (r) {
      var row = el('div.item.click', [
        el('span.dot.mid'),
        el('div.grow', [
          el('div.t', { text: r.title }),
          el('div.s', { text: r.context })
        ]),
        el('div.actions', [window.UI.sourceBtn(r.source)])
      ]);
      row.addEventListener('click', function (e) {
        if (e.target.closest('.actions')) return;
        window.Details.open({ kind: 'reminder', ref: r.id });
      });
      body.appendChild(row);
    });
    return el('div.card', [
      el('div.card-head', [el('h2', { text: 'Reminders' })]),
      body
    ]);
  }

  /** Quick commands. */
  function quickCard() {
    var cmds = [
      ['Prepare my day', 'day'],
      ['What am I forgetting?', 'forget'],
      ['Who am I waiting for?', 'waiting'],
      ['What did I promise John?', 'commitments'],
      ['Summarize my emails', 'mail'],
      ['Prepare my meetings', 'meetings']
    ];
    var body = el('div.card-pad.row');
    cmds.forEach(function (c) {
      body.appendChild(window.UI.btnSm(c[0], 'secondary', function () {
        window.App.runCommand(c[0]);
      }));
    });
    return el('div.card', [
      el('div.card-head', [el('h2', { text: 'Commands' }), el('span.hint', { text: 'Or type in the bar above' })]),
      body
    ]);
  }

  function view(root) {
    var g = greeting();
    var briefing = window.EnginesBriefing.build();

    root.appendChild(el('div.page-head', [
      el('div.row.between', [
        el('div', [
          el('h1', { text: g.text }),
          el('div.sub', { text: g.sub })
        ]),
        el('button.btn.btn-primary', {
          type: 'button', text: '+ Add action',
          onclick: function () { window.Details.createAction(); }
        })
      ])
    ]));

    root.appendChild(window.UI.commandBar(function (q) { window.App.runCommand(q); }));
    root.appendChild(statsRow());

    /* Conflicts must be visible, not buried. */
    if (briefing.conflicts.length) {
      root.appendChild(el('div.conflict-banner', { style: { marginBottom: '18px' } }, [
        el('span', { text: '⚠' }),
        el('span', { text: briefing.conflicts.length + ' scheduling conflict' + (briefing.conflicts.length === 1 ? '' : 's') + ' today — ' +
          briefing.conflicts.map(function (c) { return c.a.title + ' overlaps ' + c.b.title; }).join('; ') })
      ]));
    }

    root.appendChild(el('div.grid.grid-sidebar', [
      el('div.stack', [
        briefingCard(briefing),
        priorityCard()
      ]),
      el('div.stack', [
        forgottenCard(),
        quickCard(),
        remindersCard()
      ].filter(Boolean))
    ]));
  }

  window.ViewCommand = { view: view };
})();