// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "../src/App";

afterEach(cleanup);

describe("OfferCheck UI", () => {
  it("renders the privacy and limitation statements", () => {
    render(<App />);
    expect(screen.getByText(/nothing you paste is sent/i)).toBeTruthy();
    expect(screen.getByText(/privacy & limitations/i)).toBeTruthy();
    expect(screen.getAllByText(/does not certify/i).length).toBeGreaterThan(0);
  });

  it("analyzes a suspicious offer and renders inert channels", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Synthetic scam" }));
    await userEvent.click(screen.getByRole("button", { name: "Analyze locally" }));

    const results = await screen.findByLabelText("Analysis results");
    expect(results.textContent).toMatch(/Stop/);
    expect(results.textContent).toMatch(/Lookalike/);

    // Channels in results must be inert text, never anchors.
    const channelSection = screen.getByText(/Channel provenance/).closest("div")!;
    expect(channelSection.querySelectorAll("a").length).toBe(0);
    expect(channelSection.querySelectorAll("code.channel-value").length).toBeGreaterThan(0);
  });

  it("shows the verification checklist after analysis", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Ambiguous" }));
    await userEvent.click(screen.getByRole("button", { name: "Analyze locally" }));
    expect(await screen.findByText(/Verify independently/)).toBeTruthy();
  });
});
