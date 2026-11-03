/* Shared footer for all Vuori Compliance Control Tower pages */
(function () {
  'use strict';

  function addSiteFooter() {
    if (document.getElementById('vuori-shared-footer')) return;

    var footer = document.createElement('footer');
    footer.id = 'vuori-shared-footer';
    footer.setAttribute('role', 'contentinfo');
    footer.textContent = '© 2026 Vuori Compliance Control Tower · Developed by chihyang1 (Michael)';

    footer.style.cssText = [
      'width:100%',
      'box-sizing:border-box',
      'margin-top:28px',
      'padding:14px 20px',
      'border-top:1px solid #e5e2dc',
      'background:transparent',
      'color:#777',
      'font-family:Arial,Helvetica,sans-serif',
      'font-size:12px',
      'font-weight:500',
      'line-height:1.5',
      'text-align:center',
      'user-select:text',
      '-webkit-user-select:text'
    ].join(';');

    document.body.appendChild(footer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addSiteFooter, { once: true });
  } else {
    addSiteFooter();
  }
})();
