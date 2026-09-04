async function submitRsvp({ code, status, guests, extraGuests = [] }) {
  const payload = {
    action: 'rsvp',
    code,
    status,
    guests,
    extraGuests
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
  const extraGuests = [];
  const selectedGuestIds = new Set((invite?.guests || []).map((guest) => String(guest.guest_id ?? guest.id)));
  let nextExtraNumber = 1;
  let isSubmitting = false;
  const guestTypeModal = document.querySelector('#guest-type-modal');
  const guestTypeBackdrop = document.querySelector('#guest-type-modal-backdrop');
  const guestTypeCancel = document.querySelector('#guest-type-cancel');
  const guestTypeOptions = [...guestTypeModal.querySelectorAll('[data-extra-type]')];

  const updateAddGuestButton = () => {
    const limitReached = extraGuests.length >= 2;
    addGuestButton.disabled = limitReached;
    addGuestButton.textContent = limitReached ? 'Limite de convidados extras atingido' : '＋ Adicionar outro convidado';
  };

  const closeGuestTypeModal = (restoreFocus = true) => {
    guestTypeModal.classList.add('is-hidden');
    guestTypeModal.setAttribute('aria-hidden', 'true');
    if (restoreFocus) addGuestButton.focus();
  };

  const openGuestTypeModal = () => {
    if (extraGuests.length >= 2) return;
    guestTypeModal.classList.remove('is-hidden');
    guestTypeModal.setAttribute('aria-hidden', 'false');
    guestTypeOptions[0]?.focus();
  };

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
    const guests = [...(invite?.guests || []), ...extraGuests];
    guestList.replaceChildren(...guests.map((guest) => {
      const guestId = String(guest.guest_id ?? guest.id);
      const row = document.createElement('div');
      row.className = 'guest-row';
      if (guest.isExtra) row.classList.add('guest-row-extra');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `guest-${guestId}`;
      input.name = 'guest';
      input.value = guestId;
      input.checked = selectedGuestIds.has(guestId);
      input.addEventListener('change', () => {
        if (input.checked) selectedGuestIds.add(guestId);
        else selectedGuestIds.delete(guestId);
      });
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
      if (guest.isExtra) {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'guest-delete';
        deleteButton.setAttribute('aria-label', 'Excluir convidado extra');
        deleteButton.textContent = '🗑';
        deleteButton.addEventListener('click', () => {
          const index = extraGuests.findIndex((extra) => extra.id === guest.id);
          if (index < 0) return;
          extraGuests.splice(index, 1);
          selectedGuestIds.delete(guestId);
          renderGuests();
          updateAddGuestButton();
        });
        row.append(deleteButton);
      }
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
    const selectedIds = (invite?.guests || [])
      .map((guest) => String(guest.guest_id ?? guest.id))
      .filter((guestId) => selectedGuestIds.has(guestId));
    const selectedExtraGuests = extraGuests
      .filter((guest) => selectedGuestIds.has(guest.id))
      .map(({ id, name, type }) => ({ clientId: id, name, type }));
    if (!selectedIds.length && !selectedExtraGuests.length) {
      guestStatus.textContent = 'Selecione pelo menos uma pessoa para confirmar.';
      return;
    }
    const submitButton = event.submitter || guestForm.querySelector('button[type="submit"]');
    isSubmitting = true;
    setButtonBusy(submitButton, true);
    guestStatus.textContent = 'Registrando resposta...';

    try {
      await submitRsvp({ code, status: 'confirmed', guests: selectedIds, extraGuests: selectedExtraGuests });
      const response = { status: 'confirmed', inviteCode: code, family: invite.familyLabel, invitedGuests: invite.guests, confirmedGuests: selectedIds, extraGuests: selectedExtraGuests, respondedAt: new Date().toISOString() };
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
  addGuestButton.addEventListener('click', openGuestTypeModal);
  guestTypeOptions.forEach((option) => option.addEventListener('click', () => {
    if (extraGuests.length >= 2) return;
    const type = option.dataset.extraType;
    const id = `extra-${nextExtraNumber}`;
    const guest = { id, name: `Convidado extra ${nextExtraNumber}`, type, selected: true, isExtra: true };
    nextExtraNumber += 1;
    extraGuests.push(guest);
    selectedGuestIds.add(id);
    closeGuestTypeModal();
    renderGuests();
    updateAddGuestButton();
    document.querySelector(`#guest-${id}`)?.focus();
  }));
  guestTypeCancel.addEventListener('click', () => closeGuestTypeModal());
  guestTypeBackdrop.addEventListener('click', () => closeGuestTypeModal());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !guestTypeModal.classList.contains('is-hidden')) closeGuestTypeModal();
  });

  renderGuests();
  updateAddGuestButton();
  return { setStep };
}

window.createRsvpController = createRsvpController;
window.submitRsvp = submitRsvp;
