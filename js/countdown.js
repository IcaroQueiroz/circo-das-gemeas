function startCountdown(targetISO) {
  const els = {
    days: document.querySelector('#days'),
    hours: document.querySelector('#hours'),
    minutes: document.querySelector('#minutes'),
    seconds: document.querySelector('#seconds'),
    message: document.querySelector('#countdown-message')
  };

  const pad = (value) => String(value).padStart(2, '0');
  const render = () => {
    const distance = new Date(targetISO).getTime() - Date.now();
    if (distance <= 0) {
      Object.values(els).forEach((element) => { if (element && element.id !== 'countdown-message') element.textContent = '00'; });
      els.message.textContent = 'O espetáculo já começou — viva esse dia mágico!';
      return false;
    }
    const totalSeconds = Math.floor(distance / 1000);
    els.days.textContent = pad(Math.floor(totalSeconds / 86400));
    els.hours.textContent = pad(Math.floor((totalSeconds % 86400) / 3600));
    els.minutes.textContent = pad(Math.floor((totalSeconds % 3600) / 60));
    els.seconds.textContent = pad(totalSeconds % 60);
    els.message.textContent = '';
    return true;
  };

  render();
  const timer = window.setInterval(() => { if (!render()) window.clearInterval(timer); }, 1000);
}

window.startCountdown = startCountdown;
