/* ============================================================
   ACTION AUTHORIZATION LAYER
   ------------------------------------------------------------
   Every action the AI may take passes through here (spec §54).
   The layer classifies risk and returns a DECISION — it never
   performs a side effect itself. Modes:

     execute  — low-risk, pre-approved, autonomy allows: run it
     approve  — needs an explicit human approval before running
     onetouch — a single-use template authorization covers this
                exact send; the authorization is consumed on send
     block    — refused (missing permission, consumed/revoked
                template, non-matching recipient, suspicious source)

   Hard rules enforced (spec §6, §54):
   * Anything that reaches another person ALWAYS needs explicit
     human approval, regardless of the autonomy level.
   * External email may never be sent autonomously. The only
     exception is a one-touch template the user has explicitly
     authorized for a defined use case and recipient set — and
     that authorization is single-use and is consumed on send.
   ============================================================ */
(function () {
  'use strict';

  var RISK = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' };

  /* Default risk per action type. */
  var RISK_BY_TYPE = {
    classify_email: 'low',
    extract_commitments: 'low',
    summarise_meeting: 'low',
    build_briefing: 'low',
    detect_forgotten: 'low',
    draft_reply: 'low',
    create_task: 'low',
    label_email: 'low',
    file_document: 'low',
    send_internal_email: 'medium',
    create_calendar_event: 'medium',
    create_document: 'medium',
    edit_document: 'medium',
    send_external_email: 'high'
  };

  /* True when the action reaches another person. These can never
     auto-execute — they always need a human in the loop. */
  var EXTERNAL = {
    send_external_email: true,
    send_internal_email: true,
    create_calendar_event: true
  };

  /* Low-risk work that may run automatically at autonomy 4+ once
     the relevant permission is granted. Never reaches a person. */
  var PRE_APPROVED = {
    classify_email: true,
    extract_commitments: true,
    summarise_meeting: true,
    build_briefing: true,
    detect_forgotten: true,
    draft_reply: true,
    create_task: true,
    label_email: true,
    file_document: true
  };

  function riskFor(type) { return RISK_BY_TYPE[type] || 'medium'; }
  function reachesPerson(type) { return !!EXTERNAL[type]; }
  function isPreApproved(type) { return !!PRE_APPROVED[type]; }

  function hasPermission(user, perm) {
    return (user && user.permissions || []).indexOf(perm) !== -1;
  }

  /**
   * decide(action, user) -> { mode, reason }
   *
   * action: { type, recipient, templateId }
   * user:   the current user snapshot (Store.user())
   */
  function decide(action, user) {
    var type = action.type;

    /* A one-touch template authorization is a separate, explicit
       grant. It is evaluated first so that a valid single-use
       template can cover exactly one send. */
    if (action.templateId) {
      var tpl = findTemplate(user, action.templateId);
      if (!tpl) return { mode: 'block', reason: 'Unknown one-touch template.' };
      if (tpl.revoked) return { mode: 'block', reason: 'That one-touch authorization has been revoked.' };
      if (tpl.consumed) return { mode: 'block', reason: 'That one-touch authorization has already been used. Approve this send manually.' };
      if (type !== 'send_external_email') {
        return { mode: 'block', reason: 'One-touch templates only cover external email.' };
      }
      if (!hasPermission(user, 'Send external email')) {
        return { mode: 'block', reason: 'External email is blocked until you grant the "Send external email" permission.' };
      }
      if (!templateMatches(action.recipient, tpl)) {
        return {
          mode: 'block',
          reason: 'Recipient "' + (action.recipient || 'unknown') +
                  '" is outside the permitted recipients for template "' + tpl.name + '".'
        };
      }
      return {
        mode: 'onetouch',
        reason: 'Covered by one-touch template "' + tpl.name +
                '" (' + tpl.useCase + '). This single-use authorization will be consumed by this send.'
      };
    }

    /* Anything reaching a person always needs explicit approval,
       no matter how high the autonomy level is set. */
    if (reachesPerson(type)) {
      return {
        mode: 'approve',
        reason: 'This reaches another person, so it needs your approval before it is sent.'
      };
    }

    /* Low-risk, pre-approved work may run automatically at
       autonomy 4 (Confirm) and above. */
    if (isPreApproved(type) && riskFor(type) === 'low' && user.autonomy >= 4) {
      return { mode: 'execute', reason: 'Low-risk and pre-approved at your autonomy level.' };
    }

    return { mode: 'approve', reason: 'Needs your approval.' };
  }

  function findTemplate(user, id) {
    var list = (user && user.oneTouchTemplates) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  /** Does a recipient (address or display name) fall inside a
      template's permitted recipients? An empty list permits nobody.
      A leading "@" matches a whole domain. */
  function templateMatches(recipient, tpl) {
    if (!recipient || !tpl) return false;
    var allowed = tpl.recipients || [];
    if (!allowed.length) return false;
    var r = String(recipient).toLowerCase();
    for (var i = 0; i < allowed.length; i++) {
      var a = String(allowed[i]).toLowerCase().trim();
      if (!a) continue;
      if (r === a) return true;                                  /* exact address */
      if (a.charAt(0) === '@' && r.indexOf(a) !== -1) return true; /* whole domain */
    }
    return false;
  }

  window.Actions = {
    RISK: RISK,
    riskFor: riskFor,
    reachesPerson: reachesPerson,
    isPreApproved: isPreApproved,
    decide: decide,
    templateMatches: templateMatches
  };
})();
