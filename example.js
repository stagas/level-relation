
/**
 * Example.
 */

var level = require('level');
var sublevel = require('sublevel');
var indexing = require('level-indexing');
var relation = require('./');

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

// create some entires
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
