import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Page } from "../components/layout/Page";

describe("Page", () => {
  it.each([
    ["full", "page-width-full"],
    ["wide", "page-width-wide"],
    ["content", "page-width-content"],
    ["narrow", "page-width-narrow"],
  ] as const)("uses the %s width class", (width, widthClass) => {
    render(
      <Page width={width}>
        <h1>Page content</h1>
      </Page>,
    );

    const page = screen.getByRole("heading", {
      name: "Page content",
    }).parentElement;
    expect(page).toHaveClass("page-container", widthClass);
  });

  it("sets the shared responsive page gutter", () => {
    const { container } = render(<Page>Content</Page>);

    const page = container.firstElementChild;
    expect(page).toHaveStyle({ "--page-gutter": "clamp(16px, 4vw, 48px)" });
  });
});
