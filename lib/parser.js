'use strict';

var Promise = require('./promise');
var fs = require('fs');
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

// return the exported name and the dependencies defined by the annotation
function getParams(line) {
  var paramsPattern = /\(([^\)]*)\)/;
  var paramsMatch = paramsPattern.exec(line);
  var res = {};

  if(paramsMatch) {
    paramsMatch[1].split(';').forEach(function(p) {
      var pair = p.trim().split('=');
      if(!pair) return;
      if(pair[0].trim() === 'name') res.exportName = pair[1];
      if(pair[0].trim() === 'dependencies') {
        res.dependencies = pair[1].split(',').map(function(d) { return d.trim(); });
      }
    });
  }
  return res;
}

// Given a path to a file, return an array of variables
// marked with @autoinject or @autoexport
function extractInjectedFunctions(file) {

  var nameParam = 'name\\s*=\\s*([^,)]+)';
  var injectPattern = /^\s*\/\/\s*@autoinject/;
  var exportPattern = /^\s*\/\/\s*@autoexport/;
  var parseErrorMsg = 'Parse error. Cannot have two annotations with no functions between';
  var resolver = Promise.defer();
  var matches = [];

  var gotAutoinject, gotAutoexport, lineCount=0;
  var exportName, dependencies;

  fs.createReadStream(file)
  .pipe(split())
  .on('data', function(line) {
    lineCount++;
    if(!line.length) return; // ignore empty lines

    if(injectPattern.test(line)) {
      if(gotAutoinject) {
        this.removeAllListeners();
        resolver.reject(new Error(parseErrorMsg));
        return;
      }

      var params = getParams(line);
      exportName = params.exportName;
      dependencies = params.dependencies;

      gotAutoinject = true;
      return;
    }

    if(exportPattern.test(line)) {
      if(gotAutoexport) {
        this.removeAllListeners();
        resolver.reject(new Error(parseErrorMsg));
        return;
      }

      var params = getParams(line);
      exportName = params.exportName;
      gotAutoexport = true;
      return;
    }

    if(!gotAutoinject && !gotAutoexport) return;

    var name = extractExportName(line);
    if(!name && !exportName) {
      this.removeAllListeners();
      resolver.reject(new Error('Parse error. An annotation must be directly followed by the function declaration'));
      return;
    }

    if(gotAutoinject) {
      matches.push({
        name: name,
        exportedName: exportName || name,
        dependencies: dependencies,
        autoinject: true
      });
    } else {
      matches.push({
        name: name,
        exportedName: exportName || name,
        autoexport: true
      });
    }

    exportName = void(0);
    dependencies = void(0);
    gotAutoinject = false;
    gotAutoexport = false;
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
  var matches = extractInjectedFunctions(file);

  // only require file if there is something exported inside
  var required = matches.then(function(matches) {
    if(!matches || !matches.length) return;
    return require(path.resolve(file));
  });

  return Promise.join(required, matches, function(required, matches) {
    if(!required) return [];

    // make sure all annotated objects are exported
    var exported;
    if('[object Object]' == Object.prototype.toString.call(required)) {
      exported = Object.keys(required);
      matches.forEach(function(match) {
        if(exported.indexOf(match.name) == -1) {
          throw new Error('Object '+match.name+' is annotated in file '+file+' but has not been exported');
        }
      });
    } else if('function' === typeof required) {
      var fnName = getFunctionName(required);
      required[fnName] = required;
    } else {
      // module.exports = <array | string | number | NaN | null>
      // transform the required primitive into an object {exportedName: exportedPrimitive}
      if(matches.length !== 1) {
        throw new Error(file+' contains annotation but nothing has been exported');
      }
      var exported = required;
      required = {};
      required[matches[0].exportedName] = function() { return exported; };
    }


    return matches.map(function(match) {
      var deps;
      if(match.dependencies) {
        deps = match.dependencies.concat([required[match.name]]);
      } else if(match.autoinject) {
        deps = required[match.name || match.exportedName];
      } else if(match.autoexport) {
        deps = function() { return required[match.name]; }
      }

      return {
        name: match.exportedName,
        define: deps
      }
    });

  });
}

module.exports.extractInjectedFunctions = extractInjectedFunctions;
module.exports.extractModulesFromFile = extractModulesFromFile;
