// Shared page shell for the design mockups: icons, sidebar, top bar, phone tab bar.
// Planning-phase mockup only (plain JavaScript, no build step).

(function () {
  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    bank: '<path d="M3 10 12 4l9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20h18"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    bill: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
    report: '<path d="M3 20h18"/><path d="M6 16v-5M11 16V7M16 16v-8"/>',
    refund: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><path d="M7.5 7.5h.01"/>',
    megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6l-5 4H4a1 1 0 0 0-1 1z"/><path d="M15 9a3 3 0 0 1 0 6"/><path d="M18 6a7 7 0 0 1 0 12"/>',
    cash: '<rect x="3" y="7" width="18" height="10" rx="1"/><circle cx="12" cy="12" r="2"/>',
    terminal: '<rect x="7" y="3" width="10" height="18" rx="1.5"/><path d="M10 7h4"/><path d="M10 12h.01M14 12h.01M10 16h.01M14 16h.01"/>',
    inbox: '<path d="m3 13 3-8h12l3 8v6H3z"/><path d="M3 13h5l1 2h6l1-2h5"/>',
    building: '<path d="M4 21V5l8-2v18"/><path d="M12 9h8v12"/><path d="M8 8h.01M8 12h.01M8 16h.01M16 13h.01M16 17h.01"/><path d="M2 21h20"/>',
    users: '<path d="M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1"/><circle cx="9" cy="8" r="4"/><path d="M22 20v-1a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    plug: '<path d="M9 2v6M15 2v6"/><path d="M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v5"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    tick: '<path d="m5 12 5 5 9-10"/>',
    send: '<path d="M4 12 20 4l-6 16-3-7z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 20h16"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="1"/><path d="M5 15H4V4h11v1"/>',
    calendar: '<rect x="4" y="5" width="16" height="16" rx="1"/><path d="M4 10h16M8 3v4M16 3v4"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    store: '<path d="m3 9 2-5h14l2 5"/><path d="M4 9v11h16V9"/><path d="M3 9h18"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    book: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>'
  };

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }
  window.icon = icon;

  // Replace <i data-icon="name"></i> placeholders in page markup.
  function hydrateIcons(root) {
    (root || document).querySelectorAll('i[data-icon]').forEach(function (el) {
      el.outerHTML = icon(el.getAttribute('data-icon'), el.getAttribute('data-class'));
    });
  }
  window.hydrateIcons = hydrateIcons;

  var MERCHANTS = {
    ahhock: { name: 'Ah Hock Chicken Rice', outlets: ['Tampines Round Market #01-23'], user: 'Tan Ah Hock', role: 'Owner', initials: 'AH' },
    tansons: { name: 'Tan & Sons Retail', outlets: ['All 3 outlets', 'Tampines Mall #02-15', 'Bedok Mall #B1-30', 'Online store'], user: 'Priya Nair', role: 'Accountant', initials: 'PN' }
  };

  var NAV = [
    { t: 'My business', items: [
      { id: 'home', n: 'Home', i: 'home', href: 'home.html' },
      { id: 'transactions', n: 'Sales & payments', s: 'Transactions', i: 'receipt', href: 'transactions.html' },
      { id: 'insights', n: 'Insights', s: 'Analytics Studio', i: 'trend', soon: true }
    ] },
    { t: 'My money', items: [
      { id: 'settlements', n: 'Money to my bank', s: 'Settlements', i: 'bank', href: '#' },
      { id: 'check-up', n: 'Check-up', s: 'Reconciliation', i: 'check', href: 'check-up.html' },
      { id: 'invoices', n: 'Bills & charges', s: 'Invoices', i: 'bill', href: '#' },
      { id: 'reports', n: 'Reports', s: 'Finance reporting', i: 'report', href: '#' },
      { id: 'refunds', n: 'Refunds & disputes', s: 'Chargebacks', i: 'refund', href: 'refunds.html' }
    ] },
    { t: 'Grow', items: [
      { id: 'offers', n: 'Offers', i: 'tag', soon: true },
      { id: 'promos', n: 'Promotions', s: 'Marketing campaigns', i: 'megaphone', soon: true },
      { id: 'loans', n: 'Business loans', s: 'Merchant lending', i: 'cash', soon: true }
    ] },
    { t: 'Settings', items: [
      { id: 'terminals', n: 'Terminals', i: 'terminal', soon: true },
      { id: 'requests', n: 'Requests', s: 'Service & change requests', i: 'inbox', soon: true },
      { id: 'business', n: 'Business & tax', i: 'building', soon: true },
      { id: 'staff', n: 'Staff & roles', s: 'Users', i: 'users', soon: true },
      { id: 'apps', n: 'Connected apps', s: 'Integrations & API', i: 'plug', soon: true }
    ] }
  ];

  function sidebar(page, m) {
    var outlet = m.outlets.length > 1
      ? '<div class="switcher"><label for="outlet">Showing</label><select id="outlet" class="select">' +
        m.outlets.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select></div>'
      : '<div class="switcher"><div class="select" style="display:flex;flex-direction:column;justify-content:center;padding:8px 12px;background-image:none;line-height:1.3"><b style="font-weight:600">' + m.name + '</b><span class="faint" style="font-size:12px">' + m.outlets[0] + '</span></div></div>';
    var groups = NAV.map(function (g) {
      return '<nav class="nav" aria-label="' + g.t + '"><div class="nav-title">' + g.t + '</div>' +
        g.items.map(function (it) {
          var lbl = '<span class="lbl">' + it.n + (it.s && !it.soon ? '<span class="sub">' + it.s + '</span>' : '') + '</span>';
          if (it.soon) {
            return '<a class="soon" aria-disabled="true" tabindex="-1">' + icon(it.i) + lbl + '<span class="stag">Soon</span></a>';
          }
          return '<a href="' + it.href + '"' + (it.id === page ? ' aria-current="page"' : '') + '>' + icon(it.i) + lbl + '<span></span></a>';
        }).join('') + '</nav>';
    }).join('');
    return '<a class="brand" href="home.html"><span class="brand-mark">M</span><span class="brand-name">Merchant Portal</span></a>' +
      outlet + '<div class="nav-scroll">' + groups + '</div>' +
      '<a class="ask" href="assistant.html"' + (page === 'assistant' ? ' aria-current="page"' : '') + '>' + icon('chat') + 'Ask NETS Assistant</a>';
  }

  function topbar(m) {
    return '<button class="icon-btn menu-btn" type="button" aria-label="Open menu" data-open-nav>' + icon('menu') + '</button>' +
      '<label class="search"><span class="sr-only">Search</span>' + icon('search', 'icon-sm') +
      '<input type="search" placeholder="Search payments, amounts, references"></label>' +
      '<div class="grow"></div>' +
      '<span class="sample-tag">Sample data</span>' +
      '<button class="icon-btn" type="button" aria-label="Alerts, 3 new">' + icon('bell') + '<span class="dot-badge"></span></button>' +
      '<div class="user"><span class="avatar" aria-hidden="true">' + m.initials + '</span><span class="who-text"><span class="who">' + m.user + '<span class="role">' + m.role + ' · ' + m.name + '</span></span></span></div>';
  }

  function tabbar(page) {
    var tabs = [
      { id: 'home', n: 'Home', i: 'home', href: 'home.html' },
      { id: 'transactions', n: 'Payments', i: 'receipt', href: 'transactions.html' },
      { id: 'check-up', n: 'Check-up', i: 'check', href: 'check-up.html' },
      { id: 'assistant', n: 'Ask', i: 'chat', href: 'assistant.html' }
    ];
    return tabs.map(function (t) {
      return '<a href="' + t.href + '"' + (t.id === page ? ' aria-current="page"' : '') + '>' + icon(t.i) + t.n + '</a>';
    }).join('') + '<a href="#" data-open-nav>' + icon('menu') + 'More</a>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.dataset.page;
    var m = MERCHANTS[document.body.dataset.merchant || 'ahhock'];
    var app = document.querySelector('.app');
    var sb = document.getElementById('sidebar');
    var tb = document.getElementById('topbar');
    var tab = document.getElementById('tabbar');
    if (sb) sb.innerHTML = sidebar(page, m);
    if (tb) tb.innerHTML = topbar(m);
    if (tab) tab.innerHTML = tabbar(page);
    hydrateIcons(document);

    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-open-nav]')) { e.preventDefault(); app.classList.add('nav-open'); }
      if (e.target.closest('.scrim')) app.classList.remove('nav-open');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && app) app.classList.remove('nav-open');
    });
  });
})();
