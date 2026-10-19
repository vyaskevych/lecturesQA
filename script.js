(() => {
  'use strict';

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

    const entries = slides.map((slide, i) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'overview-item';
      const title = slide.querySelector('h1, h2')?.textContent.trim() || `Слайд ${i+1}`;
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

    function go(index) {
      const next = Math.max(0, Math.min(count - 1, index));
      slides[current]?.classList.remove('active');
      current = next;
      slides[current].classList.add('active');
      if (progress) progress.style.width = `${(current + 1) / count * 100}%`;
      document.querySelectorAll('button.nav-btn.prev').forEach(button => { button.disabled = current === 0; });
      document.querySelectorAll('button.nav-btn.next').forEach(button => { button.disabled = current === count - 1; });
      entries.forEach((item, i) => item.classList.toggle('selected', i === current));
      // Replace, don't push, so arrow navigation doesn't fill the browser's back history.
      if (location.hash !== `#slide-${current + 1}`) {
        history.replaceState(null, '', `#slide-${current + 1}`);
      }
    }

    // Delegation works for all slides (including the first), independently of overlay artwork.
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
        entries[current]?.scrollIntoView({block:'nearest'});
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
      if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
      if (overviewPanel?.classList.contains('open')) {
        if (event.key === 'Escape') toggleOverview();
        return;
      }
      if (['ArrowRight','PageDown',' '].includes(event.key)) {
        event.preventDefault();
        go(current + 1);
      } else if (['ArrowLeft','PageUp'].includes(event.key)) {
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
      }
    });

    deck?.addEventListener('touchstart', event => {
      touchStartX = event.touches[0]?.clientX ?? null;
    }, {passive:true});
    deck?.addEventListener('touchend', event => {
      if (touchStartX === null) return;
      const diff = event.changedTouches[0].clientX - touchStartX;
      if (Math.abs(diff) > 65) go(current + (diff < 0 ? 1 : -1));
      touchStartX = null;
    }, {passive:true});

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
      const binom = (n, j) => { let value = 1; for (let i=1; i<=j; i++) value = value*(n-i+1)/i; return value; };
      let service = 0;
      for (let i=k; i<=n; i++) service += binom(n,i) * single**i * (1-single)**(n-i);
      const format = probability => (100*probability).toFixed(5).replace('.', ',') + '%';
      const setText = (id,text) => { const node=document.getElementById(id); if(node) node.textContent=text; };
      setText('mttf-out',mttf);
      setText('mttr-out',mttr);
      setText('rep-out',n);
      setText('needed-out',k);
      setText('single-result',format(single));
      setText('service-result',format(service));
      const meter=document.getElementById('calc-meter');
      if (meter) meter.style.width = `${service * 100}%`;
    }
    ['mttf','mttr','reps','needed'].forEach(id => document.getElementById(id)?.addEventListener('input',updateCalc));
    updateCalc();

    const hashMatch = location.hash.match(/^#slide-(\d+)$/);
    go(hashMatch ? Number(hashMatch[1]) - 1 : 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePresentation, {once:true});
  } else {
    initializePresentation();
  }
})();
