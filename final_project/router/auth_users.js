const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const books = require('./booksdb.js');
const regd_users = express.Router();
const users = [];
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-this-jwt-secret';

const isValid = (username) => users.some(user => user.username === username);
const hashPassword = (password, salt) =>
  crypto.scryptSync(password, salt, 64).toString('hex');

const authenticatedUser = (username, password) => {
  const user = users.find(item => item.username === username);
  if (!user || typeof password !== 'string') return false;
  const attempt = Buffer.from(hashPassword(password, user.salt), 'hex');
  const expected = Buffer.from(user.passwordHash, 'hex');
  return attempt.length === expected.length &&
    crypto.timingSafeEqual(attempt, expected);
};

const addUser = (username, password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  users.push({ username, salt, passwordHash: hashPassword(password, salt) });
};

// Task 7: Log in and save a signed JWT in the session.
regd_users.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' ||
      !username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }
  if (!authenticatedUser(username, password)) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
  req.session.authorization = { accessToken: token, username };
  return res.json({ message: 'User successfully logged in.' });
});

// Task 8: Add or replace the logged-in user's review.
regd_users.put('/auth/review/:isbn', (req, res) => {
  const isbn = req.params.isbn;
  if (!Object.prototype.hasOwnProperty.call(books, isbn)) {
    return res.status(404).json({ message: 'Book not found.' });
  }
  const review = req.query.review !== undefined ? req.query.review : (req.body && req.body.review);
  if (typeof review !== 'string' || !review.trim()) {
    return res.status(400).json({ message: 'A non-empty review is required.' });
  }
  books[isbn].reviews[req.user.username] = review.trim();
  return res.json({
    message: 'Review added or updated successfully.',
    reviews: books[isbn].reviews
  });
});

// Task 9: Delete only the signed-in user's own review.
regd_users.delete('/auth/review/:isbn', (req, res) => {
  const isbn = req.params.isbn;
  if (!Object.prototype.hasOwnProperty.call(books, isbn)) {
    return res.status(404).json({ message: 'Book not found.' });
  }
  const username = req.user.username;
  if (!Object.prototype.hasOwnProperty.call(books[isbn].reviews, username)) {
    return res.status(404).json({ message: 'You have no review for this book.' });
  }
  delete books[isbn].reviews[username];
  return res.json({ message: 'Review deleted successfully.', reviews: books[isbn].reviews });
});

module.exports = {
  authenticated: regd_users,
  isValid,
  authenticatedUser,
  addUser,
  users
};
