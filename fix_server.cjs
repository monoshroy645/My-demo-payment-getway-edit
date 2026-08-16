const fs = require('fs');
let code = fs.readFileSync('server.cjs', 'utf8');

// Replace `app.get('/', serveIndex);` with the catch-all route if it's there
if (code.includes("app.get('/', serveIndex);")) {
  code = code.replace(
    "app.get('/', serveIndex);",
    "app.get('/', serveIndex);\napp.get('*all', (req, res, next) => {\n  if (req.path.startsWith('/api')) return next();\n  serveIndex(req, res);\n});"
  );
  fs.writeFileSync('server.cjs', code, 'utf8');
  console.log("Fixed serveIndex route.");
}
