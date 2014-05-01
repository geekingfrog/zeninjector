'use strict';
// file used to check if the parser correctly get the
// name of all possible function declaration

module.exports = {
  //@autoinject
  a: function() {}
}

//@autoinject
module.exports.b = function() {
  return 'baz';
};

//@autoinject
var c = function() {};

//@autoinject

function d() {};

//@autoinject
function e() {};

function f() {};
