const express = require('express');
const axios = require('axios');
const books = require('./booksdb.js');
const { isValid, addUser } = require('./auth_users.js');
const public_users = express.Router();

// Task 6: New user registration with input and duplicate checks.
public_users.post('/register', (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' ||
      !username.trim() || !password.trim()) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }
  if (isValid(username)) {
    return res.status(409).json({ message: 'Username already exists.' });
  }
  addUser(username, password);
  return res.status(201).json({ message: 'User registered successfully.' });
});

// Task 1: Catalog; Task 2: ISBN.
public_users.get('/', (req, res) => res.json(books));
public_users.get('/isbn/:isbn', (req, res) => {
  const isbn = req.params.isbn;
  if (!Object.prototype.hasOwnProperty.call(books, isbn)) {
    return res.status(404).json({ message: 'Book not found.' });
  }
  return res.json(books[isbn]);
});

// Tasks 3 and 4: Search by author or title.
const matchingBooks = (field, value) => Object.fromEntries(
  Object.entries(books).filter(([, book]) =>
    book[field].toLowerCase() === value.toLowerCase())
);
public_users.get('/author/:author', (req, res) =>
  res.json(matchingBooks('author', req.params.author))
);
public_users.get('/title/:title', (req, res) =>
  res.json(matchingBooks('title', req.params.title))
);

// Task 5: Reviews for one book.
public_users.get('/review/:isbn', (req, res) => {
  const isbn = req.params.isbn;
  if (!Object.prototype.hasOwnProperty.call(books, isbn)) {
    return res.status(404).json({ message: 'Book not found.' });
  }
  return res.json(books[isbn].reviews);
});

// Tasks 10–13: Independent Async/Await functions with Axios.
// The API is queried locally so this example works without an external service.
const localApiUrl = () => 'http://127.0.0.1:' + (Number(process.env.PORT) || 5000);
const axiosOptions = { proxy: false, timeout: 5000 };

const getAllBooksAsync = async () => {
  const response = await axios.get(localApiUrl() + '/', axiosOptions);
  return response.data;
};
const getBookByISBNAsync = async (isbn) => {
  const response = await axios.get(localApiUrl() + '/isbn/' + encodeURIComponent(isbn), axiosOptions);
  return response.data;
};
const getBooksByAuthorAsync = async (author) => {
  const response = await axios.get(localApiUrl() + '/author/' + encodeURIComponent(author), axiosOptions);
  return response.data;
};
const getBooksByTitleAsync = async (title) => {
  const response = await axios.get(localApiUrl() + '/title/' + encodeURIComponent(title), axiosOptions);
  return response.data;
};

// Optional endpoints showing the methods work as part of the running server.
const asyncRoute = (fn) => async (req, res) => {
  try {
    return res.json(await fn(req));
  } catch (error) {
    return res.status(error.response && error.response.status || 500).json({
      message: error.response && error.response.data && error.response.data.message || 'Async book request failed.'
    });
  }
};
public_users.get('/async/books', asyncRoute(() => getAllBooksAsync()));
public_users.get('/async/isbn/:isbn', asyncRoute(req => getBookByISBNAsync(req.params.isbn)));
public_users.get('/async/author/:author', asyncRoute(req => getBooksByAuthorAsync(req.params.author)));
public_users.get('/async/title/:title', asyncRoute(req => getBooksByTitleAsync(req.params.title)));

module.exports = {
  general: public_users,
  getAllBooksAsync,
  getBookByISBNAsync,
  getBooksByAuthorAsync,
  getBooksByTitleAsync
};
