/* ============================================================
   Briefing Engine — "Prepare My Day" and meeting briefings
   ============================================================ */
(function () {
  'use strict';

  function num(n) { return '<strong>' + n + '</strong>'; }
  function plural(n, s, p) { return n + ' ' + (n === 1 ? s : (p || s + 's')); }

  /** The daily briefing sentence required by spec §16. */
  function headlineSentence() {
    var todayEvents = window.EnginesTasks.eventsToday();
    var top = window.EnginesPriority.top(1)[0];
    var bits = ['You have ' + num(plural(todayEvents.length, 'meeting')) + ' today.'];

    if (top) {
      var t = top.task;
      bits.push('Your highest-priority task is <strong>' + escapeHtml(t.title) + '</strong>.');
      var ins = window.EnginesTasks.dependencyInsight(t);
      if (ins && ins.contactId) {
        var p = window.Store.contact(ins.contactId);
        bits.push(p ? p.name.split(' ')[0] + ' has not yet sent what you need to complete it.' : '');
      }
    }
    var waiting = window.EnginesFollowUp.overdue();
    if (waiting.length) {
      bits.push(num(plural(waiting.length, 'follow-up')) + ' ' + (waiting.length === 1 ? 'is' : 'are') + ' overdue.');
    }
    return bits.filter(Boolean).join(' ');
  }

  /** Full structured briefing. */
  function build() {
    var todayEvents = window.EnginesTasks.eventsToday();
    var tmrEvents = window.EnginesTasks.eventsTomorrow();
    var top = window.EnginesPriority.top(4);
    var overdueTasks = window.EnginesTasks.overdue();
    var overdueFu = window.EnginesFollowUp.overdue();
    var prep = window.EnginesTasks.needsPrep();
    var forgotten = window.EnginesForgetting.detect();
    var dueToday = window.Store.activeTasks().filter(function (t) { return t.dueDate === window.D.today(); });
    var conflicts = window.EnginesTasks.conflicts();

    var sections = [];

    sections.push({
      title: 'Meetings today',
      items: todayEvents.map(function (e) {
        return {
          text: e.start + ' — ' + e.title + ' with ' +
                e.attendeeIds.map(function (i) { return window.Store.contactName(i); }).join(', ') +
                (e.prep && !e.prepDone ? ' (preparation needed)' : ''),
          action: (e.prep && !e.prepDone) ? 'Prepare' : null,
          ref: { view: 'event', id: e.id }
        };
      })
    });

    if (tmrEvents.length) {
      sections.push({
        title: 'Tomorrow',
        items: tmrEvents.map(function (e) {
          return {
            text: e.start + ' — ' + e.title + (e.prep && !e.prepDone ? ' (preparation needed)' : ''),
            action: null, ref: { view: 'event', id: e.id }
          };
        })
      });
    }

    sections.push({
      title: 'Priority items',
      items: top.map(function (r) {
        var b = window.EnginesTasks.blocker(r.task);
        return {
          text: r.task.title +
            (r.task.dueDate ? ' — ' + window.D.dueLabel(r.task.dueDate).toLowerCase() : '') +
            (b ? ' · blocked on ' + (b.person ? b.person.name : 'a dependency') : ''),
          why: window.EnginesPriority.explain(r.task),
          action: null, ref: { view: 'task', id: r.task.id }
        };
      })
    });

    if (prep.length) {
      sections.push({
        title: 'Preparation needed',
        items: prep.map(function (e) {
          return {
            text: e.title + ' (' + window.D.formatDate(e.date) + ' ' + e.start + ') — no briefing prepared',
            action: 'Prepare', ref: { view: 'event', id: e.id }
          };
        })
      });
    }

    if (forgotten.length) {
      sections.push({
        title: 'Possible forgotten items',
        items: forgotten.slice(0, 3).map(function (f) {
          return { text: f.title, why: f.detail, action: null, ref: { view: 'forget', id: f.id } };
        })
      });
    }

    var waitingList = window.EnginesFollowUp.waitingOn();

    return {
      headline: 'Good morning, ' + window.Store.user().name,
      dateLine: window.D.formatLong(window.D.today()) + ' · ' + window.Store.user().timezone.replace('_', ' '),
      lead: headlineSentence(),
      stats: {
        meetings: todayEvents.length,
        priority: top.length,
        waiting: waitingList.length,
        dueToday: dueToday.length + overdueTasks.length,
        forgotten: forgotten.length
      },
      sections: sections.filter(function (s) { return s.items.length; }),
      conflicts: conflicts
    };
  }

  /** Briefing for a single meeting — the "Prepare Me" magic moment. */
  function forEvent(eventId) {
    var e = window.Store.event(eventId);
    if (!e) return null;
    var names = e.attendeeIds.map(function (i) { return window.Store.contact(i); }).filter(Boolean);

    var people = names.map(function (p) {
      var ks = window.Store.commitments().filter(function (k) { return k.personId === p.id; });
      var lastMeeting = window.Store.meetings().filter(function (m) {
        return m.contactIds.indexOf(p.id) !== -1;
      }).sort(function (a, b) { return b.date.localeCompare(a.date); })[0];
      var docs = window.Store.documents().filter(function (d) {
        return d.contactIds.indexOf(p.id) !== -1;
      });
      return {
        person: p,
        lastInteraction: p.lastInteraction,
        lastMeeting: lastMeeting || null,
        commitments: ks,
        documents: docs
      };
    });

    var objectives = [];
    var openDecisions = [];
    window.Store.meetings().forEach(function (m) {
      if (m.contactIds.some(function (id) { return e.attendeeIds.indexOf(id) !== -1; })) {
        m.decisions.forEach(function (d) { openDecisions.push({ text: d, source: m }); });
      }
    });
    if (e.notes) objectives.push(e.notes);
    objectives.push('Confirm pricing status from ' + names[0].name);
    objectives.push('Agree the phase two scope');

    return {
      event: e,
      people: people,
      objectives: objectives,
      priorDecisions: openDecisions,
      openCommitments: window.EnginesCommitment.othersOwed().filter(function (k) {
        return e.attendeeIds.indexOf(k.personId) !== -1;
      })
    };
  }

  /** Answer a natural-language question about the user's life. */
  function answer(question) {
    var q = String(question || '').toLowerCase().trim();
    var results = window.EnginesSearch.query(q, 12);
    var parts = [];

    if (/what did i promise|what have i promised|promised/.test(q)) return promiseAnswer(q);
    if (/waiting for|awaiting|who owes/.test(q)) return waitingAnswer();
    if (/forgetting|forgot|forgotten/.test(q)) return forgettingAnswer();
    if (/deadline|due|due this week|next week/.test(q)) return deadlineAnswer(q);
    if (/when did i last|last (speak|talk|met)/.test(q)) return lastInteractionAnswer(q);
    if (/what (did )?we agree|decision|agreed/.test(q)) return decisionsAnswer(q);
    if (/summar|meeting/.test(q)) return meetingSummaryAnswer();
    if (/task|todo|to-do/.test(q)) return tasksAnswer();

    return {
      kind: 'answer',
      html: 'I found ' + results.length + ' item' + (results.length === 1 ? '' : 's') +
            ' matching "<strong>' + escapeHtml(question) + '</strong>".',
      refs: results
    };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function promiseAnswer(q) {
    var person = findPerson(q);
    var ks = window.EnginesCommitment.userOwed();
    if (person) ks = ks.filter(function (k) { return k.personId === person.id; });
    var html = person
      ? 'Here is everything you promised <strong>' + escapeHtml(person.name) + '</strong>.'
      : 'Here is everything you have promised.';
    return {
      kind: 'answer', html: html,
      list: ks.map(function (k) {
        return {
          title: k.description,
          sub: window.EnginesCommitment.directionLabel(k.direction) +
               (k.dueDate ? ' · due ' + window.D.dueLabel(k.dueDate).toLowerCase() : ' · no date') +
               ' · ' + k.certainty,
          quote: k.source ? k.source.quote : null,
          source: k.source,
          chip: k.certainty === 'possible' ? 'warn' : 'acc'
        };
      })
    };
  }

  function waitingAnswer() {
    var list = window.EnginesFollowUp.othersOwedDetailed();
    return {
      kind: 'answer',
      html: 'You are waiting on <strong>' + list.length + '</strong> ' +
            (list.length === 1 ? 'person' : 'people') + ':',
      list: list.map(function (x) {
        return {
          title: (x.person ? x.person.name : 'Unknown') + ' — ' + x.commitment.description.toLowerCase(),
          sub: x.overdue ? 'Overdue by ' + x.daysOverdue + ' days' : (x.commitment.dueDate ? 'Due ' + window.D.dueLabel(x.commitment.dueDate).toLowerCase() : 'No date given'),
          quote: x.commitment.source ? x.commitment.source.quote : null,
          source: x.commitment.source,
          chip: x.overdue ? 'danger' : 'muted'
        };
      })
    };
  }

  function forgettingAnswer() {
    var list = window.EnginesForgetting.detect();
    return {
      kind: 'answer',
      html: 'You may have forgotten <strong>' + list.length + '</strong> ' +
            (list.length === 1 ? 'thing' : 'things') + '.',
      list: list.map(function (f) {
        return {
          title: f.title, sub: f.detail, source: f.source,
          chip: f.confidence === 'high' ? 'danger' : (f.confidence === 'medium' ? 'warn' : 'muted'),
          ref: f.id
        };
      })
    };
  }

  function deadlineAnswer(q) {
    var horizon = /next week|this week/.test(q) ? 7 : 3;
    var list = window.Store.activeTasks().filter(function (t) {
      if (!t.dueDate) return false;
      var d = window.D.daysBetween(window.D.today(), t.dueDate);
      return d !== null && d <= horizon;
    }).sort(function (a, b) { return a.dueDate.localeCompare(b.dueDate); });
    return {
      kind: 'answer',
      html: list.length
        ? 'You have <strong>' + list.length + '</strong> deadline' + (list.length === 1 ? '' : 's') + ' in the next ' + horizon + ' days.'
        : 'Nothing is due in the next ' + horizon + ' days.',
      list: list.map(function (t) {
        return {
          title: t.title,
          sub: window.D.dueLabel(t.dueDate) + ' · ' + t.status,
          source: t.source,
          chip: window.D.isPast(t.dueDate) ? 'danger' : (t.dueDate === window.D.today() ? 'warn' : 'muted')
        };
      })
    };
  }

  function lastInteractionAnswer(q) {
    var person = findPerson(q);
    if (!person) return { kind: 'answer', html: 'Tell me who you mean and I will look it up.', list: [] };
    var m = window.Store.meetings().filter(function (x) {
      return x.contactIds.indexOf(person.id) !== -1;
    }).sort(function (a, b) { return b.date.localeCompare(a.date); })[0];
    var e = window.Store.emails().filter(function (x) {
      return x.contactId === person.id;
    }).sort(function (a, b) { return b.received.localeCompare(a.received); })[0];
    return {
      kind: 'answer',
      html: 'You last spoke with <strong>' + escapeHtml(person.name) + '</strong> on ' +
            '<strong>' + window.D.formatDate(m ? m.date : person.lastInteraction) + '</strong>' +
            (m ? ' — "' + escapeHtml(m.title) + '"' : '') + '.',
      list: []
    };
  }

  function decisionsAnswer(q) {
    var person = findPerson(q);
    var ms = window.Store.meetings().filter(function (m) {
      return !person || m.contactIds.indexOf(person.id) !== -1;
    });
    var list = [];
    ms.forEach(function (m) {
      m.decisions.forEach(function (d) {
        list.push({ title: d, sub: m.title + ' · ' + window.D.formatDate(m.date),
                    source: { type: 'meeting', ref: m.id }, chip: 'acc' });
      });
    });
    return {
      kind: 'answer',
      html: list.length
        ? 'You agreed <strong>' + list.length + '</strong> ' + (list.length === 1 ? 'decision' : 'decisions') + ':'
        : 'I could not find any recorded decisions.',
      list: list
    };
  }

  function meetingSummaryAnswer() {
    var ms = window.Store.meetings().slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    return {
      kind: 'answer',
      html: 'Here are your <strong>' + ms.length + '</strong> recorded meetings.',
      list: ms.map(function (m) {
        return {
          title: m.title,
          sub: window.D.formatDate(m.date) + ' · ' + m.summary,
          source: { type: 'meeting', ref: m.id },
          chip: 'muted',
          ref: m.id
        };
      })
    };
  }

  function tasksAnswer() {
    var r = window.EnginesPriority.ranked().slice(0, 6);
    return {
      kind: 'answer',
      html: 'Here are your <strong>' + r.length + '</strong> highest-priority tasks.',
      list: r.map(function (x) {
        return {
          title: x.task.title,
          sub: window.EnginesPriority.explain(x.task),
          source: x.task.source,
          chip: x.band === 'high' ? 'danger' : x.band === 'medium' ? 'warn' : 'muted'
        };
      })
    };
  }

  /** Match a person name inside a question. */
  function findPerson(q) {
    var contacts = window.Store.contacts();
    for (var i = 0; i < contacts.length; i++) {
      var full = contacts[i].name.toLowerCase();
      var first = full.split(' ')[0];
      if (q.indexOf(full) !== -1 || q.indexOf(first) !== -1) return contacts[i];
    }
    return null;
  }

  window.EnginesBriefing = {
    build: build,
    forEvent: forEvent,
    answer: answer,
    findPerson: findPerson,
    headlineSentence: headlineSentence
  };
})();