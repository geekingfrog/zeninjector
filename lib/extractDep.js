'use strict';

// @params {Function} fn: input function
// returns an array of string which are the arguments of the function
//
// eg: function(a, foo, bar) -> ['a', 'foo', 'bar']
// Largely taken from http://bdadam.com/blog/demistifying-angularjs-dependency-injection.html
// from the source of angularJS.
module.exports = function(fn) {
  if(typeof fn === 'function' && fn.length) {
    var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
    var FN_ARG_SPLIT = /,/;
    var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

    var srcFn = fn.toString();
    // get rid of comments like function(/*string*/ a) {}
    srcFn = srcFn.replace(STRIP_COMMENTS, '');

    var matches = srcFn.match(FN_ARGS);
    var args = matches[1]; // get args names

    return args.split(FN_ARG_SPLIT).map(function(arg) { return arg.trim(); });

  } else {
    return [];
  }
};
