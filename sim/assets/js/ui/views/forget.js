/* ============================================================
   View — Forgetting detection
   ============================================================ */
(function () {
  'use strict';

  var el = function () { return window.$.el.apply(null, arguments); };

  function view(root) {
    var list = window.EnginesForgetting.detect();
    var meta = window.EnginesForgetting.EXPLAINERS;

    root.appendChild(window.UI.page('Possible forgotten items',
      'Cross-checks every source: email, calendar, meetings, tasks and documents.',
      el('div.stack', [
        el('div.card', [
          el('div.card-head', [
            el('h2', { text: list.length + ' item' + (list.length === 1 ? '' : 's') + ' detected' }),
            el('span.hint', { text: 'Nothing is deleted — everything stays traceable' })
          ]),
        el('div.card-pad.stack', list.length ? list.map(function (f) {
          var row = el('div.item', [
            el('span.dot.' + (f.confidence === 'high' ? 'hi' : f.confidence === 'medium' ? 'mid' : 'lo')),
            el('div.grow', [
              el('div.t', { text: f.title }),
              el('div.s', { text: f.detail }),
              el('div.why', {
                html: '<strong>Detected by ' + window.$.esc(f.rule) + '</strong> — ' +
                      window.$.esc(meta[f.rule] || '')
              }),
              window.UI.sourceBtn(f.source)
            ]),
            el('div.actions', [
              window.UI.confidenceChip(f.confidence),
              f.task ? window.UI.btnSm('Add task', 'primary', function () {
                var t = window.Store.mut.createTask(f.task);
                window.Store.mut.ignore('forgetting', f.id);
                window.UI.toast('Task created: ' + t.title, 'ok');
                window.App.go('#/tasks/' + t.id);
              }) : null
            ])
          ]);
          row.classList.add('click');
          row.addEventListener('click', function (e) {
            if (e.target.closest('.actions')) return;
            window.Details.open({ kind: 'forgetting', ref: f.id });
          });
          return row;
        }) : [window.UI.empty('✓', 'Nothing has been forgotten', 'All commitments and deadlines are tracked.')])
        ]),
        el('div.card', [
          el('div.card-head', [el('h2', { text: 'How this works' })]),
          el('div.card-pad', [
            el('p.s.faint', {
              text: 'The AI does not search for what you typed. It searches for what you should have done.'
            }),
            el('ul.tidy', Object.keys(meta).map(function (k) {
              return el('li', [
                el('strong', { text: k + ' — ' }),
                el('span', { text: meta[k] })
              ]);
            }))
          ])
        ])
      ])));
  }

  window.ViewForget = { view: view };
})();