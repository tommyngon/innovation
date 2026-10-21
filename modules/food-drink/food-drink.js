/*
  food-drink.js — screen #/food-drink (level 1): a playful pair of tiles.

    Drink -> #/drink  (drink-menu.js: Water / Milk / Tea)
    Food  -> #/food   (food-menu.js: Snacks / Fruit / Yoghurt / Something else)

  Nothing is sent here; the request is sent on level 2. The 30-minute food
  limit (food-cooldown.js) is applied in food-menu.js.
*/

import { createScreen, createTile, createTileGrid } from "../../js/ui.js";
import { iconNode } from "../../js/icons.js";

export function render(container, ctx) {
  const { root, body } = createScreen(ctx, { title: ctx.t("foodDrink.title") });
  const grid = createTileGrid("pair", { playful: true });

  grid.append(
    createTile({
      icon: iconNode("drink", { className: "tile-svg" }),
      label: ctx.t("foodDrink.drink"),
      accent: "play-blue",
      onClick: () => ctx.navigate("#/drink"),
    }),
    createTile({
      icon: iconNode("food", { className: "tile-svg" }),
      label: ctx.t("foodDrink.food"),
      accent: "play-yellow",
      onClick: () => ctx.navigate("#/food"),
    }),
  );

  body.append(grid);
  container.append(root);
}
