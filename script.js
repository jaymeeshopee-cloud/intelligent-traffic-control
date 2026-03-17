/* ============================================================
   script.js — Smart Traffic Intersection Simulator
   Web Development Class — Session 1 Scaffold
   ============================================================ */

/* ─────────────────────────────────────────────────────────────
   STATE
   Holds the current values of everything the app needs to track.
───────────────────────────────────────────────────────────── */
const State = {
  ns: 'stop',           // 'go' | 'warning' | 'stop'
  ew: 'go',            // 'go' | 'warning' | 'stop'
  mode: 'manual',       // 'manual' | 'timed'
  transitioning: false, // true while a transition animation is running
  timedTimeout: null,   // holds the setTimeout reference for timed mode
};

/* ─────────────────────────────────────────────────────────────
   DOM REFERENCES
   Get all the elements we need to read or change.
   We use a helper function $() so we can write $('id')
   instead of document.getElementById('id') every time.
───────────────────────────────────────────────────────────── */
function $(id) {
  return document.getElementById(id);
}

// Light bulb elements for each lane
const nsLights = {
  red:    $('ns-red'),
  yellow: $('ns-yellow'),
  green:  $('ns-green'),
};

const ewLights = {
  red:    $('ew-red'),
  yellow: $('ew-yellow'),
  green:  $('ew-green'),
};

// State text labels below each light
const nsStateText = $('ns-state-text');
const ewStateText = $('ew-state-text');

// Controls
const modeSlider     = $('mode-slider');
const manualControls = $('manual-controls');
const timedControls  = $('timed-controls');
const btnTransition  = $('btn-transition');
const btnStartTimed  = $('btn-start-timed');
const btnStopTimed   = $('btn-stop-timed');
const nsTimeInput    = $('ns-time');
const ewTimeInput    = $('ew-time');
const logContainer   = $('log-container');
const btnClearLog    = $('btn-clear-log');
const labelManual    = $('label-manual');
const labelTimed     = $('label-timed');

/* ─────────────────────────────────────────────────────────────
   RENDER LIGHT
   Updates the bulbs and state label for one traffic light.

   Parameters:
     lights    — the object with .red, .yellow, .green elements
     stateText — the <div> that shows the text label
     state     — 'go' | 'warning' | 'stop'
───────────────────────────────────────────────────────────── */
function renderLight(lights, stateText, state) {
  // Turn off all bulbs first
  lights.red.classList.remove('active');
  lights.yellow.classList.remove('active');
  lights.green.classList.remove('active');

  // Turn on the correct bulb and update the label
  if (state === 'stop') {
    lights.red.classList.add('active');
    stateText.textContent = 'STOP';
    stateText.style.color = '#ef4444';
  } else if (state === 'warning') {
    lights.yellow.classList.add('active');
    stateText.textContent = 'SLOW';
    stateText.style.color = '#eab308';
  } else {
    // state === 'go'
    lights.green.classList.add('active');
    stateText.textContent = 'GO';
    stateText.style.color = '#22c55e';
  }
}

/* ─────────────────────────────────────────────────────────────
   RENDER ALL
   Re-renders both traffic lights using the current State values.
───────────────────────────────────────────────────────────── */
function renderAll() {
  renderLight(nsLights, nsStateText, State.ns);
  renderLight(ewLights, ewStateText, State.ew);
}

/* ─────────────────────────────────────────────────────────────
   LOG
   Adds a new entry to the Event Log panel.

   Parameters:
     message — the text to display
     type    — 'info' | 'success' | 'warning' | 'danger'
───────────────────────────────────────────────────────────── */
function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = 'log-entry ' + type;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

  entry.innerHTML = '<span class="log-time">[' + timeStr + ']</span>' + message;

  // Add newest entries at the top
  logContainer.prepend(entry);

  // Keep only the last 80 entries to avoid memory issues
  while (logContainer.children.length > 80) {
    logContainer.removeChild(logContainer.lastChild);
  }
}

/* ─────────────────────────────────────────────────────────────
   RUN MANUAL TRANSITION
   Triggers a full transition sequence:
     Active lane:  go → warning (1.5s) → stop
     Waiting lane: stop → go

   Parameters:
     callback — optional function to call when transition is done
───────────────────────────────────────────────────────────── */
function runManualTransition(callback) {
  // Don't start a new transition if one is already running
  if (State.transitioning) return;

  State.transitioning = true;
  btnTransition.disabled = true;

  // Figure out which lane is currently going
  const activeIsNS = (State.ns === 'go');
  const activeLane  = activeIsNS ? 'N–S' : 'E–W';
  const waitingLane = activeIsNS ? 'E–W' : 'N–S';

  log('🔄 Transition triggered — ' + activeLane + ' going to WARNING', 'warning');

  // Step 1: Active lane → WARNING
  if (activeIsNS) {
    State.ns = 'warning';
  } else {
    State.ew = 'warning';
  }
  renderAll();

  // Step 2: After 1.5s → active lane goes to STOP
  setTimeout(function () {
    log('🛑 ' + activeLane + ' → STOP', 'danger');

    if (activeIsNS) {
      State.ns = 'stop';
    } else {
      State.ew = 'stop';
    }
    renderAll();

    // Step 3: After 0.6s → waiting lane goes to GO
    setTimeout(function () {
      log('✅ ' + waitingLane + ' → GO', 'success');

      if (activeIsNS) {
        State.ew = 'go';
      } else {
        State.ns = 'go';
      }
      renderAll();

      // Transition complete
      State.transitioning = false;
      btnTransition.disabled = false;

      // Call the optional callback (used by timed mode)
      if (typeof callback === 'function') {
        callback();
      }

    }, 600);
  }, 1500);
}

/* ─────────────────────────────────────────────────────────────
   START TIMED MODE
   Reads the time inputs and starts the automatic cycle:
     - Set N–S to GO, E–W to STOP as the starting state
     - Wait for the go time, then trigger a transition
     - After the transition, wait the other lane's go time, repeat
───────────────────────────────────────────────────────────── */
function startTimedMode() {
  const nsSeconds = parseFloat(nsTimeInput.value) || 10;
  const ewSeconds = parseFloat(ewTimeInput.value) || 7;

  log('⏱ Timed mode started — N–S: ' + nsSeconds + 's | E–W: ' + ewSeconds + 's', 'info');

  // Set initial state: N–S goes first
  State.ns = 'go';
  State.ew = 'stop';
  renderAll();
  log('✅ N–S → GO (starting)', 'success');

  // Kick off the cycle
  runTimedCycle(nsSeconds, ewSeconds);
}

/* ─────────────────────────────────────────────────────────────
   RUN TIMED CYCLE
   Internal helper — schedules the next transition after
   the correct go time for the currently active lane.
───────────────────────────────────────────────────────────── */
function runTimedCycle(nsSeconds, ewSeconds) {
  // Stop if mode was switched away
  if (State.mode !== 'timed') return;

  // How long should the current GO lane stay green?
  const currentGoTime = (State.ns === 'go') ? nsSeconds : ewSeconds;

  State.timedTimeout = setTimeout(function () {
    runManualTransition(function () {
      // After transition, schedule the next one
      runTimedCycle(nsSeconds, ewSeconds);
    });
  }, currentGoTime * 1000);
}

/* ─────────────────────────────────────────────────────────────
   STOP TIMED MODE
   Cancels any pending timeouts and resets transitioning state.
───────────────────────────────────────────────────────────── */
function stopTimedMode() {
  clearTimeout(State.timedTimeout);
  State.timedTimeout = null;
  State.transitioning = false;
  btnTransition.disabled = false;
  log('⏹ Timed mode stopped', 'warning');
}

/* ─────────────────────────────────────────────────────────────
   EVENT LISTENERS
   Connect each button and control to the correct function.
───────────────────────────────────────────────────────────── */

// Manual transition button
btnTransition.addEventListener('click', function () {
  runManualTransition();
});

// Timed mode — Start button
btnStartTimed.addEventListener('click', function () {
  stopTimedMode(); // clear any previous cycle first
  startTimedMode();
});

// Timed mode — Stop button
btnStopTimed.addEventListener('click', function () {
  stopTimedMode();
});

// Mode slider — switches between Manual and Timed
modeSlider.addEventListener('input', function () {
  const isTimed = modeSlider.value === '1';

  if (isTimed) {
    State.mode = 'timed';
    manualControls.classList.add('hidden');
    timedControls.classList.remove('hidden');
    labelManual.classList.remove('active-label');
    labelTimed.classList.add('active-label');
    log('🔀 Switched to TIMED mode', 'info');
  } else {
    State.mode = 'manual';
    stopTimedMode();
    timedControls.classList.add('hidden');
    manualControls.classList.remove('hidden');
    labelTimed.classList.remove('active-label');
    labelManual.classList.add('active-label');
    log('🔀 Switched to MANUAL mode', 'info');
  }
});

// Clear log button
btnClearLog.addEventListener('click', function () {
  logContainer.innerHTML = '';
});

/* ─────────────────────────────────────────────────────────────
   INIT
   Run when the page first loads — render the initial state.
───────────────────────────────────────────────────────────── */
renderAll();
log('🚦 Traffic Simulator initialized', 'info');
log('N–S: STOP | E–W: GO', 'success');
