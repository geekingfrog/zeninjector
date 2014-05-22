'use strict';

var Promise = require('./promise');
var _ = require('lodash');
var multiGlob = require('multi-glob');

var parser = require('./parser');
var extractor = require('./extractDep');
var detectCycle = require('./cycleDetection').detectCycle;

var Container = function(options) {
  this._modules = {};
  this._cycles = undefined;

  this.options = options || {};
  this.logger = this.options.logger;
  if(!this.logger) {
    this.logger = console;
    console.debug = console.debug || console.log;
    console.trace = console.trace || console.log;
  }
};

// Represent an object to be registered.
// The given hash should have the following keys:
//   name: (string)
//   dependencies (array of string): optional
//   define: the function to call when resolving the module
// It can be in 3 states:
//   registered: the initial state
//   resolving: when its dependencies are being resolved
//   resolved: it's `define` function has returned
var Module = function(module) {

  if(!module || typeof module !== 'object') {
    throw new Error('Invalid module: '+JSON.stringify(module));
  }

  if(!module.name) {
    throw new Error('Module must have a name');
  }

  if(!module.define || typeof module.define !== 'function') {
    throw new Error('Module ('+module.name+') must have a `define` function');
  }

  this.name = module.name;
  this.dependencies = module.dependencies || [];
  this.define = module.define;
  this.state = 'registered';
  this.exported = null;
}

// takes a function or an array
// [String, ..., String, function]
// and returns the list of dependencies and the
// function
function extractDependencies(deps) {
  var dependencies, fn;
  if('function' === typeof deps) {
    fn = deps;
    dependencies = extractor(fn);
  } else {
    dependencies = deps.slice(0, -1);
    fn = deps[deps.length-1];
  }
  return {
    dependencies: dependencies,
    fn: fn
  }
}

// Register a module
// @params {String} name: the unique name
// @params {Array<String..., Function> / Function} deps:
// This parameter can be a function or an array of string with the last
// element of the array to be the function to register the module
// If it's a function, the dependencies will be guessed from the code of
// the function (see extractor)
Container.prototype.register = function(name, deps) {

  // invalidate any cycle detection done so far
  this._cycles = undefined;

  if(!name || 'string' !== typeof name) {
    throw new Error('Must have a name');
  }

  if(!deps) {
    throw new Error('Must give a function for module '+name);
  }

  var extracted = extractDependencies(deps);
  var dependencies = extracted.dependencies;
  var fn = extracted.fn;

  if('function' !== typeof fn) {
    throw new Error('Must give a function for module '+name);
  }

  if(this._modules[name]) {
    throw new Error(name+' already registered');
  }

  this._modules[name] = new Module({
    name: name,
    dependencies: dependencies,
    define: fn
  });

  return;
};

// Method to register an already existing object, typically an npm module
// or an object coming from the outside
// container.registerAndExport('fs', require('fs'));
Container.prototype.registerAndExport = function(name, obj) {
  this.register(name, function() { return obj; });
  this._modules[name].state = 'resolved';
  this._modules[name].exported = obj;
  return obj;
};

Container.prototype.resolve = function(name) {
  var module = this._modules[name];
  if(!module) {
    return Promise.reject(new Error('No module `'+name+'` registered'));
  }

  if(module.state === 'resolved') { return Promise.resolve(module.exported); }

  try {
    module.dependencies.forEach(function(dep) {
      if( !this._modules[dep] ) {
        this.logger.warn('module %s not found', dep);
        throw new Error('Dependency not found: '+dep);
      }
    }, this);
  } catch(err) {
    return Promise.reject(err);
  }


  if(!this._cycles) {
    this._cycles = detectCycle(this._modules);
  }
  var cycles = this._cycles;

  if(cycles.length) {
    var prettyCycles = cycles.map(function(cycle) {
      var start = cycle[0];
      var prettyCycle = cycle.map(function(m) { return m.name; });
      prettyCycle.push(start.name);
      prettyCycle = prettyCycle.join(' -> ');
      return prettyCycle;
    }).join('\n');
    return Promise.reject(new Error(
      'Circular dependency detected with '+name+':\n'+prettyCycles
    ));
  }

  if(module.state === 'resolving') {
    return module.resolvingPromise;
  }

  module.state = 'resolving';

  var container = this;
  var dependencies = module.dependencies.map(function(dep) {
    return this._modules[dep];
  }, this).map(function (dep) {
    if(dep.state || dep.state === 'registered') {
      return container.resolve(dep.name);
    } else {
      return dep.exported;
    }
  });

  module.resolvingPromise = Promise.all(dependencies)
  .bind(this)
  .then(function(deps) {
    var exported = Promise.try(module.define, deps);
    module.state = 'resolved';
    module.exported = exported;
    this._modules[name] = module;
    return exported
  });

  return module.resolvingPromise;
};

// Manage dependencies for an anonymous function
// with an optional given context
Container.prototype.inject = function(fn, ctx) {
  if(!fn) return;
  var extracted = extractDependencies(fn);
  var dependencies = extracted.dependencies;
  fn = extracted.fn;

  dependencies = dependencies.map(function(dep) {
    return this.resolve(dep);
  }, this);

  return Promise.all(dependencies)
  .then(function(deps) {
    return fn.apply(ctx, deps);
  });

}

Container.prototype.scan = function(options, patterns) {
  if(!patterns) {
    patterns = options;
    options = {}
  }

  var files = Promise.promisify(multiGlob.glob)(patterns, options);

  return files.bind(this).then(function(files) {
    return files.map(parser.extractModulesFromFile);
  })
  .all()
  .then(function(modules) {
    modules = _.flatten(modules);
    return modules.map(function(module) {
      return this.register(module.name, module.define);
    }, this)
  })
  .all();

}

module.exports = Container;
