// ------------------------------------------------------------------
// Utility helpers
// ------------------------------------------------------------------
const $ = (selector) => document.querySelector(selector);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatTime = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

// ------------------------------------------------------------------
// State machine (trafficSystem)
// ------------------------------------------------------------------
const trafficSystem = {
  // Intersection states: "green" | "yellow" | "red"
  intersections: {
    ns: { name: "North–South", state: "green" },
    ew: { name: "East–West", state: "red" },
  },
  isTransitioning: false, // ensures we don't start a second transition while one is already running
  pendingSwitch: false, // if user requests a switch during transition, we enqueue one
  logs: [],
  lastTransition: "Never",
};

// ------------------------------------------------------------------
// updateUI(): Render the UI based on trafficSystem state
// ------------------------------------------------------------------
function updateUI() {
  // CONTROL FLOW: Called whenever the state changes. This function is synchronous
  // and runs on the main thread (UI thread). It uses querySelector and classList
  // to update DOM state without rebuilding the whole tree.

  const currentStateLabel = $("#currentState");
  const pendingLabel = $("#pendingState");
  const transitionLabel = $("#lastTransition");

  const nsState = trafficSystem.intersections.ns.state;
  const ewState = trafficSystem.intersections.ew.state;

  currentStateLabel.textContent = `NS: ${nsState.toUpperCase()} / EW: ${ewState.toUpperCase()}`;
  pendingLabel.textContent = trafficSystem.pendingSwitch ? "Queued" : "None";
  transitionLabel.textContent = trafficSystem.lastTransition;
  $("#footerTime").textContent = formatTime();

  // Update traffic light visuals
  ["ns", "ew"].forEach((dir) => {
    const light = $(`.traffic-light[data-direction="${dir}"]`);
    if (!light) return;
    const state = trafficSystem.intersections[dir].state;

    // For each lamp, toggle the "active" class depending on state.
    light.querySelectorAll(".lamp").forEach((lamp) => {
      const lampType = lamp.dataset.light;
      lamp.classList.toggle("active", lampType === state);
    });
  });
}

// ------------------------------------------------------------------
// logEvent(): Append a system log and update the log list
// ------------------------------------------------------------------
function logEvent(message) {
  // The event loop will execute this function synchronously. It must be fast
  // so the UI doesn't drop frames. We create a small log array and trim it.
  const timestamp = formatTime();
  const entry = `${timestamp} — ${message}`;
  trafficSystem.logs.unshift(entry);
  trafficSystem.logs = trafficSystem.logs.slice(0, 25);

  const list = $("#logList");
  list.innerHTML = trafficSystem.logs
    .map((line) => `<li class="log-item">${line}</li>`)
    .join("");
}

// ------------------------------------------------------------------
// transitionLights(): Async handler for safe light transitions
// ------------------------------------------------------------------
async function transitionLights() {
  // This function uses async/await, which yields back to the event loop when
  // waiting (await sleep()). That allows the browser to process UI updates,
  // user input, and rendering frames in between each step.

  // Prevent concurrent transitions.
  if (trafficSystem.isTransitioning) {
    logEvent("Transition already in progress; request ignored.");
    return;
  }

  trafficSystem.isTransitioning = true;
  trafficSystem.pendingSwitch = false;

  // Determine which direction is currently green.
  const nsGreen = trafficSystem.intersections.ns.state === "green";
  const activeDir = nsGreen ? "ns" : "ew";
  const inactiveDir = nsGreen ? "ew" : "ns";

  logEvent(
    `Starting transition: ${trafficSystem.intersections[activeDir].name} → ${trafficSystem.intersections[inactiveDir].name}`
  );

  // 1) Yellow buffer for the active direction
  trafficSystem.intersections[activeDir].state = "yellow";
  trafficSystem.intersections[inactiveDir].state = "red";
  trafficSystem.lastTransition = `Yellow ${trafficSystem.intersections[activeDir].name}`;
  updateUI();

  // Wait 3 seconds before moving to red
  await sleep(3000);

  // 2) Set active direction to red; keep other direction red for 1 second
  trafficSystem.intersections[activeDir].state = "red";
  trafficSystem.lastTransition = `Red ${trafficSystem.intersections[activeDir].name}`;
  updateUI();

  await sleep(1000);

  // 3) Turn other direction green (exclusive state)
  trafficSystem.intersections[inactiveDir].state = "green";
  trafficSystem.lastTransition = `Green ${trafficSystem.intersections[inactiveDir].name}`;
  updateUI();
  logEvent(`Completed transition: ${trafficSystem.intersections[inactiveDir].name} is now GREEN`);

  trafficSystem.isTransitioning = false;

  // If user requested another switch during this transition, run again.
  if (trafficSystem.pendingSwitch) {
    logEvent("Processing queued switch request.");
    trafficSystem.pendingSwitch = false;
    await transitionLights();
  }
}

// ------------------------------------------------------------------
// handleLogic(): Entry point for user-triggered actions
// ------------------------------------------------------------------
function handleLogic(action) {
  // This function is called by event listeners (clicks, etc.). It runs on the
  // main thread and may schedule async behavior via transitionLights().

  if (action === "switch") {
    // If a transition is already in progress, queue the request.
    if (trafficSystem.isTransitioning) {
      trafficSystem.pendingSwitch = true;
      logEvent("Switch requested during transition; queued.");
      updateUI();
      return;
    }

    transitionLights();
  }
}

// ------------------------------------------------------------------
// init(): Set up initial state, attach event listeners, and start UI
// ------------------------------------------------------------------
function init() {
  // Initial state setup
  trafficSystem.intersections.ns.state = "green";
  trafficSystem.intersections.ew.state = "red";
  trafficSystem.isTransitioning = false;
  trafficSystem.pendingSwitch = false;
  trafficSystem.logs = [];
  trafficSystem.lastTransition = "Initialized";

  // Attach UI event listeners
  $("#btnSwitch").addEventListener("click", () => {
    handleLogic("switch");
  });

  // Render initial UI state
  updateUI();
  logEvent("Dashboard initialized.");

  // Keep footer time updated every second (demonstrates event loop tick behavior)
  setInterval(() => {
    $("#footerTime").textContent = formatTime();
  }, 1000);
}

// Kick off initialization when the DOM is ready.
document.addEventListener("DOMContentLoaded", init);
