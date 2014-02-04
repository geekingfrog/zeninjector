'use strict';

var Promise = require('bluebird');

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

  container._modules[module.name] = module;

};

Container.prototype.register = function(modules) {
  if(modules === null || modules === void 0) { return; }

  if(!Array.isArray(modules)) {
    modules = [ modules ];
  }

  modules = modules.map(function(module) {
    return new Module(module);
  });

  modules.forEach(function(mod) {
    registerModule(mod, this);
  }, this);

};

// shortcut to register a npm module
Container.prototype.registerNpm = function(name) {
  this.register({
    name: name,
    define: function() { return require(name); }
  });
};


Container.prototype.get = Promise.coroutine(function* (name) {
  var module = this._modules[name];
  if(!module) { throw new ModuleError('No module `'+name+'` registered'); }

  module.state = 'resolving';

  var container = this;
  var dependencies = module.dependencies.map(function(dep) {
    return this._modules[dep];
  }, this).map(function (dep) {
    if(dep.state === 'registered') {
      return container.get(dep.name);
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
