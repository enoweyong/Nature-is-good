// OpenID Connect client setup for Amazon Cognito (Express app).
// Initialises openid-client and exports accessors for the client.
// NOTE: set COGNITO_CLIENT_SECRET as an environment variable â€” never hard-code secrets.

const { Issuer, generators } = require('openid-client');

const COGNITO_ISSUER = 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_JiVQS1LFL';
const CLIENT_ID = '3fopp6mvmo1bu0p0scj98pt5lh';
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET || '<client secret>';
const REDIRECT_URIS = ['https://staging.d223r5v71x29qb.amplifyapp.com/'];
const RESPONSE_TYPES = ['code'];

let client: any = null;

async function initializeClient(): Promise<void> {
    const issuer = await Issuer.discover(COGNITO_ISSUER);
    client = new issuer.Client({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uris: REDIRECT_URIS,
        response_types: RESPONSE_TYPES,
    });
    console.log('OpenID client initialised for issuer:', COGNITO_ISSUER);
}

function getClient(): any {
    if (!client) throw new Error('OpenID client not initialised. Call initializeClient() first.');
    return client;
}

function newAuthState() {
    return { nonce: generators.nonce(), state: generators.state() };
}

module.exports = { initializeClient, getClient, newAuthState, CLIENT_ID, COGNITO_ISSUER };

