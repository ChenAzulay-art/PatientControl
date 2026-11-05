import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  it("renders the main heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: /to get started/i }),
    ).toBeInTheDocument();
  });

  it("links to the Next.js documentation", () => {
    render(<Home />);
    expect(
      screen.getByRole("link", { name: /documentation/i }),
    ).toHaveAttribute("href", expect.stringContaining("nextjs.org/docs"));
  });
});
