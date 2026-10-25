import { Pill, cssVars } from "../icons";

const ROOM_PHOTOS = [
  { slot: "room-1", alt: "A tenant by the window of her room" },
  { slot: "room-2", alt: "A bright bedroom in a London house share" },
  { slot: "room-3", alt: "A shared living room in the evening" },
  { slot: "room-4", alt: "A tenant in the shared kitchen" },
];

/** "It isn't about properties. It's about rooms.": four gabled room photos. */
export function Rooms() {
  return (
    <section className="rooms" aria-labelledby="rooms-title">
      <div className="wrap">
        <h2 className="rooms__title" id="rooms-title" data-fill>
          <span className="t1">It isn’t about properties.</span> <span className="t2">It’s about rooms.</span>
        </h2>
        <div className="rooms__row" id="roomsRow">
          {ROOM_PHOTOS.map((photo) => (
            <div className="room media" key={photo.slot}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                data-slot={photo.slot}
                src={`/site/ai/${photo.slot}.webp?v=20261007b`}
                width={1122}
                height={1402}
                alt={photo.alt}
                loading="lazy"
                decoding="async"
              />
            </div>
          ))}
        </div>
        <p className="rooms__text" data-fill>
          <span className="t1">Every room has its own price, status, tenant and tenancy.</span>{" "}
          <span className="t2">Occupancy, rent roll, vacancy loss, arrears and profit all add up from the rooms.</span>
        </p>
      </div>
    </section>
  );
}

const STEPS: Array<[string, string]> = [
  ["Every room tracked on its own.", "Price, status, availability date, tenant and tenancy, room by room."],
  ["One system, start to finish.", "Applications, bookings, contracts, rent, deposits, notice and move-out. Nothing re-keyed."],
  ["Deposit protection built in.", "Register and protect deposits, download prescribed information and handle repayments in Harbor."],
  ["Certificates that chase their own renewals.", "Eight certificate types per property. Red when expired, amber 30 days before."],
  [
    "An AI assistant that knows your portfolio.",
    "Ask it anything, like who’s late with rent this month, and get the answer from your own data. It also triages repairs and works out an acquisition’s break-even.",
  ],
];

/** "One system. Enquiry to deposit return.": what's built in. */
export function System() {
  return (
    <section className="system" id="product" aria-labelledby="system-title">
      <div className="wrap grid">
        <div className="system__head">
          <h2 className="system__title" id="system-title" data-fill>
            <span className="t1">One system.</span>
            <br />
            <span className="t2">Enquiry to deposit return.</span>
          </h2>
          <Pill href="/signup">Request a demo</Pill>
        </div>
        <div>
          <p className="steps__label">What’s built in:</p>
          <ol className="steps">
            {STEPS.map(([lead, rest], i) => (
              <li className="step" key={lead}>
                <span className="step__n">{String(i + 1).padStart(2, "0")}</span>
                <p data-fill>
                  <span className="t1">{lead}</span> <span className="t2">{rest}</span>
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/** "Harbor works while you're out": one card, one phone, three stories that play through on their own. */
export function Away() {
  return (
    <section className="away" id="assist" aria-labelledby="assist-title">
      <div className="wrap">
        <div className="away__head">
          <p className="label">Built in</p>
          <h2 className="away__title" id="assist-title" data-fill>
            <span className="t1">Harbor works</span> <span className="t2">while you’re out.</span>
          </h2>
        </div>
        <div className="away__card" id="away">
          <div className="away__side">
            <div className="away__tabs" role="tablist" aria-label="What Harbor does while you’re out">
              <button type="button" role="tab" id="away-t1" aria-controls="away-p1" aria-selected="true">
                <i />
                <span>Reminders</span>
              </button>
              <button type="button" role="tab" id="away-t2" aria-controls="away-p2" aria-selected="false" tabIndex={-1}>
                <i />
                <span>AI assistant</span>
              </button>
              <button type="button" role="tab" id="away-t3" aria-controls="away-p3" aria-selected="false" tabIndex={-1}>
                <i />
                <span>On the go</span>
              </button>
            </div>
            <div className="away__words">
              <p className="away__line" id="away-p1" role="tabpanel" aria-labelledby="away-t1">
                <span className="t1">Reminders send themselves.</span>{" "}
                <span className="t2">To your team or your tenants, whenever something is due.</span>
              </p>
              <p className="away__line" id="away-p2" role="tabpanel" aria-labelledby="away-t2" hidden>
                <span className="t1">Ask Harbor anything.</span> <span className="t2">Like who’s late paying rent.</span>
              </p>
              <p className="away__line" id="away-p3" role="tabpanel" aria-labelledby="away-t3" hidden>
                <span className="t1">Your portfolio, in your pocket.</span> <span className="t2">Check everything on the go.</span>
              </p>
            </div>
          </div>
          <div className="away__device" aria-hidden="true">
            <div className="device">
              <div className="device__screen">
                {/* 1 · the lock screen: Harbor's emails arrive */}
                <div className="scr scr--lock is-on">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="scr__sky" src="/site/street/sky-p-1080.webp?v=brand1" alt="" loading="lazy" decoding="async" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="scr__house" src="/site/street/street-house-1400.webp?v=brand1" alt="" loading="lazy" decoding="async" />
                  <p className="lock__date" style={cssVars({ "--d": 0 })}>
                    Monday 2 November
                  </p>
                  <p className="lock__time" style={cssVars({ "--d": 0 })}>
                    08:00
                  </p>
                  <div className="note" style={cssVars({ "--d": 1 })}>
                    <i className="note__app">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/site/brand/harbor-emblem-sage.svg" alt="" />
                    </i>
                    <div>
                      <p className="note__top">
                        <b>Harbor</b>
                        <span>now</span>
                      </p>
                      <p className="note__title">Rent overview</p>
                      <p className="note__body">38 paid, 2 due this week, 1 overdue.</p>
                    </div>
                  </div>
                  <div className="note" style={cssVars({ "--d": 2 })}>
                    <i className="note__app">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/site/brand/harbor-emblem-sage.svg" alt="" />
                    </i>
                    <div>
                      <p className="note__top">
                        <b>Harbor</b>
                        <span>now</span>
                      </p>
                      <p className="note__title">Certificate renewal due</p>
                      <p className="note__body">The Gas Safety certificate for House B expires in 30 days.</p>
                    </div>
                  </div>
                </div>
                {/* 2 · the assistant */}
                <div className="scr scr--ask">
                  <p className="app__bar" style={cssVars({ "--d": 0 })}>
                    <span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/site/brand/harbor-emblem-teal.svg" alt="" />
                      Ask Harbor
                    </span>
                  </p>
                  <p className="ask__q" style={cssVars({ "--d": 1 })}>
                    Who’s late paying rent?
                  </p>
                  <div className="ask__a" style={cssVars({ "--d": 2 })}>
                    <p className="ask__lead">
                      <i />2 tenants are late
                    </p>
                    <p>
                      <span>Room 2 · House A</span>
                      <b>12 days</b>
                    </p>
                    <p>
                      <span>Room 5 · House B</span>
                      <b>6 days</b>
                    </p>
                  </div>
                  <p className="ask__input" style={cssVars({ "--d": 3 })}>
                    Ask anything about your portfolio
                    <i />
                  </p>
                </div>
                {/* 3 · home, on the go */}
                <div className="scr scr--home">
                  <p className="app__bar" style={cssVars({ "--d": 0 })}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="app__logo" src="/site/brand/harbor-logo-teal.svg" alt="" />
                    <i className="app__me" />
                  </p>
                  <p className="home__hi" style={cssVars({ "--d": 1 })}>
                    Good morning
                  </p>
                  <div className="home__tiles" style={cssVars({ "--d": 2 })}>
                    <p>
                      <b>46/48</b>Rooms let
                    </p>
                    <p>
                      <b>3</b>Rent due this week
                    </p>
                    <p>
                      <b>2</b>Certificates due
                    </p>
                    <p>
                      <b>4</b>Open repairs
                    </p>
                  </div>
                  <div className="home__rooms" style={cssVars({ "--d": 3 })}>
                    <p>
                      <span>Room 3 · House A</span>
                      <em className="is-free">Free 1 Nov</em>
                    </p>
                    <p>
                      <span>Room 6 · House B</span>
                      <em className="is-notice">Notice given</em>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="away__eg">Example screens</p>
      </div>
    </section>
  );
}
