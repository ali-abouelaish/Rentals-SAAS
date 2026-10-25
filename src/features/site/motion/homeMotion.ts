import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

/**
 * The homepage's motion: Lenis smooth scroll + GSAP ScrollTrigger, ported from the designer's
 * js/site.js (section numbers kept). `root` is the page's .harbor-home wrapper.
 *
 * Returns a cleanup that undoes everything it started (listeners, observers, timers, animation
 * frames, GSAP tweens and ScrollTriggers, Lenis, the html classes), so React's StrictMode double
 * mount and client-side navigation away and back stay clean.
 *
 * Differences from site.js: no testimonial slider or video handling (those sections aren't on the
 * page); the HARBOR outline is rendered with the page rather than fetched; split text is reused if
 * it's already split (a second mount must not split it twice).
 */
export function startHomeMotion(root: HTMLElement): () => void {
  const disposers: Array<() => void> = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const undo of disposers.reverse()) {
      try {
        undo();
      } catch {
        // keep tearing down
      }
    }
  };
  const on = (target: EventTarget, type: string, fn: EventListener, options?: AddEventListenerOptions | boolean) => {
    target.addEventListener(type, fn, options);
    disposers.push(() => target.removeEventListener(type, fn, options));
  };
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    disposers.push(() => window.clearTimeout(id));
  };
  const watch = (observer: IntersectionObserver) => {
    disposers.push(() => observer.disconnect());
    return observer;
  };

  const html = document.documentElement;
  const $ = <T extends Element = HTMLElement>(s: string, c: ParentNode = root) => c.querySelector<T>(s);
  const $$ = <T extends Element = HTMLElement>(s: string, c: ParentNode = root) => [...c.querySelectorAll<T>(s)];
  const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const range = (a: number, b: number, x: number) => clamp((x - a) / (b - a));
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // Phones, tablets and narrow windows get "lite" motion: the same page and the same hero, but no per-letter
  // colour scrubbing, blur, re-masking or animated clip-paths, which is what made scrolling lag on phones.
  // The pre-paint script (SiteFrame) set these classes on a full page load; a client-side visit didn't run it.
  const touch = matchMedia("(hover: none) and (pointer: coarse)").matches;
  const lite = touch || matchMedia("(max-width: 900px)").matches;
  root.classList.add("is-js");
  if (lite) root.classList.add("is-lite");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) root.classList.add("is-reduce");
  const reduce = root.classList.contains("is-reduce");

  // The sky photo fades in once loaded (the pre-paint script catches this on a full page load).
  const plate = $<HTMLImageElement>(".hero__plate");
  if (plate) {
    if (plate.complete) plate.classList.add("is-in");
    else on(plate, "load", () => plate.classList.add("is-in"), { once: true });
  }

  /* ---------------------------------------------------------------------
     2. Split text for the scroll-driven two-tone fill
     --------------------------------------------------------------------- */
  function splitFill(el: HTMLElement): HTMLElement[] {
    if (el.classList.contains("split")) return $$(lite ? ".wd" : ".ch", el);
    const label = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      const frag = document.createDocumentFragment();
      for (const part of (node.nodeValue ?? "").split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(" "));
          continue;
        }
        const w = document.createElement("span");
        w.className = "wd";
        w.setAttribute("aria-hidden", "true");
        if (lite) w.textContent = part; // whole words: a sixth of the nodes to colour
        else
          for (const ch of part) {
            const c = document.createElement("span");
            c.className = "ch";
            c.textContent = ch;
            w.appendChild(c);
          }
        frag.appendChild(w);
      }
      node.parentNode?.replaceChild(frag, node);
    }
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = label;
    el.appendChild(sr);
    el.classList.add("split");
    if (lite) return $$(".wd", el);
    const chars = $$(".ch", el);
    const finals = new Map<Element, string>(); // a letter's final colour is its tone's (.t1/.t2): read once each
    for (const c of chars) {
      const tone = c.closest(".t1, .t2") ?? el;
      if (!finals.has(tone)) finals.set(tone, getComputedStyle(tone).color);
      c.dataset.final = finals.get(tone);
    }
    return chars;
  }
  const fills = $$("[data-fill]").map((el) => ({ el, chars: splitFill(el) }));

  /* ---------------------------------------------------------------------
     3. Menu (works with or without motion)
     --------------------------------------------------------------------- */
  const nav = $("#nav")!;
  const menu = $("#menu")!;
  const burger = $<HTMLButtonElement>(".nav__burger")!;
  const menuLinks = $$<HTMLAnchorElement>("a", menu);
  const pageParts = $$(":scope > main, :scope > .curtain");
  let smooth: Lenis | null = null; // the Lenis instance, once smooth scrolling starts (section 7)
  const isOpen = () => menu.classList.contains("is-open");
  function setMenu(open: boolean) {
    menu.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    html.classList.toggle("hs-menu-open", open);
    for (const el of pageParts) el.inert = open; // keyboard and screen readers stay in the menu
    if (open) {
      smooth?.stop();
      nav.classList.remove("on-dark", "is-hidden");
      later(() => menuLinks[0]?.focus(), 60);
    } else {
      smooth?.start();
      navState();
    }
  }
  const closeMenu = (returnFocus = false) => {
    if (!isOpen()) return;
    setMenu(false);
    if (returnFocus) burger.focus();
  };
  disposers.push(() => {
    html.classList.remove("hs-menu-open");
    for (const el of pageParts) el.inert = false;
  });
  on(burger, "click", () => setMenu(!isOpen()));
  for (const a of menuLinks) on(a, "click", () => closeMenu(false));
  on(window, "keydown", ((e: KeyboardEvent) => {
    if (!isOpen()) return;
    if (e.key === "Escape") {
      closeMenu(true);
      return;
    }
    if (e.key !== "Tab") return; // Tab cycles through the close button and the menu links
    const items: HTMLElement[] = [burger, ...menuLinks];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && i <= 0) {
      e.preventDefault();
      items[items.length - 1].focus();
    } else if (!e.shiftKey && i === items.length - 1) {
      e.preventDefault();
      items[0].focus();
    }
  }) as EventListener);
  const skip = $(".skip");
  if (skip)
    on(skip, "click", (e) => {
      e.preventDefault();
      $("#main")?.focus({ preventScroll: true });
    });

  /* ---------------------------------------------------------------------
     3b. Nav: stays through the hero (the logo docks into it at the end), then
         hides on the way down and returns on the way up; flips over dark
         sections. Native scroll events fire with Lenis too.
     --------------------------------------------------------------------- */
  const sections = $$("main > section, .curtain > section, footer");
  const heroEl = $(".hero")!;
  const navLinks = $$<HTMLAnchorElement>(".nav__links a");
  const navTargets = navLinks.map((a) => $(a.getAttribute("href") ?? ""));
  let lastY = 0;
  let heroEnd = 0;
  let navHeight = 0;
  const measureNav = () => {
    heroEnd = heroEl.offsetTop + heroEl.offsetHeight - innerHeight;
    navHeight = nav.offsetHeight;
  };
  function navState() {
    if (isOpen()) return;
    // read everything first, then write, so the scroll handler never forces a layout
    const y = scrollY;
    const probe = navHeight * 0.5;
    const line = innerHeight * 0.4;
    const under = sections.find((s) => {
      const r = s.getBoundingClientRect();
      return r.top <= probe && r.bottom > probe;
    });
    const reading = navTargets.map((t) => {
      const r = t?.getBoundingClientRect();
      return !!r && r.top <= line && r.bottom > line;
    });
    const hold = heroEnd + innerHeight * 0.6;
    if (!reduce) {
      if (y > hold && y > lastY + 3) nav.classList.add("is-hidden");
      else if (y < lastY - 3 || y <= hold) nav.classList.remove("is-hidden");
      nav.classList.toggle("is-solid", y > heroEnd + 2); // frosted once the page, not the hero, is under it
    }
    lastY = y;
    nav.classList.toggle("on-dark", !!under && under.classList.contains("dark"));
    // the link for the section you're reading keeps its underline
    navLinks.forEach((a, i) => {
      if (reading[i] !== a.hasAttribute("aria-current")) {
        if (reading[i]) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      }
    });
  }
  measureNav();
  on(window, "scroll", navState, { passive: true });
  on(window, "resize", measureNav);
  navState();

  /* ---------------------------------------------------------------------
     6. "While you're out": the phone's three stories. The outro:
        Harbor Street at dusk, its rooms lighting up one by one.
     --------------------------------------------------------------------- */
  const away = $("#away");
  if (away) {
    // one phone, three stories that play through on their own (Apple-style highlight tabs)
    const tabs = $$<HTMLButtonElement>('[role="tab"]', away);
    const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls") ?? ""));
    const screens = $$(".scr", away);
    let cur = 0;
    let manual = reduce;
    let visible = false;
    // the stories pause while the pointer or keyboard focus is on the card, or it's off-screen; picking a tab stops them
    const setPaused = () =>
      away.classList.toggle("is-paused", manual || !visible || away.matches(":hover") || away.contains(document.activeElement));
    const sync = () => {
      away.classList.toggle("is-manual", manual);
      setPaused();
    };
    const show = (i: number, focus?: boolean) => {
      cur = (i + tabs.length) % tabs.length;
      tabs.forEach((t, k) => {
        const isOn = k === cur;
        t.setAttribute("aria-selected", String(isOn));
        t.tabIndex = isOn ? 0 : -1;
        const panel = panels[k];
        if (panel) panel.hidden = !isOn;
      });
      screens.forEach((s, k) => s.classList.toggle("is-on", k === cur));
      if (focus) tabs[cur].focus();
    };
    tabs.forEach((t, i) => {
      on(t, "click", () => {
        manual = true; // a choice stops the slideshow
        show(i);
        sync();
      });
      on(t, "keydown", ((e: KeyboardEvent) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        manual = true;
        show(cur + (e.key === "ArrowRight" ? 1 : -1), true);
        sync();
      }) as EventListener);
      const pill = $("i", t);
      if (pill)
        on(pill, "animationend", () => {
          if (!manual) show(cur + 1); // its pill filled: next story
        });
    });
    on(away, "focusin", setPaused);
    on(away, "focusout", () => later(setPaused, 0));
    on(away, "mouseenter", setPaused);
    on(away, "mouseleave", setPaused);
    watch(
      new IntersectionObserver(
        (entries) => {
          visible = entries[0].isIntersecting;
          if (visible) away.classList.add("is-in");
          setPaused();
        },
        { threshold: 0.35 }
      )
    ).observe(away);
    sync();
  }

  const outro = $(".outro");
  const outroStage = $("#outroStage");
  if (outro && outroStage) {
    const lio = watch(
      new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            outro.classList.add("is-lit");
            lio.disconnect();
          }
        },
        { threshold: 0.45 }
      )
    );
    lio.observe(outroStage);
  }

  /* Why Harbor: the same two houses, counted by the flat and then by the room. It plays once, on its own,
     when the card arrives: "By the room" fills up, then every window lights up and the count climbs to 16. */
  const count = $("#count");
  if (count) {
    const btns = $$<HTMLButtonElement>(".count__switch button", count);
    const rooms = $$(".count__room", count);
    const num = $(".count__n", count)!;
    const what = $(".count__what", count)!;
    const say = $(".count__say", count)!;
    const words = { flat: "units, one tenant each", room: "rooms, each with its own tenancy" };
    let mode: "flat" | "room" = "room";
    let manual = reduce;
    let ticks: number[] = [];
    disposers.push(() => ticks.forEach((id) => window.clearTimeout(id)));
    const set = (m: "flat" | "room", play?: boolean) => {
      mode = m;
      count.dataset.mode = m;
      btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.to === m)));
      ticks.forEach((id) => window.clearTimeout(id));
      ticks = [];
      const total = m === "flat" ? 2 : rooms.length;
      what.textContent = words[m];
      say.textContent = `${total} ${words[m]}`;
      if (m === "room" && play) {
        num.textContent = "0";
        rooms.forEach((_, i) => ticks.push(window.setTimeout(() => (num.textContent = String(i + 1)), 300 + i * 90)));
      } else num.textContent = String(total);
      rooms.forEach((r) => r.classList.remove("is-tip"));
    };
    btns.forEach((b) =>
      on(b, "click", () => {
        // a choice stops the demo
        manual = true;
        count.classList.remove("is-cue");
        const to = b.dataset.to === "flat" ? "flat" : "room";
        if (to !== mode) set(to, !reduce);
      })
    );
    rooms.forEach((r) =>
      on(r, "click", () => rooms.forEach((o) => o.classList.toggle("is-tip", o === r && !o.classList.contains("is-tip"))))
    );
    if (!reduce) {
      set("flat");
      const fill = $('[data-to="room"] i', count);
      if (fill)
        on(fill, "animationend", () => {
          count.classList.remove("is-cue");
          if (!manual) set("room", true);
        });
      const cio = watch(
        new IntersectionObserver(
          (entries) => {
            if (!entries[0].isIntersecting) return;
            count.classList.add("is-in");
            if (!manual) count.classList.add("is-cue");
            cio.disconnect();
          },
          { threshold: 0.45 }
        )
      );
      cio.observe(count);
    }
  }

  /* The day-to-day: each tile rises in and its little picture plays once, as the tile arrives */
  const tio = watch(
    new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            tio.unobserve(e.target);
          }
        }),
      { threshold: 0.3 }
    )
  );
  $$("#featGrid .bx").forEach((t) => tio.observe(t));

  /* Lite: the two-tone text fills word by word as it comes into view (a CSS transition, nothing on scroll) */
  if (lite) {
    const fio = watch(
      new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("is-filled");
              fio.unobserve(e.target);
            }
          }),
        { rootMargin: "0px 0px -16% 0px" }
      )
    );
    for (const { el, chars } of fills) {
      const step = Math.min(40, 850 / Math.max(1, chars.length)); // any block fills in under a second
      chars.forEach((w, i) => w.style.setProperty("--wd", `${Math.round(i * step)}ms`));
      fio.observe(el);
    }
  }

  /* Phones: the rooms and the services rows arrive once as they come into view. Nothing on phones is tied to
     the scroll position, so the page scrolls as freely as any other. */
  if (lite && !reduce) {
    $$(".room").forEach((r, i) => r.style.setProperty("--rd", `${i * 110}ms`));
    const rio = watch(
      new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("is-in");
              rio.unobserve(e.target);
            }
          }),
        { rootMargin: "0px 0px -12% 0px" }
      )
    );
    [$("#roomsRow"), ...$$(".svc__row")].forEach((el) => el && rio.observe(el));
  }

  if (reduce) return dispose;

  /* ---------------------------------------------------------------------
     7. Smooth scroll
     --------------------------------------------------------------------- */
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true }); // the address bar sliding in and out isn't a resize worth re-measuring
  let lenis: Lenis | null = null;
  if (!touch) {
    // phones keep their own native scrolling: smoother there, and no extra work every frame
    const instance = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95 });
    lenis = instance;
    smooth = instance;
    instance.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    disposers.push(() => {
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33); // GSAP's default
      instance.destroy();
      smooth = null;
    });
  }
  $$<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
    on(a, "click", (e) => {
      const id = a.getAttribute("href") ?? "";
      const target = id.length > 1 ? $(id) : null;
      if (!target) return;
      e.preventDefault();
      closeMenu();
      if (lenis) lenis.scrollTo(id === "#top" ? 0 : target, { duration: 1.6 });
      else scrollTo({ top: id === "#top" ? 0 : target.getBoundingClientRect().top + scrollY, behavior: "smooth" });
    })
  );

  /* ---------------------------------------------------------------------
     9. Hero: the headline clears and HARBOR draws itself on open sky; the
        townhouses rise into the outline and fill it; the logo settles to
        solid teal, then docks into the nav as Why Harbor arrives
     --------------------------------------------------------------------- */
  const stage = $("#heroStage")!;
  const hero = $(".hero")!;
  const copy = $("#heroCopy")!;
  const sky = $(".hero__sky")!;
  const house = $("#heroHouse")!;
  const logo = $("#heroLogo")!;
  const fillWrap = $("#heroFill")!;
  const solid = $("#heroSolid")!;
  const outline = $<SVGSVGElement>("#heroOutline")!;
  const veil = $("#heroVeil")!;
  const cue = $("#heroCue")!;
  const mistBack = $(".hero__mist--back i")!;
  const [mistL, mistR] = $$(".hero__mist--front i");
  const navLogo = $(".nav__logo")!;
  const navLogoImg = $("img", navLogo)!;
  const houseImg = $<HTMLImageElement>("img", house)!;
  const LOGO_UNITS = 279.51;
  const LOGO_RATIO = 69.21 / LOGO_UNITS;
  let H = 0;
  let W = 0;
  let logoW = 0;
  let logoH = 0;
  let logoTop = 0;
  let houseW = 0;
  let houseH = 0;
  let startY = 0;
  let midY = 0;
  let hp = 0;
  let warpA = 0;
  let sL = 1.18;
  let xEnd = 0;
  let xRest = 0;
  let bbox = { x0: 0, x1: 1, y0: 0, y1: 1 };
  let dockS = 1;
  let navH = 76;
  let introT = 0;
  const draw = () => (lite ? renderIntro(introT) : renderHero());
  // the script takes over from the CSS fallback (if that already revealed the hero, don't fade it in twice)
  const shownByFallback = parseFloat(getComputedStyle(copy).opacity) > 0.5;
  for (const el of [copy, house, mistBack, mistL, mistR]) {
    if (!el) continue;
    if (shownByFallback) el.style.opacity = "1";
    el.style.animation = "none";
  }

  // Where the house actually is inside its image (ignoring transparent margins),
  // measured across the band of the facade the logo will sit over.
  function measureHouse() {
    try {
      const iw = houseImg.naturalWidth;
      const ih = houseImg.naturalHeight;
      if (!iw) return;
      const w = 240;
      const h = Math.max(2, Math.round((w * ih) / iw));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d", { willReadFrequently: true });
      if (!g) return;
      g.drawImage(houseImg, 0, 0, w, h);
      const a = g.getImageData(0, 0, w, h).data;
      let x0 = w;
      let x1 = -1;
      let y0 = h;
      let y1 = -1;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          if (a[(y * w + x) * 4 + 3] < 140) continue;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
          if (y > h * 0.25 && y < h * 0.65) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
          }
        }
      if (x1 > x0 && y1 > y0) bbox = { x0: x0 / w, x1: (x1 + 1) / w, y0: y0 / h, y1: (y1 + 1) / h };
    } catch {
      // a tainted or undecoded image: keep the default box
    }
  }

  // The clean outline: one path per contour, left to right, tracing exactly the logo that fills.
  // Each contour starts a little after the one to its left, so the line writes the word.
  const outlinePaths = $$<SVGPathElement>("path", outline).map((p) => {
    const len = p.getTotalLength();
    p.style.strokeDasharray = `${len} ${len}`;
    p.style.strokeDashoffset = String(len);
    return { p, len, x: p.getBBox().x, start: 0 };
  });
  if (outlinePaths.length) {
    const xs = outlinePaths.map((o) => o.x);
    const xa = Math.min(...xs);
    const xb = Math.max(...xs);
    for (const o of outlinePaths) o.start = ((o.x - xa) / (xb - xa || 1)) * 0.4;
  }

  function layoutHero() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    const portrait = W / H < 0.9;
    warpA = portrait ? 0.5 : 0; // phones: drawing and rise take the first half, the dock gets the rest as Why Harbor rises in
    const ar = (houseImg.naturalWidth || 3) / (houseImg.naturalHeight || 2);
    const bw = Math.max(0.2, bbox.x1 - bbox.x0);
    const bh = Math.max(0.2, bbox.y1 - bbox.y0);
    // at rest the facade spans just under half a wide screen; a portrait screen crops in, centred on the doors
    houseW = (portrait ? W * 1.5 : W * 0.46) / bw;
    houseH = houseW / ar;
    if (!portrait && bh * houseH > H * 1.15) {
      houseH = (H * 1.15) / bh;
      houseW = houseH * ar;
    }
    logoW = portrait ? W * 0.86 : Math.min(W * 0.6, 980);
    logoH = logoW * LOGO_RATIO;
    logoTop = H * (portrait ? 0.42 : 0.37) - logoH / 2 + logoH * 0.1;
    const copyBottom = copy.offsetTop + copy.offsetHeight;
    // the roofline waits just below the logo, so HARBOR draws on open sky
    const roofY = Math.max(copyBottom + H * 0.035, logoTop + logoH + H * 0.012, H * (portrait ? 0.58 : 0.5));
    startY = roofY - bbox.y0 * houseH;
    const cx = (bbox.x0 + bbox.x1) / 2 - 0.5;
    xRest = -cx * houseW;
    // when it has risen, the facade fills the logo: windows behind the letters
    sL = portrait ? 1.1 : clamp((logoW * 1.1) / (houseW * bw), 1, 2.6);
    xEnd = -cx * houseW * sL;
    midY = logoTop + logoH * 0.5 - (bbox.y0 + bh * 0.42) * houseH * sL;
    stage.style.setProperty("--house-w", `${houseW}px`);
    stage.style.setProperty("--logo-w", `${logoW}px`);
    stage.style.setProperty("--logo-y", `${logoTop}px`);
    stage.style.setProperty("--logo-top", `${logoTop}px`);
    outline.style.setProperty("--ow", ((portrait ? 1.3 : 1.6) / (logoW / LOGO_UNITS)).toFixed(3));
    navH = nav.offsetHeight;
    // the dock: a single zoom about one fixed point lands the logo exactly on the nav logo
    const nr = nav.getBoundingClientRect();
    const lr = navLogoImg.getBoundingClientRect();
    dockS = lr.width / logoW;
    const fx = (lr.left - nr.left - (dockS * (W - logoW)) / 2) / (1 - dockS);
    const fy = (lr.top - nr.top - dockS * logoTop) / (1 - dockS);
    logo.style.transformOrigin = `${fx.toFixed(2)}px ${fy.toFixed(2)}px`;
    draw();
  }

  // desktop load-in: the copy settles and the street rises a little into place
  let introY = 0;
  let introO = shownByFallback ? 1 : 0;
  let introH = introO;

  function renderHero() {
    const p = warpA ? (hp < warpA ? hp * (0.72 / warpA) : 0.72 + (hp - warpA) * (0.28 / (1 - warpA))) : hp;
    // 1 · the headline clears and the nav logo steps aside; HARBOR draws itself on open sky
    const out = range(0, 0.12, p);
    const copyO = (1 - out) * introO;
    copy.style.opacity = String(copyO);
    copy.style.visibility = copyO < 0.02 ? "hidden" : ""; // no invisible, clickable button over the logo
    if (!lite) copy.style.filter = out > 0 ? `blur(${(out * 10).toFixed(2)}px)` : "none";
    copy.style.transform = `translateY(${-60 * range(0, 0.18, p) + (1 - introO) * 24}px)`;
    cue.style.opacity = String((1 - range(0, 0.05, p)) * introO);
    if (!lite) sky.style.transform = `scale(${1 + 0.05 * p})`;
    const drawP = range(0.08, 0.3, p);
    for (const o of outlinePaths) o.p.style.strokeDashoffset = String(o.len * (1 - ease(range(o.start, o.start + 0.6, drawP))));
    outline.style.opacity = String(drawP > 0 ? 1 - range(0.6, 0.7, p) : 0);

    // 2 · the townhouses rise into the outline; the facade fills the letters, then settles to solid teal
    const rise = ease(range(0.2, 0.56, p));
    const hy = lerp(startY, midY, rise) + introY;
    const hs = lerp(1, sL, rise);
    stage.style.setProperty("--house-x", `${lerp(xRest, xEnd, rise).toFixed(1)}px`);
    stage.style.setProperty("--house-y", `${hy}px`);
    stage.style.setProperty("--house-s", hs.toFixed(4));
    if (!lite) {
      // chimneys never sit under the nav links (a constant while far below it: no repaint); lite uses a fixed fade
      const fade = (navH + 10 - hy) / hs;
      house.style.setProperty("--fade", fade > -40 ? `${fade.toFixed(1)}px` : "-999px");
    }
    house.style.opacity = String((1 - ease(range(0.52, 0.64, p))) * introH);
    fillWrap.style.opacity = String(ease(range(0.44, 0.58, p)));
    solid.style.opacity = String(ease(range(0.6, 0.72, p)));
    // the mist drifts on its own (CSS); on scroll the front banks part and the back bank lifts away
    const part = ease(range(0, 0.32, p));
    const lift = ease(range(0, 0.45, p));
    if (mistL) mistL.style.transform = `translateX(${(-24 * part).toFixed(2)}%)`;
    if (mistR) mistR.style.transform = `translateX(${(24 * part).toFixed(2)}%)`;
    const frontO = String((1 - range(0.04, 0.3, p)) * introH);
    if (mistL) mistL.style.opacity = frontO;
    if (mistR) mistR.style.opacity = frontO;
    mistBack.style.transform = `translateY(${(-6 * lift).toFixed(2)}%) scale(${(1 + 0.06 * lift).toFixed(4)})`;
    mistBack.style.opacity = String((1 - range(0.12, 0.46, p)) * introH);

    // 3 · the street dissolves into cream as the letters turn solid, so the logo lands on the brand's own
    //     teal-on-cream; then it docks into the nav as Why Harbor arrives
    veil.style.opacity = String(ease(range(0.56, 0.72, p)));
    const dock = ease(range(0.84, 0.97, p));
    logo.style.transform = dock > 0 ? `scale(${Math.pow(dockS, dock).toFixed(5)})` : "";
    logo.style.opacity = p < 0.985 ? "1" : "0";
    const navO = p < 0.5 ? 1 - range(0.05, 0.12, p) : range(0.96, 0.985, p);
    navLogo.style.opacity = String(navO);
    navLogo.style.visibility = navO < 0.02 ? "hidden" : "";
  }

  /* Phones: the same story, played once by itself in one screen, under 3 seconds, nothing tied to the scroll.
     HARBOR writes itself on the sky, the street rises into place below it, the letters fill with teal,
     the logo flies into the nav, and the headline and button arrive. Touching or scrolling hurries it to the end. */
  const INTRO_END = 2.75;
  function renderIntro(t: number) {
    const k = (a: number, b: number) => range(a, b, t);
    const out3 = (x: number) => 1 - Math.pow(1 - x, 3);
    const drawP = k(0.1, 1.2);
    for (const o of outlinePaths) o.p.style.strokeDashoffset = String(o.len * (1 - ease(range(o.start, o.start + 0.6, drawP))));
    outline.style.opacity = String(drawP > 0 ? 1 - k(1.45, 1.75) : 0);
    stage.style.setProperty("--house-x", `${xRest.toFixed(1)}px`);
    stage.style.setProperty("--house-y", `${(startY + (1 - out3(k(0.5, 1.6))) * H * 0.42).toFixed(1)}px`);
    stage.style.setProperty("--house-s", "1");
    house.style.opacity = String(k(0.5, 0.9));
    const mist = String(k(0.7, 1.5));
    mistBack.style.opacity = mist;
    if (mistL) mistL.style.opacity = mist;
    if (mistR) mistR.style.opacity = mist;
    fillWrap.style.opacity = String(ease(k(1.1, 1.55)));
    solid.style.opacity = "1";
    veil.style.opacity = "0";
    const dock = ease(k(1.85, 2.45));
    logo.style.transform = dock > 0 ? `scale(${Math.pow(dockS, dock).toFixed(5)})` : "";
    logo.style.opacity = t < 2.45 ? "1" : "0";
    const navO = k(2.33, 2.47);
    navLogo.style.opacity = String(navO);
    navLogo.style.visibility = navO < 0.02 ? "hidden" : "";
    const c = out3(k(2.05, INTRO_END));
    copy.style.opacity = String(c);
    copy.style.visibility = c < 0.02 ? "hidden" : "";
    copy.style.transform = c < 1 ? `translateY(${((1 - c) * 26).toFixed(1)}px)` : "";
    cue.style.opacity = "0";
  }

  const ctx = gsap.context(() => {
    /* ---------------------------------------------------------------------
       8. Two-tone fills, scrubbed by scroll
       --------------------------------------------------------------------- */
    if (!lite)
      for (const { el, chars } of fills) {
        const dark = !!el.closest(".dark");
        const from = dark ? "#3C5558" : "#DADBD5";
        const heading = /^H\d$/.test(el.tagName);
        gsap.set(chars, { color: from });
        gsap.to(chars, {
          color: (_i: number, c: HTMLElement) => c.dataset.final ?? "",
          duration: 0.3,
          ease: "none",
          stagger: { each: 0.03 },
          scrollTrigger: {
            trigger: el,
            start: heading ? "top 88%" : "top 86%",
            end: heading ? "top 46%" : "bottom 58%",
            scrub: 0.6,
          },
        });
      }

    if (lite) {
      let speed = 1;
      let last = 0;
      let frame = 0;
      const hurryOn = ["touchstart", "wheel", "keydown", "pointerdown"];
      const stopHurry = () => {
        hurryOn.forEach((type) => removeEventListener(type, hurry));
        removeEventListener("scroll", onScroll);
      };
      const hurry = () => {
        speed = 6;
        stopHurry();
      };
      const onScroll = () => {
        if (scrollY > 4) hurry();
      };
      disposers.push(() => {
        stopHurry();
        cancelAnimationFrame(frame);
      });
      const tick = (now: number) => {
        if (disposed) return;
        introT = Math.min(INTRO_END, introT + (last ? (now - last) / 1000 : 0) * speed);
        last = now;
        renderIntro(introT);
        if (introT < INTRO_END) frame = requestAnimationFrame(tick);
        else stopHurry();
      };
      const play = () => {
        if (shownByFallback || scrollY > 4 || location.hash.length > 1) {
          // landed mid-page: no show
          introT = INTRO_END;
          draw();
          return;
        }
        hurryOn.forEach((type) => addEventListener(type, hurry, { passive: true }));
        addEventListener("scroll", onScroll, { passive: true });
        frame = requestAnimationFrame(tick);
      };
      navLogo.style.animation = "none"; // the script has the nav logo now (CSS only shows it if the script never runs)
      draw(); // the first frame: open sky
      const ready: Array<Promise<unknown>> = [
        houseImg.decode ? houseImg.decode().catch(() => undefined) : Promise.resolve(),
        document.fonts ? document.fonts.ready : Promise.resolve(),
      ];
      Promise.race([Promise.all(ready), new Promise((r) => window.setTimeout(r, 1200))]).then(() => {
        if (disposed) return;
        measureHouse();
        layoutHero();
        play();
      });
    } else {
      if (!shownByFallback)
        gsap.fromTo(
          { v: 0 },
          { v: 0 },
          {
            v: 1,
            duration: 1.6,
            ease: "power3.out",
            delay: 0.15,
            onStart() {
              introY = H * 0.08;
            },
            onUpdate(this: gsap.core.Tween) {
              const v = (this.targets()[0] as { v: number }).v;
              introY = H * 0.08 * (1 - v);
              introO = v;
              introH = Math.min(1, v * 1.6);
              renderHero();
            },
          }
        );
      ScrollTrigger.create({
        trigger: hero,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (st) => {
          hp = st.progress;
          renderHero();
        },
      });
    }

    /* ---------------------------------------------------------------------
       11. Room by room: gabled frames arrive one after another
       --------------------------------------------------------------------- */
    if (!lite) {
      gsap.fromTo(
        ".room",
        { xPercent: -40, opacity: 0 },
        {
          xPercent: 0,
          opacity: 1,
          ease: "none",
          stagger: 0.18,
          scrollTrigger: { trigger: "#roomsRow", start: "top 92%", end: "top 48%", scrub: true },
        }
      );
      gsap.fromTo(
        ".room img",
        { scale: 1.2 },
        { scale: 1.02, ease: "none", scrollTrigger: { trigger: "#roomsRow", start: "top bottom", end: "bottom top", scrub: true } }
      );

      /* ---------------------------------------------------------------------
         12. Our story: both pictures open up from the gap between them, the keys drift inside theirs
         --------------------------------------------------------------------- */
      for (const id of ["#originBig", "#originSmall"]) {
        gsap.fromTo(
          id,
          { "--o-inset": "16%", "--o-zoom": 1.16 },
          {
            "--o-inset": "0%",
            "--o-zoom": 1,
            ease: "none",
            scrollTrigger: { trigger: "#originBig", start: "top 96%", end: "top 30%", scrub: true },
          }
        );
      }
      gsap.fromTo(
        "#originSmall",
        { "--o-drift": "-5%" },
        { "--o-drift": "5%", ease: "none", scrollTrigger: { trigger: ".origin", start: "top bottom", end: "bottom top", scrub: true } }
      );

      /* ---------------------------------------------------------------------
         13. Services: the big words rise into their rows
         --------------------------------------------------------------------- */
      for (const row of $$(".svc__row")) {
        gsap.fromTo(
          $(".svc__word span", row),
          { yPercent: 70, opacity: 0 },
          { yPercent: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: row, start: "top 96%", end: "top 62%", scrub: true } }
        );
        gsap.fromTo(
          $(".svc__info", row),
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, ease: "none", scrollTrigger: { trigger: row, start: "top 92%", end: "top 70%", scrub: true } }
        );
      }
    }
  }, root);
  disposers.push(() => ctx.revert());

  /* ---------------------------------------------------------------------
     15. Layout
     --------------------------------------------------------------------- */
  const relayout = () => {
    if (disposed) return;
    layoutHero();
    measureNav();
    ScrollTrigger.refresh();
  };
  const onHouse = () => {
    measureHouse();
    relayout();
  };
  if (houseImg.complete) {
    measureHouse();
    layoutHero();
  }
  on(houseImg, "load", onHouse);
  let lastW = innerWidth;
  let relayoutTimer = 0;
  disposers.push(() => window.clearTimeout(relayoutTimer));
  on(window, "resize", () => {
    if (touch && innerWidth === lastW) return; // only the address bar moved: the hero is sized in svh, nothing to redo
    lastW = innerWidth;
    window.clearTimeout(relayoutTimer);
    relayoutTimer = window.setTimeout(relayout, 120);
  });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(relayout);

  return dispose;
}
