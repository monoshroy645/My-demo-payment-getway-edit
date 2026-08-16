const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const config = require('./firebase-applet-config.json');

initializeApp({
  credential: applicationDefault(),
  projectId: config.projectId
});
const db = getFirestore('(default)');

async function run() {
  try {
    await db.collection('test').doc('doc').set({ hello: 'world' });
    console.log('Success (default)!');
  } catch(e) {
    console.error('Error:', e);
  }
}
run();
