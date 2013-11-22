
/**
 * Test.
 */

var assert = require('assert');
var Stream = require('stream');

var level = require('level');
var sublevel = require('sublevel');
var indexing = require('level-indexing');
var relation = require('../');

var dbpath = __dirname + '/level-test';
var top;
var db;

beforeEach(function(done){
  top = level(dbpath, done);
  db = sublevel(top, { valueEncoding: 'json' });
})

afterEach(function(done){
  top.close(function(){
    level.destroy(dbpath, done);
  });
})

describe("relation(a, b)", function(){

  it("should return an instance of Relation", function(){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');

    indexing(users);
    indexing(posts);

    var rel = relation(users, posts);
    rel.should.be.an.instanceof(relation);
  })

})

describe("relation(db).have(name)", function(){

  it("should return an instance of Relation", function(){
    var users = db.sublevel('users');

    indexing(users);

    var rel = relation(users).have('posts');
    rel.should.be.an.instanceof(relation);
  })

  it("should have relation stream factory property", function(){
    var users = db.sublevel('users');

    indexing(users);

    relation(users).have('posts');
    users.should.have.property('posts');
  })

  it("should stream foreign objects", function(done){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');
    var comments = db.sublevel('comments');

    indexing(users);
    indexing(posts);
    indexing(comments);

    users.index('username');
    posts.index('title');
    comments.index('date');

    relation(users).have('items');

    var user = { username: 'john' };
    var post = { title: 'foobar' };
    var comment = { date: Date.now() };

    users.put(1, user, function(err){
      posts.put(2, post, function(err){
        comments.put(3, comment, function(err){
          relation(users, posts)
          .put(post).in(user, 'items')
          .end(function(err){
            relation(users, comments)
            .put(comment).in(user, 'items')
            .end(function(err){
              var results = [];
              var i = users.items.by(user);
              i.on('data', function(data){
                results.push(data);
              });
              i.on('end', function(){
                results.should.eql([
                  post,
                  comment
                ]);
                done();
              });
            });
          });
        });
      });
    });
  })

})

describe("put(x).in(y, name)", function(){

  it("should create a batch job", function(done){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');

    indexing(users);
    indexing(posts);

    users.index('username');
    posts.index('title');

    var user = { username: 'john' };
    var post = { title: 'foobar' };

    users.put(1, user, function(err){
      posts.put(2, post, function(err){

        var rel = relation(users, posts)
        .put(post).in(user, 'posts');

        rel.batch.should.eql([
          { task: 'put', item: post },
          { item: user, name: 'posts' }
        ]);

        done();
      });
    });
  })

})

describe("put(x).in(y, name).and(y).in(x, name)", function(){

  it("should create a batch job", function(done){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');

    indexing(users);
    indexing(posts);

    users.index('username');
    posts.index('title');

    var user = { username: 'john' };
    var post = { title: 'foobar' };

    users.put(1, user, function(err){
      posts.put(2, post, function(err){

        var rel = relation(users, posts)
        .put(post).in(user, 'posts')
        .and(user).in(post, 'owner');

        rel.batch.should.eql([
          { task: 'put', item: post },
          { item: user, name: 'posts' },
          { task: 'and', item: user },
          { item: post, name: 'owner' }
        ]);

        done();
      });
    });
  })

})

describe("del(x).from(y, name)", function(){

  it("should create a batch job", function(done){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');

    indexing(users);
    indexing(posts);

    users.index('username');
    posts.index('title');

    var user = { username: 'john' };
    var post = { title: 'foobar' };

    users.put(1, user, function(err){
      posts.put(2, post, function(err){

        var rel = relation(users, posts)
        .del(post).from(user, 'posts');

        rel.batch.should.eql([
          { task: 'del', item: post },
          { item: user, name: 'posts' }
        ]);

        done();
      });
    });
  })

})

describe("del(x).from(y, name).del(y).from(x, name)", function(){

  it("should create a batch job", function(done){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');

    indexing(users);
    indexing(posts);

    users.index('username');
    posts.index('title');

    var user = { username: 'john' };
    var post = { title: 'foobar' };

    users.put(1, user, function(err){
      posts.put(2, post, function(err){

        var rel = relation(users, posts)
        .del(post).from(user, 'posts')
        .and(user).from(post, 'owner');

        rel.batch.should.eql([
          { task: 'del', item: post },
          { item: user, name: 'posts' },
          { task: 'and', item: user },
          { item: post, name: 'owner' }
        ]);

        done();
      });
    });
  })

})

describe("put(x).in(y, name).end(fn)", function(){

  it("should create a relation", function(done){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');

    indexing(users);
    indexing(posts);

    users.index('username');
    posts.index('title');

    var user = { username: 'john' };
    var post = { title: 'foobar' };

    var time = Date.now();

    users.put(1, user, function(err){
      posts.put(2, post, function(err){

        var rel = relation(users, posts)
        .put(post).in(user, 'posts')
        .end(function(err){
          top.get('\x00/\x00users/\x00relations/\x00posts/\x001/\x00pointers/\x01\x00/\x00posts/\x012', function(err, value){
            assert(null == err);
            assert(time < value);
            top.get('\x00/\x00users/\x00relations/\x00posts/\x001/\x00timeline/\x01' + value, function(err, value){
              assert(null == err);
              assert('\x00/\x00posts/\x012' == value);
              top.get(value, { valueEncoding: 'json' }, function(err, data){
                data.should.eql(post);
                done();
              });
            });
          });
        });

      });
    });
  })

  it("should not allow duplicates", function(done){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');

    indexing(users);
    indexing(posts);

    users.index('username');
    posts.index('title');

    var user = { username: 'john' };
    var post = { title: 'foobar' };

    var time = Date.now();

    users.put(1, user, function(err){
      posts.put(2, post, function(err){

        var rel = relation(users, posts)
        .put(post).in(user, 'posts')
        .end(function(err){
          top.get('\x00/\x00users/\x00relations/\x00posts/\x001/\x00pointers/\x01\x00/\x00posts/\x012', function(err, value){
            assert(null == err);
            assert(time < value);
            top.get('\x00/\x00users/\x00relations/\x00posts/\x001/\x00timeline/\x01' + value, function(err, value){
              assert(null == err);
              assert('\x00/\x00posts/\x012' == value);
              top.get(value, { valueEncoding: 'json' }, function(err, data){
                data.should.eql(post);
                var rel = relation(users, posts)
                .put(post).in(user, 'posts')
                .end(function(err){
                  assert(err);
                  assert('AlreadyLinkedError' == err.type)
                  done();
                });
              });
            });
          });
        });

      });
    });
  })

})

describe("put(x).in(y, name).and(y).in(x, name).end(fn)", function(){

  it("should create a dual relation", function(done){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');

    indexing(users);
    indexing(posts);

    users.index('username');
    posts.index('title');

    var user = { username: 'john' };
    var post = { title: 'foobar' };

    var time = Date.now();

    users.put(1, user, function(err){
      posts.put(2, post, function(err){

        var rel = relation(users, posts)
        .put(post).in(user, 'posts')
        .and(user).in(post, 'owner')
        .end(function(err){

          top.get('\x00/\x00users/\x00relations/\x00posts/\x001/\x00pointers/\x01\x00/\x00posts/\x012', function(err, value){
            assert(null == err);
            assert(time < value);
            top.get('\x00/\x00users/\x00relations/\x00posts/\x001/\x00timeline/\x01' + value, function(err, value){
              assert(null == err);
              assert('\x00/\x00posts/\x012' == value);
              top.get(value, { valueEncoding: 'json' }, function(err, data){
                data.should.eql(post);

                top.get('\x00/\x00posts/\x00relations/\x00owner/\x002/\x00pointers/\x01\x00/\x00users/\x011', function(err, value){
                  assert(null == err);
                  assert(time < value);
                  top.get('\x00/\x00posts/\x00relations/\x00owner/\x002/\x00timeline/\x01' + value, function(err, value){
                    assert(null == err);
                    assert('\x00/\x00users/\x011' == value);
                    top.get(value, { valueEncoding: 'json' }, function(err, data){
                      data.should.eql(user);
                      done();
                    });
                  });
                });

              });
            });
          });
        });

      });
    });
  })

  it("should not allow duplicates", function(done){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');

    indexing(users);
    indexing(posts);

    users.index('username');
    posts.index('title');

    var user = { username: 'john' };
    var post = { title: 'foobar' };

    var time = Date.now();

    users.put(1, user, function(err){
      posts.put(2, post, function(err){

        var rel = relation(users, posts)
        .put(post).in(user, 'posts')
        .and(user).in(post, 'owner')
        .end(function(err){

          top.get('\x00/\x00users/\x00relations/\x00posts/\x001/\x00pointers/\x01\x00/\x00posts/\x012', function(err, value){
            assert(null == err);
            assert(time < value);
            top.get('\x00/\x00users/\x00relations/\x00posts/\x001/\x00timeline/\x01' + value, function(err, value){
              assert(null == err);
              assert('\x00/\x00posts/\x012' == value);
              top.get(value, { valueEncoding: 'json' }, function(err, data){
                data.should.eql(post);

                top.get('\x00/\x00posts/\x00relations/\x00owner/\x002/\x00pointers/\x01\x00/\x00users/\x011', function(err, value){
                  assert(null == err);
                  assert(time < value);
                  top.get('\x00/\x00posts/\x00relations/\x00owner/\x002/\x00timeline/\x01' + value, function(err, value){
                    assert(null == err);
                    assert('\x00/\x00users/\x011' == value);
                    top.get(value, { valueEncoding: 'json' }, function(err, data){
                      data.should.eql(user);

                      var rel = relation(users, posts)
                      .put(post).in(user, 'posts')
                      .and(user).in(post, 'owner')
                      .end(function(err){
                        assert(err);
                        assert('AlreadyLinkedError' == err.type)
                        done();
                      });
                    });
                  });
                });

              });
            });
          });
        });

      });
    });
  })

})

describe("del(x).from(y, name).end(fn)", function(){

  it("should remove a relation", function(done){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');

    indexing(users);
    indexing(posts);

    users.index('username');
    posts.index('title');

    var user = { username: 'john' };
    var post = { title: 'foobar' };

    var time = Date.now();

    users.put(1, user, function(err){
      posts.put(2, post, function(err){

        var rel = relation(users, posts)
        .put(post).in(user, 'posts')
        .end(function(err){
          top.get('\x00/\x00users/\x00relations/\x00posts/\x001/\x00pointers/\x01\x00/\x00posts/\x012', function(err, value){
            assert(null == err);
            assert(time < value);
            top.get('\x00/\x00users/\x00relations/\x00posts/\x001/\x00timeline/\x01' + value, function(err, value){
              assert(null == err);
              assert('\x00/\x00posts/\x012' == value);
              top.get(value, { valueEncoding: 'json' }, function(err, data){
                data.should.eql(post);

                var rel = relation(users, posts)
                .del(post).from(user, 'posts')
                .end(function(err){
                  top.get('\x00/\x00users/\x00relations/\x00posts/\x001/\x00pointers/\x01\x00/\x00posts/\x012', function(err, value){
                    assert(err);
                    assert('NotFoundError' == err.type);
                    assert(null == value);
                    done();
                  });
                });

              });
            });
          });
        });

      });
    });
  })

})

describe("del(x).from(y, name).and(y).from(x, name).end(fn)", function(){

  it("should remove a dual relation", function(done){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');

    indexing(users);
    indexing(posts);

    users.index('username');
    posts.index('title');

    var user = { username: 'john' };
    var post = { title: 'foobar' };

    var time = Date.now();

    users.put(1, user, function(err){
      posts.put(2, post, function(err){

        var rel = relation(users, posts)
        .put(post).in(user, 'posts')
        .and(user).in(post, 'owner')
        .end(function(err){

          top.get('\x00/\x00users/\x00relations/\x00posts/\x001/\x00pointers/\x01\x00/\x00posts/\x012', function(err, value){
            assert(null == err);
            assert(time < value);
            top.get('\x00/\x00users/\x00relations/\x00posts/\x001/\x00timeline/\x01' + value, function(err, value){
              assert(null == err);
              assert('\x00/\x00posts/\x012' == value);
              top.get(value, { valueEncoding: 'json' }, function(err, data){
                data.should.eql(post);

                top.get('\x00/\x00posts/\x00relations/\x00owner/\x002/\x00pointers/\x01\x00/\x00users/\x011', function(err, value){
                  assert(null == err);
                  assert(time < value);
                  top.get('\x00/\x00posts/\x00relations/\x00owner/\x002/\x00timeline/\x01' + value, function(err, value){
                    assert(null == err);
                    assert('\x00/\x00users/\x011' == value);
                    top.get(value, { valueEncoding: 'json' }, function(err, data){
                      data.should.eql(user);

                      var rel = relation(users, posts)
                      .del(post).from(user, 'posts')
                      .and(user).from(post, 'owner')
                      .end(function(err){
                        top.get('\x00/\x00users/\x00relations/\x00posts/\x001/\x00pointers/\x01\x00/\x00posts/\x012', function(err, value){
                          assert(err);
                          assert('NotFoundError' == err.type);
                          assert(null == value);
                          top.get('\x00/\x00posts/\x00relations/\x00owner/\x002/\x00pointers/\x01\x00/\x00users/\x011', function(err, value){
                            assert(err);
                            assert('NotFoundError' == err.type);
                            assert(null == value);
                            done();
                          });
                        });
                      });

                    });
                  });
                });

              });
            });
          });
        });

      });
    });
  })

})

describe("name.by(x)", function(){

  it("should return an instance of Stream", function(done){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');

    indexing(users);
    indexing(posts);

    users.index('username');
    posts.index('title');

    var user = { username: 'john' };
    var post = { title: 'foobar' };

    users.put(1, user, function(err){
      posts.put(2, post, function(err){

        var rel = relation(users, posts)
        .put(post).in(user, 'posts')
        .end(function(err){
          var stream = users.posts.by(user);
          stream.should.be.an.instanceof(Stream);
          done();
        });

      });
    });
  })

  it("should stream linked objects", function(done){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');

    indexing(users);
    indexing(posts);

    users.index('username');
    posts.index('title');

    var user = { username: 'john' };
    var post = { title: 'foobar' };
    var post2 = { title: 'barfoo' };

    users.put(1, user, function(err){
      posts.put(2, post, function(err){
        posts.put(3, post2, function(err){

          var rel = relation(users, posts)
          .put(post).in(user, 'posts')
          .put(post2).in(user, 'posts')
          .end(function(err){
            var results = [];
            var stream = users.posts.by(user);
            stream.on('data', function(data){
              results.push(data);
            });
            stream.on('end', function(){
              assert(2 == results.length);
              results[0].should.eql(post);
              results[1].should.eql(post2);
              done();
            });
          });

        });
      });
    });
  })

  it("each item should have its own relations", function(done){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');

    indexing(users);
    indexing(posts);

    users.index('username');
    posts.index('title');

    var user = { username: 'john' };
    var user2 = { username: 'mary' };
    var post = { title: 'foobar' };
    var post2 = { title: 'barfoo' };

    users.put(1, user, function(err){
      users.put(2, user2, function(err){
        posts.put(3, post, function(err){
          posts.put(4, post2, function(err){

            relation(users, posts)
            .put(post).in(user, 'posts')
            .put(post2).in(user2, 'posts')
            .end(function(err){
              var results_1 = [];
              var results_2 = [];
              var stream = users.posts.by(user);
              stream.on('data', function(data){
                results_1.push(data);
              });
              stream.on('end', function(){
                assert(1 == results_1.length);
                results_1[0].should.eql(post);
                var stream = users.posts.by(user2);
                stream.on('data', function(data){
                  results_2.push(data);
                });
                stream.on('end', function(){
                  assert(1 == results_2.length);
                  results_2[0].should.eql(post2);
                  done();
                });
              });
            });

          });
        });
      });
    });
  })

  it("ordered=false should not order by insertion time", function(done){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');

    indexing(users);
    indexing(posts);

    users.index('username');
    posts.index('title');

    var user = { username: 'john' };
    var post = { title: 'foobar' };
    var post2 = { title: 'barfoo' };

    users.put(1, user, function(err){
      posts.put(2, post, function(err){
        posts.put(3, post2, function(err){

          var rel = relation(users, posts)
          .put(post).in(user, 'posts')
          .put(post2).in(user, 'posts')
          .end(function(err){
            var results = [];
            var stream = users.posts.by(user, { ordered: false });
            stream.on('data', function(data){
              results.push(data);
            });
            stream.on('end', function(){
              assert(2 == results.length);

              results
              .map(function(el) { return el.title })
              .should.contain(post.title);

              results
              .map(function(el) { return el.title })
              .should.contain(post2.title);

              done();
            });
          });

        });
      });
    });
  })

  it("keys=true should only stream keys", function(done){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');

    indexing(users);
    indexing(posts);

    users.index('username');
    posts.index('title');

    var user = { username: 'john' };
    var post = { title: 'foobar' };
    var post2 = { title: 'barfoo' };

    users.put(1, user, function(err){
      posts.put(2, post, function(err){
        posts.put(3, post2, function(err){

          var rel = relation(users, posts)
          .put(post).in(user, 'posts')
          .put(post2).in(user, 'posts')
          .end(function(err){
            var results = [];
            var stream = users.posts.by(user, { keys: true });
            stream.on('data', function(data){
              results.push(data);
            });
            stream.on('end', function(){
              assert(2 == results.length);
              results.should.eql([
                '\x00/\x00posts/\x012',
                '\x00/\x00posts/\x013'
              ]);
              done();
            });
          });

        });
      });
    });
  })

  it("keys=true, ordered=false should stream keys unordered", function(done){
    var users = db.sublevel('users');
    var posts = db.sublevel('posts');

    indexing(users);
    indexing(posts);

    users.index('username');
    posts.index('title');

    var user = { username: 'john' };
    var post = { title: 'foobar' };
    var post2 = { title: 'barfoo' };

    users.put(1, user, function(err){
      posts.put(2, post, function(err){
        posts.put(3, post2, function(err){

          var rel = relation(users, posts)
          .put(post).in(user, 'posts')
          .put(post2).in(user, 'posts')
          .end(function(err){
            var results = [];
            var stream = users.posts.by(user, { keys: true, ordered: false });
            stream.on('data', function(data){
              results.push(data);
            });
            stream.on('end', function(){
              assert(2 == results.length);
              results.should.include('\x00/\x00posts/\x012');
              results.should.include('\x00/\x00posts/\x013');
              done();
            });
          });

        });
      });
    });
  })

})
