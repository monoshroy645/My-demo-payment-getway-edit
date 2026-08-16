const fs = require('fs');
let code = fs.readFileSync('server.cjs', 'utf8');

// Replace admin sdk imports
code = code.replace(
  "const { initializeApp, getApps } = require('firebase-admin/app');\nconst { getFirestore } = require('firebase-admin/firestore');\nconst firebaseConfig = require('./firebase-applet-config.json');\n\nif (!getApps().length) {\n  initializeApp({ projectId: firebaseConfig.projectId });\n}\nconst adminDb = getFirestore(firebaseConfig.firestoreDatabaseId);",
  "const { initializeApp, getApps } = require('firebase/app');\nconst { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } = require('firebase/firestore');\nconst firebaseConfig = require('./firebase-applet-config.json');\nlet app;\nif (!getApps().length) {\n  app = initializeApp(firebaseConfig);\n} else {\n  app = getApps()[0];\n}\nconst adminDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);"
);

// We need to replace the old replace from my previous fix, wait, the file already has `getApps` from admin?
// Let's just do a string replace on the whole block.
