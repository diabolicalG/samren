import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, Card, Dialog, Skeleton, TextField } from "./ui";

describe("Obsidian design primitives", () => {
  it("provides semantic card and button elements", () => {
    render(<Card aria-label="Feature card"><Button variant="primary">Continue</Button></Card>);
    expect(screen.getByRole("article", { name: "Feature card" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
  });

  it("associates form labels and hint text with their input", () => {
    render(<TextField id="email" label="Email address" hint="Used for account sign-in" type="email" />);
    const input = screen.getByRole("textbox", { name: "Email address" });
    expect(input.getAttribute("aria-describedby")).toBe("email-hint");
    expect(screen.getByText("Used for account sign-in")).toBeTruthy();
  });

  it("exposes loading and dialog states accessibly", () => {
    render(<><Skeleton label="Loading catalogue" /><Dialog open title="Confirm action"><p>Continue?</p></Dialog></>);
    expect(screen.getByRole("status", { name: "Loading catalogue" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Confirm action" })).toBeTruthy();
  });
});
