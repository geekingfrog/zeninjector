'use strict';
var _ = require('lodash');

module.exports.detectCycle = function detectCycle(modules) {

  // check if a module requires itself
  var stupidModules = _.map(modules, function(m) {
    if(m.dependencies.indexOf(m.name) !== -1) {
      return m;
    }
  }).filter(function(m) { return m; });

  if(stupidModules.length) {
    return stupidModules.map(function(m) {
      return [m];
    });
  }

  // Below is an implementation of the Tarjan's algorithm
  // to find strongly connected components (SCC) in a graph.
  // This will populate the array SCC. Each element is a strongly
  // connected compontent.
  // Since cycles with only one vertex are taken care of, there are
  // cycles if any SCC has a length > 1
  // http://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm
  var SCC = [];
  var V = _.map(modules, function(m) {
    return {
      name: m.name,
      dependencies: m.dependencies,
      isInStack: false,
      index: undefined,
      lowLink: undefined
    }
  });

  var stack = [];
  var index = 0;

  V.forEach(function(v) {
    if(v.index === undefined) strongconnect(v);
  });

  function getModule(name) {
    return _.find(V, function(m) { return m.name === name; });
  }

  function strongconnect(v) {
    v.index = index;
    v.lowLink = index;
    index++;
    stack.push(v);
    v.isInStack = true;

    // consider each successor of v
    v.dependencies.forEach(function(w) {
      var wName = w;
      w = getModule(w);
      if(!w) {
        throw new Error('Missing dependency '+wName);
      }

      if(w.index === undefined) {
        // the module w has not yet been visited, recurse on it
        strongconnect(w);
        v.lowLink = Math.min(v.lowLink, w.lowLink);
      } else if(w.isInStack) {
        // successor w is in stack, and hence in the current SCC
        v.lowLink = Math.min(v.lowLink, w.index);
      }
    });

    // if v is a root node, pop the stack and generate an SCC
    if (v.lowLink === v.index) {
      var w;
      var currentSCC = [];
      do {
        w = stack.pop();
        w.isInStack = false;
        currentSCC.push(w);
      } while(w !== v);
      SCC.push(currentSCC);
    }
  }

  // finally, return an array of cycles
  // a cycle is an array of module with length > 1
  return SCC.map(function(scc) {
    return scc.map(function(m) {
      return _.find(modules, function(module) {
        return module.name === m.name;
      });
    })
  }).filter(function(cycle) { return cycle.length > 1; });

}
