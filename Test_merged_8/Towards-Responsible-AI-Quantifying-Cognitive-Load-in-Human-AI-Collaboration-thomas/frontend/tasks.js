/**
 * CogniTrack AI - Predefined Dynamic Tasks Repository
 * 20 Tasks across 5 Domains (AI, CS, Data Science, Software Dev, Cross-Disciplinary)
 * and 3 Complexity Levels (Easy, Medium, Hard) tailored for Human-AI Collaboration Research.
 */

export const PREDEFINED_TASKS = [
  // ==========================================
  // ARTIFICIAL INTELLIGENCE & LLM ENGINEERING
  // ==========================================
  {
    id: 'TASK-AI-01',
    domain: 'Artificial Intelligence',
    difficulty: 'Easy',
    category: 'Prompt Engineering',
    expectedTime: '3–5 minutes',
    title: 'Prompt Strategy for Deterministic JSON Extraction',
    scenario: 'You are building an automated pipeline where an LLM extracts structured incident metadata (incident_id, severity, root_cause, affected_services) from messy user outage reports. In production, models often add conversational preamble (e.g., "Here is your JSON:") or enclose outputs in unescaped Markdown backticks, breaking downstream microservice parsers.',
    instructions: [
      'Ask the AI assistant to formulate a bulletproof system prompt and configuration (e.g., temperature setting, zero-shot vs few-shot schema injection) to enforce raw, deterministic JSON output.',
      'Explore how parameter choices (temperature 0.0 vs 0.3) and defensive prompt rules prevent conversational filler and Markdown fences.',
      'Evaluate whether prompt design alone is completely reliable or if programmatic constrained decoding (JSON Mode / grammar enforcement) is mandatory.'
    ]
  },
  {
    id: 'TASK-AI-02',
    domain: 'Artificial Intelligence',
    difficulty: 'Medium',
    category: 'RAG Architecture',
    expectedTime: '4–6 minutes',
    title: 'Mitigating Hallucinations in RAG Context Retrieval',
    scenario: 'A Retrieval-Augmented Generation (RAG) assistant for legal compliance occasionally generates plausible-sounding but completely fabricated clause interpretations. The vector search retrieves top-k chunks by cosine similarity, but irrelevant context distracts the generator.',
    instructions: [
      'Ask the AI assistant to analyze why naive vector similarity fails in dense domain corpora and how semantic reranking (cross-encoders) helps.',
      'Request strategies for chunking trade-offs (hierarchical chunking vs sentence-window retrieval) and citation grounding prompts.',
      'Critique the AI-proposed solution: does it effectively balance retrieval latency against hallucination risk?'
    ]
  },
  {
    id: 'TASK-AI-03',
    domain: 'Artificial Intelligence',
    difficulty: 'Hard',
    category: 'Model Alignment',
    expectedTime: '5–7 minutes',
    title: 'RLHF vs. Direct Preference Optimization (DPO) Trade-offs',
    scenario: 'An AI engineering team is fine-tuning a proprietary code generation model. They are debating whether to implement Reinforcement Learning from Human Feedback (PPO-based RLHF with a reward model) or Direct Preference Optimization (DPO). Compute resource constraints and reward hacking are major concerns.',
    instructions: [
      'Ask the AI assistant to contrast PPO-based RLHF and DPO regarding mathematical foundations, memory overhead, training stability, and likelihood of policy drift.',
      'Inquire about practical failure modes where DPO underperforms PPO (e.g., out-of-distribution prompts, mode collapse).',
      'Assess the assistant\'s recommendation and determine which alignment method best fits a resource-constrained production team.'
    ]
  },
  {
    id: 'TASK-AI-04',
    domain: 'Artificial Intelligence',
    difficulty: 'Hard',
    category: 'LLM Evaluation',
    expectedTime: '5–7 minutes',
    title: 'Context Window Degradation & Needle-in-a-Haystack Limits',
    scenario: 'A financial analytics engine passes 100k+ tokens of quarterly filings into a 128k-context LLM. Despite fitting within the theoretical limit, the model consistently fails to recall critical audit footnotes buried in the middle 40%–60% of the document (the "Lost in the Middle" phenomenon).',
    instructions: [
      'Ask the AI assistant to explain the architectural cause of attention dispersion and position embedding decay in long-context Transformers.',
      'Request mitigation techniques (e.g., document sorting, prompt placement strategies, multi-pass summarization, KV cache compression).',
      'Evaluate whether expanding context windows eliminates the need for intelligent chunking and retrieval.'
    ]
  },

  // ==========================================
  // COMPUTER SCIENCE & ALGORITHMS
  // ==========================================
  {
    id: 'TASK-CS-01',
    domain: 'Computer Science',
    difficulty: 'Easy',
    category: 'Data Structures',
    expectedTime: '3–5 minutes',
    title: 'Time-Space Trade-offs in Hash Map Lookups',
    scenario: 'A high-frequency metrics collector uses in-memory hash tables for key-value telemetry. Under peak workloads, p99 lookup latency spikes drastically due to hash collisions and dynamic bucket array resizing.',
    instructions: [
      'Ask the AI assistant to analyze the trade-offs between separate chaining vs open addressing (linear probing, robin hood hashing) under high load factors.',
      'Explore how pre-sizing buckets and selecting hash functions (Murmur3 vs SipHash) protect against worst-case O(N) degradation and Hash DoS attacks.',
      'Review the AI\'s proposed optimization and assess how it maintains constant O(1) amortized lookup guarantees.'
    ]
  },
  {
    id: 'TASK-CS-02',
    domain: 'Computer Science',
    difficulty: 'Medium',
    category: 'Concurrency',
    expectedTime: '4–6 minutes',
    title: 'Diagnosing Deadlocks in Multi-Threaded Resource Pools',
    scenario: 'A transaction processing system transfers assets between user wallets concurrently. Under stress testing, worker threads intermittently hang indefinitely. Thread dumps reveal two threads blocked acquiring locks in circular order: Thread 1 holds Wallet A and waits for Wallet B; Thread 2 holds Wallet B and waits for Wallet A.',
    instructions: [
      'Ask the AI assistant to identify the four Coffman conditions present in this system and explain how global lock ordering prevents circular wait.',
      'Ask for alternative non-blocking or lock-ordering implementations (e.g., ordering by unique account ID, tryLock with randomized exponential backoff).',
      'Evaluate whether lock ordering alone handles multi-account batch settlements or if transactional two-phase locking is necessary.'
    ]
  },
  {
    id: 'TASK-CS-03',
    domain: 'Computer Science',
    difficulty: 'Hard',
    category: 'Distributed Systems',
    expectedTime: '5–7 minutes',
    title: 'Raft vs. Paxos Distributed Consensus Failure Modes',
    scenario: 'A distributed database coordinator must guarantee linearizable consistency across three geographic regions. During network partitions (split-brain scenarios), transient leader elections cause client request timeouts and phantom reads.',
    instructions: [
      'Ask the AI assistant to explain how Raft\'s strong leader invariant simplifies consensus compared to Paxos, and how joint consensus handles membership changes.',
      'Explore how network asymmetric partitions (e.g., Leader can reach Node B but not Node C) trigger destabilizing election loops and how Pre-Vote phases resolve this.',
      'Evaluate the proposed consensus configuration against the CAP and PACELC theorems for financial transaction guarantees.'
    ]
  },
  {
    id: 'TASK-CS-04',
    domain: 'Computer Science',
    difficulty: 'Hard',
    category: 'Runtime Internals',
    expectedTime: '5–7 minutes',
    title: 'Memory Leak Detection in Asynchronous Event Loops',
    scenario: 'A Node.js / Python asyncio microservice consumes 15 MB of additional RAM per hour until triggering an Out-Of-Memory (OOM) kill. Heap dumps indicate millions of lingering callback closures and uncleaned event emitter listeners.',
    instructions: [
      'Ask the AI assistant to explain how cyclic references inside long-lived closures prevent generational garbage collectors from freeing completed task contexts.',
      'Ask for diagnostic strategies (e.g., inspecting heap snapshots, tracking WeakRef collections, identifying detached DOM/emitter references).',
      'Critique the AI-suggested refactoring to ensure async task handles and abort signals detach cleanly upon completion.'
    ]
  },

  // ==========================================
  // DATA SCIENCE & MACHINE LEARNING
  // ==========================================
  {
    id: 'TASK-DS-01',
    domain: 'Data Science',
    difficulty: 'Easy',
    category: 'Data Preprocessing',
    expectedTime: '3–5 minutes',
    title: 'Handling Missing Values & Imputation Bias in Tabular Data',
    scenario: 'A clinical study dataset of 50,000 patients contains 18% missing entries in laboratory biomarker fields. The engineering team simply imputed missing values with column means, which inadvertently compressed variance and distorted correlation coefficients.',
    instructions: [
      'Ask the AI assistant to compare the statistical risks of mean/median imputation against iterative MICE (Multivariate Imputation by Chained Equations) and KNN imputation.',
      'Explore how the Missing Completely at Random (MCAR), Missing at Random (MAR), and Missing Not at Random (MNAR) frameworks dictate correct preprocessing.',
      'Review the recommended imputation pipeline and assess whether adding binary "was_missing" indicator flags improves predictive fidelity.'
    ]
  },
  {
    id: 'TASK-DS-02',
    domain: 'Data Science',
    difficulty: 'Medium',
    category: 'Classification',
    expectedTime: '4–6 minutes',
    title: 'Class Imbalance Strategies in Credit Fraud Detection',
    scenario: 'A credit card fraud model trains on 1,000,000 transactions where only 0.05% (500 cases) represent fraudulent charges. A standard XGBoost classifier achieves 99.95% accuracy by classifying every transaction as legitimate, which is disastrous for production.',
    instructions: [
      'Ask the AI assistant to critique why standard Accuracy is misleading, and how Precision-Recall AUC (PR-AUC), F-beta, and cost-matrix evaluation should be used.',
      'Compare algorithmic balancing techniques (Focal Loss, scale_pos_weight in XGBoost) versus synthetic resampling (SMOTE, ADASYN) in high-dimensional feature spaces.',
      'Assess the trade-off: does synthetic oversampling introduce artificial feature correlations in credit risk domains?'
    ]
  },
  {
    id: 'TASK-DS-03',
    domain: 'Data Science',
    difficulty: 'Medium',
    category: 'MLOps & Drift',
    expectedTime: '4–6 minutes',
    title: 'Detecting Concept Drift in Production Telemetry',
    scenario: 'An e-commerce recommendation system trained on pre-holiday behavior experiences a 25% drop in conversion rate during summer sales. Feature distributions have shifted (covariate shift) and user purchasing behaviors have changed (concept drift).',
    instructions: [
      'Ask the AI assistant to contrast statistical drift detection methods: Kolmogorov-Smirnov (KS) tests, Population Stability Index (PSI), and Wasserstein Distance.',
      'Explore how to differentiate benign seasonal distribution shifts from adversarial or permanent concept drift.',
      'Review the automated retraining architecture proposed by the AI: does it prevent catastrophic forgetting while adapting to new consumer patterns?'
    ]
  },
  {
    id: 'TASK-DS-04',
    domain: 'Data Science',
    difficulty: 'Hard',
    category: 'Model Interpretability',
    expectedTime: '5–7 minutes',
    title: 'High-Dimensional Multicollinearity & SHAP Regularization',
    scenario: 'A loan underwriting model uses 150 correlated financial and demographic features. When calculating TreeSHAP values for compliance auditing, highly collinear variables (e.g., annual income, tax bracket, debt-to-income) produce unstable, counter-intuitive attribution weights.',
    instructions: [
      'Ask the AI assistant to explain why Shapley value additivity produces split credit across collinear features and how Variance Inflation Factor (VIF) interacts with tree splits.',
      'Inquire about advanced attribution methods (e.g., Grouped SHAP, hierarchical clustering feature pruning, Partial Dependence Plots).',
      'Evaluate whether pruning correlated features harms model accuracy or improves regulatory transparency and model robustness.'
    ]
  },

  // ==========================================
  // SOFTWARE DEVELOPMENT & ARCHITECTURE
  // ==========================================
  {
    id: 'TASK-SE-01',
    domain: 'Software Development',
    difficulty: 'Easy',
    category: 'API Design',
    expectedTime: '3–5 minutes',
    title: 'RESTful API Versioning & Breaking Change Policies',
    scenario: 'A core platform API serving 200+ enterprise mobile and web clients needs to restructure its user payload schema. Modifying the existing endpoint directly will immediately break legacy mobile applications that cannot be forcefully updated.',
    instructions: [
      'Ask the AI assistant to evaluate URI path versioning (/v1/users vs /v2/users), Header-based versioning (Accept: application/vnd.app.v2+json), and query parameter versioning.',
      'Explore contract evolution best practices (e.g., additive changes, semantic deprecation headers, sunset policies).',
      'Determine which strategy provides the cleanest backwards compatibility with minimal caching disruption at CDN layers.'
    ]
  },
  {
    id: 'TASK-SE-02',
    domain: 'Software Development',
    difficulty: 'Medium',
    category: 'System Architecture',
    expectedTime: '4–6 minutes',
    title: 'Migrating Monoliths to Asynchronous Event-Driven Architecture',
    scenario: 'An order processing monolith executes payment processing, inventory reservation, receipt emailing, and shipping notifications sequentially in a single HTTP request. An error in the external shipping API rolls back successful payments, causing severe customer friction.',
    instructions: [
      'Ask the AI assistant to design an Event-Driven architecture using the Transactional Outbox Pattern and a message broker (e.g., Kafka or RabbitMQ).',
      'Explore idempotency keys and at-least-once delivery guarantees to ensure customer credit cards are never double-charged during broker retries.',
      'Evaluate the architectural complexity: how do distributed transactions handle eventual consistency compared to ACID database guarantees?'
    ]
  },
  {
    id: 'TASK-SE-03',
    domain: 'Software Development',
    difficulty: 'Medium',
    category: 'Resilience Engineering',
    expectedTime: '4–6 minutes',
    title: 'Microservice Circuit Breakers & Fallback Cascades',
    scenario: 'During a flash sale, an internal recommendation service suffers severe latency degradation (p99 > 8 seconds). Upstream frontend API gateways keep queuing requests until thread pools saturate, causing total platform failure (cascading failure).',
    instructions: [
      'Ask the AI assistant to explain the three states of the Circuit Breaker pattern (Closed, Open, Half-Open) and sliding-window failure rate thresholds.',
      'Request concrete fallback strategies (e.g., returning cached static recommendations, graceful feature degradation).',
      'Critique the AI\'s proposed retry and timeout policies to ensure upstream systems do not inadvertently trigger self-inflicted Denial of Service.'
    ]
  },
  {
    id: 'TASK-SE-04',
    domain: 'Software Development',
    difficulty: 'Hard',
    category: 'Database Systems',
    expectedTime: '5–7 minutes',
    title: 'Zero-Downtime Database Schema Migration for High-Write Tables',
    scenario: 'A PostgreSQL production database handles 10,000 writes/second on an orders table with 500 million records. The team needs to rename a column and convert an integer status field into an indexed enumerated type without locking the table or causing downtime.',
    instructions: [
      'Ask the AI assistant to formulate the Expand-and-Contract (Parallel Run) migration pattern across distinct deployment phases.',
      'Explore how non-blocking index creation (CREATE INDEX CONCURRENTLY), backfill batching, and dual-writing triggers prevent exclusive table locks.',
      'Evaluate how to handle rollback procedures if an application bug is discovered mid-migration.'
    ]
  },

  // ==========================================
  // CROSS-DISCIPLINARY & COGNITIVE REASONING
  // ==========================================
  {
    id: 'TASK-CD-01',
    domain: 'Cross-Disciplinary',
    difficulty: 'Easy',
    category: 'Technical Communication',
    expectedTime: '3–5 minutes',
    title: 'Incident Root-Cause Analysis & Executive Summarization',
    scenario: 'A critical payment gateway outage lasted 47 minutes during market hours. The technical post-mortem contains complex networking logs, BGP routing flap traces, and database deadlocks. Non-technical executive leadership needs an unambiguous, blame-free post-mortem brief.',
    instructions: [
      'Ask the AI assistant to distill the technical incident into an executive summary containing: Business Impact, Root Cause, Immediate Containment, and Long-Term Preventative Measures.',
      'Prompt the assistant to eliminate technical jargon while maintaining absolute precision regarding SLA violations and financial impact.',
      'Review the generated brief and assess whether it provides appropriate executive confidence without obscuring systemic technical debt.'
    ]
  },
  {
    id: 'TASK-CD-02',
    domain: 'Cross-Disciplinary',
    difficulty: 'Medium',
    category: 'Security & Systems',
    expectedTime: '4–6 minutes',
    title: 'Latency vs. Security in Zero-Trust API Edge Gateways',
    scenario: 'An enterprise microservices platform implements Zero-Trust Architecture by enforcing mutual TLS (mTLS) and fine-grained Open Policy Agent (OPA) JWT validation on every intra-cluster RPC call. High-frequency microservices report an unacceptable 18ms latency overhead per hop.',
    instructions: [
      'Ask the AI assistant to analyze the CPU and latency overhead of cryptographic handshakes and token verification across distributed hops.',
      'Explore architectural compromises (e.g., session resumption, eBPF network acceleration, service mesh sidecar caching, tiered trust boundaries).',
      'Critique the trade-off: can cryptographic zero-trust guarantees be preserved without compounding latency across deep microservice dependency trees?'
    ]
  },
  {
    id: 'TASK-CD-03',
    domain: 'Cross-Disciplinary',
    difficulty: 'Hard',
    category: 'Quantitative Reasoning',
    expectedTime: '5–7 minutes',
    title: 'Optimizing Resource Allocation Under Queue Saturation',
    scenario: 'A cloud computing batch cluster processes asynchronous image rendering jobs. Arrival rate follows a Poisson distribution, but service time experiences high variance. Under 85% cluster utilization, queue lengths explode exponentially, causing severe SLA breaches.',
    instructions: [
      'Ask the AI assistant to apply Little\'s Law and M/M/k vs M/G/1 queuing theory models to explain why queue wait times spike non-linearly near saturation.',
      'Explore capacity planning strategies: load shedding, weighted fair queuing, speculative execution, and dynamic auto-scaling thresholds.',
      'Evaluate the assistant\'s mathematical reasoning: what is the optimal target utilization that maximizes compute ROI while guarding against queuing blow-up?'
    ]
  },
  {
    id: 'TASK-CD-04',
    domain: 'Cross-Disciplinary',
    difficulty: 'Medium',
    category: 'Ethics & Governance',
    expectedTime: '4–6 minutes',
    title: 'Algorithmic Fairness & Disparate Impact Auditing',
    scenario: 'An automated resume screening tool uses machine learning to score engineering job applicants. An internal audit reveals that while the model does not explicitly use protected demographic attributes, proxy variables (e.g., extracurricular clubs, university graduation year) produce disparate impact ratios below the legal 80% threshold.',
    instructions: [
      'Ask the AI assistant to explain disparate impact analysis (the 4/5ths rule) and the mathematical tension between Demographic Parity and Equalized Odds.',
      'Ask for remediation strategies: pre-processing (reweighing data), in-processing (adversarial debiasing), and post-processing (threshold adjustment).',
      'Assess whether debiasing techniques reduce predictive performance on technical competency, and how to defend the model to compliance regulators.'
    ]
  }
];

/**
 * Dynamic Task Selector
 * Selects exactly 6 tasks tailored to the participant's Domain and AI Familiarity level.
 *
 * @param {Object} participant - Participant profile { domain, ai_familiarity }
 * @returns {Array} Array of 6 matched tasks ordered with a progressive cognitive curve.
 */
export function selectSessionTasks(participant = {}) {
  const rawDomain = String(participant.domain || '').trim().toLowerCase();
  const rawLevel = String(participant.ai_familiarity || '').trim().toLowerCase();

  // Normalize Domain
  let targetDomain = 'Cross-Disciplinary';
  if (rawDomain.includes('artificial') || rawDomain.includes('intelligence') || rawDomain === 'ai') {
    targetDomain = 'Artificial Intelligence';
  } else if (rawDomain.includes('computer') || rawDomain.includes('cs')) {
    targetDomain = 'Computer Science';
  } else if (rawDomain.includes('data')) {
    targetDomain = 'Data Science';
  } else if (rawDomain.includes('software') || rawDomain.includes('development') || rawDomain.includes('engineering')) {
    targetDomain = 'Software Development';
  }

  // Normalize Complexity Track: Beginner | Intermediate | Advanced
  let track = 'intermediate';
  if (rawLevel.includes('begin') || rawLevel.includes('novice') || rawLevel.includes('low')) {
    track = 'beginner';
  } else if (rawLevel.includes('adv') || rawLevel.includes('expert') || rawLevel.includes('high')) {
    track = 'advanced';
  }

  // Complexity quotas for the 6 tasks:
  // Beginner: 3 Easy, 2 Medium, 1 Hard
  // Intermediate: 1 Easy, 3 Medium, 2 Hard
  // Advanced: 1 Easy, 2 Medium, 3 Hard
  const quota = track === 'beginner'
    ? { Easy: 3, Medium: 2, Hard: 1 }
    : track === 'advanced'
    ? { Easy: 1, Medium: 2, Hard: 3 }
    : { Easy: 1, Medium: 3, Hard: 2 };

  // Separate tasks into candidate buckets
  const domainTasks = PREDEFINED_TASKS.filter(t => t.domain === targetDomain);
  const otherTasks = PREDEFINED_TASKS.filter(t => t.domain !== targetDomain);

  // Group by difficulty
  const candidatesByDiff = {
    Easy: [...domainTasks.filter(t => t.difficulty === 'Easy'), ...otherTasks.filter(t => t.difficulty === 'Easy')],
    Medium: [...domainTasks.filter(t => t.difficulty === 'Medium'), ...otherTasks.filter(t => t.difficulty === 'Medium')],
    Hard: [...domainTasks.filter(t => t.difficulty === 'Hard'), ...otherTasks.filter(t => t.difficulty === 'Hard')],
  };

  const selected = [];
  const selectedIds = new Set();

  // Select according to difficulty quota
  for (const [diff, countNeeded] of Object.entries(quota)) {
    let collected = 0;
    const pool = candidatesByDiff[diff] || [];
    for (const task of pool) {
      if (!selectedIds.has(task.id) && collected < countNeeded) {
        selected.push(task);
        selectedIds.add(task.id);
        collected++;
      }
    }
  }

  // Fallback to guarantee exactly 6 unique tasks
  if (selected.length < 6) {
    for (const task of PREDEFINED_TASKS) {
      if (!selectedIds.has(task.id) && selected.length < 6) {
        selected.push(task);
        selectedIds.add(task.id);
      }
    }
  }

  // Sort tasks to create a progressive cognitive load curve: Easy -> Medium -> Hard
  const diffOrder = { Easy: 1, Medium: 2, Hard: 3 };
  selected.sort((a, b) => (diffOrder[a.difficulty] || 2) - (diffOrder[b.difficulty] || 2));

  // Format tasks into assessment questions
  return selected.slice(0, 6).map((task, idx) => {
    const taskNum = idx + 1;
    return {
      id: task.id,
      topicId: `TASK-${taskNum}`,
      taskNumber: taskNum,
      title: task.title,
      domain: task.domain,
      difficulty: task.difficulty,
      category: task.category,
      expectedTime: task.expectedTime,
      questionPart: `Task ${taskNum} of 6`,
      scenario: task.scenario,
      instructions: task.instructions,
      text: `${task.scenario}\n\nTask Focus:\n${task.instructions.map((ins, i) => `${i + 1}. ${ins}`).join('\n')}`,
      topic: `${task.category}: ${task.title}`
    };
  });
}
