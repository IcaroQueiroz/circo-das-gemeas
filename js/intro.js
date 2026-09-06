const introParams = new URLSearchParams(window.location.search);
const introCode = introParams.get('c');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const introDuration = prefersReducedMotion ? 760 : 1825;

window.setTimeout(() => {
  if (introCode) sessionStorage.setItem(`intro-complete:${introCode}`, '1');
  window.location.replace(`convite.html${window.location.search}`);
}, introDuration);
