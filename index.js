
/*!
 *
 * level-relation
 *
 * relations and joins between sublevels
 *
 * MIT
 *
 */

/**
 * Module dependencies.
 */

var through = require('async-through');
var ordered = require('ordered-through');
var timestamp = require('monotonic-timestamp');

/**
 * Expose `Relation`.
 */

module.exports = Relation;

/**
 * Task methods.
 */

var methods = {
  put: put,
  del: del
};

/**
 * Relation.
 *
 * @param {Sub} a
 * @param {Sub} b
 * @api public
 */

function Relation(a, b){
  if (!(this instanceof Relation)) return new Relation(a, b);
  this.a = a;
  this.b = b;
  this.batch = [];
}

/**
 * Task queue methods.
 *
 * @api public
 */

['put', 'and', 'del'].map(function(task){

  /**
   * Queues a task for `item`.
   *
   * @param {Object} item
   * @return {Relation}
   * @api public
   */

  Relation.prototype[task] = function(item){
    this.batch.push({ task: task, item: item });
    return this;
  };
});

/**
 * Queues relation `name` for `item`.
 *
 * @param {Object} item
 * @param {String} name
 * @api public
 */

Relation.prototype.in =
Relation.prototype.from = function(item, name){
  this.batch.push({ item: item, name: name });
  return this;
};

/**
 * Executes tasks in queue.
 *
 * @param {Function} fn
 * @api public
 */

Relation.prototype.end = function(fn){
  var a = this.a;
  var b = this.b;
  var batch = this.batch;
  var prev;

  next();

  function next(err){
    if (err) return fn(err);
    if (!batch.length) return fn();

    var src = batch.shift();
    var dest = batch.shift();
    var task = src.task;
    var rev = false;

    if ('and' == task) {
      rev = true;
      task = prev;
    }
    prev = task;

    exec(task, rev ? b : a, rev ? a : b, src, dest, next);
  }
};

/**
 * Creates sublevels for relation `name`
 * between dbs `a` and `b` for item `key`.
 *
 * @param {Sub} a
 * @param {Sub} b
 * @param {String} name
 * @param {String} key
 * @return {Object}
 * @api private
 */

function relations(a, b, name, key){
  var db = a
  .sublevel('relations', { valueEncoding: 'utf8' })
  .sublevel(name)
  .sublevel(key);

  var pointers = db.sublevel('pointers');
  var timeline = db.sublevel('timeline');

  var rel = {
    db: db,
    pointers: pointers,
    timeline: timeline
  };

  a[name] = a[name] || resolver(rel, b);

  return rel;
}

/**
 * Put (link) relation of `rel` to `key`.
 *
 * @param {Object} rel
 * @param {String} key
 * @param {Function} fn
 * @api private
 */

function put(rel, key, fn){
  var time = timestamp();
  rel.pointers.get(key, function(err){
    if (!err) return fn(error({
      message: 'Already linked key "' + key + '" in "' + rel.db.prefix('') + '"',
      type: 'AlreadyLinkedError'
    }));
    else if (err.type != 'NotFoundError') return fn(err);
    rel.pointers.put(key, time, function(err){
      if (err) return fn(err);
      rel.timeline.put(time, key, fn);
    });
  });
}

/**
 * Delete (unlink) relation of `rel` to `key`.
 *
 * @param {Object} rel
 * @param {String} key
 * @param {Function} fn
 * @api private
 */

function del(rel, key, fn){
  rel.pointers.get(key, function(err, time){
    if (err) {
      if (err.type == 'NotFoundError') return fn(error({
        message: 'Key "' + key + '" not found in "' + rel.prefix('') + '"',
        type: 'NotFoundError'
      }));
      else return fn(err);
    }
    rel.timeline.del(time, function(err){
      if (err) return fn(err);
      rel.pointers.del(key, fn);
    });
  });
}

/**
 * Resolver factory for `rel` and `other`.
 *
 * @param {Object} rel
 * @param {Sub} other
 * @return {Object}
 * @api private
 */

function resolver(rel, other){
  return {
    by: by
  };

  /**
   * Creates a ReadStream for relations of `item`
   *
   *  - `keys=false` {Boolean} when true, stream keys without resolving
   *  - `ordered=true` {Boolean} preserve insertion order
   *
   * @param {Object} item
   * @param {Object} [options]
   * @return {Stream}
   * @api public
   */

  function by(item, options){
    options = options || {};
    if (!('ordered' in options)) options.ordered = true;

    if (options.ordered && !options.keys) {
      var resolve = ordered(function(key, fn){
        other.db.get(key, { valueEncoding: 'json' }, fn);
      });
      return rel.timeline.createValueStream().pipe(resolve);
    }
    else if (!options.ordered && !options.keys) {
      var resolve = through(function(key){
        var self = this;
        other.db.get(key, { valueEncoding: 'json' }, function(err, data){
          if (err) return self.emit('error', err);
          self.queue(data);
        });
      });
      return rel.pointers.createKeyStream().pipe(resolve);
    }
    else if (options.ordered && options.keys) {
      return rel.timeline.createValueStream();
    }
    else if (!options.ordered && options.keys) {
      return rel.pointers.createKeyStream();
    }
  }
}

/**
 * Execute `task` from batch.
 *
 * @param {String} task
 * @param {Sub} a
 * @param {Sub} b
 * @param {Array} src
 * @param {Array} dest
 * @param {Function} fn
 * @api private
 */

function exec(task, a, b, src, dest, fn){
  var name = dest.name;
  var item = dest.item;
  var other = src.item;

  a.find(item, function(err, data, key){
    var rel = relations(a, b, name, key);

    b.find(other, function(err, data, key){
      if (err) return fn(err);
      key = b.prefix(key);
      methods[task](rel, key, fn);
    });
  });
}

/**
 * Error instance helper.
 *
 * @param {Object} props
 * @return {Error}
 * @api private
 */

function error(props){
  var err = new Error();
  for (var key in props) err[key] = props[key];
  return err;
}
