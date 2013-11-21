
# level-relation

relations and joins between sublevels

## Installing

`npm install level-relation`

## Example

```js
var level = require('level');
var sublevel = require('sublevel');
var indexing = require('level-indexing');
var relation = require('level-relation');

var top = level('./level-test');
var db = sublevel(top, { valueEncoding: 'json' });

// create some sublevels
var users = db.sublevel('users');
var posts = db.sublevel('posts');

// enable indexing
indexing(users);
indexing(posts);

// index some properties
users.index('username');
posts.index('title');

// create some entries
var user = { username: 'john' };
var post = { title: 'foobar' };

users.put(1, user, function(err){
  posts.put(2, post, function(err){
    // create a dual relation
    relation(users, posts)
    .put(post).in(user, 'posts')
    .and(user).in(post, 'owner')
    .end(function(err){
      if (err) throw err;

      var p = users.posts.by(user);
      p.on('data', console.log); // => { title: 'foobar' }

      var u = posts.owner.by(post);
      u.on('data', console.log); // => { username: 'john' }
    });
  });
});
```

## API

### relation(a, b)

Create a relation job.

### relation(a).have(name, b)

Creates a stream factory for `a` for relations `name` with `b`.

This is also added implicitly when a new relation is created.

Example:
```js
relation(users).have('posts', posts);
var p = users.posts.by(user);
```

### put(x).in(y, name)

Puts `x` in `y` relations of `name`.

Example:
```js
relation(users, posts)
.put(post).in(user, 'posts')
```

### put(x).in(y, name).and(y).in(x, name)

Creates a dual relation.

Example:
```js
relation(users, posts)
.put(post).in(user, 'posts')
.and(user).in(post, 'owner')
```

### del(x).from(y, name)

Deletes relation `name` between `x` with `y`.

Example:
```js
relation(users, posts)
.del(post).from(user, 'posts')
```

### del(x).from(y, name).and(y).from(x, name)

Deletes a dual relation.

Example:
```js
relation(users, posts)
.del(post).from(user, 'posts')
.and(user).from(post, 'owner')
```

### end(fn)

Executes batch job and callbacks `fn`.

Example:
```js
relation(users, posts)
.put(post).in(user, 'posts')
.and(user).in(post, 'owner')
.end(function(err){
  if (err) throw err; // throws on duplicate relations
  // relations created
});
```

### name.by(x[, options])

Creates a ReadStream for `name` relations by `x`.

Options:

- `keys=false` {Boolean}  when true, stream keys without resolving
- `ordered=true` {Boolean} preserve insertion order

Examples:
```js
// will resolve every relation and stream the foreign objects
// ordered by the insertion time (slowest)
var p = users.posts.by(user);

// will resolve every relation and stream the foreign objects
// unordered (bit faster)
var p = users.posts.by(user, { ordered: false });

// will only stream the foreign keys, ordered by time (fast)
var p = users.posts.by(user, { keys: true });

// only gets foreign keys, not ordered by time (fastest)
var p = users.posts.by(user, { keys: true, ordered: false });
```

## License

MIT
