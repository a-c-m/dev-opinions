import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./app.js";

describe("App", () => {
  it("renders the default greeting", () => {
    render(<App />);
    expect(screen.getByRole("heading")).toHaveTextContent("hello, base-app");
  });

  it("renders a custom greeting", () => {
    render(<App greeting="hi" />);
    expect(screen.getByRole("heading")).toHaveTextContent("hi, base-app");
  });

  it("increments the click count", async () => {
    const user = userEvent.setup();
    render(<App />);
    const button = screen.getByRole("button");
    await user.click(button);
    await user.click(button);
    expect(button).toHaveTextContent("clicked 2 times");
  });
});
