/* ============================================================
   View — Calendar (agenda + conflicts)
   ============================================================ */
(function () {
  'use strict';

  var el = function () { return window.$.el.apply(null, arguments); };

  var state = { day: null };

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
      onclick: function () { window.App.openEventBrief(e.id); }
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

  function dayStrip() {
    var strip = el('div.day-strip');
    for (var i = -2; i <= 6; i++) {
      (function (iso) {
        var n = window.EnginesTasks.eventsFor(iso).length;
        var isToday = iso === window.D.today();
        strip.appendChild(el('button.day' + (isToday ? '.active' : ''), {
          type: 'button',
          onclick: function () { state.day = iso; window.App.render(); }
        }, [
          el('div.dw', { text: window.D.weekdayShort(iso) }),
          el('div.dn.tabnum', { text: window.D.dayNum(iso) }),
          n ? el('div.cnt', { text: String(n) }) : null
        ]));
      })(window.D.addDays(window.D.today(), i));
    }
    return strip;
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
    var day = state.day || window.D.today();
    var es = eventsFor(day);
    var pairs = conflictPairs(day);
    var prep = es.filter(function (e) { return e.prep && !e.prepDone; });

    root.appendChild(window.UI.page('Calendar', dayStrip(), el('div.stack', [
      conflictCard(day),
      prep.length ? el('div.alert.alert-warn', {
        html: '<strong>Preparation needed. </strong>' +
          prep.length + ' meeting' + (prep.length === 1 ? ' has' : 's have') +
          ' no briefing yet. ' +
          '<button class="btn btn-sm btn-primary" data-prep>Prepare my meetings</button>'
      }) : null,
      el('div.card', [
        el('div.card-head', [
          el('h2', { text: window.D.formatLong(day) }),
          el('span.hint', { text: es.length + ' event' + (es.length === 1 ? '' : 's') })
        ]),
        el('div.card-pad', es.length
          ? es.map(function (e) { return eventBlock(e, pairs); })
          : [window.UI.empty('✓', 'Nothing scheduled', 'Pick another day above.')])
      ]),
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