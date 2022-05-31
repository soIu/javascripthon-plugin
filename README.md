# babel-plugin-python
Babel plugin to load Python (Javascripthon) code

# Installation

```
npm install babel-plugin-python
```

Then add 'python' to your babel plugins wether it's on babelrc, babel.config.json or if you use a bundler usually they add directives for you to add babel plugins (if the bundler use babel or is configured to use babel as a loader).

# Example Usage

In any of your JS code, require a py file:

```js
//index.js

//Either ES6 import or CommonJS' require works, dynamic import is still on the work
import from_python from './test.py';
const same_object_from_python = require('./test.py');

console.log(from_python === same_object_from_python);
console.log(from_python);
```

And in your Python code:

```python
#test.py

def some_function():
    print('I log some string')
    return 'and return another string'
    
class SomeClass:
    some_class_property = [1, {}]
    another_property = 'could be anything'
    
    def __init__(self):
        self.some_object_property = 'not a class one'
    
module.exports = [some_function, SomeClass(), SomeClass.some_class_property, SomeClass().some_object_property, some_function()]
```

# Known Limitation

We choose to make this module a babel plugin instead of a webpack loader because we want to target bundlers as much as possible. Unfortunately making this plugin to be compatible to all bundler forces us to make some sacrifices:

- Because most bundlers ignore loading files outside of project directory to babel loader and sometimes ignore them too in node_modules, there will be some `python-cache-*` folders that are created on project root during transpilation.
- Not only the most compatible location is on project root, but metro bundler seems to be a bitch in handling files/folders that have a dot at the start of the name. So the `python-cache-*` folders can't be hidden with dot (unix).
- Fortunately these folders will only appear at transpilation. This doesn't have major effects when building for production, but at development (watch mode) the folders will be there until you stop the dev server. Feel free to add `python-cache-*` to .gitignore to prevent acidentally adding them to your commits.
