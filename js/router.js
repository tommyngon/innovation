/*
  router.js — hash router: maps "#/something" to a screen module.

  We use hash URLs (index.html#/pain) because GitHub Pages cannot handle
  normal routes like /pain (it would give a 404).

  TO ADD A SCREEN: add ONE line to `routes` below. The module must export
      render(container, ctx)   draw the screen into `container`
      cleanup()                (optional) stop timers / remove listeners
*/

const routes = {
  "#/home":       () => import("../modules/home/home.js"),
  "#/toilet":     () => import("../modules/toilet/toilet.js"),
  "#/food-drink": () => import("../modules/food-drink/food-drink.js"),
  "#/drink":      () => import("../modules/food-drink/drink-menu.js"),
  "#/food":       () => import("../modules/food-drink/food-menu.js"),
  "#/pain":       () => import("../modules/pain/pain.js"),
  "#/speech":     () => import("../modules/speech/speech.js"),
  "#/sent":       () => import("../modules/sent/sent.js"),
};

// Old links keep working: general symptoms are now on the pain screen.
const redirects = {
  "#/symptoms": "#/pain",
};

const DEFAULT_ROUTE = "#/home";

let currentModule = null;
let renderCount = 0;   // protects against a slow screen finishing after a newer one

/**
 * Go to another screen.
 *   navigate("#/pain")
 *   navigate("#/sent", { replace: true })  // replace history entry (no "back" to it)
 */
export function navigate(hash, { replace = false } = {}) {
  if (replace) {
    location.replace(hash);
  } else {
    location.hash = hash;
  }
}

/** Start listening to hash changes and render the first screen. */
export function startRouter(container, ctx) {
  window.addEventListener("hashchange", () => showRoute(container, ctx));
  showRoute(container, ctx);
  // Load the confirmation screen now: if the network drops later, it must
  // still be able to show the offline warning after a request.
  routes["#/sent"]().catch((error) => console.warn("[router] could not preload #/sent", error));
}

async function showRoute(container, ctx) {
  const hash = location.hash;
  if (redirects[hash]) {
    navigate(redirects[hash], { replace: true });
    return;
  }
  if (!routes[hash]) {
    // Unknown or empty hash -> home. This fires "hashchange" again,
    // which then renders the home screen. (replace = no extra history entry)
    navigate(DEFAULT_ROUTE, { replace: true });
    return;
  }

  const thisRender = ++renderCount;
  let module;
  try {
    module = await routes[hash]();
  } catch (error) {
    console.error(`[router] could not load screen for ${hash}`, error);
    return;
  }
  if (thisRender !== renderCount) return;   // user already went somewhere else

  // Clean up the previous screen, then draw the new one.
  try {
    currentModule?.cleanup?.();
  } catch (error) {
    console.error("[router] cleanup failed", error);
  }
  container.replaceChildren();
  container.scrollTop = 0;
  currentModule = module;
  module.render(container, ctx);
}
