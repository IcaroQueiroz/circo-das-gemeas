document.addEventListener('DOMContentLoaded', async () => {
  const { code } = getInviteFromUrl();
  const toast = document.querySelector('#toast');
  const urlParams = new URLSearchParams(window.location.search);
  const navigationEntry = performance.getEntriesByType('navigation')[0];
  const shouldResetSession = urlParams.has('reset') || navigationEntry?.type === 'reload';
  if (shouldResetSession) {
    sessionStorage.clear();
    if (code) localStorage.removeItem(`rsvp:${code}`);
    if (urlParams.has('reset')) {
      const cleanUrl = window.location.pathname + (code ? `?c=${code}` : '');
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }

  const panels = [...document.querySelectorAll('.section-panel')];
  const heroEntryButton = document.querySelector('.hero-footer .primary-button');
  const countdownNextButton = document.querySelector('#contagem .section-next');
  const familyGreeting = document.querySelector('#family-greeting');
  const rsvpActions = document.querySelector('#rsvp-actions');
  const rsvpStatus = document.querySelector('#rsvp-status');
  let invitationState = 'loading';

  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3200);
  };
  const resolveSection = (selector) => {
    const aliases = { '#top': '#abertura', '#destino': '#local' };
    return document.querySelector(aliases[selector] || selector);
  };
  const getVisiblePanels = () => panels.filter((panel) => !panel.classList.contains('is-hidden'));
  const goToSection = (selector) => {
    const destination = resolveSection(selector);
    if (!destination || (invitationState !== 'ready' && destination.id !== 'abertura')) return;

    panels.forEach((panel) => {
      panel.classList.toggle('is-active', panel === destination);
      if (panel !== destination) panel.querySelectorAll('.reveal').forEach((element) => element.classList.remove('is-visible'));
    });
    destination.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));

    const visiblePanels = getVisiblePanels();
    const currentIndex = visiblePanels.indexOf(destination);
    document.querySelector('#progress-bar').style.width = `${currentIndex >= 0 && visiblePanels.length > 1 ? (currentIndex / (visiblePanels.length - 1)) * 100 : 0}%`;
  };

  window.goToSection = goToSection;
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || href === '#' || anchor.id === 'dest-maps-btn') return;
    if (!resolveSection(href)) return;
    event.preventDefault();
    goToSection(href);
  });

  const setText = (selector, value = '—') => { document.querySelector(selector).textContent = value || '—'; };
  const setFamilyGreeting = (label) => {
    familyGreeting.replaceChildren(document.createTextNode(`${label},`), document.createElement('br'), document.createTextNode('vocês estarão conosco?'));
  };
  const clearPrivateData = () => {
    ['#event-date', '#event-time', '#event-venue', '#event-address', '#dest-venue', '#dest-address'].forEach((selector) => setText(selector));
    document.querySelector('#guest-list').replaceChildren();
    document.querySelector('#link-gmaps').removeAttribute('href');
    document.querySelector('#link-waze').removeAttribute('href');
    document.querySelector('#ambient-audio').removeAttribute('src');
  };
  const disableRsvpActions = () => rsvpActions.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  const enableRsvpActions = () => rsvpActions.querySelectorAll('button').forEach((button) => { button.disabled = false; });
  const showUnavailable = (message, canRetry = false) => {
    invitationState = 'unavailable';
    clearPrivateData();
    familyGreeting.textContent = message;
    rsvpStatus.textContent = message;
    disableRsvpActions();
    heroEntryButton.textContent = canRetry ? 'Tentar novamente' : 'Convite indisponível';
    heroEntryButton.href = canRetry ? window.location.href : '#';
    heroEntryButton.setAttribute('aria-disabled', String(!canRetry));
    showToast(message);
  };
  const mapEvent = (apiEvent) => {
    if (!apiEvent?.dateLabel || !apiEvent?.timeLabel || !apiEvent?.venue || !apiEvent?.address) throw new Error('INVALID_EVENT');
    return { ...apiEvent, dateISO: apiEvent.dateISO || toEventDateISO(apiEvent.dateLabel, apiEvent.timeLabel) };
  };
  const mapInvite = (apiInvite) => {
    if (!apiInvite?.id || !apiInvite?.familyLabel || !Array.isArray(apiInvite.guests)) throw new Error('INVALID_INVITE_DATA');
    return {
      ...apiInvite,
      guests: apiInvite.guests.map((guest) => {
        const guestId = guest.guest_id ?? guest.id;
        if (!guestId || !guest.name || !guest.type) throw new Error('INVALID_GUEST');
        return { ...guest, id: String(guestId), guest_id: String(guestId), confirmed: Boolean(guest.confirmed), selected: Boolean(guest.confirmed) };
      })
    };
  };

  const mapModal = document.querySelector('#map-modal');
  const backdrop = document.querySelector('#map-modal-backdrop');
  const closeBtn = document.querySelector('#map-close-btn');
  const linkGmaps = document.querySelector('#link-gmaps');
  const linkWaze = document.querySelector('#link-waze');
  const destinationMapsBtn = document.querySelector('#dest-maps-btn');
  const closeModal = () => mapModal.classList.add('is-hidden');
  const openModal = (event) => {
    event.preventDefault();
    if (invitationState !== 'ready') {
      showToast('Carregue um convite válido para ver o caminho.');
      return;
    }
    mapModal.classList.remove('is-hidden');
  };
  destinationMapsBtn.addEventListener('click', openModal);
  backdrop.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  linkGmaps.addEventListener('click', closeModal);
  linkWaze.addEventListener('click', closeModal);

  const audio = document.querySelector('#ambient-audio');
  const soundToggle = document.querySelector('#sound-toggle');
  const soundLabel = document.querySelector('#sound-label');
  const setSoundState = (isOn) => {
    soundToggle.setAttribute('aria-pressed', String(isOn));
    soundLabel.textContent = isOn ? 'som on' : 'som off';
    soundToggle.classList.toggle('is-on', isOn);
  };
  soundToggle.addEventListener('click', async () => {
    if (!audio.src) return;
    if (audio.paused) {
      try { await audio.play(); setSoundState(true); }
      catch { setSoundState(false); showToast('Não foi possível iniciar a música.'); }
    } else { audio.pause(); setSoundState(false); }
  });
  heroEntryButton.addEventListener('click', async () => {
    if (!audio.src || invitationState !== 'ready') return;
    try { await audio.play(); setSoundState(true); } catch { /* áudio opcional */ }
  });

  clearPrivateData();
  familyGreeting.textContent = code ? 'Carregando seu convite...' : 'Este convite precisa de um link válido.';
  disableRsvpActions();
  goToSection('#abertura');

  if (!code) {
    showUnavailable('Este convite precisa de um link válido enviado pela família anfitriã.');
    return;
  }

  try {
    const payload = await fetchInvitation(code);
    if (!payload?.ok || payload.error === 'INVALID_INVITE') {
      showUnavailable('Convite inválido. Verifique o link recebido e tente novamente.');
      return;
    }

    const event = mapEvent(payload.event);
    const invite = mapInvite(payload.invite);
    const savedRsvp = JSON.parse(sessionStorage.getItem(`rsvp:${code}`));
    const currentStatus = savedRsvp?.status || (invite.responded ? invite.status : null);
    const isAnswered = currentStatus === 'confirmed' || currentStatus === 'declined';
    const isConfirmed = currentStatus === 'confirmed';

    setText('#event-date', `${event.dateLabel} · ${event.weekdayLabel || ''}`.replace(/ · $/, ''));
    setText('#event-time', event.timeLabel);
    setText('#event-venue', event.venue);
    setText('#event-address', event.address);
    document.querySelector('#event-address').style.whiteSpace = 'pre-line';
    setText('#dest-venue', event.venue);
    setText('#dest-address', event.address);
    document.querySelector('#dest-address').style.whiteSpace = 'pre-line';
    linkGmaps.href = event.mapsUrl || '#';
    linkWaze.href = event.wazeUrl || '#';
    audio.src = event.audioSrc || '';
    setFamilyGreeting(invite.familyLabel);
    enableRsvpActions();
    invitationState = 'ready';

    if (isAnswered) {
      heroEntryButton.href = '#contagem';
      heroEntryButton.innerHTML = 'O Espetáculo Começa em... <span aria-hidden="true">↗</span>';
      countdownNextButton.href = '#local';
      countdownNextButton.setAttribute('aria-label', 'Ver localização do evento');
    } else {
      heroEntryButton.href = '#apresentacao';
      heroEntryButton.innerHTML = 'Entrar no circo <span aria-hidden="true">↗</span>';
      countdownNextButton.href = '#rsvp';
      countdownNextButton.setAttribute('aria-label', 'Rolar para a confirmação');
    }

    if (isConfirmed) {
      const success = document.querySelector('#confirmacao');
      success.classList.remove('is-hidden');
      success.setAttribute('aria-hidden', 'false');
    }

    if (event.dateISO) startCountdown(event.dateISO);
    else document.querySelector('#countdown-message').textContent = 'A contagem regressiva estará disponível em breve.';

    createRsvpController({
      invite,
      code,
      onDeclined: () => {
        heroEntryButton.href = '#contagem';
        heroEntryButton.innerHTML = 'O Espetáculo Começa em... <span aria-hidden="true">↗</span>';
        countdownNextButton.href = '#local';
        countdownNextButton.setAttribute('aria-label', 'Ver localização do evento');
        showToast('Resposta registrada. Obrigado por avisar!');
      },
      onConfirmed: () => {
        const success = document.querySelector('#confirmacao');
        success.classList.remove('is-hidden');
        success.setAttribute('aria-hidden', 'false');
        goToSection('#confirmacao');
      }
    });
  } catch (error) {
    console.error('Não foi possível carregar o convite.', error);
    showUnavailable('Não foi possível carregar o convite. Verifique sua conexão e tente novamente.', true);
  }
});

function toEventDateISO(dateLabel, timeLabel) {
  const normalizedDate = dateLabel.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const dateMatch = normalizedDate.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  const timeMatch = timeLabel.match(/(\d{1,2})\s*(?::|h)\s*(\d{2})?/i);
  const months = { janeiro: '01', fevereiro: '02', marco: '03', abril: '04', maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12' };
  if (!dateMatch || !timeMatch || !months[dateMatch[2]]) return null;
  const [, day, monthName, year] = dateMatch;
  const [, hour, minute = '00'] = timeMatch;
  return `${year}-${months[monthName]}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00-03:00`;
}
