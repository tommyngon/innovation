/*
  toilet.js — screen #/toilet: a playful trio of big tiles.

    Pee       -> sends "toilet" with { need: "pee" }
    Poo       -> sends "toilet" with { need: "poo" }
    Need help -> sends "toilet" with { need: "help" }

  Each tap sends the request and shows the confirmation screen (#/sent).
  The nurse card shows the choice (see js/nurse.js detailsElement).
*/

import { createScreen, createTile, createTileGrid } from "../../js/ui.js";
import { iconNode } from "../../js/icons.js";

const CHOICES = [
  { need: "pee",  icon: "pee",  accent: "play-blue" },
  { need: "poo",  icon: "poo",  accent: "play-yellow" },
  { need: "help", icon: "help", accent: "play-coral" },
];

export function render(container, ctx) {
  const { root, body } = createScreen(ctx, { title: ctx.t("home.toilet") });
  const grid = createTileGrid("trio", { playful: true });

  for (const choice of CHOICES) {
    grid.append(createTile({
      icon: iconNode(choice.icon, { className: "tile-svg" }),
      label: ctx.t(`toilet.${choice.need}`),
      accent: choice.accent,
      onClick: () => {
        ctx.sendNotification({ type: "toilet", details: { need: choice.need } });
        ctx.navigate("#/sent");
      },
    }));
  }

  body.append(grid);
  container.append(root);
}
