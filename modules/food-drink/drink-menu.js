/*
  drink-menu.js — screen #/drink: Water / Milk / Tea (level 2 of Food & drink).

  Sends notification "drink" with { item: "water" | "milk" | "tea" }, then
  shows the confirmation. Drinks are never limited (only the normal 10 s
  double-tap protection in js/notifications.js).
*/

import { createScreen, createTile, createTileGrid } from "../../js/ui.js";
import { iconNode } from "../../js/icons.js";

const ITEMS = [
  { item: "water", accent: "play-blue" },
  { item: "milk",  accent: "play-pink" },
  { item: "tea",   accent: "play-yellow" },
];

export function render(container, ctx) {
  const { root, body } = createScreen(ctx, { title: ctx.t("foodDrink.drink"), backTo: "#/food-drink" });
  const grid = createTileGrid("trio", { playful: true });

  for (const { item, accent } of ITEMS) {
    grid.append(createTile({
      icon: iconNode(item, { className: "tile-svg" }),
      label: ctx.t(`drink.${item}`),
      accent,
      onClick: () => {
        ctx.sendNotification({ type: "drink", details: { item } });
        ctx.navigate("#/sent");
      },
    }));
  }

  body.append(grid);
  container.append(root);
}
