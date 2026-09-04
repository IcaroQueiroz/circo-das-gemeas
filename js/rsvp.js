async function submitRsvp({ code, status, guests }) {
  const payload = {
    action: 'rsvp',
    code,
    status,
    guests
  };

  let response;
  try {
    response = await fetch(INVITE_API_URL, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('SERVER_ERROR');
  }

  if (!response.ok || result?.ok !== true) {
    throw new Error(result?.error || result?.code || 'SERVER_ERROR');
  }

  return result;
}

function createRsvpController({ invite, code, onConfirmed, onDeclined }) {
  const guestList = document.querySelector('#guest-list');
  const guestForm = document.querySelector('#guest-form');
  const addGuestButton = document.querySelector('#add-guest');
  const rsvpStatus = document.querySelector('#rsvp-status');
  const guestStatus = document.querySelector('#guest-status');
  const guestSection = document.querySelector('#convidados');
  let guestCount = invite?.guests?.length || 0;
  let isSubmitting = false;

  const getErrorMessage = (error) => {
    const messages = {
      INVALID_INVITE: 'Não encontramos este convite. Verifique o link e tente novamente.',
      INVALID_GUEST: 'Um dos convidados selecionados não é válido. Atualize a página e tente novamente.',
      INVALID_STATUS: 'Não foi possível registrar esta resposta. Tente novamente.',
      SERVER_ERROR: 'Não foi possível registrar sua resposta agora. Tente novamente em instantes.',
      NETWORK_ERROR: 'Sem conexão no momento. Verifique sua internet e tente novamente.'
    };
    return messages[error?.message] || messages.SERVER_ERROR;
  };

  const setButtonBusy = (button, busy) => {
    if (button) button.disabled = busy;
  };

  const renderGuests = () => {
    guestList.replaceChildren(...(invite?.guests || []).map((guest) => {
      const guestId = guest.guest_id ?? guest.id;
      const row = document.createElement('div');
      row.className = 'guest-row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `guest-${guestId}`;
      input.name = 'guest';
      input.value = guestId;
      input.checked = Boolean(guest.confirmed ?? guest.selected);
      const label = document.createElement('label');
      label.htmlFor = input.id;
      label.append(document.createTextNode(guest.name));
      const type = document.createElement('small');
      type.textContent = guest.type;
      label.append(type);
      const heart = document.createElement('span');
      heart.className = 'guest-heart';
      heart.setAttribute('aria-hidden', 'true');
      heart.textContent = '♡';
      row.append(input, label, heart);
      return row;
    }));
  };

  const setStep = async (step, button) => {
    if (isSubmitting) return;
    rsvpStatus.textContent = '';
    if (step === 'yes') {
      guestSection.classList.remove('is-hidden');
      guestSection.setAttribute('aria-hidden', 'false');
      window.goToSection('#convidados');
    }
    if (step === 'no') {
      isSubmitting = true;
      setButtonBusy(button, true);
      rsvpStatus.textContent = 'Registrando resposta...';
      let submissionSucceeded = false;

      try {
        await submitRsvp({ code, status: 'declined', guests: [] });
        submissionSucceeded = true;
        sessionStorage.setItem(`rsvp:${code}`, JSON.stringify({ status: 'declined', respondedAt: new Date().toISOString() }));
        rsvpStatus.textContent = 'Tudo bem — agradecemos por avisar com carinho.';
        const heroEntryButton = document.querySelector('.hero-footer .primary-button');
        heroEntryButton.href = '#contagem';
        heroEntryButton.innerHTML = 'O Espetáculo Começa em... <span aria-hidden="true">↗</span>';
        onDeclined?.();
        window.setTimeout(() => window.goToSection?.('#contagem'), 700);
      } catch (error) {
        rsvpStatus.textContent = getErrorMessage(error);
      } finally {
        if (!submissionSucceeded) {
          isSubmitting = false;
          setButtonBusy(button, false);
        }
      }
    }
  };

  document.querySelectorAll('[data-rsvp]').forEach((button) => button.addEventListener('click', () => setStep(button.dataset.rsvp, button)));
  guestForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    const selectedIds = [...guestForm.querySelectorAll('input[name="guest"]:checked')].map((input) => input.value);
    if (!selectedIds.length) {
      guestStatus.textContent = 'Selecione pelo menos uma pessoa para confirmar.';
      return;
    }
    const submitButton = event.submitter || guestForm.querySelector('button[type="submit"]');
    isSubmitting = true;
    setButtonBusy(submitButton, true);
    guestStatus.textContent = 'Registrando resposta...';

    try {
      await submitRsvp({ code, status: 'confirmed', guests: selectedIds });
      const response = { status: 'confirmed', inviteCode: code, family: invite.familyLabel, invitedGuests: invite.guests, confirmedGuests: selectedIds, respondedAt: new Date().toISOString() };
      sessionStorage.setItem(`rsvp:${code}`, JSON.stringify(response));
      guestStatus.textContent = '';
      onConfirmed?.(response);
    } catch (error) {
      guestStatus.textContent = getErrorMessage(error);
    } finally {
      isSubmitting = false;
      setButtonBusy(submitButton, false);
    }
  });
  addGuestButton.addEventListener('click', () => {
    guestCount += 1;
    const id = `extra-${guestCount}`;
    invite.guests.push({ id, guest_id: id, name: `Convidado ${guestCount}`, type: 'Convidado', confirmed: false, selected: false });
    renderGuests();
    document.querySelector(`#guest-${id}`)?.focus();
  });

  renderGuests();
  return { setStep };
}

window.createRsvpController = createRsvpController;
window.submitRsvp = submitRsvp;
