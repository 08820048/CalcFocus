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
  await page.getByRole("button", { name: /Enter focus mode|Exit focus mode/ }).click();

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
    page.getByText("/tmp/fluxlocus-demo-session.fluxlocus", { exact: true }).last(),
  ).toBeVisible();
});

test("resumes and reopens a saved recent project", async ({ page }) => {
  await page.goto("/");
  await page.mouse.click(30, 30);
  await page.keyboard.press(saveShortcut);

  await expect(
    page.getByText("/tmp/fluxlocus-demo-session.fluxlocus", { exact: true }).last(),
  ).toBeVisible();

  await page.reload();

  await expect(page.locator("header input")).toHaveValue("FluxLocus Demo Session");
  await expect(page.getByText("Recent Projects")).toBeVisible();

  const systemAudioToggle = page.getByRole("button", { name: /System audio/ });
  await expect(systemAudioToggle).toHaveAttribute("aria-pressed", "true");
  await systemAudioToggle.click();
  await expect(systemAudioToggle).toHaveAttribute("aria-pressed", "false");

  await page.getByRole("button", { name: /FluxLocus Demo Session/ }).click();

  await expect(systemAudioToggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Opened FluxLocus Demo Session/)).toBeVisible();
});

test("records live cursor movement into editable project data", async ({ page }) => {
  await page.goto("/");

  const mainBox = await page.locator("main").boundingBox();
  if (!mainBox) {
    throw new Error("Main layout is not measurable.");
  }

  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.mouse.move(mainBox.x + mainBox.width * 0.44, mainBox.y + mainBox.height * 0.26, {
    steps: 6,
  });
  await page.mouse.click(mainBox.x + mainBox.width * 0.55, mainBox.y + mainBox.height * 0.38);
  await page.mouse.move(mainBox.x + mainBox.width * 0.65, mainBox.y + mainBox.height * 0.52, {
    steps: 10,
  });
  await page.getByRole("button", { name: "Stop", exact: true }).click();

  await expect(page.getByText(/Captured \d+ cursor samples over/i)).toBeVisible();
  await expect(page.getByText(/Live cursor recording captured/i)).toBeVisible();
  await expect(page.getByText(/Click emphasis/i).first()).toBeVisible();
});
