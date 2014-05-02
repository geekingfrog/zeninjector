var parser = require('../lib/parser');
var path = require('path');
var assert = require('chai').assert;
var _ = require('lodash');

suite('parser', function() {

  test('get function definitions', function(done) {
    var matches = parser.extractInjectedFunctions('test/files/declaration.js');

    matches.then(function(matches) {
      var names = matches.map(function(m) { return m.name; });
      assert.sameMembers(['a', 'b', 'c', 'd', 'e', 'g'], names);
      assert.notInclude(matches, 'f');
      done();
    }).catch(done);

  });

  test('rejects if autoinjected function is not exported', function(done) {
    var modules = parser.extractModulesFromFile('test/files/notExported.js');
    modules.then(function() {
      done(new Error('Must throw error if autoinjected function is not exported'));
    })
    .catch(function(err) {
      /not been exported/i.test(err.message) ? done() : done(err);
    });
  });

  test('correctly find the modules', function(done) {
    var modules = parser.extractModulesFromFile('test/files/module.js');
    modules.then(function(modules) {
      var names = modules.map(function(m) { return m.name; });
      assert.sameMembers(['a', 'b', 'c', 'd'], names);

      // all 'define' are functions
      modules.forEach(function(m) {
        assert.instanceOf(m.define, Function);
      });
      done();
    }).catch(done);
  });

  test('find module when they directly export a function', function(done) {
    var modules = parser.extractModulesFromFile('test/files/inlineExports.js');
    modules.then(function(modules) {
      var names = modules.map(function(m) { return m.name; });
      assert.sameMembers(['aPrime', 'bPrime'], names);
      done();
    }).catch(done);
  });

  suite('annotations with parameters', function() {

    test('name can be specified', function(done) {
      parser.extractInjectedFunctions('test/files/paramAnnotations.js')
      .then(function(fns) {
        var bar = _.find(fns, function(f) { return f.name === 'bar'; });
        assert.equal(bar.exportedName, 'foo');
        done();
      }).catch(done);
    });

    test('dependencies can be specified', function(done) {
      parser.extractInjectedFunctions('test/files/paramAnnotations.js')
      .then(function(fns) {
        var baz = _.find(fns, function(f) { return f.name === 'baz'; });
        assert.sameMembers(baz.dependencies, ['foo', 'bar']);
        done();
      }).catch(done);
    });

    test('register module accordingly', function(done) {
      parser.extractModulesFromFile('test/files/paramAnnotations.js')
      .then(function(matches) {
        var foobared = _.find(matches, function(m) { return m.name === 'foobared'; });
        assert.isDefined(foobared, 'understand name param in @autoinject');
        assert.instanceOf(foobared.define, Array, 'understand dependencies');
        assert.sameMembers(['foo', 'bar'], foobared.define.slice(0, -1));
        assert.instanceOf(foobared.define[foobared.define.length-1], Function);
        done();
      }).catch(done);
    });

  });

})
