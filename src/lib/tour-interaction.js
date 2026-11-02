const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex], [contenteditable="true"]';
const BLOCKED_EVENTS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu', 'touchstart', 'touchend', 'dragstart', 'drop', 'submit', 'input', 'change', 'keydown', 'keyup'];

export function isTourInteractionAllowed(target, card, allowedTargets) {
  return Boolean(target && (card.contains(target) || allowedTargets.some(node => node.contains(target))));
}

export function lockTourInteraction(card, selectors = [], { restoreFocus = true, spotlightSelector, layerSelectors = [] } = {}) {
  const doc = card.ownerDocument;
  const previousFocus = doc.activeElement;
  const inertNodes = new Map();
  const raisedNodes = new Map();
  let allowedTargets = [];
  function restore() {
    inertNodes.forEach((wasInert, node) => { node.inert = wasInert; });
    raisedNodes.forEach(({ hadClass, hadPositionClass }, node) => {
      if (!hadClass) node.classList.remove('guided-tour-interactive');
      if (!hadPositionClass) node.classList.remove('guided-tour-positioned');
    });
    inertNodes.clear();
    raisedNodes.clear();
  }
  function updateScopes() {
    restore();
    allowedTargets = selectors.flatMap(selector => [...doc.querySelectorAll(selector)]);
    const scopes = [card, ...allowedTargets];
    function isolate(node) {
      if (scopes.includes(node)) return;
      if (scopes.some(scope => node.contains(scope))) {
        [...node.children].forEach(isolate);
      } else {
        inertNodes.set(node, node.inert);
        node.inert = true;
      }
    }
    [...doc.body.children].forEach(isolate);
    // Lift a shared visual layer without changing its children's stacking order.
    // The event/inert whitelist above remains restricted to instructed controls.
    const spotlight = spotlightSelector ? doc.querySelector(spotlightSelector) : null;
    const layers = layerSelectors.flatMap(selector => [...doc.querySelectorAll(selector)]);
    const outsideTargets = allowedTargets.filter(node => !spotlight?.contains(node)
      && !layers.some(layer => layer.contains(node)));
    [...new Set([...layers, ...outsideTargets])].forEach(node => {
      raisedNodes.set(node, {
        hadClass: node.classList.contains('guided-tour-interactive'),
        hadPositionClass: node.classList.contains('guided-tour-positioned'),
      });
      const position = doc.defaultView.getComputedStyle(node).position;
      if (!position || position === 'static') node.classList.add('guided-tour-positioned');
      node.classList.add('guided-tour-interactive');
    });
  }
  function guard(event) {
    if (!isTourInteractionAllowed(event.target, card, allowedTargets)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  function keepFocus(event) {
    if (!isTourInteractionAllowed(event.target, card, allowedTargets)) card.focus({ preventScroll: true });
  }
  function trapTab(event) {
    if (event.key !== 'Tab') return;
    const candidates = [...doc.querySelectorAll(FOCUSABLE)].filter(node =>
      isTourInteractionAllowed(node, card, allowedTargets) && !node.disabled && node.tabIndex >= 0
      && !node.closest('[inert]') && node.getClientRects().length > 0);
    event.preventDefault();
    const index = candidates.indexOf(doc.activeElement);
    const next = index < 0 ? (event.shiftKey ? candidates.length - 1 : 0)
      : (index + (event.shiftKey ? -1 : 1) + candidates.length) % candidates.length;
    (candidates[next] || card).focus({ preventScroll: true });
  }
  updateScopes();
  BLOCKED_EVENTS.forEach(type => doc.addEventListener(type, guard, { capture: true, passive: false }));
  doc.addEventListener('focusin', keepFocus, true);
  doc.addEventListener('keydown', trapTab, true);
  // Allowed controls can re-render (for example, after choosing a market).
  const observer = new MutationObserver(updateScopes);
  observer.observe(doc.body, { childList: true, subtree: true });
  card.focus({ preventScroll: true });
  return () => {
    observer.disconnect();
    BLOCKED_EVENTS.forEach(type => doc.removeEventListener(type, guard, true));
    doc.removeEventListener('focusin', keepFocus, true);
    doc.removeEventListener('keydown', trapTab, true);
    restore();
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  };
}
