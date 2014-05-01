# ZenInjector

A simple library for dependency injection with promises.

# Usage

```javascript
var container = new require('zeninjector');

// register a module
container.register('config', function() {
  return {
    db: {url: 'mongodb://localhost:27017/myapp'}
  }
});

// or, if the module has no dependency, you can also
// do that
container.registerAndExport('config', {
  db: { url: 'mongodb://localhost:27017/myapp' }
});

// get the module
container.resolve('config').then(function(config) {
  var dbUrl = config.db.url;
  // do something with it
});
```

## Registering a module
`container.register(String name, Function defineFunction)`
`container.register(String name, [String dependencies..., Function defineFunction)]`
To register a module, you call `container.register`, gives a name as the first
argument, and a function which returns
the module. You can also pass an array as the second argument. In this case, all
the elements of the array are the name of the dependencies, and the last element
is the `define` function. This is similar to
[angularJS DI system](http://docs.angularjs.org/guide/di)
or [require.js](http://requirejs.org/) syntax.
The dependencies are lazily loaded, so `define` will only be called when it is
needed.

**More complex example**

```javascript
var MongoClient = require('mongodb').MongoClient;

container.register('db', function(config) {
  var connect = Promise.promisify(MongoClient.connect, MongoClient);
  return connect(config.db.url);
});

container.resolve('db').then(function(db) { // connect to the db here
  // ... use the db object here
}, function onError(err) {
  console.error('cannot connect to db', err);
});
```

If you prefer, dependencies can also be explicitely written out:

```javascript
container.register('db', ['config', function(config) {
  var connect = Promise.promisify(MongoClient.connect, MongoClient);
  return connect(config.db.url);
}]);
```

Sometimes, you want to add an already existing object to the container, for example
an NPM module or something from another library. There is a shortcut for this:

```javascript
var fs = container.registerAndExport('fs', require('fs'));
```

## With an anonymous function
Sometimes, you don't want to register a module just to execute some code with a given set of dependencies. In this case, you can use `.inject` and the container will resolve the dependencies for you and execute the given function.

```javascript
container.inject(function add(a, b) {
  return a+b;
}).then(function(answer) {
  console.log('The answer is: %d', answer);
});
```

## Scanning a whole project
`container.scan([options,] patterns)` has the same signature as [Grunt globbing patterns](http://gruntjs.com/api/grunt.file#globbing-patterns) and will scan all the javascript files to automatically register dependencies. To take advantage of this powerful feature, you must add a comment on a single line with `@autoinject` just before the function declaration. Some example of how achieve that:

```javascript
// file "module.js"
module.exports = {
  //@autoinject
  a: function() { return 'a';}
}

//@autoinject
module.exports.b = function() {
  return 'baz';
};

//@autoinject
var c = function() {};
module.exports.c = c;

//@autoinject
function d() {};
module.exports.d = d;
```

Then, calling `container.scan(['module.js'])` will automatically register all the modules `a` through `d`. You can then use them as if you called `container.register('a', function() {/*...*/})` for each of them.
Note that you must export the autoinjected functions for this to work, otherwise you'll get an error.

## With generators
`resolve` and `inject` returns a promise so it can easily be used in coroutines. Below is the 'complex' example above rewritten using coroutines.

```javascript
var Promise = require('bluebird');
Promise.coroutine(function* () {
  var MongoClient = require('mongodb').MongoClient;
  container.register('db', function(config) {
    var connect = Promise.promisify(MongoClient.connect, MongoClient);
    return connect(config.db.url);
  });

  try {
    var db = yield container.register('db');
    // use the db here
  } catch(err) {
    console.error('cannot connect to the db', err);
  }
})();
```

# Run tests
`npm test`, or `mocha --ui tdd --reporter spec` if you have mocha installed as a global module.

# API

`new Container(Object options)` -> `container`
The `options` object currently only support:
* `logger` an optional logger (default to the console). The logger must implement the methodes `trace`, `debug`, `info`, `warn`, `error` and `fatal`.

---
`container.register(String name, Function define)` -> `undefined`
This function will register the dependency `name`. When a module requires this dependency, the given `define` function will be called and it's return value will be used as the value of the module `name`. If the `define` function returns a promise, the resolved value of the promise will be taken.

---
`container.registerAndExport(String name, Any value)` -> `value`
This is a shorthand to `container.register(name, function() { return value; });`

---
`container.resolve(String name)` -> `promise`
This will activate the `define` function for the dependency with `name`. The returned promise will resolve to the return value of the `define` function.

---
`container.scan([Object options], Array patterns)` -> `promise`
Scan takes the same arguments as [`grunt.file.expand`](http://gruntjs.com/api/grunt.file#globbing-patterns) and returns a promise which resolve to `undefined` when all the files have been scanned.
Scan will look for `//@autoinject` inside every files, and take the following function's name as the module name. This method allow to manage large project without having to pass around the `container` object and do the registration by yourself.

# License
MIT
