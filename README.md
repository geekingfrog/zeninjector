# ZenInjector

<a href="https://app.wercker.com/project/bykey/3fbf7f806e16276cbf6e0f6ab2d6aa20"><img alt="Wercker status" src="https://app.wercker.com/status/3fbf7f806e16276cbf6e0f6ab2d6aa20/m/master" align="right"></a>

### A simple library for dependency injection with support for ES6 generators.

## Dependency what ?
With dependency injection, one doesn't care how to retrieve dependencies as long as they comply with a given interface. This allow you to decouple each components from each others. You don't need to know which implementation of `express` or `fs` you're using.
This allow easy mocking of objects for testing for example.
Using dependency injection, you create once a container which will manage all the components of your application, and make them available where they are needed.


## Use cases
You should use `zeninjector` when

* You want to decouple your components from each others
* You want to integrate into one namespace a lot of components
* You need to dynamically add components to your code without branching the whole repo.
* You want to be able to do (more) unit tests on your code.

## Example
Below, a typicall example of any node.js program:

```javascript
// file module1.js
var dep1 = require('./dep1');
var dep2 = require('./dep2');
module.exports.myModuleName = dep1 + dep2;
```

## Two flavors
You can rewrite this snippet of code with `zeninjector` using it programmatically or with annotations.

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
Let's have a look at an example where you need to connect to a database:

```javascript
// file db.js
var MongoClient = require('mongodb').MongoClient;
var db;
module.exports.connect = function connect(callback) {
  if(db) {
    process.setImmediate(function() { callback(null, db); });
  } else {
      MongoClient.connect("mongodb://localhost:27017/exampleDb", function(err, _db) {
        db = _db;
        callback(err, db);
      });
  }
};
```

There is a problem here, everytime one wants to connect to the database, `connect` has to be called first and your code ends up in another callback (hello callback hell).
With `zeninjector`, a module can returns a promise, and the result of this promise will be injected as dependecy:

```javascript
var MongoClient = require('mongodb').MongoClient;

// @autoinject
module.exports.db = function(Promise) {
  // inject a Promise library
  var connect = Promise.promisify(MongoClient.connect);
  return connect("mongodb://localhost:27017/exampleDb");
}
```

```javascript
// @autoinject
module.exports.myOtherModule = function(db) {
  // db here is the database object ready to be used
}
```


## With generators
`resolve` and `inject` returns a promise so it can easily be used in coroutines. Below is the asynchronous example written with generators:

```javascript
var Promise = require('bluebird');
Promise.coroutine(function* () {
  yield container.scan('**/*.js'); // scan the db.js file
  
  try {
    var db = yield container.resolve('db');
    var foo = db.collection('foo');
    //...
  } catch(err) {
    console.error('Got error:', err);
  }
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

