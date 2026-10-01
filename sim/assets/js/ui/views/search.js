/* ============================================================
   View — Universal search + AI answers
   ============================================================ */
(function () {
  'use strict';

  var el = function () { return window.$.el.apply(null, arguments); };
  var esc = function (s) { return window.$.esc(s); };

  var state = { q: '' };

  var KIND_LABEL = {
    email: 'Email', meeting: 'Meeting', task: 'Task', document: 'Document',
    contact: 'Contact', commitment: 'Commitment', event: 'Calendar event', followup: 'Follow-up'
  };

  var EXAMPLES = [
    'What did I promise John?',
    'Who am I waiting for?',
    'What am I forgetting?',
    'What are my deadlines this week?',
    'When did I last speak with Sarah?',
    'What did we agree in the last meeting?',
    'Summarise my emails',
    'pricing'
  ];

  function routeFor(doc) {
    switch (doc.kind) {
      case 'email': return '#/mail/' + doc.id;
      case 'meeting': return '#/meetings/' + doc.id;
      case 'task': return '#/tasks/' + doc.id;
      case 'document': return '#/documents/' + doc.id;
      case 'contact': return '#/contacts/' + doc.id;
      case 'commitment': return '#/commitments';
      case 'event': return '#/calendar';
      case 'followup': return '#/waiting';
    }
    return '#/search';
  }

  function resultRow(doc) {
    var row = el('div.item.click', [
      el('span.dot.neutral'),
      el('div.grow', [
        el('div.t', { text: doc.title }),
        el('div.s', { text: doc.snippet || '' }),
        el('div.actions', [
          window.UI.chip(KIND_LABEL[doc.kind], 'muted'),
          window.UI.chip(doc.meta, 'acc')
        ])
      ])
    ]);
    row.onclick = function () { window.App.go(routeFor(doc)); };
    return row;
  }

  function answerItem(it) {
    var kindMap = { danger: 'danger', warn: 'warn', acc: 'acc', success: 'success', muted: 'muted' };
    return el('div.ai-item', [
      el('div.t', { text: it.title }),
      it.sub ? el('div.s', { text: it.sub }) : null,
      it.quote ? window.UI.quote(it.quote) : null,
      it.source ? window.UI.sourceBtn(it.source) : null,
      it.chip ? el('div.actions', [window.UI.chip(it.chip, kindMap[it.chip] || 'muted')]) : null
    ].filter(Boolean));
  }

  function answerCard(a) {
    return el('div.ai-note', [
      el('div.avatar', { text: 'AI' }),
      el('div.body.stack', [
        el('p', { html: a.html }),
        a.list && a.list.length ? el('div.stack', a.list.map(answerItem)) : null,
        a.refs && a.refs.length ? el('div.stack', a.refs.slice(0, 5).map(resultRow)) : null
      ].filter(Boolean))
    ]);
  }

  function view(root) {
    var route = window.App.route();
    if (route.params[0]) state.q = decodeURIComponent(route.params[0]);

    var bar = el('input.search-big', {
      type: 'search',
      placeholder: 'Search everything… try "John", "pricing", or "proposal"',
      value: state.q
    });

    var answerHost = el('div', { style: { marginBottom: '18px' } });
    var results = el('div');

    function run() {
      state.q = bar.value.trim();
      window.$.clear(answerHost);
      window.$.clear(results);

      if (!state.q) {
        results.appendChild(el('div.card', [
          el('div.card-head', [
            el('h2', { text: 'Ask a question' }),
            el('span.hint', { text: 'Answers are built from your own data' })
          ]),
          el('div.card-pad.row', EXAMPLES.map(function (q) {
            return window.UI.btnSm(q, 'secondary', function () {
              bar.value = q;
              window.App.go('#/search/' + encodeURIComponent(q));
            });
          }))
        ]));
        return;
      }

      var looksLikeQuestion = /\?|what|who|when|why|how|promise|forget|waiting|deadline|agree|summar|todo|task/i.test(state.q);
      if (looksLikeQuestion) {
        var a = window.EnginesBriefing.answer(state.q);
        answerHost.appendChild(el('div.card', [
          el('div.card-head', [
            el('h2', { text: 'Answer' }),
            el('span.hint', { text: 'Composed from your email, calendar, meetings and tasks' })
          ]),
          el('div.card-pad', [answerCard(a)])
        ]));
      }

      var hits = window.EnginesSearch.query(state.q, 30);
      results.appendChild(el('div.card', [
        el('div.card-head', [
          el('h2', { text: 'Results' }),
          el('span.hint', { text: hits.length + ' match' + (hits.length === 1 ? '' : 'es') + ' across every source' })
        ]),
        el('div.card-pad.stack', hits.length
          ? hits.map(resultRow)
          : [window.UI.empty('⌕', 'Nothing found', 'Try a person, a project or a keyword.')])
      ]));
    }

    bar.addEventListener('input', run);
    bar.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') window.App.go('#/search/' + encodeURIComponent(bar.value.trim()));
    });

    root.appendChild(el('div.page-head', [
      el('h1', { text: 'Universal search' }),
      el('div.sub', { text: 'One box across email, calendar, meetings, tasks, documents, commitments and people.' })
    ]));
    root.appendChild(el('div', { style: { marginBottom: '18px' } }, [bar]));
    root.appendChild(answerHost);
    root.appendChild(results);

    run();
  }

  window.ViewSearch = { view: view, state: state };
})();
