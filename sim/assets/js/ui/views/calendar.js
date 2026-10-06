/* ============================================================
   View — Calendar (real month grid + day agenda + conflicts)
   ============================================================ */
(function () {
  'use strict';

  var el = function () { return window.$.el.apply(null, arguments); };
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var state = { day: null, viewDate: null };

  function viewDate() { return state.viewDate || window.D.realToday(); }
  function selectedDay() { return state.day || window.D.realToday(); }

  function eventsFor(iso) {
    return window.Store.events().filter(function (e) { return e.date === iso; })
      .sort(function (a, b) { return a.start.localeCompare(b.start); });
  }

  function conflictPairs(day) {
    var es = eventsFor(day);
    var out = [];
    for (var i = 0; i < es.length; i++) {
      for (var j = i + 1; j < es.length; j++) {
        if (window.D.overlaps(es[i], es[j])) out.push([es[i], es[j]]);
      }
    }
    return out;
  }

  function eventBlock(e, conflicts) {
    var clash = conflicts.some(function (p) { return p[0].id === e.id || p[1].id === e.id; });
    var prep = e.prep && !e.prepDone;
    return el('div.cal-event' + (clash ? '.clash' : ''), {
      onclick: function () { window.Details.open({ kind: 'event', ref: e.id }); }
    }, [
      el('div.time.tabnum', { text: e.start }),
      el('div.body', [
        el('div.t', { text: e.title }),
        el('div.s', { text: e.attendeeIds.map(function (i) { return window.Store.contactName(i); }).join(', ') }),
        el('div.actions', [
          clash ? window.UI.chip('Conflict', 'danger') : null,
          e.location ? window.UI.chip(e.location, 'muted') : null,
          prep ? window.UI.chip('Prep needed', 'warn') : window.UI.chip('Prep ready', 'success')
        ])
      ])
    ]);
  }

  /* A true calendar month grid, anchored to the real local date. */
  function monthGrid() {
    var grid = window.D.buildMonth(viewDate());
    var title = window.D.monthName(viewDate()) + ' ' + window.D.parse(viewDate()).getFullYear();

    var head = el('div.cal-head', [
      el('div.cal-title', { text: title }),
      el('div.cal-nav', [
        el('button.btn.btn-ghost.btn-sm', {
          type: 'button', text: '‹ Prev',
          onclick: function () { state.viewDate = window.D.addMonths(viewDate(), -1); state.day = null; window.App.render(); }
        }),
        el('button.btn.btn-ghost.btn-sm', {
          type: 'button', text: 'Today',
          onclick: function () { state.viewDate = window.D.realToday(); state.day = window.D.realToday(); window.App.render(); }
        }),
        el('button.btn.btn-ghost.btn-sm', {
          type: 'button', text: 'Next ›',
          onclick: function () { state.viewDate = window.D.addMonths(viewDate(), 1); state.day = null; window.App.render(); }
        })
      ])
    ]);

    var wd = el('div.cal-week', DAYS.map(function (d) {
      return el('div.cal-wd', { text: d });
    }));

    var cells = el('div.cal-grid');
    grid.cells.forEach(function (iso) {
      if (!iso) { cells.appendChild(el('div.cal-cell.cal-empty')); return; }
      var dayNum = window.D.parse(iso).getDate();
      var evs = eventsFor(iso);
      var tks = window.EnginesTasks.tasksFor(iso);
      var isToday = iso === window.D.realToday();
      var isSel = iso === selectedDay();
      var cell = el('div.cal-cell' + (isToday ? '.today' : '') + (isSel ? '.selected' : ''), {
        onclick: function () { state.day = iso; state.viewDate = iso; window.App.render(); }
      }, [
        el('div.cal-dn.tabnum', { text: String(dayNum) }),
        el('div.cal-dots', [
          evs.slice(0, 3).map(function () { return el('span.cal-dot.ev'); }),
          tks.slice(0, 3).map(function () { return el('span.cal-dot.tk'); })
        ])
      ]);
      cells.appendChild(cell);
    });

    return el('div.card', [
      el('div.card-head', [head]),
      el('div.card-pad', [wd, cells])
    ]);
  }

  /* Agenda for the selected day — events and dated actions. */
  function dayAgenda() {
    var day = selectedDay();
    var es = eventsFor(day);
    var pairs = conflictPairs(day);
    var tks = window.EnginesTasks.tasksFor(day);

    return el('div.card', [
      el('div.card-head', [
        el('h2', { text: window.D.formatLong(day) }),
        el('span.hint', {
          text: (es.length ? es.length + ' event' + (es.length === 1 ? '' : 's') : 'No events') +
                (tks.length ? ' · ' + tks.length + ' action' + (tks.length === 1 ? '' : 's') : '')
        })
      ]),
      el('div.card-pad.stack', (es.length || tks.length) ? [
        es.length ? el('div', [
          el('div.t-cap', { text: 'Events' }),
          el('div.stack', es.map(function (e) { return eventBlock(e, pairs); }))
        ]) : null,
        tks.length ? el('div', [
          el('div.t-cap', { text: 'Actions' }),
          el('div.stack', tks.map(function (t) {
            var r = window.EnginesPriority.scoreTask(t);
            var row = el('div.item.click', [
              el('span.dot.' + (r.band === 'high' ? 'hi' : r.band === 'medium' ? 'mid' : 'lo')),
              el('div.grow', [
                el('div.t', { text: t.title }),
                el('div.s', { text: t.status + (t.dueTime ? ' · ' + t.dueTime : '') + (t.project ? ' · ' + t.project : '') })
              ])
            ]);
            row.addEventListener('click', function () { window.Details.open({ kind: 'task', ref: t.id }); });
            return row;
          }))
        ]) : null
      ].filter(Boolean) : [window.UI.empty('✓', 'Nothing scheduled', 'Pick another day, or add an action.')])
    ]);
  }

  function conflictCard(iso) {
    var pairs = conflictPairs(iso);
    if (!pairs.length) return null;
    return el('div.alert.alert-danger', [
      el('strong', { text: '⚠ Scheduling conflict. ' }),
      el('span', {
        text: pairs.map(function (p) {
          return p[0].title + ' (' + p[0].start + '–' + p[0].end + ') overlaps ' + p[1].title + ' (' + p[1].start + '–' + p[1].end + ')';
        }).join('. ') + '.'
      })
    ]);
  }

  function view(root) {
    var day = selectedDay();
    var es = eventsFor(day);
    var prep = es.filter(function (e) { return e.prep && !e.prepDone; });

    root.appendChild(window.UI.page('Calendar', monthGrid(), el('div.stack', [
      conflictCard(day),
      prep.length ? el('div.alert.alert-warn', {
        html: '<strong>Preparation needed. </strong>' +
          prep.length + ' meeting' + (prep.length === 1 ? ' has' : 's have') +
          ' no briefing yet. ' +
          '<button class="btn btn-sm btn-primary" data-prep>Prepare my meetings</button>'
      }) : null,
      dayAgenda(),
      el('div.card', [
        el('div.card-head', [el('h2', { text: 'Meeting preparation' })]),
        el('div.card-pad.stack', prep.length ? [
          el('div.s.faint', { text: 'The AI reads the last interaction, open commitments and prior decisions with each attendee before each meeting.' }),
          window.UI.autonomySegmented(function () { window.App.render(); })
        ] : [window.UI.empty('✓', 'Every meeting is prepared')])
      ])
    ].filter(Boolean))));

    var btn = root.querySelector('[data-prep]');
    if (btn) btn.addEventListener('click', function () { window.App.prepareAll(); });
  }

  window.ViewCalendar = { view: view, state: state };
})();
