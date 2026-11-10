const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES = ['queued', 'awaiting_approval', 'running', 'completed', 'blocked'];
const TRANSITIONS = {
  queued: ['running', 'blocked'],
  awaiting_approval: ['queued', 'blocked'],
  running: ['completed', 'blocked'],
  completed: [],
  blocked: ['queued']
};

export function canTransition(from, to) {
  if (!STATES.includes(from) || !STATES.includes(to)) return false;
  return TRANSITIONS[from].includes(to);
}

export function nextState(from, to) {
  if (!canTransition(from, to)) {
    throw new Error(`ILLEGAL_TRANSITION:${from}->${to}`);
  }
  return to;
}

export function summarizeWork(items) {
  if (!Array.isArray(items)) throw new Error('INVALID_INPUT');
  const counts = Object.fromEntries(STATES.map((s) => [s, 0]));
  let invalid = 0;
  for (const item of items) {
    if (!item || typeof item !== 'object' || !UUID.test(item.id || '') || !STATES.includes(item.state)) {
      invalid += 1;
      continue;
    }
    counts[item.state] += 1;
  }
  const total = items.length;
  const valid = total - invalid;
  return {
    total,
    valid,
    invalid,
    counts,
    completionRate: valid ? Number((counts.completed / valid).toFixed(4)) : null,
    blockedRate: valid ? Number((counts.blocked / valid).toFixed(4)) : null
  };
}
