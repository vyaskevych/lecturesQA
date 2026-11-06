(() => {
  'use strict';

  // Автоматично визначаємо назву поточної лекції з URL (наприклад, "lect_2")
  const pageName = location.pathname.split('/').pop().replace(/\.html$/i, '') || 'lect_2';
  const AUDIO_DIR = `audio_${pageName}`;

  let SPOKEN_NOTES = [];
  let SUBTITLE_NOTES = [];

  // Підвантажуємо тексти субтитрів та резервної озвучки з папки відповідної лекції
  fetch(`${AUDIO_DIR}/notes.json`)
    .then(res => res.ok ? res.json() : [])
    .then(data => {
      //SUBTITLE_NOTES = data.subtitle || [] 
      SPOKEN_NOTES = data.map(item => item.spoken || '');
      SUBTITLE_NOTES = data.map(item => item.subtitle || '');    
    })
    .catch(() => { });

  function initializePresentation() {
    const slides = Array.from(document.querySelectorAll('.slide'));
    const count = slides.length;
    if (!count) return;
    const deck = document.getElementById('deck');
    const overviewPanel = document.getElementById('overview');
    const overviewList = document.getElementById('overview-items');
    const overviewButton = document.getElementById('overview-btn');
    const closeOverviewButton = document.getElementById('close-overview');
    const fullscreenButton = document.getElementById('fullscreen-btn');
    const progress = document.querySelector('.progress > span');
    let current = Math.max(0, slides.findIndex(slide => slide.classList.contains('active')));
    let touchStartX = null;

    // --- ВІДЖЕТ ВИКЛАДАЧА В КУТІ СЛАЙДА ---
    const pip = document.createElement('div');
    pip.className = 'presenter-pip';
    pip.title = 'Перетягніть мишкою, щоб змінити положення фото';
    const pipImg = document.createElement('img');
    pipImg.src = 'DSC02824.jpg';
    pipImg.alt = 'Викладач';
    pip.appendChild(pipImg);
    deck?.appendChild(pip);

    let isDragging = false, startX = 0, startY = 0, initLeft = 0, initTop = 0;
    pip.addEventListener('mousedown', e => {
      isDragging = true;
      pip.style.right = 'auto';
      pip.style.bottom = 'auto';
      initLeft = pip.offsetLeft;
      initTop = pip.offsetTop;
      startX = e.clientX;
      startY = e.clientY;
    });
    window.addEventListener('mousemove', e => {
      if (!isDragging) return;
      pip.style.left = `${initLeft + (e.clientX - startX)}px`;
      pip.style.top = `${initTop + (e.clientY - startY)}px`;
    });
    window.addEventListener('mouseup', () => { isDragging = false; });

    // --- БЛОК СУБТИТРІВ (НОТАТОК ВИКЛАДАЧА) ---
    const subtitleBox = document.createElement('div');
    subtitleBox.className = 'speaker-subtitles';
    deck?.appendChild(subtitleBox);

    function updateSubtitles() {
      if (SUBTITLE_NOTES[current]) {
        subtitleBox.innerHTML = SUBTITLE_NOTES[current];
        subtitleBox.scrollTop = 0;
      } else {
        subtitleBox.innerHTML = '';
      }
    }

    // --- КНОПКИ АВТООЗВУЧКИ ТА СУБТИТРІВ У ВЕРХНІЙ ПАНЕЛІ ---
    const barActions = document.querySelector('.bar-actions');
    const audioBtn = document.createElement('button');
    audioBtn.type = 'button';
    audioBtn.className = 'utility';
    audioBtn.title = `Увімкнути/вимкнути автоозвучку з папки ${AUDIO_DIR} (клавіша A)`;
    audioBtn.innerHTML = '▶ Автоозвучка';

    const subBtn = document.createElement('button');
    subBtn.type = 'button';
    subBtn.className = 'utility';
    subBtn.title = 'Показати/сховати супровідний текст слайда (клавіша C)';
    subBtn.innerHTML = '💬 Текст';

    barActions?.prepend(subBtn);
    barActions?.prepend(audioBtn);

    subBtn.addEventListener('click', () => {
      if(SUBTITLE_NOTES?.length === 0) {
        alert("Не знайдено текстовий супровід для цієї лекції.");
        subtitleBox.classList.remove('visible');
        return;
      }
      subtitleBox.classList.toggle('visible');
      subBtn.classList.toggle('active-audio', subtitleBox.classList.contains('visible'));
      updateSubtitles();
    });

    const entries = slides.map((slide, i) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'overview-item';
      const title = slide.querySelector('h1, h2')?.textContent.trim() || `Слайд ${i + 1}`;
      const number = document.createElement('b');
      number.textContent = String(i + 1).padStart(2, '0');
      const label = document.createElement('span');
      label.textContent = title;
      item.append(number, label);
      item.addEventListener('click', () => {
        overviewPanel?.classList.remove('open');
        go(i);
      });
      overviewList?.appendChild(item);
      return item;
    });

    // --- АУДІО-РУШІЙ З АВТОМАТИЧНИМ ВИБОРОМ ПАПКИ ЛЕКЦІЇ ---
    const player = new Audio();
    let autoPlayActive = false;
    let calcTimers = [];

    function clearCalcTimers() {
      calcTimers.forEach(t => clearTimeout(t));
      calcTimers = [];
    }

    function stopAllAudio() {
      clearCalcTimers();
      player.pause();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      pip.classList.remove('speaking');
    }

    function runInteractiveDemoIfPresent() {
      // Запускається лише якщо на поточному активному слайді є калькулятор #needed
      const activeSlide = slides[current];
      if (!activeSlide || !activeSlide.querySelector('#needed')) return;
      const needInput = document.getElementById('needed');
      const mttrInput = document.getElementById('mttr');
      const repInput = document.getElementById('reps');
      if (needInput && mttrInput && repInput) {
        needInput.value = 1; mttrInput.value = 2; repInput.value = 3; updateCalc();
        calcTimers.push(setTimeout(() => { if (autoPlayActive) { needInput.value = 2; updateCalc(); } }, 11000));
        calcTimers.push(setTimeout(() => { if (autoPlayActive) { mttrInput.value = 5; updateCalc(); } }, 19000));
        calcTimers.push(setTimeout(() => { if (autoPlayActive) { repInput.value = 5; updateCalc(); } }, 26000));
      }
    }

    function onSlideAudioEnded() {
      pip.classList.remove('speaking');
      if (autoPlayActive && current < count - 1) {
        calcTimers.push(setTimeout(() => {
          if (!autoPlayActive) return;
          go(current + 1, true);
        }, 700));
      } else if (current >= count - 1) {
        autoPlayActive = false;
        audioBtn.innerHTML = '▶ Автоозвучка';
        audioBtn.classList.remove('active-audio');
      }
    }

    function playCurrentSlideAudio() {
      if (!autoPlayActive) return;
      stopAllAudio();
      const slideNum = String(current + 1).padStart(2, '0');
      // Беремо звук із папки конкретної лекції, наприклад: audio_lect_1/slide_01.mp3
      player.src = `${AUDIO_DIR}/slide_${slideNum}.mp3`;
      player.play().then(() => {
        pip.classList.add('speaking');
        runInteractiveDemoIfPresent();
      }).catch(() => {
        alert(`Не знайдено аудіофайл для цієї лекції. Згенеруйте озвучку для цієї лекції.`);
        autoPlayActive = false;
        audioBtn.innerHTML = '▶ Автоозвучка';
        audioBtn.classList.remove('active-audio');
      });
    }

    player.addEventListener('ended', onSlideAudioEnded);

    audioBtn.addEventListener('click', () => {
      autoPlayActive = !autoPlayActive;
      if (autoPlayActive) {
        audioBtn.innerHTML = '⏸ Стоп';
        audioBtn.classList.add('active-audio');
        playCurrentSlideAudio();
      } else {
        stopAllAudio();
        audioBtn.innerHTML = '▶ Автоозвучка';
        audioBtn.classList.remove('active-audio');
      }
    });

    function go(index, fromAutoPlay = false) {
      const next = Math.max(0, Math.min(count - 1, index));
      slides[current]?.classList.remove('active');
      current = next;
      slides[current].classList.add('active');
      if (progress) progress.style.width = `${(current + 1) / count * 100}%`;
      document.querySelectorAll('button.nav-btn.prev').forEach(button => { button.disabled = current === 0; });
      document.querySelectorAll('button.nav-btn.next').forEach(button => { button.disabled = current === count - 1; });
      entries.forEach((item, i) => item.classList.toggle('selected', i === current));
      if (location.hash !== `#slide-${current + 1}`) {
        history.replaceState(null, '', `#slide-${current + 1}`);
      }
      updateSubtitles();
      if (autoPlayActive) {
        playCurrentSlideAudio();
      } else if (!fromAutoPlay) {
        stopAllAudio();
      }
    }

    deck?.addEventListener('click', event => {
      const button = event.target.closest('button.nav-btn');
      if (!button || button.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      if (button.classList.contains('next')) go(current + 1);
      if (button.classList.contains('prev')) go(current - 1);
    });

    function toggleOverview() {
      if (!overviewPanel) return;
      overviewPanel.classList.toggle('open');
      if (overviewPanel.classList.contains('open')) {
        entries[current]?.scrollIntoView({ block: 'nearest' });
      }
    }
    overviewButton?.addEventListener('click', toggleOverview);
    closeOverviewButton?.addEventListener('click', toggleOverview);
    fullscreenButton?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    });

    document.addEventListener('keydown', event => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (overviewPanel?.classList.contains('open')) {
        if (event.key === 'Escape') toggleOverview();
        return;
      }
      if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault();
        go(current + 1);
      } else if (['ArrowLeft', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        go(current - 1);
      } else if (event.key === 'Home') {
        go(0);
      } else if (event.key === 'End') {
        go(count - 1);
      } else if (event.key.toLowerCase() === 'o') {
        toggleOverview();
      } else if (event.key.toLowerCase() === 'f') {
        fullscreenButton?.click();
      } else if (event.key.toLowerCase() === 'a') {
        audioBtn.click();
      } else if (event.key.toLowerCase() === 'c') {
        subBtn.click();
      }
    });

    deck?.addEventListener('touchstart', event => {
      touchStartX = event.touches[0]?.clientX ?? null;
    }, { passive: true });
    deck?.addEventListener('touchend', event => {
      if (touchStartX === null) return;
      const diff = event.changedTouches[0].clientX - touchStartX;
      if (Math.abs(diff) > 65) go(current + (diff < 0 ? 1 : -1));
      touchStartX = null;
    }, { passive: true });

    function updateCalc() {
      const mttfInput = document.getElementById('mttf');
      const mttrInput = document.getElementById('mttr');
      const repInput = document.getElementById('reps');
      const needInput = document.getElementById('needed');
      if (!mttfInput || !mttrInput || !repInput || !needInput) return;
      const mttf = Number(mttfInput.value), mttr = Number(mttrInput.value);
      const n = Number(repInput.value);
      needInput.max = n;
      if (Number(needInput.value) > n) needInput.value = n;
      const k = Number(needInput.value), single = mttf / (mttf + mttr);
      const binom = (n, j) => { let value = 1; for (let i = 1; i <= j; i++) value = value * (n - i + 1) / i; return value; };
      let service = 0;
      for (let i = k; i <= n; i++) service += binom(n, i) * single ** i * (1 - single) ** (n - i);
      const format = probability => (100 * probability).toFixed(5).replace('.', ',') + '%';
      const setText = (id, text) => { const node = document.getElementById(id); if (node) node.textContent = text; };
      setText('mttf-out', mttf);
      setText('mttr-out', mttr);
      setText('rep-out', n);
      setText('needed-out', k);
      setText('single-result', format(single));
      setText('service-result', format(service));
      const meter = document.getElementById('calc-meter');
      if (meter) meter.style.width = `${service * 100}%`;
    }
    ['mttf', 'mttr', 'reps', 'needed'].forEach(id => document.getElementById(id)?.addEventListener('input', updateCalc));
    updateCalc();

    const hashMatch = location.hash.match(/^#slide-(\d+)$/);
    go(hashMatch ? Number(hashMatch[1]) - 1 : 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePresentation, { once: true });
  } else {
    initializePresentation();
  }
})();