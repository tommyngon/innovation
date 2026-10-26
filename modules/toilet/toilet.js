/*
  toilet.js — the toilet request. It has no screen of its own:
  opening #/toilet sends the notification straight away (one tap,
  no choices) and shows the confirmation screen.

  We use `replace: true` so the browser "back" button does not return
  to #/toilet (which would send the request again).
*/

export function render(container, ctx) {
  ctx.sendNotification({ type: "toilet", details: {} });
  ctx.navigate("#/sent", { replace: true });
}
