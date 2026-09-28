import { useMemo, useState } from "react";
import {
  analyzeOffer,
  BAND_HINTS,
  type AnalysisResult,
  type AnalyzeInput,
  type Channel,
  type Signal,
} from "./analysis";
import { SAMPLE_CASES } from "./data/cases";
import "./App.css";

const EMPTY_INPUT: AnalyzeInput = {
  organization: "",
  claimedDomain: "",
  senderEmail: "",
  offerText: "",
};

const KIND_LABELS: Record<Channel["kind"], string> = {
  sender: "Sender",
  email: "Email",
  link: "Link",
  phone: "Phone",
  chat: "Chat",
  payment: "Payment",
};

const VERDICT_LABELS: Record<Channel["verdict"], string> = {
  official: "Official",
  unrelated: "Unrelated",
  lookalike: "Lookalike",
  unverifiable: "Unverifiable",
};

function HighlightedText({ text, signals }: { text: string; signals: Signal[] }) {
  const parts = useMemo(() => {
    const spans = signals
      .flatMap((s) => s.evidence.map((e) => ({ ...e, severity: s.severity })))
      .sort((a, b) => a.start - b.start || b.end - a.end);
    const merged: typeof spans = [];
    for (const s of spans) {
      const last = merged[merged.length - 1];
      if (last && s.start < last.end) {
        last.end = Math.max(last.end, s.end);
        if (last.severity !== "high" && s.severity === "high") last.severity = "high";
      } else {
        merged.push({ ...s });
      }
    }
    const out: { key: number; text: string; sev: string | null }[] = [];
    let cursor = 0;
    merged.forEach((s, i) => {
      if (s.start > cursor) out.push({ key: i * 2, text: text.slice(cursor, s.start), sev: null });
      out.push({ key: i * 2 + 1, text: text.slice(s.start, s.end), sev: s.severity });
      cursor = s.end;
    });
    if (cursor < text.length) out.push({ key: -1, text: text.slice(cursor), sev: null });
    return out;
  }, [text, signals]);

  return (
    <pre className="offer-text">
      {parts.map((p) =>
        p.sev ? (
          <mark key={p.key} className={`hl-${p.sev}`}>
            {p.text}
          </mark>
        ) : (
          <span key={p.key}>{p.text}</span>
        ),
      )}
    </pre>
  );
}

function ChannelMap({ channels }: { channels: Channel[] }) {
  return (
    <ul className="channel-list">
      {channels.map((c, i) => (
        <li key={i} className={`channel v-${c.verdict}`}>
          <span className="channel-kind">{KIND_LABELS[c.kind]}</span>
          <code className="channel-value">{c.value}</code>
          <span className={`verdict verdict-${c.verdict}`}>{VERDICT_LABELS[c.verdict]}</span>
          <span className="channel-reason">{c.reason}</span>
        </li>
      ))}
    </ul>
  );
}

function Results({ result, offerText }: { result: AnalysisResult; offerText: string }) {
  return (
    <section className="results" aria-live="polite" aria-label="Analysis results">
      <div className={`band band-${result.band}`}>
        <span className="band-label">{result.bandLabel}</span>
        <span className="band-score" aria-label={`Risk score ${result.score} out of 100`}>
          {result.score}/100
        </span>
      </div>
      <p className="band-hint">{BAND_HINTS[result.band]}</p>
      <p className="summary">{result.summary}</p>

      {result.channels.length > 0 && (
        <div className="card">
          <h3>Channel provenance — who controls each contact?</h3>
          <p className="note">
            Every way the offer asks you to reply, pay, or continue — labeled against the claimed
            organization. Nothing here is clickable.
          </p>
          <ChannelMap channels={result.channels} />
        </div>
      )}

      {offerText.trim() && (
        <div className="card">
          <h3>Offer text with evidence highlighted</h3>
          <HighlightedText text={offerText} signals={result.signals} />
        </div>
      )}

      {result.signals.length > 0 && (
        <div className="card">
          <h3>Findings ({result.signals.length})</h3>
          <ul className="signal-list">
            {result.signals.map((s) => (
              <li key={s.id} className={`signal sev-${s.severity}`}>
                <div className="signal-head">
                  <span className={`sev-tag sev-tag-${s.severity}`}>{s.severity}</span>
                  <strong>{s.title}</strong>
                  <span className="weight">+{s.weight}</span>
                </div>
                <p>{s.detail}</p>
                {s.evidence.length > 0 && (
                  <ul className="evidence-list">
                    {s.evidence.slice(0, 4).map((e, i) => (
                      <li key={i}>
                        <code>{e.text.length > 90 ? e.text.slice(0, 90) + "…" : e.text}</code>
                      </li>
                    ))}
                    {s.evidence.length > 4 && <li>+{s.evidence.length - 4} more</li>}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card checklist">
        <h3>Verify independently — without touching the offer's channels</h3>
        <ol>
          {result.verifyPath.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default function App() {
  const [input, setInput] = useState<AnalyzeInput>(EMPTY_INPUT);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const set =
    (k: keyof AnalyzeInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setInput((p) => ({ ...p, [k]: e.target.value }));

  const analyze = () => setResult(analyzeOffer(input));
  const loadCase = (id: string) => {
    const c = SAMPLE_CASES.find((s) => s.id === id);
    if (c) {
      const { organization, claimedDomain, senderEmail, offerText } = c;
      setInput({ organization, claimedDomain, senderEmail, offerText });
      setResult(null);
    }
  };

  return (
    <div className="page">
      <header className="hero">
        <h1>OfferCheck</h1>
        <p className="tagline">
          Every offer scam hands you its own "verification" contacts. OfferCheck shows which
          channels the claimed institution actually controls — then a way to check the offer that
          the sender can't intercept.
        </p>
        <p className="privacy-badge">
          Runs 100% in your browser. Nothing you paste is sent, logged, or stored anywhere.
        </p>
      </header>

      <main>
        <section className="story card">
          <h2>Why this exists</h2>
          <p>
            Fake internship and scholarship offers target students with the most to lose — and
            first-generation students often navigate them alone. This is not a generic scam
            detector: OfferCheck maps the provenance of every contact channel in the offer
            (sender, links, phone, chat, payment) against the institution it claims to be from,
            flags the stages scam scripts use, and produces a verification path that never touches
            a channel the sender supplied. It labels what it can prove — and says so when it can't.
          </p>
        </section>

        <div className="samples" role="group" aria-label="Load a sample case">
          <span className="samples-label">Try a sample:</span>
          {SAMPLE_CASES.map((c) => (
            <button
              key={c.id}
              className="chip chip-case"
              onClick={() => loadCase(c.id)}
              title={c.blurb}
            >
              {c.label}
            </button>
          ))}
        </div>

        <section className="form card" aria-label="Offer details">
          <div className="field-row">
            <label>
              Claimed organization
              <input
                type="text"
                value={input.organization}
                onChange={set("organization")}
                placeholder="e.g. Meridian Dynamics"
                autoComplete="off"
              />
            </label>
            <label>
              Claimed domain
              <input
                type="text"
                value={input.claimedDomain}
                onChange={set("claimedDomain")}
                placeholder="e.g. meridiandynamics.com"
                autoComplete="off"
                inputMode="url"
              />
            </label>
            <label>
              Sender address (optional)
              <input
                type="text"
                value={input.senderEmail}
                onChange={set("senderEmail")}
                placeholder="e.g. hr@company-careers.net"
                autoComplete="off"
                inputMode="email"
              />
            </label>
          </div>
          <label>
            Offer text
            <textarea
              value={input.offerText}
              onChange={set("offerText")}
              rows={10}
              placeholder="Paste the offer email or message here…"
            />
          </label>
          <button className="analyze-btn" onClick={analyze}>
            Analyze locally
          </button>
        </section>

        {result && <Results result={result} offerText={input.offerText} />}

        <section className="card limitations">
          <h2>Privacy &amp; limitations</h2>
          <ul>
            <li>All analysis runs locally in this page. No pasted text is transmitted or stored.</li>
            <li>
              Channels extracted from offers are shown as inert text. OfferCheck never opens,
              fetches, or resolves them — a strict Content-Security-Policy blocks outbound
              connections entirely.
            </li>
            <li>
              "Official" only means a domain matches the one you claimed — it does not certify that
              an offer is legitimate, and a high score does not prove a scam.
            </li>
            <li>Domain matching is best-effort and does not use the full Public Suffix List.</li>
            <li>
              A few senders may sit on an affiliated institutional domain verified from the
              institution's own directory. Affiliation explains the domain — it is not proof
              the address is genuine.
            </li>
          </ul>
        </section>
      </main>

      <footer>
        <p>
          OfferCheck — a solo submission for 305 HackShells, September 2026 Session B. Sources:{" "}
          <a href="https://reportfraud.ftc.gov" rel="noreferrer">
            FTC fraud reporting
          </a>
          ,{" "}
          <a href="https://consumer.ftc.gov/articles/job-scams" rel="noreferrer">
            FTC job-scam guidance
          </a>
          ,{" "}
          <a href="https://www.ic3.gov" rel="noreferrer">
            FBI IC3
          </a>
          . Built with AI assistance (Devin); see README for disclosure.
        </p>
      </footer>
    </div>
  );
}
