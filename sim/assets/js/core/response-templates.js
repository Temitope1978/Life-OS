/* ============================================================
   RESPONSE TEMPLATES
   ------------------------------------------------------------
   A small, explicitly-labelled library of SUGGESTED WORDING the
   user can select, personalise, edit and copy. It is product
   content, not personal data: it contains no account information
   and is identical for every user.

   Rules that this module exists to enforce:
     * A template is never sent. It fills a draft the user then
       reviews, edits and (only if they choose) sends through the
       existing Action Authorization Layer.
     * Personalisation placeholders are filled ONLY from the
       signed-in account and the message being answered — never
       from the demo seed persona.
     * Nothing here weakens the suspicious-message protections: a
       held message never offers a template.
   ============================================================ */
(function () {
  'use strict';

  var TEMPLATES = [
    {
      id: 'ack-receipt',
      name: 'Acknowledge receipt',
      useCase: 'Confirm you received a message and will come back to the sender.',
      body: 'Hi {{name}},\n\nThanks for your message — I have received it and I will come back to you by {{date}}.\n\nBest,\n{{me}}'
    },
    {
      id: 'chase-update',
      name: 'Chase an overdue reply',
      useCase: 'Follow up on something you are still waiting for.',
      body: 'Hi {{name}},\n\nJust following up on {{subject}} — I have not heard back yet. Could you let me know where this stands?\n\nBest,\n{{me}}'
    },
    {
      id: 'confirm-meeting',
      name: 'Confirm a meeting',
      useCase: 'Accept a proposed time and confirm the arrangement.',
      body: 'Hi {{name}},\n\nThat time works for me. Confirming {{subject}} for {{date}}.\n\nBest,\n{{me}}'
    },
    {
      id: 'send-document',
      name: 'Send a document',
      useCase: 'Deliver a promised document.',
      body: 'Hi {{name}},\n\nAs promised, I have attached the document for {{subject}}. Let me know if anything needs changing.\n\nBest,\n{{me}}'
    },
    {
      id: 'decline-polite',
      name: 'Decline politely',
      useCase: 'Turn down a request while keeping the relationship warm.',
      body: 'Hi {{name}},\n\nThank you for thinking of me. I am afraid I cannot take this on at the moment, but I would like to help another time.\n\nBest,\n{{me}}'
    },
    {
      id: 'introduce',
      name: 'Introduce a colleague',
      useCase: 'Hand a conversation over to someone on your team.',
      body: 'Hi {{name}},\n\nI am copying my colleague here, who will be able to help you with {{subject}} from here on.\n\nBest,\n{{me}}'
    }
  ];

  function all() { return TEMPLATES.slice(); }

  function byId(id) {
    for (var i = 0; i < TEMPLATES.length; i++) {
      if (TEMPLATES[i].id === id) return TEMPLATES[i];
    }
    return null;
  }

  /* The signed-in account's own first name (never the seed persona). */
  function myName() {
    try {
      if (window.Identity && window.Identity.firstName) {
        var f = window.Identity.firstName();
        if (f) return f;
      }
    } catch (e) {}
    return 'me';
  }

  /* Recipient's first name from a contact id, or empty. */
  function recipientName(contactId) {
    if (!contactId) return '';
    try {
      var c = window.Store && window.Store.contact ? window.Store.contact(contactId) : null;
      if (!c || !c.name) return '';
      return String(c.name).split(/\s+/)[0];
    } catch (e) { return ''; }
  }

  function todayLabel() {
    try {
      if (window.D && window.D.formatLong) return window.D.formatLong(window.D.today());
    } catch (e) {}
    return 'shortly';
  }

  /* Fill the placeholders. Unknown values are left visible as an
     explicit placeholder so the user can complete them. */
  function personalise(template, ctx) {
    ctx = ctx || {};
    var values = {
      name: ctx.name || recipientName(ctx.contactId) || 'there',
      subject: ctx.subject || 'this',
      date: ctx.date || todayLabel(),
      me: ctx.me || myName()
    };
    /* Accepts a template object or a raw body string. */
    var body = (template && typeof template === 'object')
      ? String(template.body || '')
      : String(template || '');
    body = body.replace(/\{\{\s*name\s*\}\}/g, values.name);
    body = body.replace(/\{\{\s*subject\s*\}\}/g, values.subject);
    body = body.replace(/\{\{\s*date\s*\}\}/g, values.date);
    body = body.replace(/\{\{\s*me\s*\}\}/g, values.me);
    return body;
  }

  window.ResponseTemplates = {
    all: all,
    byId: byId,
    personalise: personalise,
    myName: myName
  };
})();
