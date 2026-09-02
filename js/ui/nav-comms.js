/**
 * Lowtideflow — Open Comms nav popout (desktop + mobile).
 *
 * Desktop: panel drops below the OPEN COMMS button (inside wrap).
 * Mobile: panel mounts on body, expands top + bottom from the button
 * (scaleY), flush to the top of the viewport — avoids hamburger panel
 * overflow/transform clipping fixed children.
 */

const COMMS_LABEL = 'open comms';
const MOBILE_MQ = '(max-width: 991px)';
const CALENDLY =
  'https://calendly.com/lowtideflow/15-min-quick-connect';
const PHONE_DISPLAY = '(424) 634-2715';
const PHONE_HREF = 'tel:+14246342715';
const EMAIL = 'Nate@lowtideflow.co';
const FOOTER_COPY = 'We look forward to helping you dial in your vision!';

function findTrigger() {
  const links = document.querySelectorAll(
    '.ltf-nav-mobile-panel .ltf-nav-btn, .ltf-nav-actions .ltf-nav-btn'
  );
  for (const link of links) {
    const text = (link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (text === COMMS_LABEL) return link;
  }
  return null;
}

function isMobile() {
  return window.matchMedia(MOBILE_MQ).matches;
}

function buildPanel() {
  const panel = document.createElement('div');
  panel.className = 'ltf-comms-popout';
  panel.id = 'ltf-comms-popout';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-hidden', 'true');
  panel.setAttribute('aria-labelledby', 'ltf-comms-popout-foot');
  panel.hidden = true;

  panel.innerHTML = `
    <ul class="ltf-comms-list">
      <li class="ltf-comms-row">
        <span class="ltf-comms-label">Call Now:</span>
        <span class="ltf-comms-value"><a href="${PHONE_HREF}">${PHONE_DISPLAY}</a></span>
      </li>
      <li class="ltf-comms-row">
        <span class="ltf-comms-label">Schedule a Call:</span>
        <span class="ltf-comms-value"><a href="${CALENDLY}" target="_blank" rel="noopener noreferrer">Discovery Chat</a></span>
      </li>
      <li class="ltf-comms-row">
        <span class="ltf-comms-label">Email:</span>
        <span class="ltf-comms-value"><a href="mailto:${EMAIL}">${EMAIL}</a></span>
      </li>
    </ul>
    <p id="ltf-comms-popout-foot" class="ltf-comms-foot">${FOOTER_COPY}</p>
    <button type="button" class="ltf-comms-dismiss" aria-label="Close contact options">
      <svg class="ltf-comms-dismiss-icon" viewBox="0 0 80 24" aria-hidden="true" focusable="false">
        <path d="M6 20 L40 4 L74 20" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  `;

  return panel;
}

function mountPanel(panel, wrap, mobile) {
  if (mobile) {
    panel.classList.add('ltf-comms-popout--mobile');
    if (panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
  } else {
    panel.classList.remove('ltf-comms-popout--mobile');
    panel.style.removeProperty('--ltf-comms-origin-y');
    if (panel.parentElement !== wrap) {
      wrap.appendChild(panel);
    }
  }
}

function updateMobileOrigin(panel, trigger) {
  const rect = trigger.getBoundingClientRect();
  const originY = rect.top + rect.height / 2;
  panel.style.setProperty('--ltf-comms-origin-y', `${originY}px`);
}

export function init() {
  if (document.documentElement.dataset.ltfCommsBound === '1') return;

  const trigger = findTrigger();
  if (!trigger) return;

  const wrap = trigger.closest('.ltf-btn-gradient-wrap');
  if (!wrap) return;

  document.documentElement.dataset.ltfCommsBound = '1';
  wrap.classList.add('ltf-comms-wrap');

  const panel = buildPanel();
  const mq = window.matchMedia(MOBILE_MQ);
  let open = false;

  function syncMount() {
    mountPanel(panel, wrap, isMobile());
  }

  syncMount();

  function setOpen(next) {
    if (next) {
      updateMobileOrigin(panel, trigger);
      syncMount();
    }

    open = next;
    wrap.classList.toggle('is-comms-open', next && !isMobile());
    panel.classList.toggle('is-comms-open', next);
    panel.hidden = !next;
    panel.setAttribute('aria-hidden', next ? 'false' : 'true');
    trigger.setAttribute('aria-expanded', next ? 'true' : 'false');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', panel.id);
    document.body.classList.toggle('ltf-comms-open', next);
  }

  function close() {
    setOpen(false);
  }

  function toggle(e) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!open);
  }

  const dismiss = panel.querySelector('.ltf-comms-dismiss');
  if (dismiss) {
    dismiss.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
    });
  }

  trigger.addEventListener('click', toggle);
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle(e);
    }
  });

  document.addEventListener('click', (e) => {
    if (!open) return;
    if (wrap.contains(e.target) || panel.contains(e.target)) return;
    close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) close();
  });

  window.addEventListener('resize', () => {
    if (open) {
      updateMobileOrigin(panel, trigger);
      syncMount();
    } else {
      syncMount();
    }
  }, { passive: true });

  mq.addEventListener('change', () => {
    if (open) close();
    syncMount();
  });
}

export default init;
