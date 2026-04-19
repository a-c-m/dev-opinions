import { expect, test } from "@playwright/test";

test("renders the greeting and increments on click", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toHaveText("hello, base-app");

  const button = page.getByRole("button");
  await expect(button).toHaveText("clicked 0 times");

  await button.click();
  await button.click();
  await expect(button).toHaveText("clicked 2 times");
});
