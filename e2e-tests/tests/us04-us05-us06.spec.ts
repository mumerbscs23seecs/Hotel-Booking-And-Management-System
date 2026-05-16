import { test, expect } from "@playwright/test";
import path from "path";

const UI_URL = "http://localhost:5174/";

// Generate a unique suffix for hotel names so repeated test runs don't conflict
const TEST_SUFFIX = Date.now().toString().slice(-6);

/**
 * Helper: signs in with the standard test account before each test.
 * Credentials match the seeded test user (1@1.com / password123).
 *
 * The app stores a JWT token in localStorage after login, and the
 * React Query `validateToken` cache must be updated before the
 * `isLoggedIn` flag flips to true in the UI.  We therefore:
 *   1. Navigate to the home page.
 *   2. Click the "Log In" nav button (visible when logged out).
 *   3. Fill credentials and submit.
 *   4. Wait for the "Log In" button to disappear from the header —
 *      this proves the API call succeeded, React Query has refreshed,
 *      and `isLoggedIn` is true (protected routes are registered).
 */
async function signIn(page: any) {
  await page.goto(UI_URL);

  // Click the Log In nav button (the actual button text is "Log In")
  await page.getByRole("link", { name: "Log In" }).click();

  // Wait for the sign-in form to appear
  await expect(
    page.getByRole("heading", { name: "Welcome Back" })
  ).toBeVisible({ timeout: 10000 });

  // Fill credentials
  await page.locator("[name=email]").fill("1@1.com");
  await page.locator("[name=password]").fill("password123");

  // Submit — the form button text is "Sign In"
  await page.getByRole("button", { name: "Sign In" }).click();

  // Wait for the authenticated UI to settle — the "Log In" button
  // is replaced by UsernameMenu (avatar dropdown) when isLoggedIn is true.
  // This is the most reliable signal: it means the JWT token was stored,
  // validateToken succeeded, and the protected routes are registered.
  // We don't check the toast because it can disappear quickly or fail
  // under parallel test load.
  await expect(
    page.getByRole("link", { name: "Log In" })
  ).not.toBeVisible({ timeout: 30000 });
}

/**
 * Helper: navigates to the Add Hotel page using in-app navigation.
 *
 * After page.goto() the React app re-initializes and during the
 * validateToken loading phase isLoggedIn is false, which means
 * protected routes (/add-hotel) are not registered and the URL
 * redirects to "/". To avoid this, we navigate via the My Hotels page
 * which always exists, then click the "Add Hotel" link which uses
 * React Router's client-side navigation preserving auth state.
 */
async function navigateToAddHotel(page: any) {
  await page.goto(`${UI_URL}my-hotels`);

  // Wait for the page to be authenticated — hotel cards or Add Hotel link
  // My Hotels shows either hotel cards or "Add Your First Hotel" when logged in.
  // When not logged in, it shows "Sign In to View My Hotels".
  // We wait for the Add Hotel link which only appears when authenticated.
  await expect(
    page.getByRole("link", { name: "Add Hotel" }).first()
  ).toBeVisible({ timeout: 20000 });

  // Click the "Add Hotel" link — this uses client-side routing
  await page.getByRole("link", { name: "Add Hotel" }).first().click();

  // Wait for the form to be ready
  await page.waitForSelector('[name="name"]', { state: "visible", timeout: 15000 });
}

// =============================================================================
// US-04: Add New Hotel
// As an admin, I want to add hotels with complete details so the system always
// has up-to-date records.
// =============================================================================
test.describe("US-04: Add New Hotel", () => {
  test.setTimeout(120000);
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  /**
   * AC1: Admin can create a hotel with required fields — name, location,
   *       description, facilities, and number of rooms.
   * AC3: Newly added hotels appear immediately in the hotel listings.
   */
  test("AC1 & AC3: should save a complete hotel and show it immediately in My Hotels", async ({
    page,
  }) => {
    await navigateToAddHotel(page);

    // ── Required fields ──────────────────────────────────────────────────────
    await page.locator('[name="name"]').fill(`Silk Route Grand Hotel ${TEST_SUFFIX}`);
    await page.locator('[name="city"]').fill("Islamabad");
    await page.locator('[name="country"]').fill("Pakistan");
    await page
      .locator('textarea[name="description"]')
      .fill("A luxury hotel on the historic Silk Route with stunning views.");
    await page.locator('[name="pricePerNight"]').fill("150");
    await page.selectOption('select[name="starRating"]', "4");

    // Select a hotel type
    await page.getByText("Luxury").click();

    // Select at least one facility
    await page.getByLabel("Free WiFi").check();
    await page.getByLabel("Parking").check();

    // Guest capacity (number of rooms proxy)
    await page.locator('[name="adultCount"]').fill("3");
    await page.locator('[name="childCount"]').fill("2");

    // Upload at least one image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      path.join(__dirname, "files", "1.png"),
      path.join(__dirname, "files", "2.png"),
    ]);

    await page.getByRole("button", { name: "Save" }).click();

    // AC1 verification: success toast confirms hotel was saved
    await expect(page.getByText("Hotel Added Successfully").first()).toBeVisible({
      timeout: 30000,
    });

    // AC3 verification: navigate to My Hotels and confirm the new hotel is listed
    await page.getByRole("link", { name: "My Hotels" }).first().click();
    await expect(
      page.locator('[data-testid="hotel-card"]').first()
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(`Silk Route Grand Hotel ${TEST_SUFFIX}`).first()).toBeVisible({
      timeout: 20000,
    });
  });

  /**
   * AC2: Required fields cannot be left empty — validation catches this
   *       before submission.
   * AC4: Incorrect or missing inputs are flagged with clear error messages.
   */
  test("AC2 & AC4: should block submission and show error messages when all required fields are empty", async ({
    page,
  }) => {
    await navigateToAddHotel(page);

    // Submit the form without filling anything
    await page.getByRole("button", { name: "Save" }).click();

    // The form must NOT navigate away — we should still be on add-hotel
    await expect(page).toHaveURL(/add-hotel/);

    // AC4: at least one "This field is required" error must be visible
    await expect(
      page.getByText("This field is required").first()
    ).toBeVisible();

    // Spot-check individual field errors
    const nameError = page
      .locator("label")
      .filter({ hasText: /^Name/ })
      .locator("span.text-red-500");
    await expect(nameError).toContainText("This field is required");

    const cityError = page
      .locator("label")
      .filter({ hasText: /^City/ })
      .locator("span.text-red-500");
    await expect(cityError).toContainText("This field is required");

    const countryError = page
      .locator("label")
      .filter({ hasText: /^Country/ })
      .locator("span.text-red-500");
    await expect(countryError).toContainText("This field is required");
  });

  /**
   * AC4: Each individual required field shows its own clear error message.
   *       (Partial fill — only name given; all others remain empty.)
   */
  test("AC4: should show individual field errors for each empty required field when partially filled", async ({
    page,
  }) => {
    await navigateToAddHotel(page);

    // Fill only the name; leave everything else blank
    await page.locator('[name="name"]').fill("Partial Hotel");

    await page.getByRole("button", { name: "Save" }).click();

    // City, country, description errors must appear
    await expect(page.getByText("This field is required").first()).toBeVisible();

    // Description error
    const descriptionError = page
      .locator("label")
      .filter({ hasText: /Description/ })
      .locator("span.text-red-500");
    await expect(descriptionError).toContainText("This field is required");

    // Facilities-specific validation message
    await expect(
      page.getByText("At least one facility is required")
    ).toBeVisible();

    // No success toast should appear
    await expect(
      page.getByText("Hotel Added Successfully")
    ).not.toBeVisible();
  });
});

// =============================================================================
// US-05: View Hotel Listings
// As an admin, I want to see all hotels in a well-structured list so I can
// manage them easily.
// =============================================================================
test.describe("US-05: View Hotel Listings", () => {
  test.setTimeout(120000);
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  /**
   * AC1: Hotels are displayed in a clean table or list.
   * AC2: Each hotel entry shows key details — name, location, and current status.
   */
  test("AC1 & AC2: should display hotels in a structured list with name, location, type, and price", async ({
    page,
  }) => {
    await page.goto(`${UI_URL}my-hotels`);

    // AC1: At least one hotel card must be rendered
    const hotelCards = page.locator('[data-testid="hotel-card"]');
    await expect(hotelCards.first()).toBeVisible({ timeout: 20000 });

    // AC2: The seeded "Dublin Getaways" card must show its key details
    await expect(page.getByText(/Dublin Getaways/).first()).toBeVisible();

    // Location (might be Cork if US-06 previously failed to revert its edit)
    await expect(page.getByText(/(Dublin|Cork), Ireland/).first()).toBeVisible();

    // Price (current status of the listing)
    await expect(page.getByText("£119 per night")).toBeVisible();

    // Guest capacity
    await expect(page.getByText("2 adults, 3 children")).toBeVisible();

    // The Add Hotel button must be present on the listings page
    await expect(
      page.getByRole("link", { name: "Add Hotel" })
    ).toBeVisible();
  });

  /**
   * AC3: Clicking a hotel opens a detailed view page.
   */
  test("AC3: should open a hotel detail page when View Details is clicked", async ({
    page,
  }) => {
    await page.goto(`${UI_URL}my-hotels`);

    // Wait for hotel cards to load
    await expect(
      page.locator('[data-testid="hotel-card"]').first()
    ).toBeVisible({ timeout: 20000 });

    // Click the first "View Details" link
    await page.getByRole("link", { name: "View Details" }).first().click();

    // URL must change to /detail/ and show the booking action
    await expect(page).toHaveURL(/\/detail\//, { timeout: 10000 });
    await expect(
      page.getByRole("button", { name: "Book now" })
    ).toBeVisible({ timeout: 15000 });
  });

  /**
   * AC4: The list refreshes automatically when new hotels are added.
   */
  test("AC4: should show a newly added hotel in the list without a manual page refresh", async ({
    page,
  }) => {
    // Add a brand-new hotel
    await navigateToAddHotel(page);

    await page.locator('[name="name"]').fill(`Fresh Listing Hotel ${TEST_SUFFIX}`);
    await page.locator('[name="city"]').fill("Karachi");
    await page.locator('[name="country"]').fill("Pakistan");
    await page
      .locator('textarea[name="description"]')
      .fill("Automated test hotel for US-05 listing refresh check.");
    await page.locator('[name="pricePerNight"]').fill("80");
    await page.selectOption('select[name="starRating"]', "3");
    await page.getByText("Budget").click();
    await page.getByLabel("Free WiFi").check();
    await page.locator('[name="adultCount"]').fill("2");
    await page.locator('[name="childCount"]').fill("1");
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      path.join(__dirname, "files", "1.png"),
    ]);

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Hotel Added Successfully").first()).toBeVisible({
      timeout: 30000,
    });

    // AC4 verification: the listing page shows the new hotel after redirect
    await page.getByRole("link", { name: "My Hotels" }).first().click();
    await expect(
      page.locator('[data-testid="hotel-card"]').first()
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(`Fresh Listing Hotel ${TEST_SUFFIX}`).first()).toBeVisible({
      timeout: 20000,
    });
  });
});

// =============================================================================
// US-06: Edit Hotel Information
// As an admin, I want to update hotel details so the information always stays
// accurate.
// =============================================================================
test.describe("US-06: Edit Hotel Information", () => {
  test.setTimeout(120000);
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  /**
   * AC1: Admin can edit a hotel's details from its detail page.
   * AC2: Changes are saved immediately and reflected across the system.
   */
  test("AC1 & AC2: should update hotel name and reflect the change in My Hotels listing", async ({
    page,
  }) => {
    await page.goto(`${UI_URL}my-hotels`);

    // Wait for hotel cards to load
    await expect(
      page.locator('[data-testid="hotel-card"]').first()
    ).toBeVisible({ timeout: 20000 });

    // AC1: Open edit form via the Edit Hotel button
    await page.getByRole("link", { name: "Edit Hotel" }).first().click();
    await expect(page).toHaveURL(/\/edit-hotel\//, { timeout: 10000 });

    // Confirm existing data is pre-populated
    await page.waitForSelector('[name="name"]', { state: "attached", timeout: 15000 });
    await expect(page.locator('[name="name"]')).not.toHaveValue("", { timeout: 15000 });

    // Read the current name so we can restore it later
    const originalName = await page.locator('[name="name"]').inputValue();

    // Edit the name
    await page.locator('[name="name"]').fill("Dublin Getaways UPDATED");
    await page.getByRole("button", { name: "Save" }).click();

    // AC2: success toast confirms the save
    await expect(page.getByText("Hotel Updated Successfully").first()).toBeVisible({
      timeout: 30000,
    });

    // AC2: navigate to My Hotels and verify the updated name is reflected
    // Use client-side navigation by clicking "My Hotels" in the nav
    await page.getByRole("link", { name: "My Hotels" }).first().click();
    await expect(
      page.locator('[data-testid="hotel-card"]').first()
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Dublin Getaways UPDATED")).toBeVisible({
      timeout: 15000,
    });

    // ── Teardown: restore original name so other tests are not affected ──────
    await page.getByRole("link", { name: "Edit Hotel" }).first().click();
    await page.waitForSelector('[name="name"]', { state: "attached", timeout: 15000 });
    await expect(page.locator('[name="name"]')).not.toHaveValue("", { timeout: 15000 });
    await page.locator('[name="name"]').fill(originalName || "Dublin Getaways");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Hotel Updated Successfully").first()).toBeVisible({
      timeout: 30000,
    });
  });

  /**
   * AC3: Validation prevents required fields from being cleared on save.
   */
  test("AC3: should show a validation error and stay on edit page when required field is cleared", async ({
    page,
  }) => {
    await page.goto(`${UI_URL}my-hotels`);

    // Wait for hotel cards to load
    await expect(
      page.locator('[data-testid="hotel-card"]').first()
    ).toBeVisible({ timeout: 20000 });

    await page.getByRole("link", { name: "Edit Hotel" }).first().click();
    await expect(page).toHaveURL(/\/edit-hotel\//, { timeout: 10000 });
    await page.waitForSelector('[name="name"]', { state: "attached", timeout: 15000 });
    await expect(page.locator('[name="name"]')).not.toHaveValue("", { timeout: 15000 });

    // Clear the required Name field
    await page.locator('[name="name"]').fill("");

    await page.getByRole("button", { name: "Save" }).click();

    // AC3 verification: validation error must appear
    await expect(
      page.getByText("This field is required").first()
    ).toBeVisible();

    // The form must NOT submit — we must remain on the edit page
    await expect(page).toHaveURL(/\/edit-hotel\//);

    // No success toast should appear
    await expect(
      page.getByText("Hotel Updated Successfully")
    ).not.toBeVisible();
  });

  /**
   * AC2 extended: Editing multiple fields (city + description) persists
   *               and is reflected when the edit form is re-opened.
   */
  test("AC2: should save updated city and description and reflect them when the form is re-opened", async ({
    page,
  }) => {
    await page.goto(`${UI_URL}my-hotels`);

    // Wait for hotel cards to load
    await expect(
      page.locator('[data-testid="hotel-card"]').first()
    ).toBeVisible({ timeout: 20000 });

    await page.getByRole("link", { name: "Edit Hotel" }).first().click();
    await expect(page).toHaveURL(/\/edit-hotel\//, { timeout: 10000 });
    await page.waitForSelector('[name="city"]', { state: "attached", timeout: 15000 });
    await expect(page.locator('[name="city"]')).not.toHaveValue("", { timeout: 15000 });

    // Save original values for teardown
    const originalCity = await page.locator('[name="city"]').inputValue();
    const originalDescription = await page.locator('textarea[name="description"]').inputValue();

    // Update city and description
    await page.locator('[name="city"]').fill("Cork");
    await page
      .locator('textarea[name="description"]')
      .fill("Updated description — hotel now based in Cork.");

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Hotel Updated Successfully").first()).toBeVisible({
      timeout: 30000,
    });

    // Re-open the edit form and verify the changes were persisted
    // Use client-side navigation
    await page.getByRole("link", { name: "My Hotels" }).first().click();
    await expect(
      page.locator('[data-testid="hotel-card"]').first()
    ).toBeVisible({ timeout: 20000 });

    await page.getByRole("link", { name: "Edit Hotel" }).first().click();
    await page.waitForSelector('[name="city"]', { state: "attached", timeout: 15000 });
    await expect(page.locator('[name="city"]')).not.toHaveValue("", { timeout: 15000 });

    await expect(page.locator('[name="city"]')).toHaveValue("Cork");
    await expect(page.locator('textarea[name="description"]')).toHaveValue(
      "Updated description — hotel now based in Cork."
    );

    // ── Teardown: restore original values ────────────────────────────────────
    await page.locator('[name="city"]').fill(originalCity || "Dublin");
    await page
      .locator('textarea[name="description"]')
      .fill(originalDescription || "Lorem ipsum dolor sit amet");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Hotel Updated Successfully").first()).toBeVisible({
      timeout: 30000,
    });
  });
});
