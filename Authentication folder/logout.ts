// Logout route — destroys the local session and signs the user out of the
// Cognito Hosted UI, returning them to the app afterwards.
// Wire into app.ts:  registerLogoutRoute(app);
const { CLIENT_ID } = require('./openIdClient');

// Set your Cognito Hosted UI domain, e.g. https://us-east-1jivqs1lfl.auth.us-east-1.amazoncognito.com
const COGNITO_DOMAIN = process.env.COGNITO_DOMAIN || 'https://us-east-1jivqs1lfl.auth.us-east-1.amazoncognito.com';
const LOGOUT_URI = process.env.LOGOUT_URI || 'https://staging.d223r5v71x29qb.amplifyapp.com/';

function buildLogoutUrl() {
    return `${COGNITO_DOMAIN}/logout?client_id=${encodeURIComponent(CLIENT_ID)}&logout_uri=${encodeURIComponent(LOGOUT_URI)}`;
}

function registerLogoutRoute(app) {
    app.get('/logout', (req, res) => {
        req.session.destroy(() => {
            res.redirect(buildLogoutUrl());
        });
    });
}

module.exports = { registerLogoutRoute, buildLogoutUrl };
