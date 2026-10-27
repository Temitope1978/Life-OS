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
  /* The speaker label for a turn the user adds is THEIR OWN name —
     never the demo persona's. */
  function speakerName() {
    try {
      if (window.Identity && window.Identity.firstName) {
        var f = window.Identity.firstName();
        if (f) return f.toUpperCase();
      }
    } catch (e) {}
    return 'YOU';
  }

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
          mt.transcript.push({ spk: speakerName(), text: '' });
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

  /* ---------- AI notetaker ----------
     Upload a transcript file or paste a transcript, let the rules
     engine extract what matters, review and edit the result, then
     save it into the signed-in account's own meetings. Nothing is
     saved until the user presses Save, and a recording is never
     "transcribed" without a provider — the engine says so instead.

     The notetaker's working state lives at MODULE scope, not inside
     the view: any re-render (a route change, a store notification, an
     auth refresh) rebuilds the view, and closure-held state was lost
     with it — which made the controls look dead. */
  var notetakerState = {
    results: null,   /* the analysis waiting for review */
    text: '',        /* pasted transcript text */
    title: '',       /* meeting title typed by the user */
    status: '',      /* last status message */
    busy: false
  };

  function notetakerCard() {
    var body = el('div.stack');
    var status = el('div.s.faint', { text: notetakerState.status || 'Upload a transcript file, or paste the transcript below.' });
    var results = null;

    var fileInput = el('input.input', {
      type: 'file',
      accept: 'audio/*,video/*,.txt,.vtt,.md,.srt,.json,text/plain',
      style: { display: 'block', marginBottom: '10px' }
    });
    var paste = el('textarea.textarea', { rows: 4, value: notetakerState.text, placeholder: 'Paste a transcript here (speaker: text, one turn per line).' });
    var title = el('input.input', { type: 'text', value: notetakerState.title, placeholder: 'Meeting title (optional)' });

    paste.addEventListener('input', function () { notetakerState.text = paste.value; });
    title.addEventListener('input', function () { notetakerState.title = title.value; });

    function setStatus(text, kind) {
      notetakerState.status = text;
      status.textContent = text;
      status.className = 's' + (kind ? ' ' + kind : ' faint');
    }

    function analyseText(text, sourceLabel) {
      var analysis = window.EnginesNotetaker.analyse(text, {});
      notetakerState.results = {
        analysis: analysis,
        transcriptText: text,
        sourceLabel: sourceLabel,
        title: title.value.trim()
      };
      renderResults();
      /* Ask the server for a model-based analysis. When no model is
         configured the deterministic rules result stands on its own -
         the user is told which one they are looking at. */
      /* Guard: if there is no transcript text */
      if (!text || !String(text).trim()) {
        setStatus('Nothing to analyse - enter a transcript or upload a file first.', 'faint');
        notetakerState.results = null;
        renderResults();
        return;
      }
      setStatus('Analysis ready — refining with the AI model…', 'faint');
      window.EnginesNotetaker.analyseRemote(text).then(function (ai) {
        if (!ai) {
          setStatus('Analysis ready (deterministic rules — no AI model is configured for this deployment).', 'faint');
          return;
        }
        var st = notetakerState.results;
        if (!st) return;
        st.ai = ai;
        st.analysis.summary = ai.summary || st.analysis.summary;
        st.analysis.decisions = ai.decisions && ai.decisions.length ? ai.decisions : st.analysis.decisions;
        st.analysis.actionItems = ai.actionItems && ai.actionItems.length ? ai.actionItems : st.analysis.actionItems;
        st.analysis.followUps = ai.followUps && ai.followUps.length ? ai.followUps : st.analysis.followUps;
        st.analysis.extraction = 'model';
        setStatus('Analysis ready (AI-generated — review every item before saving).', 'faint');
        renderResults();
      });
    }

    function renderResults() {
      var results = notetakerState.results;
      if (!results) return;
      body.appendChild(el('div.card', [
        el('div.card-head', [
          el('h2', { text: 'Review before saving' }),
          el('span.hint', {
            text: results.analysis.extraction === 'model'
              ? 'AI-generated from the transcript — edit anything'
              : 'Extracted with deterministic rules — edit anything'
          })
        ]),
        el('div.card-pad.stack', [
          el('div.field', [
            el('label', { text: 'Title' }),
            (function () {
              var t = el('input.input', { type: 'text', value: results.title || '' });
              t.addEventListener('input', function () { results.title = t.value; });
              return t;
            })()
          ]),
          el('div.field', [
            el('label', { text: 'Summary' }),
            (function () {
              var s = el('textarea.textarea', { rows: 3, value: results.analysis.summary });
              s.addEventListener('input', function () { results.analysis.summary = s.value; });
              return s;
            })()
          ]),
          listField('Decisions', results.analysis.decisions, 'decisions'),
          listField('Action items', results.analysis.actionItems, 'actionItems'),
          listField('Follow-ups', results.analysis.followUps, 'followUps'),
          listField('Deadlines', results.analysis.deadlines.map(function (d) { return d.evidence || d.phrase; }), 'deadlines'),
          el('div.field', [
            el('label', { text: 'Commitments detected' }),
            results.analysis.commitments.length
              ? el('ul.tidy', results.analysis.commitments.map(function (k) {
                  return el('li', { text: (k.description || '') + (k.dueDate ? ' (due ' + k.dueDate + ')' : '') });
                }))
              : el('div.s.faint', { text: 'No commitments detected.' })
          ]),
          el('div.actions', [
            el('button.btn.btn-primary', {
              type: 'button', text: 'Save to my meetings', onclick: function () {
                var results = notetakerState.results;
                if (!results) { window.UI.toast('Nothing to save yet', 'err'); return; }
                var mt = window.EnginesNotetaker.buildMeeting({
                  analysis: results.analysis,
                  title: results.title || 'Meeting recording',
                  source: results.sourceLabel,
                  transcript: window.EnginesNotetaker.sentences(results.transcriptText).map(function (line) {
                    return { spk: 'Transcript', text: line };
                  })
                });
                var saved = window.Store.mut.addUserMeeting(mt);
                if (!saved) { window.UI.toast('Could not save the meeting', 'err'); return; }
                /* Save the action items as real tasks in the same
                   account — each one is a normal task the user can
                   edit, complete or delete. */
                var created = 0;
                results.analysis.actionItems.forEach(function (line) {
                  window.Store.mut.createTask({
                    title: line.slice(0, 120),
                    status: 'Inbox',
                    source: { type: 'meeting', ref: saved.id },
                    priority: 'medium'
                  });
                  created++;
                });
                window.UI.toast('Meeting saved' + (created ? ' — ' + created + ' action item(s) added' : ''), 'ok');
                notetakerState.results = null;
                notetakerState.text = '';
                notetakerState.title = '';
                window.App.go('#/meetings/' + saved.id);
              }
            }),
            el('button.btn.btn-ghost', {
              type: 'button', text: 'Discard', onclick: function () {
                notetakerState.results = null;
                notetakerState.text = '';
                notetakerState.title = '';
                setStatus('Discarded. Nothing was saved.', 'faint');
                window.App.render();
              }
            })
          ])
        ])
      ]));
    }

    function listField(label, items, key) {
      var ta = el('textarea.textarea', { rows: Math.max(2, items.length), value: items.join('\n') });
      ta.addEventListener('input', function () {
        results.analysis[key] = ta.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      });
      return el('div.field', [el('label', { text: label }), ta]);
    }

    function processFile() {
      var file = fileInput.files && fileInput.files[0];
      var pasted = paste.value.trim();
      notetakerState.text = paste.value;
      if (!file && !pasted) {
        setStatus('Choose a file or paste a transcript first.', 'faint');
        return;
      }
      if (notetakerState.busy) return;
      if (file) {
        var v = window.EnginesNotetaker.validateFile(file);
        if (!v.ok) { setStatus(v.error, 'faint'); return; }
        notetakerState.busy = true;
        setStatus('Reading ' + v.name + '…', 'faint');
        window.EnginesNotetaker.transcribe(file).then(function (res) {
          notetakerState.busy = false;
          if (!res.ok) {
            setStatus(res.error, 'faint');
            return;
          }
          setStatus('Transcribed ' + res.name + ' — extracting decisions, actions and deadlines…', 'faint');
          analyseText(res.text, 'Uploaded transcript: ' + res.name);
        }, function (e) {
          notetakerState.busy = false;
          setStatus('The file could not be processed: ' + ((e && e.message) || 'unknown error'), 'faint');
        });
      } else {
        setStatus('Analysing the pasted transcript…', 'faint');
        analyseText(pasted, 'Pasted transcript');
      }
    }

    body.appendChild(el('div.stack', [
      el('div.field', [
        el('label', { text: 'Meeting recording or transcript file' }),
        fileInput,
        el('div.s.faint', {
          text: 'Audio and video are accepted, but this deployment has no transcription ' +
                'provider — upload a transcript file (.txt, .vtt, .md) or paste the ' +
                'transcript to get a summary, decisions, action items and deadlines.'
        })
      ]),
      el('div.field', [el('label', { text: 'Title' }), title]),
      el('div.field', [el('label', { text: 'Or paste a transcript' }), paste]),
      el('div.actions', [
        el('button.btn.btn-primary', { type: 'button', text: 'Analyse', onclick: processFile })
      ]),
      status
    ]));

    /* A re-render (route change, store update, auth refresh) rebuilds
       this card — restore the analysis that is waiting for review so
       the user's work is never silently thrown away. */
    if (notetakerState.results) renderResults();

    return el('div.card', [
      el('div.card-head', [
        el('h2', { text: 'AI notetaker' }),
        el('span.hint', { text: 'Upload → transcribe → understand → organise → act' })
      ]),
      el('div.card-pad', body)
    ]);
  }

  /* ---------- Meeting list + detail ---------- */
  function view(root) {
    var route = window.App.route();
    var meetingId = route.params[0] || null;

    if (meetingId) return meetingDetail(root, meetingId);

    var ms = window.Store.meetings().slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    var upcoming = window.EnginesTasks.eventsToday().concat(window.EnginesTasks.eventsTomorrow());

    root.appendChild(window.UI.page('Meetings', 'AI reads every meeting, transcript and commitment.', el('div.stack', [
      notetakerCard(),
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
            (m.actionItems && m.actionItems.length) ? el('div.card', [
              el('div.card-head', [el('h2', { text: 'Action items' })]),
              el('div.card-pad', el('ul.tidy', m.actionItems.map(function (a) {
                return el('li', { text: a });
              })))
            ]) : null,
            (m.deadlines && m.deadlines.length) ? el('div.card', [
              el('div.card-head', [el('h2', { text: 'Deadlines' })]),
              el('div.card-pad', el('ul.tidy', m.deadlines.map(function (d) {
                return el('li', { text: (d.phrase || '') + (d.evidence ? ' — ' + d.evidence : '') });
              })))
            ]) : null,
            (m.followUps && m.followUps.length) ? el('div.card', [
              el('div.card-head', [el('h2', { text: 'Follow-ups' })]),
              el('div.card-pad', el('ul.tidy', m.followUps.map(function (f) {
                return el('li', { text: f });
              })))
            ]) : null,
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