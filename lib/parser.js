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

  var nameParam = 'name\\s*=\\s*([^,)]+)';
  var paramsPattern = /\(([^\)]*)\)/;
  var injectPattern = /^\s*\/\/\s*@autoinject/;
  var resolver = Promise.defer();
  var matches = [];

  var gotAutoinject, lineCount=0;
  var exportName, dependencies;

  fs.createReadStream(file)
  .pipe(split())
  .on('data', function(line) {
    lineCount++;
    if(!line.length) return; // ignore empty lines

    // var match = pattern.exec(line);
    if(injectPattern.test(line)) {
      if(gotAutoinject) {
        this.removeAllListeners();
        resolver.reject(new Error('Parse error. Cannot have two @autoinject with no functions between'));
        return;
      }

      var paramsMatch = paramsPattern.exec(line);
      if(paramsMatch) {
        paramsMatch[1].split(';').forEach(function(p) {
          var pair = p.trim().split('=');
          if(!pair) return;
          if(pair[0].trim() === 'name') exportName = pair[1];
          if(pair[0].trim() === 'dependencies') {
            dependencies = pair[1].split(',').map(function(d) { return d.trim(); });
          }
        });
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
      exportedName: exportName || name,
      dependencies: dependencies
    });
    exportName = void(0);
    dependencies = void(0);
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
      var deps;
      if(match.dependencies) {
        deps = match.dependencies.concat([required[match.name]]);
      } else {
        deps = required[match.name];
      }

      return {
        name: match.exportedName,
        define: deps
      }
    });

  });
}

// extractModulesFromFile('./test/files/simple.js');

module.exports.extractInjectedFunctions = extractInjectedFunctions;
module.exports.extractModulesFromFile = extractModulesFromFile;
