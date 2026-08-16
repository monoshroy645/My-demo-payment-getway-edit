const fs = require('fs');
let code = fs.readFileSync('server.cjs', 'utf8');

code = code.replace(/onSnapshot\(collection\(adminDb, 'sessions'\), \(?snap => \{\n  const newSessions = \{\};\n  snap\.forEach\(doc => \{ newSessions\[doc\.id\] = doc\.data\(\); \}\);\n  sessions = newSessions;\n\}\);/g, `onSnapshot(collection(adminDb, 'sessions'), snap => {\n  const newSessions = {};\n  snap.forEach(doc => { newSessions[doc.id] = doc.data(); });\n  sessions = newSessions;\n});`);

code = code.replace(/onSnapshot\(collection\(adminDb, 'blocked_ips'\), \(?snap => \{\n  const newBlocked = \{\};\n  snap\.forEach\(doc => \{ newBlocked\[doc\.id\] = true; \}\);\n  blockedIps = newBlocked;\n\}\);/g, `onSnapshot(collection(adminDb, 'blocked_ips'), snap => {\n  const newBlocked = {};\n  snap.forEach(doc => { newBlocked[doc.id] = true; });\n  blockedIps = newBlocked;\n});`);

code = code.replace(/onSnapshot\(collection\(adminDb, 'settings'\), \(?snap => \{\n  const newSettings = \{\};\n  snap\.forEach\(doc => \{\n    const data = doc\.data\(\);\n    newSettings\[doc\.id\] = \('value' in data\) \? data\.value : data;\n  \}\);\n  settings = newSettings;\n\}\);/g, `onSnapshot(collection(adminDb, 'settings'), snap => {\n  const newSettings = {};\n  snap.forEach(doc => {\n    const data = doc.data();\n    newSettings[doc.id] = ('value' in data) ? data.value : data;\n  });\n  settings = newSettings;\n});`);

fs.writeFileSync('server.cjs', code, 'utf8');
