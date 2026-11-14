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

    vi.spyOn(apiClient, "catalogAnime").mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 6, totalItems: 0, totalPages: 0 } });

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

    vi.spyOn(apiClient, "catalogAnime").mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 6, totalItems: 0, totalPages: 0 } });

    renderApp();

    await waitFor(() => {
      expect(screen.getByRole("status", { name: "API status: connected" })).toBeTruthy();
    });
  });

  it("renders the database-backed browse filters and catalogue empty state", async () => {
    vi.spyOn(apiClient, "health").mockRejectedValue(new Error("offline"));
    vi.spyOn(apiClient, "catalogGenres").mockResolvedValue([]);
    vi.spyOn(apiClient, "catalogStudios").mockResolvedValue([]);
    vi.spyOn(apiClient, "catalogAnime").mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 24, totalItems: 0, totalPages: 0 },
    });

    renderApp("/browse");

    expect(screen.getByRole("heading", { name: /browse the catalogue/i })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Search titles" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText(/no titles match those filters/i)).toBeTruthy();
    });
  });
});

describe("administrator workspace", () => {
  it("shows a secure sign-in form when no session exists", async () => {
    vi.spyOn(apiClient, "health").mockRejectedValue(new Error("offline"));
    vi.spyOn(apiClient, "authSession").mockRejectedValue(new Error("Authentication is required"));

    renderApp("/admin");

    expect(await screen.findByRole("heading", { name: /administrator sign in/i })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Email address" })).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
  });

  it("loads the protected catalogue manager for an administrator", async () => {
    vi.spyOn(apiClient, "health").mockRejectedValue(new Error("offline"));
    vi.spyOn(apiClient, "authSession").mockResolvedValue({
      user: { id: "admin-1", email: "admin@samren.test", username: "admin", role: "ADMIN" },
    });
    vi.spyOn(apiClient, "adminCatalogAnime").mockResolvedValue({ items: [] });

    renderApp("/admin");

    expect(await screen.findByRole("heading", { name: /catalogue management/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /create a catalogue draft/i })).toBeTruthy();
    expect(await screen.findByText(/no catalogue records exist yet/i)).toBeTruthy();
  });

  it("does not render catalogue write controls for a regular user", async () => {
    vi.spyOn(apiClient, "health").mockRejectedValue(new Error("offline"));
    vi.spyOn(apiClient, "authSession").mockResolvedValue({
      user: { id: "user-1", email: "user@samren.test", username: "user", role: "USER" },
    });

    renderApp("/admin");

    expect(await screen.findByRole("heading", { name: /administrator access required/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /create draft/i })).toBeNull();
  });
});
