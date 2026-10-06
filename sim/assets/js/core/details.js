/* ============================================================
   Details — reusable full-content detail modals + action form
   Every object type opens with its complete content, never a
   truncated preview. Fields the seed does not carry are omitted.
   ============================================================ */
(function () {
  'use strict';

  var el = function () { return window.$.el.apply(null, arguments); };
  var esc = function (s) { return window.$.esc(s); };

  /* ---------- small builders ---------- */
  function field(label, value) {
    if (value === null || value === undefined || value === '') return null;
    return el('div.field', [
      el('label', { text: label }),
      el('div', { text: String(value) })
    ]);
  }

  function pair(a, b) {
    var xs = [a, b].filter(Boolean);
    return xs.length ? el('div.two-col', xs) : null;
  }

  function linkRow(title, sub, onclick) {
    var row = el('div.item.click', [
      el('span.dot.neutral'),
      el('div.grow', [
        el('div.t', { text: title }),
        sub ? el('div.s', { text: sub }) : null
      ])
    ]);
    row.addEventListener('click', function (e) {
      if (e.target.closest('.actions')) return;
      onclick();
    });
    return row;
  }

  function prio(p) {
    return p ? p.charAt(0).toUpperCase() + p.slice(1) : null;
  }

  function dueText(iso) {
    if (!iso) return null;
    return window.D.formatDate(iso) + ' · ' + (window.D.dueLabel(iso) || '');
  }

  /* ---------- email ---------- */
  function emailDetail(e, ctx) {
    if (!e) return null;
    var r = window.EnginesMail.classify(e);
    var c = e.contactId ? window.Store.contact(e.contactId) : null;
    var u = window.Store.user();
    var suspicious = r.category === 'Suspicious';
    var related = window.EnginesTasks.tasksFromEmail(e.id);

    var body = el('div.stack', [
      el('div.row', [
        window.UI.categoryChip(r.category),
        el('span.s', { text: window.D.formatDateTime(e.received) + (c && c.org ? ' · ' + c.org : '') })
      ]),
      field('From', c ? c.name + ' · ' + c.org + ' · ' + c.email : (e.external || 'External sender')),
      field('To', u.name + ' · ' + u.email),
      suspicious ? el('div.alert.alert-danger', {
        html: '<strong>⚠ Held for your review.</strong> This message looks like a payment-diversion scam. It has not been treated as a real instruction.'
      }) : null,
      el('div.email-body', { html: esc(e.body).replace(/\n/g, '<br>') }),
      el('div.divider'),
      field('Classification', r.reason),
      related.length ? el('div', [
        el('div.t-cap', { text: 'Related actions' }),
        el('div.stack', related.map(function (t) {
          return linkRow(t.title, t.status + (t.dueDate ? ' · due ' + window.D.formatDate(t.dueDate) : ''), function () {
            ctx.swap();
            window.Details.open({ kind: 'task', ref: t.id });
          });
        }))
      ]) : null
    ].filter(Boolean));

    var actions = [];
    if (!suspicious) {
      actions.push(el('button.btn.btn-secondary', {
        type: 'button', text: 'Add task', onclick: function () {
          window.Store.mut.createTask({
            title: 'Reply: ' + e.subject,
            project: 'Client work',
            dueDate: window.D.today(),
            priority: r.category === 'Urgent' ? 'high' : 'medium',
            source: { type: 'email', ref: e.id },
            contactId: e.contactId
          });
          window.UI.toast('Task added from email', 'ok');
          ctx.swap();
          window.App.render();
        }
      }));
    }
    actions.push(el('button.btn.btn-ghost', {
      type: 'button', text: 'Open in Inbox', onclick: function () {
        ctx.swap();
        window.App.go('#/mail/' + e.id);
      }
    }));

    return { title: e.subject, body: body, actions: actions };
  }

  /* ---------- event ---------- */
  function eventDetail(e, ctx) {
    if (!e) return null;
    var names = (e.attendeeIds || []).map(function (id) { return window.Store.contactName(id); }).join(', ');
    var prep = e.prep ? (e.prepDone ? 'Briefing ready' : 'Preparation needed') : 'No preparation required';

    var body = el('div.stack', [
      el('div.row', [
        el('span.s', { text: window.D.formatLong(e.date) + ' · ' + e.start + '–' + e.end }),
        e.location ? window.UI.chip(e.location, 'muted') : null,
        e.prep ? (e.prepDone ? window.UI.chip('Prep ready', 'success') : window.UI.chip('Prep needed', 'warn')) : null
      ].filter(Boolean)),
      field('Location', e.location),
      field('Participants', names),
      field('Preparation', prep),
      field('Notes', e.notes)
    ].filter(Boolean));

    var actions = [];
    if (e.prep && !e.prepDone) {
      actions.push(el('button.btn.btn-primary', {
        type: 'button', text: 'Prepare me', onclick: function () {
          ctx.swap();
          window.App.openEventBrief(e.id);
        }
      }));
    }
    actions.push(el('button.btn.btn-secondary', {
      type: 'button', text: 'Open briefing', onclick: function () {
        ctx.swap();
        window.App.openEventBrief(e.id);
      }
    }));
    return { title: e.title, body: body, actions: actions };
  }

  /* ---------- task ---------- */
  function taskDetail(t, ctx) {
    if (!t) return null;
    var r = window.EnginesPriority.scoreTask(t);
    var ins = window.EnginesTasks.dependencyInsight(t);
    var p = t.contactId ? window.Store.contact(t.contactId) : null;
    var src = t.source ? window.Store.resolveSource(t.source) : null;

    var body = el('div.stack', [
      el('div.row', [
        window.UI.chip((r.band || 'medium') + ' priority', r.band === 'high' ? 'danger' : r.band === 'medium' ? 'warn' : 'muted'),
        window.UI.chip(t.status, 'acc'),
        t.project ? window.UI.chip(t.project, 'muted') : null,
        t.userCreated ? window.UI.chip('Created by you', 'acc') : null
      ].filter(Boolean)),
      field('Description', t.description),
      pair(
        field('Due date', t.dueDate ? dueText(t.dueDate) : null),
        field('Due time', t.dueTime)
      ),
      pair(
        field('Reminder', t.reminder ? window.D.formatDateTime(t.reminder) : null),
        field('Priority', prio(t.priority))
      ),
      field('Relationship', p ? p.name + ' · ' + p.relationship : null),
      field('Source', src ? src.label : 'Created by you'),
      ins ? el('div.alert.alert-warn', {
        html: '<strong>Blocked.</strong> ' + esc(ins.text) + ' <em>' + esc(ins.suggestion) + '</em>'
      }) : null,
      window.UI.whyPanel('This task came from ' + (src ? esc(src.label) : 'you directly') + '.', t.source)
    ].filter(Boolean));

    var actions = [
      el('button.btn.btn-secondary', {
        type: 'button', text: 'Edit', onclick: function () {
          ctx.swap();
          window.Details.openEditAction(t, {
            onClose: function () { window.Details.open({ kind: 'task', ref: t.id }, ctx.opts); }
          });
        }
      })
    ];
    ['In Progress', 'Waiting', 'Completed'].forEach(function (s) {
      if (t.status === s) return;
      actions.push(el('button.btn.btn-ghost', {
        type: 'button', text: s, onclick: function () {
          window.Store.mut.updateTask(t.id, { status: s });
          window.UI.toast('Moved to ' + s, 'ok');
          ctx.swap();
          window.Details.open({ kind: 'task', ref: t.id }, ctx.opts);
        }
      }));
    });
    return { title: t.title, body: body, actions: actions };
  }

  /* ---------- commitment ---------- */
  function commitmentDetail(k, ctx) {
    if (!k) return null;
    var p = window.Store.contact(k.personId);
    var owed = k.direction === 'user_to_others' || k.direction === 'mutual';

    var body = el('div.stack', [
      el('div.row', [
        window.UI.chip(window.EnginesCommitment.directionLabel(k.direction), window.EnginesCommitment.directionChip(k.direction)),
        window.UI.confidenceChip(k.confidence),
        k.certainty ? window.UI.chip(k.certainty, k.certainty === 'confirmed' ? 'success' : 'warn') : null,
        k.confirmedByUser ? window.UI.chip('You confirmed', 'success') : null
      ].filter(Boolean)),
      field('Description', k.description),
      field('Person', p ? p.name + ' · ' + p.relationship : null),
      field('Due date', k.dueDate ? dueText(k.dueDate) : 'No date'),
      field('Source quote', k.source && k.source.quote ? '"' + k.source.quote + '"' : null),
      window.UI.sourceBtn(k.source)
    ].filter(Boolean));

    var actions = [];
    if (owed) {
      actions.push(el('button.btn.btn-secondary', {
        type: 'button', text: k.confirmedByUser ? 'Unconfirm' : 'Confirm', onclick: function () {
          window.Store.mut.confirmCommitment(k.id, k.confirmedByUser ? false : true);
          window.UI.toast(k.confirmedByUser ? 'Commitment unconfirmed' : 'Commitment confirmed', 'ok');
          ctx.swap();
          window.Details.open({ kind: 'commitment', ref: k.id }, ctx.opts);
        }
      }));
    }
    actions.push(el('button.btn.btn-ghost', {
      type: 'button', text: 'Add task', onclick: function () {
        window.Store.mut.createTask({
          title: k.description,
          project: 'Client work',
          dueDate: k.dueDate,
          priority: k.dueDate && window.D.isPast(k.dueDate) ? 'high' : 'medium',
          source: k.source,
          contactId: k.personId
        });
        window.UI.toast('Task added', 'ok');
        ctx.swap();
        window.App.render();
      }
    }));
    return { title: p ? p.name : 'Commitment', body: body, actions: actions };
  }

  /* ---------- follow-up ---------- */
  function followupDetail(f, ctx) {
    if (!f) return null;
    var p = f.person || window.Store.contact(f.contactId);

    var body = el('div.stack', [
      el('div.row', [
        window.UI.chip(f.meta.label, f.meta.chip),
        f.daysOverdue ? window.UI.chip('Overdue ' + f.daysOverdue + 'd', 'danger') : null
      ].filter(Boolean)),
      field('Subject', f.subject),
      field('Detail', f.detail),
      field('Person', p ? p.name : null),
      field('Due date', f.dueDate ? dueText(f.dueDate) : 'No date'),
      window.UI.sourceBtn(f.source)
    ].filter(Boolean));

    var actions = [
      el('button.btn.btn-primary', {
        type: 'button', text: 'Mark received', onclick: function () {
          window.Store.mut.resolveFollowUp(f.id);
          window.UI.toast('Marked as received', 'ok');
          ctx.close();
          window.App.render();
        }
      })
    ];
    return { title: f.subject, body: body, actions: actions };
  }

  /* ---------- forgetting ---------- */
  function forgettingDetail(f, ctx) {
    if (!f) return null;
    var meta = window.EnginesForgetting.EXPLAINERS[f.rule] || '';

    var body = el('div.stack', [
      el('div.row', [
        window.UI.confidenceChip(f.confidence),
        window.UI.chip('Rule ' + f.rule, 'muted')
      ]),
      field('What', f.title),
      field('Why', f.detail),
      field('Detected by', f.rule + ' — ' + meta),
      field('Due date', f.dueDate ? dueText(f.dueDate) : null),
      window.UI.sourceBtn(f.source)
    ].filter(Boolean));

    var actions = [];
    if (f.task) {
      actions.push(el('button.btn.btn-primary', {
        type: 'button', text: 'Add task', onclick: function () {
          var t = window.Store.mut.createTask(f.task);
          window.Store.mut.ignore('forgetting', f.id);
          window.UI.toast('Task created: ' + t.title, 'ok');
          ctx.swap();
          window.Details.open({ kind: 'task', ref: t.id });
        }
      }));
    }
    actions.push(el('button.btn.btn-ghost', {
      type: 'button', text: 'Ignore', onclick: function () {
        window.Store.mut.ignore('forgetting', f.id);
        window.UI.toast('Ignored', 'ok');
        ctx.close();
        window.App.render();
      }
    }));
    return { title: 'Possible forgotten item', body: body, actions: actions };
  }

  /* ---------- reminder ---------- */
  function reminderDetail(r, ctx) {
    if (!r) return null;
    var body = el('div.stack', [
      field('Due', window.D.formatDateTime(r.dueAt)),
      field('Context', r.context),
      window.UI.sourceBtn(r.source)
    ].filter(Boolean));

    var actions = [
      el('button.btn.btn-secondary', {
        type: 'button', text: 'Create task', onclick: function () {
          window.Store.mut.createTask({
            title: r.title,
            description: r.context,
            dueDate: r.dueAt.slice(0, 10),
            source: r.source
          });
          window.UI.toast('Task created', 'ok');
          ctx.close();
          window.App.render();
        }
      })
    ];
    return { title: r.title, body: body, actions: actions };
  }

  /* ---------- open dispatcher ---------- */
  function open(item, opts) {
    opts = opts || {};
    if (!item || !item.kind || !item.ref) return;
    var m;
    var ctx = {
      close: function () { if (m) m.close(); },
      swap: function () {
        var root = document.getElementById('modal-root');
        if (root) window.$.clear(root);
      },
      opts: opts
    };

    var built = null;
    switch (item.kind) {
      case 'email':       built = emailDetail(window.Store.email(item.ref), ctx); break;
      case 'event':       built = eventDetail(window.Store.event(item.ref), ctx); break;
      case 'task':        built = taskDetail(window.Store.task(item.ref), ctx); break;
      case 'commitment':  built = commitmentDetail(window.Store.commitment(item.ref), ctx); break;
      case 'followup':    built = followupDetail(findFollowUp(item.ref), ctx); break;
      case 'forgetting':  built = forgettingDetail(findForgetting(item.ref), ctx); break;
      case 'reminder':    built = reminderDetail(findReminder(item.ref), ctx); break;
      case 'meeting':     ctx.swap(); window.App.go('#/meetings/' + item.ref); return;
    }
    if (!built) { window.UI.toast('Detail not found', 'err'); return; }
    m = window.UI.modal({ title: built.title, body: built.body, actions: built.actions, onClose: opts.onClose });
  }

  function findFollowUp(id) {
    var fs = window.Store.followUps();
    for (var i = 0; i < fs.length; i++) if (fs[i].id === id) return fs[i];
    return null;
  }
  function findForgetting(id) {
    var list = window.EnginesForgetting.detect();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function findReminder(id) {
    var rs = window.SEED.reminders;
    for (var i = 0; i < rs.length; i++) if (rs[i].id === id) return rs[i];
    return null;
  }

  /* ---------- action form (create / edit) ---------- */
  function projects() {
    var seen = {};
    var out = [];
    window.Store.tasks().forEach(function (t) {
      if (t.project && !seen[t.project]) { seen[t.project] = true; out.push(t.project); }
    });
    return out;
  }

  function buildForm(task) {
    var title = el('input.input', { type: 'text', placeholder: 'Action title' });
    title.value = task ? task.title : '';
    var desc = el('textarea.textarea', { rows: 3, placeholder: 'Details (optional)' });
    desc.value = task ? (task.description || '') : '';
    var dueDate = el('input.input', { type: 'date' });
    dueDate.value = task ? (task.dueDate || '') : '';
    var dueTime = el('input.input', { type: 'time' });
    dueTime.value = task ? (task.dueTime || '') : '';
    var reminder = el('input.input', { type: 'datetime-local' });
    reminder.value = task ? (task.reminder || '') : '';
    var project = el('input.input', { type: 'text', list: 'project-list', placeholder: 'Project (optional)' });
    project.value = task ? (task.project || '') : '';

    var priority = el('select.select');
    ['high', 'medium', 'low'].forEach(function (p) {
      priority.appendChild(el('option', { value: p, text: p.charAt(0).toUpperCase() + p.slice(1) }));
    });
    priority.value = (task && ['high', 'medium', 'low'].indexOf(task.priority) !== -1) ? task.priority : 'medium';

    var status = el('select.select');
    window.EnginesTasks.STATES.forEach(function (s) {
      status.appendChild(el('option', { value: s, text: s }));
    });
    status.value = (task && window.EnginesTasks.STATES.indexOf(task.status) !== -1) ? task.status : 'Inbox';

    var datalist = el('datalist#project-list');
    projects().forEach(function (p) { datalist.appendChild(el('option', { value: p })); });

    var errBox = el('div.alert.alert-danger', { style: { display: 'none' } });

    var body = el('div.stack', [
      errBox,
      el('div.field', [el('label', { text: 'Title' }), title]),
      el('div.field', [el('label', { text: 'Description' }), desc]),
      el('div.two-col', [
        el('div.field', [el('label', { text: 'Due date' }), dueDate]),
        el('div.field', [el('label', { text: 'Due time' }), dueTime])
      ]),
      el('div.two-col', [
        el('div.field', [el('label', { text: 'Priority' }), priority]),
        el('div.field', [el('label', { text: 'Status' }), status])
      ]),
      el('div.field', [el('label', { text: 'Reminder' }), reminder]),
      el('div.field', [el('label', { text: 'Project' }), project]),
      datalist
    ]);

    function collect() {
      return {
        title: title.value.trim(),
        description: desc.value.trim() || null,
        dueDate: dueDate.value || null,
        dueTime: dueTime.value || null,
        reminder: reminder.value || null,
        project: project.value.trim() || null,
        priority: priority.value,
        status: status.value
      };
    }
    function validate(data) {
      var errs = [];
      if (!data.title) errs.push('Title is required.');
      if (data.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)) errs.push('Due date must be a valid date.');
      if (data.dueTime && !/^\d{2}:\d{2}$/.test(data.dueTime)) errs.push('Due time must be in HH:MM format.');
      if (data.reminder && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(data.reminder)) errs.push('Reminder must be a valid date and time.');
      return errs;
    }
    function showErr(errs) {
      errBox.style.display = '';
      errBox.textContent = errs.join(' ');
    }
    return { body: body, collect: collect, validate: validate, showErr: showErr, title: title };
  }

  function createAction(opts) {
    opts = opts || {};
    var form = buildForm(null);
    var m;
    var save = el('button.btn.btn-primary', {
      type: 'button', text: 'Create action', onclick: function () {
        var data = form.collect();
        var errs = form.validate(data);
        if (errs.length) { form.showErr(errs); return; }
        window.Store.mut.createTask(data);
        window.UI.toast('Action created', 'ok');
        m.close();
        if (opts.onDone) opts.onDone();
      }
    });
    m = window.UI.modal({ title: 'New action', body: form.body, actions: [save] });
    setTimeout(function () { form.title.focus(); }, 30);
  }

  function openEditAction(task, opts) {
    opts = opts || {};
    if (!task) return;
    var form = buildForm(task);
    var m;
    var save = el('button.btn.btn-primary', {
      type: 'button', text: 'Save changes', onclick: function () {
        var data = form.collect();
        var errs = form.validate(data);
        if (errs.length) { form.showErr(errs); return; }
        window.Store.mut.updateTask(task.id, data);
        window.UI.toast('Action updated', 'ok');
        m.close();
        if (opts.onDone) opts.onDone();
      }
    });
    m = window.UI.modal({ title: 'Edit action', body: form.body, actions: [save], onClose: opts.onClose });
    setTimeout(function () { form.title.focus(); }, 30);
  }

  window.Details = {
    open: open,
    createAction: createAction,
    openEditAction: openEditAction
  };
})();
