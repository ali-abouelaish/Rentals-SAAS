"use client";

import { useState } from "react";

type SurfaceKey = "O" | "T";

const DATA: Record<
  SurfaceKey,
  {
    title: string;
    desc: string;
    list: [string, string][];
  }
> = {
  O: {
    title: "Operator back office",
    desc: "The full management surface. Every property decomposes to rooms. Margin, maintenance, tenants and renewals all tracked at the bedroom level.",
    list: [
      ["Rooms & tenancies", "47 active"],
      ["Bookings & reconciliation", "£41.8k / mo"],
      ["Maintenance tickets", "8 open"],
      ["Profitability & margin", "per room"],
    ],
  },
  T: {
    title: "Tenant self-serve",
    desc: "The surface actual tenants touch — scoped to their room, branded to your subdomain. Built around the two flows that used to leak out of operators' stacks.",
    list: [
      ["Online room booking", "apply · view · offer"],
      ["AI maintenance triage", "photo → category → vendor"],
      ["Rent & documents", "scoped to their room"],
      ["Messages", "with the property team"],
    ],
  },
};

export function WorkspaceToggle() {
  const [active, setActive] = useState<SurfaceKey>("O");
  const d = DATA[active];

  return (
    <>
      <div className="ws-toggle">
        <button
          type="button"
          className={active === "O" ? "active" : ""}
          data-ws="O"
          onClick={() => setActive("O")}
        >
          <span className="sw">O</span>Operator
        </button>
        <button
          type="button"
          className={active === "T" ? "active" : ""}
          data-ws="T"
          onClick={() => setActive("T")}
        >
          <span className="sw">T</span>Tenants
        </button>
      </div>

      <div className="ws-content">
        <div>
          <h5>{d.title}</h5>
          <p>{d.desc}</p>
        </div>
        <div>
          <ul>
            {d.list.map(([k, v]) => (
              <li key={k}>
                {k} <span className="mono">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
