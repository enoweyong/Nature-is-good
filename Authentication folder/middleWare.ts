// Auth middleware — mount in app.ts BEFORE the auth routes:
//   app.use(createSessionMiddleware(session));
//   app.use(checkAuth);

// Wraps express-session with safe cookie settings.
function createSessionMiddleware(session) {
    return session({
        secret: process.env.SESSION_SECRET || 'change-me-in-production',
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
    });
}

// Marks every request as authenticated/unauthenticated based on the session.
const checkAuth = (req, _res, next) => {
    req.isAuthenticated = Boolean(req.session && req.session.userInfo);
    next();
};

module.exports = { createSessionMiddleware, checkAuth };
