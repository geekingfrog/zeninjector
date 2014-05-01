'use strict';
// file used to check if the parser correctly get all the
// modules defined there

module.exports = {
  //@autoinject
  a: function() { return 'a';}
}

//@autoinject
module.exports.b = function() {
  return 'baz';
};

//@autoinject
var c = function() {};
module.exports.c = c;

//@autoinject
function d() {};
module.exports.d = d;
