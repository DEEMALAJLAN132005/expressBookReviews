const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const realLoad = Module._load;
const books = require('../router/booksdb.js');
const calls = [];
const routerFactory = () => ({
  handlers: { get: {}, post: {}, put: {}, delete: {} },
  get(path, fn) { this.handlers.get[path] = fn; },
  post(path, fn) { this.handlers.post[path] = fn; },
  put(path, fn) { this.handlers.put[path] = fn; },
  delete(path, fn) { this.handlers.delete[path] = fn; }
});
const mocks = {
  express: { Router: routerFactory },
  jsonwebtoken: { sign: payload => JSON.stringify(payload), verify: token => JSON.parse(token) },
  axios: { get: async (url, options) => {
    calls.push({url,options});
    const parts = new URL(url).pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (!parts.length) return {data:books};
    if (parts[0] === 'isbn') return {data:books[parts[1]]};
    const field = parts[0] === 'author' ? 'author' : 'title';
    return {data:Object.fromEntries(Object.entries(books).filter(([,book]) => book[field] === parts[1]))};
  }}
};
Module._load = function(request, parent, isMain) {
  if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
  return realLoad.apply(this, arguments);
};
let auth, general;
try {
  auth = require('../router/auth_users.js');
  general = require('../router/general.js');
} finally { Module._load = realLoad; }
const response = () => ({
  statusCode:200,
  status(code) { this.statusCode=code; return this; },
  json(body) { this.body=body; return this; }
});
const call = (router, verb, path, parts={}) => {
  const fn = router.handlers[verb][path];
  assert.ok(fn, verb+' '+path+' exists');
  const res=response();
  fn({body:{},query:{},params:{},...parts}, res);
  return res;
};
test('catalog, ISBN, author, title, and review endpoints', () => {
  assert.equal(Object.keys(call(general.general,'get','/').body).length,10);
  assert.equal(call(general.general,'get','/isbn/:isbn',{params:{isbn:'8'}}).body.title,'Pride and Prejudice');
  assert.equal(call(general.general,'get','/isbn/:isbn',{params:{isbn:'99'}}).statusCode,404);
  assert.equal(Object.keys(call(general.general,'get','/author/:author',{params:{author:'Unknown'}}).body).length,4);
  assert.equal(call(general.general,'get','/title/:title',{params:{title:'Things Fall Apart'}}).body[1].author,'Chinua Achebe');
  assert.deepEqual(call(general.general,'get','/review/:isbn',{params:{isbn:'1'}}).body,{});
});
test('registration, JWT login, review update, and deletion', () => {
  const credentials={username:'demo_test_account',password:'S3cretForTests'};
  assert.equal(call(general.general,'post','/register').statusCode,400);
  assert.equal(call(general.general,'post','/register',{body:credentials}).statusCode,201);
  assert.equal(call(general.general,'post','/register',{body:credentials}).statusCode,409);
  assert.equal(auth.users[0].password,undefined);
  assert.equal(call(auth.authenticated,'post','/login',{body:{username:credentials.username,password:'wrong'},session:{}}).statusCode,401);
  const session={};
  assert.equal(call(auth.authenticated,'post','/login',{body:credentials,session}).statusCode,200);
  assert.ok(session.authorization.accessToken);
  const user={username:credentials.username}, params={isbn:'1'};
  assert.equal(call(auth.authenticated,'put','/auth/review/:isbn',{user,params,query:{review:'Excellent'}}).body.reviews[user.username],'Excellent');
  assert.equal(call(auth.authenticated,'put','/auth/review/:isbn',{user,params,query:{review:'Updated'}}).body.reviews[user.username],'Updated');
  assert.equal(call(auth.authenticated,'delete','/auth/review/:isbn',{user:{username:'other'},params}).statusCode,404);
  assert.equal(call(auth.authenticated,'delete','/auth/review/:isbn',{user,params}).statusCode,200);
  assert.deepEqual(books[1].reviews,{});
});
test('four Async/Await Axios functions',async () => {
  assert.equal(Object.keys(await general.getAllBooksAsync()).length,10);
  assert.equal((await general.getBookByISBNAsync(8)).title,'Pride and Prejudice');
  assert.equal(Object.keys(await general.getBooksByAuthorAsync('Unknown')).length,4);
  assert.equal((await general.getBooksByTitleAsync('Things Fall Apart'))[1].author,'Chinua Achebe');
  assert.equal(calls.length,4);
  assert.ok(calls.every(call=>call.options.proxy===false));
});
