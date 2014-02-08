# ZenInjector

A simple library for dependency enjection using es6's generators.

# Generators inside /!\
For this library, `node >= 0.11.9` is required and the application should be run with the flag `--harmony`.

# Usage

```javascript
var container = new require('zeninjector');

// register a module
container.register('config', function() {
  return {
    db: {url: 'mongodb://localhost:27017/myapp'}
  }
});

// get the module
var Promise = require('bluebird');
Promise.spawn(function* () {
  var dbUrl = (yield container.resolve('config')).db.url;
});
```

## Registering a module
A module is an object with a unique `name`, an optional array of `dependencies`, and a function `define` which returns the module. The dependencies are lazily loaded, so `define` will only be called when it is needed. It is similar to [angularJS DI system](http://docs.angularjs.org/guide/di) or [require.js](http://requirejs.org/) syntax.

**More complex example**

```javascript
var Promise = require('bluebird');
var MongoClient = require('mongodb').MongoClient;

container.register('db', function(config) {
  var connect = Promise.promisify(MongoClient.connect, MongoClient);
  return connect(config.db.url);
});

Promise.spawn(function* () {
  try {
    var db = yield container.resolve('db'); // connect to the db here
    // ... use the db object here
  } catch(err) {
    console.error('cannot connect to db', err);
  }
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
Promise.spawn(function* () {
  var fs = yield container.registerAndExport('fs', require('fs'));
});
```

# Run tests
`npm test`, or `mocha --harmony --ui tdd --reporter spec` if you have mocha installed as a global module.
