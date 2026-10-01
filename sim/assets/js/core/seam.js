/* ============================================================
   LLM SEAM
   ------------------------------------------------------------
   Every AI call goes through this interface. Phase 3 provides
   SimulatedProvider (deterministic rules). Phase 5 provides
   ModelProvider (real model calls) implementing the SAME
   contract — no engine should know which one it is talking to.
   ============================================================ */
(function () {
  'use strict';

  /**
   * Contract every provider must satisfy:
   *
   * classifyEmail(email) -> { category, confidence, reason, source, actionRequired }
   * extractCommitments(text, context) -> [{ description, direction, dueDate,
   *        confidence, certainty, evidence }]
   * summariseTranscript(meeting) -> { summary, decisions[], actionItems[],
   *        risks[], questions[] }
   * buildDailyBriefing(context) -> { headline, body, stats, sections[] }
   * detectForgotten(context) -> [{ title, detail, source, confidence, actions[] }]
   */
  function IntelligenceProvider() {}

  /* ---------- Simulated provider (Phase 3) ---------- */

  var VAGUE = ['when i can', 'as soon as', 'asap', 'shortly', 'when possible', 'some time'];

  var FIRST_PERSON = [
    /\bi(?:'ll| will| am going to)\b/,
    /\blet me\b/,
    /\bi(?:'ll| will) +get you\b/,
    /\bwe agreed\b/,
    /\bwe(?:'ll| will)\b/,
    /\bi can\b/
  ];
  var THIRD_PARTY = [
    /\byou(?:'ll| will) +send\b/,
    /\byou said you would\b/,
    /\byou(?:'ll| will) get\b/,
    /\b([A-Z][a-z]+) +(?:will|is going to|'ll)\b/
  ];
  var DEADLINE = [
    /\btomorrow morning\b/, /\btomorrow\b/, /\bby friday\b/, /\bby monday\b/,
    /\bbefore friday\b/, /\bby the (\d{1,2})(?:st|nd|rd|th)?\b/,
    /\bby next week\b/, /\bnext week\b/, /\bby month end\b/, /\bby (\d{1,2}) september\b/,
    /\bby end of (?:the )?week\b/, /\bthis (?:morning|afternoon)\b/, /\btoday\b/
  ];

  function hasVague(text) {
    var t = text.toLowerCase();
    for (var i = 0; i < VAGUE.length; i++) if (t.indexOf(VAGUE[i]) !== -1) return true;
    return false;
  }
  function matchesAny(text, list) {
    for (var i = 0; i < list.length; i++) if (list[i].test(text)) return true;
    return false;
  }
  function findDeadline(text) {
    for (var i = 0; i < DEADLINE.length; i++) {
      var m = text.match(DEADLINE[i]);
      if (m) return m[0].toLowerCase();
    }
    return null;
  }

  function SimulatedProvider() {}
  SimulatedProvider.prototype = Object.create(IntelligenceProvider.prototype);

  SimulatedProvider.prototype.name = 'simulated';

  SimulatedProvider.prototype.classifyEmail = function (email) {
    return window.EnginesMail.classify(email);
  };

  SimulatedProvider.prototype.extractCommitments = function (text, ctx) {
    return window.EnginesCommitment.extract(text, ctx);
  };

  SimulatedProvider.prototype.summariseTranscript = function (meeting) {
    var m = meeting;
    var risks = [];
    if (m.id === 'm1') risks.push('Proposal deadline is 20 September. Pricing is still outstanding.');
    if (m.id === 'm3') risks.push('No firm date given for the Q3 numbers.');
    return {
      summary: m.summary,
      decisions: m.decisions,
      actionItems: m.actionItems,
      risks: risks,
      questions: []
    };
  };

  SimulatedProvider.prototype.buildDailyBriefing = function (ctx) {
    return window.EnginesBriefing.build(ctx);
  };

  SimulatedProvider.prototype.detectForgotten = function (ctx) {
    return window.EnginesForgetting.detect(ctx);
  };

  /* ---------- Provider registry ----------
     Phase 5 swaps this to the model provider. */
  var provider = new SimulatedProvider();

  window.Intelligence = {
    IntelligenceProvider: IntelligenceProvider,
    SimulatedProvider: SimulatedProvider,
    get: function () { return provider; },
    set: function (p) { provider = p; }
  };
})();