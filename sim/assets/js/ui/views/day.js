/* ============================================================
   View — My Day
   ============================================================ */
(function () {
  'use strict';

  var el = function () { return window.$.el.apply(null, arguments); };

  function section(title, hint, items) {
    if (!items.length) return null;
    return el('div.card', [
      el('div.card-head', [
        el('h2', { text: title }),
        hint ? el('span.hint', { text: hint }) : null
      ]),
      el('div.card-pad', items)
    ]);
  }

  function meetingLine(e) {
    var prep = e.prep && !e.prepDone;
    return el('div.item.click', [
      el('span.dot.' + (prep ? 'mid' : 'neutral')),
      el('div.grow', [
        el('div.t', { text: e.start + '–' + e.end + ' · ' + e.title }),
        el('div.s', {
          text: e.attendeeIds.map(function (i) { return window.Store.contactName(i); }).join(', ') +
                (e.location ? ' · ' + e.location : '')
        }),
        prep ? el('div.s', { style: { color: 'var(--warning)', fontWeight: '600' }, text: 'Preparation needed' }) : null
      ]),
      el('div.actions', prep ? [
        window.UI.btnSm('Prepare', 'ghost', function () { window.App.openEventBrief(e.id); })
      ] : [])
    ]);
  }

  function view(root) {
    var todayEvents = window.EnginesTasks.eventsToday();
    var overdue = window.EnginesTasks.overdue();
    var dueToday = window.Store.activeTasks().filter(function (t) { return t.dueDate === window.D.today(); });
    var waiting = window.EnginesFollowUp.waitingOn();
    var prep = window.EnginesTasks.needsPrep();
    var important = window.EnginesMail.classifyAll().filter(function (r) {
      return r.category === 'Urgent' || r.category === 'Action Required';
    });
    var atRisk = window.EnginesCommitment.userOwed().filter(function (k) {
      return k.dueDate && window.D.daysBetween(window.D.today(), k.dueDate) <= 1;
    });

    root.appendChild(window.UI.page('My Day', window.D.formatLong(window.D.today()), el('div.stack', [
      section('Meetings', todayEvents.length + ' today', todayEvents.map(meetingLine)),
      section('Overdue tasks', 'These are past their due date', overdue.map(function (t) {
        var r = window.EnginesPriority.scoreTask(t);
        return window.UI.taskRow({ task: t, band: r.band }, { clickable: true });
      })),
      section('Due today', '', dueToday.map(function (t) {
        var r = window.EnginesPriority.scoreTask(t);
        return window.UI.taskRow({ task: t, band: r.band }, { clickable: true });
      })),
      section('Waiting for', 'Outstanding dependencies on other people', waiting.map(function (f) {
        return el('div.item.click', [
          el('span.dot.mid'),
          el('div.grow', [
            el('div.t', { text: (f.person ? f.person.name : 'Unknown') + ' — ' + f.subject.toLowerCase() }),
            el('div.s', { text: f.detail })
          ]),
          el('div.actions', [
            window.UI.chip(f.meta.label, f.meta.chip)
          ])
        ]);
      })),
      section('Preparation needed', prep.length + ' meeting' + (prep.length === 1 ? '' : 's'), prep.map(function (e) {
        return el('div.item', [
          el('span.dot.mid'),
          el('div.grow', [
            el('div.t', { text: e.title + ' · ' + window.D.formatDate(e.date) + ' ' + e.start }),
            el('div.s', { text: 'No briefing prepared' })
          ]),
          el('div.actions', [
            window.UI.btnSm('Prepare', 'primary', function () { window.App.openEventBrief(e.id); })
          ])
        ]);
      })),
      section('Important emails', important.length + ' need a response', important.map(function (r) {
        var row = el('div.item.click', [
          el('span.dot.' + (r.category === 'Urgent' ? 'hi' : 'mid')),
          el('div.grow', [
            el('div.t', { text: r.email.subject }),
            el('div.s', { text: (r.email.contactId ? window.Store.contactName(r.email.contactId) : r.email.external) + ' · ' + r.email.preview })
          ]),
          el('div.actions', [window.UI.categoryChip(r.category)])
        ]);
        row.onclick = function () { window.App.go('#/mail/' + r.email.id); };
        return row;
      })),
      section('Commitments at risk', 'Due today or overdue', atRisk.map(function (k) {
        return window.UI.commitmentRow(k);
      }))
    ].filter(Boolean))));
  }

  window.ViewDay = { view: view };
})();