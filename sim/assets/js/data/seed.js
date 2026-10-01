/* ============================================================
   AI Life OS — Simulation Seed Data
   ------------------------------------------------------------
   One continuous story: the ABC proposal.

   The demo runs against a FIXED simulated "today" so results are
   always deterministic. TODAY = Tuesday, 22 September 2026.
   ============================================================ */
(function () {
  'use strict';

  var TODAY = '2026-09-22';

  /* ---------------- Contacts ---------------- */
  var contacts = [
    { id: 'c1', name: 'John Miller', email: 'john@abcltd.com', org: 'ABC Ltd',
      relationship: 'Client — primary', initials: 'JM',
      lastInteraction: '2026-09-15', notes: 'Proposal decision maker. Values directness.' },
    { id: 'c2', name: 'Mary Chen', email: 'mary@northwind.co', org: 'Northwind Partners',
      relationship: 'Colleague', initials: 'MC',
      lastInteraction: '2026-09-18', notes: 'Board pack is time-critical.' },
    { id: 'c3', name: 'David Okafor', email: 'd.okafor@internal.co', org: 'Internal',
      relationship: 'Direct report', initials: 'DO',
      lastInteraction: '2026-09-10', notes: 'Reliable but vague about timelines.' },
    { id: 'c4', name: 'Sarah Lindqvist', email: 's.lindqvist@abcltd.com', org: 'ABC Ltd',
      relationship: 'Client — finance', initials: 'SL',
      lastInteraction: '2026-09-08', notes: 'Handles all invoicing at ABC.' },
    { id: 'c5', name: 'Tom Baker', email: 'tom@supplyco.com', org: 'SupplyCo',
      relationship: 'Vendor', initials: 'TB',
      lastInteraction: '2026-09-05', notes: 'Contract renews Sept 30.' },
    { id: 'c6', name: 'Priya Nair', email: 'priya@northwind.co', org: 'Northwind Partners',
      relationship: 'Partner', initials: 'PN',
      lastInteraction: '2026-09-01', notes: 'Introduces warm intros.' }
  ];

  /* ---------------- Calendar ---------------- */
  /* today: 3 meetings, with a deliberate 15:00 conflict (e4 vs e6) */
  var events = [
    { id: 'e3', title: 'Finance Sync', date: TODAY, start: '11:00', end: '11:45',
      attendeeIds: ['c4'], location: 'Google Meet', prep: false,
      notes: 'Invoice #4471 approval.' },
    { id: 'e5', title: '1:1 with David', date: '2026-09-23', start: '13:00', end: '13:30',
      attendeeIds: ['c3'], location: 'Internal room', prep: false,
      notes: 'Follow-up from 10 Sept.' },
    { id: 'e2', title: 'Team Standup', date: '2026-09-23', start: '09:30', end: '10:00',
      attendeeIds: ['c3', 'c6'], location: 'Google Meet', prep: false, notes: '' },
    { id: 'e1', title: 'ABC Proposal Review', date: '2026-09-23', start: '14:00', end: '15:00',
      attendeeIds: ['c1', 'c4'], location: 'ABC Ltd, Oslo', prep: true, prepDone: false,
      notes: 'Go/no-go on the proposal. Pricing still outstanding.' },
    { id: 'e4', title: 'Northwind Weekly', date: TODAY, start: '15:00', end: '16:00',
      attendeeIds: ['c2', 'c6'], location: 'Google Meet', prep: false, notes: '' },
    { id: 'e6', title: 'Supplier Call — SupplyCo', date: TODAY, start: '15:30', end: '16:15',
      attendeeIds: ['c5'], location: 'Phone', prep: false, notes: 'Renewal terms.' }
  ];

  /* ---------------- Emails ----------------
     Categories span the full taxonomy (spec §17).
     Email 10 is the suspicious one and must never be actionable. */
  var emails = [
    { id: 'm01', contactId: 'c1', received: '2026-09-15T16:42', unread: false,
      subject: 'Re: Revised pricing', category: 'Waiting',
      preview: 'Let me check with our finance team and come back to you tomorrow.',
      body: 'Hi Temitope,\n\nThanks for the call today. Let me check the revised pricing with our finance team and come back to you tomorrow morning.\n\nBest,\nJohn' },

    { id: 'm02', contactId: 'c2', received: '2026-09-21T08:15', unread: true,
      subject: 'Document for the board pack', category: 'Action Required',
      deadline: '2026-09-25',
      preview: 'Could you send the supplier summary before Friday? The board pack closes Thursday evening.',
      body: 'Hi,\n\nCould you send the supplier summary before Friday? The board pack closes Thursday evening.\n\nIt should be two pages maximum.\n\nMary' },

    { id: 'm03', contactId: 'c3', received: '2026-09-10T17:20', unread: false,
      subject: 'Re: Rescheduling', category: 'Waiting',
      preview: 'Does next Wednesday work for you?',
      body: 'Hi,\n\nDoes next Wednesday work for you? Let me know and I will send an invite.\n\nDavid' },

    { id: 'm04', contactId: 'c4', received: '2026-09-21T14:05', unread: true,
      subject: 'Invoice #4471 approval', category: 'Action Required',
      deadline: TODAY,
      preview: 'The invoice is sitting in the approval queue — we cannot process it without your sign-off.',
      body: 'Hi,\n\nInvoice #4471 is sitting in the approval queue. We cannot process it before month end without your sign-off.\n\nCould you approve it today?\n\nSarah' },

    { id: 'm05', contactId: 'c5', received: '2026-09-05T11:30', unread: false,
      subject: 'Contract renewal terms', category: 'Important',
      deadline: '2026-09-30',
      preview: 'Our renewal window closes 30 September. Here are the updated terms.',
      body: 'Hi,\n\nOur renewal window closes 30 September. Here are the updated terms for the coming year.\n\nTom' },

    { id: 'm06', contactId: 'c6', received: '2026-09-21T19:30', unread: true,
      subject: 'Board prep — what do you need?', category: 'Action Required',
      deadline: '2026-09-23',
      preview: 'What do you need from me before the board prep? I need to brief my team by 9am.',
      body: 'Priya here.\n\nWhat do you need from me before the board prep? I need to brief my team by 9am tomorrow.\n\nPriya' },

    { id: 'm07', contactId: null, external: 'Google Calendar', received: '2026-09-22T06:00', unread: true,
      subject: 'Your day at a glance', category: 'Low Priority',
      preview: '3 meetings, 2 conflicts detected.',
      body: 'Your calendar for Tuesday 22 September.' },

    { id: 'm08', contactId: null, external: 'LinkedIn', received: '2026-09-21T21:10', unread: false,
      subject: '5 people viewed your profile', category: 'Newsletter',
      preview: 'See who has been looking at your profile.',
      body: 'People who viewed your profile this week.' },

    { id: 'm09', contactId: null, external: 'AWS', received: '2026-09-20T09:00', unread: false,
      subject: 'Your monthly invoice is ready', category: 'Promotion',
      preview: 'Your September invoice is available.',
      body: 'Your September invoice is available in the billing console.' },

    { id: 'm10', contactId: null, external: 'no-reply@acct-verify-secure.net', received: '2026-09-22T02:47', unread: true,
      subject: 'URGENT: Your account will be suspended', category: 'Suspicious',
      preview: 'Verify your identity immediately or your account will be suspended within 24 hours.',
      body: 'URGENT NOTICE.\n\nYour account will be suspended within 24 hours unless you verify your identity.\n\nClick here to verify: http://acct-verify-secure.net/verify\n\nFailure to comply will result in permanent termination.' },

    { id: 'm11', contactId: 'c1', received: '2026-09-22T07:55', unread: true,
      subject: 'Quick question on scope', category: 'Urgent',
      deadline: TODAY,
      preview: 'Can we drop the training module from phase two? I need an answer before 4pm today.',
      body: 'Hi,\n\nCan we drop the training module from phase two? I need an answer before 4pm today or we lose the slot.\n\nJohn' },

    { id: 'm12', contactId: null, external: 'Northwind HR', received: '2026-09-21T10:00', unread: false,
      subject: 'Annual leave request form', category: 'Action Required',
      deadline: '2026-09-25',
      preview: 'Please submit your leave requests before the end of the week.',
      body: 'Please submit your annual leave requests before the end of the week.' },

    { id: 'm13', contactId: null, external: 'Figma', received: '2026-09-21T13:20', unread: false,
      subject: 'Design file updated by Mary', category: 'Important',
      preview: 'Mary Chen updated "Supplier Summary v3".',
      body: 'Mary Chen updated the file "Supplier Summary v3".' },

    { id: 'm14', contactId: null, external: 'Stripe', received: '2026-09-19T08:00', unread: false,
      subject: 'Receipt for your payment', category: 'Low Priority',
      preview: 'Your payment was received.',
      body: 'Payment received. Thank you.' },

    { id: 'm15', contactId: 'c4', received: '2026-09-19T09:30', unread: false,
      subject: 'Following up on invoice', category: 'Waiting',
      preview: 'Just checking whether this reached you.',
      body: 'Hi,\n\nJust checking whether invoice #4471 reached you.\n\nSarah' },

    { id: 'm16', contactId: 'c3', received: '2026-09-22T07:10', unread: true,
      subject: 'Q3 numbers draft', category: 'Urgent',
      deadline: '2026-09-23',
      preview: 'Here is the draft — I think it is ready for you to review before tomorrow.',
      body: 'Hi,\n\nHere is the Q3 draft. I think it is ready for you to review before tomorrow morning.\n\nDavid' },

    { id: 'm17', contactId: null, external: 'ABC Security', received: '2026-09-20T22:14', unread: false,
      subject: 'New sign-in from a new device', category: 'Important',
      preview: 'A new device signed in to your account from Oslo, Norway.',
      body: 'A new device signed in to your ABC account.\n\nDevice: MacBook Pro\nLocation: Oslo, Norway\nIf this was not you, secure your account.' },

    { id: 'm18', contactId: null, external: 'Zoom', received: '2026-09-22T10:45', unread: false,
      subject: 'Your meeting starts in 15 minutes', category: 'Low Priority',
      preview: 'Finance Sync starts at 11:00.',
      body: 'Finance Sync starts at 11:00.' },

    { id: 'm19', contactId: 'c2', received: '2026-09-21T15:45', unread: true,
      subject: 'Re: Re: Document for the board pack', category: 'Waiting',
      preview: 'No rush on my end — let me know what lands best.',
      body: 'No rush on my end — let me know what format lands best and I will slot it in.\n\nMary' },

    { id: 'm20', contactId: 'c5', received: '2026-09-20T12:00', unread: false,
      subject: 'Newsletter: October outlook', category: 'Newsletter',
      preview: 'Five things to watch this month.',
      body: 'Our monthly outlook.' },

    { id: 'm21', contactId: null, external: 'Legal', received: '2026-09-21T09:05', unread: false,
      subject: 'Contract clause 4.2 needs review', category: 'Important',
      deadline: '2026-09-29',
      preview: 'Clause 4.2 does not match the agreed indemnity position.',
      body: 'Clause 4.2 (indemnity) does not match the position we agreed. Please review before the 29th.' },

    { id: 'm22', contactId: null, external: 'GrowthStack', received: '2026-09-21T18:30', unread: false,
      subject: 'Claim your free consulting hours', category: 'Promotion',
      preview: 'You have 5 unused hours expiring soon.',
      body: 'You have unused consulting hours that expire this month.' },

    { id: 'm23', contactId: 'c6', received: '2026-09-21T20:10', unread: true,
      subject: 'Intro to new client contact', category: 'Action Required',
      deadline: '2026-09-26',
      preview: 'Introducing Elena at Meridian — she is looking for exactly what you do.',
      body: 'Priya here.\n\nIntroducing Elena at Meridian. She is looking for exactly what you do.\n\nWorth a call this week?\n\nPriya' },

    { id: 'm24', contactId: null, external: 'ABC Security', received: '2026-09-22T08:02', unread: false,
      subject: 'Verification code', category: 'Low Priority',
      preview: 'Your verification code is 481920.',
      body: 'Your verification code is 481920. Do not share this code.' }
  ];

  /* ---------------- Meetings & transcripts ----------------
     m1 is the critical test: commitments in BOTH directions.
     m3 is the low-confidence test: a vague promise. */
  var meetings = [
    {
      id: 'm1', title: 'ABC Proposal Kickoff', date: '2026-09-15', start: '10:00', end: '11:30',
      contactIds: ['c1', 'c4'], audioRef: 'abc-kickoff.m4a', source: 'Uploaded recording',
      summary: 'ABC confirmed the proposal deadline of 20 September. John will supply revised pricing; we committed to delivering the proposal by Friday.',
      decisions: ['Three-tier pricing structure adopted', 'Training module moved to a phase three option'],
      actionItems: ['Send revised proposal by 20 September', 'Confirm phase two scope with John'],
      transcript: [
        { spk: 'JOHN',    text: 'We can make the 20th if we get the proposal over.' },
        { spk: 'TEMITOPE',text: "I'll send the proposal by Friday." },
        { spk: 'JOHN',    text: "I'll send you the revised pricing tomorrow morning so you're not blocked." },
        { spk: 'TEMITOPE',text: 'That works. Let us go with the three-tier option.' },
        { spk: 'SARAH',   text: 'Finance will need the invoice approved before month end.' },
        { spk: 'TEMITOPE',text: 'Understood. I will approve invoice 4471 today.' },
        { spk: 'JOHN',    text: 'One question — do we still need the training module?' },
        { spk: 'TEMITOPE',text: 'We will treat it as a phase three option.' }
      ]
    },
    {
      id: 'm2', title: 'Northwind Board Prep', date: '2026-09-12', start: '15:00', end: '16:00',
      contactIds: ['c2', 'c6'], audioRef: 'board-prep.m4a', source: 'Uploaded recording',
      summary: 'Board date confirmed for the 8th. Mary requested a two-page supplier summary for the board pack.',
      decisions: ['Board date set for 8 October', 'Supplier summary capped at two pages'],
      actionItems: ['Send supplier summary to Mary before Friday'],
      transcript: [
        { spk: 'MARY',    text: 'The board pack closes Thursday evening. Can you send me the supplier summary by Friday?' },
        { spk: 'TEMITOPE',text: "I'll get you the supplier summary before Friday." },
        { spk: 'PRIYA',   text: "We'll confirm the board date today." },
        { spk: 'TEMITOPE',text: "We agreed the board date is the 8th." },
        { spk: 'MARY',    text: 'Two pages maximum is all we have room for.' }
      ]
    },
    {
      id: 'm3', title: 'Internal 1:1 — David', date: '2026-09-10', start: '14:00', end: '14:30',
      contactIds: ['c3'], audioRef: '1on1-david.m4a', source: 'Uploaded recording',
      summary: 'Q3 numbers still outstanding. David gave no firm date — flagged as a possible commitment.',
      decisions: [],
      actionItems: [],
      transcript: [
        { spk: 'DAVID',   text: "I'll get the numbers over to you when I can." },
        { spk: 'TEMITOPE',text: 'Okay.' },
        { spk: 'DAVID',   text: 'Sorry, it has been a busy week.' },
        { spk: 'TEMITOPE',text: 'No problem. Let us talk next week.' }
      ]
    }
  ];

  /* ---------------- Commitments ----------------
     Seeded from transcript extraction + explicit email commitments.
     certainty: 'confirmed' | 'possible'
     direction: 'user_to_others' | 'others_to_user' | 'mutual' */
  var commitments = [
    { id: 'k1', direction: 'user_to_others', certainty: 'confirmed', confidence: 'high',
      description: 'Send the revised ABC proposal', personId: 'c1',
      dueDate: '2026-09-18', status: 'active',
      source: { type: 'meeting', ref: 'm1', label: 'Meeting — ABC Proposal Kickoff, 15 Sept',
                quote: "I'll send the proposal by Friday." } },

    { id: 'k2', direction: 'others_to_user', certainty: 'confirmed', confidence: 'high',
      description: 'John to send revised pricing', personId: 'c1',
      dueDate: '2026-09-16', status: 'waiting',
      source: { type: 'meeting', ref: 'm1', label: 'Meeting — ABC Proposal Kickoff, 15 Sept',
                quote: "I'll send you the revised pricing tomorrow morning so you're not blocked." } },

    { id: 'k3', direction: 'user_to_others', certainty: 'confirmed', confidence: 'high',
      description: 'Send supplier summary to Mary', personId: 'c2',
      dueDate: '2026-09-25', status: 'active',
      source: { type: 'meeting', ref: 'm2', label: 'Meeting — Northwind Board Prep, 12 Sept',
                quote: "I'll get you the supplier summary before Friday." } },

    { id: 'k4', direction: 'mutual', certainty: 'confirmed', confidence: 'high',
      description: 'Board date is 8 October', personId: 'c6',
      dueDate: null, status: 'active',
      source: { type: 'meeting', ref: 'm2', label: 'Meeting — Northwind Board Prep, 12 Sept',
                quote: 'We agreed the board date is the 8th.' } },

    { id: 'k5', direction: 'others_to_user', certainty: 'confirmed', confidence: 'high',
      description: 'Sarah to approve invoice #4471', personId: 'c4',
      dueDate: TODAY, status: 'active',
      source: { type: 'email', ref: 'm04', label: 'Email — Sarah Lindqvist, 21 Sept',
                quote: 'The invoice is sitting in the approval queue.' } },

    { id: 'k6', direction: 'user_to_others', certainty: 'confirmed', confidence: 'high',
      description: 'Reply to John on scope — training module', personId: 'c1',
      dueDate: TODAY, status: 'active',
      source: { type: 'email', ref: 'm11', label: 'Email — John Miller, today',
                quote: 'I need an answer before 4pm today.' } },

    { id: 'k7', direction: 'user_to_others', certainty: 'possible', confidence: 'low',
      description: 'David to send Q3 numbers', personId: 'c3',
      dueDate: null, status: 'active',
      source: { type: 'meeting', ref: 'm3', label: 'Meeting — Internal 1:1, 10 Sept',
                quote: "I'll get the numbers over to you when I can." } }
  ];

  /* ---------------- Tasks ----------------
     Overdue(1) · Waiting(2) · In Progress(2) · Planned(4) · Inbox(3) · Completed(3) */
  var tasks = [
    { id: 't1', title: 'Send the revised ABC proposal', status: 'In Progress',
      dueDate: '2026-09-18', priority: 'high', source: { type: 'meeting', ref: 'm1' },
      contactId: 'c1', project: 'ABC proposal', blockedBy: 'k2', created: '2026-09-15' },

    { id: 't2', title: 'Send supplier summary to Mary', status: 'Inbox',
      dueDate: '2026-09-25', priority: 'high', source: { type: 'meeting', ref: 'm2' },
      contactId: 'c2', project: 'Board pack', created: '2026-09-12' },

    { id: 't3', title: 'Reply to John — training module scope', status: 'Inbox',
      dueDate: TODAY, priority: 'high', source: { type: 'email', ref: 'm11' },
      contactId: 'c1', project: 'ABC proposal', created: '2026-09-22' },

    { id: 't4', title: 'Approve invoice #4471', status: 'Inbox',
      dueDate: TODAY, priority: 'high', source: { type: 'email', ref: 'm04' },
      contactId: 'c4', project: 'ABC proposal', created: '2026-09-21' },

    { id: 't5', title: 'Review Q3 numbers draft', status: 'Inbox',
      dueDate: '2026-09-23', priority: 'medium', source: { type: 'email', ref: 'm16' },
      contactId: 'c3', project: 'Internal', created: '2026-09-22' },

    { id: 't6', title: 'Brief Priya before board prep', status: 'Planned',
      dueDate: '2026-09-23', priority: 'medium', source: { type: 'email', ref: 'm06' },
      contactId: 'c6', project: 'Board pack', created: '2026-09-21' },

    { id: 't7', title: 'Submit annual leave request', status: 'Planned',
      dueDate: '2026-09-25', priority: 'low', source: { type: 'email', ref: 'm12' },
      contactId: null, project: null, created: '2026-09-21' },

    { id: 't8', title: 'Review SupplyCo renewal terms', status: 'Planned',
      dueDate: '2026-09-30', priority: 'low', source: { type: 'email', ref: 'm05' },
      contactId: 'c5', project: 'Vendors', created: '2026-09-05' },

    { id: 't9', title: 'Prepare ABC proposal review', status: 'Planned',
      dueDate: '2026-09-23', priority: 'high', source: { type: 'calendar', ref: 'e1' },
      contactId: 'c1', project: 'ABC proposal', created: '2026-09-20' },

    { id: 't10', title: 'Review contract clause 4.2', status: 'Planned',
      dueDate: '2026-09-29', priority: 'medium', source: { type: 'email', ref: 'm21' },
      contactId: null, project: 'Vendors', created: '2026-09-21' },

    { id: 't11', title: 'Follow up with John — pricing', status: 'Waiting',
      dueDate: '2026-09-19', priority: 'high', source: { type: 'meeting', ref: 'm1' },
      contactId: 'c1', project: 'ABC proposal', blockedBy: 'k2', created: '2026-09-16' },

    { id: 't12', title: 'Confirm next week meeting with David', status: 'Waiting',
      dueDate: '2026-09-24', priority: 'medium', source: { type: 'email', ref: 'm03' },
      contactId: 'c3', project: 'Internal', created: '2026-09-10' },

    { id: 't13', title: 'Book intro call with Elena (Meridian)', status: 'Completed',
      dueDate: '2026-09-20', priority: 'medium', source: { type: 'email', ref: 'm23' },
      contactId: 'c6', project: null, created: '2026-09-19', completed: '2026-09-20' },

    { id: 't14', title: 'Approve invoice #4390', status: 'Completed',
      dueDate: '2026-09-12', priority: 'medium', source: { type: 'email', ref: 'm14' },
      contactId: 'c4', project: 'ABC proposal', created: '2026-09-10', completed: '2026-09-11' },

    { id: 't15', title: 'Send supplier scorecard to Tom', status: 'Completed',
      dueDate: '2026-09-05', priority: 'low', source: { type: 'email', ref: 'm05' },
      contactId: 'c5', project: 'Vendors', created: '2026-09-01', completed: '2026-09-04' }
  ];

  /* ---------------- Follow-ups ---------------- */
  var followUps = [
    { id: 'f1', contactId: 'c1', subject: 'Revised pricing', dueDate: '2026-09-19',
      status: 'followup_due', source: { type: 'meeting', ref: 'm1' },
      detail: 'Promised "tomorrow morning" on 15 Sept. Seven days ago.' },
    { id: 'f2', contactId: 'c3', subject: 'Meeting confirmation', dueDate: '2026-09-24',
      status: 'waiting', source: { type: 'email', ref: 'm03' },
      detail: 'David asked about next Wednesday and never confirmed.' },
    { id: 'f3', contactId: 'c2', subject: 'Supplier summary', dueDate: '2026-09-25',
      status: 'waiting', source: { type: 'meeting', ref: 'm2' },
      detail: 'Board pack closes Thursday evening.' },
    { id: 'f4', contactId: 'c4', subject: 'Invoice #4471', dueDate: TODAY,
      status: 'waiting', source: { type: 'email', ref: 'm04' },
      detail: 'Awaiting your approval before month end.' }
  ];

  /* ---------------- Documents ---------------- */
  var documents = [
    { id: 'd1', filename: 'ABC proposal v2 (draft).docx', type: 'Document', updated: '2026-09-20',
      project: 'ABC proposal', contactIds: ['c1'], summary: 'Three-tier pricing structure. Missing final pricing from John.',
      deadlines: ['2026-09-18'], actions: ['Complete pricing section', 'Send to John'] },
    { id: 'd2', filename: 'Supplier summary v3.fig', type: 'Design', updated: '2026-09-21',
      project: 'Board pack', contactIds: ['c2'], summary: 'Two-page supplier summary for the board pack.',
      deadlines: ['2026-09-25'], actions: ['Export to PDF', 'Send to Mary'] },
    { id: 'd3', filename: 'Invoice 4471.pdf', type: 'Invoice', updated: '2026-09-19',
      project: 'ABC proposal', contactIds: ['c4'], summary: 'ABC Ltd invoice awaiting approval.',
      deadlines: [TODAY], actions: ['Approve'] },
    { id: 'd4', filename: 'SupplyCo contract 2026.pdf', type: 'Contract', updated: '2026-09-05',
      project: 'Vendors', contactIds: ['c5'], summary: 'Renewal terms. Clause 4.2 indemnity does not match agreed position.',
      deadlines: ['2026-09-29'], actions: ['Review clause 4.2', 'Renew by 30 Sept'] }
  ];

  /* ---------------- Integrations ---------------- */
  var integrations = [
    { id: 'i1', provider: 'Gmail', status: 'connected', lastSync: '2 minutes ago',
      permissions: 'Read, modify labels', error: null },
    { id: 'i2', provider: 'Google Calendar', status: 'connected', lastSync: '2 minutes ago',
      permissions: 'Read, create events', error: null },
    { id: 'i3', provider: 'Transcription', status: 'failed', lastSync: 'Today, 08:14',
      permissions: 'Upload audio', error: 'Upload failed — file exceeded 25 MB limit' },
    { id: 'i4', provider: 'Microsoft 365', status: 'error', lastSync: 'Authentication expired',
      permissions: 'Read mail, read calendar', error: 'Authentication expired — reconnect required' }
  ];

  /* ---------------- Reminders ---------------- */
  var reminders = [
    { id: 'r1', title: 'ABC proposal is overdue', dueAt: '2026-09-22T09:00',
      context: 'You committed to sending the proposal on 15 Sept. It is blocked on pricing from John.',
      source: { type: 'meeting', ref: 'm1' }, done: false },
    { id: 'r2', title: 'Approval needed — invoice #4471', dueAt: '2026-09-22T10:00',
      context: 'Sarah is waiting on this before month end.', source: { type: 'email', ref: 'm04' }, done: false },
    { id: 'r3', title: 'John has not replied to your scope question', dueAt: '2026-09-22T12:00',
      context: 'Sent this morning. Answer needed before 4pm.', source: { type: 'email', ref: 'm11' }, done: false }
  ];

  var user = {
    name: 'Temitope', email: 'temitope@example.com',
    timezone: 'Europe/Oslo', role: 'Professional',
    autonomy: 3,
    learnedPrefs: [
      { id: 'lp1', label: 'Preferred meeting start time', value: '09:00 or later',
        source: 'Learned from 6 rejected suggestions', confidence: 'high', on: true }
    ]
  };

  window.SEED = {
    TODAY: TODAY,
    user: user,
    contacts: contacts,
    events: events,
    emails: emails,
    meetings: meetings,
    commitments: commitments,
    tasks: tasks,
    followUps: followUps,
    documents: documents,
    integrations: integrations,
    reminders: reminders
  };
})();