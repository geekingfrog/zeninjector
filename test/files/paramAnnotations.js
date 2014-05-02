'use strict';

//@autoinject(name=foo)
module.exports.bar = function bar() { return 'bar'; }

//@autoinject(name=foobared;dependencies=foo,bar)
module.exports.baz = function(a, b) { return a+b; }
