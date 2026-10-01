/* ============================================================
   View — Meetings & transcripts (the "Prepare Me" magic moment)
   ============================================================ */
(function () {
  'use strict';

  var el = function () { return window.$.el.apply(null, arguments); };

  /* ---------- Briefing modal ---------- */
  function openBriefing(eventId) {
    var b = window.EnginesBriefing.forEvent(eventId);
    if (!b) return;
    var e = b.event;

    var body = el('div.stack');

    body.appendChild(window.UI.aiNote(
      'Here is what you need for <strong>' + window.$.esc(e.title) + '</strong> on ' +
      window.D.formatDate(e.date) + ' at ' + e.start + '.',
      'Sources: calendar · email · meeting transcripts · documents · commitments', 'AI'));

    /* People */
    body.appendChild(el('div.t-cap', { text: 'Who is in the room' }));
    b.people.forEach(function (p) {
      var body2 = el('div.stack', { style: { padding: '12px', border: '1px solid var(--border)', borderRadius: '10px' } }, [
        el('div.row', [
          window.UI.avatar(p.person.id, 34),
          el('div.grow', [
            el('div.t', { text: p.person.name }),
            el('div.s', { text: p.person.relationship + ' at ' + p.person.org })
          ])
        ]),
        el('div.s', { html: '<strong>Last spoke:</strong> ' + window.D.formatDate(p.lastInteraction) +
          (p.lastMeeting ? ' — "' + window.$.esc(p.lastMeeting.title) + '"' : '') }),
        p.commitments.length ? el('div', [
          el('div.t-cap', { text: 'Open commitments' }),
          el('div.stack', p.commitments.map(function (k) {
            return el('div.s', {
              text: window.EnginesCommitment.directionLabel(k.direction) + ': ' + k.description +
                    (k.dueDate ? ' (due ' + window.D.dueLabel(k.dueDate).toLowerCase() + ')' : '')
            });
          }))
        ]) : null,
        p.documents.length ? el('div', [
          el('div.t-cap', { text: 'Shared documents' }),
          el('div.stack', p.documents.map(function (d) {
            return el('button.source', {
              type: 'button',
              html: '📄 ' + window.$.esc(d.filename) + ' &nbsp;·&nbsp; view',
              onclick: function () { m.close(); window.App.go('#/documents'); }
            });
          }))
        ]) : null
      ]);
      body.appendChild(body2);
    });

    /* Objectives + prior decisions */
    body.appendChild(el('div.two-col', [
      el('div', [
        el('div.t-cap', { text: 'Suggested objectives' }),
        el('ul.tidy', b.objectives.map(function (o) { return el('li', { text: o }); }))
      ]),
      el('div', [
        el('div.t-cap', { text: 'Decisions from previous meetings' }),
        b.priorDecisions.length
          ? el('ul.tidy', b.priorDecisions.map(function (d) {
              return el('li', [
                el('span', { text: d.text + ' ' }),
                window.UI.btnSm(d.source.title, 'ghost', function () { m.close(); window.App.go('#/meetings/' + d.source.id); })
              ]);
            }))
          : el('div.s.faint', { text: 'No recorded decisions with these people.' })
      ])
    ]));

    if (b.openCommitments.length) {
      body.appendChild(el('div.alert.alert-warn', {
        html: '<strong>Do not forget.</strong> You still owe ' +
          b.openCommitments.map(function (k) {
            var p = window.Store.contact(k.personId);
            return window.$.esc(k.description.toLowerCase()) + (p ? ' to ' + window.$.esc(p.name) : '');
          }).join(', ') + '. Raise it in this meeting.'
      }));
    }

    body.appendChild(el('div.s.faint', {
      text: 'Prepared automatically by your AI OS. You can adjust everything before the meeting.'
    }));

    var m = window.UI.modal({
      title: 'Prepare me — ' + e.title,
      body: body,
      actions: [
        el('button.btn.btn-primary', {
          type: 'button', text: 'Mark as prepared', onclick: function () {
            window.Store.mut.markPrepared(e.id);
            m.close();
            window.UI.toast('Marked as prepared', 'ok');
            window.App.render();
          }
        })
      ],
      onClose: function () { window.App.render(); }
    });
  }

  /* ---------- Transcript editor ---------- */
  function openTranscript(meetingId) {
    var mt = window.Store.meeting(meetingId);
    if (!mt) return;
    var inputs = [];

    var body = el('div.stack', [
      el('div.s.faint', {
        text: 'Edit what was actually said. Commitments and decisions are extracted again on save.'
      })
    ]);

    mt.transcript.forEach(function (turn, i) {
      var ta = el('textarea.textarea', { rows: 2, value: turn.text });
      inputs.push(ta);
      body.appendChild(el('div', [
        el('div.s', {
          text: turn.spk,
          style: { fontWeight: '600', marginBottom: '4px', color: 'var(--primary)' }
        }),
        ta
      ]));
    });

    body.appendChild(el('div.row', [
      el('button.btn.btn-secondary', {
        type: 'button', text: '+ Add turn', onclick: function () {
          mt.transcript.push({ spk: 'TEMITOPE', text: '' });
          m.close(); openTranscript(meetingId);
        }
      })
    ]));

    var m = window.UI.modal({
      title: 'Edit transcript — ' + mt.title,
      body: body,
      actions: [
        el('button.btn.btn-primary', {
          type: 'button', text: 'Save and re-extract', onclick: function () {
            inputs.forEach(function (ta, i) { mt.transcript[i].text = ta.value; });
            window.Store.mut.saveTranscript(meetingId, mt.transcript);
            m.close();
            window.UI.toast('Transcript saved — commitments re-extracted', 'ok');
            window.App.render();
          }
        })
      ]
    });
  }

  /* ---------- Meeting list + detail ---------- */
  function view(root) {
    var route = window.App.route();
    var meetingId = route.params[0] || null;

    if (meetingId) return meetingDetail(root, meetingId);

    var ms = window.Store.meetings().slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    var upcoming = window.EnginesTasks.eventsToday().concat(window.EnginesTasks.eventsTomorrow());

    root.appendChild(window.UI.page('Meetings', 'AI reads every meeting, transcript and commitment.', el('div.stack', [
      el('div.card', [
        el('div.card-head', [
          el('h2', { text: 'Upcoming' }),
          el('span.hint', { text: upcoming.length + ' in the next 48 hours' })
        ]),
        el('div.card-pad', upcoming.length ? upcoming.map(function (e) {
          var prep = e.prep && !e.prepDone;
          return el('div.item.click', [
            el('span.dot.' + (prep ? 'mid' : 'ok')),
            el('div.grow', [
              el('div.t', { text: e.title }),
              el('div.s', { text: window.D.formatDate(e.date) + ' · ' + e.start + '–' + e.end +
                ' · ' + e.attendeeIds.map(function (i) { return window.Store.contactName(i); }).join(', ') })
            ]),
            el('div.actions', [
              prep ? window.UI.chip('Prep needed', 'warn') : window.UI.chip('Prep ready', 'success'),
              window.UI.btnSm('Prepare me', 'primary', function () { openBriefing(e.id); })
            ])
          ]);
        }) : [window.UI.empty('✓', 'No upcoming meetings')])
      ]),
      el('div.card', [
        el('div.card-head', [el('h2', { text: 'Past meetings' }), el('span.hint', { text: ms.length + ' recorded' })]),
        el('div.card-pad', ms.map(function (m) {
          var ks = window.Store.commitments().filter(function (k) {
            return k.source && k.source.kind === 'meeting' && k.source.ref === m.id;
          });
          var row = el('div.item.click', [
            el('span.dot.neutral'),
            el('div.grow', [
              el('div.t', { text: m.title }),
              el('div.s', { text: window.D.formatDate(m.date) + ' · ' +
                m.contactIds.map(function (i) { return window.Store.contactName(i); }).join(', ') +
                ' · ' + m.summary })
            ]),
            el('div.actions', [
              window.UI.chip(m.decisions.length + ' decisions', 'acc'),
              ks.length ? window.UI.chip(ks.length + ' commitments', 'warn') : null
            ])
          ]);
          row.onclick = function () { window.App.go('#/meetings/' + m.id); };
          return row;
        }))
      ])
    ])));
  }

  function meetingDetail(root, id) {
    var m = window.Store.meeting(id);
    if (!m) { root.appendChild(window.UI.empty('?', 'Meeting not found')); return; }
    var ks = window.Store.commitments().filter(function (k) {
      return k.source && k.source.kind === 'meeting' && k.source.ref === m.id;
    });

    root.appendChild(window.UI.page(m.title,
      window.D.formatDate(m.date) + ' · ' + m.contactIds.map(function (i) { return window.Store.contactName(i); }).join(', '),
      el('div.stack', [
        el('div.card', [
          el('div.card-head', [
            el('h2', { text: 'Summary' }),
            el('div.actions', [
              window.UI.btnSm('Edit transcript', 'secondary', function () { openTranscript(m.id); })
            ])
          ]),
          el('div.card-pad', [el('p', { text: m.summary })])
        ]),
        el('div.two-col', [
          el('div.card', [
            el('div.card-head', [el('h2', { text: 'Transcript' })]),
            el('div.card-pad.stack', m.transcript.map(function (t) {
              return el('div.turn', [
                el('div.who', { text: t.spk }),
                el('div.txt', { text: t.text })
              ]);
            }))
          ]),
          el('div.stack', [
            el('div.card', [
              el('div.card-head', [el('h2', { text: 'Decisions' })]),
              el('div.card-pad', m.decisions.length
                ? el('ul.tidy', m.decisions.map(function (d) { return el('li', { text: d }); }))
                : el('div.s.faint', { text: 'No decisions recorded.' }))
            ]),
            el('div.card', [
              el('div.card-head', [
                el('h2', { text: 'Commitments extracted' }),
                el('span.hint', { text: ks.length + ' found' })
              ]),
              el('div.card-pad.stack', ks.length ? ks.map(function (k) {
                var row = window.UI.commitmentRow(k, {
                  actions: [window.UI.btnSm(k.confirmedByUser ? 'Confirmed' : 'Confirm', 'ghost', function () {
                    window.Store.mut.confirmCommitment(k.id);
                    window.UI.toast('Commitment confirmed');
                    window.App.render();
                  })]
                });
                return row;
              }) : el('div.s.faint', { text: 'No commitments found in this transcript.' }))
            ])
          ])
        ])
      ])));
  }

  window.ViewMeetings = { view: view, openBriefing: openBriefing, openTranscript: openTranscript };
})();