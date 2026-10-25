/* Harbor Ops — site motion. Lenis smooth scroll + GSAP ScrollTrigger. */
(() => {
  const root = document.documentElement;
  const reduce = root.classList.contains('reduce');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const range = (a, b, x) => clamp((x - a) / (b - a));
  const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // Phones, tablets and narrow windows get "lite" motion: the same page and the same hero, but no per-letter
  // colour scrubbing, blur, re-masking or animated clip-paths, which is what made scrolling lag on phones.
  const touch = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const lite = touch || matchMedia('(max-width: 900px)').matches;
  if (lite) root.classList.add('lite');

  /* ---------------------------------------------------------------------
     1. Images are linked straight from the HTML (assets/ai/<slot>.webp?v=…);
        bump that ?v= when a photo is replaced, or browsers keep the old one.
     --------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------
     2. Split text for the scroll-driven two-tone fill
     --------------------------------------------------------------------- */
  function splitFill(el) {
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span'); w.className = 'wd'; w.setAttribute('aria-hidden', 'true');
        if (lite) w.textContent = part;   // whole words: a sixth of the nodes to colour
        else for (const ch of part) { const c = document.createElement('span'); c.className = 'ch'; c.textContent = ch; w.appendChild(c); }
        frag.appendChild(w);
      });
      node.parentNode.replaceChild(frag, node);
    });
    const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = label; el.appendChild(sr);
    el.classList.add('split');
    if (lite) return $$('.wd', el);
    const chars = $$('.ch', el), finals = new Map();   // a letter's final colour is its tone's (.t1/.t2): read once each
    chars.forEach(c => {
      const tone = c.closest('.t1, .t2') || el;
      if (!finals.has(tone)) finals.set(tone, getComputedStyle(tone).color);
      c.dataset.final = finals.get(tone);
    });
    return chars;
  }
  const fills = $$('[data-fill]').map(el => ({ el, chars: splitFill(el) }));

  /* ---------------------------------------------------------------------
     3. Menu + form (work with or without motion)
     --------------------------------------------------------------------- */
  const nav = $('#nav'), menu = $('#menu'), burger = $('.nav__burger');
  const menuLinks = $$('a', menu), pageParts = $$('body > main, body > .curtain');
  let smooth = null;   // the Lenis instance, once smooth scrolling starts (section 7)
  const isOpen = () => menu.classList.contains('is-open');
  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    root.classList.toggle('menu-open', open);
    pageParts.forEach(el => { el.inert = open; });   // keyboard and screen readers stay in the menu
    if (open) { smooth?.stop(); nav.classList.remove('on-dark', 'is-hidden'); setTimeout(() => menuLinks[0].focus(), 60); }
    else { smooth?.start(); navState(); }
  }
  const closeMenu = returnFocus => { if (!isOpen()) return; setMenu(false); if (returnFocus) burger.focus(); };
  burger.addEventListener('click', () => setMenu(!isOpen()));
  menuLinks.forEach(a => a.addEventListener('click', () => closeMenu(false)));
  addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { closeMenu(true); return; }
    if (e.key !== 'Tab') return;   // Tab cycles through the close button and the menu links
    const items = [burger, ...menuLinks], i = items.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
    else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
  });
  $('.skip').addEventListener('click', e => { e.preventDefault(); $('#main').focus({ preventScroll: true }); });

  /* ---------------------------------------------------------------------
     3b. Nav: stays through the hero (the logo docks into it at the end), then
         hides on the way down and returns on the way up; flips over dark
         sections. Native scroll events fire with Lenis too.
     --------------------------------------------------------------------- */
  const sections = $$('main > section, .curtain > section, footer');
  const heroEl = $('.hero');
  const navLinks = $$('.nav__links a'), navTargets = navLinks.map(a => $(a.getAttribute('href')));
  let lastY = 0, heroEnd = 0, navHeight = 0;
  const measureNav = () => { heroEnd = heroEl.offsetTop + heroEl.offsetHeight - innerHeight; navHeight = nav.offsetHeight; };
  function navState() {
    if (isOpen()) return;
    // read everything first, then write, so the scroll handler never forces a layout
    const y = scrollY, probe = navHeight * .5, line = innerHeight * .4;
    const under = sections.find(s => { const r = s.getBoundingClientRect(); return r.top <= probe && r.bottom > probe; });
    const reading = navTargets.map(t => { const r = t?.getBoundingClientRect(); return !!r && r.top <= line && r.bottom > line; });
    const hold = heroEnd + innerHeight * .6;
    if (!reduce) {
      if (y > hold && y > lastY + 3) nav.classList.add('is-hidden');
      else if (y < lastY - 3 || y <= hold) nav.classList.remove('is-hidden');
      nav.classList.toggle('is-solid', y > heroEnd + 2);   // frosted once the page, not the hero, is under it
    }
    lastY = y;
    nav.classList.toggle('on-dark', !!under && under.classList.contains('dark'));
    // the link for the section you're reading keeps its underline
    navLinks.forEach((a, i) => { if (reading[i] !== a.hasAttribute('aria-current')) reading[i] ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'); });
  }
  measureNav();
  addEventListener('scroll', navState, { passive: true });
  addEventListener('resize', measureNav);
  navState();

  /* ---------------------------------------------------------------------
     4. Testimonial slider
     --------------------------------------------------------------------- */
  const quotes = $$('.quote'), dots = $$('.dot'), qImgs = $$('#quoteImgs img');
  let qi = 0, qTimer;
  const showQuote = n => {
    qi = (n + quotes.length) % quotes.length;
    quotes.forEach((q, i) => q.classList.toggle('is-on', i === qi));
    qImgs.forEach((im, i) => im.classList.toggle('is-on', i === qi));
    dots.forEach((d, i) => { d.classList.toggle('is-on', i === qi); d.setAttribute('aria-selected', String(i === qi)); });
  };
  const autoplay = () => { clearInterval(qTimer); if (!reduce) qTimer = setInterval(() => showQuote(qi + 1), 7000); };
  dots.forEach((d, i) => d.addEventListener('click', () => { showQuote(i); autoplay(); }));
  $('.quotes').addEventListener('mouseenter', () => clearInterval(qTimer));
  $('.quotes').addEventListener('mouseleave', autoplay);
  autoplay();

  /* ---------------------------------------------------------------------
     5. Videos play only while visible
     --------------------------------------------------------------------- */
  const vio = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting && !reduce) v.play().catch(() => {}); else v.pause();
  }), { threshold: .05 });
  $$('video').forEach(v => vio.observe(v));

  /* ---------------------------------------------------------------------
     6. "While you're out": the phone's three stories. The outro:
        Harbor Street at dusk, its rooms lighting up one by one.
     --------------------------------------------------------------------- */
  const away = $('#away');
  if (away) {   // one phone, three stories that play through on their own (Apple-style highlight tabs)
    const tabs = $$('[role="tab"]', away), panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));
    const screens = $$('.scr', away);
    let cur = 0, manual = reduce, visible = false;
    // the stories pause while the pointer or keyboard focus is on the card, or it's off-screen; picking a tab stops them
    const setPaused = () => away.classList.toggle('is-paused', manual || !visible || away.matches(':hover') || away.contains(document.activeElement));
    const sync = () => { away.classList.toggle('is-manual', manual); setPaused(); };
    const show = (i, focus) => {
      cur = (i + tabs.length) % tabs.length;
      tabs.forEach((t, k) => { const on = k === cur; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; panels[k].hidden = !on; });
      screens.forEach((s, k) => s.classList.toggle('is-on', k === cur));
      if (focus) tabs[cur].focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => { manual = true; show(i); sync(); });   // a choice stops the slideshow
      t.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault(); manual = true; show(cur + (e.key === 'ArrowRight' ? 1 : -1), true); sync();
      });
      $('i', t).addEventListener('animationend', () => { if (!manual) show(cur + 1); });   // its pill filled: next story
    });
    away.addEventListener('focusin', setPaused);
    away.addEventListener('focusout', () => setTimeout(setPaused));
    away.addEventListener('mouseenter', setPaused);
    away.addEventListener('mouseleave', setPaused);
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) away.classList.add('is-in'); setPaused(); }, { threshold: .35 }).observe(away);
    sync();
  }
  const outro = $('.outro');
  const lio = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { outro.classList.add('is-lit'); lio.disconnect(); } }, { threshold: .45 });
  lio.observe($('#outroStage'));

  /* Why Harbor: the same two houses, counted by the flat and then by the room. It plays once, on its own,
     when the card arrives: "By the room" fills up, then every window lights up and the count climbs to 16. */
  const count = $('#count');
  if (count) {
    const btns = $$('.count__switch button', count), rooms = $$('.count__room', count);
    const num = $('.count__n', count), what = $('.count__what', count), say = $('.count__say', count);
    const words = { flat: 'units, one tenant each', room: 'rooms, each with its own tenancy' };
    let mode = 'room', manual = reduce, ticks = [];
    const set = (m, play) => {
      mode = m; count.dataset.mode = m;
      btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.to === m)));
      ticks.forEach(clearTimeout); ticks = [];
      const total = m === 'flat' ? 2 : rooms.length;
      what.textContent = words[m]; say.textContent = `${total} ${words[m]}`;
      if (m === 'room' && play) { num.textContent = '0'; rooms.forEach((r, i) => ticks.push(setTimeout(() => { num.textContent = i + 1; }, 300 + i * 90))); }
      else num.textContent = total;
      rooms.forEach(r => r.classList.remove('is-tip'));
    };
    btns.forEach(b => b.addEventListener('click', () => {   // a choice stops the demo
      manual = true; count.classList.remove('is-cue');
      if (b.dataset.to !== mode) set(b.dataset.to, !reduce);
    }));
    rooms.forEach(r => r.addEventListener('click', () => rooms.forEach(o => o.classList.toggle('is-tip', o === r && !o.classList.contains('is-tip')))));
    if (!reduce) {
      set('flat');
      $('[data-to="room"] i', count).addEventListener('animationend', () => { count.classList.remove('is-cue'); if (!manual) set('room', true); });
      const cio = new IntersectionObserver(es => {
        if (!es[0].isIntersecting) return;
        count.classList.add('is-in'); if (!manual) count.classList.add('is-cue'); cio.disconnect();
      }, { threshold: .45 });
      cio.observe(count);
    }
  }

  /* The day-to-day: each tile rises in and its little picture plays once, as the tile arrives */
  const tio = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); tio.unobserve(e.target); }
  }), { threshold: .3 });
  $$('#featGrid .bx').forEach(t => tio.observe(t));

  /* Lite: the two-tone text fills word by word as it comes into view (a CSS transition, nothing on scroll) */
  if (lite) {
    const fio = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-filled'); fio.unobserve(e.target); }
    }), { rootMargin: '0px 0px -16% 0px' });
    fills.forEach(({ el, chars }) => {
      const step = Math.min(40, 850 / Math.max(1, chars.length));   // any block fills in under a second
      chars.forEach((w, i) => w.style.setProperty('--wd', `${Math.round(i * step)}ms`));
      fio.observe(el);
    });
  }

  /* Phones: the rooms and the services rows arrive once as they come into view. Nothing on phones is tied to
     the scroll position, so the page scrolls as freely as any other. */
  if (lite && !reduce) {
    $$('.room').forEach((r, i) => r.style.setProperty('--rd', `${i * 110}ms`));
    const rio = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); }
    }), { rootMargin: '0px 0px -12% 0px' });
    [$('#roomsRow'), ...$$('.svc__row')].forEach(el => el && rio.observe(el));
  }

  if (reduce || !window.gsap || !window.ScrollTrigger) { root.classList.add('reduce'); return; }

  /* ---------------------------------------------------------------------
     7. Smooth scroll
     --------------------------------------------------------------------- */
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });   // the address bar sliding in and out isn't a resize worth re-measuring
  let lenis = null;
  if (!touch) {   // phones keep their own native scrolling: smoother there, and no extra work every frame
    lenis = new Lenis({ lerp: .085, smoothWheel: true, wheelMultiplier: .95 });
    smooth = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault(); closeMenu();
    if (lenis) lenis.scrollTo(id === '#top' ? 0 : target, { duration: 1.6 });
    else scrollTo({ top: id === '#top' ? 0 : target.getBoundingClientRect().top + scrollY, behavior: 'smooth' });
  }));

  /* ---------------------------------------------------------------------
     8. Two-tone fills, scrubbed by scroll
     --------------------------------------------------------------------- */
  if (!lite) fills.forEach(({ el, chars }) => {
    const dark = !!el.closest('.dark');
    const from = dark ? '#3C5558' : '#DADBD5';
    const heading = /^H\d$/.test(el.tagName);
    gsap.set(chars, { color: from });
    gsap.to(chars, {
      color: (i, c) => c.dataset.final,
      duration: .3, ease: 'none', stagger: { each: .03 },
      scrollTrigger: { trigger: el, start: heading ? 'top 88%' : 'top 86%', end: heading ? 'top 46%' : 'bottom 58%', scrub: .6 },
    });
  });

  /* ---------------------------------------------------------------------
     9. Hero: the headline clears and HARBOR draws itself on open sky; the
        townhouses rise into the outline and fill it; the logo settles to
        solid teal, then docks into the nav as Why Harbor arrives
     --------------------------------------------------------------------- */
  const stage = $('#heroStage'), hero = $('.hero'), copy = $('#heroCopy');
  const sky = $('.hero__sky'), house = $('#heroHouse'), logo = $('#heroLogo');
  const fillWrap = $('#heroFill'), solid = $('#heroSolid'), outline = $('#heroOutline');
  const veil = $('#heroVeil'), cue = $('#heroCue');
  const mistBack = $('.hero__mist--back i'), [mistL, mistR] = $$('.hero__mist--front i');
  const navLogo = $('.nav__logo'), navLogoImg = $('img', navLogo);
  const houseImg = $('img', house);
  const LOGO_UNITS = 279.51, LOGO_RATIO = 69.21 / LOGO_UNITS;
  let H = 0, W = 0, logoW = 0, logoH = 0, logoTop = 0, houseW = 0, houseH = 0, startY = 0, midY = 0, hp = 0, warpA = 0, outlinePaths = [];
  let sL = 1.18, xEnd = 0, xRest = 0, bbox = { x0: 0, x1: 1, y0: 0, y1: 1 };
  let dockS = 1, navH = 76, introT = 0;
  const draw = () => (lite ? renderIntro(introT) : renderHero());
  // the script takes over from the CSS fallback (if that already revealed the hero, don't fade it in twice)
  const shownByFallback = parseFloat(getComputedStyle(copy).opacity) > .5;
  const fadeIns = [copy, house, mistBack, mistL, mistR];
  fadeIns.forEach(el => { if (shownByFallback) el.style.opacity = 1; el.style.animation = 'none'; });

  // Where the house actually is inside its image (ignoring transparent margins),
  // measured across the band of the facade the logo will sit over.
  function measureHouse() {
    try {
      const iw = houseImg.naturalWidth, ih = houseImg.naturalHeight; if (!iw) return;
      const w = 240, h = Math.max(2, Math.round(w * ih / iw));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(houseImg, 0, 0, w, h);
      const a = g.getImageData(0, 0, w, h).data;
      let x0 = w, x1 = -1, y0 = h, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (a[(y * w + x) * 4 + 3] < 140) continue;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (y > h * .25 && y < h * .65) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
      }
      if (x1 > x0 && y1 > y0) bbox = { x0: x0 / w, x1: (x1 + 1) / w, y0: y0 / h, y1: (y1 + 1) / h };
    } catch (e) {}
  }

  // The clean outline: one path per contour, left to right, tracing exactly the logo that fills.
  // Each contour starts a little after the one to its left, so the line writes the word.
  const outlineReady = fetch('assets/brand/harbor-logo-outline.svg').then(r => r.text()).then(txt => {
    const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
    doc.querySelectorAll('path').forEach(p => {
      const np = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      np.setAttribute('d', p.getAttribute('d'));
      outline.appendChild(np);
    });
    outlinePaths = $$('path', outline).map(p => {
      const len = p.getTotalLength(); p.style.strokeDasharray = `${len} ${len}`; p.style.strokeDashoffset = len;
      return { p, len, x: p.getBBox().x };
    });
    const xs = outlinePaths.map(o => o.x), xa = Math.min(...xs), xb = Math.max(...xs);
    outlinePaths.forEach(o => { o.start = (o.x - xa) / (xb - xa || 1) * .4; });
    draw();
  });

  function layoutHero() {
    W = stage.clientWidth; H = stage.clientHeight;
    const portrait = W / H < 0.9;
    warpA = portrait ? .5 : 0;   // phones: drawing and rise take the first half, the dock gets the rest as Why Harbor rises in
    const ar = (houseImg.naturalWidth || 3) / (houseImg.naturalHeight || 2);
    const bw = Math.max(.2, bbox.x1 - bbox.x0), bh = Math.max(.2, bbox.y1 - bbox.y0);
    // at rest the facade spans just under half a wide screen; a portrait screen crops in, centred on the doors
    houseW = (portrait ? W * 1.5 : W * .46) / bw;
    houseH = houseW / ar;
    if (!portrait && bh * houseH > H * 1.15) { houseH = H * 1.15 / bh; houseW = houseH * ar; }
    logoW = portrait ? W * .86 : Math.min(W * .6, 980);
    logoH = logoW * LOGO_RATIO;
    logoTop = H * (portrait ? .42 : .37) - logoH / 2 + logoH * .1;
    const copyBottom = copy.offsetTop + copy.offsetHeight;
    // the roofline waits just below the logo, so HARBOR draws on open sky
    const roofY = Math.max(copyBottom + H * .035, logoTop + logoH + H * .012, H * (portrait ? .58 : .5));
    startY = roofY - bbox.y0 * houseH;
    const cx = (bbox.x0 + bbox.x1) / 2 - .5;
    xRest = -cx * houseW;
    // when it has risen, the facade fills the logo: windows behind the letters
    sL = portrait ? 1.1 : clamp(logoW * 1.1 / (houseW * bw), 1, 2.6);
    xEnd = -cx * houseW * sL;
    midY = logoTop + logoH * .5 - (bbox.y0 + bh * .42) * houseH * sL;
    stage.style.setProperty('--house-w', `${houseW}px`);
    stage.style.setProperty('--logo-w', `${logoW}px`);
    stage.style.setProperty('--logo-y', `${logoTop}px`);
    stage.style.setProperty('--logo-top', `${logoTop}px`);
    outline.style.setProperty('--ow', ((portrait ? 1.3 : 1.6) / (logoW / LOGO_UNITS)).toFixed(3));
    navH = nav.offsetHeight;
    // the dock: a single zoom about one fixed point lands the logo exactly on the nav logo
    const nr = nav.getBoundingClientRect(), lr = navLogoImg.getBoundingClientRect();
    dockS = lr.width / logoW;
    const fx = (lr.left - nr.left - dockS * (W - logoW) / 2) / (1 - dockS);
    const fy = (lr.top - nr.top - dockS * logoTop) / (1 - dockS);
    logo.style.transformOrigin = `${fx.toFixed(2)}px ${fy.toFixed(2)}px`;
    draw();
  }

  function renderHero() {
    const p = warpA ? (hp < warpA ? hp * (.72 / warpA) : .72 + (hp - warpA) * (.28 / (1 - warpA))) : hp;
    // 1 · the headline clears and the nav logo steps aside; HARBOR draws itself on open sky
    const out = range(0, .12, p);
    const copyO = (1 - out) * introO;
    copy.style.opacity = copyO;
    copy.style.visibility = copyO < .02 ? 'hidden' : '';   // no invisible, clickable button over the logo
    if (!lite) copy.style.filter = out > 0 ? `blur(${(out * 10).toFixed(2)}px)` : 'none';
    copy.style.transform = `translateY(${-60 * range(0, .18, p) + (1 - introO) * 24}px)`;
    cue.style.opacity = (1 - range(0, .05, p)) * introO;
    if (!lite) sky.style.transform = `scale(${1 + .05 * p})`;
    const draw = range(.08, .3, p);
    outlinePaths.forEach(o => { o.p.style.strokeDashoffset = o.len * (1 - ease(range(o.start, o.start + .6, draw))); });
    outline.style.opacity = draw > 0 ? 1 - range(.6, .7, p) : 0;

    // 2 · the townhouses rise into the outline; the facade fills the letters, then settles to solid teal
    const rise = ease(range(.2, .56, p));
    const hy = lerp(startY, midY, rise) + introY, hs = lerp(1, sL, rise);
    stage.style.setProperty('--house-x', `${lerp(xRest, xEnd, rise).toFixed(1)}px`);
    stage.style.setProperty('--house-y', `${hy}px`);
    stage.style.setProperty('--house-s', hs.toFixed(4));
    if (!lite) {   // chimneys never sit under the nav links (a constant while far below it: no repaint); lite uses a fixed fade
      const fade = (navH + 10 - hy) / hs;
      house.style.setProperty('--fade', fade > -40 ? `${fade.toFixed(1)}px` : '-999px');
    }
    house.style.opacity = (1 - ease(range(.52, .64, p))) * introH;
    fillWrap.style.opacity = ease(range(.44, .58, p));
    solid.style.opacity = ease(range(.6, .72, p));
    // the mist drifts on its own (CSS); on scroll the front banks part and the back bank lifts away
    const part = ease(range(0, .32, p)), lift = ease(range(0, .45, p));
    mistL.style.transform = `translateX(${(-24 * part).toFixed(2)}%)`;
    mistR.style.transform = `translateX(${(24 * part).toFixed(2)}%)`;
    mistL.style.opacity = mistR.style.opacity = (1 - range(.04, .3, p)) * introH;
    mistBack.style.transform = `translateY(${(-6 * lift).toFixed(2)}%) scale(${(1 + .06 * lift).toFixed(4)})`;
    mistBack.style.opacity = (1 - range(.12, .46, p)) * introH;

    // 3 · the street dissolves into cream as the letters turn solid, so the logo lands on the brand's own
    //     teal-on-cream; then it docks into the nav as Why Harbor arrives
    veil.style.opacity = ease(range(.56, .72, p));
    const dock = ease(range(.84, .97, p));
    logo.style.transform = dock > 0 ? `scale(${Math.pow(dockS, dock).toFixed(5)})` : '';
    logo.style.opacity = p < .985 ? 1 : 0;
    const navO = p < .5 ? 1 - range(.05, .12, p) : range(.96, .985, p);
    navLogo.style.opacity = navO;
    navLogo.style.visibility = navO < .02 ? 'hidden' : '';
  }

  /* Phones: the same story, played once by itself in one screen, under 3 seconds, nothing tied to the scroll.
     HARBOR writes itself on the sky, the street rises into place below it, the letters fill with teal,
     the logo flies into the nav, and the headline and button arrive. Touching or scrolling hurries it to the end. */
  const INTRO_END = 2.75;
  function renderIntro(t) {
    const k = (a, b) => range(a, b, t), out3 = x => 1 - Math.pow(1 - x, 3);
    const drawP = k(.1, 1.2);
    outlinePaths.forEach(o => { o.p.style.strokeDashoffset = o.len * (1 - ease(range(o.start, o.start + .6, drawP))); });
    outline.style.opacity = drawP > 0 ? 1 - k(1.45, 1.75) : 0;
    stage.style.setProperty('--house-x', `${xRest.toFixed(1)}px`);
    stage.style.setProperty('--house-y', `${(startY + (1 - out3(k(.5, 1.6))) * H * .42).toFixed(1)}px`);
    stage.style.setProperty('--house-s', '1');
    house.style.opacity = k(.5, .9);
    const mist = k(.7, 1.5);
    mistBack.style.opacity = mistL.style.opacity = mistR.style.opacity = mist;
    fillWrap.style.opacity = ease(k(1.1, 1.55));
    solid.style.opacity = 1;
    veil.style.opacity = 0;
    const dock = ease(k(1.85, 2.45));
    logo.style.transform = dock > 0 ? `scale(${Math.pow(dockS, dock).toFixed(5)})` : '';
    logo.style.opacity = t < 2.45 ? 1 : 0;
    const navO = k(2.33, 2.47);
    navLogo.style.opacity = navO;
    navLogo.style.visibility = navO < .02 ? 'hidden' : '';
    const c = out3(k(2.05, INTRO_END));
    copy.style.opacity = c;
    copy.style.visibility = c < .02 ? 'hidden' : '';
    copy.style.transform = c < 1 ? `translateY(${((1 - c) * 26).toFixed(1)}px)` : '';
    cue.style.opacity = 0;
  }

  // desktop load-in: the copy settles and the street rises a little into place
  let introY = 0, introO = shownByFallback ? 1 : 0, introH = introO;
  if (lite) {
    let speed = 1, last = 0;
    const hurry = () => { speed = 6; stopHurry(); };
    const onScroll = () => { if (scrollY > 4) hurry(); };
    const hurryOn = ['touchstart', 'wheel', 'keydown', 'pointerdown'];
    const stopHurry = () => { hurryOn.forEach(e => removeEventListener(e, hurry)); removeEventListener('scroll', onScroll); };
    const tick = now => {
      introT = Math.min(INTRO_END, introT + (last ? (now - last) / 1000 : 0) * speed); last = now;
      renderIntro(introT);
      if (introT < INTRO_END) requestAnimationFrame(tick); else stopHurry();
    };
    const play = () => {
      if (shownByFallback || scrollY > 4 || location.hash.length > 1) { introT = INTRO_END; draw(); return; }   // landed mid-page: no show
      hurryOn.forEach(e => addEventListener(e, hurry, { passive: true }));
      addEventListener('scroll', onScroll, { passive: true });
      requestAnimationFrame(tick);
    };
    navLogo.style.animation = 'none';   // the script has the nav logo now (CSS only shows it if the script never runs)
    draw();   // the first frame: open sky
    const ready = [houseImg.decode ? houseImg.decode().catch(() => {}) : 0, outlineReady.catch(() => {}), document.fonts ? document.fonts.ready : 0];
    Promise.race([Promise.all(ready), new Promise(r => setTimeout(r, 1200))]).then(() => { measureHouse(); layoutHero(); play(); });
  } else {
    if (!shownByFallback) gsap.fromTo({ v: 0 }, { v: 0 }, { v: 1, duration: 1.6, ease: 'power3.out', delay: .15,
      onStart() { introY = H * .08; },
      onUpdate() { const v = this.targets()[0].v; introY = H * .08 * (1 - v); introO = v; introH = Math.min(1, v * 1.6); renderHero(); } });
    ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate: st => { hp = st.progress; renderHero(); } });
  }

  /* ---------------------------------------------------------------------
     11. Room by room: gabled frames arrive one after another
     --------------------------------------------------------------------- */
  if (!lite) gsap.fromTo('.room', { xPercent: -40, opacity: 0 }, { xPercent: 0, opacity: 1, ease: 'none', stagger: .18,
    scrollTrigger: { trigger: '#roomsRow', start: 'top 92%', end: 'top 48%', scrub: true } });
  if (!lite) gsap.fromTo('.room img', { scale: 1.2 }, { scale: 1.02, ease: 'none',
    scrollTrigger: { trigger: '#roomsRow', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* ---------------------------------------------------------------------
     12. Our story: image opens up, small image drifts at its own pace
     --------------------------------------------------------------------- */
  if (!lite) {
    gsap.fromTo('#originBig', { '--o-inset': '16%', '--o-zoom': 1.16 }, { '--o-inset': '0%', '--o-zoom': 1, ease: 'none',
      scrollTrigger: { trigger: '#originBig', start: 'top 96%', end: 'top 30%', scrub: true } });
    gsap.fromTo('#originSmall', { y: 160 }, { y: -160, ease: 'none',
      scrollTrigger: { trigger: '.origin', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  /* ---------------------------------------------------------------------
     13. Services: the big words rise into their rows
     --------------------------------------------------------------------- */
  if (!lite) $$('.svc__row').forEach(row => {
    gsap.fromTo($('.svc__word span', row), { yPercent: 70, opacity: 0 }, { yPercent: 0, opacity: 1, ease: 'none',
      scrollTrigger: { trigger: row, start: 'top 96%', end: 'top 62%', scrub: true } });
    gsap.fromTo($('.svc__info', row), { opacity: 0, y: 16 }, { opacity: 1, y: 0, ease: 'none',
      scrollTrigger: { trigger: row, start: 'top 92%', end: 'top 70%', scrub: true } });
  });

  /* ---------------------------------------------------------------------
     15. Layout
     --------------------------------------------------------------------- */
  const relayout = () => { layoutHero(); measureNav(); ScrollTrigger.refresh(); };
  const onHouse = () => { measureHouse(); relayout(); };
  if (houseImg.complete) { measureHouse(); layoutHero(); }
  houseImg.addEventListener('load', onHouse);
  let lastW = innerWidth;
  addEventListener('resize', () => {
    if (touch && innerWidth === lastW) return;   // only the address bar moved: the hero is sized in svh, nothing to redo
    lastW = innerWidth;
    clearTimeout(relayout.t); relayout.t = setTimeout(relayout, 120);
  });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(relayout);
})();
