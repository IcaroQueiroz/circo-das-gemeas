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
  const heroEntryImage = heroEntryButton.querySelector('#hero-entry-image');
  [
    'assets/images/ui/entrar-no-circo.png',
    'assets/images/ui/espetaculo-comeca.png',
    'assets/images/ui/convite-n-localizado.png'
  ].forEach((src) => {
    const image = new Image();
    image.src = src;
  });
  const countdownNextButton = document.querySelector('#contagem .section-next');
  const familyGreeting = document.querySelector('#family-greeting');
  const rsvpActions = document.querySelector('#rsvp-actions');
  const rsvpStatus = document.querySelector('#rsvp-status');
  let accessState = 'checking';
  let dataState = 'idle';
  let retryAccess = null;
  let retryInvitationData = null;
  let invitationPayload = null;
  let invitationLoadError = null;
  let rsvpControllerInitialized = false;
  let hasShownLoadingToast = false;

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
    if (!destination) return;

    const needsInvitationData = destination.id !== 'abertura' && destination.id !== 'apresentacao';
    if (needsInvitationData && dataState === 'loading' && !hasShownLoadingToast) {
      hasShownLoadingToast = true;
      showToast('Carregando informações do convite...');
    }

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
  };
  const disableRsvpActions = () => rsvpActions.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  const enableRsvpActions = () => rsvpActions.querySelectorAll('button').forEach((button) => { button.disabled = false; });
  const setHeroEntryImage = (src, label) => {
    if (!heroEntryButton.contains(heroEntryImage)) heroEntryButton.replaceChildren(heroEntryImage);
    heroEntryImage.src = src;
    heroEntryImage.alt = label;
    heroEntryButton.setAttribute('aria-label', label);
  };
  const setHeroLoadingState = () => {
    setHeroEntryImage('assets/images/ui/carregando.png', 'Carregando convite');
    heroEntryButton.href = '#';
    heroEntryButton.setAttribute('aria-disabled', 'true');
    heroEntryButton.classList.add('is-loading');
    heroEntryButton.classList.remove('is-cta', 'is-disabled');
  };
  const showUnavailable = (message, canRetry = false) => {
    accessState = canRetry ? 'error' : 'invalid';
    if (!canRetry) dataState = 'error';
    clearPrivateData();
    familyGreeting.textContent = message;
    rsvpStatus.textContent = message;
    disableRsvpActions();
    heroEntryButton.href = '#';
    heroEntryButton.classList.remove('is-loading', 'is-cta');
    heroEntryButton.classList.toggle('is-disabled', !canRetry);
    setHeroEntryImage(
      canRetry ? 'assets/images/ui/carregando.png' : 'assets/images/ui/convite-n-localizado.png',
      canRetry ? 'Tentar novamente' : 'Convite não localizado'
    );
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
    if (dataState !== 'ready') {
      showToast('Carregando informações do convite...');
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
  audio.src = audio.dataset.src || '';
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
  heroEntryButton.addEventListener('click', async (event) => {
    if (heroEntryButton.classList.contains('is-loading')) {
      event.preventDefault();
      return;
    }
    if (retryAccess || retryInvitationData) {
      event.preventDefault();
      const retry = retryAccess || retryInvitationData;
      retryAccess = null;
      retryInvitationData = null;
      retry?.();
      return;
    }
    if (audio.src) {
      try { await audio.play(); setSoundState(true); } catch { /* áudio opcional */ }
    }
  });

  const setResponseNavigation = (responded, status) => {
    const isAnswered = responded && (status === 'confirmed' || status === 'declined');
    heroEntryButton.classList.remove('is-loading', 'is-disabled');
    heroEntryButton.classList.add('is-cta');
    if (isAnswered) {
      heroEntryButton.href = '#contagem';
      heroEntryButton.removeAttribute('aria-disabled');
      setHeroEntryImage('assets/images/ui/espetaculo-comeca.png', 'O espetáculo começa em');
      countdownNextButton.href = '#local';
      countdownNextButton.setAttribute('aria-label', 'Ver localização do evento');
      return;
    }

    heroEntryButton.href = '#apresentacao';
    heroEntryButton.removeAttribute('aria-disabled');
    setHeroEntryImage('assets/images/ui/entrar-no-circo.png', 'Entrar no circo');
    countdownNextButton.href = '#rsvp';
    countdownNextButton.setAttribute('aria-label', 'Rolar para a confirmação');
  };

  const showInvitationLoadError = () => {
    dataState = 'error';
    retryInvitationData = startInvitationRequest;
    clearPrivateData();
    familyGreeting.textContent = 'Não foi possível carregar as informações do convite.';
    rsvpStatus.textContent = 'Não foi possível carregar as informações do convite.';
    disableRsvpActions();
    heroEntryButton.href = '#';
    setHeroEntryImage('assets/images/ui/entrar-no-circo.png', 'Tentar novamente');
    heroEntryButton.removeAttribute('aria-disabled');
    heroEntryButton.classList.remove('is-loading', 'is-disabled');
    heroEntryButton.classList.add('is-cta');
    showToast('Não foi possível carregar as informações do convite.');
  };

  const applyInvitationData = (payload) => {
    if (accessState !== 'valid' || dataState === 'ready') return;

    try {
      if (!payload?.ok) throw new Error(payload?.error || 'INVITE_LOAD_ERROR');
      const event = mapEvent(payload.event);
      const invite = mapInvite(payload.invite);
      const savedRsvp = JSON.parse(sessionStorage.getItem(`rsvp:${code}`));
      const currentStatus = savedRsvp?.status || (invite.responded ? invite.status : null);
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
      audio.src = event.audioSrc || audio.dataset.src || '';
      setFamilyGreeting(invite.familyLabel);
      enableRsvpActions();
      setResponseNavigation(Boolean(currentStatus), currentStatus);

      if (isConfirmed) {
        const success = document.querySelector('#confirmacao');
        success.classList.remove('is-hidden');
        success.setAttribute('aria-hidden', 'false');
      }

      if (event.dateISO) startCountdown(event.dateISO);
      else document.querySelector('#countdown-message').textContent = 'A contagem regressiva estará disponível em breve.';

      if (!rsvpControllerInitialized) {
        createRsvpController({
          invite,
          code,
          onDeclined: () => {
            setResponseNavigation(true, 'declined');
            showToast('Resposta registrada. Obrigado por avisar!');
          },
          onConfirmed: () => {
            const success = document.querySelector('#confirmacao');
            success.classList.remove('is-hidden');
            success.setAttribute('aria-hidden', 'false');
            goToSection('#confirmacao');
          }
        });
        rsvpControllerInitialized = true;
      }

      dataState = 'ready';
      hasShownLoadingToast = false;
    } catch (error) {
      console.error('Não foi possível aplicar as informações do convite.', error);
      invitationLoadError = error;
      if (accessState === 'valid') showInvitationLoadError();
    }
  };

  const startInvitationRequest = () => {
    if (!code || dataState === 'loading') return;
    dataState = 'loading';
    hasShownLoadingToast = false;
    invitationLoadError = null;

    fetchInvitation(code)
      .then((payload) => {
        invitationPayload = payload;
        if (accessState === 'valid') applyInvitationData(payload);
      })
      .catch((error) => {
        console.error('Não foi possível carregar as informações do convite.', error);
        invitationLoadError = error;
        if (accessState === 'valid') showInvitationLoadError();
      });
  };

  const startStatusRequest = () => {
    if (!code) return;
    setHeroLoadingState();
    accessState = 'checking';
    retryAccess = null;

    fetchInviteStatus(code)
      .then((statusPayload) => {
        if (!statusPayload?.ok || statusPayload.valid !== true) {
          showUnavailable('Convite inválido. Verifique o link recebido e tente novamente.');
          goToSection('#abertura');
          return;
        }

        accessState = 'valid';
        setResponseNavigation(Boolean(statusPayload.responded), statusPayload.status);
        if (invitationPayload) applyInvitationData(invitationPayload);
        else if (invitationLoadError) showInvitationLoadError();
      })
      .catch((error) => {
        console.error('Não foi possível verificar o convite.', error);
        retryAccess = startStatusRequest;
        showUnavailable('Não foi possível verificar o convite. Tente novamente.', true);
      });
  };

  clearPrivateData();
  familyGreeting.textContent = code ? 'Carregando seu convite...' : 'Este convite precisa de um link válido.';
  disableRsvpActions();
  setHeroLoadingState();
  goToSection('#abertura');

  if (!code) {
    showUnavailable('Este convite precisa de um link válido enviado pela família anfitriã.');
    return;
  }

  // As duas chamadas começam juntas: a interface permanece navegável enquanto
  // a validação protege a aplicação dos dados privados recebidos antes dela.
  startStatusRequest();
  startInvitationRequest();
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
