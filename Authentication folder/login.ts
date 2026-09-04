// Login / callback routes for the Cognito OIDC flow.
// Wire into app.ts:  registerLoginRoutes(app);
const { getClient, newAuthState } = require('./openIdClient');

// Helper: "http://localhost/hello" -> "/hello"
function getPathFromURL(urlString) {
    try {
        return new URL(urlString).pathname;
    } catch (error) {
        console.error('Invalid URL:', error);
        return null;
    }
}

function registerLoginRoutes(app) {
    // Kicks off the Authorization Code flow.
    app.get('/login', (req, res) => {
        const { nonce, state } = newAuthState();
        req.session.nonce = nonce;
        req.session.state = state;

        const authUrl = getClient().authorizationUrl({
            scope: 'phone openid email',
            state: state,
            nonce: nonce,
        });
        res.redirect(authUrl);
    });

    // OIDC redirect URI — must match the app client's callback URL.
    const callbackPath = getPathFromURL('https://staging.d223r5v71x29qb.amplifyapp.com/') || '/';
    app.get(callbackPath, async (req, res) => {
        try {
            const client = getClient();
            const params = client.callbackParams(req);
            const tokenSet = await client.callback(
                'https://staging.d223r5v71x29qb.amplifyapp.com/',
                params,
                { nonce: req.session.nonce, state: req.session.state }
            );

            req.session.userInfo = await client.userinfo(tokenSet.access_token);
            delete req.session.nonce;
            delete req.session.state;
            res.redirect('/');
        } catch (err) {
            console.error('Callback error:', err);
            res.redirect('/');
        }
    });
}

module.exports = { registerLoginRoutes, getPathFromURL };
