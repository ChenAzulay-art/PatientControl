import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageSwitcher } from "./language-switcher";

const pathname = vi.hoisted(() => ({ current: "/he/login" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    pathname.current = "/he/login";
  });

  it("links to the same page in English from Hebrew", () => {
    render(<LanguageSwitcher current="he" label="English" />);
    expect(screen.getByRole("link", { name: /english/i })).toHaveAttribute(
      "href",
      "/en/login",
    );
  });

  it("links to the same page in Hebrew from English", () => {
    pathname.current = "/en/settings";
    render(<LanguageSwitcher current="en" label="עברית" />);
    expect(screen.getByRole("link", { name: /עברית/ })).toHaveAttribute(
      "href",
      "/he/settings",
    );
  });

  it("marks the link with the target language", () => {
    render(<LanguageSwitcher current="he" label="English" />);
    expect(screen.getByRole("link")).toHaveAttribute("lang", "en");
  });
});
