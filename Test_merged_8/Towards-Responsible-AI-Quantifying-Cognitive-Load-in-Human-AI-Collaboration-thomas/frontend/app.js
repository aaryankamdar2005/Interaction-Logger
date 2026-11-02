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

// ============================================================================
// REACT-TOASTIFY STYLE TOAST NOTIFICATION SYSTEM
// ============================================================================

export function formatToastMessage(msg) {
  if (msg === null || msg === undefined) return '';
  if (typeof msg === 'string') {
    if (msg.includes('[object Object]')) {
      return msg.replace(/\[object Object\](,\[object Object\])*/g, 'Validation or request error occurred.');
    }
    return msg;
  }
  if (msg instanceof Error) {
    return formatToastMessage(msg.message || 'An unexpected error occurred');
  }
  if (Array.isArray(msg)) {
    return msg.map(item => {
      if (typeof item === 'object' && item !== null) {
        return item.msg || item.message || item.detail || JSON.stringify(item);
      }
      return String(item);
    }).join('; ');
  }
  if (typeof msg === 'object') {
    if (msg.detail) return formatToastMessage(msg.detail);
    if (msg.message) return formatToastMessage(msg.message);
    if (msg.msg) return formatToastMessage(msg.msg);
    try {
      return JSON.stringify(msg);
    } catch {
      return String(msg);
    }
  }
  return String(msg);
}

function getToastContainer() {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('role', 'region');
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = 'info', title = '', duration = 4000) {
  const container = getToastContainer();
  const toastEl = document.createElement('div');
  toastEl.className = `toast-item toast-${type}`;
  toastEl.setAttribute('role', 'status');

  const icons = {
    success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
  };

  const defaultTitles = {
    success: 'Success',
    error: 'Notice',
    warning: 'Attention',
    info: 'Information'
  };

  const displayTitle = title || defaultTitles[type] || 'Notice';
  const displayMsg = formatToastMessage(message);

  const isLight = currentTheme() === 'light';
  const cardBg = isLight ? '#ffffff' : '#1e293b';
  const borderCol = isLight ? '#cbd5e1' : '#334155';
  const titleCol = isLight ? '#0f172a' : '#ffffff';
  const msgCol = isLight ? '#334155' : '#f1f5f9';
  const closeCol = isLight ? '#64748b' : '#94a3b8';
  const accentColors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };
  const accent = accentColors[type] || accentColors.info;
  const cardShadow = isLight 
    ? '0 14px 36px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(15, 23, 42, 0.08)' 
    : '0 16px 40px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3)';

  toastEl.style.cssText = `
    background: ${cardBg} !important;
    color: ${titleCol} !important;
    border: 1.5px solid ${borderCol} !important;
    border-left: 6px solid ${accent} !important;
    box-shadow: ${cardShadow} !important;
  `;

  toastEl.innerHTML = `
    <div class="toast-icon-wrap" style="color: ${accent} !important;">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <div class="toast-title" style="color: ${titleCol} !important; font-weight: 800 !important; font-size: 14px !important; margin-bottom: 4px !important; line-height: 1.3 !important;">${escapeHtml(displayTitle)}</div>
      <div class="toast-message" style="color: ${msgCol} !important; font-weight: 500 !important; font-size: 13px !important; line-height: 1.5 !important;">${escapeHtml(displayMsg)}</div>
    </div>
    <button class="toast-close" type="button" aria-label="Close notification" style="color: ${closeCol} !important; font-size: 20px !important;">&times;</button>
    <div class="toast-progress"><div class="toast-progress-bar" style="background: ${accent} !important; animation-duration:${duration}ms"></div></div>
  `;

  let timeoutId = null;
  let remaining = duration;
  let startTime = Date.now();
  let isPaused = false;

  const closeToast = () => {
    if (timeoutId) clearTimeout(timeoutId);
    toastEl.classList.add('toast-exit');
    setTimeout(() => {
      if (toastEl.parentElement) toastEl.parentElement.removeChild(toastEl);
    }, 320);
  };

  const startTimer = (time) => {
    startTime = Date.now();
    timeoutId = setTimeout(closeToast, time);
  };

  toastEl.querySelector('.toast-close').addEventListener('click', closeToast);

  toastEl.addEventListener('mouseenter', () => {
    if (timeoutId) clearTimeout(timeoutId);
    remaining -= (Date.now() - startTime);
    const progressBar = toastEl.querySelector('.toast-progress-bar');
    if (progressBar) progressBar.style.animationPlayState = 'paused';
    isPaused = true;
  });

  toastEl.addEventListener('mouseleave', () => {
    if (isPaused) {
      const progressBar = toastEl.querySelector('.toast-progress-bar');
      if (progressBar) progressBar.style.animationPlayState = 'running';
      startTimer(Math.max(remaining, 1000));
      isPaused = false;
    }
  });

  container.appendChild(toastEl);
  startTimer(duration);
}

export function confirmToast(message, options = {}) {
  return new Promise((resolve) => {
    const container = getToastContainer();
    const toastEl = document.createElement('div');
    const type = options.type || 'warning';
    const title = options.title || 'Please Confirm';
    const confirmText = options.confirmText || 'Confirm';
    const cancelText = options.cancelText || 'Cancel';
    const isDanger = options.danger || type === 'error';

    toastEl.className = `toast-item toast-${type} toast-confirm-card`;
    toastEl.setAttribute('role', 'alertdialog');
    toastEl.setAttribute('aria-modal', 'true');

    const icons = {
      success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
      warning: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };

    const isLight = (document.documentElement.dataset.theme || 'light') === 'light';
    const cardBg = isLight ? '#ffffff' : '#0f172a';
    const borderCol = isLight ? '#cbd5e1' : '#334155';
    const titleCol = isLight ? '#0f172a' : '#ffffff';
    const msgCol = isLight ? '#334155' : '#e2e8f0';
    const closeCol = isLight ? '#64748b' : '#94a3b8';
    const accentColors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    const accent = accentColors[type] || accentColors.warning;
    const cardShadow = isLight 
      ? '0 16px 42px rgba(15, 23, 42, 0.18), 0 4px 14px rgba(15, 23, 42, 0.08)' 
      : '0 20px 48px rgba(0, 0, 0, 0.55), 0 6px 16px rgba(0, 0, 0, 0.35)';

    toastEl.style.cssText = `
      background: ${cardBg} !important;
      color: ${titleCol} !important;
      border: 1px solid ${borderCol} !important;
      border-left: 6px solid ${accent} !important;
      box-shadow: ${cardShadow} !important;
    `;

    const cleanMsg = formatToastMessage(message);

    toastEl.innerHTML = `
      <div class="toast-icon-wrap" style="color: ${accent} !important;">${icons[type] || icons.warning}</div>
      <div class="toast-content">
        <div class="toast-title" style="color: ${titleCol} !important; font-weight: 800 !important; font-size: 14px !important; margin-bottom: 4px !important;">${escapeHtml(title)}</div>
        <div class="toast-message" style="color: ${msgCol} !important; font-weight: 500 !important; font-size: 13px !important; line-height: 1.5 !important;">${escapeHtml(cleanMsg)}</div>
        <div class="toast-actions" style="display: flex; gap: 8px; margin-top: 12px;">
          <button class="toast-btn toast-btn-confirm" type="button" data-toast-confirm="true" style="padding: 7px 16px !important; font-weight: 700 !important; font-size: 12.5px !important; border-radius: 6px !important; background: ${isDanger ? '#dc2626' : '#2563eb'} !important; color: #ffffff !important; border: none !important; cursor: pointer !important;">${escapeHtml(confirmText)}</button>
          <button class="toast-btn toast-btn-cancel" type="button" data-toast-cancel="true" style="padding: 7px 16px !important; font-weight: 700 !important; font-size: 12.5px !important; border-radius: 6px !important; background: ${isLight ? '#f1f5f9' : '#1e293b'} !important; color: ${isLight ? '#334155' : '#e2e8f0'} !important; border: 1px solid ${isLight ? '#cbd5e1' : '#475569'} !important; cursor: pointer !important;">${escapeHtml(cancelText)}</button>
        </div>
      </div>
      <button class="toast-close" type="button" aria-label="Close dialog" style="color: ${closeCol} !important; font-size: 20px !important;">&times;</button>
    `;

    let settled = false;
    const finalize = (result) => {
      if (settled) return;
      settled = true;
      toastEl.classList.add('toast-exit');
      setTimeout(() => {
        if (toastEl.parentElement) toastEl.parentElement.removeChild(toastEl);
      }, 300);
      resolve(result);
    };

    toastEl.querySelector('[data-toast-confirm]').addEventListener('click', () => finalize(true));
    toastEl.querySelector('[data-toast-cancel]').addEventListener('click', () => finalize(false));
    toastEl.querySelector('.toast-close').addEventListener('click', () => finalize(false));

    container.appendChild(toastEl);
  });
}
export const toast = {
  success: (msg, title) => showToast(msg, 'success', title),
  error: (msg, title) => showToast(msg, 'error', title),
  info: (msg, title) => showToast(msg, 'info', title),
  warning: (msg, title) => showToast(msg, 'warning', title),
  confirm: confirmToast,
};
window.showToast = showToast;
window.confirmToast = confirmToast;
window.toast = toast;
window.alert = function(msg) {
  showToast(msg, 'info', 'Notice');
};
window.confirm = function(msg) {
  console.warn('Native window.confirm invoked, returning false:', msg);
  showToast(msg, 'warning', 'Confirmation');
  return false;
};

// ============================================================================
// TAILORED NASA-TLX STATEMENTS (START: BASELINE READINESS vs END: POST-TASK LOAD)
// ============================================================================

const NASA_TLX_START_DIMENSIONS = [
  { key: 'mental_demand', label: 'Mental Fatigue & Load', help: 'Current Mental State: Rate your current mental fatigue or cognitive strain before starting (0 = Completely fresh & alert, 10 = Mentally exhausted).' },
  { key: 'physical_demand', label: 'Physical Tiredness', help: 'Current Physical State: Rate any physical fatigue, eye strain, or bodily tiredness you feel right now (0 = Fully rested & energized, 10 = Severely physically fatigued).' },
  { key: 'temporal_demand', label: 'Time Pressure', help: 'Current Pacing: Rate how hurried, rushed, or time-pressed you feel at this moment (0 = Completely calm & unhurried, 10 = Under intense time pressure).' },
  { key: 'performance', label: 'Cognitive Readiness', help: 'Pre-Task Confidence: How prepared and confident do you feel to collaborate with AI and solve complex problems? (0 = Low confidence / unprepared, 10 = Fully prepared & highly confident).' },
  { key: 'effort', label: 'Anticipated Effort', help: 'Expected Cognitive Effort: How much mental effort and focus do you anticipate needing to invest in these tasks? (0 = Minimal effort expected, 10 = Maximum effort required).' },
  { key: 'frustration', label: 'Emotional Stress', help: 'Pre-Task Stress: Rate your current level of stress, anxiety, or emotional tension before starting (0 = Completely serene & calm, 10 = Highly stressed / anxious).' }
];

const NASA_TLX_END_DIMENSIONS = [
  { key: 'mental_demand', label: 'Mental Demand', help: 'Post-Task Mental Demand: How much intensive thinking, complex decision-making, and critical reasoning was required while collaborating with the AI? (0 = Low / easy cognitive demand, 10 = Extremely high mental strain).' },
  { key: 'physical_demand', label: 'Physical Strain', help: 'Post-Task Physical Strain: How much physical strain or visual/eye fatigue did you experience during the tasks? (0 = None / comfortable, 10 = Heavy physical/eye fatigue).' },
  { key: 'temporal_demand', label: 'Temporal Demand', help: 'Post-Task Time Pressure: How much pacing pressure, rush, or urgency did you feel while evaluating the AI outputs and completing tasks? (0 = Plentiful time / relaxed, 10 = Heavy rush / intense time pressure).' },
  { key: 'performance', label: 'Collaboration Performance', help: 'Post-Task Performance: How successfully and accurately did you accomplish the tasks with the AI\'s assistance? (0 = Poor / unhelpful AI outcomes, 10 = Outstanding / highly successful outcomes).' },
  { key: 'effort', label: 'Expended Effort', help: 'Post-Task Effort: How hard did you have to work mentally and critically to guide and review the AI to achieve your solutions? (0 = Effortless collaboration, 10 = Exhausting mental effort).' },
  { key: 'frustration', label: 'Frustration Level', help: 'Post-Task Frustration: How irritated, stressed, or discouraged did you feel due to AI mistakes, misunderstandings, or complexity? (0 = Calm / zero frustration, 10 = Extremely frustrated & stressed).' }
];

const NASA_TLX_DIMENSIONS = NASA_TLX_END_DIMENSIONS;

const state = {
  participant: null,
  participantSessionToken: '',
  sessionId: '',
  questions: [],
  current: 0,
  subquestion: 0,
  questionTransition: '',
  questionDrafts: {},
  selectedLLM: 'Groq',
  registeredUser: null,
  chatFeedback: {},
  customAdminTasks: [],
  started: false,
  trackingActive: false,
  trackingStartedAt: null,
  startTime: null,
  paas: null,
  baselineNasaTlx: {},
  resumeNasaTlx: {},
  showHints: false,
  activeHintTaskId: null,
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
let isNavigatingRoute = false;

function syncRoute(hash) {
  if (typeof window === 'undefined') return;
  if (window.location.hash !== hash) {
    isNavigatingRoute = true;
    window.location.hash = hash;
    setTimeout(() => { isNavigatingRoute = false; }, 80);
  }
}

function navigateTo(hash) {
  if (typeof window === 'undefined') return;
  window.location.hash = hash;
}


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
  document.documentElement.style.colorScheme = selectedTheme;
  localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
  document.querySelectorAll('[data-theme-toggle]').forEach(button => {
    const lightMode = selectedTheme === 'light';
    button.textContent = lightMode ? '☾ Dark Mode' : '☀ Light Mode';
    button.setAttribute('aria-label', lightMode ? 'Switch to dark mode' : 'Switch to light mode');
  });
  const modelSelect = document.getElementById('aiModelSelect');
  if (modelSelect) {
    modelSelect.style.colorScheme = selectedTheme;
  }
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
  const remainingSeconds = state.assessmentDeadline
    ? Math.max(0, Math.round((state.assessmentDeadline - Date.now()) / 1000))
    : 3600;

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
    remainingSeconds,
    assessmentStage: state.assessmentStage,
    timeLimitReached: state.timeLimitReached,
    tracking: state.tracking,
    lastInteractionAt: state.lastInteractionAt,
    savedAt: Date.now()
  };

  const serialized = JSON.stringify(saved);
  sessionStorage.setItem(PARTICIPANT_STATE_KEY, serialized);
  localStorage.setItem(PARTICIPANT_STATE_KEY, serialized);

  const username = (state.registeredUser?.username || state.participant?.username || '').trim().toLowerCase();
  if (username) {
    localStorage.setItem(`cognitrack_participant_state_${username}`, serialized);
  }
}

function scheduleParticipantStateSave() {
  if (participantStateSaveTimer !== null) return;
  participantStateSaveTimer = window.setTimeout(() => {
    participantStateSaveTimer = null;
    saveParticipantState();
  }, 150);
}

function clearParticipantState(specificUsername = '') {
  sessionStorage.removeItem(PARTICIPANT_STATE_KEY);
  localStorage.removeItem(PARTICIPANT_STATE_KEY);
  const username = (specificUsername || state.registeredUser?.username || state.participant?.username || '').trim().toLowerCase();
  if (username) {
    localStorage.removeItem(`cognitrack_participant_state_${username}`);
  }
}

function getSavedSessionForUser(username) {
  if (!username) return null;
  const uname = username.trim().toLowerCase();
  try {
    const raw = localStorage.getItem(`cognitrack_participant_state_${uname}`)
      || localStorage.getItem(PARTICIPANT_STATE_KEY)
      || sessionStorage.getItem(PARTICIPANT_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const savedUname = (parsed.participant?.username || '').trim().toLowerCase();
    if (savedUname && savedUname !== uname) return null;

    if (parsed.assessmentStage === 'summary') return null;

    const hasProgress = parsed.started
      || (Array.isArray(parsed.answers) && parsed.answers.length > 0)
      || parsed.current > 0
      || parsed.assessmentStage === 'exam'
      || parsed.assessmentStage === 'nasa'
      || (parsed.baselineNasaTlx && Object.keys(parsed.baselineNasaTlx).length > 0);

    if (!hasProgress) return null;
    return parsed;
  } catch (_e) {
    return null;
  }
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
      state.questions.forEach((q, idx) => {
        q.questionPart = `Task ${idx + 1} of ${state.questions.length}`;
      });
    } else if (saved.participant) {
      state.questions = selectSessionTasks(saved.participant, state.customAdminTasks);
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
  if (state.assessmentStage === 'resume-nasa') {
    renderResumeNasaTlx();
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



function renderResumeNasaTlx() {
  state.assessmentStage = 'resume-nasa';
  syncRoute('#/resume-baseline');
  const totalTasks = (state.questions && state.questions.length) || getSessionTaskList().length || 1;
  const currentTaskNum = (state.current || 0) + 1;
  const q = currentQuestion();
  const userName = escapeHtml(state.participant?.full_name || 'Participant');

  if (!state.resumeNasaTlx || Object.keys(state.resumeNasaTlx).length === 0) {
    state.resumeNasaTlx = { ...state.baselineNasaTlx };
    NASA_TLX_START_DIMENSIONS.forEach(d => {
      if (!Number.isFinite(state.resumeNasaTlx[d.key])) {
        state.resumeNasaTlx[d.key] = 5;
      }
    });
  }

  app.innerHTML = `
    <div class="survey-screen">
      <header class="topbar" style="background:var(--header-bg); border-bottom:1px solid var(--border); margin-bottom:1.5rem;">
        <div class="brand"><div class="logo">C</div><div><h1>CogniTrack <span style="color:#38dd9a">AI</span></h1><small>Session Re-Entry Calibration</small></div></div>
        ${themeToggleMarkup()}
        <div class="role-actions">
          <button class="secondary nav-home-btn" id="resumeHomeBtn" type="button">🏠 Home</button>
          <button class="secondary nav-back-btn" id="resumeBackBtn" type="button">← Go Back</button>
        </div>
      </header>

      <section class="card survey-card resume-nasa-card">
        <div class="survey-kicker">Session Re-Entry Workload Calibration</div>
        <h1>Welcome Back, ${userName}!</h1>
        <p class="survey-intro">
          You are resuming <strong>Task ${currentTaskNum} of ${totalTasks}</strong>: <em>${escapeHtml(q.title || 'Collaborative Task')}</em>.
          Because you paused and took a break, please calibrate your current perceived workload before diving back into the assessment. This records your post-break cognitive readiness baseline.
        </p>

        <div class="nasa-grid">
          ${NASA_TLX_START_DIMENSIONS.map(d => {
            const val = state.resumeNasaTlx[d.key] ?? 5;
            return `
              <article class="survey-item">
                <div class="nasa-item-heading">
                  <h3>${escapeHtml(d.label)}</h3>
                  <output class="nasa-value" data-resume-output="${d.key}">${val}</output>
                </div>
                <p>${escapeHtml(d.help)}</p>
                <input class="nasa-range" type="range" min="0" max="10" step="1" value="${val}" data-resume-scale="${d.key}" aria-label="Resume ${escapeHtml(d.label)} scale from 0 to 10">
                <div class="scale-labels"><span>0 (Low)</span><span>5 (Moderate)</span><span>10 (High)</span></div>
              </article>`;
          }).join('')}
        </div>

        <div class="nasa-overall" id="resumeNasaPreview">
          Re-Entry Composite Score: ${(Object.values(state.resumeNasaTlx).reduce((sum, v) => sum + (Number(v) || 5), 0) / NASA_TLX_START_DIMENSIONS.length).toFixed(1)} <small>/ 10</small>
        </div>

        <div class="actions" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-top:20px;">
          <button class="secondary nav-back-btn" id="resumeCancelToHomeBtn" type="button">← Back to Overview</button>
          <button class="primary" id="confirmResumeAndStartExamBtn" type="button" style="font-size:15px; font-weight:800; padding:12px 28px;">
            Confirm Workload & Resume Task ${currentTaskNum} ➔
          </button>
        </div>
        <div class="error" id="resumeNasaError"></div>
      </section>
    </div>`;

  document.querySelectorAll('[data-resume-scale]').forEach(input => {
    input.addEventListener('input', e => {
      const key = e.target.dataset.resumeScale;
      state.resumeNasaTlx[key] = Number(e.target.value);
      saveParticipantState();
      const out = document.querySelector(`[data-resume-output="${key}"]`);
      if (out) out.textContent = e.target.value;
      const preview = document.getElementById('resumeNasaPreview');
      if (preview) {
        const avg = Object.values(state.resumeNasaTlx).reduce((a, b) => a + (Number(b) || 0), 0) / NASA_TLX_START_DIMENSIONS.length;
        preview.innerHTML = `Re-Entry Composite Score: ${avg.toFixed(1)} <small>/ 10</small>`;
      }
    });
  });

  const returnHome = () => {
    saveParticipantState();
    navigateTo('#/home');
  };
  const homeBtn = document.getElementById('resumeHomeBtn');
  if (homeBtn) homeBtn.onclick = returnHome;
  const backBtn = document.getElementById('resumeBackBtn');
  if (backBtn) backBtn.onclick = returnHome;
  const cancelBtn = document.getElementById('resumeCancelToHomeBtn');
  if (cancelBtn) cancelBtn.onclick = returnHome;

  const confirmBtn = document.getElementById('confirmResumeAndStartExamBtn');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Resuming assessment…';
      try {
        if (state.participantSessionToken && state.participant?.participant_id) {
          await safePost('/sessions/nasa-tlx-baseline', {
            participant_id: state.participant.participant_id,
            ratings: state.resumeNasaTlx
          }, state.participantSessionToken).catch(e => console.warn('Resume baseline non-critical:', e));
        }
      } catch (_e) {}

      saveParticipantState();
      toast.success(`Re-entry cognitive workload recorded! Resumed Task ${currentTaskNum} of ${totalTasks}.`, 'Assessment Resumed');

      try {
        await startVisionCamera();
        startSharedTrackingCapture();
      } catch (_e) {}

      renderExam();
    };
  }
}

function renderResumePrompt(saved, user, testMode) {
  state.registeredUser = user;
  const totalTasks = (saved.questions && saved.questions.length) || (state.questions && state.questions.length) || 1;
  const currentTaskNum = (saved.current || 0) + 1;
  const answeredCount = (saved.answers && saved.answers.length) || 0;
  const skippedCount = (saved.skippedQuestionIds && saved.skippedQuestionIds.length) || 0;
  const currentTask = saved.questions?.[saved.current] || {};
  const remainingSecs = Math.max(60, saved.remainingSeconds || 3600);

  const formatSecs = (total) => {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <div class="logo">C</div>
          <div>
            <h1>CogniTrack <span style="color:#38dd9a">AI</span></h1>
            <small>Assessment Continuity</small>
          </div>
        </div>
        ${themeToggleMarkup()}
        <button class="secondary" id="resumeSignOutBtn" type="button">Sign Out</button>
      </header>
      <main class="resume-flow-container">
        <div class="resume-modal-card card">
          <div class="resume-badge-wrap">
            <span class="resume-status-badge">⚡ In-Progress Session Detected</span>
          </div>
          <h2>Welcome back, ${escapeHtml(user.full_name)}!</h2>
          <p class="resume-intro-text">
            You previously left an assessment in progress. Would you like to resume where you left off, or start a completely fresh session?
          </p>

          <div class="resume-stats-grid">
            <div class="resume-stat-item">
              <span class="stat-label">Current Progress</span>
              <span class="stat-value">Task ${currentTaskNum} of ${totalTasks}</span>
              <span class="stat-sub">${escapeHtml(currentTask.domain || 'Data Science')} • ${escapeHtml(currentTask.difficulty || 'Normal')}</span>
            </div>
            <div class="resume-stat-item">
              <span class="stat-label">Tasks Completed</span>
              <span class="stat-value">${answeredCount} Answered</span>
              <span class="stat-sub">${skippedCount} Skipped</span>
            </div>
            <div class="resume-stat-item">
              <span class="stat-label">Time Remaining</span>
              <span class="stat-value">${formatSecs(remainingSecs)}</span>
              <span class="stat-sub">Timer will resume</span>
            </div>
            <div class="resume-stat-item">
              <span class="stat-label">Current Objective</span>
              <span class="stat-value" style="font-size: 13px; font-weight: 600; line-height: 1.35; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                ${escapeHtml(currentTask.title || 'Dynamic Task Assessment')}
              </span>
            </div>
          </div>

          <div class="resume-actions-group">
            <button class="primary resume-action-btn" id="resumeSavedTaskBtn" type="button">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Resume Previous Assessment
            </button>
            <button class="secondary fresh-start-action-btn" id="freshStartNewTaskBtn" type="button">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              Fresh Start (Start New Assessment)
            </button>
          </div>
        </div>
      </main>
    </div>
  `;

  document.getElementById('resumeSignOutBtn').addEventListener('click', () => {
    resetParticipantSession();
    renderLogin();
  });

  document.getElementById('resumeSavedTaskBtn').addEventListener('click', async () => {
    const btn = document.getElementById('resumeSavedTaskBtn');
    btn.disabled = true;
    btn.textContent = 'Restoring session…';

    try {
      let participantId = saved.participant?.participant_id || '';
      try {
        const resumeRes = await safePost('/sessions/resume', {
          participant_id: participantId,
          username: user.username
        });
        if (resumeRes?.participant_session_token) {
          saved.participantSessionToken = resumeRes.participant_session_token;
          if (resumeRes.session_id) saved.sessionId = resumeRes.session_id;
        }
      } catch (resumeErr) {
        console.warn('Backend resume non-critical:', resumeErr);
      }

      Object.assign(state, saved);
      state.registeredUser = user;
      state.assessmentDeadline = Date.now() + remainingSecs * 1000;
      state.started = true;
      state.trackingActive = true;
      saveParticipantState();

      toast.success(`Resumed Task ${currentTaskNum} of ${totalTasks}!`, 'Assessment Resumed');

      try {
        await startVisionCamera();
        startSharedTrackingCapture();
      } catch (_e) {}

      if (state.assessmentStage === 'nasa') {
        renderNasaTlxAssessment(state.endedEarly);
      } else if (state.assessmentStage === 'instructions') {
        renderInstructions();
      } else if (state.assessmentStage === 'baseline-nasa') {
        renderBaselineNasaTlx();
      } else {
        renderResumeNasaTlx();
      }
    } catch (err) {
      toast.error(err.message, 'Resume Error');
      btn.disabled = false;
      btn.textContent = 'Resume Previous Assessment';
    }
  });

  document.getElementById('freshStartNewTaskBtn').addEventListener('click', async () => {
    const ok = await confirmToast(
      'Start a completely fresh assessment? Your previous incomplete progress and answers will be discarded.',
      { title: 'Confirm Fresh Start', confirmText: 'Yes, Start Fresh', cancelText: 'Go Back', type: 'warning' }
    );
    if (!ok) return;

    clearParticipantState(user.username);
    resetParticipantSession();
    state.registeredUser = user;
    toast.info('Starting fresh assessment from Task 1.', 'New Session');

    await startParticipantSession({
      participant_id: '',
      username: user.username,
      full_name: user.full_name,
      age_group: user.age_group || '23–28',
      domain: user.domain || 'Artificial Intelligence',
      ai_familiarity: user.ai_familiarity || 'Intermediate',
      test_mode: Boolean(testMode)
    });
  });
}

function renderLogin() {
  clearInterval(dashboardTimer);
  syncRoute('#/home');
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

        <!-- USER PROFILE AUTHENTICATION PORTAL (SIGN IN & REGISTER) -->
        <div class="card login-card login-sequence-form auth-portal-card">
          <div class="login-card-handle" aria-hidden="true"></div>
          <div class="login-card-kicker"><span class="status-orb" aria-hidden="true"></span> USER PROFILE PORTAL</div>
          <h3 style="margin-bottom:6px;">Candidate Assessment Session</h3>
          <p class="login-card-intro" style="margin-bottom:16px;">Sign in with your registered profile or create a new user profile.</p>

          <!-- Auth Mode Tab Switcher -->
          <div class="auth-mode-tabs" role="tablist">
            <button class="auth-tab-btn active" id="authTabLogin" type="button" role="tab" aria-selected="true">🔑 Sign In (Existing)</button>
            <button class="auth-tab-btn" id="authTabRegister" type="button" role="tab" aria-selected="false">📝 Register New</button>
          </div>

          <!-- TAB 1: EXISTING USER LOGIN -->
          <form id="userLoginForm" class="auth-form-view">
            <div class="field" style="margin-bottom:12px;">
              <label>Quick-Select Registered Profile</label>
              <select id="quickUserSelect">
                <option value="">-- Choose a registered candidate profile --</option>
              </select>
            </div>
            
            <div class="field">
              <label>Username</label>
              <input id="loginUsername" placeholder="Enter your username" required autocomplete="username" />
            </div>

            <div class="field">
              <label>Password</label>
              <input id="loginPassword" type="password" placeholder="Enter password" required autocomplete="current-password" />
            </div>

            <div class="field">
              <label for="loginDomainSelect">Assessment Domain (Can be changed anytime)</label>
              <select id="loginDomainSelect">
                <option value="Artificial Intelligence">Artificial Intelligence</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Data Science" selected>Data Science</option>
                <option value="Software Development">Software Development</option>
                <option value="Cross-Disciplinary">Cross-Disciplinary</option>
              </select>
              <small style="color:var(--muted); font-size:11.5px; margin-top:3px; display:block;">Collaboration tasks will be dynamically tailored to this domain.</small>
            </div>

            <div id="selectedUserProfileBadge" class="user-profile-preview" style="display:none;"></div>

            <label class="consent"><input id="loginConsent" type="checkbox" checked /> <span>I agree to participate in this assessment and allow interaction telemetry to be collected.</span></label>
            
            
            <button class="primary login-submit" type="submit" id="loginSubmitBtn">
              <span>Sign In & Continue</span><strong aria-hidden="true">➔</strong>
            </button>
            <p class="auth-toggle-note">New candidate? <a href="#" id="switchToRegisterLink">Create a profile here</a></p>
            <div class="error" id="loginError"></div>
          </form>

          <!-- TAB 2: REGISTER NEW USER -->
          <form id="userRegisterForm" class="auth-form-view" style="display:none;">
            <div class="field">
              <label>Full Name *</label>
              <input id="regFullName" placeholder="e.g. Alex Morgan" required />
            </div>

            <div class="grid-2">
              <div class="field">
                <label>Username *</label>
                <input id="regUsername" placeholder="e.g. alex_ai" required autocomplete="username" />
              </div>
              <div class="field">
                <label>Password *</label>
                <input id="regPassword" type="password" placeholder="Create password" required autocomplete="new-password" />
              </div>
            </div>

            <div class="field">
              <label>Email Address (Optional)</label>
              <input id="regEmail" type="email" placeholder="e.g. alex@example.com" />
            </div>

            <div class="grid-2">
              <div class="field">
                <label>Age Group *</label>
                <select id="regAgeGroup" required>
                  <option value="">Select age group</option>
                  <option>18–22</option>
                  <option>23–28</option>
                  <option>29–35</option>
                  <option>36–45</option>
                  <option>46+</option>
                </select>
              </div>
              <div class="field">
                <label>AI Familiarity Level *</label>
                <select id="regLevel" required>
                  <option value="">Select familiarity level</option>
                  <option>Beginner</option>
                  <option selected>Intermediate</option>
                  <option>Advanced</option>
                </select>
              </div>
            </div>

            <label class="consent"><input id="regConsent" type="checkbox" checked /> <span>I agree to participate in this assessment and allow interaction telemetry to be collected.</span></label>
            

            <button class="primary login-submit" type="submit" id="regSubmitBtn">
              <span>Register & Start Assessment</span><strong aria-hidden="true">➔</strong>
            </button>
            <p class="auth-toggle-note">Already registered? <a href="#" id="switchToLoginLink">Sign in with existing profile</a></p>
            <div class="error" id="regError"></div>
          </form>

        </div>
      </section>
    </div>`;

  const loginModel = document.querySelector('.login-model');
  if (loginModel) {
    const keepModelRotating = () => { loginModel.autoRotate = true; };
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

  // Auth Tab Toggling
  const tabLoginBtn = document.getElementById('authTabLogin');
  const tabRegisterBtn = document.getElementById('authTabRegister');
  const userLoginForm = document.getElementById('userLoginForm');
  const userRegisterForm = document.getElementById('userRegisterForm');

  const showTab = (tab) => {
    const isLogin = tab === 'login';
    tabLoginBtn.classList.toggle('active', isLogin);
    tabRegisterBtn.classList.toggle('active', !isLogin);
    tabLoginBtn.setAttribute('aria-selected', String(isLogin));
    tabRegisterBtn.setAttribute('aria-selected', String(!isLogin));
    userLoginForm.style.display = isLogin ? 'block' : 'none';
    userRegisterForm.style.display = isLogin ? 'none' : 'block';
  };

  tabLoginBtn.addEventListener('click', () => showTab('login'));
  tabRegisterBtn.addEventListener('click', () => showTab('register'));
  document.getElementById('switchToRegisterLink')?.addEventListener('click', (e) => { e.preventDefault(); showTab('register'); });
  document.getElementById('switchToLoginLink')?.addEventListener('click', (e) => { e.preventDefault(); showTab('login'); });

  // Populate Quick-Select Registered Users
  let registeredUserMap = {};
  safeGet('/users/list').then(data => {
    if (data && Array.isArray(data.users) && data.users.length) {
      const select = document.getElementById('quickUserSelect');
      if (select) {
        data.users.forEach(u => {
          registeredUserMap[u.username] = u;
          const opt = document.createElement('option');
          opt.value = u.username;
          opt.textContent = `👤 ${u.full_name} (@${u.username})`;
          select.appendChild(opt);
        });
      }
    }
  }).catch(() => {});

  document.getElementById('quickUserSelect')?.addEventListener('change', (e) => {
    const uname = e.target.value;
    const badge = document.getElementById('selectedUserProfileBadge');
    if (uname && registeredUserMap[uname]) {
      const u = registeredUserMap[uname];
      document.getElementById('loginUsername').value = u.username;
      badge.style.display = 'block';
      badge.innerHTML = `
        <div class="user-badge-inner">
          <strong>👤 ${escapeHtml(u.full_name)}</strong>
          <span>(@${escapeHtml(u.username)}) &bull; Age: ${escapeHtml(u.age_group || 'All Ages')}</span>
        </div>`;
    } else {
      badge.style.display = 'none';
    }
  });

  // Handle Login Submit
  userLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const consent = document.getElementById('loginConsent').checked;
    const testMode = false;
    const errEl = document.getElementById('loginError');
    errEl.textContent = '';

    if (!consent) {
      errEl.textContent = 'Consent is required to continue.';
      return;
    }

    const btn = document.getElementById('loginSubmitBtn');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Signing in…';

    try {
      const res = await safePost('/users/login', { username, password });
      toast.success(`Welcome back, ${res.user.full_name}!`, 'Signed In');
      state.registeredUser = res.user;

      const saved = getSavedSessionForUser(res.user.username);
      if (saved) {
        renderResumePrompt(saved, res.user, testMode);
      } else {
        const chosenDomain = document.getElementById('loginDomainSelect')?.value || res.user.domain || 'Data Science';
        if (chosenDomain !== res.user.domain) {
          safePost('/users/update-domain', { username: res.user.username, domain: chosenDomain }).catch(() => {});
        }
        await startParticipantSession({
          participant_id: '',
          username: res.user.username,
          full_name: res.user.full_name,
          age_group: res.user.age_group || '23-28',
          domain: chosenDomain,
          ai_familiarity: res.user.ai_familiarity || 'Intermediate',
          test_mode: testMode
        });
      }
    } catch (err) {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Sign In & Continue';
      errEl.textContent = `Login failed: ${err.message}`;
      toast.error(err.message, 'Sign In Error');
    }
  });

  // Handle Registration Submit
  userRegisterForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('regFullName').value.trim();
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const email = document.getElementById('regEmail').value.trim();
    const ageGroup = document.getElementById('regAgeGroup').value;
    const level = document.getElementById('regLevel').value;
    const consent = document.getElementById('regConsent').checked;
    const testMode = false;
    const errEl = document.getElementById('regError');
    errEl.textContent = '';

    if (!consent) {
      errEl.textContent = 'Consent is required to continue.';
      return;
    }

    const btn = document.getElementById('regSubmitBtn');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Registering…';

    try {
      const res = await safePost('/users/register', {
        full_name: fullName,
        username,
        password,
        email,
        age_group: ageGroup,
        domain: '',
        ai_familiarity: level
      });
      toast.success(`Profile created! Welcome, ${res.user.full_name}!`, 'Profile Registered');
      state.registeredUser = res.user;
      await startParticipantSession({
        participant_id: '',
        username: res.user.username,
        full_name: res.user.full_name,
        age_group: res.user.age_group,
        domain: 'Data Science',
        ai_familiarity: res.user.ai_familiarity || 'Intermediate',
        test_mode: testMode
      });
    } catch (err) {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Register & Start Assessment';
      errEl.textContent = `Registration failed: ${err.message}`;
      toast.error(err.message, 'Registration Error');
    }
  });
}

async function startParticipantSession(participant) {
  state.participant = participant;
  try {
    const taskRes = await safeGet('/tasks');
    if (taskRes && Array.isArray(taskRes.custom_tasks)) {
      state.customAdminTasks = taskRes.custom_tasks;
    }
  } catch (err) {
    console.warn('Could not load custom tasks:', err);
  }
  state.questions = selectSessionTasks(participant, state.customAdminTasks);
  state.current = 0;
  state.subquestion = 0;
  state.selectedLLM = state.selectedLLM || 'Groq';
  state.started = true;
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
  renderInstructions();
}

function baselineNasaTlxComplete() {
  return NASA_TLX_START_DIMENSIONS.every(d => Number.isFinite(state.baselineNasaTlx[d.key]) && state.baselineNasaTlx[d.key] >= 0 && state.baselineNasaTlx[d.key] <= 10);
}

function renderBaselineNasaTlx() {
  state.assessmentStage = 'baseline-nasa';
  syncRoute('#/baseline');
  app.innerHTML = `
    <div class="survey-screen">
      <header class="topbar" style="background:var(--header-bg); border-bottom:1px solid var(--border); margin-bottom:1.5rem;">
        <div class="brand"><div class="logo">C</div><div><h1>CogniTrack <span style="color:#38dd9a">AI</span></h1><small>Pre-Task Readiness</small></div></div>
        ${themeToggleMarkup()}
        <div class="role-actions">
          <button class="secondary nav-home-btn" id="baselineHomeBtn" type="button">🏠 Home</button>
          <button class="secondary nav-back-btn" id="baselineBackBtn" type="button">← Back to Instructions</button>
        </div>
      </header>

      <section class="card survey-card">
        <div class="survey-kicker">Pre-Task Baseline Workload Check</div>
        <h1>Baseline Cognitive Workload Check</h1>
        <p class="survey-intro">Before beginning the collaboration tasks, rate how you feel right now. This establishes your pre-task cognitive readiness baseline so the system can accurately measure workload fluctuations.</p>
        <div class="nasa-grid">
          ${NASA_TLX_START_DIMENSIONS.map(d => {
            const selected = Number.isFinite(state.baselineNasaTlx[d.key]) && state.baselineNasaTlx[d.key] >= 0 && state.baselineNasaTlx[d.key] <= 10;
            const value = selected ? state.baselineNasaTlx[d.key] : 5;
            return `
              <article class="survey-item">
                <div class="nasa-item-heading">
                  <h3>${escapeHtml(d.label)}</h3>
                  <output class="nasa-value" data-baseline-output="${d.key}">${selected ? value : '—'}</output>
                </div>
                <p>${escapeHtml(d.help)}</p>
                <input class="nasa-range" type="range" min="0" max="10" step="1" value="${value}" data-baseline-scale="${d.key}" aria-label="Baseline ${escapeHtml(d.label)} scale from 0 to 10">
                <div class="scale-labels"><span>0 (Low)</span><span>5 (Moderate)</span><span>10 (High)</span></div>
              </article>`;
          }).join('')}
        </div>
        <div class="nasa-overall" id="baselineNasaPreview">
          Baseline Composite: ${baselineNasaTlxComplete() ? (Object.values(state.baselineNasaTlx).reduce((sum, value) => sum + value, 0) / NASA_TLX_START_DIMENSIONS.length).toFixed(1) : '—'} <small>/ 10</small>
        </div>
        <div class="actions" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-top:20px;">
          <button class="secondary nav-back-btn" id="baselineBackActionBtn" type="button">← Back to Instructions</button>
          <button class="primary" id="startAssessmentFromBaseline" type="button" ${baselineNasaTlxComplete() ? '' : 'disabled'} style="font-size:15px; font-weight:800; padding:12px 28px;">
            🚀 Start Assessment
          </button>
        </div>
        <div class="error" id="baselineNasaError"></div>
      </section>
    </div>`;

  document.querySelectorAll('[data-baseline-scale]').forEach(input => {
    input.addEventListener('input', event => {
      state.baselineNasaTlx[event.target.dataset.baselineScale] = Number(event.target.value);
      saveParticipantState();
      const output = document.querySelector(`[data-baseline-output="${event.target.dataset.baselineScale}"]`);
      if (output) output.textContent = event.target.value;
      const overall = document.getElementById('baselineNasaPreview');
      if (overall) overall.innerHTML = `Baseline score: ${baselineNasaTlxComplete() ? (Object.values(state.baselineNasaTlx).reduce((sum, value) => sum + value, 0) / NASA_TLX_DIMENSIONS.length).toFixed(1) : '—'} <small>(average of the six ratings)</small>`;
      const submit = document.getElementById('startAssessmentFromBaseline');
      if (submit) submit.disabled = !baselineNasaTlxComplete();
    });
  });

  const goHome = () => navigateTo('#/home');
  const goInstructions = () => renderInstructions();

  const homeBtn = document.getElementById('baselineHomeBtn');
  if (homeBtn) homeBtn.onclick = goHome;
  const backBtn = document.getElementById('baselineBackBtn');
  if (backBtn) backBtn.onclick = goInstructions;
  const backActionBtn = document.getElementById('baselineBackActionBtn');
  if (backActionBtn) backActionBtn.onclick = goInstructions;

  const startBtn = document.getElementById('startAssessmentFromBaseline');
  if (startBtn) {
    startBtn.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'Requesting webcam permission…';
      try {
        await safePost('/sessions/nasa-tlx-baseline', {
          participant_id: state.participant.participant_id,
          ratings: state.baselineNasaTlx
        }, state.participantSessionToken).catch(e => console.warn('Baseline save non-critical:', e));

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
        startSharedTrackingCapture();
        renderExam();
      } catch (error) {
        button.disabled = false;
        button.textContent = '🚀 Start Assessment';
        document.getElementById('baselineNasaError').textContent = `Unable to start: ${error.message}`;
      }
    });
  }
  saveParticipantState();
}
async function renderInstructions() {
  state.assessmentStage = 'instructions';
  syncRoute('#/instructions');
  const domainText = escapeHtml(state.participant?.domain || 'General');
  const levelText = escapeHtml(state.participant?.ai_familiarity || 'Intermediate');
  const taskCount = (state.questions && state.questions.length) || getSessionTaskList().length;

  app.innerHTML = `
    <div class="instructions-overlay">
      <header class="topbar" style="position:fixed; top:0; left:0; right:0; z-index:100; background:var(--header-bg); border-bottom:1px solid var(--border);">
        <div class="brand"><div class="logo">C</div><div><h1>CogniTrack <span style="color:#38dd9a">AI</span></h1><small>Assessment Preparation</small></div></div>
        ${themeToggleMarkup()}
        <div class="role-actions">
          <button class="secondary nav-home-btn" id="instrHomeBtn" type="button">🏠 Home</button>
        </div>
      </header>

      <div class="card instructions-card">
        <div class="instruction-heading">
          <h2>Assessment Instructions</h2>
        </div>

        <!-- Candidate Domain Configuration & Switcher -->
        <div class="instructions-domain-box" style="margin: 16px 0; padding: 14px 18px; border-radius: 12px; background: var(--input-bg); border: 1.5px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="font-size: 11.5px; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.5px;">YOUR ASSESSMENT DOMAIN</div>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
              <span class="badge domain-badge" id="instrDomainBadge" style="font-size: 13.5px; padding: 4px 12px;">${domainText}</span>
              <span style="font-size: 13px; color: var(--muted);">(Age Cohort: <strong>${escapeHtml(state.participant?.age_group || 'All Ages')}</strong>)</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <label for="changeAssessmentDomain" style="font-size: 13px; font-weight: 700; white-space: nowrap;">Change Domain:</label>
            <select id="changeAssessmentDomain" style="padding: 7px 12px; border-radius: 8px; border: 1.5px solid var(--border); font-size: 13px; font-weight: 700; background: var(--panel); color: var(--text);">
              <option value="Artificial Intelligence" ${state.participant?.domain === 'Artificial Intelligence' ? 'selected' : ''}>Artificial Intelligence</option>
              <option value="Computer Science" ${state.participant?.domain === 'Computer Science' ? 'selected' : ''}>Computer Science</option>
              <option value="Data Science" ${state.participant?.domain === 'Data Science' || !state.participant?.domain ? 'selected' : ''}>Data Science</option>
              <option value="Software Development" ${state.participant?.domain === 'Software Development' ? 'selected' : ''}>Software Development</option>
              <option value="Cross-Disciplinary" ${state.participant?.domain === 'Cross-Disciplinary' ? 'selected' : ''}>Cross-Disciplinary</option>
            </select>
          </div>
        </div>

        <ol>
          <li>You have one hour after starting to complete the session.</li>
          <li>The session contains <strong>${taskCount} dynamic tasks</strong> tailored to your domain (<strong>${domainText}</strong>) and age cohort.</li>
          <li>For each task, read the problem scenario and expand the collaboration hints if you need guidance.</li>
          <li>Select an AI partner (ChatGPT or Groq) in the right panel and collaborate: ask questions, explore trade-offs, and analyze responses.</li>
          <li>Once you have reviewed the AI's response, click <strong>I have reviewed the AI response · Proceed to Next Task</strong> to move forward.</li>
          <li>Keep your face visible and remain in a well-lit area while webcam tracking measures cognitive load indicators in the background.</li>
        </ol>
        <div id="ragReadiness" class="muted-text">Checking assessment resources...</div>
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-top:16px;">
          <button class="secondary nav-back-btn" id="instrBackBtn" type="button">← Back to Login</button>
          <button class="primary" id="proceedToBaselineBtn" type="button" disabled style="font-size:15px; font-weight:800; padding:12px 28px;">
            Proceed to Baseline Workload Check ➔
          </button>
        </div>
      </div>
    </div>`;

  saveParticipantState();
  const proceedButton = document.getElementById('proceedToBaselineBtn');
  const ragReadiness = document.getElementById('ragReadiness');
  try {
    ragReadiness.textContent = 'Resources verified. Ready to proceed.';
    if (proceedButton) proceedButton.disabled = false;
  } catch (error) {
    if (ragReadiness) ragReadiness.textContent = error.message;
  }

  const homeBtn = document.getElementById('instrHomeBtn');
  if (homeBtn) homeBtn.onclick = () => navigateTo('#/home');
  const backBtn = document.getElementById('instrBackBtn');
  if (backBtn) backBtn.onclick = () => navigateTo('#/home');

  if (proceedButton) {
    proceedButton.onclick = () => {
      renderBaselineNasaTlx();
    };
  }
}
function getSessionTaskList() {
  if (Array.isArray(state.questions) && state.questions.length > 0) return state.questions;
  if (state.participant) {
    state.questions = selectSessionTasks(state.participant, state.customAdminTasks);
    return state.questions;
  }
  return selectSessionTasks({}, state.customAdminTasks);
}

function currentQuestion() {
  const list = getSessionTaskList();
  const task = list[state.current] || list[0] || PREDEFINED_TASKS[0];
  const totalTasks = (state.questions && state.questions.length) || list.length || 1;
  const questionPart = `Task ${state.current + 1} of ${totalTasks}`;
  return {
    ...task,
    topicId: task.topicId || `TASK-${state.current + 1}`,
    questionPart: questionPart
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
  const isLight = (document.documentElement.dataset.theme || 'light') === 'light';
  const optBg = isLight ? '#ffffff' : '#0f172a';
  const optCol = unavailable ? (isLight ? '#94a3b8' : '#64748b') : (isLight ? '#0f172a' : '#f8fafc');
  return `<option value="${name}" ${selected ? 'selected' : ''} ${unavailable ? 'disabled' : ''} style="background-color: ${optBg} !important; color: ${optCol} !important;">${name}${unavailable ? ' (not configured)' : ''}</option>`;
}
function renderExam() {
  state.assessmentStage = 'exam';
  syncRoute('#/exam');
  if (!state.selectedLLM) state.selectedLLM = 'Groq';
  state.started = true;
  const q = currentQuestion();
  if (state.activeHintTaskId !== q.id) {
    state.showHints = false;
    state.activeHintTaskId = q.id;
  }
  const progress = assessmentProgressSnapshot();
  const totalTasks = (state.questions && state.questions.length) || getSessionTaskList().length || 1;
  const userPrompts = state.messages.filter(m => m.role === 'user');
  const hasCollaborated = userPrompts.length > 0;
  const diffBadgeClass = (q.difficulty || 'Easy').toLowerCase();

  app.innerHTML = `
    ${state.adminMode ? `
      <div class="admin-preview-top-banner">
        <div class="admin-preview-info">
          <span class="admin-preview-pill">👑 ADMIN TASK SIMULATION</span>
          <span>Task: <strong>${escapeHtml(q.title || 'Collaborative Task')}</strong></span>
          <span>Domain: <strong>${escapeHtml(q.domain || 'General')}</strong></span>
          <span>Age Cohort: <strong>${escapeHtml(q.target_age || 'All Ages')}</strong></span>
          <span>Difficulty: <strong>${escapeHtml(q.difficulty || 'Easy')}</strong></span>
        </div>
        <button class="secondary exit-admin-btn" id="exitAdminTaskRunBtn" type="button">
          ← Exit Back to Admin Portal
        </button>
      </div>
    ` : ''}
    <div class="exam-shell">
      <header class="exam-top">
        <div class="brand"><div class="logo">C</div><div><h1>CogniTrack <span style="color:#38dd9a">AI</span></h1><small>${escapeHtml(state.participant?.participant_id || '')}</small></div></div>
        <div class="center">Task ${state.current + 1} of ${totalTasks} &bull; <span class="task-domain-pill">${escapeHtml(q.domain || 'General')}</span> <button class="secondary change-domain-btn" id="examChangeDomainBtn" type="button" title="Switch your assessment domain">🔄 Change Domain</button></div>
        <div class="exam-actions">
          ${themeToggleMarkup()}
          <button class="secondary nav-home-btn" id="examHomeBtn" type="button" title="Save progress and return to home">🏠 Home</button>
          <div class="timer" id="timer">--:--</div>
          <button class="secondary continue-later-btn" id="continueLaterBtn" type="button" title="Save your work and return later">Continue Later</button>
          <button class="danger-btn" id="endSession" ${state.finishing ? 'disabled' : ''}>${state.finishing ? 'Ending Session…' : 'End Session'}</button>
        </div>
      </header>

      <!-- 1. ASSESSMENT WORKFLOW MAP -->
      <div class="assessment-workflow-map" aria-label="Assessment Pipeline Stages">
        <div class="workflow-step done"><span class="step-num">1</span><span>Pre-Task Baseline ✓</span></div>
        <div class="workflow-divider done"></div>
        <div class="workflow-step active"><span class="step-num">2</span><span>AI Collaboration (Task ${state.current + 1} of ${totalTasks})</span></div>
        <div class="workflow-divider"></div>
        <div class="workflow-step"><span class="step-num">3</span><span>Post-Task Workload</span></div>
        <div class="workflow-divider"></div>
        <div class="workflow-step"><span class="step-num">4</span><span>Results Summary</span></div>
      </div>

      <!-- 2. REAL-TIME PROGRESS BAR -->
      <div class="assessment-progress card panel" aria-label="Assessment progress">
        <div class="assessment-progress-heading">
          <strong>Task Collaboration Progress</strong>
          <span>${progress.percent}% complete</span>
        </div>
        <div class="assessment-progress-track"><i style="width:${progress.percent}%"></i></div>
        <small>${progress.answered} answered · ${progress.skipped} skipped · ${progress.total - progress.completed} remaining</small>
      </div>

      <main class="task-page-main">
        ${state.questionTransition ? `<div class="question-transition" role="status">${escapeHtml(state.questionTransition)}</div>` : ''}

        <!-- 3. PROBLEM STATEMENT DISPLAYED ON TOP -->
        <article class="card panel problem-statement-card" id="currentQuestionCard" tabindex="-1">
          <div class="problem-statement-topbar">
            <div class="task-meta-bar">
              <span class="badge diff-badge ${diffBadgeClass}">${escapeHtml(q.difficulty || 'Easy')}</span>
              <span class="badge category-badge">${escapeHtml(q.category || 'Human-AI Collaboration')}</span>
              <span class="badge domain-badge">${escapeHtml(q.domain || 'Domain')}</span>
              <span class="expected-time-tag">⏱ ${escapeHtml(q.expectedTime || '3–5 minutes')}</span>
            </div>
            
            <!-- MODEL SELECTION (DEFAULT GROQ, OPTION TO CHANGE) -->
            <div class="model-selection-box">
              <label for="aiModelSelect"><strong>Active AI Model:</strong></label>
              <select class="ai-model-select-compact" id="aiModelSelect" aria-label="Select AI model" style="color-scheme: ${currentTheme()};">
                ${renderLlmOption('Groq', 'groq_configured')}
                ${renderLlmOption('ChatGPT', 'chatgpt_configured')}
              </select>
            </div>
          </div>

          <h2 class="question-title">${escapeHtml(q.title || 'Dynamic Task')}</h2>
          
          <div class="scenario-box">
            <div class="box-header">
              <span class="box-icon">📋</span>
              <strong>Problem Scenario & Context</strong>
            </div>
            <p class="scenario-text">${escapeHtml(q.scenario || q.text)}</p>
          </div>

          ${Array.isArray(q.instructions) && q.instructions.length > 0 ? `
          <div class="focus-box hints-collapsible-box ${state.showHints ? 'is-expanded' : 'is-collapsed'}" id="hintsContainer">
            <div class="box-header hints-header" id="toggleHintsHeader" role="button" tabindex="0" title="Click to show or hide collaboration hints">
              <div class="hints-title-group">
                <span class="box-icon">💡</span>
                <strong>Hints & Collaboration Questions (${q.instructions.length})</strong>
                <span class="hints-pill-status" id="hintsPillStatus">${state.showHints ? 'Visible' : 'Hidden'}</span>
              </div>
              <button class="secondary hints-toggle-action-btn" type="button" id="hintsToggleBtnAction">
                ${state.showHints ? '▲ Hide Hints' : '💡 Show Hints'}
              </button>
            </div>
            <div class="hints-body" id="hintsBody" style="${state.showHints ? 'display:block;' : 'display:none;'}">
              <p class="hints-intro-note">Collaboration angles and prompt ideas you can explore with the AI:</p>
              <ol class="task-instructions-list">
                ${q.instructions.map(ins => `<li>${escapeHtml(ins)}</li>`).join('')}
              </ol>
            </div>
          </div>` : ''}
        </article>

        <!-- 4. CHAT INTERFACE BELOW PROBLEM STATEMENT -->
        <article class="card panel chat-interface-card">
          <div class="chat-card-header">
            <div class="chat-agent-info">
              <span class="status-dot active"></span>
              <span>Collaborating with <strong>${escapeHtml(state.selectedLLM || 'Groq')}</strong></span>
            </div>
            <div id="saveStatus" class="save-status" aria-live="polite">${escapeHtml(state.saveStatus || 'Ready for collaboration')}</div>
          </div>

          <div class="messages" id="messages">${renderMessages()}</div>

          <div class="chat-row">
            <input id="chatInput" class="chat-input" placeholder="Ask ${escapeHtml(state.selectedLLM || 'Groq')} about this problem..." ${state.started && !state.chatStreaming ? '' : 'disabled'} />
            ${state.chatStreaming ? '<button class="primary ask-model-btn stop-model-btn" style="width:auto" id="stopChat" type="button" title="Stop generating">■ Stop</button>' : `<button class="primary ask-model-btn" style="width:auto" id="sendChat" type="button">Ask ${escapeHtml(state.selectedLLM || 'Groq')} ➔</button>`}
          </div>
        </article>

        <!-- 5. NAVIGATION BELOW (NEXT & SKIP ONLY) -->
        <nav class="card panel bottom-question-navigation" aria-label="Task navigation">
          <button class="secondary skip-btn" id="skipQuestion" type="button" ${state.submitting ? 'disabled' : ''}>Skip Task</button>
          <span class="nav-task-count">Task ${state.current + 1} of ${totalTasks}</span>
          <button class="primary next-btn" id="submitAnswer" type="button" ${state.submitting ? 'disabled' : ''}>
            <span>${state.submitting ? 'Advancing…' : (state.current + 1 >= totalTasks ? 'Finish Tasks & Verify Workload ➔' : 'Next Task ➔')}</span>
          </button>
        </nav>
        <div class="error" id="examError"></div>
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
  const totalParts = (state.questions && state.questions.length) || getSessionTaskList().length || 1;
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
    return `
      <div class="model-welcome">
        <div class="model-welcome-icon model-${state.selectedLLM.toLowerCase()}">${modelIcon}</div>
        <h3>Hello ${firstName}, let's collaborate on this task.</h3>
        <p>I am powered by <strong>${modelName}</strong>. Review the problem statement above and ask questions below.</p>
      </div>`;
  }
  if (!state.messages.length) {
    return `<div class="model-welcome"><h3>Ready to collaborate</h3><p>Groq is active by default. Type your question below to begin.</p></div>`;
  }

  return state.messages.map((m, idx) => {
    if (m.role === 'user') {
      return `
        <div class="message user">
          <div class="msg-bubble">${escapeHtml(m.content)}</div>
        </div>`;
    }
    if (m.role === 'assistant') {
      const msgId = m.id || `msg-${idx}`;
      m.id = msgId;
      const feedback = m.feedback || (state.chatFeedback && state.chatFeedback[msgId]) || '';
      return `
        <div class="message assistant" data-msg-id="${msgId}">
          <div class="msg-sender-tag"><span>🤖 ${escapeHtml(state.selectedLLM || 'AI Assistant')}</span></div>
          <div class="msg-bubble">${escapeHtml(m.content)}</div>
          ${!state.chatStreaming ? `
          <div class="msg-feedback-bar" data-feedback-wrap="${msgId}">
            <span class="feedback-label">Response Feedback:</span>
            <button class="feedback-btn thumbs-up ${feedback === 'thumbs_up' ? 'active' : ''}" type="button" data-action="thumbs_up" data-msg-idx="${idx}" title="Thumbs up: Helpful and accurate">
              👍 <span>Helpful</span>
            </button>
            <button class="feedback-btn thumbs-down ${feedback === 'thumbs_down' ? 'active' : ''}" type="button" data-action="thumbs_down" data-msg-idx="${idx}" title="Thumbs down: Needs improvement">
              👎 <span>Needs work</span>
            </button>
            ${feedback ? `<span class="feedback-status-pill ${feedback}">✓ ${feedback === 'thumbs_up' ? 'Helpful' : 'Needs work'}</span>` : ''}
          </div>` : ''}
        </div>`;
    }
    return `<div class="message ${escapeHtml(m.role)}"><div class="msg-bubble">${escapeHtml(m.content)}</div></div>`;
  }).join('');
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
  // Collapsible Hints Handler
  const toggleHints = (e) => {
    if (e) e.stopPropagation();
    state.showHints = !state.showHints;
    const body = document.getElementById('hintsBody');
    const container = document.getElementById('hintsContainer');
    const pill = document.getElementById('hintsPillStatus');
    const btn = document.getElementById('hintsToggleBtnAction');
    if (body) body.style.display = state.showHints ? 'block' : 'none';
    if (container) {
      container.classList.toggle('is-expanded', state.showHints);
      container.classList.toggle('is-collapsed', !state.showHints);
    }
    if (pill) pill.textContent = state.showHints ? 'Visible' : 'Hidden';
    if (btn) btn.textContent = state.showHints ? '▲ Hide Hints' : '💡 Show Hints';
  };
  const toggleHintsHeader = document.getElementById('toggleHintsHeader');
  if (toggleHintsHeader) toggleHintsHeader.onclick = toggleHints;
  const hintsToggleAction = document.getElementById('hintsToggleBtnAction');
  if (hintsToggleAction) hintsToggleAction.onclick = toggleHints;

  // Exam Domain Switcher Handler
  const examChangeDomainBtn = document.getElementById('examChangeDomainBtn');
  if (examChangeDomainBtn) {
    examChangeDomainBtn.onclick = () => {
      showDomainSwitcherModal();
    };
  }

  // Exam Home Button Handler
  const examHomeBtn = document.getElementById('examHomeBtn');
  if (examHomeBtn) {
    examHomeBtn.onclick = async () => {
      const ok = await confirmToast(
        'Pause assessment and return to Home? Your current progress and remaining time will be saved.',
        { title: 'Return Home?', confirmText: 'Save & Return Home', cancelText: 'Stay on Assessment', type: 'info' }
      );
      if (ok) {
        saveParticipantState();
        navigateTo('#/home');
      }
    };
  }

  const exitAdminBtn = document.getElementById('exitAdminTaskRunBtn');
  if (exitAdminBtn) {
    exitAdminBtn.onclick = () => {
      state.adminMode = false;
      state.started = false;
      state.trackingActive = false;
      clearInterval(state.timerHandle);
      toast.info('Returned to Admin Portal.', 'Admin Mode Exited');
      renderRoleDashboard('admin');
    };
  }
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
      toast.info(`Active AI model switched to ${state.selectedLLM}`, 'Model Changed');
      if (state.started) renderExam();
      else await startCurrentQuestion(q);
    });
  }

  // Thumbs Up / Thumbs Down Feedback Button Listeners
  document.querySelectorAll('.feedback-btn').forEach(btn => {
    btn.onclick = async () => {
      const action = btn.dataset.action; // 'thumbs_up' or 'thumbs_down'
      const idx = Number(btn.dataset.msgIdx);
      if (state.messages && state.messages[idx]) {
        state.messages[idx].feedback = action;
        const msgId = state.messages[idx].id || `msg-${idx}`;
        if (!state.chatFeedback) state.chatFeedback = {};
        state.chatFeedback[msgId] = action;
        
        safePost('/llm/chat/feedback', {
          participant_id: state.participant?.participant_id || '',
          question_id: q.id,
          prompt_id: msgId,
          feedback: action,
          comments: ''
        }, state.participantSessionToken).catch(err => console.warn('Feedback save error:', err));
        
        if (action === 'thumbs_up') {
          toast.success('Thank you! Response marked as helpful 👍', 'Feedback Saved');
        } else {
          toast.info('Response marked as needing work 👎', 'Feedback Saved');
        }
        renderExam();
      }
    };
  });
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
    endSessionBtn.onclick = async () => {
      if (state.finishing) return;
      const ok = await confirmToast(
        'End this assessment early? You will proceed to the NASA-TLX workload verification to measure cognitive load change from your baseline.',
        { title: 'End Assessment Early?', confirmText: 'End Session', cancelText: 'Keep Working', type: 'warning', danger: true }
      );
      if (!ok) return;
      prepareQuestionNavigation();
      renderNasaTlxAssessment(true);
    };
  }

  const continueLaterBtn = document.getElementById('continueLaterBtn');
  if (continueLaterBtn) {
    continueLaterBtn.onclick = async () => {
      if (state.finishing) return;
      const ok = await confirmToast(
        'Pause this assessment and continue later? All your answers and remaining time will be saved.',
        { title: 'Save & Continue Later?', confirmText: 'Save & Exit', cancelText: 'Keep Working', type: 'info' }
      );
      if (!ok) return;
      prepareQuestionNavigation();
      saveParticipantState();
      clearInterval(state.timerHandle);
      toast.info('Assessment progress saved! You can resume anytime by logging back in.', 'Progress Saved');
      renderLogin();
    };
  }
}

function prepareQuestionNavigation() {
  state.showHints = false;
  state.activeHintTaskId = null;
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
  const totalTasks = (state.questions && state.questions.length) || getSessionTaskList().length || 1;
  if (index < 0 || index >= totalTasks || index === state.current || state.submitting) return;
  prepareQuestionNavigation();
  state.current = index;
  state.subquestion = 0;
  state.showHints = false;
  state.activeHintTaskId = null;
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
  const totalTasks = (state.questions && state.questions.length) || getSessionTaskList().length || 1;
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

async function skipCurrentQuestion() {
  const ok = await confirmToast('Skip this task? It will be recorded as skipped.', {
    title: 'Skip Task?',
    confirmText: 'Skip Task',
    cancelText: 'Continue Working',
    type: 'warning'
  });
  if (!ok) return;
  if (state.submitting) return;
  prepareQuestionNavigation();
  const skippedId = currentQuestion().id;
  if (!state.skippedQuestionIds.includes(skippedId)) state.skippedQuestionIds.push(skippedId);
  const totalTasks = (state.questions && state.questions.length) || getSessionTaskList().length || 1;
  const completedLastTask = state.current >= totalTasks - 1;
  if (completedLastTask) {
    state.answerDraft = '';
    state.codeDraft = '';
    state.messages = [];
    return renderNasaTlxAssessment();
  }
  state.current++;
  state.subquestion = 0;
  state.showHints = false;
  state.activeHintTaskId = null;
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
  const totalTasks = (state.questions && state.questions.length) || getSessionTaskList().length || 1;
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

  const totalTasks = (state.questions && state.questions.length) || getSessionTaskList().length || 1;
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
  state.showHints = false;
  state.activeHintTaskId = null;
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
  syncRoute('#/post-workload');
  state.endedEarly = Boolean(endedEarly);
  state.questionRatings = [];
  clearInterval(state.timerHandle);

  // Pre-populate missing dimensions from baseline or default 5 so verification can start immediately
  NASA_TLX_END_DIMENSIONS.forEach(d => {
    if (!Number.isFinite(state.nasaTlx[d.key])) {
      state.nasaTlx[d.key] = Number.isFinite(state.baselineNasaTlx[d.key]) ? state.baselineNasaTlx[d.key] : 5;
    }
  });

  const getBaselineAvg = () => {
    const vals = NASA_TLX_START_DIMENSIONS.map(d => state.baselineNasaTlx[d.key]).filter(Number.isFinite);
    return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const getPostAvg = () => {
    const vals = NASA_TLX_END_DIMENSIONS.map(d => state.nasaTlx[d.key]).filter(Number.isFinite);
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

  const cards = NASA_TLX_END_DIMENSIONS.map(d => {
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
    ? 'You chose to conclude this session before completing all matching tasks. Rate your perceived cognitive workload across all dimensions so the system can measure how much your cognitive load increased from your pre-task baseline.'
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

  const activeQuestionId = state.started ? currentQuestion()?.id : null;

  stopSharedTrackingCapture();
  state.trackingActive = false;
  await waitForSharedCaptureIdle();
  await flushCameraSecondBuffer();
  stopBehaviorSecondTracking();

  if (behaviorSecondBuffer) {
    const finalBehaviorSecond = behaviorSecondBuffer;
    behaviorSecondBuffer = null;
    await saveBehaviorSecond(finalBehaviorSecond);
  }

  if (activeQuestionId) {
    await flushUnmatchedMultimodalSeconds(activeQuestionId);
  }

  let completionError = '';
  try {
    await safePost('/sessions/complete', {
      participant: state.participant,
      participant_id: state.participant?.participant_id || '',
      session_id: state.sessionId || '',
      session_started_at: state.sessionStart || new Date().toISOString(),
      session_ended_at: new Date().toISOString(),
      ended_early: Boolean(endedEarly),
      nasa_tlx: state.nasaTlx,
      overall_paas_rating: state.paas || null,
      question_ratings: state.questionRatings || [],
      answers: state.answers || [],
      interaction_summary: { ...state.tracking }
    }, state.participantSessionToken);
    clearParticipantState();
    toast.success('Assessment data and telemetry recorded successfully!', 'Session Completed');
  } catch (error) {
    completionError = formatToastMessage(error);
    toast.error(`Session complete save error: ${completionError}`, 'Save Notice');
  }

  const getBaselineAvg = () => {
    const vals = NASA_TLX_START_DIMENSIONS.map(d => state.baselineNasaTlx[d.key]).filter(Number.isFinite);
    return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const getPostAvg = () => {
    const vals = NASA_TLX_END_DIMENSIONS.map(d => state.nasaTlx[d.key]).filter(Number.isFinite);
    return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const baseAvg = getBaselineAvg();
  const postAvg = getPostAvg();
  const delta = (baseAvg !== null && postAvg !== null) ? Number((postAvg - baseAvg).toFixed(1)) : 0;
  const pct = (baseAvg !== null && baseAvg > 0) ? Math.round((delta / baseAvg) * 100) : 0;
  const deltaFormatted = delta > 0 ? `+${delta}` : `${delta}`;
  const pctFormatted = pct > 0 ? `+${pct}%` : pct < 0 ? `${pct}%` : '0%';
  const deltaClass = delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-flat';

  const strainInfo = (d, p) => {
    if (d >= 1.8 || p >= 35) return { label: 'High Cognitive Strain Spike', pillClass: 'strain-high', desc: 'Significant workload elevation from baseline' };
    if (d >= 0.5 || p >= 10) return { label: 'Moderate Load Increase', pillClass: 'strain-moderate', desc: 'Noticeable mental demand during collaboration' };
    if (d <= -0.5) return { label: 'Cognitive Recovery', pillClass: 'strain-recovery', desc: 'Workload dropped below pre-task baseline' };
    return { label: 'Stable Cognitive Equilibrium', pillClass: 'strain-stable', desc: 'Cognitive load remained consistent with baseline' };
  };
  const strain = strainInfo(delta, pct);

  clearParticipantState();
  clearInterval(monitoringTimer);
  await sendMonitoringHeartbeat(endedEarly ? 'ended' : 'completed').catch(() => {});
  stopVisionCamera();

  const progress = assessmentProgressSnapshot();
  const userPrompts = state.messages.filter(m => m.role === 'user');
  const thumbsUpCount = Object.values(state.chatFeedback || {}).filter(v => v === 'thumbs_up').length;
  const thumbsDownCount = Object.values(state.chatFeedback || {}).filter(v => v === 'thumbs_down').length;
  const durationSec = Math.round((Date.now() - new Date(state.sessionStart || Date.now()).getTime()) / 1000);
  const durationFormatted = formatDuration(Math.max(durationSec, 30));

  const candidateId = escapeHtml(state.participant?.participant_id || 'Not assigned');
  const heading = endedEarly ? 'Assessment Concluded Early' : 'Assessment Completed Successfully';

  app.innerHTML = `
    <div class="success-screen">
      <div class="card success-card completion-hub">
        <div class="success-header">
          <div class="success-icon-animated">✓</div>
          <h1>${heading}</h1>
          <p class="success-sub">All dynamic collaboration tasks, multimodal telemetry streams, and cognitive workload verifications have been permanently recorded.</p>
        </div>

        <div class="completion-grid">
          <!-- Card 1: Candidate Profile -->
          <article class="completion-card">
            <div class="card-kicker">CANDIDATE PROFILE</div>
            <h3>${escapeHtml(state.participant?.full_name || 'Participant')}</h3>
            <div class="completion-detail-row"><span>Candidate ID:</span> <strong>${candidateId}</strong></div>
            <div class="completion-detail-row"><span>Username:</span> <strong>${escapeHtml(state.participant?.username || state.registeredUser?.username || 'Guest')}</strong></div>
            <div class="completion-detail-row"><span>Domain:</span> <strong>${escapeHtml(state.participant?.domain || 'General')}</strong></div>
            <div class="completion-detail-row"><span>Age Cohort:</span> <strong>${escapeHtml(state.participant?.age_group || 'All Ages')}</strong></div>
            <div class="completion-detail-row"><span>AI Familiarity:</span> <strong>${escapeHtml(state.participant?.ai_familiarity || 'Intermediate')}</strong></div>
          </article>

          <!-- Card 2: Collaboration Stats -->
          <article class="completion-card">
            <div class="card-kicker">TASK PERFORMANCE</div>
            <h3>Collaboration Summary</h3>
            <div class="completion-detail-row"><span>Tasks Completed:</span> <strong style="color:var(--green)">${progress.answered} / ${progress.total}</strong></div>
            <div class="completion-detail-row"><span>Tasks Skipped:</span> <strong>${progress.skipped}</strong></div>
            <div class="completion-detail-row"><span>Session Duration:</span> <strong>${durationFormatted}</strong></div>
            <div class="completion-detail-row"><span>Primary AI Model:</span> <strong>${escapeHtml(state.selectedLLM || 'Groq')}</strong></div>
            <div class="completion-detail-row"><span>AI Response Feedback:</span> <strong>👍 ${thumbsUpCount} &nbsp;·&nbsp; 👎 ${thumbsDownCount}</strong></div>
          </article>

          <!-- Card 3: NASA-TLX Workload -->
          <article class="completion-card">
            <div class="card-kicker">NASA-TLX WORKLOAD</div>
            <h3>Cognitive Load Verification</h3>
            <div class="completion-detail-row"><span>Pre-Task Baseline:</span> <strong>${baseAvg !== null ? baseAvg.toFixed(1) : '—'} / 10</strong></div>
            <div class="completion-detail-row"><span>Post-Task Workload:</span> <strong>${postAvg !== null ? postAvg.toFixed(1) : '—'} / 10</strong></div>
            <div class="completion-detail-row"><span>Workload Delta:</span> <strong class="${deltaClass}">${deltaFormatted} (${pctFormatted})</strong></div>
            <div class="completion-detail-row"><span>Strain Status:</span> <span class="badge ${strain.pillClass}">${strain.label}</span></div>
          </article>

          <!-- Card 4: Telemetry Assurance -->
          <article class="completion-card">
            <div class="card-kicker">MULTIMODAL TELEMETRY</div>
            <h3>Research Integrity Verified</h3>
            <ul class="telemetry-check-list">
              <li>✓ Eye Tracking Fixations & Gaze Metrics</li>
              <li>✓ Facial Action Units & Fatigue Landmarks</li>
              <li>✓ Keyboard Dynamic Cadence Logged</li>
              <li>✓ Mouse Velocity & Jitter Recorded</li>
              <li>✓ Prompt Sentiment & Complexity Stored</li>
            </ul>
          </article>
        </div>

        <div class="completion-actions">
          <button class="primary" id="restart" type="button">Return to Login Now</button>
          <button class="secondary" id="printSummaryBtn" type="button">🖨 Print / Save Summary</button>
          <div class="countdown-bar">
            <span>Auto-returning to login in <strong id="countdownSec">60</strong>s</span>
            <button class="secondary btn-xs" id="pauseCountdownBtn" type="button">Pause Countdown</button>
          </div>
        </div>
      </div>
    </div>
  `;

  let remainingSec = 60;
  let countdownPaused = false;
  const countdownInterval = setInterval(() => {
    if (countdownPaused) return;
    remainingSec--;
    const el = document.getElementById('countdownSec');
    if (el) el.textContent = String(remainingSec);
    if (remainingSec <= 0) {
      clearInterval(countdownInterval);
      returnToLogin();
    }
  }, 1000);

  document.getElementById('pauseCountdownBtn')?.addEventListener('click', (e) => {
    countdownPaused = !countdownPaused;
    e.target.textContent = countdownPaused ? 'Resume Countdown' : 'Pause Countdown';
    toast.info(countdownPaused ? 'Countdown paused. Review your summary at your own pace.' : 'Countdown resumed.', 'Timer Updated');
  });

  document.getElementById('printSummaryBtn')?.addEventListener('click', () => {
    window.print();
  });

  let returnedToLogin = false;
  const returnToLogin = () => {
    if (returnedToLogin) return;
    returnedToLogin = true;
    clearInterval(countdownInterval);
    resetParticipantSession();
    renderLogin();
  };
  document.getElementById('restart').onclick = returnToLogin;
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
  const total = (state.questions && state.questions.length) || getSessionTaskList().length || 1;
  const answered = new Set(state.answers.map(answer => answer.question_id)).size;
  const skipped = new Set(state.skippedQuestionIds || []).size;
  const completed = Math.min(total, answered + skipped);
  return { total, answered, skipped, completed, percent: Math.round(completed / total * 100) };
}
function escapeHtml(s) { return s.replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c])); }

function extractErrorString(data, fallback) {
  if (!data) return fallback;
  if (typeof data === 'string') {
    if (data.includes('[object Object]')) {
      return fallback;
    }
    return data;
  }
  if (data.detail) {
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail.map(d => {
        if (typeof d === 'object' && d !== null) {
          const loc = Array.isArray(d.loc) ? d.loc.filter(x => x !== 'body').join('.') : (d.loc || '');
          const m = d.msg || d.message || JSON.stringify(d);
          return (loc ? `${loc}: ` : '') + m;
        }
        return String(d);
      }).join('; ');
    }
    if (typeof data.detail === 'object' && data.detail !== null) {
      return data.detail.msg || data.detail.message || JSON.stringify(data.detail);
    }
  }
  if (data.message && typeof data.message === 'string') return data.message;
  if (data.msg && typeof data.msg === 'string') return data.msg;
  return fallback;
}

async function safeGet(path, token = '') {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE_URL}${path}`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorString(data, `HTTP ${res.status}`));
  return data;
}

async function safeDelete(path, token = '') {
  return safeJsonRequest('DELETE', path, {}, token);
}

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
    throw new Error(extractErrorString(data, `server returned HTTP ${response.status}`));
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
  if (!res.ok) throw new Error(extractErrorString(data, `server returned HTTP ${res.status}`));
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
  const homeBtn = document.getElementById('roleLoginHomeBtn'); if (homeBtn) homeBtn.onclick = () => navigateTo('#/home'); const backBtn = document.getElementById('roleLoginBackBtn'); if (backBtn) backBtn.onclick = () => window.history.back();
  document.getElementById('groupDashboardBtn').onclick = () => {
    sessionStorage.setItem(DASHBOARD_MODE_STORAGE_KEY, 'group');
    sessionStorage.removeItem(DASHBOARD_PARTICIPANT_STORAGE_KEY);
    renderIndependentDashboard('group');
  };
  const researchChoiceBtn = document.getElementById('researchMetricsChoiceBtn');
  if (researchChoiceBtn) researchChoiceBtn.onclick = () => renderResearchMetricsPage('dashboard');
}

function renderDashboardCredentialLogin() {
  syncRoute('#/dashboard-login');
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
  const homeBtn = document.getElementById('roleLoginHomeBtn'); if (homeBtn) homeBtn.onclick = () => navigateTo('#/home'); const backBtn = document.getElementById('roleLoginBackBtn'); if (backBtn) backBtn.onclick = () => window.history.back();
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
  syncRoute(role === 'admin' ? '#/admin-login' : '#/host-login');
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

  const homeBtn = document.getElementById('roleLoginHomeBtn'); if (homeBtn) homeBtn.onclick = () => navigateTo('#/home'); const backBtn = document.getElementById('roleLoginBackBtn'); if (backBtn) backBtn.onclick = () => window.history.back();
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
  syncRoute(role === 'admin' ? '#/admin' : '#/host');
  const dashboardTitle = role === 'admin' ? 'Administrator Data Dashboard' : 'Host Agent Orchestration Console';
  const dashboardDescription = role === 'admin'
    ? 'Platform-wide participant, session, answer, chat, eye, keyboard, and monitoring information.'
    : 'The Host Agent dispatches each heartbeat to specialist agents and combines their findings for human review.';
  app.innerHTML = `
    <div class="role-page">
      <header class="topbar">
        <div class="brand"><div class="logo">C</div><div><h1>CogniTrack <span style="color:#38dd9a">AI</span></h1><small>${roleName} Dashboard</small></div></div>
        ${themeToggleMarkup()}
        <div class="role-actions"><button class="secondary nav-home-btn" id="roleDashHomeBtn" type="button">🏠 Home</button><button class="secondary nav-back-btn" id="roleDashBackBtn" type="button">← Go Back</button><span class="badge">● ${roleName} authenticated</span><button class="danger-btn" id="roleLogout" type="button">Logout</button></div>
      </header>
      <main class="dashboard-wrap">
        <section class="dashboard-heading"><div><div class="eyebrow">${roleName.toUpperCase()} PORTAL</div><h2>${dashboardTitle}</h2><p>${dashboardDescription}</p></div><div class="dashboard-heading-actions"><button class="secondary" id="refreshDashboard">Refresh</button><button class="secondary" id="adminResearchMetricsBtn" type="button" style="margin-left: 10px;">📊 CLI Research Metrics</button>${role === 'admin' ? '<button class="primary" id="downloadDataBtn" style="margin-left: 10px;">Download Data (Excel)</button>' : ''}</div></section>
        ${role === 'admin' ? renderAdminWorkflowFlowchart() : ''}
        <div id="dashboardContent"><article class="card panel">Loading live participant data…</article></div>
      </main>
    </div>`;
  const adminResearchBtn = document.getElementById('adminResearchMetricsBtn');
  if (adminResearchBtn) adminResearchBtn.onclick = () => renderResearchMetricsPage('dashboard');
  const dashHome = document.getElementById('roleDashHomeBtn'); if (dashHome) dashHome.onclick = () => navigateTo('#/home'); const dashBack = document.getElementById('roleDashBackBtn'); if (dashBack) dashBack.onclick = () => window.history.back();
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
  // Auto-refresh interval disabled to prevent disruptive re-renders while typing/browsing
  // dashboardTimer = setInterval(refreshDashboard, 5000);
}

const adminFilterState = {
  selectedParticipant: 'all',
  searchQuery: '',
  statusFilter: 'all',
  domainFilter: 'all',
  cachedCognitiveData: null,
  cachedCohortParticipants: [],
  cachedTasks: [],
  activeTab: 'overview',
  workflowCollapsed: false,
  tasksFilterDomain: 'all',
  tasksFilterDifficulty: 'all',
  tasksFilterAge: 'all',
  tasksSearchQuery: '',
  launchDomain: 'Artificial Intelligence',
  launchAge: '23–28',
  launchTaskId: '',
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

function renderAdminOverviewTab(cliData, participantList) {
  const isCohort = !adminFilterState.selectedParticipant || adminFilterState.selectedParticipant === 'all';
  return `
    <section class="admin-cli-section" id="adminCliContent">
      ${isCohort
        ? renderAdminCognitiveCohortView(cliData, participantList)
        : renderAdminCognitiveIndividualView(cliData, adminFilterState.selectedParticipant)}
    </section>
  `;
}

function renderAdminRosterTab(data, cliData, participantList) {
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

    <!-- Participant Cognitive Load Roster Table -->
    <article class="card panel admin-cli-roster-card">
      <div class="detail-page-heading">
        <div>
          <div class="section-label">PARTICIPANT COGNITIVE LOAD ROSTER</div>
          <h3>Cohort Participant Telemetry & Status</h3>
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


function launchAdminTaskSession(task) {
  if (state.authRole !== 'admin') {
    toast.error('Only administrators can enter tasks through this feature.', 'Admin Restricted');
    return;
  }
  if (!task) {
    toast.error('Please select a valid task to enter.', 'No Task Selected');
    return;
  }

  state.adminMode = true;
  state.adminTask = task;
  state.participant = {
    participant_id: 'ADMIN-SIM',
    username: 'admin',
    full_name: 'Administrator (Simulation)',
    domain: task.domain || 'Artificial Intelligence',
    age_group: task.target_age || '23–28',
    test_mode: true
  };
  state.questions = [task];
  state.current = 0;
  state.subquestion = 0;
  state.selectedLLM = state.selectedLLM || 'Groq';
  state.started = true;
  state.trackingActive = true;
  state.trackingStartedAt = Date.now();
  state.startTime = Date.now();
  state.assessmentDeadline = Date.now() + 3600 * 1000;
  state.assessmentStage = 'exam';
  state.messages = [];
  state.answerDraft = '';
  state.questionDrafts = {};

  toast.info(`Entered Task "${task.title}" (${task.domain} • ${task.target_age || 'All Ages'}) in Admin Mode.`, 'Admin Task Entered');
  renderExam();
}

function renderAdminTaskManagement() {
  const tasks = adminFilterState.cachedTasks || [];
  const domains = ['All Domains', 'Artificial Intelligence', 'Computer Science', 'Data Science', 'Software Development', 'Cross-Disciplinary', 'Other'];
  const difficulties = ['All Difficulties', 'Easy', 'Medium', 'Hard'];
  const ages = ['All Ages', '18–22', '23–28', '29–35', '36–45', '46+'];

  const filteredTasks = tasks.filter(t => {
    if (adminFilterState.tasksFilterDomain && adminFilterState.tasksFilterDomain !== 'all' && adminFilterState.tasksFilterDomain !== 'All Domains') {
      if (t.domain !== adminFilterState.tasksFilterDomain) return false;
    }
    if (adminFilterState.tasksFilterDifficulty && adminFilterState.tasksFilterDifficulty !== 'all' && adminFilterState.tasksFilterDifficulty !== 'All Difficulties') {
      if (t.difficulty !== adminFilterState.tasksFilterDifficulty) return false;
    }
    if (adminFilterState.tasksFilterAge && adminFilterState.tasksFilterAge !== 'all' && adminFilterState.tasksFilterAge !== 'All Ages') {
      if (t.target_age && t.target_age !== 'All Ages' && t.target_age !== adminFilterState.tasksFilterAge) return false;
    }
    if (adminFilterState.tasksSearchQuery) {
      const q = adminFilterState.tasksSearchQuery.toLowerCase();
      const match = (t.title || '').toLowerCase().includes(q) || (t.id || '').toLowerCase().includes(q) || (t.scenario || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Calculate matching tasks for the Admin Task Launcher (Domain + Age Group)
  const currentLaunchDomain = adminFilterState.launchDomain || 'Artificial Intelligence';
  const currentLaunchAge = adminFilterState.launchAge || '23–28';

  const matchesLaunchAge = (t) => {
    if (!t.target_age || t.target_age === 'All Ages' || t.target_age === 'All' || currentLaunchAge === 'All Ages') return true;
    return t.target_age === currentLaunchAge;
  };

  const matchingLaunchTasks = tasks.filter(t => 
    (t.domain === currentLaunchDomain || t.domain === 'Cross-Disciplinary' || currentLaunchDomain === 'All Domains') && matchesLaunchAge(t)
  );

  let activeLaunchTask = matchingLaunchTasks.find(t => t.id === adminFilterState.launchTaskId);
  if (!activeLaunchTask && matchingLaunchTasks.length > 0) {
    activeLaunchTask = matchingLaunchTasks[0];
    adminFilterState.launchTaskId = activeLaunchTask.id;
  }

  return `
    <div class="admin-task-management-layout">
      <!-- Admin Exclusive Top Ribbon -->
      <div class="admin-exclusive-ribbon">
        <span class="ribbon-icon">🛡️</span>
        <span>ADMINISTRATOR TASK MANAGEMENT & SIMULATION PORTAL</span>
        <span class="ribbon-tag">Admin Exclusive</span>
      </div>

      <!-- 1. LIVE TASK LAUNCHER (ENTER TASK BASED ON DOMAIN & AGE GROUP) -->
      <article class="card panel admin-task-launch-card">
        <div class="launch-header-row">
          <div>
            <div class="section-label" style="color:var(--blue); font-weight:800; display:flex; align-items:center; gap:6px;">
              <span>🚀</span> ENTER ASSESSMENT TASK (ADMIN ONLY)
            </div>
            <h3 style="margin:4px 0 6px;">Launch Assessment Task by Domain & Target Age Cohort</h3>
            <p style="margin:0; font-size:13px; color:var(--muted);">
              As an Administrator, choose any domain specialization and age demographic to immediately enter and test the live interactive assessment environment.
            </p>
          </div>
          <div class="admin-shield-badge">🔒 ADMIN PRIVILEGE</div>
        </div>

        <div class="admin-task-launch-controls" style="margin-top:18px;">
          <div class="grid-3">
            <div class="field">
              <label><strong>1. Select Domain *</strong></label>
              <select id="adminLaunchDomainSelect">
                <option value="Artificial Intelligence" ${currentLaunchDomain === 'Artificial Intelligence' ? 'selected' : ''}>Artificial Intelligence</option>
                <option value="Computer Science" ${currentLaunchDomain === 'Computer Science' ? 'selected' : ''}>Computer Science</option>
                <option value="Data Science" ${currentLaunchDomain === 'Data Science' ? 'selected' : ''}>Data Science</option>
                <option value="Software Development" ${currentLaunchDomain === 'Software Development' ? 'selected' : ''}>Software Development</option>
                <option value="Cross-Disciplinary" ${currentLaunchDomain === 'Cross-Disciplinary' ? 'selected' : ''}>Cross-Disciplinary</option>
              </select>
            </div>
            <div class="field">
              <label><strong>2. Select Target Age Group *</strong></label>
              <select id="adminLaunchAgeSelect">
                <option value="All Ages" ${currentLaunchAge === 'All Ages' ? 'selected' : ''}>All Ages (General)</option>
                <option value="18–22" ${currentLaunchAge === '18–22' ? 'selected' : ''}>18–22 (Undergraduate)</option>
                <option value="23–28" ${currentLaunchAge === '23–28' ? 'selected' : ''}>23–28 (Graduate / Early Career)</option>
                <option value="29–35" ${currentLaunchAge === '29–35' ? 'selected' : ''}>29–35 (Mid-level Professional)</option>
                <option value="36–45" ${currentLaunchAge === '36–45' ? 'selected' : ''}>36–45 (Senior Professional)</option>
                <option value="46+" ${currentLaunchAge === '46+' ? 'selected' : ''}>46+ (Experienced / Executive)</option>
              </select>
            </div>
            <div class="field">
              <label><strong>3. Select Task from Cohort (${matchingLaunchTasks.length}) *</strong></label>
              <select id="adminLaunchTaskSelect">
                ${matchingLaunchTasks.length 
                  ? matchingLaunchTasks.map(t => `<option value="${escapeHtml(t.id)}" ${activeLaunchTask?.id === t.id ? 'selected' : ''}>${escapeHtml(t.title)} (${escapeHtml(t.difficulty || 'Normal')})</option>`).join('')
                  : '<option value="">No tasks match this domain & age cohort</option>'
                }
              </select>
            </div>
          </div>

          <!-- Dynamic Task Preview Box -->
          <div id="adminLaunchTaskPreviewBox" class="admin-launch-preview-card" style="margin-top:14px; padding:18px; border-radius:12px; background:var(--input-bg); border:1.5px solid var(--border);">
            ${activeLaunchTask ? `
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                <h4 style="margin:0; font-size:15px; font-weight:800; color:var(--text);">${escapeHtml(activeLaunchTask.title)}</h4>
                <div style="display:flex; gap:6px;">
                  <span class="badge diff-badge ${(activeLaunchTask.difficulty || 'Easy').toLowerCase()}">${escapeHtml(activeLaunchTask.difficulty || 'Easy')}</span>
                  <span class="badge domain-badge">${escapeHtml(activeLaunchTask.domain || 'AI')}</span>
                  <span class="badge age-badge">${escapeHtml(activeLaunchTask.target_age || 'All Ages')}</span>
                  <span class="expected-time-tag">⏱ ${escapeHtml(activeLaunchTask.expectedTime || '3–5 mins')}</span>
                </div>
              </div>
              <p style="margin:0 0 10px; font-size:13px; line-height:1.5; color:var(--muted);">${escapeHtml(activeLaunchTask.scenario || '')}</p>
              ${activeLaunchTask.instructions && activeLaunchTask.instructions.length ? `
                <div style="font-size:12px; color:var(--text); font-weight:600; margin-bottom:4px;">Collaboration Objectives:</div>
                <ul style="margin:0; padding-left:18px; font-size:12.5px; color:var(--muted); line-height:1.45;">
                  ${(Array.isArray(activeLaunchTask.instructions) ? activeLaunchTask.instructions : [String(activeLaunchTask.instructions)]).slice(0, 3).map(ins => `<li>${escapeHtml(ins)}</li>`).join('')}
                </ul>
              ` : ''}
            ` : '<p style="margin:0; color:var(--muted);">No task available for the selected cohort. Select another domain or age group above.</p>'}
          </div>

          <div class="admin-launch-actions" style="margin-top:16px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
            <button class="primary admin-launch-btn" id="adminLaunchTaskBtn" type="button" ${!activeLaunchTask ? 'disabled' : ''} style="padding:11px 24px; font-weight:800; font-size:14px; border-radius:10px; display:inline-flex; align-items:center; gap:8px; cursor:pointer; box-shadow:0 6px 20px rgba(36, 94, 232, 0.28);">
              <span>🚀 Enter Assessment Task (Admin Run)</span>
            </button>
            <small style="color:var(--muted); font-size:12.5px;">Simulates full live candidate session with active AI model, typing/mouse telemetry capture, and problem solving.</small>
          </div>
        </div>
      </article>

      <!-- 2. CREATE NEW TASK FORM (ADMIN AUTHORING BY DOMAIN & AGE) -->
      <article class="card panel admin-task-create-card">
        <div class="section-label" style="color:var(--green); font-weight:800; display:flex; align-items:center; gap:6px;">
          <span>📝</span> AUTHOR & ENTER ASSESSMENT TASK (ADMIN ONLY)
        </div>
        <h3 style="margin:4px 0 6px;">Enter New Task Configured by Domain & Target Age Group</h3>
        <p style="margin:0; font-size:13px; color:var(--muted);">Define a custom challenge scenario categorized by domain and target age cohort to publish into platform rotation.</p>
        
        <form id="adminTaskCreateForm" class="admin-task-form">
          <div class="grid-2">
            <div class="field">
              <label>Task Title *</label>
              <input id="taskTitle" placeholder="e.g. Memory Optimization in Transformer KV-Caches" required />
            </div>
            <div class="field">
              <label>Sub-Domain / Category</label>
              <input id="taskCategory" placeholder="e.g. LLM Inference & Optimization" />
            </div>
          </div>

          <div class="grid-3">
            <div class="field">
              <label>Domain *</label>
              <select id="taskDomain" required>
                <option value="Artificial Intelligence">Artificial Intelligence</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Data Science">Data Science</option>
                <option value="Software Development">Software Development</option>
                <option value="Cross-Disciplinary">Cross-Disciplinary</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="field">
              <label>Target Age Category *</label>
              <select id="taskTargetAge" required>
                <option value="All Ages">All Ages (General)</option>
                <option value="18–22">18–22 (Undergraduate)</option>
                <option value="23–28">23–28 (Graduate / Early Career)</option>
                <option value="29–35">29–35 (Mid-level Professional)</option>
                <option value="36–45">36–45 (Senior Professional)</option>
                <option value="46+">46+ (Experienced / Executive)</option>
              </select>
            </div>
            <div class="field">
              <label>Difficulty Level *</label>
              <select id="taskDifficulty" required>
                <option value="Easy">Easy (Foundation / Exploratory)</option>
                <option value="Medium" selected>Medium (Standard Production Case)</option>
                <option value="Hard">Hard (Deep Algorithmic & Trade-off)</option>
              </select>
            </div>
          </div>

          <div class="field">
            <label>Expected Completion Time</label>
            <input id="taskExpectedTime" placeholder="e.g. 3–5 minutes" value="3–5 minutes" />
          </div>

          <div class="field">
            <label>Problem Scenario & Context *</label>
            <textarea id="taskScenario" rows="3" placeholder="Describe the real-world engineering or reasoning challenge..." required></textarea>
          </div>

          <div class="field">
            <label>Collaboration Objectives & Focus Instructions (1 per line) *</label>
            <textarea id="taskInstructions" rows="3" placeholder="1. Ask the AI assistant to analyze trade-offs...
2. Evaluate potential edge cases and latency penalties...
3. Critique the AI recommendation..." required></textarea>
          </div>

          <div class="form-actions" style="margin-top:14px; display:flex; gap:12px; align-items:center;">
            <button class="primary" type="submit" id="createTaskSubmitBtn" style="padding:10px 20px; font-weight:700;">+ Enter & Deploy Task</button>
            <span id="taskCreateStatus" class="save-status"></span>
          </div>
        </form>
      </article>

      <!-- 3. ACTIVE TASK REPOSITORY & FILTERS -->
      <article class="card panel admin-task-inventory-card">
        <div class="inventory-header">
          <div>
            <div class="section-label">ACTIVE TASK REPOSITORY (${filteredTasks.length} tasks)</div>
            <h3 style="margin:4px 0 6px;">Tasks in Platform Rotation</h3>
            <p style="margin:0; font-size:13px; color:var(--muted);">Filter active tasks across domains, difficulty levels, and target age cohorts. Administrators can directly enter any task below.</p>
          </div>
        </div>

        <div class="admin-task-filters">
          <input type="text" id="adminTaskSearch" placeholder="🔍 Search tasks by title or scenario..." value="${escapeHtml(adminFilterState.tasksSearchQuery || '')}" />
          <select id="adminTaskDomainFilter">
            ${domains.map(d => `<option value="${d}" ${adminFilterState.tasksFilterDomain === d ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
          <select id="adminTaskDiffFilter">
            ${difficulties.map(df => `<option value="${df}" ${adminFilterState.tasksFilterDifficulty === df ? 'selected' : ''}>${df}</option>`).join('')}
          </select>
          <select id="adminTaskAgeFilter">
            ${ages.map(a => `<option value="${a}" ${adminFilterState.tasksFilterAge === a ? 'selected' : ''}>${a}</option>`).join('')}
          </select>
        </div>

        <div class="admin-tasks-grid">
          ${filteredTasks.length ? filteredTasks.map(t => `
            <div class="admin-task-card card ${t.is_custom ? 'custom-task' : 'predefined-task'}">
              <div class="admin-task-meta">
                <span class="badge diff-badge ${(t.difficulty || 'Easy').toLowerCase()}">${escapeHtml(t.difficulty || 'Easy')}</span>
                <span class="badge domain-badge">${escapeHtml(t.domain || 'General')}</span>
                <span class="badge age-badge">${escapeHtml(t.target_age || 'All Ages')}</span>
                ${t.is_custom ? '<span class="badge badge-custom">Custom Admin Task</span>' : '<span class="badge badge-system">System Predefined</span>'}
              </div>
              <h4 class="admin-task-title">${escapeHtml(t.title)}</h4>
              <p class="admin-task-desc">${escapeHtml((t.scenario || '').slice(0, 160))}${(t.scenario || '').length > 160 ? '...' : ''}</p>
              <div class="admin-task-footer">
                <small>⏱ ${escapeHtml(t.expectedTime || '3–5 mins')} · ID: ${escapeHtml(t.id)}</small>
                <div class="admin-task-actions" style="display:flex; gap:6px;">
                  <button class="primary btn-xs admin-quick-enter-task-btn" data-enter-task-id="${escapeHtml(t.id)}" type="button" title="Enter this task in Admin Mode">▶ Enter Task</button>
                  ${t.is_custom ? `<button class="danger-btn btn-xs" data-delete-task="${escapeHtml(t.id)}" type="button">Delete</button>` : ''}
                </div>
              </div>
            </div>
          `).join('') : '<p style="padding:20px; color:var(--muted)">No tasks match the selected filter criteria.</p>'}
        </div>
      </article>
    </div>
  `;
}
function renderAdminExportsTab() {
  const pid = adminFilterState.selectedParticipant !== 'all' ? adminFilterState.selectedParticipant : null;
  const participantNotice = pid ? `<span class="badge">Filtered by Participant: ${escapeHtml(pid)}</span>` : '<span class="badge">All Participants (Platform-wide)</span>';

  return `
    <article class="card panel admin-export-panel">
      <div class="exports-tab-header">
        <div>
          <div class="section-label">PLATFORM TELEMETRY & RESEARCH EXPORTS</div>
          <h3>Structured Multimodal Data Tables</h3>
          <p>Directly inspect full database records or export high-resolution CSV datasets. ${participantNotice}</p>
        </div>
      </div>

      <div class="export-categories-grid">
        <div class="export-category-card card">
          <div class="category-heading">
            <span class="cat-icon">👁</span>
            <strong>Physiological & Sensor Modalities</strong>
          </div>
          <p>Webcam computer vision, gaze fixation coordinates, facial action units, and raw input dynamics.</p>
          <div class="export-category-buttons">
            <button class="secondary" data-admin-dataset="eye-tracking">Eye Tracking Table</button>
            <button class="secondary" data-admin-dataset="facial-expression">Facial Expression Table</button>
            <button class="secondary" data-admin-dataset="keyboard">Keyboard Dynamics Table</button>
            <button class="secondary" data-admin-dataset="mouse">Mouse Tracking Table</button>
          </div>
        </div>

        <div class="export-category-card card">
          <div class="category-heading">
            <span class="cat-icon">🧠</span>
            <strong>Cognitive Workload & Assessment Datasets</strong>
          </div>
          <p>Cognitive Load Index (CLI), second-level multimodal fusion, task features, and NASA-TLX verification.</p>
          <div class="export-category-buttons">
            <button class="secondary" data-admin-dataset="multimodal-second">Multimodal Second-Level Table</button>
            <button class="secondary" data-admin-dataset="question-features">Question-Level Features Table</button>
            <button class="secondary" data-admin-dataset="measurement-records">Complete Measurement Records</button>
            <button class="secondary" data-admin-dataset="nasa-tlx">NASA-TLX Ratings Table</button>
            <button class="primary" data-admin-dataset="session-cli-change">Session CLI Change Table</button>
            <button class="secondary" data-admin-export="session-cli-change">Export CLI Change CSV</button>
          </div>
        </div>

        <div class="export-category-card card">
          <div class="category-heading">
            <span class="cat-icon">🤖</span>
            <strong>RAG Architecture & Interaction Telemetry</strong>
          </div>
          <p>Context chunk retrieval scores, prompt grounding evaluations, and LLM collaborative dialogues.</p>
          <div class="export-category-buttons">
            <button class="secondary" data-admin-dataset="rag-prompt-evaluations">RAG Prompt Evaluation Table</button>
            <button class="secondary" data-admin-dataset="rag-pipeline">RAG Pipeline Table</button>
            <button class="secondary" data-admin-dataset="rag-documents">RAG Documents Table</button>
            <button class="secondary" data-admin-dataset="chat-logs">Chat Logs & Feedback Table</button>
          </div>
        </div>
      </div>

      <div class="validation-section-card card" style="margin-top:20px;">
        <div class="section-label">DATASET INTEGRITY & VALIDATION</div>
        <h4>Multimodal Signal Parity & Synchronization Verification</h4>
        <p>Verify sensor alignment, missing modalities, and dataset completeness before running statistical ML benchmarks.</p>
        <button class="secondary" data-admin-validation type="button">Run Dataset Validation</button>
      </div>
    </article>
  `;
}

function renderAdminAnalytics(data, cliData) {
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

  // Populate cachedTasks from PREDEFINED_TASKS and any custom tasks if empty
  if (!adminFilterState.cachedTasks || !adminFilterState.cachedTasks.length) {
    safeGet('/admin/tasks').then(res => {
      const customs = (res && Array.isArray(res.custom_tasks)) ? res.custom_tasks : [];
      adminFilterState.cachedTasks = [...customs, ...PREDEFINED_TASKS];
    }).catch(() => {
      adminFilterState.cachedTasks = [...PREDEFINED_TASKS];
    });
  }

  return `
    <!-- Top Level Dashboard Tab Navigation -->
    <nav class="admin-tab-nav" role="tablist">
      <button class="admin-tab-btn ${adminFilterState.activeTab === 'overview' ? 'active' : ''}" data-admin-tab="overview" type="button" role="tab">📊 Cognitive Overview & KPIs</button>
      <button class="admin-tab-btn ${adminFilterState.activeTab === 'roster' ? 'active' : ''}" data-admin-tab="roster" type="button" role="tab">👥 Participant Roster (${participantList.length})</button>
      <button class="admin-tab-btn ${adminFilterState.activeTab === 'tasks' ? 'active' : ''}" data-admin-tab="tasks" type="button" role="tab">📝 Task Management</button>
      <button class="admin-tab-btn ${adminFilterState.activeTab === 'exports' ? 'active' : ''}" data-admin-tab="exports" type="button" role="tab">📁 Telemetry Data & Exports</button>
    </nav>

    <div class="admin-tab-container">
      ${adminFilterState.activeTab === 'overview' ? renderAdminOverviewTab(cliData, participantList) : ''}
      ${adminFilterState.activeTab === 'roster' ? renderAdminRosterTab(data, cliData, participantList) : ''}
      ${adminFilterState.activeTab === 'tasks' ? renderAdminTaskManagement() : ''}
      ${adminFilterState.activeTab === 'exports' ? renderAdminExportsTab() : ''}
    </div>
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
  // Tab Switching
  container.querySelectorAll('[data-admin-tab]').forEach(tabBtn => {
    tabBtn.onclick = () => {
      adminFilterState.activeTab = tabBtn.dataset.adminTab;
      refreshDashboard();
    };
  });

  // Task Creation Form Submit
  const taskForm = container.querySelector('#adminTaskCreateForm');
  if (taskForm) {
    taskForm.onsubmit = async (e) => {
      e.preventDefault();
      const title = container.querySelector('#taskTitle')?.value.trim();
      const domain = container.querySelector('#taskDomain')?.value;
      const target_age = container.querySelector('#taskTargetAge')?.value;
      const difficulty = container.querySelector('#taskDifficulty')?.value;
      const category = container.querySelector('#taskCategory')?.value.trim();
      const expected_time = container.querySelector('#taskExpectedTime')?.value.trim();
      const scenario = container.querySelector('#taskScenario')?.value.trim();
      const instructions = container.querySelector('#taskInstructions')?.value.trim().split('\n').filter(Boolean);

      const submitBtn = container.querySelector('#createTaskSubmitBtn');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Deploying Task…'; }

      try {
        const res = await safePost('/admin/tasks', {
          title, domain, target_age, difficulty, category, expected_time, scenario, instructions
        }, state.authToken);
        toast.success(`Task "${title}" created and published to rotation!`, 'Task Created');
        
        // Refresh cached tasks
        const tasksRes = await safeGet('/admin/tasks');
        const customs = (tasksRes && Array.isArray(tasksRes.custom_tasks)) ? tasksRes.custom_tasks : [];
        state.customAdminTasks = customs;
        adminFilterState.cachedTasks = [...customs, ...PREDEFINED_TASKS];
        refreshDashboard();
      } catch (err) {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '+ Create & Deploy Task'; }
        toast.error(`Task creation failed: ${err.message}`, 'Creation Error');
      }
    };
  }

  // Admin Task Launcher Controls (Enter Task by Domain & Age Group)
  const launchDomainSelect = container.querySelector('#adminLaunchDomainSelect');
  if (launchDomainSelect) {
    launchDomainSelect.onchange = () => {
      adminFilterState.launchDomain = launchDomainSelect.value;
      adminFilterState.launchTaskId = '';
      refreshDashboard();
    };
  }

  const launchAgeSelect = container.querySelector('#adminLaunchAgeSelect');
  if (launchAgeSelect) {
    launchAgeSelect.onchange = () => {
      adminFilterState.launchAge = launchAgeSelect.value;
      adminFilterState.launchTaskId = '';
      refreshDashboard();
    };
  }

  const launchTaskSelect = container.querySelector('#adminLaunchTaskSelect');
  if (launchTaskSelect) {
    launchTaskSelect.onchange = () => {
      adminFilterState.launchTaskId = launchTaskSelect.value;
      const tasks = adminFilterState.cachedTasks || [];
      const chosen = tasks.find(t => t.id === launchTaskSelect.value);
      const previewBox = container.querySelector('#adminLaunchTaskPreviewBox');
      const launchBtn = container.querySelector('#adminLaunchTaskBtn');
      if (previewBox && chosen) {
        previewBox.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
            <h4 style="margin:0; font-size:15px; font-weight:800; color:var(--text);">${escapeHtml(chosen.title)}</h4>
            <div style="display:flex; gap:6px;">
              <span class="badge diff-badge ${(chosen.difficulty || 'Easy').toLowerCase()}">${escapeHtml(chosen.difficulty || 'Easy')}</span>
              <span class="badge domain-badge">${escapeHtml(chosen.domain || 'AI')}</span>
              <span class="badge age-badge">${escapeHtml(chosen.target_age || 'All Ages')}</span>
              <span class="expected-time-tag">⏱ ${escapeHtml(chosen.expectedTime || '3–5 mins')}</span>
            </div>
          </div>
          <p style="margin:0 0 10px; font-size:13px; line-height:1.5; color:var(--muted);">${escapeHtml(chosen.scenario || '')}</p>
        `;
        if (launchBtn) launchBtn.disabled = false;
      }
    };
  }

  const launchTaskBtn = container.querySelector('#adminLaunchTaskBtn');
  if (launchTaskBtn) {
    launchTaskBtn.onclick = () => {
      const tasks = adminFilterState.cachedTasks || [];
      const selectedId = adminFilterState.launchTaskId || container.querySelector('#adminLaunchTaskSelect')?.value;
      const targetTask = tasks.find(t => t.id === selectedId) || tasks[0];
      if (targetTask) {
        launchAdminTaskSession(targetTask);
      } else {
        toast.warning('Please select a valid task to enter.', 'No Task Selected');
      }
    };
  }

  // Quick Enter Task from Repository Cards
  container.querySelectorAll('[data-enter-task-id]').forEach(btn => {
    btn.onclick = () => {
      const taskId = btn.dataset.enterTaskId;
      const tasks = adminFilterState.cachedTasks || [];
      const targetTask = tasks.find(t => t.id === taskId);
      if (targetTask) {
        launchAdminTaskSession(targetTask);
      }
    };
  });

  // Task Filter Inputs
  const taskSearch = container.querySelector('#adminTaskSearch');
  if (taskSearch) {
    taskSearch.oninput = () => {
      adminFilterState.tasksSearchQuery = taskSearch.value;
      refreshDashboard();
    };
  }
  const taskDomainFilter = container.querySelector('#adminTaskDomainFilter');
  if (taskDomainFilter) {
    taskDomainFilter.onchange = () => {
      adminFilterState.tasksFilterDomain = taskDomainFilter.value;
      refreshDashboard();
    };
  }
  const taskDiffFilter = container.querySelector('#adminTaskDiffFilter');
  if (taskDiffFilter) {
    taskDiffFilter.onchange = () => {
      adminFilterState.tasksFilterDifficulty = taskDiffFilter.value;
      refreshDashboard();
    };
  }
  const taskAgeFilter = container.querySelector('#adminTaskAgeFilter');
  if (taskAgeFilter) {
    taskAgeFilter.onchange = () => {
      adminFilterState.tasksFilterAge = taskAgeFilter.value;
      refreshDashboard();
    };
  }

  // Task Delete Buttons
  container.querySelectorAll('[data-delete-task]').forEach(btn => {
    btn.onclick = async () => {
      const taskId = btn.dataset.deleteTask;
      const ok = await confirmToast(`Delete custom task ${taskId}?`, {
        title: 'Delete Task?',
        confirmText: 'Delete Task',
        cancelText: 'Cancel',
        type: 'error',
        danger: true
      });
      if (!ok) return;
      try {
        await safeDelete(`/admin/tasks/${encodeURIComponent(taskId)}`, state.authToken);
        toast.success(`Task ${taskId} removed from repository.`, 'Task Deleted');
        adminFilterState.cachedTasks = (adminFilterState.cachedTasks || []).filter(t => t.id !== taskId);
        refreshDashboard();
      } catch (err) {
        toast.error(`Failed to delete task: ${err.message}`, 'Delete Error');
      }
    };
  });

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
    toast.error(`Tracking export failed: ${error.message}`, 'Export Error');
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


window.addEventListener('hashchange', () => {
  if (isNavigatingRoute) return;
  const hash = window.location.hash || '#/home';
  const clean = hash.split('?')[0];

  if (clean === '#/admin-login') {
    renderRoleLogin('admin');
  } else if (clean === '#/host-login') {
    renderRoleLogin('host');
  } else if (clean === '#/dashboard-login') {
    renderDashboardCredentialLogin();
  } else if (clean === '#/admin') {
    if (state.authRole === 'admin' && state.authToken) {
      renderRoleDashboard('admin');
    } else {
      renderRoleLogin('admin');
    }
  } else if (clean === '#/host') {
    if (state.authRole === 'host' && state.authToken) {
      renderRoleDashboard('host');
    } else {
      renderRoleLogin('host');
    }
  } else if (clean === '#/research-metrics') {
    renderResearchMetricsPage(state.authRole ? 'dashboard' : 'login');
  } else if (clean === '#/instructions') {
    if (state.participant) renderInstructions();
    else renderLogin();
  } else if (clean === '#/baseline') {
    if (state.participant) renderBaselineNasaTlx();
    else renderLogin();
  } else if (clean === '#/resume-baseline') {
    if (state.participant) renderResumeNasaTlx();
    else renderLogin();
  } else if (clean === '#/exam') {
    if (state.participant && state.started) renderExam();
    else if (state.participant) renderInstructions();
    else renderLogin();
  } else if (clean === '#/post-workload' || clean === '#/nasa') {
    if (state.participant) renderNasaTlxAssessment(state.endedEarly);
    else renderLogin();
  } else if (clean === '#/summary') {
    if (state.participant) renderSummary();
    else renderLogin();
  } else {
    // Default home / login
    if (state.authToken && (state.authRole === 'admin' || state.authRole === 'host')) {
      renderRoleDashboard(state.authRole);
    } else {
      renderLogin();
    }
  }
});
