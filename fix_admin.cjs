const fs = require('fs');
let code = fs.readFileSync('server.cjs', 'utf8');

code = code.replace(
  "const admin = require('firebase-admin');",
  "const { initializeApp, getApps } = require('firebase-admin/app');\nconst { getFirestore } = require('firebase-admin/firestore');"
);

code = code.replace(
  "if (!admin.apps.length) {\n  admin.initializeApp({ projectId: firebaseConfig.projectId });\n}\nconst adminDb = admin.firestore();",
  "if (!getApps().length) {\n  initializeApp({ projectId: firebaseConfig.projectId });\n}\nconst adminDb = getFirestore(firebaseConfig.firestoreDatabaseId);"
);

fs.writeFileSync('server.cjs', code, 'utf8');
