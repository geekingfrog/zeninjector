var Container = require('../lib/container');
var assert = require('chai').assert;
var Promise = require('bluebird');

Promise.onPossiblyUnhandledRejection(function(error){
  // ignore promises which don't handle errors
});

var coTest = function(name, fn) {
  var that = this;
  test(name, function(done) {
    Promise.coroutine(fn.bind(that))(done).catch(function(err) {
      done(err);
    });
  });
}

var shouldThrow = function(fn, done) {
  Promise.spawn(function* () {
    try {
      yield fn();
      done(new Error('Should throw error'));
    } catch(e) {
      console.log(e);
      done(); 
    }
  });
};

suite('container', function() {
  setup(function() {
    this.container = new Container();
  });

  teardown(function() {
    this.container = null;
  });

  suite('register throws error', function() {
    suite('when invalid object is passed', function() {

      test('no name', function() {
        var container = this.container;
        assert.throw(function() {
          container.register({});
        }, /must have a name/i);
      });

      test('no `define` function', function() {
        var container = this.container;
        assert.throw(function() {
          container.register({name: 'willFail'});
        }, /must have a `define` function/i);
      });

      test('already registered', function() {
        var container = new Container();
        container.register({ name: 'first', define: function() {} });
        assert.throw(function() {
          container.register({ name: 'first', define: function() {} });
        }, /already registered/i);
      });

    });
  });

  suite('register/get', function() {

    test('`get` throws error if module is not registered', function(done) {
      var container = this.container;
      Promise.spawn(function* () {
        try {
          yield container.get('doenstExist');
          done(new Error('get should throw an error'));
        } catch(err) {
          if(/no module (:?.*?) registered/i.test(err.toString())) {
            done();
          } else {
            done(err);
          }
        }
      }).catch(done);
    });

    test('module with no dependencies', function(done) {
      var container = this.container;
      Promise.spawn(function* () {
        container.register({ name: 'noDep', define: function() { return 'nodep'; } });
        var result = yield container.get('noDep');
        assert.equal(result, 'nodep');
        done();
      }).catch(done);
    });

    test('module with a dependency', function(done) {
      var container = this.container;
      var o1 = {
        name: 'o1',
        define: function() { return 'o1'; }
      };

      var o2 = {
        name: 'o2',
        dependencies: ['o1'],
        define: function(o1) { return o1+' augmented'; }
      };

      Promise.spawn(function* () {
        container.register(o1);
        container.register(o2);
        var o2Module = yield container.get(o2.name);
        assert.equal(o2Module, 'o1 augmented');
        done();
      }).catch(done);
    });

  });

  suite('register npm module', function() {

    test('shortcut to register npm modules', function(done) {
      var fs = require('fs');
      var container = this.container;
      container.registerNpm('fs');
      Promise.spawn(function* () {
        var fsModule = yield container.get('fs');
        assert.equal(fsModule, fs);
        done();
      }).catch(done);
    });

    test('test perso', function() {
      var container = this.container;
      Promise.spawn(function* () {
        container.register({
          name: 'config',
          define: function() {
            return {
              db: {url: 'mongodb://localhost:27017/myapp'}
            }
          }
        });

        var dbUrl = (yield container.get('config')).db.url;
        console.log(dbUrl);

      });
    });

  });

});
