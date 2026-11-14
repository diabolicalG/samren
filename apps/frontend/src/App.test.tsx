import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { apiClient } from "@samren/api-client";

function renderApp(initialEntry = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("frontend foundation", () => {
  it("renders the home page and accessible primary navigation", () => {
    vi.spyOn(apiClient, "health").mockResolvedValue({
      status: "ok",
      service: "samren-api",
      timestamp: new Date().toISOString(),
    });

    renderApp();

    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /discover/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /my library/i })).toBeTruthy();
  });

  it("reports the API connection only after a successful health response", async () => {
    vi.spyOn(apiClient, "health").mockResolvedValue({
      status: "ok",
      service: "samren-api",
      timestamp: new Date().toISOString(),
    });

    renderApp();

    await waitFor(() => {
      expect(screen.getByRole("status", { name: "API status: connected" })).toBeTruthy();
    });
  });

  it("shows the honest not-yet-available browse state", () => {
    vi.spyOn(apiClient, "health").mockRejectedValue(new Error("offline"));

    renderApp("/browse");

    expect(screen.getByRole("heading", { name: "Browse" })).toBeTruthy();
    expect(screen.getByText(/application-owned catalogue arrives in phase 2/i)).toBeTruthy();
  });
});
