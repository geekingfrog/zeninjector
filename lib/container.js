'use strict';

var Promise = require('bluebird');
var extractor = require('./extractDep');

var Container = function(options) {
  this._modules = {};

  this.options = options || {};
  this.logger = this.options.logger;
  if(!this.logger) {
    this.logger = console;
    console.debug = console.debug || console.log;
    console.trace = console.trace || console.log;
  }
};

var ModuleError = function(message) {
  Error.call(this);
  this.message = message;
}

require('util').inherits(ModuleError, Error);

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
    throw new ModuleError('Invalid module: '+JSON.stringify(module));
  }

  if(!module.name) {
    throw new ModuleError('Module must have a name');
  }

  if(!module.define || typeof module.define !== 'function') {
    throw new ModuleError('Module ('+module.name+') must have a `define` function');
  }

  this.name = module.name;
  this.dependencies = module.dependencies || [];
  this.define = module.define;
  this.state = 'registered';
  this.exported = null;
}

var registerModule = function(module, container) {
  // container.logger.debug('registering %s', module.name);
  if(container._modules[module.name]) {
    throw new ModuleError('Module '+module.name+' is already registered');
  }

  module.dependencies.forEach(function(dep) {
    if(!container._modules[dep]) {
      throw new ModuleError('Dependency error: '+dep+' is required by '+module.name);
    }
  });

  container._modules[module.name] = module;

};

// Register a module
// @params {String} name: the unique name
// @params {Array<String..., Function> / Function} deps:
// This parameter can be a function or an array of string with the last
// element of the array to be the function to register the module
// If it's a function, the dependencies will be guessed from the code of
// the function (see extractor)
Container.prototype.register = function(name, deps) {

  if(!name || 'string' !== typeof name) {
    throw new ModuleError('Must have a name');
  }

  if(!deps) {
    throw new ModuleError('Must give a function');
  }

  var dependencies, fn;
  if('function' === typeof deps) {
    fn = deps;
    dependencies = extractor(fn);
  } else {
    dependencies = deps.slice(0, -1);
    fn = deps[deps.length-1];
  }

  if('function' !== typeof fn) {
    throw new ModuleError('Must give a function');
  }

  if(this._modules[name]) {
    throw new ModuleError(name+' already registered');
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

Container.prototype.resolve = Promise.coroutine(function* (name) {
  var module = this._modules[name];
  if(!module) { throw new ModuleError('No module `'+name+'` registered'); }

  if(module.state === 'resolving') {
    throw new ModuleError('Circular dependency detected with '+name);
  }

  module.dependencies.forEach(function(dep) {
    if( !this._modules[dep] ) {
      throw new ModuleError('Dependency not found: '+dep);
    }
  }, this);

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

  dependencies = yield dependencies;

  var exported = yield Promise.try(module.define, dependencies);
  module.state = 'resolved';
  module.exported = exported;
  this._modules[name] = module;

  return exported;
});

module.exports = Container;
