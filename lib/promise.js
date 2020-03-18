var Promise = require('bluebird/js/release/promise')();

Promise.defer = function() {
  var resolve, reject;
  var promise = new Promise(function() {
    resolve = arguments[0];
    reject = arguments[1];
  });

  return {
    resolve: resolve,
    reject: reject,
    promise: promise
  }
}

module.exports = Promise;
