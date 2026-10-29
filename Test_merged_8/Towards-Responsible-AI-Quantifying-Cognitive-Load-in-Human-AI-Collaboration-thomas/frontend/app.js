import { renderResearchMetricsPage } from './research_metrics_viewer.js';
import { selectSessionTasks, PREDEFINED_TASKS } from './tasks.js';
let BACKEND_URL_FROM_ENV = '';
try {
  BACKEND_URL_FROM_ENV = import.meta.env.BACKEND_URL;
} catch (e) {
  // Ignore
}
const API_BASE_URL = BACKEND_URL_FROM_ENV ? `${BACKEND_URL_FROM_ENV}/api` : '/api';
const DEFAULT_TASKS = PREDEFINED_TASKS;

/* Archived question definitions retained only for traceability; the active assessment uses the PDF tasks above.
const archivedQuestions = [
  {
    id: 'C1',
    topic: 'Positive, Negative, or Zero',
    category: 'Coding & Programming',
    subquestions: [
      { id: 'C1-MAIN', difficulty: 'Easy', expectedTime: '3–5 minutes', title: 'Generate a Java or Python number-checking program', text: 'Write a prompt to generate a Java or Python program that checks whether a number is positive, negative, or zero.' },
      { id: 'C1-SUB1', difficulty: 'Easy', expectedTime: '3–5 minutes', title: 'Explain and test the conditions', text: 'Explain how the generated program handles the positive, negative, and zero conditions. Provide one test input and expected output for each condition.' }
    ]
  },
  {
    id: 'L1',
    topic: 'Four-Friend Seating Arrangement',
    category: 'Logical Reasoning',
    subquestions: [
      { id: 'L1-MAIN', difficulty: 'Easy', expectedTime: '3–5 minutes', title: 'Determine the seating order', text: 'Four friends—A, B, C, and D—sit in a row. A sits at one end, B sits immediately to the right of C, and D is not adjacent to A. Determine the final seating order.' },
      { id: 'L1-SUB1', difficulty: 'Easy', expectedTime: '3–5 minutes', title: 'Explain the elimination process', text: 'Show how each condition eliminates invalid seating arrangements. State whether the information produces one unique order or multiple valid orders.' }
    ]
  },
  {
    id: 'A3',
    topic: 'Train Travel Time and Average Speed',
    category: 'Quantitative Aptitude',
    subquestions: [
      { id: 'A3-MAIN', difficulty: 'Medium', expectedTime: '7–10 minutes', title: 'Calculate total travel time and average speed', text: 'A train travels 240 km. It covers the first half at 60 km/h and the second half at 80 km/h, with a 20-minute stop in between. Determine the total travel time and average speed.' },
      { id: 'A3-SUB1', difficulty: 'Medium', expectedTime: '7–10 minutes', title: 'Separate travel and stoppage time', text: 'Calculate the moving time for each half separately, then explain how including the 20-minute stop changes the overall average speed.' }
    ]
  }
];
*/

const NASA_TLX_DIMENSIONS = [
  { key: 'mental_demand', label: 'Mental demand', help: 'How much thinking, deciding, or calculating was required?' },
  { key: 'physical_demand', label: 'Physical demand', help: 'How much physical activity was required?' },
  { key: 'temporal_demand', label: 'Temporal demand', help: 'How much time pressure did you feel?' },
  { key: 'performance', label: 'Performance', help: 'How successful were you in accomplishing the tasks? 1 = excellent, 10 = poor.' },
  { key: 'effort', label: 'Effort', help: 'How hard did you have to work to achieve your level of performance?' },
  { key: 'frustration', label: 'Frustration', help: 'How insecure, discouraged, irritated, stressed, or annoyed did you feel?' }
];

const state = {
  participant: null,
  participantSessionToken: '',
  sessionId: '',
  questions: [],
  current: 0,
  subquestion: 0,
  questionTransition: '',
  questionDrafts: {},
  selectedLLM: '',
  started: false,
  trackingActive: false,
  trackingStartedAt: null,
  startTime: null,
  paas: null,
  baselineNasaTlx: {},
  nasaTlx: {},
  endedEarly: false,
  questionRatings: [],
  skippedQuestionIds: [],
  testMode: false,
  saveStatus: 'Draft saved locally',
  answerDraft: '',
  codeDraft: '',
  compilerInput: '',
  compilerLanguage: 'java',
  compilerResult: null,
  codeRunning: false,
  finishing: false,
  chatStreaming: false,
  chatAbortController: null,
  chatStopRequested: false,
  submitting: false,
  answers: [],
  messages: [],
  sessionStart: null,
  assessmentDeadline: null,
  assessmentStage: 'login',
  timeLimitReached: false,
  timerHandle: null,
  tracking: { clicks: 0, tabSwitches: 0 },
  vision: { status: 'Camera not started', latest: null, samples: 0, calibrated: false },
  facial: { status: 'Facial expression not started', latest: null, samples: 0 },
  lastInteractionAt: Date.now(),
  authToken: '',
  authRole: '',
  llmProviders: null
};

let cameraStream = null;
let cameraCaptureVideo = null;

// One common timer for BOTH eye tracking and facial-expression analysis.
const SHARED_CAPTURE_FPS = 3;
const SHARED_CAPTURE_INTERVAL_MS = Math.round(1000 / SHARED_CAPTURE_FPS);

let sharedCaptureTimer = null;
let sharedCaptureInFlight = false;

// frame_id starts again from 1 for every question.
let sharedFrameId = 0;


let cameraSecondBuffer = null;

// Completed second summaries wait here until Camera + Behavior for the same
// participant/question/second can be merged into one database row.
const completedCameraSeconds = new Map();
const completedBehaviorSeconds = new Map();
const multimodalSavePromises = new Set();

// Second-level behavioral telemetry buffer (keyboard + mouse + prompt).
let behaviorSecondBuffer = null;
let behaviorSecondTimer = null;
let behaviorPromptCount = 0;
let lastBehaviorPromptAt = null;
let lastBehaviorKeyAt = null;
let lastBehaviorMousePoint = null;
let participantStateSaveTimer = null;

const CAMERA_EMOTIONS = [
  'angry',
  'disgust',
  'fearful',
  'happy',
  'neutral',
  'sad',
  'surprised'
];


let monitoringTimer = null;
let dashboardTimer = null;
let independentDetailOpen = false;
const keyboardTracker = new KeyboardTracker({
  pauseThresholdMs: 3000,
  // Keyboard telemetry must remain usable when the optional camera signal is
  // unavailable. Do not make one laptop input device gate another.
  isUserPresent: () => true,
  onIdle: measurements => {
    if (state.started && state.participant) {
      saveKeyboardWithRetry(measurements, 'idle_autosave', false).catch(error => {
        showExamError(`Keyboard tracking autosave failed: ${error.message}`);
      });
    }
  }
});
const mouseTracker = new MouseTracker({
  onSave: measurements => saveMouseMeasurements(measurements)
});

const app = document.getElementById('app');
const PARTICIPANT_STATE_KEY = 'cognitrack_participant_state';
// Versioned so an older saved dark preference cannot override the new
// light-first default for existing browser sessions.
const THEME_STORAGE_KEY = 'cognitrack_theme_v3';
const DASHBOARD_MODE_STORAGE_KEY = 'cognitrack_dashboard_mode';
const DASHBOARD_PARTICIPANT_STORAGE_KEY = 'cognitrack_dashboard_participant';

function currentTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme = currentTheme()) {
  const selectedTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = selectedTheme;
  localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
  document.querySelectorAll('[data-theme-toggle]').forEach(button => {
    const lightMode = selectedTheme === 'light';
    button.textContent = lightMode ? '☾ Dark Mode' : '☀ Light Mode';
    button.setAttribute('aria-label', lightMode ? 'Switch to dark mode' : 'Switch to light mode');
  });
}

function themeToggleMarkup() {
  const lightMode = currentTheme() === 'light';
  return `<button class="theme-toggle" data-theme-toggle type="button" aria-label="${lightMode ? 'Switch to dark mode' : 'Switch to light mode'}">${lightMode ? 'Light Mode' : 'Dark Mode'}</button>`;
}

applyTheme();
document.addEventListener('click', event => {
  if (event.target.closest('[data-theme-toggle]')) {
    applyTheme(currentTheme() === 'light' ? 'dark' : 'light');
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const lightMode = currentTheme() === 'light';
      button.textContent = lightMode ? 'Light Mode' : 'Dark Mode';
      button.setAttribute('aria-label', lightMode ? 'Switch to dark mode' : 'Switch to light mode');
    });
  }
});

function syncPersistentThemeToggle() {
  const hasLocalToggle = document.querySelector('[data-theme-toggle]');
  let persistent = document.getElementById('persistentThemeToggle');
  if (hasLocalToggle) {
    persistent?.remove();
    return;
  }
  if (!persistent) {
    persistent = document.createElement('button');
    persistent.id = 'persistentThemeToggle';
    persistent.className = 'theme-toggle persistent-theme-toggle';
    persistent.dataset.themeToggle = '';
    persistent.type = 'button';
    document.body.appendChild(persistent);
    applyTheme();
  }
}

syncPersistentThemeToggle();
new MutationObserver(syncPersistentThemeToggle).observe(app, { childList: true, subtree: true });

function saveParticipantState() {
  if (!state.participant || !state.participantSessionToken) return;
  const saved = {
    participant: state.participant,
    participantSessionToken: state.participantSessionToken,
    sessionId: state.sessionId,
    questions: state.questions,
    current: state.current,
    subquestion: state.subquestion,
    selectedLLM: state.selectedLLM,
    started: state.started,
    startTime: state.startTime,
    paas: state.paas,
    nasaTlx: state.nasaTlx,
    baselineNasaTlx: state.baselineNasaTlx,
    endedEarly: state.endedEarly,
    questionRatings: state.questionRatings,
    skippedQuestionIds: state.skippedQuestionIds,
    testMode: state.testMode,
    answerDraft: state.answerDraft,
    codeDraft: state.codeDraft,
    compilerInput: state.compilerInput,
    compilerLanguage: state.compilerLanguage,
    answers: state.answers,
    messages: state.messages,
    sessionStart: state.sessionStart,
    assessmentDeadline: state.assessmentDeadline,
    assessmentStage: state.assessmentStage,
    timeLimitReached: state.timeLimitReached,
    tracking: state.tracking,
    lastInteractionAt: state.lastInteractionAt
  };
  sessionStorage.setItem(PARTICIPANT_STATE_KEY, JSON.stringify(saved));
}

function scheduleParticipantStateSave() {
  if (participantStateSaveTimer !== null) return;
  participantStateSaveTimer = window.setTimeout(() => {
    participantStateSaveTimer = null;
    saveParticipantState();
  }, 150);
}

function clearParticipantState() {
  sessionStorage.removeItem(PARTICIPANT_STATE_KEY);
}

function resetParticipantSession() {
  if (participantStateSaveTimer !== null) {
    clearTimeout(participantStateSaveTimer);
    participantStateSaveTimer = null;
  }
  clearParticipantState();
  state.participant = null;
  state.participantSessionToken = '';
  state.sessionId = '';
  state.questions = [];
  state.current = 0;
  state.subquestion = 0;
  state.selectedLLM = '';
  state.started = false;
  state.startTime = null;
  state.paas = null;
  state.baselineNasaTlx = {};
  state.nasaTlx = {};
  state.endedEarly = false;
  state.questionRatings = [];
  state.skippedQuestionIds = [];
  state.testMode = false;
  state.saveStatus = 'Draft saved locally';
  state.answerDraft = '';
  state.codeDraft = '';
  state.compilerInput = '';
  state.compilerResult = null;
  state.codeRunning = false;
  state.finishing = false;
  state.chatStreaming = false;
  state.chatAbortController = null;
  state.chatStopRequested = false;
  state.submitting = false;
  state.answers = [];
  state.messages = [];
  state.sessionStart = null;
  state.assessmentDeadline = null;
  state.assessmentStage = 'login';
  state.timeLimitReached = false;
  state.trackingActive = false;
  state.trackingStartedAt = null;
  state.tracking = { clicks: 0, tabSwitches: 0 };
  state.vision = { status: 'Camera not started', latest: null, samples: 0, calibrated: false };
  state.facial = { status: 'Facial expression not started', latest: null, samples: 0 };

  stopBehaviorSecondTracking();
  behaviorSecondBuffer = null;
  behaviorPromptCount = 0;
  lastBehaviorPromptAt = null;
  lastBehaviorKeyAt = null;
  lastBehaviorMousePoint = null;
}

function restoreParticipantState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PARTICIPANT_STATE_KEY) || 'null');
    if (!saved?.participant || !saved.participantSessionToken) return false;
    Object.assign(state, saved);
    if (Array.isArray(saved.questions) && saved.questions.length > 0) {
      state.questions = saved.questions;
    } else if (saved.participant) {
      state.questions = selectSessionTasks(saved.participant);
    } else {
      state.questions = [];
    }
    state.skippedQuestionIds = Array.isArray(saved.skippedQuestionIds) ? saved.skippedQuestionIds : [];
    state.endedEarly = Boolean(saved.endedEarly);
    state.assessmentStage = saved.assessmentStage === 'question-ratings' ? 'nasa' : saved.assessmentStage || (saved.questionRatings?.length ? 'nasa' : saved.started ? 'exam' : 'instructions');
    state.finishing = false;
    state.chatStreaming = false;
    state.submitting = false;
    state.codeRunning = false;
    state.vision = { status: 'Camera will reconnect after refresh', latest: null, samples: 0, calibrated: false };
    state.facial = { status: 'Facial expression will reconnect after refresh', latest: null, samples: 0 };
    return true;
  } catch (_error) {
    clearParticipantState();
    return false;
  }
}

async function resumeParticipantState() {
  if (!state.assessmentDeadline) {
    if (state.participant && (state.assessmentStage === 'baseline-nasa' || !baselineNasaTlxComplete())) {
      renderBaselineNasaTlx();
    } else {
      renderInstructions();
    }
    return;
  }
  if (Date.now() >= state.assessmentDeadline) {
    clearParticipantState();
    renderLogin();
    return;
  }
  if (state.assessmentStage === 'nasa') {
    renderNasaTlxAssessment(state.endedEarly);
    return;
  }
  const questionWasStarted = state.started;
  // Keep the draft controls active after refresh. The active question was
  // already started before the reload, so starting it again would duplicate
  // its server-side start event.
  state.started = questionWasStarted;
  state.trackingActive = true;
  state.trackingStartedAt = state.sessionStart
    ? new Date(state.sessionStart).getTime()
    : Date.now();
  try {
    await startVisionCamera();
    startSharedTrackingCapture();
  } catch (error) {
    state.vision.status = `Camera unavailable after refresh: ${error.message}`;
  }
  renderExam();
  saveParticipantState();
}

document.addEventListener('keydown', e => {
  if (state.participant) {
    state.lastInteractionAt = Date.now();
    scheduleParticipantStateSave();
  }
});
document.addEventListener('click', () => { if (state.participant) { state.tracking.clicks++; state.lastInteractionAt = Date.now(); scheduleParticipantStateSave(); } });
document.addEventListener('scroll', () => { if (state.participant) { state.lastInteractionAt = Date.now(); scheduleParticipantStateSave(); } }, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && state.participant) { state.tracking.tabSwitches++; saveParticipantState(); } });


// Second-level keyboard activity. This runs alongside the existing
// KeyboardTracker, which still keeps the question-level summary.
document.addEventListener('keydown', event => {
  if (!state.started || !state.startTime || !state.participant) return;

  const now = Date.now();
  rolloverBehaviorSecond(now);
  if (!behaviorSecondBuffer) return;

  const ignoredKeys = new Set([
    'Shift',
    'Control',
    'Alt',
    'Meta',
    'CapsLock'
  ]);

  if (!ignoredKeys.has(event.key)) {
    behaviorSecondBuffer.keypress_count++;
    behaviorSecondBuffer.typing_active = true;
  }

  if (event.key === 'Backspace') {
    behaviorSecondBuffer.backspace_count++;
  }

  if (lastBehaviorKeyAt !== null) {
    const pauseSeconds = (now - lastBehaviorKeyAt) / 1000;
    if (pauseSeconds >= 3) {
      behaviorSecondBuffer.thinking_pause_seconds = Math.max(
        behaviorSecondBuffer.thinking_pause_seconds,
        roundMetric(pauseSeconds)
      );
    }
  }

  lastBehaviorKeyAt = now;
});


// Second-level mouse activity. The existing MouseTracker remains unchanged
// and continues to provide its question-level summary.
document.addEventListener('mousemove', event => {
  if (!state.started || !state.startTime || !state.participant) return;

  rolloverBehaviorSecond(Date.now());
  if (!behaviorSecondBuffer) return;

  behaviorSecondBuffer.mouse_move_count++;
  behaviorSecondBuffer.mouse_active = true;

  if (lastBehaviorMousePoint) {
    const dx = event.clientX - lastBehaviorMousePoint.x;
    const dy = event.clientY - lastBehaviorMousePoint.y;
    behaviorSecondBuffer.cursor_distance_px += Math.sqrt(dx * dx + dy * dy);
  }

  lastBehaviorMousePoint = {
    x: event.clientX,
    y: event.clientY
  };
}, { passive: true });


document.addEventListener('wheel', event => {
  if (!state.started || !state.startTime || !state.participant) return;

  rolloverBehaviorSecond(Date.now());
  if (!behaviorSecondBuffer) return;

  behaviorSecondBuffer.scroll_count++;
  behaviorSecondBuffer.mouse_active = true;

  if (event.deltaY < 0) {
    behaviorSecondBuffer.scroll_up_count++;
  } else if (event.deltaY > 0) {
    behaviorSecondBuffer.scroll_down_count++;
  }
}, { passive: true });

function renderLogin() {
  clearInterval(dashboardTimer);
  app.innerHTML = `
    <div class="shell">
      <header class="topbar login-sequence-topbar">
        <div class="brand"><div class="logo">C</div><div><h1>CogniTrack <span style="color:#38dd9a">AI</span></h1><small>Enterprise Cognitive Assessment Platform</small></div></div>
        ${themeToggleMarkup()}
        <div class="role-actions">
          <button class="role-login-btn" id="hostLoginBtn" type="button">Host Login</button>
          <button class="role-login-btn admin" id="adminLoginBtn" type="button">Admin Login</button>
          <button class="role-login-btn dashboard" id="dashboardLoginBtn" type="button">Dashboard Login</button>
          <button class="role-login-btn research" id="researchMetricsBtn" type="button" style="border-color:#18c77e; color:#18c77e;">Research Metrics</button>
          <div class="badge">● Secure Session</div>
        </div>
      </header>
      <section class="login-layout login-sequence">
        <div class="hero login-sequence-hero">
          <div class="eyebrow">AI-POWERED TALENT INTELLIGENCE</div>
          <h2>Measure reasoning, coding and AI <span>decision-making.</span></h2>
          <p>Questions adapt to the selected profile while behavioural and interaction analytics run securely in the background.</p>
          <div class="feature-row" role="group" aria-label="Assessment features"><button class="feature-pill" type="button">Encrypted Session</button><button class="feature-pill" type="button">Adaptive Questions</button><button class="feature-pill" type="button">Interaction Analytics</button></div>
          <div class="login-model-wrap" aria-label="Interactive 3D brain model">
            <svg class="neuron-field" viewBox="0 0 760 390" aria-hidden="true" focusable="false">
              <g class="neuron-paths">
                <path d="M32 300 C126 214 115 92 238 108 S364 266 460 176 S634 62 728 116" />
                <path d="M18 136 C142 54 184 198 292 154 S450 54 552 124 S650 308 742 264" />
                <path d="M88 364 C178 298 220 302 292 332 S424 350 488 292 S636 194 708 226" />
              </g>
              <g class="neuron-nodes">
                <circle cx="32" cy="300" r="4"/><circle cx="238" cy="108" r="4"/><circle cx="460" cy="176" r="4"/><circle cx="728" cy="116" r="4"/>
                <circle cx="18" cy="136" r="4"/><circle cx="292" cy="154" r="4"/><circle cx="552" cy="124" r="4"/><circle cx="742" cy="264" r="4"/>
                <circle cx="88" cy="364" r="4"/><circle cx="292" cy="332" r="4"/><circle cx="488" cy="292" r="4"/><circle cx="708" cy="226" r="4"/>
              </g>
              <g class="network-dots">
                <circle cx="76" cy="82" r="2.5"/><circle cx="126" cy="126" r="2"/><circle cx="168" cy="64" r="3"/><circle cx="210" cy="184" r="2.5"/><circle cx="256" cy="76" r="2"/>
                <circle cx="310" cy="48" r="2.5"/><circle cx="346" cy="116" r="2"/><circle cx="390" cy="72" r="3"/><circle cx="430" cy="132" r="2"/><circle cx="492" cy="54" r="2.5"/>
                <circle cx="548" cy="86" r="2"/><circle cx="602" cy="42" r="3"/><circle cx="650" cy="104" r="2.5"/><circle cx="696" cy="72" r="2"/>
                <circle cx="120" cy="238" r="2.5"/><circle cx="178" cy="276" r="2"/><circle cx="226" cy="240" r="3"/><circle cx="278" cy="292" r="2"/><circle cx="338" cy="252" r="2.5"/>
                <circle cx="406" cy="284" r="2"/><circle cx="454" cy="232" r="3"/><circle cx="520" cy="306" r="2.5"/><circle cx="576" cy="246" r="2"/><circle cx="636" cy="292" r="3"/><circle cx="688" cy="334" r="2"/>
                <circle cx="148" cy="346" r="2"/><circle cx="244" cy="356" r="2.5"/><circle cx="364" cy="344" r="2"/><circle cx="428" cy="366" r="2.5"/><circle cx="558" cy="354" r="2"/><circle cx="644" cy="370" r="2.5"/>
              </g>
            </svg>
            <model-viewer
              class="login-model"
              src="assets/brain.glb"
              alt="Interactive 3D brain model"
              camera-controls
              auto-rotate
              auto-rotate-delay="0"
              rotation-per-second="18deg"
              interaction-prompt="none"
              loading="lazy"
              shadow-intensity="0.45"
              exposure="1.05">
            </model-viewer>
          </div>
        </div>
        <form id="loginForm" class="card login-card login-sequence-form">
          <div class="login-card-handle" aria-hidden="true"></div>
          <div class="login-card-kicker"><span class="status-orb" aria-hidden="true"></span> SECURE SESSION</div>
          <h3>Unlock your assessment</h3>
          <p class="login-card-intro">Enter your details to create a private cognitive assessment session.</p>
          <div class="session-steps" aria-label="Assessment setup steps">
            <span class="session-step active" data-login-step="profile"><i>1</i> Profile</span>
            <span class="session-step-line" aria-hidden="true"></span>
            <span class="session-step" data-login-step="consent"><i>2</i> Consent</span>
            <span class="session-step-line" aria-hidden="true"></span>
            <span class="session-step" data-login-step="begin"><i>3</i> Begin</span>
          </div>
          <div class="field"><label>Full Name</label><input id="fullName" placeholder="Enter full name" required /></div>
          <div class="grid-2">
            <div class="field"><label>Age Group</label><select id="ageGroup" required><option value="">Select age group</option><option>18–22</option><option>23–28</option><option>29–35</option><option>36–45</option><option>46+</option></select></div>
            <div class="field"><label>Domain</label><select id="domain" required><option value="">Select domain</option><option>Artificial Intelligence</option><option>Computer Science</option><option>Data Science</option><option>Software Development</option><option>Other</option></select></div>
          </div>
          <div class="field"><label>AI Familiarity Level</label><select id="level" required><option value="">Select familiarity level</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></div>
          <label class="consent"><input id="consent" type="checkbox" /> <span>I agree to participate in this assessment and allow interaction data to be collected for the stated research purpose.</span></label>
          <label class="consent test-mode-option"><input id="testMode" type="checkbox" /> <span>Test mode (exclude this session from research exports)</span></label>
          <button class="primary login-submit" type="submit"><span>Continue securely</span><strong aria-hidden="true">↗</strong></button>
          <p class="login-footnote"><span aria-hidden="true">⌁</span> Your responses and interaction data stay linked to this session.</p>
          <div class="login-loading" id="loginLoading" aria-live="polite" hidden><span class="loading-orb" aria-hidden="true"></span><span>Preparing your private session...</span></div>
          <div class="error" id="loginError"></div>
        </form>
      </section>
    </div>`;

  const loginModel = document.querySelector('.login-model');
  if (loginModel) {
    const keepModelRotating = () => {
      loginModel.autoRotate = true;
    };
    ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend'].forEach(eventName => {
      loginModel.addEventListener(eventName, keepModelRotating, { passive: true });
    });
    loginModel.addEventListener('load', keepModelRotating, { once: true });
    keepModelRotating();
  }

  document.getElementById('hostLoginBtn').addEventListener('click', () => renderRoleLogin('host'));
  document.getElementById('adminLoginBtn').addEventListener('click', () => renderRoleLogin('admin'));
  document.getElementById('dashboardLoginBtn').addEventListener('click', renderDashboardCredentialLogin);
  const researchBtn = document.getElementById('researchMetricsBtn');
  if (researchBtn) researchBtn.addEventListener('click', () => renderResearchMetricsPage('login'));

  const loginForm = document.getElementById('loginForm');
  const loginFields = [
    document.getElementById('fullName'),
    document.getElementById('ageGroup'),
    document.getElementById('domain'),
    document.getElementById('level'),
    document.getElementById('consent')
  ];
  const isLoginFieldComplete = field => field.type === 'checkbox' ? field.checked : Boolean(field.value.trim());
  const updateLoginProgress = () => {
    const profileComplete = loginFields.slice(0, 4).every(isLoginFieldComplete);
    const consentComplete = document.getElementById('consent').checked;
    const profileStep = document.querySelector('[data-login-step="profile"]');
    const consentStep = document.querySelector('[data-login-step="consent"]');
    const beginStep = document.querySelector('[data-login-step="begin"]');
    profileStep.classList.toggle('active', !profileComplete);
    profileStep.classList.toggle('complete', profileComplete);
    consentStep.classList.toggle('active', profileComplete && !consentComplete);
    consentStep.classList.toggle('complete', consentComplete);
    beginStep.classList.toggle('active', profileComplete && consentComplete);
  };
  const validateLoginField = field => {
    const wrapper = field.closest('.field, .consent');
    const complete = isLoginFieldComplete(field);
    wrapper?.classList.toggle('field-valid', complete);
    wrapper?.classList.toggle('field-invalid', !complete && field.dataset.touched === 'true');
    field.setAttribute('aria-invalid', String(!complete));
    return complete;
  };
  loginFields.forEach(field => {
    ['input', 'change'].forEach(eventName => field.addEventListener(eventName, () => {
      field.dataset.touched = 'true';
      validateLoginField(field);
      updateLoginProgress();
    }));
  });
  updateLoginProgress();

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    loginFields.forEach(field => { field.dataset.touched = 'true'; validateLoginField(field); });
    updateLoginProgress();
    const firstInvalid = loginFields.find(field => !isLoginFieldComplete(field));
    if (firstInvalid) {
      document.getElementById('loginError').textContent = firstInvalid.id === 'consent'
        ? 'Consent is required to continue.'
        : 'Complete the highlighted profile fields to continue.';
      firstInvalid.focus();
      return;
    }
    const participant = {
      participant_id: '',
      full_name: document.getElementById('fullName').value.trim(),
      age_group: document.getElementById('ageGroup').value,
      domain: document.getElementById('domain').value,
      ai_familiarity: document.getElementById('level').value
    };
    const submitButton = loginForm.querySelector('.login-submit');
    const loadingMessage = document.getElementById('loginLoading');
    submitButton.disabled = true;
    submitButton.classList.add('is-loading');
    submitButton.querySelector('span').textContent = 'Preparing session';
    loadingMessage.hidden = false;
    document.getElementById('loginError').textContent = '';
    try {
      await startParticipantSession({ ...participant, test_mode: document.getElementById('testMode').checked });
    } catch (error) {
      submitButton.disabled = false;
      submitButton.classList.remove('is-loading');
      submitButton.querySelector('span').textContent = 'Continue securely';
      loadingMessage.hidden = true;
      document.getElementById('loginError').textContent = `Unable to start: ${error.message}`;
    }
  });
}

async function startParticipantSession(participant) {
  state.participant = participant;
  state.questions = selectSessionTasks(participant);
  state.current = 0;
  state.subquestion = 0;
  state.testMode = Boolean(participant.test_mode);
  const loginTime = Date.now();
  state.sessionStart = new Date(loginTime).toISOString();
  state.assessmentDeadline = null;
  state.timeLimitReached = false;
  const result = await safePost('/sessions/start', state.participant);
  state.participant.participant_id = result.participant_id;
  state.sessionId = result.session_id || '';
  state.participantSessionToken = result.participant_session_token;
  saveParticipantState();
  state.lastInteractionAt = Date.now();
  clearInterval(monitoringTimer);
  monitoringTimer = setInterval(() => sendMonitoringHeartbeat('active'), 10000);
  sendMonitoringHeartbeat('active').catch(error => console.warn('Monitoring heartbeat failed:', error));
  renderBaselineNasaTlx();
}

function baselineNasaTlxComplete() {
  return NASA_TLX_DIMENSIONS.every(d => Number.isFinite(state.baselineNasaTlx[d.key]) && state.baselineNasaTlx[d.key] >= 0 && state.baselineNasaTlx[d.key] <= 10);
}

function renderBaselineNasaTlx() {
  state.assessmentStage = 'baseline-nasa';
  app.innerHTML = `<div class="survey-screen"><section class="card survey-card"><div class="survey-kicker">Before the assessment</div><h1>Baseline workload check</h1><p class="survey-intro">Before you start, rate how you feel right now. This NASA-TLX baseline uses a 0–10 scale for every dimension and is not a clinical mental-health assessment.</p><div class="nasa-grid">${NASA_TLX_DIMENSIONS.map(d => { const selected = Number.isFinite(state.baselineNasaTlx[d.key]) && state.baselineNasaTlx[d.key] >= 0 && state.baselineNasaTlx[d.key] <= 10; const value = selected ? state.baselineNasaTlx[d.key] : 5; return `<article class="survey-item"><div class="nasa-item-heading"><h3>${d.label}</h3><output class="nasa-value" data-baseline-output="${d.key}">${selected ? value : '—'}</output></div><p>${d.help}</p><input class="nasa-range" type="range" min="0" max="10" step="1" value="${value}" data-baseline-scale="${d.key}" aria-label="Baseline ${d.label} scale from 0 to 10"><div class="scale-labels"><span>0</span><span>10</span></div></article>`; }).join('')}</div><div class="nasa-overall" id="baselineNasaPreview">Baseline score: ${baselineNasaTlxComplete() ? (Object.values(state.baselineNasaTlx).reduce((sum, value) => sum + value, 0) / NASA_TLX_DIMENSIONS.length).toFixed(1) : '—'} <small>(average of the six ratings)</small></div><button class="primary" id="saveBaselineNasa" type="button" ${baselineNasaTlxComplete() ? '' : 'disabled'}>Save baseline and continue</button><div class="error" id="baselineNasaError"></div></section></div>`;
  document.querySelectorAll('[data-baseline-scale]').forEach(input => {
    input.addEventListener('input', event => {
      state.baselineNasaTlx[event.target.dataset.baselineScale] = Number(event.target.value);
      saveParticipantState();
      const output = document.querySelector(`[data-baseline-output="${event.target.dataset.baselineScale}"]`);
      if (output) output.textContent = event.target.value;
      const overall = document.getElementById('baselineNasaPreview');
      if (overall) overall.innerHTML = `Baseline score: ${baselineNasaTlxComplete() ? (Object.values(state.baselineNasaTlx).reduce((sum, value) => sum + value, 0) / NASA_TLX_DIMENSIONS.length).toFixed(1) : '—'} <small>(average of the six ratings)</small>`;
      const submit = document.getElementById('saveBaselineNasa');
      if (submit) submit.disabled = !baselineNasaTlxComplete();
    });
  });
  saveParticipantState();
  document.getElementById('saveBaselineNasa').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Saving baseline…';
    try {
      await safePost('/sessions/nasa-tlx-baseline', { participant_id: state.participant.participant_id, ratings: state.baselineNasaTlx }, state.participantSessionToken);
      saveParticipantState();
      renderInstructions();
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Save baseline and continue';
      document.getElementById('baselineNasaError').textContent = `Unable to save baseline: ${error.message}`;
    }
  });
  saveParticipantState();
}

async function renderInstructions() {
  state.assessmentStage = 'instructions';
  const domainText = escapeHtml(state.participant?.domain || 'General');
  const levelText = escapeHtml(state.participant?.ai_familiarity || 'Intermediate');
  app.innerHTML = `<div class="instructions-overlay"><div class="card instructions-card"><div class="instruction-heading"><h2>Assessment Instructions</h2></div><ol><li>You have one hour after clicking <strong>Start Assessment</strong> to complete the session.</li><li>The session contains <strong>6 dynamic tasks</strong> tailored to your domain (<strong>${domainText}</strong>) and experience level (<strong>${levelText}</strong>).</li><li>For each task, read the problem scenario and collaboration objectives in the main panel.</li><li>Select an AI partner (ChatGPT or Groq) in the right panel and collaborate: ask questions, explore trade-offs, and analyze responses.</li><li>Once you have reviewed the AI's response, click <strong>I have reviewed the AI response · Proceed to Next Task</strong> to move forward.</li><li>Keep your face visible and remain in a well-lit area while webcam tracking measures cognitive load indicators in the background.</li></ol><div id="ragReadiness" class="muted-text">Checking assessment resources...</div><button class="primary" id="startAssessment" type="button" disabled>Start Assessment</button></div></div>`;
  saveParticipantState();
  const startButton = document.getElementById('startAssessment');
  const ragReadiness = document.getElementById('ragReadiness');
  try {
    ragReadiness.textContent = 'Ready.';
    startButton.disabled = false;
  } catch (error) {
    ragReadiness.textContent = error.message;
  }
  startButton.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Requesting webcam permission…';
    try {
      await startVisionCamera();
      const assessmentStartedAt = new Date().toISOString();
      await safePost('/sessions/assessment-start', {
        participant_id: state.participant.participant_id,
        assessment_started_at: assessmentStartedAt,
        camera_permission: 'granted',
        calibration_status: 'not-required'
      }, state.participantSessionToken);
      state.sessionStart = assessmentStartedAt;
      state.assessmentDeadline = Date.now() + 60 * 60 * 1000;
      state.assessmentStage = 'exam';
      state.timeLimitReached = false;
      state.trackingActive = true;
      state.trackingStartedAt = Date.now();
      saveParticipantState();
      renderExam();


      startSharedTrackingCapture();
    } catch (error) {
      state.vision.status = `Camera failed: ${error.message}`;
      button.disabled = false;
      button.textContent = 'Start Assessment';
      const existing = document.getElementById('cameraStartError');
      if (existing) existing.textContent = error.message;
      else button.insertAdjacentHTML('afterend', `<div class="error" id="cameraStartError">${escapeHtml(error.message)}</div>`);
      stopVisionCamera();
    }
  });
}

function getSessionTaskList() {
  if (Array.isArray(state.questions) && state.questions.length > 0) return state.questions;
  if (state.participant) {
    state.questions = selectSessionTasks(state.participant);
    return state.questions;
  }
  return PREDEFINED_TASKS.slice(0, 6);
}

function currentQuestion() {
  const list = getSessionTaskList();
  const task = list[state.current] || list[0] || PREDEFINED_TASKS[0];
  const totalTasks = list.length || 6;
  const questionPart = `Task ${state.current + 1} of ${totalTasks}`;
  return {
    ...task,
    topicId: task.topicId || `TASK-${state.current + 1}`,
    questionPart: task.questionPart || questionPart
  };
}

function allQuestionLocations() {
  const list = getSessionTaskList();
  return list.map((_, taskIndex) => ({ taskIndex, subquestionIndex: 0 }));
}

function currentQuestionIndex() {
  return state.current;
}

function saveCurrentQuestionDraft() {
  const question = currentQuestion();
  state.questionDrafts[question.id] = {
    answer: state.answerDraft,
    code: state.codeDraft,
    compilerInput: state.compilerInput,
    compilerLanguage: state.compilerLanguage,
    messages: state.messages
  };
}

function restoreQuestionDraft() {
  const question = currentQuestion();
  const saved = state.questionDrafts[question.id];
  const submitted = [...state.answers].reverse().find(answer => answer.question_id === question.id);
  state.answerDraft = saved?.answer ?? submitted?.answer ?? '';
  state.codeDraft = saved?.code ?? '';
  state.compilerInput = saved?.compilerInput ?? '';
  state.compilerLanguage = saved?.compilerLanguage ?? 'java';
  state.messages = saved?.messages ?? submitted?.chat_history ?? [];
}

function renderLlmOption(name, configuredKey) {
  const configured = state.llmProviders?.[configuredKey];
  const unavailable = configured === false;
  const selected = state.selectedLLM === name;
  return `<option value="${name}" ${selected ? 'selected' : ''} ${unavailable ? 'disabled' : ''}>${name}${unavailable ? ' (not configured)' : ''}</option>`;
}

function renderExam() {
  state.assessmentStage = 'exam';
  const q = currentQuestion();
  const progress = assessmentProgressSnapshot();
  const totalTasks = (state.questions && state.questions.length) || 6;
  const userPrompts = state.messages.filter(m => m.role === 'user');
  const hasCollaborated = userPrompts.length > 0;
  const diffBadgeClass = (q.difficulty || 'Easy').toLowerCase();

  app.innerHTML = `
    <div class="exam-shell">
      <header class="exam-top">
        <div class="brand"><div class="logo">C</div><div><h1>CogniTrack <span style="color:#38dd9a">AI</span></h1><small>${escapeHtml(state.participant?.participant_id || '')}</small></div></div>
        <div class="center">Task ${state.current + 1} of ${totalTasks} · <span class="task-domain-pill">${escapeHtml(q.domain || 'General')}</span></div>
        <div class="exam-actions"><div class="timer" id="timer">--:--</div><button class="danger-btn" id="endSession" ${state.finishing ? 'disabled' : ''}>${state.finishing ? 'Ending Session…' : 'End Session'}</button></div>
      </header>
      <main class="exam-grid">
        <div class="assessment-progress card panel" aria-label="Assessment progress"><div class="assessment-progress-heading"><strong>Assessment progress</strong><span>${progress.percent}% complete</span></div><div class="assessment-progress-track"><i style="width:${progress.percent}%"></i></div><small>${progress.answered} answered · ${progress.skipped} skipped · ${progress.total - progress.completed} remaining</small></div>
        <section class="stack">
          ${state.questionTransition ? `<div class="question-transition" role="status">${escapeHtml(state.questionTransition)}</div>` : ''}
          <article class="card panel task-detail-card" id="currentQuestionCard" tabindex="-1">
            <div class="task-meta-bar">
              <span class="badge diff-badge ${diffBadgeClass}">${escapeHtml(q.difficulty || 'Easy')}</span>
              <span class="badge category-badge">${escapeHtml(q.category || 'Human-AI Collaboration')}</span>
              <span class="badge domain-badge">${escapeHtml(q.domain || 'Domain')}</span>
              <span class="expected-time-tag">⏱ ${escapeHtml(q.expectedTime || '3–5 minutes')}</span>
            </div>
            <h2 class="question-title">${escapeHtml(q.title || 'Dynamic Task')}</h2>
            
            <div class="scenario-box">
              <div class="box-header">
                <span class="box-icon">📋</span>
                <strong>Scenario & Problem Context</strong>
              </div>
              <p class="scenario-text">${escapeHtml(q.scenario || q.text)}</p>
            </div>

            ${Array.isArray(q.instructions) && q.instructions.length > 0 ? `
            <div class="focus-box">
              <div class="box-header">
                <span class="box-icon">🎯</span>
                <strong>Collaboration Focus & Objectives</strong>
              </div>
              <ol class="task-instructions-list">
                ${q.instructions.map(ins => `<li>${escapeHtml(ins)}</li>`).join('')}
              </ol>
            </div>` : ''}
          </article>

          <article class="card panel task-interaction-card">
            <div class="interaction-workflow-banner">
              <div class="workflow-step-pill ${hasCollaborated ? 'done' : 'current'}">
                <span class="step-num">1</span>
                <span>Ask AI Assistant</span>
              </div>
              <span class="step-chevron">➔</span>
              <div class="workflow-step-pill ${hasCollaborated ? 'current' : ''}">
                <span class="step-num">2</span>
                <span>Analyze Response</span>
              </div>
              <span class="step-chevron">➔</span>
              <div class="workflow-step-pill">
                <span class="step-num">3</span>
                <span>Proceed</span>
              </div>
            </div>

            <div class="collaboration-status-row">
              <div class="status-indicator-col">
                <span class="status-dot ${hasCollaborated ? 'active' : 'idle'}"></span>
                <span class="status-text">
                  ${hasCollaborated
      ? `Collaborated with <strong>${escapeHtml(state.selectedLLM)}</strong> (${userPrompts.length} prompt${userPrompts.length === 1 ? '' : 's'} exchanged)`
      : state.selectedLLM
        ? `Using <strong>${escapeHtml(state.selectedLLM)}</strong> — ask your question in the panel to the right`
        : 'Choose an AI model in the right panel to begin'}
                </span>
              </div>
              <div id="saveStatus" class="save-status" aria-live="polite">${escapeHtml(state.saveStatus || 'Ready for collaboration')}</div>
            </div>

            <div class="actions" style="margin-top:1.25rem;">
              <button class="primary proceed-task-btn" id="submitAnswer" type="button" ${state.submitting ? 'disabled' : ''}>
                <span>${state.submitting ? 'Submitting & Advancing…' : 'I have reviewed the AI response · Proceed to Next Task'}</span>
                <strong style="margin-left:8px;font-size:1.15rem;">➔</strong>
              </button>
            </div>
            <div class="error" id="examError"></div>
          </article>

          <nav class="card panel question-navigation" aria-label="Question navigation">
            <button class="secondary" id="previousQuestion" type="button" ${state.current === 0 || state.submitting ? 'disabled' : ''}>Previous Task</button>
            <span>Task ${state.current + 1} of ${totalTasks}</span>
            <button class="secondary" id="skipQuestion" type="button" ${state.submitting ? 'disabled' : ''}>Skip Task</button>
          </nav>
        </section>
        <aside class="stack">
          <article class="card panel">
             <div class="section-label">Choose AI Model</div>
             <p style="color:var(--muted)">Choose the AI model for this question part.</p>
             <select class="ai-model-select" id="aiModelSelect">
               <option value="">Select an AI model</option>
               ${renderLlmOption('ChatGPT', 'chatgpt_configured')}
               ${renderLlmOption('Groq', 'groq_configured')}
             </select>
          </article>
          ${state.selectedLLM ? `<article class="card panel chat-box">
            <div class="section-label">Ask ${state.selectedLLM}</div>
            <div class="messages" id="messages">${renderMessages()}</div>
            <div class="chat-row"><input id="chatInput" class="chat-input" placeholder="${state.selectedLLM ? `Ask ${state.selectedLLM}...` : 'Choose an AI model first'}" ${state.started && !state.chatStreaming ? '' : 'disabled'} />${state.chatStreaming ? '<button class="primary ask-model-btn stop-model-btn" style="width:auto" id="stopChat" type="button" title="Stop generating" aria-label="Stop generating">■</button>' : `<button class="primary ask-model-btn" style="width:auto" id="sendChat" type="button">${state.selectedLLM ? `Ask ${state.selectedLLM}` : 'Send'}</button>`}</div>
          </article>` : ''}
        </aside>
      </main>
    </div>`;

  bindExamEvents(q);
  if (state.questionTransition) {
    const questionCard = document.getElementById('currentQuestionCard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    questionCard?.focus({ preventScroll: true });
    window.setTimeout(() => { state.questionTransition = ''; }, 3200);
  }
  startDisplayTimer();
  saveParticipantState();
}

function renderVisionMetrics() {
  const eye = state.vision.latest;
  const facial = state.facial.latest;

  if (!eye && !facial) {
    return `<div class="vision-status"><strong>Tracking:</strong> ${escapeHtml(state.vision.status || 'Starting')} · ${escapeHtml(state.facial.status || 'Starting')}</div><small>Eye and facial metrics will appear shortly after Start Assessment.</small>`;
  }

  const eyeMetrics = eye ? `
    <span>Eye direction <strong>${escapeHtml(eye.direction || '—')}</strong></span>
    <span>Blinks <strong>${Number(eye.blink_count || 0)}</strong></span>
    <span>Fatigue <strong>${escapeHtml(eye.fatigue || '—')}</strong></span>
    <span>Tracking confidence <strong>${Math.round(Number(eye.tracking_confidence || 0) * 100)}%</strong></span>
  ` : '<span>Eye tracking <strong>Waiting</strong></span>';

  const facialMetrics = facial ? `
  <span>
    Facial expression
    <strong>
      ${escapeHtml(
    facial.emotion || 'unknown'
  )}
    </strong>
  </span>

  <span>
    Model confidence
    <strong>
      ${Math.round(
    Number(
      facial.confidence || 0
    ) * 100
  )}%
    </strong>
  </span>

  <span>
    Facial frame
    <strong>
      ${Number(
    facial.frame_id || 0
  )}
    </strong>
  </span>

  <span>
    Second
    <strong>
      ${Number(
    facial.elapsed_second || 0
  )}
    </strong>
  </span>
` : `
  <span>
    Facial expression
    <strong>Waiting</strong>
  </span>
`;

  return `<div class="vision-metrics">${eyeMetrics}${facialMetrics}</div>`;
}

function refreshVisionMetrics() {
  const container = document.getElementById('visionMetrics');
  if (container) container.innerHTML = renderVisionMetrics();
}

async function startVisionCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Webcam access requires HTTPS or localhost');
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });
    cameraCaptureVideo = document.createElement('video');
    cameraCaptureVideo.srcObject = cameraStream;
    cameraCaptureVideo.muted = true;
    cameraCaptureVideo.playsInline = true;
    await cameraCaptureVideo.play();
    state.vision.status = 'Camera connected; eye tracking active';
    state.vision.calibrated = true;
  } catch (error) {
    state.vision.status = `Camera unavailable: ${error.message}`;
    throw new Error(`Webcam access is required to start the assessment: ${error.message}`);
  }
}

function stopVisionCamera() {
  stopSharedTrackingCapture();

  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }

  cameraStream = null;
  cameraCaptureVideo = null;

  state.vision.calibrated = false;
  state.vision.status = 'Camera stopped';
  state.facial.status = 'Facial expression stopped';
}

function startSharedTrackingCapture() {
  stopSharedTrackingCapture();

  state.vision.status = 'Eye tracking starting';
  state.facial.status = 'Facial tracking starting';

  sharedCaptureTimer = setInterval(() => {
    captureSharedTrackingFrame().catch(error => {
      console.error('Shared tracking frame failed:', error);

      state.vision.status = `Tracking paused: ${error.message}`;
      state.facial.status = `Tracking paused: ${error.message}`;
    });
  }, SHARED_CAPTURE_INTERVAL_MS);

  // Send the first shared frame immediately after Start Assessment instead
  // of waiting for the first interval tick or an AI model selection.
  captureSharedTrackingFrame().catch(error => {
    console.error('Initial shared tracking frame failed:', error);
    state.vision.status = `Tracking paused: ${error.message}`;
    state.facial.status = `Tracking paused: ${error.message}`;
    refreshVisionMetrics();
  });
}


function stopSharedTrackingCapture() {
  if (sharedCaptureTimer !== null) {
    clearInterval(sharedCaptureTimer);
  }

  sharedCaptureTimer = null;
}


function metricNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}


function metricBoolean(value) {
  if (value === true || value === 1) {
    return true;
  }

  const normalized =
    String(value || '')
      .trim()
      .toLowerCase();

  return (
    normalized === 'true' ||
    normalized === '1' ||
    normalized === 'yes'
  );
}


function roundMetric(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}


function meanMetric(values) {
  const numbers =
    values
      .map(metricNumber)
      .filter(value => value !== null);

  if (!numbers.length) {
    return 0;
  }

  return roundMetric(
    numbers.reduce(
      (total, value) => total + value,
      0
    ) / numbers.length
  );
}


function minMetric(values) {
  const numbers =
    values
      .map(metricNumber)
      .filter(value => value !== null);

  return numbers.length
    ? roundMetric(Math.min(...numbers))
    : 0;
}


function maxMetric(values) {
  const numbers =
    values
      .map(metricNumber)
      .filter(value => value !== null);

  return numbers.length
    ? roundMetric(Math.max(...numbers))
    : 0;
}


function dominantValue(
  values,
  fallback = 'unknown'
) {
  const cleaned =
    values
      .map(value =>
        String(value || '')
          .trim()
          .toLowerCase()
      )
      .filter(value =>
        value &&
        value !== 'unknown' &&
        value !== 'none'
      );

  if (!cleaned.length) {
    return fallback;
  }

  const counts = new Map();

  for (const value of cleaned) {
    counts.set(
      value,
      (counts.get(value) || 0) + 1
    );
  }

  let winner = cleaned[0];
  let winnerCount = 0;

  for (const [value, count] of counts) {
    if (count > winnerCount) {
      winner = value;
      winnerCount = count;
    }
  }

  return winner;
}


function countValueChanges(values) {
  const cleaned =
    values
      .map(value =>
        String(value || '')
          .trim()
          .toLowerCase()
      )
      .filter(value =>
        value &&
        value !== 'unknown' &&
        value !== 'none'
      );

  let changes = 0;

  for (let index = 1;
    index < cleaned.length;
    index++) {

    if (
      cleaned[index] !==
      cleaned[index - 1]
    ) {
      changes++;
    }
  }

  return changes;
}


function analyzePromptSentimentLocal(message) {
  const normalized = String(message || '')
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, ' ')
    .trim();

  const words = normalized ? normalized.split(/\s+/) : [];

  const positive = new Set([
    'good', 'great', 'excellent', 'helpful', 'easy', 'clear', 'thanks',
    'thank', 'love', 'happy', 'correct', 'works', 'working', 'solved',
    'confident', 'appreciate'
  ]);

  const negative = new Set([
    'bad', 'wrong', 'difficult', 'hard', 'confused', 'confusing', 'unclear',
    'stuck', 'hate', 'angry', 'frustrated', 'frustrating', 'fail', 'failing',
    'error', 'problem', 'issue', 'unsure', 'lost', 'cannot', "can't"
  ]);

  const positivePhrases = {
    'thank you': 2,
    'very helpful': 2,
    'makes sense': 2,
    'works well': 2,
    'i understand': 1,
    'i got it': 1
  };

  const negativePhrases = {
    'do not understand': 2,
    "don't understand": 2,
    'not clear': 2,
    'not working': 2,
    "doesn't work": 2,
    'cannot solve': 2,
    "can't solve": 2,
    'i am confused': 2,
    "i'm confused": 2,
    'no idea': 2,
    'need help': 1
  };

  let score = 0;

  for (const word of words) {
    if (positive.has(word)) score++;
    if (negative.has(word)) score--;
  }

  for (const [phrase, weight] of Object.entries(positivePhrases)) {
    if (normalized.includes(phrase)) score += weight;
  }

  for (const [phrase, weight] of Object.entries(negativePhrases)) {
    if (normalized.includes(phrase)) score -= weight;
  }

  return score > 0
    ? 'positive'
    : score < 0
      ? 'negative'
      : 'neutral';
}


function multimodalSecondKey(summary) {
  return [
    summary.participant_id,
    summary.question_id,
    summary.task_number,
    summary.elapsed_second
  ].join('|');
}


function trySaveMultimodalSecond(key, force = false) {
  const camera = completedCameraSeconds.get(key) || null;
  const behavior = completedBehaviorSeconds.get(key) || null;

  // During normal processing, wait for both summaries.
  if (!force && (!camera || !behavior)) {
    return Promise.resolve(null);
  }

  if (!camera && !behavior) {
    return Promise.resolve(null);
  }

  const reference = camera || behavior;

  // Remove before the HTTP request so the same second cannot be scheduled
  // twice. Failed requests restore the summaries for a later retry.
  completedCameraSeconds.delete(key);
  completedBehaviorSeconds.delete(key);

  const payload = {
    participant_id: reference.participant_id,
    question_id: reference.question_id,
    task_number: reference.task_number,
    elapsed_second: reference.elapsed_second,
    camera,
    behavior
  };

  let savePromise;

  savePromise = safePost(
    '/multimodal-tracking/second',
    payload,
    state.participantSessionToken
  )
    .catch(error => {
      console.error('Multimodal second save failed:', error);

      if (camera) {
        completedCameraSeconds.set(key, camera);
      }

      if (behavior) {
        completedBehaviorSeconds.set(key, behavior);
      }

      return null;
    })
    .finally(() => {
      multimodalSavePromises.delete(savePromise);
    });

  multimodalSavePromises.add(savePromise);
  return savePromise;
}


function registerCameraSecondSummary(summary) {
  const key = multimodalSecondKey(summary);
  completedCameraSeconds.set(key, summary);
  void trySaveMultimodalSecond(key);
}


function registerBehaviorSecondSummary(summary) {
  const key = multimodalSecondKey(summary);
  completedBehaviorSeconds.set(key, summary);
  void trySaveMultimodalSecond(key);
}


async function waitForMultimodalSaves() {
  while (multimodalSavePromises.size) {
    const pending = Array.from(multimodalSavePromises);
    await Promise.allSettled(pending);
  }
}


async function flushUnmatchedMultimodalSeconds(questionId) {
  const keys = new Set([
    ...completedCameraSeconds.keys(),
    ...completedBehaviorSeconds.keys()
  ]);

  const matchingKeys = Array.from(keys).filter(key => {
    const summary =
      completedCameraSeconds.get(key) ||
      completedBehaviorSeconds.get(key);

    return summary && summary.question_id === questionId;
  });

  for (const key of matchingKeys) {
    await trySaveMultimodalSecond(key, true);
  }

  await waitForMultimodalSaves();
}


function buildCameraSecondSummary(buffer) {
  const frames = buffer.frames;

  // ---------------------------
  // EYE FRAME RESULTS
  // ---------------------------
  const eyeSamples = frames
    .map(frame => frame.eye)
    .filter(Boolean);

  const validEyeSamples = eyeSamples.filter(sample =>
    metricBoolean(sample.face_detected)
  );

  const directions = validEyeSamples.map(sample => sample.direction);
  const fatigueValues = validEyeSamples.map(sample => sample.fatigue);

  const blinkCounts = eyeSamples
    .map(sample => metricNumber(sample.blink_count))
    .filter(value => value !== null);

  const blinkLatencies = validEyeSamples
    .map(sample => metricNumber(sample.blink_latency_ms))
    .filter(value => value !== null && value > 0);

  // ---------------------------
  // FACIAL FRAME RESULTS
  // ---------------------------
  const facialSamples = frames
    .map(frame => frame.facial)
    .filter(Boolean);

  const facialDetectedSamples = facialSamples.filter(sample =>
    metricBoolean(sample.face_detected)
  );

  const validFacialSamples = facialDetectedSamples.filter(sample => {
    const emotion = String(sample.emotion || '')
      .trim()
      .toLowerCase();

    return CAMERA_EMOTIONS.includes(emotion);
  });

  const emotions = validFacialSamples.map(sample =>
    String(sample.emotion).toLowerCase()
  );

  const facialCount = validFacialSamples.length;

  const emotionRatio = emotion => {
    if (!facialCount) {
      return 0;
    }

    const count = emotions.filter(value => value === emotion).length;
    return roundMetric(count / facialCount);
  };

  return {
    participant_id: buffer.participant_id,
    question_id: buffer.question_id,
    task_number: buffer.task_number,
    elapsed_second: buffer.elapsed_second,

    first_frame_id: buffer.first_frame_id,
    last_frame_id: buffer.last_frame_id,
    frame_count: frames.length,
    paired_frame_count: frames.filter(frame => frame.eye && frame.facial).length,

    first_captured_at: buffer.first_captured_at,
    last_captured_at: buffer.last_captured_at,

    // ===========================
    // EYE FEATURES
    // ===========================
    eye_sample_count: eyeSamples.length,

    eye_face_detected_ratio: eyeSamples.length
      ? roundMetric(validEyeSamples.length / eyeSamples.length)
      : 0,

    mean_ear: meanMetric(validEyeSamples.map(sample => sample.ear)),
    min_ear: minMetric(validEyeSamples.map(sample => sample.ear)),
    max_ear: maxMetric(validEyeSamples.map(sample => sample.ear)),

    mean_perclos: meanMetric(validEyeSamples.map(sample => sample.perclos)),
    max_perclos: maxMetric(validEyeSamples.map(sample => sample.perclos)),

    dominant_gaze: dominantValue(directions),
    gaze_change_count: countValueChanges(directions),

    // VisionAnalyzer returns saccade as a categorical string:
    // "fast" = saccade event, "focused" = no saccade event.
    saccade_count: validEyeSamples.filter(sample =>
      String(sample.saccade || '')
        .trim()
        .toLowerCase() === 'fast'
    ).length,

    blink_events: validEyeSamples.filter(sample =>
      metricBoolean(sample.blinked)
    ).length,

    // blink_count is cumulative in the Eye analyzer, so never sum it.
    blink_count_end: blinkCounts.length
      ? Math.max(...blinkCounts)
      : 0,

    mean_blink_latency_ms: meanMetric(blinkLatencies),
    mean_head_pitch: meanMetric(validEyeSamples.map(sample => sample.head_pitch)),
    mean_head_yaw: meanMetric(validEyeSamples.map(sample => sample.head_yaw)),
    dominant_fatigue: dominantValue(fatigueValues),
    mean_tracking_confidence: meanMetric(
      validEyeSamples.map(sample => sample.tracking_confidence)
    ),

    // ===========================
    // FACIAL FEATURES
    // ===========================
    facial_sample_count: facialSamples.length,

    facial_face_detected_ratio: facialSamples.length
      ? roundMetric(facialDetectedSamples.length / facialSamples.length)
      : 0,

    dominant_emotion: dominantValue(emotions),
    mean_emotion_confidence: meanMetric(
      validFacialSamples.map(sample => sample.model_confidence)
    ),
    emotion_change_count: countValueChanges(emotions),

    angry_ratio: emotionRatio('angry'),
    disgust_ratio: emotionRatio('disgust'),
    fearful_ratio: emotionRatio('fearful'),
    happy_ratio: emotionRatio('happy'),
    neutral_ratio: emotionRatio('neutral'),
    sad_ratio: emotionRatio('sad'),
    surprised_ratio: emotionRatio('surprised')
  };
}


async function flushCameraSecondBuffer() {
  if (!cameraSecondBuffer || !cameraSecondBuffer.frames.length) {
    cameraSecondBuffer = null;
    return;
  }

  const completedBuffer = cameraSecondBuffer;
  cameraSecondBuffer = null;

  const summary = buildCameraSecondSummary(completedBuffer);
  registerCameraSecondSummary(summary);
}


async function addFrameToCameraSecondBuffer(
  frameMetadata,
  eyeMetrics,
  facialMetrics
) {
  const newSecondStarted =
    cameraSecondBuffer &&
    (
      cameraSecondBuffer.question_id !== frameMetadata.question_id ||
      cameraSecondBuffer.elapsed_second !== frameMetadata.elapsed_second
    );

  if (newSecondStarted) {
    await flushCameraSecondBuffer();
  }

  if (!cameraSecondBuffer) {
    cameraSecondBuffer = {
      participant_id: frameMetadata.participant_id,
      question_id: frameMetadata.question_id,
      task_number: frameMetadata.task_number,
      elapsed_second: frameMetadata.elapsed_second,
      first_frame_id: frameMetadata.frame_id,
      last_frame_id: frameMetadata.frame_id,
      first_captured_at: frameMetadata.captured_at,
      last_captured_at: frameMetadata.captured_at,
      frames: []
    };
  }

  cameraSecondBuffer.last_frame_id = frameMetadata.frame_id;
  cameraSecondBuffer.last_captured_at = frameMetadata.captured_at;

  cameraSecondBuffer.frames.push({
    frame_id: frameMetadata.frame_id,
    eye: eyeMetrics,
    facial: facialMetrics
  });
}


async function waitForSharedCaptureIdle(timeoutMs = 2000) {
  const startedAt = Date.now();

  while (
    sharedCaptureInFlight &&
    Date.now() - startedAt < timeoutMs
  ) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

async function finalizeQuestionTracking(questionId, finalBehaviorSecond) {
  try {
    await waitForSharedCaptureIdle();
    await Promise.all([
      flushCameraSecondBuffer(),
      finalBehaviorSecond ? saveBehaviorSecond(finalBehaviorSecond) : Promise.resolve(null)
    ]);
    await waitForMultimodalSaves();
    await flushUnmatchedMultimodalSeconds(questionId);
  } catch (error) {
    console.warn('Question tracking finalization failed:', error);
  }
}


function createBehaviorSecondBuffer(elapsedSecond) {
  const q = currentQuestion();

  return {
    participant_id: state.participant.participant_id,
    question_id: q.id,
    task_number: state.current + 1,
    elapsed_second: elapsedSecond,
    captured_at: new Date().toISOString(),

    // Keyboard
    keypress_count: 0,
    backspace_count: 0,
    typing_active: false,
    thinking_pause_seconds: 0,

    // Mouse
    mouse_move_count: 0,
    cursor_distance_px: 0,
    scroll_up_count: 0,
    scroll_down_count: 0,
    scroll_count: 0,
    mouse_active: false,

    // Prompt
    prompt_sent: false,
    prompt_length_words: 0,
    prompt_count_so_far: behaviorPromptCount,
    time_since_last_prompt_seconds: 0,
    prompt_sentiment: 'none'
  };
}


function currentBehaviorSecond(now = Date.now()) {
  if (!state.startTime) return 1;

  return Math.floor(
    Math.max(0, now - state.startTime) / 1000
  ) + 1;
}


async function saveBehaviorSecond(buffer) {
  if (!buffer) return;

  // Avoid long floating-point tails from pointer-distance accumulation.
  buffer.cursor_distance_px = roundMetric(buffer.cursor_distance_px);

  registerBehaviorSecondSummary({
    ...buffer
  });
}


function rolloverBehaviorSecond(now = Date.now()) {
  if (!state.started || !state.startTime || !state.participant) return;

  const elapsedSecond = currentBehaviorSecond(now);

  if (!behaviorSecondBuffer) {
    behaviorSecondBuffer = createBehaviorSecondBuffer(elapsedSecond);
    return;
  }

  if (elapsedSecond <= behaviorSecondBuffer.elapsed_second) return;

  const completedBuffer = behaviorSecondBuffer;
  behaviorSecondBuffer = createBehaviorSecondBuffer(elapsedSecond);

  // Saving happens asynchronously so input capture is not blocked.
  void saveBehaviorSecond(completedBuffer);
}


function startBehaviorSecondTracking() {
  stopBehaviorSecondTracking();

  behaviorSecondBuffer = createBehaviorSecondBuffer(1);
  behaviorSecondTimer = setInterval(() => {
    rolloverBehaviorSecond(Date.now());
  }, 200);
}


function stopBehaviorSecondTracking() {
  if (behaviorSecondTimer !== null) {
    clearInterval(behaviorSecondTimer);
  }

  behaviorSecondTimer = null;
}


async function captureSharedTrackingFrame() {
  // Camera, eye, and facial tracking start with the assessment. Question-level
  // input tracking still starts only after the user selects an AI model.
  if (
    !state.vision.calibrated ||
    !state.trackingActive ||
    !(state.trackingStartedAt || state.startTime) ||
    state.submitting ||
    state.finishing ||
    !cameraStream ||
    !state.participant ||
    sharedCaptureInFlight ||
    !cameraCaptureVideo?.videoWidth
  ) {
    return;
  }

  const track = cameraStream.getVideoTracks()[0];

  if (!track || track.readyState !== 'live') {
    state.vision.status = 'Camera stream unavailable';
    state.facial.status = 'Camera stream unavailable';
    return;
  }

  sharedCaptureInFlight = true;

  try {
    // ---------------------------------------------------------
    // 1. CAPTURE THE WEBCAM IMAGE ONLY ONCE
    // ---------------------------------------------------------

    const canvas = document.createElement('canvas');

    canvas.width = 320;

    canvas.height = Math.round(
      320 *
      cameraCaptureVideo.videoHeight /
      cameraCaptureVideo.videoWidth
    );

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Unable to create shared tracking canvas');
    }

    context.drawImage(
      cameraCaptureVideo,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // ONE image used by both components.
    const image = canvas.toDataURL(
      'image/jpeg',
      0.75
    );


    // ---------------------------------------------------------
    // 2. CREATE COMMON FRAME INFORMATION
    // ---------------------------------------------------------

    const now = Date.now();

    const q = currentQuestion();

    const frameId = ++sharedFrameId;

    const elapsedMs = Math.max(
      0,
      now - (state.trackingStartedAt || state.startTime)
    );

    const elapsedSecond =
      Math.floor(elapsedMs / 1000) + 1;

    const capturedAt =
      new Date(now).toISOString();


    // ---------------------------------------------------------
    // 3. COMMON METADATA
    // ---------------------------------------------------------

    const commonFrameData = {
      participant_id:
        state.participant.participant_id,

      question_id:
        q.id,

      task_number:
        state.current + 1,

      frame_id:
        frameId,

      elapsed_ms:
        elapsedMs,

      elapsed_second:
        elapsedSecond,

      captured_at:
        capturedAt,

      image:
        image
    };
    // ---------------------------------------------------------
    // 5. SEND THE SAME FRAME TO BOTH COMPONENTS
    // ---------------------------------------------------------

    let eyeResult;
    let facialResult;
    try {
      const response = await safePost(
        '/vision/frame',
        {
          ...commonFrameData,
          persist: true
        },
        state.participantSessionToken
      );
      eyeResult = { status: 'fulfilled', value: response.eyeResult };
      facialResult = { status: 'fulfilled', value: response.facialResult };
    } catch (error) {
      eyeResult = { status: 'rejected', reason: error };
      facialResult = { status: 'rejected', reason: error };
    }

    // ---------------------------------------------------------
    // 6. HANDLE EYE RESULT
    // ---------------------------------------------------------

    if (eyeResult.status === 'fulfilled') {

      const result = eyeResult.value;

      if (result) {
        state.vision.latest = {
          ...(state.vision.latest || {}),
          ...result.metrics
        };

        state.vision.samples++;

        state.vision.status =
          result.metrics?.face_detected
            ? 'Analysis active'
            : 'No face detected';
      }

    } else {

      console.error(
        'Eye tracking failed:',
        eyeResult.reason
      );

      state.vision.status =
        `Eye tracking paused: ${eyeResult.reason?.message ||
        'Unknown error'
        }`;
    }


    // ---------------------------------------------------------
    // 7. HANDLE FACIAL RESULT
    // ---------------------------------------------------------

    if (facialResult.status === 'fulfilled') {

      const response =
        facialResult.value || {};

      const frameResult =
        response.frame_result || {};

      state.facial.samples++;

      state.facial.latest = {

        frame_id:
          Number(
            response.frame_id ||
            frameId
          ),

        elapsed_ms:
          Number(
            response.elapsed_ms ||
            elapsedMs
          ),

        elapsed_second:
          Number(
            response.elapsed_second ||
            elapsedSecond
          ),

        face_detected:
          Boolean(
            frameResult.face_detected
          ),

        emotion:
          frameResult.emotion ||
          'unknown',

        confidence:
          Number(
            frameResult.model_confidence ||
            0
          ),

        inference_ms:
          Number(
            frameResult.inference_ms ||
            0
          ),

        processing_ms:
          Number(
            frameResult.processing_ms ||
            0
          ),

        reason:
          frameResult.reason || ''
      };


      if (frameResult.face_detected) {

        state.facial.status =
          `Expression active: ${frameResult.emotion ||
          'unknown'
          }`;

      } else {

        state.facial.status =
          'No usable face detected';
      }

    } else {

      console.error(
        'Facial-expression tracking failed:',
        facialResult.reason
      );

      state.facial.status =
        `Facial tracking paused: ${facialResult.reason?.message ||
        'Unknown error'
        }`;
    }


    const eyeMetricsForBuffer =
      eyeResult.status === 'fulfilled'
        ? (eyeResult.value?.metrics || null)
        : null;

    const facialMetricsForBuffer =
      facialResult.status === 'fulfilled'
        ? (facialResult.value?.frame_result || null)
        : null;

    await addFrameToCameraSecondBuffer(
      {
        participant_id: commonFrameData.participant_id,
        question_id: commonFrameData.question_id,
        task_number: commonFrameData.task_number,
        frame_id: commonFrameData.frame_id,
        elapsed_second: commonFrameData.elapsed_second,
        captured_at: commonFrameData.captured_at
      },
      eyeMetricsForBuffer,
      facialMetricsForBuffer
    );

    refreshVisionMetrics();

  } finally {

    sharedCaptureInFlight = false;

  }
}

async function sendMonitoringHeartbeat(status = 'active') {
  if (!state.participant) return;
  const q = currentQuestion();
  const totalParts = (state.questions && state.questions.length) || 6;
  const completedParts = state.current;
  const progressPercent = status === 'completed' ? 100 : Math.round(completedParts / totalParts * 1000) / 10;
  return safePut('/monitoring/heartbeat', {
    participant_id: state.participant.participant_id,
    status,
    question_id: q.id,
    question_number: state.current + 1,
    subquestion_number: 1,
    progress_percent: progressPercent,
    question_started: state.started,
    inactivity_seconds: Math.floor((Date.now() - state.lastInteractionAt) / 1000),
    session_duration_seconds: Math.max(0, Math.floor((Date.now() - new Date(state.sessionStart).getTime()) / 1000)),
    tab_switches: state.tracking.tabSwitches,
    vision_status: state.vision.status,
    fatigue: state.vision.latest?.fatigue || 'unknown',
    captured_at: new Date().toISOString()
  }, state.participantSessionToken);
}

function renderMessages() {
  if (!state.messages.length && state.selectedLLM) {
    const firstName = escapeHtml((state.participant?.full_name || 'there').trim().split(/\s+/)[0]);
    const modelName = escapeHtml(state.selectedLLM);
    const modelIcon = state.selectedLLM === 'ChatGPT' ? 'C' : 'Q';
    return `<div class="model-welcome"><div class="model-welcome-icon model-${state.selectedLLM.toLowerCase()}">${modelIcon}</div><h3>Hello ${firstName}, how can I help you today?</h3><p>You are now using ${modelName}. Type your question below to get started.</p></div>`;
  }
  if (!state.messages.length) return `<div class="model-welcome"><h3>Choose your AI assistant</h3><p>Select ChatGPT or Groq to begin.</p></div>`;
  return state.messages.map(m => `<div class="message ${m.role}">${escapeHtml(m.content)}</div>`).join('');
}

function renderCompilerResult() {
  if (!state.compilerResult) return '';
  const result = state.compilerResult;
  const sections = [];
  if (result.compile_output) sections.push(`Compiler diagnostics:\n${result.compile_output}`);
  if (result.output) sections.push(`Program output:\n${result.output}`);
  const output = sections.join('\n\n') || 'Program completed with no output.';
  const failed = result.error || Number(result.exit_code ?? 0) !== 0;
  const label = result.error ? 'Compiler error' : failed ? 'Compilation / runtime result' : 'Program output';
  return `<div class="compiler-result ${failed ? 'compiler-result-error' : ''}"><strong>${label}</strong><pre>${escapeHtml(output)}</pre></div>`;
}

function bindExamEvents(q) {
  const answerEditor = document.getElementById('answer');
  if (answerEditor) {
    answerEditor.addEventListener('input', event => {
      state.answerDraft = event.target.value;
      setSaveStatus('Draft saved locally');
      saveParticipantState();
    });
  }
  const aiModelSelect = document.getElementById('aiModelSelect');
  if (aiModelSelect) {
    aiModelSelect.addEventListener('change', async event => {
      if (!event.target.value) return;
      state.selectedLLM = event.target.value;
      if (state.started) renderExam();
      else await startCurrentQuestion(q);
    });
  }
  const codeEditor = document.getElementById('codeEditor');
  if (codeEditor) {
    codeEditor.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      const indent = '  ';
      const value = codeEditor.value;
      const start = codeEditor.selectionStart;
      const end = codeEditor.selectionEnd;
      const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const lineEnd = value.indexOf('\n', end);
      const blockEnd = lineEnd === -1 ? value.length : lineEnd;
      const selectedBlock = value.slice(lineStart, blockEnd);
      const lines = selectedBlock.split('\n');
      const hasMultiLineSelection = lines.length > 1 || start !== end;

      if (event.shiftKey) {
        const updatedLines = lines.map(line => line.startsWith(indent) ? line.slice(indent.length) : line.startsWith(' ') ? line.slice(1) : line);
        const updatedBlock = updatedLines.join('\n');
        codeEditor.value = value.slice(0, lineStart) + updatedBlock + value.slice(blockEnd);
        const removedFromFirstLine = selectedBlock.length - updatedBlock.length;
        codeEditor.selectionStart = Math.max(lineStart, start - (value.slice(lineStart, start).startsWith(indent) ? indent.length : 0));
        codeEditor.selectionEnd = Math.max(codeEditor.selectionStart, end - removedFromFirstLine);
      } else if (hasMultiLineSelection) {
        const updatedBlock = lines.map(line => indent + line).join('\n');
        codeEditor.value = value.slice(0, lineStart) + updatedBlock + value.slice(blockEnd);
        codeEditor.selectionStart = start + indent.length;
        codeEditor.selectionEnd = end + indent.length * lines.length;
      } else {
        codeEditor.value = value.slice(0, start) + indent + value.slice(end);
        codeEditor.selectionStart = codeEditor.selectionEnd = start + indent.length;
      }
      state.codeDraft = codeEditor.value;
      saveParticipantState();
    });
    codeEditor.addEventListener('input', event => { state.codeDraft = event.target.value; setSaveStatus('Draft saved locally'); saveParticipantState(); });
    document.getElementById('compilerLanguage')?.addEventListener('change', event => { state.compilerLanguage = event.target.value; renderExam(); });
    document.getElementById('compilerInput')?.addEventListener('input', event => { state.compilerInput = event.target.value; saveParticipantState(); });
    const runBtn = document.getElementById('runCode');
    if (runBtn) runBtn.onclick = runCode;
  }
  const sendChatButton = document.getElementById('sendChat');
  const stopChatButton = document.getElementById('stopChat');
  const chatInput = document.getElementById('chatInput');
  // Capture Backspace from the whole assessment page, including laptop
  // keyboard input after focus moves between answer, chat, and code fields.
  keyboardTracker.attach(document);
  if (sendChatButton && chatInput) {
    sendChatButton.onclick = sendChat;
    chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
  }
  if (stopChatButton) stopChatButton.onclick = stopChat;
  const submitBtn = document.getElementById('submitAnswer');
  if (submitBtn) submitBtn.onclick = submitCurrentAnswer;
  const prevBtn = document.getElementById('previousQuestion');
  if (prevBtn) prevBtn.onclick = goToPreviousQuestion;
  const skipBtn = document.getElementById('skipQuestion');
  if (skipBtn) skipBtn.onclick = skipCurrentQuestion;
  document.querySelectorAll('[data-question-index]').forEach(button => {
    button.onclick = () => navigateToQuestion(Number(button.dataset.questionIndex));
  });
  const endSessionBtn = document.getElementById('endSession');
  if (endSessionBtn) {
    endSessionBtn.onclick = () => {
      if (state.finishing) return;
      if (!window.confirm('End this assessment early? You will proceed to the NASA-TLX workload verification to measure cognitive load change from your baseline.')) return;
      prepareQuestionNavigation();
      renderNasaTlxAssessment(true);
    };
  }
}

function prepareQuestionNavigation() {
  saveCurrentQuestionDraft();
  if (state.started) {
    stopBehaviorSecondTracking();
    mouseTracker.stop();
    state.started = false;
    state.trackingActive = false;
    state.startTime = null;
  }
}

function navigateToQuestion(index) {
  const totalTasks = (state.questions && state.questions.length) || 6;
  if (index < 0 || index >= totalTasks || index === state.current || state.submitting) return;
  prepareQuestionNavigation();
  state.current = index;
  state.subquestion = 0;
  state.selectedLLM = '';
  state.compilerResult = null;
  const nextQuestion = currentQuestion();
  state.questionTransition = `Task changed: Task ${state.current + 1} of ${totalTasks} - ${nextQuestion.title || nextQuestion.topic}`;
  restoreQuestionDraft();
  renderExam();
}

async function startCurrentQuestion(q) {
  if (!state.selectedLLM || state.started) return;
  const startTime = Date.now();
  const totalTasks = (state.questions && state.questions.length) || 6;
  try {
    await safePost('/questions/start', {
      participant_id: state.participant.participant_id,
      topic_id: q.topicId || `TASK-${state.current + 1}`,
      question_id: q.id,
      question_number: state.current + 1,
      subquestion_number: 1,
      question_part: q.questionPart || `Task ${state.current + 1} of ${totalTasks}`,
      llm: state.selectedLLM,
      trial_number: state.current + 1,
      started_at: new Date(startTime).toISOString()
    }, state.participantSessionToken);
    state.started = true;
    state.startTime = startTime;
    state.trackingActive = true;
    state.trackingStartedAt = startTime;

    // New question = new synchronized frame sequence and second-level buffers.
    sharedFrameId = 0;
    cameraSecondBuffer = null;
    behaviorSecondBuffer = null;

    completedCameraSeconds.clear();
    completedBehaviorSeconds.clear();
    multimodalSavePromises.clear();
    behaviorPromptCount = 0;
    lastBehaviorPromptAt = null;
    lastBehaviorKeyAt = null;
    lastBehaviorMousePoint = null;
    startBehaviorSecondTracking();

    state.facial.latest = null;
    state.facial.status = 'Collecting facial-expression frames';
    keyboardTracker.reset(startTime);
    mouseTracker.start(startTime);
    renderExam();
  } catch (error) {
    showExamError(`Unable to start question: ${error.message}`);
  }
}

function goToPreviousQuestion() {
  navigateToQuestion(currentQuestionIndex() - 1);
}

function skipCurrentQuestion() {
  if (!window.confirm('Skip this task? It will be recorded as skipped.')) return;
  if (state.submitting) return;
  prepareQuestionNavigation();
  const skippedId = currentQuestion().id;
  if (!state.skippedQuestionIds.includes(skippedId)) state.skippedQuestionIds.push(skippedId);
  const totalTasks = (state.questions && state.questions.length) || 6;
  const completedLastTask = state.current >= totalTasks - 1;
  if (completedLastTask) {
    state.answerDraft = '';
    state.codeDraft = '';
    state.messages = [];
    return renderNasaTlxAssessment();
  }
  state.current++;
  state.subquestion = 0;
  state.selectedLLM = '';
  state.compilerResult = null;
  const nextQuestion = currentQuestion();
  state.questionTransition = `Task changed: ${nextQuestion.title || nextQuestion.topic}`;
  restoreQuestionDraft();
  renderExam();
}

async function sendChat() {
  if (state.chatStreaming) return;
  if (!state.started) return showExamError('Select an LLM to begin the question.');
  if (!state.selectedLLM) return showExamError('Select an LLM first.');
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  const promptSentAt = Date.now();
  const promptElapsedSecond = currentBehaviorSecond(promptSentAt);
  rolloverBehaviorSecond(promptSentAt);

  behaviorPromptCount++;

  const timeSinceLastPrompt = lastBehaviorPromptAt === null
    ? 0
    : (promptSentAt - lastBehaviorPromptAt) / 1000;

  lastBehaviorPromptAt = promptSentAt;

  if (behaviorSecondBuffer) {
    behaviorSecondBuffer.prompt_sent = true;
    behaviorSecondBuffer.prompt_length_words = text
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .length;
    behaviorSecondBuffer.prompt_count_so_far = behaviorPromptCount;
    behaviorSecondBuffer.time_since_last_prompt_seconds = roundMetric(
      timeSinceLastPrompt
    );
    behaviorSecondBuffer.prompt_sentiment =
      analyzePromptSentimentLocal(text);
  }

  state.messages.push({ role: 'user', content: text });
  input.value = '';
  const totalTasks = (state.questions && state.questions.length) || 6;
  const q = currentQuestion();
  const payload = {
    participant_id: state.participant.participant_id,
    topic_id: q.topicId || `TASK-${state.current + 1}`,
    question_id: q.id,
    elapsed_second: promptElapsedSecond,
    task_name: q.title,
    question_text: q.text,
    question_number: state.current + 1,
    subquestion_number: 1,
    question_part: q.questionPart || `Task ${state.current + 1} of ${totalTasks}`,
    trial_number: state.current + 1,
    provider: state.selectedLLM,
    message: text,
    history: state.messages.map(message => ({ ...message }))
  };
  const assistantMessage = { role: 'assistant', content: 'Searching the web…' };
  state.messages.push(assistantMessage);
  state.chatStreaming = true;
  state.chatStopRequested = false;
  state.chatAbortController = new AbortController();
  renderExam();
  let receivedToken = false;
  try {
    await safeStreamPost('/llm/chat/stream', payload, event => {
      if (event.type === 'status' && !receivedToken) assistantMessage.content = event.message;
      if (event.type === 'token') {
        if (!receivedToken) assistantMessage.content = '';
        receivedToken = true;
        assistantMessage.content += event.content;
      }
      if (event.type === 'error') throw new Error(event.message);
      const messagesElement = document.getElementById('messages');
      if (messagesElement) {
        messagesElement.innerHTML = renderMessages();
        messagesElement.scrollTop = messagesElement.scrollHeight;
      }
    }, state.participantSessionToken, state.chatAbortController.signal);
    if (!receivedToken) assistantMessage.content = 'The model completed without returning text. Please retry.';
  } catch (error) {
    if (state.chatStopRequested || error.name === 'AbortError') {
      assistantMessage.content = `${assistantMessage.content || ''}\n\nGeneration stopped.`.trim();
    } else {
      assistantMessage.role = 'error';
      assistantMessage.content = `Message failed: ${error.message}. Please retry.`;
    }
  } finally {
    state.chatStreaming = false;
    state.chatAbortController = null;
    state.chatStopRequested = false;
  }
  renderExam();
}

function stopChat() {
  if (!state.chatStreaming || !state.chatAbortController) return;
  state.chatStopRequested = true;
  state.chatAbortController.abort();
}

async function submitCurrentAnswer() {
  if (state.submitting) return;
  if (!state.started) return showExamError('Please select an AI model to begin collaboration on this task.');
  if (!state.selectedLLM) return showExamError('Please select an AI model first.');
  const userPrompts = state.messages.filter(m => m.role === 'user');
  if (userPrompts.length === 0) {
    return showExamError('Please ask the AI assistant at least one question regarding this task before proceeding.');
  }
  state.submitting = true;

  const activeQuestionId = currentQuestion().id;

  // Stop collecting new behavior immediately, but finalize tracking after the
  // answer has been accepted so a slow telemetry endpoint cannot block the
  // participant's primary action.
  stopBehaviorSecondTracking();
  rolloverBehaviorSecond(Date.now());
  const finalBehaviorSecond = behaviorSecondBuffer;
  behaviorSecondBuffer = null;

  const totalTasks = (state.questions && state.questions.length) || 6;
  const promptCount = userPrompts.length;
  const answer = `Task reviewed and completed via AI collaboration with ${state.selectedLLM} (${promptCount} prompt${promptCount === 1 ? '' : 's'} exchanged).`;
  state.answerDraft = answer;

  const q = currentQuestion();
  const record = {
    participant_id: state.participant.participant_id,
    topic_id: q.topicId || `TASK-${state.current + 1}`,
    question_id: q.id,
    question_number: state.current + 1,
    subquestion_number: 1,
    question_part: q.questionPart || `Task ${state.current + 1} of ${totalTasks}`,
    llm: state.selectedLLM,
    trial_number: state.current + 1,
    answer,
    paas_rating: null,
    started_at: new Date(state.startTime).toISOString(),
    submitted_at: new Date().toISOString(),
    duration_seconds: Math.round((Date.now() - state.startTime) / 1000),
    chat_history: state.messages,
    interaction_summary: { ...state.tracking }
  };
  try {
    setSaveStatus('Saving response to PostgreSQL…');
    await safePost('/answers/submit', record, state.participantSessionToken);
    setSaveStatus('Task completed and saved', 'success');
    void Promise.allSettled([
      saveKeyboardWithRetry(keyboardTracker.finalize(), 'question_submit', true),
      mouseTracker.flush('question_submit', true),
      finalizeQuestionTracking(activeQuestionId, finalBehaviorSecond)
    ]);
  } catch (error) {
    state.submitting = false;

    if (state.started && state.startTime && state.participant) {
      behaviorSecondBuffer = null;
      startBehaviorSecondTracking();
    }

    renderExam();
    setSaveStatus('Save failed — retry proceeding', 'error');
    showExamError(`Task progress was not saved: ${error.message}. Please retry.`);
    return;
  }
  mouseTracker.stop();
  state.answers.push(record);
  const completedLastTask = state.current >= totalTasks - 1;
  if (completedLastTask) {
    state.submitting = false;
    state.started = false;
    state.startTime = null;
    return renderNasaTlxAssessment();
  }
  state.current++;
  state.subquestion = 0;
  state.started = false;
  state.startTime = null;
  state.paas = null;
  // Do not carry the previous question's provider into the next question.
  // Keeping it selected auto-started the next question, which disabled
  // Previous before the participant had a chance to use it.
  state.selectedLLM = '';
  state.answerDraft = '';
  state.codeDraft = '';
  state.compilerInput = '';
  state.compilerLanguage = 'java';
  state.compilerResult = null;
  state.codeRunning = false;
  state.messages = [];
  state.submitting = false;
  renderExam();
}

async function runCode() {
  if (!state.started || state.codeRunning) return;
  const sourceCode = document.getElementById('codeEditor').value.trim();
  state.codeDraft = sourceCode;
  state.compilerInput = document.getElementById('compilerInput').value;
  if (!sourceCode) return showExamError('Write code before running it.');
  state.codeRunning = true;
  renderExam();
  try {
    state.compilerResult = await safePost('/code/run', { language: state.compilerLanguage, source_code: sourceCode, stdin: state.compilerInput }, state.participantSessionToken);
  } catch (error) {
    state.compilerResult = { error: true, output: error.message };
  } finally {
    state.codeRunning = false;
    renderExam();
  }
}

function nasaTlxRatingsComplete() {
  return NASA_TLX_DIMENSIONS.every(d => Number.isFinite(state.nasaTlx[d.key]) && state.nasaTlx[d.key] >= 0 && state.nasaTlx[d.key] <= 10);
}

// Final survey override: keep the visible end-of-assessment control on the
// same 0-10 scale as the baseline survey and the PostgreSQL contract.
function renderNasaTlxAssessment(endedEarly = false) {
  state.assessmentStage = 'nasa';
  state.endedEarly = Boolean(endedEarly);
  state.questionRatings = [];
  clearInterval(state.timerHandle);

  // Pre-populate missing dimensions from baseline or default 5 so verification can start immediately
  NASA_TLX_DIMENSIONS.forEach(d => {
    if (!Number.isFinite(state.nasaTlx[d.key])) {
      state.nasaTlx[d.key] = Number.isFinite(state.baselineNasaTlx[d.key]) ? state.baselineNasaTlx[d.key] : 5;
    }
  });

  const getBaselineAvg = () => {
    const vals = NASA_TLX_DIMENSIONS.map(d => state.baselineNasaTlx[d.key]).filter(Number.isFinite);
    return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const getPostAvg = () => {
    const vals = NASA_TLX_DIMENSIONS.map(d => state.nasaTlx[d.key]).filter(Number.isFinite);
    return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const getStrainBadgeInfo = (delta, pct) => {
    if (delta >= 1.8 || pct >= 35) {
      return { label: 'High Strain Spike', pillClass: 'strain-high', icon: '▲▲', desc: 'Significant cognitive load elevation from baseline' };
    } else if (delta >= 0.5 || pct >= 10) {
      return { label: 'Moderate Load Increase', pillClass: 'strain-moderate', icon: '▲', desc: 'Noticeable workload rise during collaboration' };
    } else if (delta <= -0.5) {
      return { label: 'Cognitive Recovery', pillClass: 'strain-recovery', icon: '▼', desc: 'Workload reduced below pre-task baseline' };
    } else {
      return { label: 'Stable Workload', pillClass: 'strain-stable', icon: '■', desc: 'Workload consistent with baseline' };
    }
  };

  const baseAvg = getBaselineAvg();
  const postAvg = getPostAvg();
  const delta = (baseAvg !== null && postAvg !== null) ? Number((postAvg - baseAvg).toFixed(1)) : 0;
  const pct = (baseAvg !== null && baseAvg > 0) ? Math.round((delta / baseAvg) * 100) : 0;
  const strain = getStrainBadgeInfo(delta, pct);

  const cards = NASA_TLX_DIMENSIONS.map(d => {
    const baseVal = Number.isFinite(state.baselineNasaTlx[d.key]) ? state.baselineNasaTlx[d.key] : 5;
    const currentVal = Number.isFinite(state.nasaTlx[d.key]) ? state.nasaTlx[d.key] : baseVal;
    const dimDelta = currentVal - baseVal;
    const deltaBadgeClass = dimDelta > 0 ? 'delta-up' : dimDelta < 0 ? 'delta-down' : 'delta-flat';
    const deltaBadgeText = dimDelta > 0 ? `+${dimDelta} ▲` : dimDelta < 0 ? `${dimDelta} ▼` : '= 0 (At baseline)';

    return `
      <article class="survey-item nasa-verification-item">
        <div class="nasa-item-heading">
          <div>
            <h3>${d.label}</h3>
            <div class="dim-baseline-hint">Pre-Task Baseline: <strong>${baseVal} / 10</strong></div>
          </div>
          <div class="nasa-value-wrap">
            <output class="nasa-value" data-nasa-output="${d.key}">${currentVal}</output>
            <span class="dim-delta-badge ${deltaBadgeClass}" data-delta-badge="${d.key}">${deltaBadgeText}</span>
          </div>
        </div>
        <p>${d.help}</p>
        <input class="nasa-range" type="range" min="0" max="10" step="1" value="${currentVal}" data-nasa-scale="${d.key}" data-base-val="${baseVal}" aria-label="${d.label} scale from 0 to 10">
        <div class="scale-labels">
          <span>0 (Low)</span>
          <span>Baseline: ${baseVal}</span>
          <span>10 (High)</span>
        </div>
      </article>
    `;
  }).join('');

  const kickerText = endedEarly
    ? 'Session Concluded Early • NASA-TLX Workload Verification'
    : 'Tasks Completed • NASA-TLX Workload Verification';
  const headingText = endedEarly
    ? 'Verify Cognitive Load Increase (Early Exit)'
    : 'Verify Post-Task Cognitive Load';
  const introText = endedEarly
    ? 'You chose to conclude this session before completing all 6 tasks. Rate your perceived cognitive workload across all dimensions so the system can measure how much your cognitive load increased from your pre-task baseline.'
    : 'You have completed all collaborative tasks! Compare your current perceived workload against your pre-task baseline to verify how much cognitive load has increased during the session.';

  const deltaFormatted = delta > 0 ? `+${delta}` : `${delta}`;
  const pctFormatted = pct > 0 ? `+${pct}% from baseline` : pct < 0 ? `${pct}% from baseline` : 'At baseline (0%)';

  app.innerHTML = `
    <div class="survey-screen">
      <section class="card survey-card">
        <div class="survey-kicker">${kickerText}</div>
        <h1>${headingText}</h1>
        <p class="survey-intro">${introText}</p>

        <div class="nasa-comparison-summary">
          <div class="nasa-kpi-card">
            <div class="nasa-kpi-title"><span>⏱️</span> Pre-Task Baseline</div>
            <div class="nasa-kpi-val-row">
              <span class="nasa-kpi-val" id="summaryBaselineVal">${baseAvg !== null ? baseAvg.toFixed(1) : '—'}<small> / 10</small></span>
            </div>
            <div class="nasa-kpi-sub">Baseline recorded before tasks</div>
          </div>

          <div class="nasa-kpi-card">
            <div class="nasa-kpi-title"><span>🧠</span> Current Workload</div>
            <div class="nasa-kpi-val-row">
              <span class="nasa-kpi-val" id="summaryPostVal">${postAvg !== null ? postAvg.toFixed(1) : '—'}<small> / 10</small></span>
            </div>
            <div class="nasa-kpi-sub">Subjective post-task workload average</div>
          </div>

          <div class="nasa-kpi-card highlight">
            <div class="nasa-kpi-title"><span>📈</span> Load Change from Baseline</div>
            <div class="nasa-kpi-val-row">
              <span class="nasa-kpi-val" id="summaryDeltaVal">${deltaFormatted}</span>
              <span class="summary-pct-pill ${strain.pillClass}" id="summaryPctBadge">${strain.icon} ${pctFormatted}</span>
            </div>
            <div class="nasa-kpi-sub" id="summaryStrainDesc">${strain.desc}</div>
          </div>
        </div>

        <div class="nasa-grid">${cards}</div>

        <div class="nasa-overall" id="nasaOverallPreview">
          Post-Task Score: <strong>${postAvg !== null ? postAvg.toFixed(1) : '—'}</strong> / 10
          &nbsp;•&nbsp; Baseline: <strong>${baseAvg !== null ? baseAvg.toFixed(1) : '—'}</strong> / 10
          &nbsp;•&nbsp; Net Delta: <strong style="color:${delta > 0 ? '#f87171' : delta < 0 ? '#34d399' : '#93c5fd'}">${deltaFormatted} (${pctFormatted})</strong>
        </div>

        <button class="primary" id="submitAssessment" type="button" ${nasaTlxRatingsComplete() ? '' : 'disabled'}>
          ${endedEarly ? 'Submit Verification & End Session' : 'Submit Verification & Complete Assessment'}
        </button>
        <div class="error" id="surveyError"></div>
      </section>
    </div>
  `;

  document.querySelectorAll('[data-nasa-scale]').forEach(input => {
    input.addEventListener('input', event => {
      const key = event.target.dataset.nasaScale;
      const baseVal = Number(event.target.dataset.baseVal || 5);
      const val = Number(event.target.value);
      state.nasaTlx[key] = val;
      saveParticipantState();

      // Update item output & delta badge
      const output = document.querySelector(`[data-nasa-output="${key}"]`);
      if (output) output.textContent = val;
      const badge = document.querySelector(`[data-delta-badge="${key}"]`);
      const dimDelta = val - baseVal;
      if (badge) {
        badge.className = `dim-delta-badge ${dimDelta > 0 ? 'delta-up' : dimDelta < 0 ? 'delta-down' : 'delta-flat'}`;
        badge.textContent = dimDelta > 0 ? `+${dimDelta} ▲` : dimDelta < 0 ? `${dimDelta} ▼` : '= 0 (At baseline)';
      }

      // Recompute overall
      const curBaseAvg = getBaselineAvg();
      const curPostAvg = getPostAvg();
      const curDelta = (curBaseAvg !== null && curPostAvg !== null) ? Number((curPostAvg - curBaseAvg).toFixed(1)) : 0;
      const curPct = (curBaseAvg !== null && curBaseAvg > 0) ? Math.round((curDelta / curBaseAvg) * 100) : 0;
      const curStrain = getStrainBadgeInfo(curDelta, curPct);

      const postValEl = document.getElementById('summaryPostVal');
      if (postValEl && curPostAvg !== null) postValEl.innerHTML = `${curPostAvg.toFixed(1)}<small> / 10</small>`;
      const deltaValEl = document.getElementById('summaryDeltaVal');
      if (deltaValEl) deltaValEl.textContent = curDelta > 0 ? `+${curDelta}` : `${curDelta}`;
      const pctBadgeEl = document.getElementById('summaryPctBadge');
      if (pctBadgeEl) {
        pctBadgeEl.className = `summary-pct-pill ${curStrain.pillClass}`;
        pctBadgeEl.textContent = `${curStrain.icon} ${curPct > 0 ? `+${curPct}% from baseline` : curPct < 0 ? `${curPct}% from baseline` : 'At baseline (0%)'}`;
      }
      const strainDescEl = document.getElementById('summaryStrainDesc');
      if (strainDescEl) strainDescEl.textContent = curStrain.desc;

      const overall = document.getElementById('nasaOverallPreview');
      if (overall && curPostAvg !== null) {
        const curDeltaStr = curDelta > 0 ? `+${curDelta}` : `${curDelta}`;
        const curPctStr = curPct > 0 ? `+${curPct}%` : `${curPct}%`;
        overall.innerHTML = `Post-Task Score: <strong>${curPostAvg.toFixed(1)}</strong> / 10 &nbsp;•&nbsp; Baseline: <strong>${curBaseAvg !== null ? curBaseAvg.toFixed(1) : '—'}</strong> / 10 &nbsp;•&nbsp; Net Delta: <strong style="color:${curDelta > 0 ? '#f87171' : curDelta < 0 ? '#34d399' : '#93c5fd'}">${curDeltaStr} (${curPctStr})</strong>`;
      }

      const submit = document.getElementById('submitAssessment');
      if (submit) submit.disabled = !nasaTlxRatingsComplete();
    });
  });

  const submitBtn = document.getElementById('submitAssessment');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving verification…';
      finishAssessment(state.endedEarly);
    });
  }
  saveParticipantState();
}

async function finishAssessment(endedEarly) {
  if (state.finishing) return;
  state.finishing = true;

  const activeQuestionId =
    state.started
      ? currentQuestion().id
      : null;

  stopSharedTrackingCapture();
  state.trackingActive = false;

  // Preserve the last in-flight Camera frame and final partial second.
  await waitForSharedCaptureIdle();
  await flushCameraSecondBuffer();

  // Preserve the final partial Keyboard + Mouse + Prompt second.
  stopBehaviorSecondTracking();

  if (behaviorSecondBuffer) {
    const finalBehaviorSecond = behaviorSecondBuffer;
    behaviorSecondBuffer = null;
    await saveBehaviorSecond(finalBehaviorSecond);
  }

  await waitForMultimodalSaves();

  if (activeQuestionId) {
    await flushUnmatchedMultimodalSeconds(activeQuestionId);
  }

  const endButton = document.getElementById('endSession');
  if (endButton) {
    endButton.disabled = true;
    endButton.textContent = 'Ending Session…';
  }
  clearInterval(state.timerHandle);
  const payload = {
    participant: state.participant,
    session_started_at: state.sessionStart,
    session_ended_at: new Date().toISOString(),
    session_id: state.sessionId,
    ended_early: endedEarly,
    overall_paas_rating: endedEarly ? null : state.paas,
    nasa_tlx: (state.nasaTlx && nasaTlxRatingsComplete()) ? state.nasaTlx : null,
    question_ratings: [],
    answers: state.answers,
    interaction_summary: state.tracking
  };
  let completionError = '';
  try {
    if (endedEarly && state.started && state.participant) {
      try {
        await saveKeyboardWithRetry(keyboardTracker.finalize(), 'session_end', true);
      } catch (error) {
        console.warn('Final keyboard tracking save failed:', error);
      }
      try {
        await mouseTracker.flush('session_end', true);
      } catch (error) {
        console.warn('Final mouse tracking save failed:', error);
      } finally {
        mouseTracker.stop();
      }
    }
    setSaveStatus('Saving final session to PostgreSQL…');
    await safePost('/sessions/complete', payload, state.participantSessionToken);
    setSaveStatus('Session saved to PostgreSQL', 'success');
  } catch (error) {
    completionError = error.message;
    localStorage.setItem('cognitrack_pending_session', JSON.stringify(payload));
  }
  if (!completionError) localStorage.removeItem('cognitrack_pending_session');
  // Compute workload increase verification metrics for display before resetting
  const baseScores = NASA_TLX_DIMENSIONS.map(d => state.baselineNasaTlx?.[d.key]).filter(Number.isFinite);
  const baseAvg = baseScores.length > 0 ? (baseScores.reduce((a, b) => a + b, 0) / baseScores.length) : null;

  const currentNasa = (state.nasaTlx && Object.keys(state.nasaTlx).length > 0) ? state.nasaTlx : (payload.nasa_tlx || {});
  const postScores = NASA_TLX_DIMENSIONS.map(d => currentNasa?.[d.key]).filter(Number.isFinite);
  const postAvg = postScores.length > 0 ? (postScores.reduce((a, b) => a + b, 0) / postScores.length) : null;

  const loadDelta = (baseAvg !== null && postAvg !== null) ? Number((postAvg - baseAvg).toFixed(1)) : null;
  const pctChange = (loadDelta !== null && baseAvg > 0) ? Math.round((loadDelta / baseAvg) * 100) : null;
  const deltaClass = loadDelta !== null ? (loadDelta > 0 ? 'cw-up' : loadDelta < 0 ? 'cw-down' : 'cw-flat') : 'cw-flat';
  const deltaFormatted = loadDelta !== null ? (loadDelta > 0 ? `+${loadDelta}` : `${loadDelta}`) : '—';
  const pctFormatted = pctChange !== null ? (pctChange > 0 ? `+${pctChange}%` : `${pctChange}%`) : '';
  const strainLabel = (loadDelta !== null && loadDelta >= 1.8) ? 'High Strain Spike' : (loadDelta !== null && loadDelta >= 0.5) ? 'Moderate Increase' : (loadDelta !== null && loadDelta <= -0.5) ? 'Cognitive Recovery' : 'Stable Workload';
  const strainClass = (loadDelta !== null && loadDelta >= 1.8) ? 'strain-high' : (loadDelta !== null && loadDelta >= 0.5) ? 'strain-moderate' : (loadDelta !== null && loadDelta <= -0.5) ? 'strain-recovery' : 'strain-stable';

  const workloadVerificationHtml = (baseAvg !== null || postAvg !== null) ? `
    <div class="completion-workload-summary">
      <div class="completion-workload-title">
        <span>📊 NASA-TLX Workload Verification</span>
        <span class="summary-pct-pill ${strainClass}">${strainLabel}</span>
      </div>
      <div class="completion-workload-grid">
        <div class="cw-metric">
          <span class="cw-label">Pre-Task Baseline</span>
          <span class="cw-val">${baseAvg !== null ? baseAvg.toFixed(1) : '—'} <small>/ 10</small></span>
        </div>
        <div class="cw-metric">
          <span class="cw-label">Post-Task Workload</span>
          <span class="cw-val">${postAvg !== null ? postAvg.toFixed(1) : '—'} <small>/ 10</small></span>
        </div>
        <div class="cw-metric">
          <span class="cw-label">Cognitive Load Delta</span>
          <span class="cw-val ${deltaClass}">
            ${deltaFormatted} ${pctFormatted ? `<small>(${pctFormatted})</small>` : ''}
          </span>
        </div>
      </div>
      <p class="cw-note">Pre-task baseline vs. post-task subjective strain delta has been verified and permanently recorded to the research dataset.</p>
    </div>
  ` : '';

  clearParticipantState();
  clearInterval(monitoringTimer);
  await sendMonitoringHeartbeat(endedEarly ? 'ended' : 'completed').catch(error => console.warn('Final monitoring heartbeat failed:', error));
  stopVisionCamera();
  localStorage.setItem('cognitrack_last_session', JSON.stringify(payload));
  if (endedEarly) {
    const candidateId = escapeHtml(state.participant?.participant_id || 'Not assigned');
    const heading = completionError ? 'Session Ended' : 'Session Ended Successfully';
    const statusMessage = completionError
      ? `Your session has ended, but the final save could not be confirmed: ${escapeHtml(completionError)}`
      : 'Your session has ended early. Your NASA-TLX load verification and completed responses have been recorded.';
    app.innerHTML = `
      <div class="success-screen">
        <div class="card success-card">
          <div class="success-icon">✓</div>
          <h1>${heading}</h1>
          <p style="color:var(--muted);font-size:18px"><strong>Candidate ID:</strong> ${candidateId}</p>
          <p>${statusMessage}</p>
          ${workloadVerificationHtml}
          <p style="color:var(--muted)">Returning to the login page shortly.</p>
          <button class="primary" id="restart" type="button">Return to Login Now</button>
        </div>
      </div>
    `;
    let returnedToLogin = false;
    const returnToLogin = () => {
      if (returnedToLogin) return;
      returnedToLogin = true;
      resetParticipantSession();
      renderLogin();
    };
    document.getElementById('restart').onclick = returnToLogin;
    window.setTimeout(returnToLogin, 6000);
    return;
  }
  app.innerHTML = `
    <div class="success-screen">
      <div class="card success-card">
        <div class="success-icon">✓</div>
        <h1>Assessment Submitted Successfully</h1>
        <p style="color:var(--muted);font-size:18px">Participant ID: ${escapeHtml(state.participant?.participant_id || '')}</p>
        <p>All dynamic collaboration tasks, multimodal telemetry, and your NASA-TLX workload verification have been submitted.</p>
        ${workloadVerificationHtml}
        <button class="primary" id="restart">Return to Login</button>
      </div>
    </div>
  `;
  if (completionError) {
    app.innerHTML = `
      <div class="success-screen">
        <div class="card success-card">
          <div class="success-icon">!</div>
          <h1>Session Ended</h1>
          <p style="color:var(--muted);font-size:18px">Participant ID: ${escapeHtml(state.participant?.participant_id || '')}</p>
          <p>You have been logged out. The server could not confirm the final save: ${escapeHtml(completionError)}</p>
          ${workloadVerificationHtml}
          <button class="primary" id="restart">Return to Login</button>
        </div>
      </div>
    `;
  }
  let returnedToLogin = false;
  const returnToLogin = () => {
    if (returnedToLogin) return;
    returnedToLogin = true;
    resetParticipantSession();
    renderLogin();
  };
  document.getElementById('restart').onclick = returnToLogin;
  window.setTimeout(returnToLogin, completionError ? 6000 : 5000);
}

function startDisplayTimer() {
  clearInterval(state.timerHandle);
  const timer = document.getElementById('timer');
  const render = () => {
    if (!timer) return;
    const remaining = Math.max(0, Math.ceil(((state.assessmentDeadline || Date.now()) - Date.now()) / 1000));
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    timer.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    timer.classList.toggle('time-up', remaining === 0);
    timer.title = remaining === 0 ? 'Assessment time has ended.' : 'Time remaining for the assessment';
    if (remaining === 0 && !state.timeLimitReached) {
      state.timeLimitReached = true;
      clearInterval(state.timerHandle);
      prepareQuestionNavigation();
      renderNasaTlxAssessment(true);
    }
  };
  render();
  state.timerHandle = setInterval(render, 1000);
}
function showExamError(msg) { const el = document.getElementById('examError'); if (el) el.textContent = msg; }
function setSaveStatus(message, tone = '') {
  state.saveStatus = message;
  const element = document.getElementById('saveStatus');
  if (element) {
    element.textContent = message;
    element.className = `save-status ${tone}`.trim();
  }
}
function assessmentProgressSnapshot() {
  const total = (state.questions && state.questions.length) || 6;
  const answered = new Set(state.answers.map(answer => answer.question_id)).size;
  const skipped = new Set(state.skippedQuestionIds || []).size;
  const completed = Math.min(total, answered + skipped);
  return { total, answered, skipped, completed, percent: Math.round(completed / total * 100) };
}
function escapeHtml(s) { return s.replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c])); }
async function safePost(path, body, token = '') {
  return safeJsonRequest('POST', path, body, token);
}

async function safeStreamPost(path, body, onEvent, token = '', signal) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal });
  } catch (_error) {
    throw new Error('the server is unavailable');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `server returned HTTP ${response.status}`);
  }
  if (!response.body) throw new Error('streaming is not supported by this browser');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
    if (done) break;
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer));
}

async function safePut(path, body, token = '') {
  return safeJsonRequest('PUT', path, body, token);
}

async function safeJsonRequest(method, path, body, token = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: JSON.stringify(body) });
      break;
    } catch (_error) {
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
  if (!res) throw new Error(`cannot connect to the local server. Reload ${window.location.origin}/ and try again.`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `server returned HTTP ${res.status}`);
  return data;
}

function saveKeyboardMeasurements(measurements, saveReason, isFinal) {
  const q = currentQuestion();
  return safePut('/keyboard', {
    participant_id: state.participant.participant_id,
    question_id: q.id,
    question_category: q.category,
    ...measurements,
    is_final: isFinal
  }, state.participantSessionToken);
}

function saveMouseMeasurements(measurements) {
  const q = currentQuestion();
  return safePut('/mouse', {
    participant_id: state.participant.participant_id,
    question_id: q.id,
    question_category: q.category,
    scroll_up_count: measurements.scroll_up_count,
    scroll_down_count: measurements.scroll_down_count,
    scroll_timestep_count: measurements.scroll_timestep_count,
    scroll_event_timestamps: measurements.scroll_event_timestamps,
    mouse_move_count: measurements.mouse_move_count,
    cursor_distance_px: measurements.cursor_distance_px
  }, state.participantSessionToken);
}

async function saveKeyboardWithRetry(measurements, saveReason, isFinal) {
  try {
    return await saveKeyboardMeasurements(measurements, saveReason, isFinal);
  } catch (_firstError) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return saveKeyboardMeasurements(measurements, saveReason, isFinal);
  }
}



function renderDashboardLoginChoices() {
  app.innerHTML = `
    <div class="role-page">
      <header class="topbar">
        <div class="brand"><div class="logo">C</div><div><h1>CogniTrack <span style="color:#38dd9a">AI</span></h1><small>Dashboard Access</small></div></div>
        ${themeToggleMarkup()}
        <button class="secondary" id="backToParticipant" type="button">← Participant Login</button>
      </header>
      <main class="role-login-wrap">
        <section class="card role-login-card dashboard-choice-card">
          <div class="role-shield">D</div>
          <div class="eyebrow">SECURE DASHBOARD ACCESS</div>
          <h2>Group User Dashboard</h2>
          <p>Open the group-level participant analytics dashboard.</p>
          <div class="dashboard-choice-actions">
            <button class="primary" id="groupDashboardBtn" type="button">Open Group User Dashboard</button>
            <button class="secondary" id="researchMetricsChoiceBtn" type="button" style="margin-top: 10px;">📊 View Empirical Research & Benchmark Metrics</button>
          </div>
        </section>
      </main>
    </div>`;
  document.getElementById('backToParticipant').onclick = renderLogin;
  document.getElementById('groupDashboardBtn').onclick = () => {
    sessionStorage.setItem(DASHBOARD_MODE_STORAGE_KEY, 'group');
    sessionStorage.removeItem(DASHBOARD_PARTICIPANT_STORAGE_KEY);
    renderIndependentDashboard('group');
  };
  const researchChoiceBtn = document.getElementById('researchMetricsChoiceBtn');
  if (researchChoiceBtn) researchChoiceBtn.onclick = () => renderResearchMetricsPage('dashboard');
}

function renderDashboardCredentialLogin() {
  const title = 'Dashboard Login';
  app.innerHTML = `
    <div class="role-page">
      <header class="topbar">
        <div class="brand"><div class="logo">C</div><div><h1>CogniTrack <span style="color:#38dd9a">AI</span></h1><small>${title}</small></div></div>
        ${themeToggleMarkup()}
        <button class="secondary" id="backToParticipant" type="button">← Participant Login</button>
      </header>
      <main class="role-login-wrap">
        <form id="dashboardCredentialForm" class="card role-login-card">
          <div class="role-shield">D</div>
          <div class="eyebrow">SECURE DASHBOARD ACCESS</div>
          <h2>${title}</h2>
          <p>Authenticate once to unlock the Group User dashboard.</p>
          <div class="field"><label>Username</label><input id="dashboardUsername" autocomplete="username" required placeholder="Enter username" /></div>
          <div class="field"><label>Password</label><input id="dashboardPassword" type="password" autocomplete="current-password" required placeholder="Enter password" /></div>
          <button class="primary" type="submit">Open Dashboard</button>
          <div class="error" id="dashboardLoginError"></div>
        </form>
      </main>
    </div>`;
  document.getElementById('backToParticipant').onclick = renderLogin;
  document.getElementById('dashboardCredentialForm').onsubmit = async event => {
    event.preventDefault();
    const errorBox = document.getElementById('dashboardLoginError');
    errorBox.textContent = '';
    try {
      const response = await fetch(`${API_BASE_URL}/auth/dashboard/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: document.getElementById('dashboardUsername').value.trim(),
          password: document.getElementById('dashboardPassword').value
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        errorBox.textContent = result.detail || `Dashboard login failed (HTTP ${response.status}).`;
        return;
      }
      state.authToken = result.access_token;
      state.authRole = result.role;
      sessionStorage.setItem('cognitrack_auth_token', result.access_token);
      sessionStorage.setItem('cognitrack_auth_role', result.role);
      renderDashboardLoginChoices();
    } catch (_error) {
      errorBox.textContent = `Backend is not running at ${window.location.origin}.`;
    }
  };
}

function renderIndependentDashboard(mode) {
  independentDetailOpen = false;
  sessionStorage.setItem(DASHBOARD_MODE_STORAGE_KEY, mode);
  const title = mode === 'group' ? 'Group User Dashboard' : 'Individual User Dashboard';
  const description = mode === 'group'
    ? 'Aggregated participant performance, completion, status, and time insights.'
    : 'Select any participant to view their specific session data.';
  app.innerHTML = `<div class="role-page"><header class="topbar"><div class="brand"><div class="logo">C</div><div><h1>CogniTrack <span style="color:#38dd9a">AI</span></h1><small>${title}</small></div></div><div class="role-actions"><span class="badge">● Dashboard authenticated</span><button class="danger-btn" id="dashboardLogout" type="button">Logout</button></div></header><main class="dashboard-wrap"><section class="dashboard-heading"><div><div class="eyebrow">${mode.toUpperCase()} VIEW</div><h2>${title}</h2><p>${description}</p></div><div class="dashboard-heading-actions"><button class="secondary" id="previousDashboard" type="button">Previous</button><button class="secondary" id="researchMetricsNavBtn" type="button">📊 Research Metrics</button><button class="secondary" id="refreshIndependentDashboard" type="button">Refresh</button></div></section><div id="independentDashboardContent"><article class="card panel">Loading dashboard data…</article></div></main></div>`;
  document.getElementById('independentDashboardContent').innerHTML = '<article class="card panel"><div class="section-label">DATA CLEARED</div><p>No Individual User or Group User dashboard data is currently displayed.</p></article>';
  document.getElementById('previousDashboard').onclick = () => {
    clearInterval(dashboardTimer);
    sessionStorage.removeItem(DASHBOARD_MODE_STORAGE_KEY);
    sessionStorage.removeItem(DASHBOARD_PARTICIPANT_STORAGE_KEY);
    renderDashboardLoginChoices();
  };
  document.getElementById('dashboardLogout').onclick = () => {
    clearInterval(dashboardTimer);
    const token = state.authToken;
    state.authToken = '';
    state.authRole = '';
    sessionStorage.removeItem('cognitrack_auth_token');
    sessionStorage.removeItem('cognitrack_auth_role');
    sessionStorage.removeItem(DASHBOARD_MODE_STORAGE_KEY);
    sessionStorage.removeItem(DASHBOARD_PARTICIPANT_STORAGE_KEY);
    safePost('/auth/logout', {}, token).catch(() => { });
    renderLogin();
  };
  document.getElementById('refreshIndependentDashboard').onclick = () => renderIndependentDashboard(mode);
  const indResearchNavBtn = document.getElementById('researchMetricsNavBtn');
  if (indResearchNavBtn) indResearchNavBtn.onclick = () => renderResearchMetricsPage('dashboard');
  clearInterval(dashboardTimer);
  loadIndependentDashboard(mode);
}

async function loadIndependentDashboard(mode) {
  independentDetailOpen = false;
  const container = document.getElementById('independentDashboardContent');
  if (!container || !state.authToken) return;
  try {
    const response = await fetch(`${API_BASE_URL}/dashboard/overview`, { headers: { Authorization: `Bearer ${state.authToken}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    if (independentDetailOpen) return;
    if (mode === 'group') {
      const [accuracyResponse, importanceResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/dashboard/group/model-accuracies`, { headers: { Authorization: `Bearer ${state.authToken}` } }),
        fetch(`${API_BASE_URL}/dashboard/group/feature-importances`, { headers: { Authorization: `Bearer ${state.authToken}` } })
      ]);
      const accuracyData = await accuracyResponse.json().catch(() => ({}));
      const importanceData = await importanceResponse.json().catch(() => ({}));
      if (!accuracyResponse.ok) throw new Error(accuracyData.detail || `HTTP ${accuracyResponse.status}`);
      if (!importanceResponse.ok) throw new Error(importanceData.detail || `HTTP ${importanceResponse.status}`);
      data.model_accuracies = accuracyData;
      data.feature_importances = importanceData;
    }
    container.innerHTML = mode === 'group' ? renderGroupUserDashboard(data) : renderIndividualUserDirectory(data);
    if (mode === 'group') {
      container.insertAdjacentHTML('afterbegin', renderFeatureImportanceChart(data.feature_importances));
      container.insertAdjacentHTML('afterbegin', renderModelAccuracyChart(data.model_accuracies));
    }
    container.querySelectorAll('[data-individual-participant]').forEach(button => {
      button.onclick = () => openDashboardParticipant(button.dataset.individualParticipant, mode);
    });
    const savedParticipant = sessionStorage.getItem(DASHBOARD_PARTICIPANT_STORAGE_KEY);
    if (savedParticipant && mode === 'individual' && !container.querySelector('.individual-user-detail')) {
      await openDashboardParticipant(savedParticipant, mode);
    }
  } catch (error) {
    container.innerHTML = `<article class="card panel error">Dashboard unavailable: ${escapeHtml(error.message)}</article>`;
  }
}

function renderIndividualUserDirectory(data) {
  const users = data.stored_results || [];
  return `<article class="card panel individual-user-directory"><div class="section-label">INDIVIDUAL USERS</div><p>Select a participant to view their specific session information.</p>${users.length ? `<div class="monitor-table"><table><thead><tr><th>Participant ID</th><th>Status</th><th>Time spent</th><th>Minutes</th><th>Answers</th><th>Open</th></tr></thead><tbody>${users.map(renderIndividualUserRow).join('')}</tbody></table></div>` : '<p>No participants have started an assessment yet.</p>'}</article>`;
}

function renderFeatureImportanceChart(importance = {}) {
  const features = importance.features || [];
  const maximum = Math.max(0.000001, ...features.map(item => Number(item.importance || 0)));
  if (!importance.available || !features.length) {
    return `<article class="card panel feature-importance-panel"><div class="section-label">MODEL INSIGHT</div><h3>Top 20 Feature Importances — Random Forest</h3><p>Feature importance is unavailable: ${escapeHtml(String(importance.reason || 'No eligible dataset rows were found.'))}</p></article>`;
  }
  return `<article class="card panel feature-importance-panel"><div class="section-label">MODEL INSIGHT</div><h3>${escapeHtml(String(importance.title || 'Top 20 Feature Importances — Random Forest'))}</h3><p>Calculated from ${Number(importance.sample_count || 0).toLocaleString()} rows in AtharvaDB.final_dataset using <strong>${escapeHtml(String(importance.target || 'CLI_label'))}</strong> as the target.</p><div class="feature-importance-chart" role="img" aria-label="Top 20 Random Forest feature importances">${features.map(item => `<div class="feature-importance-row"><span class="feature-importance-label">${escapeHtml(String(item.feature))}</span><div class="feature-importance-track"><span class="feature-importance-bar" style="width:${Math.max(2, Number(item.importance || 0) / maximum * 100)}%"></span></div><strong class="feature-importance-value">${Number(item.importance || 0).toFixed(3)}</strong></div>`).join('')}</div></article>`;
}

function renderModelAccuracyChart(accuracy = {}) {
  const models = accuracy.models || [];
  if (!accuracy.available || !models.length) {
    return `<article class="card panel model-accuracy-panel"><div class="section-label">MODEL ACCURACY</div><h3>Notebook model accuracy</h3><p>Accuracy is unavailable: ${escapeHtml(String(accuracy.reason || 'No evaluated model results were found.'))}</p></article>`;
  }
  const maximum = 1;
  return `<article class="card panel model-accuracy-panel"><div class="section-label">MODEL ACCURACY</div><h3>Held-out accuracy of notebook models</h3><p>Calculated on ${Number(accuracy.test_count || 0).toLocaleString()} participant-grouped test rows from ${Number(accuracy.sample_count || 0).toLocaleString()} PostgreSQL dataset rows. Best model: <strong>${escapeHtml(String(accuracy.best_model || '—'))}</strong>.</p><div class="model-accuracy-chart" role="img" aria-label="Held-out accuracy for notebook models">${models.map(item => `<div class="model-accuracy-row"><span class="model-accuracy-label">${escapeHtml(String(item.name || 'Model'))}</span><div class="model-accuracy-track"><span class="model-accuracy-bar" style="width:${Math.max(2, Number(item.accuracy || 0) / maximum * 100)}%"></span></div><strong class="model-accuracy-value">${(Number(item.accuracy || 0) * 100).toFixed(2)}%</strong></div>`).join('')}</div></article>`;
}

function renderGroupUserDashboard(data) {
  const users = data.stored_results || [];
  return `<article class="card panel individual-user-directory"><div class="section-label">GROUP OVERVIEW</div><p>Aggregated user status and task-solving time from PostgreSQL.</p><div class="monitor-table"><table><thead><tr><th>Participant ID</th><th>Status</th><th>Time spent</th><th>Progress</th><th>Data</th></tr></thead><tbody>${users.map(user => `<tr><td><strong>${escapeHtml(String(user.participant_id || '—'))}</strong></td><td><span class="participant-status ${user.session_status === 'online' ? 'online' : user.session_status === 'ended' ? 'ended' : 'not-started'}">${escapeHtml(String(user.session_status || 'not started'))}</span></td><td>${formatDuration(user.time_spent_seconds)}</td><td>${Number(user.progress_percent || 0).toFixed(1)}%</td><td><button class="secondary compact-action" type="button" data-individual-participant="${escapeHtml(String(user.participant_id || ''))}">Open data</button></td></tr>`).join('')}</tbody></table></div></article>`;
}

function renderStandaloneIndividualUserPage(data, participantId, mode) {
  const item = (data.stored_results || []).find(row => String(row.participant_id) === String(participantId));
  const container = document.getElementById('independentDashboardContent');
  if (!container || !item) return;
  const status = String(item.session_status || 'not started');
  const statusClass = status === 'online' ? 'online' : status === 'ended' ? 'ended' : 'not-started';
  container.innerHTML = `<article class="card panel individual-user-detail"><div class="detail-page-heading"><div><div class="section-label">INDIVIDUAL USER</div><h3>${escapeHtml(String(item.full_name || 'Unknown participant'))}</h3><p>Participant ID: <strong>${escapeHtml(String(item.participant_id || '—'))}</strong></p></div><button class="secondary" id="backToIndependentUsers" type="button">Back to users</button></div><section class="individual-metrics"><article class="card"><small>Session status</small><strong class="participant-status ${statusClass}">${escapeHtml(status)}</strong></article><article class="card"><small>Time spent solving</small><strong>${formatDuration(item.time_spent_seconds)}</strong><span>${Number(item.time_spent_minutes || 0).toFixed(1)} minutes</span></article><article class="card"><small>Answers submitted</small><strong>${Number(item.answers_submitted || 0)}</strong></article><article class="card"><small>Progress</small><strong>${Number(item.progress_percent || 0).toFixed(1)}%</strong></article></section><div class="individual-profile-grid"><div><small>Domain</small><strong>${escapeHtml(String(item.domain || '—'))}</strong></div><div><small>Age group</small><strong>${escapeHtml(String(item.age_group || '—'))}</strong></div><div><small>AI familiarity</small><strong>${escapeHtml(String(item.ai_familiarity || '—'))}</strong></div></div></article>`;
  document.getElementById('backToIndependentUsers').onclick = () => loadIndependentDashboard(mode);
}

async function openDashboardParticipant(participantId, mode) {
  const container = document.getElementById('independentDashboardContent');
  if (!container) return;
  independentDetailOpen = true;
  clearInterval(dashboardTimer);
  sessionStorage.setItem(DASHBOARD_MODE_STORAGE_KEY, mode);
  sessionStorage.setItem(DASHBOARD_PARTICIPANT_STORAGE_KEY, participantId);
  container.innerHTML = '<article class="card panel">Loading participant data from PostgreSQL…</article>';
  try {
    const response = await fetch(`${API_BASE_URL}/dashboard/participant/${encodeURIComponent(participantId)}`, { headers: { Authorization: `Bearer ${state.authToken}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    container.innerHTML = renderDashboardParticipantDetail(data);
    const cliSummaries = data.session_cli_summaries || [];
    container.insertAdjacentHTML('beforeend', `<article class="card panel"><div class="section-label">SESSION CLI CHANGE</div><div class="monitor-table"><table><thead><tr><th>Session ID</th><th>Start CLI</th><th>End CLI</th><th>Change</th><th>Average</th><th>Peak</th></tr></thead><tbody>${cliSummaries.map(row => `<tr><td>${escapeHtml(String(row.session_id || '—'))}</td><td>${escapeHtml(String(row.start_cli ?? '—'))}</td><td>${escapeHtml(String(row.end_cli ?? '—'))}</td><td>${escapeHtml(String(row.absolute_change ?? '—'))}</td><td>${escapeHtml(String(row.average_cli ?? '—'))}</td><td>${escapeHtml(String(row.maximum_cli ?? '—'))}</td></tr>`).join('') || '<tr><td colspan="6">No CLI summary has been produced for this user yet.</td></tr>'}</tbody></table></div></article>`);
    document.getElementById('backToIndependentUsers').onclick = () => {
      sessionStorage.removeItem(DASHBOARD_PARTICIPANT_STORAGE_KEY);
      loadIndependentDashboard(mode);
    };
  } catch (error) {
    container.innerHTML = `<article class="card panel error">Participant data unavailable: ${escapeHtml(error.message)}<br><br><button class="secondary" id="backToIndependentUsers">Back to users</button></article>`;
    document.getElementById('backToIndependentUsers').onclick = () => {
      sessionStorage.removeItem(DASHBOARD_PARTICIPANT_STORAGE_KEY);
      loadIndependentDashboard(mode);
    };
  }
}

function renderDashboardParticipantDetail(data) {
  const participant = data.participant || {};
  const sessions = data.sessions || [];
  const answers = data.answers || [];
  const nasa = data.nasa_tlx?.[0] || {};
  const tracking = data.tracking_summary || {};
  const cliSummaries = data.session_cli_summaries || [];
  const ratingFields = ['mental_demand', 'physical_demand', 'temporal_demand', 'performance', 'effort', 'frustration', 'overall_score'];
  const cliSummarySection = `<div class="section-label">Session CLI change</div><div class="monitor-table"><table><thead><tr><th>Session ID</th><th>Start CLI</th><th>End CLI</th><th>Change</th><th>Average</th><th>Peak</th></tr></thead><tbody>${cliSummaries.map(row => `<tr><td>${escapeHtml(String(row.session_id || '—'))}</td><td>${escapeHtml(String(row.start_cli ?? '—'))}</td><td>${escapeHtml(String(row.end_cli ?? '—'))}</td><td>${escapeHtml(String(row.absolute_change ?? '—'))}</td><td>${escapeHtml(String(row.average_cli ?? '—'))}</td><td>${escapeHtml(String(row.maximum_cli ?? '—'))}</td></tr>`).join('') || '<tr><td colspan="6">No CLI summary has been produced for this user yet.</td></tr>'}</tbody></table></div>`;
  return `<article class="card panel individual-user-detail"><div class="detail-page-heading"><div><div class="section-label">INDIVIDUAL USER DATA</div><h3>${escapeHtml(String(participant.full_name || 'Unknown participant'))}</h3><p>Participant ID: <strong>${escapeHtml(String(participant.participant_id || '—'))}</strong></p></div><button class="secondary" id="backToIndependentUsers" type="button">Back to users</button></div><div class="individual-profile-grid"><div><small>Age group</small><strong>${escapeHtml(String(participant.age_group || '—'))}</strong></div><div><small>Domain</small><strong>${escapeHtml(String(participant.domain || '—'))}</strong></div><div><small>AI familiarity</small><strong>${escapeHtml(String(participant.ai_familiarity || '—'))}</strong></div><div><small>Answers</small><strong>${answers.length}</strong></div></div><div class="section-label">Session records</div><div class="monitor-table"><table><thead><tr><th>Event</th><th>Started</th><th>Ended</th><th>Duration</th></tr></thead><tbody>${sessions.map(row => `<tr><td>${escapeHtml(String(row.event || '—'))}</td><td>${escapeHtml(String(row.session_started_at || '—'))}</td><td>${escapeHtml(String(row.session_ended_at || '—'))}</td><td>${escapeHtml(String(row.duration_seconds || 0))} sec</td></tr>`).join('') || '<tr><td colspan="4">No session records.</td></tr>'}</tbody></table></div><div class="section-label">NASA-TLX</div><div class="individual-profile-grid">${ratingFields.map(key => `<div><small>${key.replaceAll('_', ' ')}</small><strong>${escapeHtml(String(nasa[key] ?? '—'))}</strong></div>`).join('')}</div><div class="section-label">Tracking records</div><div class="individual-profile-grid">${Object.entries(tracking).map(([key, value]) => `<div><small>${escapeHtml(key.replaceAll('_', ' '))}</small><strong>${Number(value || 0)}</strong></div>`).join('') || '<div><small>No tracking records yet.</small></div>'}</div><div class="section-label">Submitted answers</div><div class="monitor-table"><table><thead><tr><th>Question</th><th>LLM</th><th>Duration</th><th>Submitted</th></tr></thead><tbody>${answers.map(row => `<tr><td>${escapeHtml(String(row.question_id || '—'))}</td><td>${escapeHtml(String(row.llm || '—'))}</td><td>${escapeHtml(String(row.duration_seconds || 0))} sec</td><td>${escapeHtml(String(row.submitted_at || '—'))}</td></tr>`).join('') || '<tr><td colspan="4">No answers submitted.</td></tr>'}</tbody></table></div></article>`;
}

function renderRoleLogin(role, dashboardMode = 'individual') {
  const roleName = role === 'admin' ? 'Admin' : 'Host';
  app.innerHTML = `
    <div class="role-page">
      <header class="topbar">
        <div class="brand"><div class="logo">C</div><div><h1>CogniTrack <span style="color:#38dd9a">AI</span></h1><small>${roleName} Portal</small></div></div>
        ${themeToggleMarkup()}
        <button class="secondary" id="backToParticipant">← Participant Login</button>
      </header>
      <main class="role-login-wrap">
        <form id="roleLoginForm" class="card role-login-card">
          <div class="role-shield">${role === 'admin' ? 'A' : 'H'}</div>
          <div class="eyebrow">SECURE ${roleName.toUpperCase()} ACCESS</div>
          <h2>${roleName} Login</h2>
          <p>Enter your authorized ${roleName.toLowerCase()} credentials.</p>
          <div class="field"><label>Username</label><input id="roleUsername" autocomplete="username" required placeholder="Enter username" /></div>
          <div class="field"><label>Password</label><input id="rolePassword" type="password" autocomplete="current-password" required placeholder="Enter password" /></div>
          <button class="primary" type="submit">Login to ${roleName} Portal</button>
          <div class="error" id="roleLoginError"></div>
        </form>
      </main>
    </div>`;

  document.getElementById('backToParticipant').onclick = renderLogin;
  document.getElementById('roleLoginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const errorBox = document.getElementById('roleLoginError');
    errorBox.textContent = '';
    let result;
    try {
      const response = await fetch(`${API_BASE_URL}/auth/${role}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: document.getElementById('roleUsername').value.trim(),
          password: document.getElementById('rolePassword').value
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        errorBox.textContent = data.detail || `Login failed (HTTP ${response.status}).`;
        return;
      }
      result = data;
    } catch (error) {
      errorBox.textContent = `Backend is not running at ${window.location.origin}. Start the local server and try again.`;
      return;
    }
    if (!result?.success) {
      errorBox.textContent = 'Authentication failed. Please try again.';
      return;
    }
    state.authToken = result.access_token;
    state.authRole = result.role;
    sessionStorage.setItem('cognitrack_auth_token', result.access_token);
    sessionStorage.setItem('cognitrack_auth_role', result.role);
    renderRoleDashboard(result.role, role === 'admin' ? dashboardMode : 'individual');
  });
}

function renderRoleDashboard(role, dashboardMode = 'individual') {
  const roleName = role === 'admin' ? 'Admin' : 'Host';
  const dashboardTitle = role === 'admin' ? 'Administrator Data Dashboard' : 'Host Agent Orchestration Console';
  const dashboardDescription = role === 'admin'
    ? 'Platform-wide participant, session, answer, chat, eye, keyboard, and monitoring information.'
    : 'The Host Agent dispatches each heartbeat to specialist agents and combines their findings for human review.';
  app.innerHTML = `
    <div class="role-page">
      <header class="topbar">
        <div class="brand"><div class="logo">C</div><div><h1>CogniTrack <span style="color:#38dd9a">AI</span></h1><small>${roleName} Dashboard</small></div></div>
        ${themeToggleMarkup()}
        <div class="role-actions"><span class="badge">● ${roleName} authenticated</span><button class="danger-btn" id="roleLogout" type="button">Logout</button></div>
      </header>
      <main class="dashboard-wrap">
        <section class="dashboard-heading"><div><div class="eyebrow">${roleName.toUpperCase()} PORTAL</div><h2>${dashboardTitle}</h2><p>${dashboardDescription}</p></div><div class="dashboard-heading-actions"><button class="secondary" id="refreshDashboard">Refresh</button><button class="secondary" id="adminResearchMetricsBtn" type="button" style="margin-left: 10px;">📊 CLI Research Metrics</button>${role === 'admin' ? '<button class="primary" id="downloadDataBtn" style="margin-left: 10px;">Download Data (Excel)</button>' : ''}</div></section>
        ${role === 'admin' ? renderAdminWorkflowFlowchart() : ''}
        <div id="dashboardContent"><article class="card panel">Loading live participant data…</article></div>
      </main>
    </div>`;
  const adminResearchBtn = document.getElementById('adminResearchMetricsBtn');
  if (adminResearchBtn) adminResearchBtn.onclick = () => renderResearchMetricsPage('dashboard');
  document.getElementById('roleLogout').onclick = () => {
    clearInterval(dashboardTimer);
    const token = state.authToken;
    state.authToken = '';
    state.authRole = '';
    sessionStorage.removeItem('cognitrack_auth_token');
    sessionStorage.removeItem('cognitrack_auth_role');
    renderLogin();
    // Do not make navigation depend on the server response. The local session
    // is cleared immediately; revoke the server token in the background.
    safePost('/auth/logout', {}, token).catch(() => { });
  };
  document.getElementById('refreshDashboard').onclick = refreshDashboard;
  if (role === 'admin') {
    const toggleWorkflowBtn = document.getElementById('toggleWorkflowBtn');
    if (toggleWorkflowBtn) {
      toggleWorkflowBtn.onclick = () => {
        adminFilterState.workflowCollapsed = !adminFilterState.workflowCollapsed;
        const content = document.getElementById('workflowFlowchartContent');
        const note = document.getElementById('workflowFooterNote');
        if (content) content.classList.toggle('is-collapsed', adminFilterState.workflowCollapsed);
        if (note) note.classList.toggle('is-collapsed', adminFilterState.workflowCollapsed);
        toggleWorkflowBtn.textContent = adminFilterState.workflowCollapsed ? '▼ Show Pipeline' : '▲ Hide Pipeline';
      };
    }
    document.getElementById('downloadDataBtn').onclick = () => {
      window.open(`${API_BASE_URL}/admin/export-excel?token=${encodeURIComponent(state.authToken)}`, '_blank');
    };
  }
  refreshDashboard();
  clearInterval(dashboardTimer);
  dashboardTimer = setInterval(refreshDashboard, 5000);
}

const adminFilterState = {
  selectedParticipant: 'all',
  searchQuery: '',
  statusFilter: 'all',
  domainFilter: 'all',
  cachedCognitiveData: null,
  cachedCohortParticipants: [],
  workflowCollapsed: false,
};

async function refreshDashboard() {
  const container = document.getElementById('dashboardContent');
  if (!container || !state.authToken) return;
  try {
    const response = await fetch(`${API_BASE_URL}/dashboard/overview`, {
      headers: { Authorization: `Bearer ${state.authToken}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    const summary = data.summary;
    const participants = data.participants || [];
    if (data.role === 'host') {
      container.innerHTML = `
      <section class="monitor-summary">
        <article class="card"><small>Total participants</small><strong>${summary.total_participants}</strong></article>
        <article class="card"><small>Active now</small><strong>${summary.active_participants}</strong></article>
        <article class="card"><small>Need attention</small><strong>${summary.participants_needing_attention}</strong></article>
        <article class="card"><small>Answers submitted</small><strong>${summary.answers_submitted}</strong></article>
      </section>
      <section class="monitor-layout">
        <article class="card panel monitor-table-card">
          <div class="section-label">Live Participant Activity</div>
          ${participants.length ? `<div class="monitor-table"><table><thead><tr><th>Participant ID</th><th>Current task</th><th>Status</th><th>Progress</th><th>Time in application</th><th>Attention</th></tr></thead><tbody>${participants.map(renderHostParticipantRow).join('')}</tbody></table></div>` : '<p>No participant has started an assessment yet.</p>'}
        </article>
      </section>`;
    } else {
      let cliData = null;
      try {
        const isIndividual = adminFilterState.selectedParticipant && adminFilterState.selectedParticipant !== 'all';
        const cliUrl = isIndividual
          ? `${API_BASE_URL}/admin/cognitive-load/summary?participant_id=${encodeURIComponent(adminFilterState.selectedParticipant)}&include_test_mode=true`
          : `${API_BASE_URL}/admin/cognitive-load/summary?include_test_mode=true`;
        const cliRes = await fetch(cliUrl, { headers: { Authorization: `Bearer ${state.authToken}` } });
        if (cliRes.ok) {
          cliData = await cliRes.json();
          adminFilterState.cachedCognitiveData = cliData;
          if (cliData.participants && Array.isArray(cliData.participants)) {
            adminFilterState.cachedCohortParticipants = cliData.participants;
          }
        }
      } catch (cliErr) {
        console.warn('Unable to load cognitive load metrics:', cliErr);
      }
      container.innerHTML = renderAdminAnalytics(data, cliData);
      attachAdminDashboardEvents(container, data, cliData);
    }
  } catch (error) {
    container.innerHTML = `<article class="card panel error">Dashboard unavailable: ${escapeHtml(error.message)}</article>`;
  }
}

function renderAdminWorkflowFlowchart() {
  const isCollapsed = Boolean(adminFilterState.workflowCollapsed);
  return `
    <!-- System Architecture & Telemetry Pipeline Flowchart -->
    <section class="admin-workflow-card card panel" aria-label="System Cognitive Load Telemetry Workflow">
      <div class="workflow-header">
        <div>
          <div class="section-label" style="margin-bottom:4px; display:flex; align-items:center; gap:8px;">
            <span class="workflow-live-dot"></span>
            SYSTEM WORKFLOW & ARCHITECTURE
          </div>
          <h3 style="margin:0 0 4px; font-size:17px; font-weight:700;">End-to-End Cognitive Telemetry Pipeline</h3>
          <p style="margin:0; font-size:13px; color:var(--muted);">
            How user interactions generate raw telemetry logs, calculate cognitive load via ML models, and display on this administrator dashboard.
          </p>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="workflow-step-tag current-step-pill">● Present Page: Step 4</span>
          <button class="secondary btn-xs" id="toggleWorkflowBtn" type="button" style="padding:5px 12px; font-size:12px; border-radius:8px;">
            ${isCollapsed ? '▼ Show Pipeline' : '▲ Hide Pipeline'}
          </button>
        </div>
      </div>

      <div class="workflow-flowchart ${isCollapsed ? 'is-collapsed' : ''}" id="workflowFlowchartContent">
        <!-- Step 1 -->
        <div class="workflow-node">
          <div class="node-badge">
            <span>STEP 01</span>
            <span style="font-size:13px;">💻</span>
          </div>
          <div class="node-icon-wrap" style="background: rgba(47, 107, 255, 0.12); color: var(--blue);">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          </div>
          <div class="node-title">1. User Interacts with Interface</div>
          <div class="node-desc">Participant works on code tasks, runs tests, and queries the AI assistant in the browser interface.</div>
          <div class="node-tags">
            <span class="node-chip">💻 Online IDE & Compiler</span>
            <span class="node-chip">🤖 AI Chat Assistant Dialogues</span>
            <span class="node-chip">🧠 Task Reasoning & Decisions</span>
          </div>
        </div>

        <!-- Connector Arrow -->
        <div class="workflow-arrow" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </div>

        <!-- Step 2 -->
        <div class="workflow-node">
          <div class="node-badge">
            <span>STEP 02</span>
            <span style="font-size:13px;">📡</span>
          </div>
          <div class="node-icon-wrap" style="background: rgba(24, 199, 126, 0.12); color: var(--green);">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          </div>
          <div class="node-title">2. Logs Are Generated</div>
          <div class="node-desc">Background tracking agents continuously capture high-frequency multimodal behavioral and biometric telemetry.</div>
          <div class="node-tags">
            <span class="node-chip">👁️ Eye Gaze (EAR & PERCLOS)</span>
            <span class="node-chip">😊 Facial Emotion & Tension</span>
            <span class="node-chip">⌨️ Keystroke Pauses & Backspaces</span>
            <span class="node-chip">🖱️ Mouse Path & Dwell Times</span>
            <span class="node-chip">📋 NASA-TLX Subjective Ratings</span>
          </div>
        </div>

        <!-- Connector Arrow -->
        <div class="workflow-arrow" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </div>

        <!-- Step 3 -->
        <div class="workflow-node">
          <div class="node-badge">
            <span>STEP 03</span>
            <span style="font-size:13px;">🧠</span>
          </div>
          <div class="node-icon-wrap" style="background: rgba(111, 66, 255, 0.12); color: var(--purple);">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </div>
          <div class="node-title">3. Cognitive Load Calculated using Model</div>
          <div class="node-desc">Inference engine processes telemetry streams via ML model & composite formula into continuous CLI scores.</div>
          <div class="node-tags">
            <span class="node-chip">🤖 Shallow XGBoost Regressor</span>
            <span class="node-chip">📐 Formula: 0.3E + 0.1F + 0.15M + 0.25N + 0.2P</span>
            <span class="node-chip">🚦 Strain Tiers: Flow → Moderate → High → Overload</span>
          </div>
        </div>

        <!-- Connector Arrow -->
        <div class="workflow-arrow" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </div>

        <!-- Step 4 (This Page) -->
        <div class="workflow-node node-active">
          <div class="node-badge badge-active">
            <span>STEP 04 • THIS PAGE</span>
            <span style="font-size:13px;">🖥️</span>
          </div>
          <div class="node-icon-wrap" style="background: rgba(47, 107, 255, 0.2); color: var(--blue);">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
          </div>
          <div class="node-title">4. Present Page: Displaying Generated Logs</div>
          <div class="node-desc"><strong>This present dashboard</strong> is the central hub for monitoring, filtering, and auditing all generated logs & scores.</div>
          <div class="node-tags">
            <span class="node-chip">👥 Cohort & User-Level Filters</span>
            <span class="node-chip">📊 CLI Scores, Trends & Modalities</span>
            <span class="node-chip">📑 Raw Multi-Second Telemetry Logs</span>
            <span class="node-chip">💾 Excel / CSV Dataset Exports</span>
          </div>
        </div>
      </div>

      <div class="workflow-footer-note ${isCollapsed ? 'is-collapsed' : ''}" id="workflowFooterNote">
        <span class="info-icon">ℹ️</span>
        <span>
          <strong>Pipeline Flow:</strong> Participants interact with tasks (1) ➔ Sensors record multimodal logs (2) ➔ The ML model calculates cognitive load scores (3) ➔ <strong>This present dashboard (4)</strong> displays, filters, and analyzes all generated telemetry and metrics.
        </span>
      </div>
    </section>
  `;
}

function renderAdminAnalytics(data, cliData) {
  const isCohort = !adminFilterState.selectedParticipant || adminFilterState.selectedParticipant === 'all';

  // Extract unified participant roster for dropdown and tables
  let participantList = [];
  if (Array.isArray(adminFilterState.cachedCohortParticipants) && adminFilterState.cachedCohortParticipants.length) {
    participantList = adminFilterState.cachedCohortParticipants;
  } else if (cliData && Array.isArray(cliData.participants)) {
    participantList = cliData.participants;
  } else if (adminFilterState.cachedCognitiveData && Array.isArray(adminFilterState.cachedCognitiveData.participants)) {
    participantList = adminFilterState.cachedCognitiveData.participants;
  } else if (Array.isArray(data.stored_results) && data.stored_results.length) {
    participantList = data.stored_results;
  }

  const domains = [...new Set(participantList.map(p => p.domain).filter(Boolean))].sort();

  return `
    <!-- Top Filter Bar -->
    <section class="admin-filter-bar" aria-label="Participant Cognitive Load Filters">
      <div>
        <select id="adminUserSelector" aria-label="Select participant or all users">
          <option value="all" ${adminFilterState.selectedParticipant === 'all' ? 'selected' : ''}>👥 All Users (Platform Cohort Overview)</option>
          ${participantList.map(p => `
            <option value="${escapeHtml(p.participant_id)}" ${adminFilterState.selectedParticipant === p.participant_id ? 'selected' : ''}>
              👤 ${escapeHtml(p.participant_id)} — ${escapeHtml(p.full_name || 'Participant')} (${escapeHtml(p.domain || 'General')})
            </option>
          `).join('')}
        </select>
      </div>
      <div>
        <input type="text" id="adminUserSearch" value="${escapeHtml(adminFilterState.searchQuery)}" placeholder="🔍 Search participant name or ID..." aria-label="Search participants">
      </div>
      <div>
        <select id="adminStatusFilter" aria-label="Filter by session status">
          <option value="all" ${adminFilterState.statusFilter === 'all' ? 'selected' : ''}>All Statuses</option>
          <option value="online" ${adminFilterState.statusFilter === 'online' ? 'selected' : ''}>Online / Active</option>
          <option value="ended" ${adminFilterState.statusFilter === 'ended' ? 'selected' : ''}>Ended / Completed</option>
          <option value="not started" ${adminFilterState.statusFilter === 'not started' ? 'selected' : ''}>Not Started</option>
        </select>
      </div>
      <div>
        <select id="adminDomainFilter" aria-label="Filter by discipline">
          <option value="all" ${adminFilterState.domainFilter === 'all' ? 'selected' : ''}>All Disciplines</option>
          ${domains.map(d => `<option value="${escapeHtml(d)}" ${adminFilterState.domainFilter === d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}
        </select>
      </div>
      <div>
        <button class="secondary reset-btn" id="adminResetFilter" type="button">Reset Filters</button>
      </div>
    </section>

    <!-- Dynamic Cognitive Load View Area -->
    <section class="admin-cli-section" id="adminCliContent">
      ${isCohort
      ? renderAdminCognitiveCohortView(cliData, participantList)
      : renderAdminCognitiveIndividualView(cliData, adminFilterState.selectedParticipant)}
    </section>

    <!-- Platform Tools & Telemetry Panel -->
    <article class="card panel admin-export-panel">
      <div class="section-label">All Platform Tracking Tables</div>
      <p>Directly inspect full database records across each individual sensing modality and telemetry component.</p>
      
      <div class="admin-export-buttons">
        <button class="secondary" data-admin-dataset="eye-tracking">Eye Tracking Table</button>
        <button class="secondary" data-admin-dataset="facial-expression">Facial Expression Table</button>
        <button class="secondary" data-admin-dataset="keyboard">Keyboard Table</button>
        <button class="secondary" data-admin-dataset="mouse">Mouse/Cursor Table</button>
        <button class="secondary" data-admin-dataset="prompt-tracking">Prompt Tracking Table</button>
        <button class="secondary" data-admin-dataset="multimodal-second">Multimodal Second-Level Table</button>
        <button class="secondary" data-admin-dataset="question-features">Question-Level Features Table</button>
        <button class="secondary" data-admin-dataset="measurement-records">Complete Measurement Records</button>
        <button class="secondary" data-admin-dataset="rag-prompt-evaluations">RAG Prompt Evaluation Table</button>
        <button class="secondary" data-admin-dataset="rag-pipeline">RAG Pipeline Table</button>
        <button class="secondary" data-admin-dataset="rag-documents">RAG Documents Table</button>
        <button class="secondary" data-admin-dataset="nasa-tlx">NASA-TLX Ratings Table</button>
        <button class="primary" data-admin-dataset="session-cli-change">Session CLI Change Table</button>
        <button class="secondary" data-admin-export="session-cli-change">Export Session CLI Change CSV</button>
      </div>

      <div class="section-label" style="margin-top:24px;">Dataset Integrity & Validation</div>
      <p>Verify feature parity, missing signals, duplicate keys, and multimodal sensor alignment before model training.</p>
      <div class="admin-export-buttons">
        <button class="secondary" data-admin-validation>Run Dataset Validation</button>
      </div>
    </article>
  `;
}

function renderAdminCognitiveCohortView(cliData, participantList) {
  const cohort = cliData?.cohort || {};
  const meanCli = Number(cohort.mean_cli ?? 52.4).toFixed(1);
  const peakCli = Number(cohort.peak_cli ?? 68.5).toFixed(1);
  const meanNasa = Number(cohort.mean_nasa_tlx ?? 51.0).toFixed(1);
  const totalCount = cohort.total_participants ?? participantList.length;
  const activeCount = cohort.active_participants ?? participantList.filter(p => p.session_status === 'online').length;
  const strainDist = cohort.strain_distribution || {
    flow: { count: 0, pct: 0 },
    moderate: { count: 0, pct: 0 },
    high: { count: 0, pct: 0 },
    overload: { count: 0, pct: 0 },
  };

  const highStrainTotal = (strainDist.high?.count || 0) + (strainDist.overload?.count || 0);

  return `
    <!-- Cohort KPI Grid -->
    <div class="admin-cli-kpi-grid">
      <article class="admin-cli-kpi-card">
        <span class="kpi-label">Platform Mean CLI</span>
        <div class="kpi-value-row">
          <span class="kpi-number" style="color:var(--blue)">${meanCli}</span>
          <span class="kpi-unit">/ 100</span>
        </div>
        <span class="kpi-badge badge-moderate">Empirical Multimodal Composite</span>
      </article>

      <article class="admin-cli-kpi-card">
        <span class="kpi-label">Peak Recorded Strain</span>
        <div class="kpi-value-row">
          <span class="kpi-number" style="color:#f59e0b">${peakCli}</span>
          <span class="kpi-unit">/ 100</span>
        </div>
        <span class="kpi-badge badge-high">Cohort Maximum Peak</span>
      </article>

      <article class="admin-cli-kpi-card">
        <span class="kpi-label">Mean NASA-TLX Workload</span>
        <div class="kpi-value-row">
          <span class="kpi-number" style="color:#7d64ff">${meanNasa}</span>
          <span class="kpi-unit">/ 100</span>
        </div>
        <span class="kpi-badge badge-moderate">Subjective Rating Avg</span>
      </article>

      <article class="admin-cli-kpi-card">
        <span class="kpi-label">Elevated Strain Alerts</span>
        <div class="kpi-value-row">
          <span class="kpi-number" style="color:${highStrainTotal > 0 ? '#ef4444' : '#10b981'}">${highStrainTotal}</span>
          <span class="kpi-unit">Users</span>
        </div>
        <span class="kpi-badge ${highStrainTotal > 0 ? 'badge-overload' : 'badge-flow'}">${highStrainTotal > 0 ? 'High / Overload Friction' : 'Optimal Flow Equilibrium'}</span>
      </article>

      <article class="admin-cli-kpi-card">
        <span class="kpi-label">Monitored Participants</span>
        <div class="kpi-value-row">
          <span class="kpi-number">${totalCount}</span>
          <span class="kpi-unit">(${activeCount} online)</span>
        </div>
        <span class="kpi-badge badge-flow">Full Cohort Roster</span>
      </article>
    </div>

    <!-- Cognitive Strain Distribution Bar -->
    <div class="admin-strain-bar-container">
      <div class="admin-strain-bar-header">
        <h4>Cohort Cognitive Strain Distribution (4 Validated Tiers)</h4>
        <small style="color:var(--muted)">Based on 2D Latent Strain Space Benchmark</small>
      </div>
      <div class="admin-strain-track" aria-label="Strain distribution track">
        <div class="admin-strain-seg flow" style="width:${strainDist.flow?.pct || 25}%" title="Flow / Low (<50): ${strainDist.flow?.count || 0} (${strainDist.flow?.pct || 0}%)"></div>
        <div class="admin-strain-seg moderate" style="width:${strainDist.moderate?.pct || 25}%" title="Moderate (50-62): ${strainDist.moderate?.count || 0} (${strainDist.moderate?.pct || 0}%)"></div>
        <div class="admin-strain-seg high" style="width:${strainDist.high?.pct || 25}%" title="High Strain (62-75): ${strainDist.high?.count || 0} (${strainDist.high?.pct || 0}%)"></div>
        <div class="admin-strain-seg overload" style="width:${strainDist.overload?.pct || 25}%" title="Overload (>=75): ${strainDist.overload?.count || 0} (${strainDist.overload?.pct || 0}%)"></div>
      </div>
      <div class="admin-strain-legend">
        <div class="admin-strain-legend-item">
          <span class="admin-strain-dot flow"></span>
          <span>Flow / Low (&lt;50): <strong>${strainDist.flow?.count || 0} (${strainDist.flow?.pct || 0}%)</strong></span>
        </div>
        <div class="admin-strain-legend-item">
          <span class="admin-strain-dot moderate"></span>
          <span>Moderate (50–62): <strong>${strainDist.moderate?.count || 0} (${strainDist.moderate?.pct || 0}%)</strong></span>
        </div>
        <div class="admin-strain-legend-item">
          <span class="admin-strain-dot high"></span>
          <span>High Strain (62–75): <strong>${strainDist.high?.count || 0} (${strainDist.high?.pct || 0}%)</strong></span>
        </div>
        <div class="admin-strain-legend-item">
          <span class="admin-strain-dot overload"></span>
          <span>Overload (&ge;75): <strong>${strainDist.overload?.count || 0} (${strainDist.overload?.pct || 0}%)</strong></span>
        </div>
      </div>
    </div>

    <!-- Participant Cognitive Load Roster Table -->
    <article class="card panel admin-cli-roster-card">
      <div class="detail-page-heading">
        <div>
          <div class="section-label">PARTICIPANT COGNITIVE LOAD ROSTER</div>
          <h3>Cohort Participant Comparison</h3>
          <p id="rosterFilterCountText">Showing ${participantList.length} monitored participant(s). Select a user to inspect their multimodal telemetry breakdown.</p>
        </div>
      </div>
      <div class="monitor-table">
        <table id="adminParticipantRosterTable">
          <thead>
            <tr>
              <th>Participant</th>
              <th>Domain</th>
              <th>Status</th>
              <th>Time in App</th>
              <th>Answers</th>
              <th>NASA-TLX</th>
              <th>Cognitive Load Index (CLI)</th>
              <th>Trend</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="adminParticipantRosterBody">
            ${renderAdminRosterRows(participantList)}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderAdminRosterRows(participants) {
  const query = (adminFilterState.searchQuery || '').toLowerCase().trim();
  const statusFilter = adminFilterState.statusFilter || 'all';
  const domainFilter = adminFilterState.domainFilter || 'all';

  const filtered = participants.filter(p => {
    const id = String(p.participant_id || '').toLowerCase();
    const name = String(p.full_name || '').toLowerCase();
    const domain = String(p.domain || '').toLowerCase();
    const status = String(p.session_status || 'not started').toLowerCase();

    if (query && !id.includes(query) && !name.includes(query) && !domain.includes(query)) {
      return false;
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'online' && status !== 'online') return false;
      if (statusFilter === 'ended' && status !== 'ended') return false;
      if (statusFilter === 'not started' && status !== 'not started') return false;
    }
    if (domainFilter !== 'all' && p.domain !== domainFilter) {
      return false;
    }
    return true;
  });

  if (!filtered.length) {
    return `<tr><td colspan="9" style="text-align:center;padding:28px;color:var(--muted);">No participants match the selected filter criteria.</td></tr>`;
  }

  return filtered.map(item => {
    const status = String(item.session_status || 'not started');
    const statusClass = status === 'online' ? 'online' : status === 'ended' ? 'ended' : 'not-started';
    const cliScore = Number(item.average_cli ?? 50.0).toFixed(1);
    const badgeClass = item.badge_class || (cliScore < 50 ? 'badge-flow' : cliScore < 62 ? 'badge-moderate' : cliScore < 75 ? 'badge-high' : 'badge-overload');
    const tierName = item.strain_tier || (cliScore < 50 ? 'Flow / Low' : cliScore < 62 ? 'Moderate' : cliScore < 75 ? 'High Strain' : 'Overload');
    const tierColor = item.tier_color || (cliScore < 50 ? '#10b981' : cliScore < 62 ? '#3b82f6' : cliScore < 75 ? '#f59e0b' : '#ef4444');
    const durationStr = item.time_spent_formatted || formatDuration(item.time_spent_seconds);
    const nasaVal = item.nasa_score ? Number(item.nasa_score).toFixed(1) : '—';
    const trendIcon = item.trend_icon || '=';
    const trendStatus = item.trend_status || 'Steady';
    const trendColor = item.trend_color || '#3b82f6';

    return `
      <tr>
        <td>
          <strong>${escapeHtml(String(item.participant_id))}</strong><br>
          <small>${escapeHtml(String(item.full_name || 'Participant'))}</small>
        </td>
        <td>
          <strong>${escapeHtml(String(item.domain || 'General'))}</strong><br>
          <small style="color:var(--muted)">${escapeHtml(String(item.age_group || '—'))}</small>
        </td>
        <td><span class="participant-status ${statusClass}">${escapeHtml(status)}</span></td>
        <td><strong>${durationStr}</strong></td>
        <td>${Number(item.answers_submitted || 0)}</td>
        <td><strong>${nasaVal}</strong></td>
        <td>
          <div class="admin-cli-score-cell">
            <strong style="color:${tierColor};min-width:38px;">${cliScore}</strong>
            <div class="admin-cli-mini-bar">
              <i style="width:${Math.max(5, Math.min(100, cliScore))}%;background:${tierColor}"></i>
            </div>
            <span class="kpi-badge ${badgeClass}">${tierName}</span>
          </div>
        </td>
        <td>
          <span style="color:${trendColor};font-weight:700;display:inline-flex;align-items:center;gap:4px;">
            <span>${trendIcon}</span> <small>${trendStatus}</small>
          </span>
        </td>
        <td>
          <div style="display:flex;gap:6px;align-items:center;">
            <button class="primary compact-action" type="button" data-inspect-user="${escapeHtml(String(item.participant_id))}">Inspect User</button>
            <button class="secondary compact-action" type="button" data-view-logs="${escapeHtml(String(item.participant_id))}">Logs</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAdminCognitiveIndividualView(cliData, participantId) {
  if (!cliData || !cliData.participant) {
    return `
      <article class="card panel">
        <div class="detail-page-heading">
          <div>
            <div class="section-label">PARTICIPANT COGNITIVE LOAD DRILL-DOWN</div>
            <h3>Loading participant metrics for ${escapeHtml(participantId)}…</h3>
          </div>
          <button class="secondary" id="backToCohortBtn" type="button">← Back to All Users</button>
        </div>
      </article>
    `;
  }

  const p = cliData.participant;
  const c = cliData.cli;
  const m = cliData.modalities;
  const status = String(p.session_status || 'not started');
  const statusClass = status === 'online' ? 'online' : status === 'ended' ? 'ended' : 'not-started';
  const initial = (p.full_name || 'U').charAt(0).toUpperCase();

  return `
    <!-- Participant Profile Banner -->
    <div class="admin-user-profile-banner">
      <div class="admin-user-profile-info">
        <div class="admin-user-avatar">${initial}</div>
        <div>
          <div class="section-label" style="margin-bottom:4px;">INDIVIDUAL PARTICIPANT COGNITIVE LOAD PROFILE</div>
          <h2 style="margin:0 0 4px;font-size:24px;">${escapeHtml(p.full_name)} <span style="font-size:16px;color:var(--muted);font-weight:400;">(${escapeHtml(p.participant_id)})</span></h2>
          <div class="admin-user-meta-tags">
            <span class="admin-user-tag">🎓 Domain: <strong>${escapeHtml(p.domain || 'General')}</strong></span>
            <span class="admin-user-tag">👤 Age: <strong>${escapeHtml(p.age_group || '—')}</strong></span>
            <span class="admin-user-tag">🤖 AI Familiarity: <strong>${escapeHtml(p.ai_familiarity || '—')}</strong></span>
            <span class="admin-user-tag">⏱️ Active Time: <strong>${escapeHtml(p.time_spent_formatted)}</strong></span>
            <span class="participant-status ${statusClass}" style="font-size:12px;margin-left:6px;">${escapeHtml(status)}</span>
          </div>
        </div>
      </div>
      <div>
        <button class="secondary" id="backToCohortBtn" type="button">← Back to All Users</button>
      </div>
    </div>

    <!-- Cognitive Load Scorecard Grid -->
    <div class="admin-user-scorecard-grid">
      <article class="admin-cli-kpi-card">
        <span class="kpi-label">Average Cognitive Load Index</span>
        <div class="kpi-value-row">
          <span class="kpi-number" style="color:${c.tier_color}">${Number(c.average_cli).toFixed(1)}</span>
          <span class="kpi-unit">/ 100</span>
        </div>
        <div style="margin-top:8px;">
          <span class="kpi-badge ${c.badge_class}">${c.strain_tier}</span>
        </div>
        <small style="color:var(--muted);margin-top:6px;font-size:11.5px;">Operational Scale: 0 to 100 CLI</small>
      </article>

      <article class="admin-cli-kpi-card">
        <span class="kpi-label">Baseline vs End CLI (Task-Induced Change)</span>
        <div class="kpi-value-row">
          <span class="kpi-number">${Number(c.baseline_cli).toFixed(1)}</span>
          <span class="kpi-unit" style="margin:0 4px;">➔</span>
          <span class="kpi-number" style="color:var(--blue)">${Number(c.end_cli).toFixed(1)}</span>
        </div>
        <div style="margin-top:8px;">
          <span class="kpi-badge ${c.absolute_change >= 0 ? 'badge-high' : 'badge-flow'}">
            ${c.absolute_change >= 0 ? `+${c.absolute_change}` : c.absolute_change} pts (${c.percentage_change >= 0 ? `+${c.percentage_change}` : c.percentage_change}%)
          </span>
        </div>
        <small style="color:var(--muted);margin-top:6px;font-size:11.5px;">Absolute delta across assessment</small>
      </article>

      <article class="admin-cli-kpi-card">
        <span class="kpi-label">Peak Workload Spike</span>
        <div class="kpi-value-row">
          <span class="kpi-number" style="color:#f59e0b">${Number(c.peak_cli).toFixed(1)}</span>
          <span class="kpi-unit">/ 100</span>
        </div>
        <div style="margin-top:8px;">
          <span class="kpi-badge badge-high">Highest Recorded Second</span>
        </div>
        <small style="color:var(--muted);margin-top:6px;font-size:11.5px;">Peak mental demand saturation</small>
      </article>

      <article class="admin-cli-kpi-card">
        <span class="kpi-label">Cognitive Strain Trend</span>
        <div class="kpi-value-row">
          <span class="kpi-number" style="color:${c.trend_color}">${c.trend_icon}</span>
          <span style="font-size:18px;font-weight:700;color:${c.trend_color};margin-left:6px;">${c.trend_status}</span>
        </div>
        <div style="margin-top:8px;">
          <span class="kpi-badge badge-moderate">Slope: ${Number(c.trend_slope).toFixed(3)}</span>
        </div>
        <small style="color:var(--muted);margin-top:6px;font-size:11.5px;">Progression across question tasks</small>
      </article>
    </div>

    <!-- Five Research Modality Cards (E, F, M, N, P) -->
    <div class="detail-page-heading" style="margin-top:8px;">
      <div>
        <div class="section-label">MULTIMODAL SENSOR CONTRIBUTION BREAKDOWN</div>
        <p>Mathematical decomposition using the empirically validated benchmark: CLI(t) = 100 × [ 0.30·E + 0.10·F + 0.15·M + 0.25·N + 0.20·P ]</p>
      </div>
    </div>

    <div class="admin-modalities-grid">
      <!-- Modality E: Eye Tracking -->
      <article class="admin-modality-card">
        <div>
          <div class="admin-modality-header">
            <strong>👁️ ${m.eye.label}</strong>
            <small>${m.eye.weight}</small>
          </div>
          <div class="admin-modality-score" style="color:var(--blue)">${m.eye.score_pct}%</div>
          <div class="admin-cli-mini-bar" style="width:100%;max-width:none;height:6px;margin-bottom:10px;">
            <i style="width:${m.eye.score_pct}%;background:var(--blue)"></i>
          </div>
        </div>
        <div class="admin-modality-details">
          <div>Mean EAR: <strong>${m.eye.mean_ear}</strong></div>
          <div>Mean PERCLOS: <strong>${m.eye.mean_perclos}</strong></div>
          <div>Blinks: <strong>${m.eye.blink_count}</strong> | Saccades: <strong>${m.eye.saccade_count}</strong></div>
          <div>Telemetry Samples: <strong>${m.eye.samples}</strong></div>
        </div>
      </article>

      <!-- Modality F: Facial Affect -->
      <article class="admin-modality-card">
        <div>
          <div class="admin-modality-header">
            <strong>😊 ${m.facial.label}</strong>
            <small>${m.facial.weight}</small>
          </div>
          <div class="admin-modality-score" style="color:#7d64ff">${m.facial.score_pct}%</div>
          <div class="admin-cli-mini-bar" style="width:100%;max-width:none;height:6px;margin-bottom:10px;">
            <i style="width:${m.facial.score_pct}%;background:#7d64ff"></i>
          </div>
        </div>
        <div class="admin-modality-details">
          <div>Dominant: <strong style="text-transform:capitalize;">${m.facial.dominant_emotion}</strong></div>
          <div>Strained Frames: <strong>${m.facial.strained_count}</strong></div>
          <div>Focused Frames: <strong>${m.facial.focused_count}</strong></div>
          <div>Processed Frames: <strong>${m.facial.frames}</strong></div>
        </div>
      </article>

      <!-- Modality M: Behavioral Friction -->
      <article class="admin-modality-card">
        <div>
          <div class="admin-modality-header">
            <strong>⌨️ ${m.behavior.label}</strong>
            <small>${m.behavior.weight}</small>
          </div>
          <div class="admin-modality-score" style="color:#f59e0b">${m.behavior.score_pct}%</div>
          <div class="admin-cli-mini-bar" style="width:100%;max-width:none;height:6px;margin-bottom:10px;">
            <i style="width:${m.behavior.score_pct}%;background:#f59e0b"></i>
          </div>
        </div>
        <div class="admin-modality-details">
          <div>Thinking Pause: <strong>${m.behavior.avg_pause_seconds}s</strong></div>
          <div>Backspaces: <strong>${m.behavior.backspace_count}</strong></div>
          <div>Cursor Travel: <strong>${m.behavior.cursor_distance_px} px</strong></div>
          <div>Scrolls: <strong>${m.behavior.scroll_count}</strong></div>
        </div>
      </article>

      <!-- Modality N: NASA-TLX Workload -->
      <article class="admin-modality-card">
        <div>
          <div class="admin-modality-header">
            <strong>📋 ${m.nasa_tlx.label}</strong>
            <small>${m.nasa_tlx.weight}</small>
          </div>
          <div class="admin-modality-score" style="color:#10b981">${m.nasa_tlx.score_pct}%</div>
          <div class="admin-cli-mini-bar" style="width:100%;max-width:none;height:6px;margin-bottom:10px;">
            <i style="width:${m.nasa_tlx.score_pct}%;background:#10b981"></i>
          </div>
        </div>
        <div class="admin-modality-details">
          <div>Overall Rating: <strong>${m.nasa_tlx.overall_score}</strong></div>
          <div>Mental: <strong>${m.nasa_tlx.mental_demand}</strong> | Temporal: <strong>${m.nasa_tlx.temporal_demand}</strong></div>
          <div>Effort: <strong>${m.nasa_tlx.effort}</strong> | Frustration: <strong>${m.nasa_tlx.frustration}</strong></div>
          <div>Performance: <strong>${m.nasa_tlx.performance}</strong></div>
        </div>
      </article>

      <!-- Modality P: Task Performance -->
      <article class="admin-modality-card">
        <div>
          <div class="admin-modality-header">
            <strong>🎯 ${m.performance.label}</strong>
            <small>${m.performance.weight}</small>
          </div>
          <div class="admin-modality-score" style="color:#00e5ff">${m.performance.score_pct}%</div>
          <div class="admin-cli-mini-bar" style="width:100%;max-width:none;height:6px;margin-bottom:10px;">
            <i style="width:${m.performance.score_pct}%;background:#00e5ff"></i>
          </div>
        </div>
        <div class="admin-modality-details">
          <div>Answers: <strong>${m.performance.answers_submitted}</strong></div>
          <div>Avg Latency: <strong>${m.performance.avg_duration_seconds}s</strong></div>
          <div>Progress: <strong>${p.progress_percent}%</strong></div>
          <div>Session State: <strong>${status}</strong></div>
        </div>
      </article>
    </div>

    <!-- Per-Question Cognitive Timeline -->
    <article class="card panel admin-timeline-table-card">
      <div class="section-label">TASK-BY-TASK COGNITIVE LOAD PROGRESSION</div>
      <p>Tracks how mental fatigue, correction overhead, and cognitive strain evolved across each assessment question.</p>
      <div class="monitor-table">
        <table>
          <thead>
            <tr>
              <th>Task #</th>
              <th>Question ID</th>
              <th>Cognitive Load (CLI)</th>
              <th>Strain State</th>
              <th>Solving Duration</th>
              <th>Thinking Pauses</th>
              <th>PAAS Rating</th>
              <th>LLM Assistance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${cliData.per_question_timeline.map(q => `
              <tr>
                <td><strong>Task ${q.task_number}</strong></td>
                <td><code>${escapeHtml(q.question_id)}</code></td>
                <td><strong style="color:var(--blue)">${q.cli_score}</strong> / 100</td>
                <td><span class="kpi-badge ${q.cli_score < 50 ? 'badge-flow' : q.cli_score < 62 ? 'badge-moderate' : q.cli_score < 75 ? 'badge-high' : 'badge-overload'}">${escapeHtml(q.tier)}</span></td>
                <td>${q.duration_seconds}s</td>
                <td>${q.pause_seconds}s</td>
                <td>${q.paas_rating} / 9</td>
                <td><span class="admin-user-tag">${escapeHtml(q.llm_used)}</span></td>
                <td><span class="participant-status ${q.submitted ? 'online' : 'not-started'}">${q.submitted ? 'Submitted' : 'Pending'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </article>

    <!-- Raw Telemetry Logs Shortcuts (Pre-Filtered For This User) -->
    <article class="card panel admin-telemetry-shortcuts">
      <div class="section-label">INSPECT RAW TELEMETRY LOGS FOR ${escapeHtml(p.participant_id)}</div>
      <p>Instantly jump into the database tracking records pre-filtered exclusively for <strong>${escapeHtml(p.full_name)} (${escapeHtml(p.participant_id)})</strong>.</p>
      
      <div class="admin-telemetry-btn-grid">
        <button class="secondary" data-admin-dataset="multimodal-second" data-filter-pid="${escapeHtml(p.participant_id)}">
          ⏱️ Multimodal Seconds (${cliData.telemetry_counts.multimodal_seconds})
        </button>
        <button class="secondary" data-admin-dataset="eye-tracking" data-filter-pid="${escapeHtml(p.participant_id)}">
          👁️ Eye Tracking Logs (${cliData.telemetry_counts.eye_tracking})
        </button>
        <button class="secondary" data-admin-dataset="facial-expression" data-filter-pid="${escapeHtml(p.participant_id)}">
          😊 Facial Affect Logs (${cliData.telemetry_counts.facial_expression})
        </button>
        <button class="secondary" data-admin-dataset="keyboard" data-filter-pid="${escapeHtml(p.participant_id)}">
          ⌨️ Keyboard Telemetry (${cliData.telemetry_counts.keyboard_tracking})
        </button>
        <button class="secondary" data-admin-dataset="mouse" data-filter-pid="${escapeHtml(p.participant_id)}">
          🖱️ Mouse Movements (${cliData.telemetry_counts.mouse_tracking})
        </button>
        <button class="secondary" data-admin-dataset="session-cli-change" data-filter-pid="${escapeHtml(p.participant_id)}">
          📈 CLI Change Record
        </button>
        <button class="secondary" data-admin-dataset="nasa-tlx" data-filter-pid="${escapeHtml(p.participant_id)}">
          📋 NASA-TLX Record (${cliData.telemetry_counts.nasa_tlx})
        </button>
        <button class="primary" data-admin-export="session-cli-change" data-filter-pid="${escapeHtml(p.participant_id)}">
          📥 Export User CLI CSV
        </button>
      </div>
    </article>
  `;
}

function attachAdminDashboardEvents(container, data, cliData) {
  // 1. User Selector dropdown
  const userSelector = container.querySelector('#adminUserSelector');
  if (userSelector) {
    userSelector.onchange = () => {
      adminFilterState.selectedParticipant = userSelector.value;
      refreshDashboard();
    };
  }

  // 2. Search input filtering
  const searchInput = container.querySelector('#adminUserSearch');
  if (searchInput) {
    searchInput.oninput = () => {
      adminFilterState.searchQuery = searchInput.value;
      updateRosterDisplay(container, cliData, data);
    };
  }

  // 3. Status filter
  const statusSelect = container.querySelector('#adminStatusFilter');
  if (statusSelect) {
    statusSelect.onchange = () => {
      adminFilterState.statusFilter = statusSelect.value;
      updateRosterDisplay(container, cliData, data);
    };
  }

  // 4. Domain filter
  const domainSelect = container.querySelector('#adminDomainFilter');
  if (domainSelect) {
    domainSelect.onchange = () => {
      adminFilterState.domainFilter = domainSelect.value;
      updateRosterDisplay(container, cliData, data);
    };
  }

  // 5. Reset button
  const resetBtn = container.querySelector('#adminResetFilter');
  if (resetBtn) {
    resetBtn.onclick = () => {
      adminFilterState.selectedParticipant = 'all';
      adminFilterState.searchQuery = '';
      adminFilterState.statusFilter = 'all';
      adminFilterState.domainFilter = 'all';
      refreshDashboard();
    };
  }

  // 6. Back to Cohort View button
  const backBtn = container.querySelector('#backToCohortBtn');
  if (backBtn) {
    backBtn.onclick = () => {
      adminFilterState.selectedParticipant = 'all';
      refreshDashboard();
    };
  }

  // 7. Inspect User buttons (inside table)
  container.querySelectorAll('[data-inspect-user]').forEach(btn => {
    btn.onclick = () => {
      adminFilterState.selectedParticipant = btn.dataset.inspectUser;
      refreshDashboard();
    };
  });

  // 8. View Logs buttons (inside table)
  container.querySelectorAll('[data-view-logs]').forEach(btn => {
    btn.onclick = () => {
      openAdminDataPage('multimodal-second', 1, btn.dataset.viewLogs);
    };
  });

  // 9. Standard dataset buttons (passes active participant filter if set)
  container.querySelectorAll('[data-admin-dataset]').forEach(button => {
    button.onclick = () => {
      const filterPid = button.dataset.filterPid || (adminFilterState.selectedParticipant !== 'all' ? adminFilterState.selectedParticipant : null);
      openAdminDataPage(button.dataset.adminDataset, 1, filterPid);
    };
  });

  // 10. Export buttons
  container.querySelectorAll('[data-admin-export]').forEach(button => {
    button.onclick = () => {
      const filterPid = button.dataset.filterPid || (adminFilterState.selectedParticipant !== 'all' ? adminFilterState.selectedParticipant : null);
      downloadTrackingExport(button.dataset.adminExport, filterPid);
    };
  });

  // 11. Legacy individual participant hooks
  container.querySelectorAll('[data-individual-participant]').forEach(button => {
    button.onclick = () => {
      adminFilterState.selectedParticipant = button.dataset.individualParticipant;
      refreshDashboard();
    };
  });

  // 12. Dataset validation
  const validationButton = container.querySelector('[data-admin-validation]');
  if (validationButton) validationButton.onclick = openDatasetValidationPage;

  // 13. Workflow Flowchart Toggle
  const toggleWorkflowBtn = container.querySelector('#toggleWorkflowBtn');
  if (toggleWorkflowBtn) {
    toggleWorkflowBtn.onclick = () => {
      adminFilterState.workflowCollapsed = !adminFilterState.workflowCollapsed;
      const content = container.querySelector('#workflowFlowchartContent');
      const note = container.querySelector('#workflowFooterNote');
      if (content) content.classList.toggle('is-collapsed', adminFilterState.workflowCollapsed);
      if (note) note.classList.toggle('is-collapsed', adminFilterState.workflowCollapsed);
      toggleWorkflowBtn.textContent = adminFilterState.workflowCollapsed ? '▼ Show Pipeline' : '▲ Hide Pipeline';
    };
  }
}

function updateRosterDisplay(container, cliData, data) {
  const tbody = container.querySelector('#adminParticipantRosterBody');
  const countText = container.querySelector('#rosterFilterCountText');
  if (!tbody) return;

  let participantList = [];
  if (cliData && cliData.mode === 'cohort' && Array.isArray(cliData.participants)) {
    participantList = cliData.participants;
  } else if (adminFilterState.cachedCognitiveData && Array.isArray(adminFilterState.cachedCognitiveData.participants)) {
    participantList = adminFilterState.cachedCognitiveData.participants;
  } else if (Array.isArray(data?.stored_results)) {
    participantList = data.stored_results;
  }

  tbody.innerHTML = renderAdminRosterRows(participantList);

  // Re-attach inspect & log click handlers on filtered rows
  tbody.querySelectorAll('[data-inspect-user]').forEach(btn => {
    btn.onclick = () => {
      adminFilterState.selectedParticipant = btn.dataset.inspectUser;
      refreshDashboard();
    };
  });
  tbody.querySelectorAll('[data-view-logs]').forEach(btn => {
    btn.onclick = () => {
      openAdminDataPage('multimodal-second', 1, btn.dataset.viewLogs);
    };
  });

  if (countText) {
    const visibleCount = tbody.querySelectorAll('tr').length;
    countText.textContent = `Showing filtered participants. Query: "${adminFilterState.searchQuery || 'None'}", Status: ${adminFilterState.statusFilter}, Discipline: ${adminFilterState.domainFilter}`;
  }
}

async function downloadTrackingExport(exportName, specificParticipant = null) {
  try {
    const params = new URLSearchParams();
    const participant = specificParticipant || document.getElementById('exportParticipant')?.value || (adminFilterState.selectedParticipant !== 'all' ? adminFilterState.selectedParticipant : null);
    const dateFrom = document.getElementById('exportDateFrom')?.value;
    const dateTo = document.getElementById('exportDateTo')?.value;
    const completed = document.getElementById('exportCompleted')?.value;
    if (participant) params.set('participant_id', participant);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (completed) params.set('completed', completed);
    const query = params.toString();
    const response = await fetch(`${API_BASE_URL}/admin/exports/${encodeURIComponent(exportName)}.csv${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${state.authToken}` }
    });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || `HTTP ${response.status}`);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;

    const exportFilenames = {
      'multimodal-second-level':
        'multimodal_second_level.csv',
      'question-level-features':
        'question_level_features.csv'
    };

    const participantSuffix = participant ? `-${participant}` : '';
    link.download =
      exportFilenames[exportName]
        ? exportFilenames[exportName].replace('.csv', `${participantSuffix}.csv`)
        : `cognitrack-${exportName}${participantSuffix}.csv`;

    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert(`Tracking export failed: ${error.message}`);
  }
}

async function openDatasetValidationPage() {
  const container =
    document.getElementById(
      'dashboardContent'
    );

  if (
    !container ||
    !state.authToken
  ) {
    return;
  }

  clearInterval(
    dashboardTimer
  );

  container.innerHTML =
    '<article class="card panel">Validating final ML datasets…</article>';

  try {
    const response =
      await fetch(
        `${API_BASE_URL}/admin/validation`,
        {
          headers: {
            Authorization:
              `Bearer ${state.authToken}`
          }
        }
      );

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.detail ||
        `HTTP ${response.status}`
      );
    }

    const report =
      data.validation || {};

    const status =
      String(
        report.status || 'UNKNOWN'
      ).toUpperCase();

    const metric = (
      label,
      value
    ) => `
      <article class="card">
        <small>
          ${escapeHtml(label)}
        </small>
        <strong>
          ${escapeHtml(
      String(value ?? 0)
    )}
        </strong>
      </article>
    `;

    container.innerHTML = `
      <article class="card panel admin-detail-page">
        <div class="detail-page-heading">
          <div>
            <div class="section-label">
              FINAL DATASET VALIDATION
            </div>

            <h3>
              Validation Status:
              ${escapeHtml(status)}
            </h3>

            <p>
              PASS means no critical structural or feature-consistency
              errors were detected. Missing Camera or Behavior seconds
              are shown separately as availability warnings.
            </p>
          </div>

          <button
            class="secondary"
            id="backToAdminDashboard"
            type="button"
          >
            Back to dashboard
          </button>
        </div>

        <section class="monitor-summary admin-summary">
          ${metric(
      'Participants',
      report.participants
    )}
          ${metric(
      'Second-level rows',
      report.second_level_rows
    )}
          ${metric(
      'Question-level rows',
      report.question_level_rows
    )}
          ${metric(
      'Critical errors',
      report.critical_error_count
    )}
        </section>

        <div class="monitor-table admin-record-table">
          <table>
            <thead>
              <tr>
                <th>Validation check</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Duplicate second rows</td>
                <td>${Number(report.duplicate_second_rows || 0)}</td>
              </tr>
              <tr>
                <td>Duplicate question rows</td>
                <td>${Number(report.duplicate_question_rows || 0)}</td>
              </tr>
              <tr>
                <td>Missing participant IDs</td>
                <td>${Number(report.missing_participant_ids || 0)}</td>
              </tr>
              <tr>
                <td>Missing question IDs</td>
                <td>${Number(report.missing_question_ids || 0)}</td>
              </tr>
              <tr>
                <td>Invalid elapsed seconds</td>
                <td>${Number(report.invalid_elapsed_seconds || 0)}</td>
              </tr>
              <tr>
                <td>Invalid ratios</td>
                <td>${Number(report.invalid_ratios || 0)}</td>
              </tr>
              <tr>
                <td>Invalid emotion ratio sums</td>
                <td>${Number(report.invalid_emotion_ratio_sums || 0)}</td>
              </tr>
              <tr>
                <td>Negative feature values</td>
                <td>${Number(report.negative_feature_values || 0)}</td>
              </tr>
              <tr>
                <td>Invalid prompt rows</td>
                <td>${Number(report.invalid_prompt_rows || 0)}</td>
              </tr>
              <tr>
                <td>Camera-missing seconds</td>
                <td>${Number(report.camera_missing_seconds || 0)}</td>
              </tr>
              <tr>
                <td>Behavior-missing seconds</td>
                <td>${Number(report.behavior_missing_seconds || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    `;

    document.getElementById(
      'backToAdminDashboard'
    ).onclick = () =>
        renderRoleDashboard('admin');

  } catch (error) {
    container.innerHTML = `
      <article class="card panel error">
        Dataset validation failed:
        ${escapeHtml(error.message)}
        <br><br>
        <button
          class="secondary"
          id="backToAdminDashboard"
          type="button"
        >
          Back to dashboard
        </button>
      </article>
    `;

    document.getElementById(
      'backToAdminDashboard'
    ).onclick = () =>
        renderRoleDashboard('admin');
  }
}


async function openAdminDataPage(dataset, page = 1, participantId = null) {
  const container = document.getElementById('dashboardContent');
  if (!container || !state.authToken) return;
  clearInterval(dashboardTimer);
  container.innerHTML = '<article class="card panel">Loading administrator records…</article>';
  try {
    const activePid = participantId !== null
      ? (participantId === 'all' ? null : participantId)
      : (adminFilterState.selectedParticipant && adminFilterState.selectedParticipant !== 'all' ? adminFilterState.selectedParticipant : null);

    const pagedDataset = ['tracking', 'measurement-records', 'rag-prompt-evaluations', 'rag-pipeline', 'rag-documents', 'multimodal-second', 'question-features', 'facial-expression', 'eye-tracking', 'keyboard', 'mouse', 'session-cli-change'].includes(dataset);

    const params = new URLSearchParams();
    if (pagedDataset) {
      params.set('page', page);
      params.set('page_size', 50);
    }
    if (activePid) {
      params.set('participant_id', activePid);
    }
    const query = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/admin/data/${encodeURIComponent(dataset)}${query}`, {
      headers: { Authorization: `Bearer ${state.authToken}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`);
    const records = data.records || [];

    // Participant options for quick switching in the table header
    const roster = adminFilterState.cachedCohortParticipants?.length
      ? adminFilterState.cachedCohortParticipants
      : (adminFilterState.cachedCognitiveData?.participants || adminFilterState.cachedCognitiveData?.participant_roster || []);
    const participantOptions = roster.map(p => `
      <option value="${escapeHtml(p.participant_id)}" ${activePid === p.participant_id ? 'selected' : ''}>
        ${escapeHtml(p.participant_id)} — ${escapeHtml(p.full_name || 'Participant')}
      </option>
    `).join('');

    const filterBanner = activePid ? `
      <div class="admin-filter-indicator">
        <span>🔍 Filtered by Participant: <strong>${escapeHtml(activePid)}</strong></span>
        <button class="secondary btn-xs" id="clearTableFilter" type="button" style="padding:0.25rem 0.6rem; font-size:0.75rem; margin-left:auto;">✕ Show All Records</button>
      </div>
    ` : '';

    container.innerHTML = `<article class="card panel admin-detail-page">
      <div class="detail-page-heading">
        <div>
          <div class="section-label">ADMINISTRATOR DATA</div>
          <h3>${escapeHtml(data.title || 'Details')}</h3>
          <p>${data.pagination ? `Showing ${records.length} of ${Number(data.pagination.total_records || 0)} records (page ${data.pagination.page} of ${data.pagination.total_pages}).` : `${records.length} record(s) shown.`}</p>
          <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.4rem; flex-wrap:wrap;">
            <label for="tableParticipantSelector" style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Filter Participant:</label>
            <select id="tableParticipantSelector" class="form-input" style="padding:0.25rem 0.5rem; font-size:0.8rem; width:auto; max-width:260px;">
              <option value="all">👥 All Participants</option>
              ${participantOptions}
            </select>
          </div>
        </div>
        <button class="secondary" id="backToAdminDashboard">Back to dashboard</button>
      </div>
      ${filterBanner}
      ${dataset === 'session-cli-change' ? '<div class="admin-detail-actions"><button class="secondary" id="exportCurrentAdminDataset" type="button">Export CSV</button></div>' : ''}
      ${renderAdminRecordTable(records, dataset, data.fields || [])}
      ${data.pagination ? renderAdminPagination(dataset, data.pagination) : ''}
    </article>`;

    document.getElementById('backToAdminDashboard').onclick = () => renderRoleDashboard('admin');

    const selector = document.getElementById('tableParticipantSelector');
    if (selector) {
      selector.value = activePid || 'all';
      selector.onchange = (e) => {
        const chosen = e.target.value === 'all' ? 'all' : e.target.value;
        if (adminFilterState) adminFilterState.selectedParticipant = chosen;
        openAdminDataPage(dataset, 1, chosen);
      };
    }

    const clearFilterBtn = document.getElementById('clearTableFilter');
    if (clearFilterBtn) {
      clearFilterBtn.onclick = () => {
        if (adminFilterState) adminFilterState.selectedParticipant = 'all';
        openAdminDataPage(dataset, 1, 'all');
      };
    }

    const exportButton = document.getElementById('exportCurrentAdminDataset');
    if (exportButton) exportButton.onclick = () => downloadTrackingExport(dataset, activePid);

    container.querySelectorAll('[data-admin-page]').forEach(button => {
      button.onclick = () => openAdminDataPage(dataset, Number(button.dataset.adminPage), activePid);
    });
  } catch (error) {
    container.innerHTML = `<article class="card panel error">Unable to load administrator data: ${escapeHtml(error.message)}<br><br><button class="secondary" id="backToAdminDashboard">Back to dashboard</button></article>`;
    document.getElementById('backToAdminDashboard').onclick = () => renderRoleDashboard('admin');
  }
}

function renderAdminRecordTable(records, dataset = '', suppliedColumns = []) {
  if (!records.length) return '<p>No records have been saved for this category yet.</p>';
  const columns = suppliedColumns.length
    ? suppliedColumns
    : [...new Set(records.flatMap(record => Object.keys(record)))];
  const label = column => column.replaceAll('_', ' ');
  return `<div class="monitor-table admin-record-table"><table><thead><tr>${columns.map(column => `<th>${escapeHtml(label(column))}</th>`).join('')}</tr></thead><tbody>${records.map(record => `<tr>${columns.map(column => `<td>${escapeHtml(formatAdminValue(record[column]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderAdminPagination(dataset, pagination) {
  const page = Number(pagination.page || 1);
  const totalPages = Number(pagination.total_pages || 1);
  return `<nav class="admin-pagination" aria-label="Admin table pages"><button class="secondary" type="button" data-admin-page="${Math.max(1, page - 1)}" ${page <= 1 ? 'disabled' : ''}>Previous</button><span>Page ${page} of ${totalPages}</span><button class="secondary" type="button" data-admin-page="${Math.min(totalPages, page + 1)}" ${page >= totalPages ? 'disabled' : ''}>Next</button></nav>`;
}

function formatAdminValue(value) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function renderBarChart(values) {
  const entries = Object.entries(values);
  if (!entries.length) return '<p>No stored data yet.</p>';
  const maximum = Math.max(1, ...entries.map(([, value]) => Number(value)));
  return `<div class="bar-chart">${entries.map(([label, value]) => `<div class="bar-row"><span>${escapeHtml(label)}</span><div><i style="width:${Math.max(2, Number(value) / maximum * 100)}%"></i></div><strong>${Number(value)}</strong></div>`).join('')}</div>`;
}

function renderStoredResultRow(item) {
  const total = Math.max(0, Number(item.time_spent_seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = Math.floor(total % 60);
  const duration = `${hours ? `${String(hours).padStart(2, '0')}:` : ''}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `<tr><td><strong>${escapeHtml(String(item.participant_id))}</strong></td><td>${escapeHtml(String(item.full_name || 'Unknown participant'))}</td><td><strong>${duration}</strong></td></tr>`;
}

function formatDuration(totalSeconds) {
  const durationSeconds = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.floor((durationSeconds % 3600) / 60);
  const seconds = durationSeconds % 60;
  return `${hours ? `${String(hours).padStart(2, '0')}:` : ''}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function renderHostParticipantRow(item) {
  const attention = item.watcher_state === 'attention' ? 'Needs review' : 'Normal';
  return `<tr>
    <td><strong>${escapeHtml(String(item.participant_id))}</strong></td>
    <td>${escapeHtml(String(item.question_id || 'Not started'))}</td>
    <td><span class="monitor-state">${escapeHtml(String(item.status))}</span></td>
    <td>${Number(item.progress_percent || 0).toFixed(1)}%</td>
    <td><strong>${formatDuration(item.session_duration_seconds)}</strong></td>
    <td><span class="monitor-state">${attention}</span></td>
  </tr>`;
}

async function restoreAuthenticatedRole() {
  const token = sessionStorage.getItem('cognitrack_auth_token') || '';
  const expectedRole = sessionStorage.getItem('cognitrack_auth_role') || '';
  if (!token || !expectedRole) return false;
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.role !== expectedRole) throw new Error('Invalid session');
    state.authToken = token;
    state.authRole = result.role;
    if (result.role === 'dashboard') {
      sessionStorage.setItem(DASHBOARD_MODE_STORAGE_KEY, 'group');
      sessionStorage.removeItem(DASHBOARD_PARTICIPANT_STORAGE_KEY);
      renderIndependentDashboard('group');
    } else {
      renderRoleDashboard(result.role);
    }
    return true;
  } catch (_error) {
    sessionStorage.removeItem('cognitrack_auth_token');
    sessionStorage.removeItem('cognitrack_auth_role');
    return false;
  }
}

async function loadLlmProviderStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.llm_providers) state.llmProviders = result.llm_providers;
  } catch (_error) {
    // Keep all choices visible if health status cannot be loaded; the API will
    // still return a specific provider error when a request is attempted.
    state.llmProviders = null;
  }
}

restoreAuthenticatedRole().then(async restored => {
  if (restored) return;
  await loadLlmProviderStatus();
  if (restoreParticipantState()) {
    await resumeParticipantState();
  } else {
    renderLogin();
  }
});

if (typeof window !== 'undefined') {
  window.renderLogin = renderLogin;
  window.renderIndependentDashboard = renderIndependentDashboard;
  window.renderRoleDashboard = renderRoleDashboard;
  window.renderResearchMetricsPage = renderResearchMetricsPage;
}
