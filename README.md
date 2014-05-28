# ZenInjector

<a href="https://app.wercker.com/project/bykey/3fbf7f806e16276cbf6e0f6ab2d6aa20"><img alt="Wercker status" src="https://app.wercker.com/status/3fbf7f806e16276cbf6e0f6ab2d6aa20/m/master" align="right"></a>

### A simple library for `zenijnector` injection with promises.

## Dependency what ?
This library is meant to ease unit testing of your node application. Sometimes you need to mock some standard modules like `fs` or `express`, and more generally, it's hard to mock things when your code is full of `require`.
Using dependency injection, you create once a container which will manage all the components of your application, and make them available where they are needed.


## Use cases
You should use `zeninjector` when

* You want to be able to do (more) unit tests on your code.
* You want to integrate into one namespace a lot of components
* You need to dynamically add components to your code without branching the whole repo.

## Two flavors
`Zeninjector` can be used programmatically or with annotations.

### Programmatic usage
**Create** the [IOC](http://en.wikipedia.org/wiki/Inversion_of_control) container:
```javascript
var Zeninjector = require('zeninjector');
var container = new Zeninjector();
```

**Register** a module with some dependencies:
```javascript
container.register('myModuleName', function(dep1, dep2) {
  return dep1+dep2;
});

// alternative syntax
container.register('myModuleName', ['dep1', 'dep2', function(dep1, dep2) {
  // with this syntax, you can name the function's arguments whatever you like
  return dep1+dep2;
}]);
```

**Directly register** a module with no dependency:
```javascript
container.registerAndExport('myConfigObject', {
  env: 'test',
  port: 8080
});

// it works great with `require` too
container.registerAndExport('Promise', require('bluebird'));
```

**Resolve a module** with its dependencies:
```javascript
container.resolve('myModuleName').then(function(module) {
    // here module is equal to `dep1+dep2`
})
```
`Zeninjector#resolve` returns a [bluebird promise]('https://github.com/petkaantonov/bluebird'), thus the need to have a `then`.

**Inject** dependencies to an anonymous function, because sometimes you just want to access some objects once, but still want all the goodness of the IOC.
```javascript
container.inject(function(myConfigObject, dep1) {
  console.log('current env %s, dep1 equals: %s', myConfigObject.env, dep1);
});

// this also works
container.inject(['myConfigObject', 'dep1', function(config, dep) {
  // ...
}]);
```

### Annotations
You still have to **create** the container:
```javascript
var Zeninjector = require('zeninjector');
var container = new Zeninjector();
```

**Scan** your projects to automatically register all dependencies:
```
var scan = container.scan([__dirname+'/lib/**/*.js', __dirname+'/ext/**/*.js']);
```
This returns a bluebird promise. Once it's done, you can use `Zeninjector#inject` and `Zeninjector.resolve` to get a reference to your defined objects.

**Define** a module with dependencies:
```javascript
//@autoinject
module.exports.myModuleName = function(dep1, dep2) {
  return dep1+dep2;
};
```

With **custom name** and **custom dependencies**:
```javascript
//@autoinject(name=myModuleName; dependencies=dep1,dep2)
module.exports.thisNameIsIrrelevant = function(a, b) {
  return a+b;
};
```
This example has exactly the same effect as the previous one.

Automatically **exports** (similar to `Zeninjector#registerAndExport`):
```javascript
//@autoexport
module.exports.myConfigObject = {
  env: 'test'
};
```

## Asynchronous definitions
If a module needs to do some asynchronous action at construction (connecting to a database for example), instead of returning a javascript object (or function), it has to returns a *Promise*. The resolved value of the promise will be the value of the module when requested by others modules.

```javascript
// Example of asynchronous definition
container.register('foo', function() {
  return Promise.delay(1000).resolve('foo!'); // wait one second before resolving
});
container.register('bar', function(foo) {
  return foo+'bar'; // here `foo` will have the resolved value of 'foo!'
});
container.inject(function(bar) {
  console.log(bar); // output foo!bar after one second.
});
```

## With generators
`resolve` and `inject` returns a promise so it can easily be used in coroutines. Below is the asynchronous example written with generators:

```javascript
var Promise = require('bluebird');
Promise.coroutine(function* () {
  container.register('foo', function() {
    return Promise.delay(1000).resolve('foo!'); // wait one second before resolving
  });
  
  container.register('bar', function(foo) {
    return foo+'bar'; // here `foo` will have the resolved value of 'foo!'
  });
  
  var bar = yield container.resolve(bar);
  assert(bar === 'foo!bar');

})();
```
This example requires node `>=0.11.4` with the flag `--harmony-generators`.

## Running tests
```
npm install && npm test
```

# API

##### `new Zeninjector(Object options)` -> `container`
The `options` object currently supports:

* `logger` an optional logger (default to the console). The logger must implement the methodes `trace`, `debug`, `info`, `warn`, `error` and `fatal`.

---
##### `.register(String name, FunctionDefinition)` -> `undefined`
This function will register the dependency `name`. `FunctionDefinition` can be a function or an array of Strings, with its last element being a function. The array variant is the same as [require.js](http://requirejs.org/docs/api.html#defdep). If only a function is provided, the name of the arguments will be used to fetch the dependencies, same is [angularJS implicit dependencies](https://docs.angularjs.org/guide/di).

When this module is required, the given `FunctionDefinition` function will be called and it's return value will be used as the value of the module `name`. If it returns a promise, the resolved value of the promise will be taken.

---
##### `.registerAndExport(String name, Any value)` -> `value`
This is a shorthand to `container.register(name, function() { return value; });`

---
##### `.resolve(String name)` -> `promise`
This will activate the `define` function for the dependency with `name`. The returned promise will resolve to the return value of the `define` function.

---
##### `.inject(FunctionDefinition)` -> `Promise`
This will invoke the given function with its arguments already resolved.

---
##### `.scan(Array patterns)` -> `promise`
Scan takes an array of file glob patterns (or a single string) and returns a promise which resolves when all the files have been scanned.
Scan will look for `//@autoinject` and `//@autoexport` inside every files, and take the following function's name as the module name. This method allow to manage large project without having to pass around the `container` object and do the registration by yourself.

Annotations can be used to define a custom name for the module and specify dependencies explicitely:
```
//@autoinject(name=customName, dependencies=dep1,dep2)
// dependencies are comma (,) separated
```

The following patterns are supported to declare your module with annotations:
```javascript
module.exports = {
  //@autoinject
  a: function() {}
}

//@autoinject
module.exports.b = function() {
  return 'baz';
};

//@autoinject
var c = function() {};

//@autoinject

function d() {};

//@autoinject
function e() {};
// /!\ this will raise an error if you try to require it
// .scan's promise will be rejected here.


function f() {}; // will NOT be exported

//@autoinject
module.exports = function g() {};

```

# License
MIT
