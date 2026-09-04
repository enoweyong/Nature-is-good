// Express app entry point demonstrating the Cognito OIDC authentication flow.
//
//   npm run auth:start   (after setting COGNITO_CLIENT_SECRET)
//
// This is a standalone demo server — the static website under /website uses the
// Cognito Hosted UI directly (see website/js/auth.js), so it does not need this server.

const express = require('express');
const session = require('express-session');
const { initializeClient } = require('./openIdClient');
const { createSessionMiddleware, checkAuth } = require('./middleWare');
const { registerLoginRoutes } = require('./login');
const { registerLogoutRoute } = require('./logout');

async function main() {
    await initializeClient();

    const app = express();
    app.use(createSessionMiddleware(session));
    app.use(checkAuth);

    registerLoginRoutes(app);
    registerLogoutRoute(app);

    app.get('/', (req, res) => {
        const userInfo = req.session.userInfo;
        if (req.isAuthenticated && userInfo) {
            res.send(`<h1>Welcome, ${userInfo.email || userInfo.username}</h1><a href="/logout">Logout</a>`);
        } else {
            res.send('<h1>Amazon Cognito User Pool Demo</h1><p>Please log in to continue</p><a href="/login">Login</a>');
        }
    });

    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`Auth demo server listening on http://localhost:${port}`));
}

main().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
