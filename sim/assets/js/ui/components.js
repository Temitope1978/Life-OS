/* ============================================================
   Shared UI components
   ============================================================ */
(function () {
  'use strict';

  var el = function () { return window.$.el.apply(null, arguments); };
  var esc = function (s) { return window.$.esc(s); };

  /* ---------- Chips ---------- */
  var CAT_CHIP = {
    'Urgent': 'danger', 'Action Required': 'warn', 'Important': 'acc',
    'Waiting': 'muted', 'Newsletter': 'muted', 'Promotion': 'muted',
    'Low Priority': 'muted', 'Suspicious': 'danger'
  };
  function categoryChip(cat) {
    return el('span.chip.' + (CAT_CHIP[cat] || 'muted'), { text: cat });
  }
  function chip(text, kind) { return el('span.chip.' + (kind || 'muted'), { text: text }); }

  function confidenceChip(conf) {
    var kind = conf === 'high' ? 'danger' : conf === 'medium' ? 'warn' : 'muted';
    return chip(conf + ' confidence', kind);
  }

  function dueSpan(dueIso) {
    var lbl = window.D.dueLabel(dueIso);
    if (!lbl) return null;
    return el('span.due.' + window.D.dueClass(dueIso), { text: lbl });
  }

  /* ---------- Avatar ---------- */
  function avatar(contactId, size) {
    var c = window.Store.contact(contactId);
    var txt;
    if (c) txt = c.initials;
    else {
      var u = window.Store.user().name || '?';
      txt = u.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
    }
    return el('span', {
      style: {
        width: (size || 28) + 'px', height: (size || 28) + 'px', borderRadius: '50%',
        background: c ? 'var(--primary)' : 'var(--primary-ink)',
        color: '#fff', display: 'grid', placeItems: 'center',
        fontSize: Math.round((size || 28) * 0.36) + 'px', fontWeight: '700', flex: 'none'
      },
      text: txt
    });
  }

  /* ---------- Source button — every AI claim is traceable ---------- */
  function sourceBtn(source, labelOverride) {
    if (!source) return null;
    var s = window.Store.resolveSource(source);
    return el('button.source', {
      type: 'button',
      html: '<strong>Source:</strong> ' + esc(labelOverride || s.label) +
            (s.kind === 'meeting' && s.ref ? ' &nbsp;·&nbsp; transcript' :
             s.kind === 'email' && s.ref ? ' &nbsp;·&nbsp; open email' : ' &nbsp;·&nbsp; view'),
      onclick: function () { window.App.openSource(s); }
    });
  }

  function quote(text) {
    if (!text) return null;
    return el('div.why', { html: '"' + esc(text) + '"' });
  }

  /* ---------- Why-panel (explainability, spec §19/§57) ---------- */
  function whyPanel(reason, source) {
    return el('div', [
      el('div.why', { html: '<strong>Why:</strong> ' + esc(reason) }),
      sourceBtn(source)
    ]);
  }

  /* ---------- Task row ---------- */
  function taskRow(r, opts) {
    opts = opts || {};
    var t = r.task || r;
    var band = r.band || window.EnginesPriority.scoreTask(t).band;
    var dotKind = band === 'high' ? 'hi' : band === 'medium' ? 'mid' : 'lo';
    var blocker = window.EnginesTasks.blocker(t);
    var due = dueSpan(t.dueDate);

    var sub = el('div.s', [
      el('span', { text: t.status || '' }),
      due ? el('span', { text: ' · ' }) : null,
      due,
      blocker ? el('span', { text: ' · blocked on ' + (blocker.person ? blocker.person.name : 'a dependency') }) : null
    ]);

    var row = el('div.item', { class: opts.clickable ? 'click' : '' }, [
      el('span.dot.' + dotKind),
      el('div.grow', [
        el('div.t', { text: t.title }),
        sub,
        opts.showWhy ? el('div.s.faint', { text: r.factors && r.factors.length ? window.EnginesPriority.explain(t) : '' }) : null
      ]),
      el('div.actions', (opts.actions || []).concat([
        band === 'high' ? chip('High', 'danger') : null
      ]))
    ]);

    if (opts.clickable) {
      row.addEventListener('click', function (e) {
        if (e.target.closest('.actions')) return;
        window.App.go('#/tasks/' + t.id);
      });
    }
    return row;
  }

  /* ---------- Commitment row ---------- */
  function commitmentRow(k, opts) {
    opts = opts || {};
    var p = window.Store.contact(k.personId);
    var dirKind = window.EnginesCommitment.directionChip(k.direction);

    var actions = el('div.actions', (opts.actions || []).concat([
      k.certainty === 'possible' ? chip('Possible', 'warn') : null,
      k.confirmedByUser ? chip('You confirmed', 'success') : null
    ]));

    var row = el('div.item', [
      el('span.dot.' + (k.direction === 'others_to_user' ? 'mid' : 'lo')),
      el('div.grow', [
        el('div.t', { text: k.description }),
        el('div.s', [
          el('span', { text: window.EnginesCommitment.directionLabel(k.direction) }),
          el('span', { text: ' · ' + (p ? p.name : 'Unknown') }),
          k.dueDate ? el('span', { text: ' · due ' }) : null,
          dueSpan(k.dueDate)
        ]),
        opts.showSource !== false ? quote(k.source && k.source.quote) : null,
        opts.showSource !== false ? sourceBtn(k.source) : null
      ]),
      actions
    ]);
    return row;
  }

  /* ---------- Empty state ---------- */
  function empty(icon, title, sub) {
    return el('div.empty', [
      el('div.big', { text: icon || '✓' }),
      el('div', { text: title, style: { fontWeight: '600', color: 'var(--text-mut)' } }),
      sub ? el('p', { text: sub }) : null
    ]);
  }

  /* ---------- Page scaffolding ---------- */
  function page(title, sub, children) {
    /* sub is usually an HTML string, but some views pass a node (the calendar
       day strip) — handle both. */
    var subNode = sub instanceof Node ? sub : (sub ? el('div.sub', { html: sub }) : null);
    return el('div', [
      el('div.page-head', [
        el('h1', { text: title }),
        subNode
      ]),
      children
    ]);
  }

  /* ---------- Toast ---------- */
  function toast(msg, kind) {
    var wrap = document.getElementById('toasts');
    var t = el('div.toast', [
      el('span', { text: kind === 'err' ? '⚠' : kind === 'ok' ? '✓' : 'ℹ' }),
      el('span', { text: msg })
    ]);
    wrap.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .2s'; t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 220);
    }, 2600);
  }

  /* ---------- Modal ---------- */
  function modal(opts) {
    var root = document.getElementById('modal-root');
    window.$.clear(root);
    var back = el('div.modal-back', {
      onclick: function (e) { if (e.target === back) close(); }
    });
    var box = el('div.modal', [
      el('div.modal-head', { html: '<h2>' + esc(opts.title) + '</h2>' }),
      el('div.modal-body', opts.body),
      el('div.modal-foot', (opts.actions || []).concat([
        el('button.btn.btn-secondary', { type: 'button', text: 'Cancel', onclick: close })
      ]))
    ]);
    back.appendChild(box);
    root.appendChild(back);

    function close() { window.$.clear(root); if (opts.onClose) opts.onClose(); }
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
    });
    return { close: close, box: box };
  }

  /* ---------- Autonomy control ---------- */
  var LEVELS = [
    { id: 0, label: 'Manual',       desc: 'AI does nothing without instruction.' },
    { id: 1, label: 'Observe',      desc: 'AI reads and analyses only.' },
    { id: 2, label: 'Suggest',      desc: 'AI recommends, you decide.' },
    { id: 3, label: 'Prepare',      desc: 'AI drafts or prepares actions.' },
    { id: 4, label: 'Confirm',      desc: 'You approve before anything executes.' },
    { id: 5, label: 'Automate',     desc: 'AI executes pre-approved low-risk actions.' }
  ];

  function autonomySegmented(onChange) {
    var cur = window.Store.user().autonomy;
    var seg = el('div.segmented');
    LEVELS.forEach(function (L) {
      seg.appendChild(el('button', {
        type: 'button',
        class: L.id === cur ? 'active' : '',
        text: L.label,
        title: L.desc,
        onclick: function () {
          cur = L.id;
          Array.prototype.forEach.call(seg.children, function (b, i) {
            b.className = LEVELS[i].id === cur ? 'active' : '';
          });
          window.Store.mut.setAutonomy(cur);
          if (onChange) onChange(cur);
        }
      }));
    });
    return seg;
  }

  function autonomyMeta(level) {
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === level) return LEVELS[i];
    return LEVELS[0];
  }

  /* ---------- AI note panel ---------- */
  function aiNote(html, sourceHtml, avatarLabel) {
    return el('div.ai-note', [
      el('div.avatar', { text: avatarLabel || 'AI' }),
      el('div.body', [
        el('p', { html: html }),
        sourceHtml ? el('div.src', { html: sourceHtml }) : null
      ])
    ]);
  }

  /* ---------- Command bar ---------- */
  function commandBar(onRun, placeholder) {
    var input = el('input', {
      type: 'text',
      placeholder: placeholder || 'Ask your Life OS… e.g. “What am I forgetting?”',
      'aria-label': 'Ask your Life OS'
    });
    function submit() {
      var v = input.value.trim();
      if (!v) return;
      input.value = '';
      onRun(v);
    }
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    return el('div.cmd-bar', [
      input,
      el('button.cmd-btn', { type: 'button', text: 'Ask', onclick: submit })
    ]);
  }

  /* ---------- Buttons ---------- */
  function btn(label, kind, onclick) {
    return el('button.btn.btn-' + (kind || 'secondary'), { type: 'button', text: label, onclick: onclick });
  }
  function btnSm(label, kind, onclick) {
    return el('button.btn.btn-' + (kind || 'secondary') + '.btn-sm', { type: 'button', text: label, onclick: onclick });
  }

  /* ---------- Confidence/source meta line ---------- */
  function metaLine(conf, certainty, srcLabel) {
    var bits = [];
    if (certainty) bits.push(certainty === 'possible' ? 'Possible commitment' : 'Confirmed');
    if (conf) bits.push(conf[0].toUpperCase() + conf.slice(1) + ' confidence');
    if (srcLabel) bits.push(srcLabel);
    return bits.join(' · ');
  }

  window.UI = {
    el: el, esc: esc,
    chip: chip, categoryChip: categoryChip, confidenceChip: confidenceChip,
    dueSpan: dueSpan, avatar: avatar,
    sourceBtn: sourceBtn, quote: quote, whyPanel: whyPanel,
    taskRow: taskRow, commitmentRow: commitmentRow,
    empty: empty, page: page, toast: toast, modal: modal,
    autonomySegmented: autonomySegmented, autonomyMeta: autonomyMeta, LEVELS: LEVELS,
    aiNote: aiNote, commandBar: commandBar,
    btn: btn, btnSm: btnSm, metaLine: metaLine
  };
})();