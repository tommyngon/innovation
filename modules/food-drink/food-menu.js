/*
  food-menu.js — screen #/food: Snacks / Fruit / Yoghurt / Something else
  (level 2 of Food & drink).

  Sends notification "food" with { item: "snacks" | "fruit" | "yoghurt" |
  "something" }, then shows the confirmation.

  Food can be asked once per 30 minutes (food-cooldown.js). Tapping a food
  tile again within that time sends NOTHING: a large green check "Food
  already requested at 12:40" appears near the top for a few seconds (and is
  spoken when voice assistance is on). The 30 minutes only start after a
  confirmed ONLINE delivery, so an offline attempt never blocks the next try.
*/

import { createScreen, createTile, createTileGrid, el } from "../../js/ui.js";
import { speak } from "../../js/voice.js";
import { iconNode } from "../../js/icons.js";
import { recentFoodRequest, rememberFoodRequest } from "./food-cooldown.js";

const NOTICE_MS = 5000;

const ITEMS = [
  { item: "snacks",    icon: "snack",   accent: "play-yellow" },
  { item: "fruit",     icon: "fruit",   accent: "play-mint" },
  { item: "yoghurt",   icon: "yoghurt", accent: "play-lilac" },
  { item: "something", icon: "more",    accent: "play-coral" },
];

let foodInFlight = false;      // a food request is being delivered right now
let noticeTimer = null;

export function render(container, ctx) {
  const { root, body } = createScreen(ctx, { title: ctx.t("foodDrink.food"), backTo: "#/food-drink" });
  const grid = createTileGrid("2x2", { playful: true });

  // "Food already requested": not a new request, so it must not look like "sent".
  const notice = el("div", { class: "already-notice", role: "status", "aria-live": "polite", hidden: true });

  function showAlreadyRequested(at) {
    const time = new Date(at).toLocaleTimeString(ctx.lang === "no" ? "nb" : ctx.lang, {
      hour: "2-digit",
      minute: "2-digit",
    });
    const text = ctx.t("food.alreadyRequested");
    const when = ctx.t("food.requestedAt", { time });
    notice.replaceChildren(
      el("span", { class: "already-notice-mark", "aria-hidden": "true" }, [iconNode("check")]),
      el("span", { class: "already-notice-text" }, [
        el("strong", {}, [text]),
        el("span", {}, [when]),
      ]),
    );
    notice.hidden = false;
    speak(`${text} ${when}`);
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.hidden = true; }, NOTICE_MS);
  }

  function requestFood(item) {
    const recent = recentFoodRequest(ctx.room, ctx.patient);
    if (recent !== null) {
      showAlreadyRequested(recent);
      return;
    }
    if (foodInFlight) return;            // second tap while the first is being sent
    foodInFlight = true;
    const requestedAt = Date.now();
    ctx.sendNotification({ type: "food", details: { item } })
      .then((outcome) => {
        // Only a request that really reached the nurse starts the 30 minutes.
        if (outcome.ok && outcome.mode === "online") rememberFoodRequest(ctx.room, ctx.patient, requestedAt);
      })
      .finally(() => { foodInFlight = false; });
    ctx.navigate("#/sent");
  }

  for (const { item, icon, accent } of ITEMS) {
    grid.append(createTile({
      icon: iconNode(icon, { className: "tile-svg" }),
      label: ctx.t(`food.${item}`),
      accent,
      onClick: () => requestFood(item),
    }));
  }

  body.append(grid);
  root.append(notice);
  container.append(root);
}

export function cleanup() {
  clearTimeout(noticeTimer);
  noticeTimer = null;
}
