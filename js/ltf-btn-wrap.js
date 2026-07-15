(function () {
  function wrap() {
    document.querySelectorAll('.ltf-btn-primary,.ltf-nav-btn-contact,.ltf-nav-btn-quote').forEach(function (btn) {
      if (btn.closest('.ltf-btn-gradient-wrap')) return;
      var span = document.createElement('span');
      span.className = 'ltf-btn-gradient-wrap';
      btn.parentNode.insertBefore(span, btn);
      span.appendChild(btn);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wrap);
  } else {
    wrap();
  }
})();
