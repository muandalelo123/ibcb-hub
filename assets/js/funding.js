/* iBCB-HUB Business Funding page.
   Loads lenders and cards from the iBCB-HUB database (Google Sheet, through
   /ibcb-hub/api/data.php, with the saved copy in /ibcb-hub/data/ as backup),
   renders the lender sections, and runs the Funding Finder. */
(function () {
  'use strict';

  var API = '/ibcb-hub/api/data.php?set=';
  var SAVED = '/ibcb-hub/data/';

  function load(set) {
    return fetch(API + set, { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { if (!d || !Array.isArray(d.items)) throw new Error('bad data'); return d.items; })
      .catch(function () {
        return fetch(SAVED + set + '.json').then(function (r) { return r.json(); }).then(function (d) { return d.items || []; });
      })
      .catch(function () { return []; });
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function money(n) {
    if (n == null) return null;
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + 'M';
    if (n >= 1000) return '$' + Math.round(n / 1000) + 'K';
    return '$' + n;
  }

  function range(item) {
    var min = money(item.minAmount);
    var max = money(item.maxAmount);
    if (min && max) return min + ' – ' + max;
    if (max) return 'Up to ' + max;
    if (min) return 'From ' + min;
    return 'Not published';
  }

  function credit(item) {
    if (item.minCredit == null) return 'Not published';
    if (item.minCredit === 0) return 'No minimum';
    return item.minCredit + '+';
  }

  function months(item) {
    var m = item.minMonths;
    if (m == null) return 'Not published';
    if (m >= 12 && m % 12 === 0) return (m / 12) + (m === 12 ? ' year' : ' years') + '+';
    return m + ' months+';
  }

  function revenue(item) {
    return item.minRevenue == null ? 'Not published' : money(item.minRevenue) + '/month';
  }

  function cta(item, label, klass) {
    var href = item.affiliate || item.website;
    if (!href) {
      return '<a href="#funding-form" class="' + klass + '">Ask us about ' + esc(item.name) + '</a>';
    }
    var rel = item.affiliate ? 'sponsored noopener' : 'noopener';
    return '<a href="' + esc(href) + '" class="' + klass + '" target="_blank" rel="' + rel + '">' + esc(label) + '</a>';
  }

  function tags(list, firstGold) {
    return '<div class="offer-tags">' + list.filter(Boolean).map(function (t, i) {
      return '<span class="offer-tag' + (i === 0 && firstGold ? ' gold' : '') + '">' + esc(t) + '</span>';
    }).join('') + '</div>';
  }

  function renderPicks(el, lenders) {
    var picks = lenders.filter(function (l) { return l.rank != null && l.rank <= 3; });
    if (!picks.length) { el.closest('section').hidden = true; return; }
    el.innerHTML = picks.map(function (l, i) {
      return '<article class="top-pick-card">' +
        '<span class="top-pick-rank">' + (i + 1) + '</span>' +
        tags([l.type, l.availability !== 'All states' ? l.availability : null], true) +
        '<h3>' + esc(l.name) + '</h3>' +
        '<p>' + esc(l.description) + '</p>' +
        cta(l, 'Check eligibility', 'btn btn-primary btn-small') +
        (l.bestFor ? '<div class="cta-soft">Best for: ' + esc(l.bestFor) + '</div>' : '') +
        '</article>';
    }).join('');
  }

  function renderLenders(el, lenders) {
    el.innerHTML = lenders.map(function (l) {
      return '<article class="card" id="lender-' + esc(l.id) + '">' +
        tags([l.type, l.availability !== 'All states' ? l.availability : null], true) +
        '<h3>' + esc(l.name) + '</h3>' +
        '<p>' + esc(l.description) + '</p>' +
        '<div class="meta">' +
          '<span><strong>Amounts:</strong> ' + esc(range(l)) + '</span>' +
          '<span><strong>Min. credit score:</strong> ' + esc(credit(l)) + '</span>' +
          '<span><strong>Time in business:</strong> ' + esc(months(l)) + '</span>' +
          '<span><strong>Min. revenue:</strong> ' + esc(revenue(l)) + '</span>' +
          '<span><strong>Speed:</strong> ' + esc(l.speed || 'Not published') + '</span>' +
          (l.cost ? '<span><strong>Cost:</strong> ' + esc(l.cost) + '</span>' : '') +
          (l.products ? '<span><strong>Products:</strong> ' + esc(l.products) + '</span>' : '') +
        '</div>' +
        cta(l, 'Visit ' + l.name, 'btn btn-primary btn-small') +
        (l.verified ? '<div class="cta-soft">Information checked on ' + esc(l.verified) + '. Confirm current terms with the lender.</div>' : '') +
        '</article>';
    }).join('');
  }

  function renderTable(el, lenders) {
    el.innerHTML = lenders.map(function (l) {
      return '<tr>' +
        '<td><strong>' + esc(l.name) + '</strong><br><small>' + esc(l.type || '') + '</small></td>' +
        '<td>' + esc(range(l)) + '</td>' +
        '<td>' + esc(credit(l)) + '</td>' +
        '<td>' + esc(months(l)) + '</td>' +
        '<td>' + esc(l.speed || 'Not published') + '</td>' +
        '<td>' + cta(l, 'Visit', 'btn btn-secondary btn-small') + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderCards(el, cards) {
    if (!cards.length) { el.closest('section').hidden = true; return; }
    el.innerHTML = cards.map(function (c) {
      return '<article class="credit-card">' +
        tags((c.tags || '').split(',').map(function (t) { return t.trim(); }), true) +
        '<h4>' + esc(c.name) + '</h4>' +
        '<p>' + esc(c.description) + '</p>' +
        cta(c, 'View card details', 'btn btn-primary btn-small') +
        (c.bestFor ? '<div class="cta-soft">Best for: ' + esc(c.bestFor) + '</div>' : '') +
        '</article>';
    }).join('');
  }

  /* ---------- Funding Finder ---------- */

  var QUESTIONS = [
    { key: 'amount', text: 'How much funding do you need?', options: [
      ['Under $10K', 5000], ['$10K – $50K', 30000], ['$50K – $250K', 150000], ['$250K – $1M', 500000], ['More than $1M', 2000000]] },
    { key: 'revenue', text: 'What is your average monthly revenue?', options: [
      ['Under $5K', 0], ['$5K – $10K', 5000], ['$10K – $25K', 10000], ['$25K – $50K', 25000], ['$50K or more', 50000]] },
    { key: 'months', text: 'How long has your business been operating?', options: [
      ['Less than 3 months', 0], ['3 to 6 months', 3], ['6 to 12 months', 6], ['1 to 2 years', 12], ['More than 2 years', 24]] },
    { key: 'credit', text: 'What is your personal credit score (approximately)?', options: [
      ['Below 500', 0], ['500 – 579', 500], ['580 – 649', 580], ['650 – 699', 650], ['700 or higher', 700], ['I don’t know', null]] },
    { key: 'place', text: 'Where is your business based?', options: [
      ['California', 'ca'], ['Another U.S. state', 'us'], ['Outside the United States', 'intl']] }
  ];

  // Upper bound of each revenue answer, so a lender asking $6K/month still
  // matches a business in the $5K–$10K range.
  var REVENUE_CEILING = { 0: 4999, 5000: 9999, 10000: 24999, 25000: 49999, 50000: Infinity };

  function matches(l, a) {
    var reasons = [];
    if (a.place === 'intl') return null;
    if (l.availability && /california only/i.test(l.availability) && a.place !== 'ca') return null;
    if (l.minAmount != null && a.amount < l.minAmount) return null;
    if (l.maxAmount != null && a.amount > l.maxAmount) return null;
    if (l.minRevenue != null && REVENUE_CEILING[a.revenue] < l.minRevenue) return null;
    if (l.minMonths != null && a.months < l.minMonths) return null;
    if (a.credit != null && l.minCredit != null && a.credit < l.minCredit) return null;
    if (l.minAmount == null && l.maxAmount == null) reasons.push('amounts not published');
    if (l.minCredit == null) reasons.push('credit requirement not published');
    if (l.minRevenue == null) reasons.push('revenue requirement not published');
    if (a.credit == null && l.minCredit) reasons.push('needs a ' + l.minCredit + '+ score');
    return reasons;
  }

  function initFinder(lenders) {
    var panel = document.getElementById('finder');
    if (!panel) return;
    var body = panel.querySelector('.finder-body');
    var progress = panel.querySelector('.finder-progress');
    var answers = {};
    var step = 0;

    function open() {
      panel.hidden = false;
      document.querySelectorAll('[data-finder-open]').forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
      render();
      var first = body.querySelector('button');
      if (first) first.focus();
    }

    function close() {
      panel.hidden = true;
      document.querySelectorAll('[data-finder-open]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    }

    function render() {
      if (step < QUESTIONS.length) {
        var q = QUESTIONS[step];
        progress.textContent = 'Question ' + (step + 1) + ' of ' + QUESTIONS.length;
        body.innerHTML = '<p class="finder-q">' + esc(q.text) + '</p><div class="finder-options">' +
          q.options.map(function (o, i) {
            return '<button type="button" class="finder-option" data-i="' + i + '">' + esc(o[0]) + '</button>';
          }).join('') + '</div>' +
          (step > 0 ? '<button type="button" class="finder-back">← Back</button>' : '');
        return;
      }
      progress.textContent = 'Your results';
      var found = [];
      lenders.forEach(function (l) {
        var r = matches(l, answers);
        if (r) found.push({ l: l, r: r });
      });
      var html;
      if (answers.place === 'intl') {
        html = '<p class="finder-q">Most lenders listed here only fund U.S. businesses.</p>' +
          '<p>Send us a request anyway and tell us where you are based: we will tell you honestly if we can help.</p>';
      } else if (!found.length) {
        html = '<p class="finder-q">No listed lender matches all your answers yet.</p>' +
          '<p>That does not mean you cannot get funded. Send us a request and we will look at other options.</p>';
      } else {
        html = '<p class="finder-q">' + found.length + (found.length > 1 ? ' lenders' : ' lender') + ' may fit your business</p>' +
          '<ul class="finder-results">' + found.map(function (f) {
            return '<li><strong>' + esc(f.l.name) + '</strong> <span>' + esc(f.l.type || '') + '</span>' +
              (f.l.speed ? '<br><small>' + esc(f.l.speed) + '</small>' : '') +
              (f.r.length ? '<br><small class="finder-warn">Check: ' + esc(f.r.join(', ')) + '</small>' : '') +
              '<br>' + cta(f.l, 'Visit ' + f.l.name, 'finder-link') +
              ' · <a class="finder-link" href="#lender-' + esc(f.l.id) + '" data-close>See details</a></li>';
          }).join('') + '</ul>';
      }
      body.innerHTML = html +
        '<p class="finder-note">Based on the criteria each lender publishes. This is not an offer or a guarantee of approval.</p>' +
        '<div class="finder-actions">' +
          '<a class="btn btn-primary btn-small" href="#funding-form" data-prefill data-close>Get help from iBCB-HUB</a>' +
          '<button type="button" class="finder-back" data-restart>Start over</button>' +
        '</div>';
    }

    body.addEventListener('click', function (e) {
      var opt = e.target.closest('.finder-option');
      if (opt) {
        var q = QUESTIONS[step];
        answers[q.key] = q.options[+opt.dataset.i][1];
        answers[q.key + 'Label'] = q.options[+opt.dataset.i][0];
        step++;
        render();
        var next = body.querySelector('button, a');
        if (next) next.focus();
        return;
      }
      if (e.target.closest('[data-restart]')) { step = 0; answers = {}; render(); return; }
      if (e.target.closest('.finder-back')) { step = Math.max(0, step - 1); render(); return; }
      if (e.target.closest('[data-prefill]')) {
        var amount = document.getElementById('amount');
        if (amount && !amount.value && answers.amountLabel) amount.value = answers.amountLabel;
        var rev = document.getElementById('revenue');
        var map = { 0: 'under-5k', 5000: '5k-10k', 10000: '10k-25k', 25000: '25k-50k', 50000: '50k-plus' };
        if (rev && !rev.value && map[answers.revenue]) rev.value = map[answers.revenue];
      }
      if (e.target.closest('[data-close]')) close();
    });

    document.querySelectorAll('[data-finder-open]').forEach(function (b) {
      b.addEventListener('click', function () { panel.hidden ? open() : close(); });
    });
    panel.querySelector('.finder-close').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });
  }

  /* ---------- Start ---------- */

  Promise.all([load('lenders'), load('cards')]).then(function (res) {
    var lenders = res[0];
    var cards = res[1];
    var picks = document.getElementById('lender-picks');
    var grid = document.getElementById('lender-cards');
    var table = document.getElementById('lender-table');
    var cardGrid = document.getElementById('card-offers');
    if (picks) renderPicks(picks, lenders);
    if (grid) renderLenders(grid, lenders);
    if (table) renderTable(table, lenders);
    if (cardGrid) renderCards(cardGrid, cards);
    var count = document.querySelector('[data-lender-count]');
    if (count) count.textContent = String(lenders.length);
    initFinder(lenders);
  });
})();
