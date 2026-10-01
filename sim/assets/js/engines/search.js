/* ============================================================
   Search Engine — ranked cross-source search
   ============================================================ */
(function () {
  'use strict';

  function score(hay, q) {
    var h = String(hay || '').toLowerCase();
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    var s = 0;
    terms.forEach(function (t) {
      if (h.indexOf(t) === -1) { s -= 10; return; }
      s += 1;
      if (h.indexOf(t) === 0) s += 3;
    });
    return s;
  }

  function all() {
    var docs = [];

    window.Store.emails().forEach(function (e) {
      var c = window.EnginesMail.classify(e);
      var p = window.Store.contact(e.contactId);
      docs.push({
        kind: 'email', id: e.id, title: e.subject,
        snippet: c.reason,
        meta: c.category + ' · ' + (p ? p.name : e.external) + ' · ' + window.D.agoLabel(e.received),
        contactId: e.contactId,
        hay: [e.subject, e.body, e.preview, p ? p.name : '', e.external].join(' ')
      });
    });

    window.Store.meetings().forEach(function (m) {
      docs.push({
        kind: 'meeting', id: m.id, title: m.title,
        snippet: m.summary,
        meta: window.D.formatDate(m.date) + ' · ' + m.decisions.length + ' decisions · ' + m.transcript.length + ' turns',
        contactId: m.contactIds[0] || null,
        hay: [m.title, m.summary, m.transcript.map(function (t) { return t.text; }).join(' ')].join(' ')
      });
    });

    window.Store.tasks().forEach(function (t) {
      docs.push({
        kind: 'task', id: t.id, title: t.title,
        snippet: 'Status ' + t.status + (t.dueDate ? ' · due ' + window.D.dueLabel(t.dueDate).toLowerCase() : ''),
        meta: t.project || 'Task',
        contactId: t.contactId,
        hay: [t.title, t.project || '', t.status].join(' ')
      });
    });

    window.Store.documents().forEach(function (d) {
      docs.push({
        kind: 'document', id: d.id, title: d.filename,
        snippet: d.summary,
        meta: d.type + ' · ' + (d.project || 'Document'),
        contactId: d.contactIds[0] || null,
        hay: [d.filename, d.summary, d.project || ''].join(' ')
      });
    });

    window.Store.contacts().forEach(function (c) {
      docs.push({
        kind: 'contact', id: c.id, title: c.name,
        snippet: c.relationship + ' at ' + c.org,
        meta: c.email,
        contactId: c.id,
        hay: [c.name, c.org, c.relationship, c.email, c.notes].join(' ')
      });
    });

    window.Store.commitments().forEach(function (k) {
      var p = window.Store.contact(k.personId);
      docs.push({
        kind: 'commitment', id: k.id, title: k.description,
        snippet: window.EnginesCommitment.directionLabel(k.direction) + ' · ' + (p ? p.name : 'unknown') +
                 (k.dueDate ? ' · due ' + window.D.dueLabel(k.dueDate).toLowerCase() : ''),
        meta: 'Commitment (' + k.certainty + ')',
        contactId: k.personId,
        hay: [k.description, p ? p.name : '', k.source ? k.source.label : '', k.source ? (k.source.quote || '') : ''].join(' ')
      });
    });

    window.Store.events().forEach(function (e) {
      docs.push({
        kind: 'event', id: e.id, title: e.title,
        snippet: (e.notes || '') + ' · ' + e.attendeeIds.map(function (i) { return window.Store.contactName(i); }).join(', '),
        meta: window.D.formatDate(e.date) + ' ' + e.start,
        contactId: e.attendeeIds[0] || null,
        hay: [e.title, e.notes || '', e.attendeeIds.map(function (i) { return window.Store.contactName(i); }).join(' ')].join(' ')
      });
    });

    window.Store.followUps().forEach(function (f) {
      docs.push({
        kind: 'followup', id: f.id, title: 'Follow up: ' + f.subject,
        snippet: f.detail,
        meta: 'Waiting on ' + (f.person ? f.person.name : 'contact'),
        contactId: f.contactId,
        hay: [f.subject, f.detail, f.person ? f.person.name : ''].join(' ')
      });
    });

    return docs;
  }

  function query(q, limit) {
    if (!q || !q.trim()) return [];
    return all().map(function (d) {
      return { doc: d, score: score(d.hay, q) };
    }).filter(function (r) { return r.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, limit || 25)
      .map(function (r) { return r.doc; });
  }

  /** Everything related to a person. */
  function byPerson(contactId) {
    return all().filter(function (d) { return d.contactId === contactId; });
  }

  /** Everything related to a project (by name match on task/doc project). */
  function byProject(name) {
    var n = String(name).toLowerCase();
    return all().filter(function (d) {
      return String(d.meta || '').toLowerCase().indexOf(n) !== -1 ||
             String(d.snippet || '').toLowerCase().indexOf(n) !== -1;
    });
  }

  window.EnginesSearch = { all: all, query: query, byPerson: byPerson, byProject: byProject };
})();