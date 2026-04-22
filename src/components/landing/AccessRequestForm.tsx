"use client";

import { useState, FormEvent } from "react";

export function AccessRequestForm() {
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <form onSubmit={onSubmit}>
      <input
        className="input"
        type="email"
        placeholder="operator@company.co.uk"
        required
      />
      <button className="btn btn-primary btn-lg" type="submit" disabled={submitted}>
        {submitted ? "Request received ✓" : "Request demo"}
      </button>
    </form>
  );
}
