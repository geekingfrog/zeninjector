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
      assert.include(err.message, 'not been exported');
      assert.include(err.message, 'notExported.js', 'Error message should contains filename');
    }).nodeify(done);
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

  test('@autoexport works', function(done) {
    var modules = parser.extractModulesFromFile('test/files/autoexports.js');
    modules.then(function(modules) {
      var foo = _.find(modules, function(m) { return m.name === 'foo'; });
      assert.isDefined(foo, 'Must have a module `foo` exported');
      assert.propertyVal(foo, 'name', 'foo');
      assert.isFunction(foo.define);
      done();
    }).catch(done);
  });

  test('@autoexport works with custom name', function(done) {
    var modules = parser.extractModulesFromFile('test/files/autoexports.js');
    modules.then(function(modules) {
      var bar = _.find(modules, function(m) { return m.name === 'bar'; });
      assert.isDefined(bar, 'Must have a module `bar` exported');
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

  test('does not require if no annotations', function(done) {
    // test pass if the file is not required -> returns nothing
    parser.extractModulesFromFile('test/files/noAnnotations.js')
    .nodeify(done);
  });

})
