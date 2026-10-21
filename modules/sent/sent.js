/*
  sent.js — confirmation screen shown after every request (#/sent).

  Waits for the result of the last send (normally a fraction of a second)
  and shows "Sending…" meanwhile. Then:
    online   ✅ + icon + "The nurse has been notified"
    local    ⚠ + icon + "Sent in offline demo mode: only visible on this
             device", in a clearly different warning style. A patient must
             never believe a request reached the nurse when it did not.
    duplicate (same request < 10 s ago): "Already sent, the nurse is on the way"
  Goes back to home automatically after a visible countdown.
  Voice assistance says the outcome; the offline case is a clearly
  different warning ("Warning. Your request did NOT reach the nurse…").
*/

import { el } from "../../js/ui.js";
import { speak } from "../../js/voice.js";
import { typeIconNode } from "../../js/icons.js";

const AUTO_RETURN_SECONDS = 6;
const WARNING_RETURN_SECONDS = 12;   // more time to read the warning

let timer = null;
let renderToken = 0;

export function render(container, ctx) {
  const token = ++renderToken;
  const result = ctx.getLastResult();          // null if the page was reloaded on #/sent

  const mark = el("span", {}, [result && !result.duplicate ? "⏳" : "✅"]);
  const message = el("h1", { class: "sent-message", role: "status" }, [
    !result ? ctx.t("sent.notified")
      : result.duplicate ? ctx.t("sent.alreadySent")
      : ctx.t("sent.sending"),
  ]);
  const hint = el("p", { class: "sent-hint", hidden: true });
  const countdown = el("p", { class: "sent-countdown", "aria-live": "polite" });
  const section = el("section", { class: "sent" }, [
    el("div", { class: "sent-icons icon", "aria-hidden": "true" }, [
      mark,
      result && result.type !== "pain"
        ? el("span", {}, [typeIconNode(result.type)])
        : null,
    ]),
    message,
    hint,
    el("button", {
      class: "big-button",
      type: "button",
      "aria-label": ctx.t("sent.backToStart"),
      onClick: () => ctx.navigate("#/home"),
    }, [ctx.t("sent.backToStart")]),
    countdown,
  ]);
  container.append(section);

  if (!result || result.duplicate) {
    if (result) speak(ctx.t("sent.alreadySent"), { queue: true });
    startCountdown(ctx, countdown, AUTO_RETURN_SECONDS);
    return;
  }

  section.classList.add("sent--sending");
  result.done.then((outcome) => {
    if (token !== renderToken) return;          // user already left this screen
    section.classList.remove("sent--sending");
    if (outcome.mode === "online") {
      mark.textContent = "✅";
      message.textContent = ctx.t("sent.notified");
      speak(ctx.t("sent.notified"), { queue: true });   // after "Water", "Toilet", …
      startCountdown(ctx, countdown, AUTO_RETURN_SECONDS);
    } else {
      section.classList.add("sent--local");
      mark.textContent = "⚠️";
      message.textContent = ctx.t("sent.localMode");
      hint.textContent = ctx.t("sent.localModeHint");
      hint.hidden = false;
      speak(ctx.t("voice.offlineWarning"));             // replaces anything else
      startCountdown(ctx, countdown, WARNING_RETURN_SECONDS);
    }
  });
}

export function cleanup() {
  renderToken += 1;
  clearInterval(timer);
  timer = null;
}

function startCountdown(ctx, countdown, seconds) {
  let secondsLeft = seconds;
  countdown.textContent = ctx.t("sent.countdown", { s: secondsLeft });
  timer = setInterval(() => {
    secondsLeft -= 1;
    if (secondsLeft <= 0) {
      ctx.navigate("#/home");
    } else {
      countdown.textContent = ctx.t("sent.countdown", { s: secondsLeft });
    }
  }, 1000);
}
