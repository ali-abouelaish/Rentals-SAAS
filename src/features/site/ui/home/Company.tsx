import { Pill } from "../icons";

/**
 * Our story: a developer who worked in property and built what it was missing. Three rows on the
 * site grid: label | title, keys | aerial (the same height), and the story under the aerial.
 */
export function Story() {
  return (
    <section className="origin" id="story" aria-labelledby="story-title">
      <div className="wrap grid">
        <h2 className="label">Our story</h2>
        <h2 className="origin__title" id="story-title" data-fill>
          <span className="t1">Built by someone who&rsquo;s done the job.</span> <span className="t2">Not by a remote product team.</span>
        </h2>
        <div className="origin__small media" id="originSmall">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-slot="origin-keys"
            src="/site/ai/origin-keys.webp?v=20261007b"
            width={1086}
            height={1448}
            alt="House keys held up in front of a deep teal front door"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="origin__big media" id="originBig">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-slot="origin-aerial"
            src="/site/ai/origin-aerial.webp?v=20261007b"
            width={1672}
            height={941}
            alt="London rooftops with the City skyline in the distance"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="origin__spacer" aria-hidden="true" />
        <div>
          <p className="origin__text" data-fill>
            <span className="t1">
              I&rsquo;m a software developer who spent a year working in real estate, and saw how far its tools had fallen behind the job.
            </span>{" "}
            <span className="t2">So rather than wait for someone else to fix it, I built Harbor.</span>
          </p>
          <Pill href="/signup">Request a demo</Pill>
        </div>
      </div>
    </section>
  );
}

const SERVICES: Array<[string, string]> = [
  ["Enquiries from Zoopla and other property portals arrive in one inbox, ready to work.", "Leads"],
  ["Each room has its own price, status, availability date, tenant and tenancy. Portfolio figures add up from the rooms.", "Rooms"],
  [
    "Upload a statement from Barclays, HSBC, Lloyds, NatWest or Santander, or any CSV or PDF. Payments are matched to expected rent and mismatches are flagged.",
    "Rent",
  ],
  [
    "Register and protect deposits with the approved schemes, download prescribed information and handle repayments without leaving Harbor.",
    "Deposits",
  ],
  ["Gas Safety, EICR, EPC, HMO licence and four more, per property. Red when expired, amber 30 days before.", "Compliance"],
  [
    "Run every portfolio from one place, with monthly profit and loss for each, including what empty rooms cost you between lets.",
    "Profit",
  ],
];

/** "How Harbor runs your rooms": the deep section, big words rising into their rows. */
export function Services() {
  return (
    <section className="services dark" aria-labelledby="svc-title">
      <div className="wrap">
        <div className="grid">
          <h2 className="label">What it does</h2>
          <h2 className="services__title" id="svc-title" data-fill>
            <span className="t1">How Harbor</span> <span className="t2">runs your rooms.</span>
          </h2>
        </div>
        <ol className="svc">
          {SERVICES.map(([text, word], i) => (
            <li className="svc__row grid" key={word}>
              <div className="svc__info">
                <span className="svc__n">{i + 1}</span>
                <p>{text}</p>
              </div>
              <p className="svc__word">
                <span>{word}</span>
              </p>
            </li>
          ))}
        </ol>
        <div className="services__close grid">
          <div />
          <div>
            <p data-fill>
              <span className="t1">Every room, every payment, every certificate.</span>{" "}
              <span className="t2">Backed by a 24/7 help desk.</span>
            </p>
            <Pill href="/signup" tone="line">
              Request a demo
            </Pill>
          </div>
        </div>
      </div>
    </section>
  );
}
