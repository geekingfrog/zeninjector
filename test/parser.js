var parser = require('../lib/parser');
var path = require('path');
var assert = require('chai').assert;

suite('parser', function() {

  test('get function definitions', function(done) {
    var matches = parser.extractInjectedFunctions('test/files/declaration.js');

    matches.then(function(matches) {
      var names = matches.map(function(m) { return m.name; });
      assert.sameMembers(['a', 'b', 'c', 'd', 'e'], names);
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

})
