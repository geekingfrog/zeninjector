'use strict';

module.exports = {
  //@autoinject
  foo: function() {}
}

//@autoinject
module.exports.baz = function() {
  return 'baz';
};

module.exports.bar = function() {};


//@autoinject
function b() {};
module.exports.b = b;

//@autoinject
var c = function() {};
module.exports.c = c;

//@autoinject

function d() {};
module.exports.d = d;
