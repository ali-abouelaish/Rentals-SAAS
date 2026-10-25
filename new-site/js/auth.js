/* Harbor Ops — sign-in and demo request ("The front door").
   Validation, password reveal, Caps Lock warning, and the door's moments:
   signing in swings the door open onto the hallway; the demo card goes through the letterbox.

   Forms marked data-preview aren't wired to the app yet:
   - on a local preview (localhost, file://) they act out the real states, so the design can be reviewed.
     Sign-in opens the door; type the password "wrong" to see the error instead;
   - anywhere else they say plainly that they aren't connected and link to the live page. They never fake a success.
   When the app takes these pages over, remove data-preview and connect the form the way the current pages are
   (field names already match: email, password, stay_signed_in / first_name, last_name, email, company,
   portfolio_size, goal, terms), then call HarborDoor.openDoor() / HarborDoor.postCard() when the app says it worked. */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const local = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.test$/.test(location.hostname);

  /* ---------- The knocker swings when you knock ---------- */
  const knocker = $('.knocker');
  knocker?.addEventListener('click', () => {
    knocker.classList.remove('is-knocking'); void knocker.offsetWidth; knocker.classList.add('is-knocking');
  });

  const form = $('form[data-auth]');
  if (!form) return;
  const kind = form.dataset.auth;
  const alertBox = $('#formAlert');
  const status = $('#formStatus');
  const submit = $('.submit', form);
  const submitLabel = $('.submit__label', submit);
  const idleLabel = submitLabel.textContent;

  /* ---------- Rules and messages ---------- */
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const messages = {
    first_name: 'Enter your first name',
    last_name: 'Enter your last name',
    email: v => v ? 'Enter an email address like name@agency.co.uk' : 'Enter your work email',
    company: 'Enter your company name',
    portfolio_size: 'Choose the size of your portfolio',
    password: 'Enter your password',
    terms: 'Tick the box to agree to the terms and privacy policy',
  };

  // every validated control: text inputs by name, plus the radio group and the consent box
  const controls = $$('input[required], textarea[required]', form).filter(el => el.type !== 'radio')
    .concat($$('[data-group]', form));

  function valueOf(el) {
    if (el.dataset.group) return $$(`input[name="${el.dataset.group}"]`, form).some(r => r.checked) ? 'x' : '';
    if (el.type === 'checkbox') return el.checked ? 'x' : '';
    return el.value.trim();
  }
  function problem(el) {
    const name = el.dataset.group || el.name, v = valueOf(el);
    if (name === 'email') return v && EMAIL.test(v) ? '' : messages.email(v);
    return v ? '' : messages[name];
  }
  function errorEl(el) { return $(`#${el.dataset.group || el.id}-error`); }
  function describe(el, errId, on) {
    const ids = (el.getAttribute('aria-describedby') || '').split(' ').filter(Boolean).filter(id => id !== errId);
    if (on) ids.push(errId);
    ids.length ? el.setAttribute('aria-describedby', ids.join(' ')) : el.removeAttribute('aria-describedby');
  }
  function setError(el, msg) {
    const err = errorEl(el);
    err.textContent = msg || ''; err.hidden = !msg;
    msg ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid');
    // a radio group's message is read with each of its options
    (el.dataset.group ? $$(`input[name="${el.dataset.group}"]`, form) : [el]).forEach(t => describe(t, err.id, !!msg));
  }
  function check(el) { const msg = problem(el); setError(el, msg); return !msg; }

  // check a field when someone leaves it after typing, and clear the message as soon as it's fixed
  controls.forEach(el => {
    const inputs = el.dataset.group ? $$(`input[name="${el.dataset.group}"]`, form) : [el];
    inputs.forEach(i => {
      i.addEventListener('input', () => { el.dataset.touched = '1'; if (el.getAttribute('aria-invalid')) check(el); });
      i.addEventListener('change', () => { el.dataset.touched = '1'; if (el.getAttribute('aria-invalid') || el.dataset.group || el.type === 'checkbox') check(el); });
      i.addEventListener('blur', () => { if (el.dataset.touched && !el.dataset.group && el.type !== 'checkbox') check(el); });
    });
  });

  /* ---------- Password: show / hide, and a Caps Lock warning ---------- */
  $$('.reveal', form).forEach(btn => {
    const input = $(`#${btn.getAttribute('aria-controls')}`);
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      input.focus({ preventScroll: true });
    });
  });
  const caps = $('#capsHint'), pw = $('input[type="password"]', form);
  if (caps && pw) {
    const update = e => { if (e.getModifierState) caps.hidden = !e.getModifierState('CapsLock'); };
    pw.addEventListener('keydown', update); pw.addEventListener('keyup', update);
    pw.addEventListener('blur', () => { caps.hidden = true; });
  }

  /* ---------- Messages ---------- */
  function say(text) { status.textContent = ''; setTimeout(() => { status.textContent = text; }, 30); }
  function showAlert(html) {
    alertBox.innerHTML = `<p>${html}</p>`;   // only ever our own fixed strings
    alertBox.hidden = false;
  }
  function busy(on) {
    submit.setAttribute('aria-busy', String(on));
    submit.disabled = on;
    submitLabel.textContent = on ? (kind === 'login' ? 'Signing in…' : 'Posting…') : idleLabel;
  }
  const notConnected = {
    login: 'This sign-in page isn’t connected yet. Please sign in at <a href="https://www.harborops.co.uk/login">harborops.co.uk/login</a>.',
    signup: 'This form isn’t connected yet. Please request a demo at <a href="https://www.harborops.co.uk/signup">harborops.co.uk/signup</a>.',
  };

  /* ---------- Signed in: the door swings open onto the hallway ---------- */
  const welcome = $('#welcome');
  function openDoor() {
    welcome.hidden = false; void welcome.offsetWidth;
    document.body.classList.add('is-open');
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    setTimeout(() => $('#closeDoor')?.focus({ preventScroll: true }), reduce ? 700 : 2000);
  }
  $('#closeDoor')?.addEventListener('click', () => {   // preview only: shut the door again
    document.body.classList.remove('is-open');
    setTimeout(() => { welcome.hidden = true; }, 600);
    busy(false); pw.value = '';
    setTimeout(() => pw.focus({ preventScroll: true }), reduce ? 600 : 1800);
  });

  /* ---------- Demo request: the card goes through the letterbox ---------- */
  async function postCard() {
    const card = $('.card'), box = $('.letterbox');
    box.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    await wait(reduce ? 60 : 750);
    if (!reduce) {
      // turn the card over to its picture side, like a postcard
      const turn = 'perspective(1600px) rotateY(';
      await card.animate([{ transform: 'none' }, { transform: `${turn}90deg)` }], { duration: 300, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' }).finished;
      card.classList.add('is-sealed');
      await card.animate([{ transform: `${turn}-90deg)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.1,.5,.4,1)', fill: 'forwards' }).finished;
      await wait(280);
      const c = card.getBoundingClientRect(), b = box.getBoundingClientRect();
      const s = (b.width * .70 * .9) / c.width;                 // the slot is 70% of the plate's width
      const dx = (b.left + b.width * .482) - (c.left + c.width / 2);
      const dy = (b.top + b.height * .27) - (c.top + c.height * s);   // card's bottom edge on the slot's top edge
      const at = `translate(${dx}px, ${dy}px) scale(${s})`;
      await card.animate([{ transform: 'none' }, { transform: at }], { duration: 950, easing: 'cubic-bezier(.6,.04,.22,1)', fill: 'forwards' }).finished;
      box.classList.add('is-open');
      await wait(230);
      await card.animate([
        { transform: at, clipPath: 'inset(0 0 0 0)' },
        { transform: `translate(${dx}px, ${dy + c.height * s}px) scale(${s})`, clipPath: 'inset(0 0 100% 0)' },
      ], { duration: 700, easing: 'cubic-bezier(.45,0,.75,.4)', fill: 'forwards' }).finished;
      box.classList.remove('is-open'); box.classList.add('is-clacking');
      setTimeout(() => box.classList.remove('is-clacking'), 400);
    }
    card.hidden = true;
    const done = $('#done');
    $('#doneName').textContent = $('#su-first').value.trim();
    $('#doneEmail').textContent = $('#su-email').value.trim();
    done.hidden = false;
    done.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    done.focus({ preventScroll: true });
  }

  window.HarborDoor = { openDoor, postCard };   // for the app: play the moment once a submission succeeds

  /* ---------- Submit ---------- */
  form.addEventListener('submit', e => {
    alertBox.hidden = true;
    const bad = controls.filter(el => !check(el));
    if (bad.length) {
      e.preventDefault();
      const first = bad[0].dataset.group ? $(`input[name="${bad[0].dataset.group}"]`, form) : bad[0];
      first.focus();
      say(bad.length === 1 ? 'One answer needs attention.' : `${bad.length} answers need attention.`);
      return;
    }
    if (!form.hasAttribute('data-preview')) return;   // connected: the app handles the submission
    e.preventDefault();
    if (!local) { showAlert(notConnected[kind]); alertBox.focus(); return; }

    // local preview: act out what the app will do
    busy(true);
    setTimeout(() => {
      if (kind === 'login') {
        if (pw.value === 'wrong') {
          busy(false);
          showAlert('That email and password don’t match. Try again, or <a href="https://www.harborops.co.uk/forgot-password">reset your password</a>.');
          const plate = $('.plate'); plate.classList.remove('is-rattling'); void plate.offsetWidth; plate.classList.add('is-rattling');
          pw.value = ''; pw.focus();
        } else {
          openDoor();
        }
      } else {
        postCard();
      }
    }, 900);
  });
})();
