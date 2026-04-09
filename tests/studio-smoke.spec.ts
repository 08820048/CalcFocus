import { expect, test } from "@playwright/test";

const commandShortcut = "Control+K";
const saveShortcut = "Control+S";

test("loads the FluxLocus studio shell", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("FluxLocus");
  await expect(page.locator("header input")).toHaveValue("FluxLocus Demo Session");
  await expect(page.getByText("FluxLocus Studio").first()).toBeVisible();
  await expect(page.getByText("Realtime Flux Engine")).toBeVisible();
  await expect(page.getByText("Timeline", { exact: true })).toBeVisible();
  await expect(page.getByText("Movie 4K", { exact: true }).first()).toBeVisible();
});

test("opens the command palette and toggles focus mode", async ({ page }) => {
  await page.goto("/");
  await page.mouse.click(30, 30);

  await page.keyboard.press(commandShortcut);
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();

  await page.getByPlaceholder("Search commands, markers, and layout actions").fill("focus mode");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("dialog", { name: "Command palette" })).toHaveCount(0);
  await expect(page.locator("aside")).toHaveCount(0);

  await page.keyboard.press("Shift+F");
  await expect(page.locator("aside")).toHaveCount(2);
});

test("saves through the global shortcut", async ({ page }) => {
  await page.goto("/");
  await page.mouse.click(30, 30);

  await page.keyboard.press(saveShortcut);

  await expect(page.getByText(/Project state saved to/i)).toBeVisible();
  await expect(
    page.getByText("/tmp/fluxlocus-demo-session.fluxlocus", { exact: true }),
  ).toBeVisible();
});
