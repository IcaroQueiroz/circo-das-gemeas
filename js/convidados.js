/* Camada de dados do convite. Nenhuma família é embutida no frontend. */
const INVITE_API_URL = 'https://script.google.com/macros/s/AKfycbwBKBrx9Shn--VObDDGt-Wv4ptIfaP2HUTMy0QXNX6kS9g1X7xjjKNCaDGWVSRLL1nZ/exec';

function getInviteFromUrl() {
  const rawCode = new URLSearchParams(window.location.search).get('c');
  const code = rawCode ? rawCode.trim().toUpperCase() : null;
  return { code, hasExplicitCode: Boolean(code) };
}

async function fetchInvitation(code) {
  const url = new URL(INVITE_API_URL);
  url.searchParams.set('action', 'invite');
  url.searchParams.set('code', code);

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);

  return response.json();
}

window.getInviteFromUrl = getInviteFromUrl;
window.fetchInvitation = fetchInvitation;
