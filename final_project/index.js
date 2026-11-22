const express = require('express');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const customerRoutes = require('./router/auth_users.js').authenticated;
const generalRoutes = require('./router/general.js').general;

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-this-jwt-secret';

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Store a login session for routes under /customer.
app.use('/customer', session({
  secret: process.env.SESSION_SECRET || 'dev-only-change-this-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));

// Validate a signed token stored in the user's session.
app.use('/customer/auth', (req, res, next) => {
  const token = req.session && req.session.authorization && req.session.authorization.accessToken;
  if (!token) {
    return res.status(401).json({ message: 'Please log in to continue.' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.username) {
      return res.status(401).json({ message: 'Invalid session.' });
    }
    req.user = { username: decoded.username };
    next();
  } catch (_err) {
    return res.status(401).json({ message: 'Session expired or invalid.' });
  }
});

app.use('/customer', customerRoutes);
app.use('/', generalRoutes);

if (require.main === module) {
  app.listen(PORT, () => console.log('Server is running on port ' + PORT));
}
module.exports = { app };
