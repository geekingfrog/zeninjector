var extractor = require('../lib/extractDep');
var assert = require('chai').assert;

suite('extract dependencies', function() {

  test('no dependencies', function() {
    var f = function() {};
    assert.deepEqual(extractor(f), []);
  });

  test('with some dependencies', function() {
    var f = function(a, b, foo) {};
    assert.deepEqual(extractor(f), ['a', 'b', 'foo']);
  });

  test('with comments', function() {
    var f = function(/* string */ a) {}
    assert.deepEqual(extractor(f), ['a']);
  });

  test('for multi line function', function() {
    var f = function(a
      , b
      , c) {};
    assert.deepEqual(extractor(f), ['a', 'b', 'c']);
  });

  test('for multi line comments', function() {
    var f = function(a, /*
                           this is a very long
                           long
                           comment
                           */ b){};
    assert.deepEqual(extractor(f), ['a', 'b']);
  });

});
