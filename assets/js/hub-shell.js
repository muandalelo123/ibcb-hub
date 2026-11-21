/* iBCB-HUB shared shell: mobile menu and current-page highlight. */
(function () {
  var header = document.querySelector('.hub-header');
  if (!header) return;

  var toggle = header.querySelector('.hub-menu-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = header.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('is-open')) {
        header.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
        toggle.focus();
      }
    });
  }

  // Highlight the section the visitor is in.
  var path = window.location.pathname.replace(/index\.html$/, '');
  var best = null;
  var bestLen = 0;
  header.querySelectorAll('nav.hub-nav a').forEach(function (a) {
    var section = a.getAttribute('data-section');
    if (section && path.indexOf(section) === 0 && section.length > bestLen) {
      best = a;
      bestLen = section.length;
    }
  });
  if (best) best.setAttribute('aria-current', 'page');
})();
