'use strict';

var Promise = require('./promise');
var fs = Promise.promisifyAll(require('fs'));
var split = require('split');
var path = require('path');

// given a line in a file, return the name of the
// function exported (or null if invalid)
var extractExportName = (function() {

  // matches "module.exports =" or "exports ="
  var exportPattern1 = /(?:module\.)?exports\.([^\. =]+)/;

  // matches "var foo = function" or "let foo = function"
  var functionPattern1 = /(?:var|let)\s+([^\s=]*)/;

  // matches "function foo("
  var functionPattern2 = /function\s+([^\(]*)/;

  // matches "foo: function()" as in
  // module.exports = {
  //   foo: function() {}
  // }
  var exportPattern2 = /\s*([^\s:]*):/;

  return function extractExportName(line) {
    var match = exportPattern1.exec(line)
             || exportPattern2.exec(line)
             || functionPattern1.exec(line)
             || functionPattern2.exec(line);

    if(match) return match[1];
  }
})();

// Given a path to a file, return an array of variables
// marked with @autoinject
function extractInjectedFunctions(file) {

  var pattern = /^\s*\/\/\s*@autoinject/;
  var resolver = Promise.defer();
  var matches = [];

  var gotAutoinject, lineCount=0;

  fs.createReadStream(file)
  .pipe(split())
  .on('data', function(line) {
    lineCount++;
    if(!line.length) return; // ignore empty lines

    if(pattern.test(line)) {
      if(gotAutoinject) {
        this.removeAllListeners();
        resolver.reject(new Error('Parse error. Cannot have two @autoinject with no functions between'));
        return;
      }
      gotAutoinject = true;
      return;
    }

    if(!gotAutoinject) return;

    var name = extractExportName(line);
    if(!name) {
      this.removeAllListeners();
      resolver.reject(new Error('Parse error. An @autoinject statement must be directly followed by the function declaration'));
      return;
    }

    matches.push({
      name: name,
      exportedName: name
    });
    gotAutoinject = false;
  })
  .on('end', function() {
    resolver.resolve(matches);
  });

  return resolver.promise;
}

function getFunctionName(fn) {
  fn = fn.toString();
  var r = /function\s+([^\s\(]*)/;
  var match = r.exec(fn);
  if(match) return match[1];
  else throw new Error(fn+' is anonymous');
}


// returns an array of {name, define} to be then used to register
// modules with the container.
function extractModulesFromFile(file) {
  var required = require(path.resolve(file));
  var matches = extractInjectedFunctions(file);

  return Promise.all([required, matches])
  .spread(function(required, matches) {
    // make sure all @autoinject function are exported
    var exported = Object.keys(required);
    if('function' === typeof required) {
      var fnName = getFunctionName(required);
      exported.push(fnName);
      required[fnName] = required;
    }

    matches.forEach(function(match) {
      if(exported.indexOf(match.name) == -1) {
        throw new Error('Function '+match.name+' is marked as autoinject but has not been exported');
      }
    });

    return matches.map(function(match) {
      return {
        name: match.exportedName,
        define: required[match.name]
      }
    });

  });
}

// extractModulesFromFile('./test/files/simple.js');

module.exports.extractInjectedFunctions = extractInjectedFunctions;
module.exports.extractModulesFromFile = extractModulesFromFile;
