const { dirname, extname, resolve, join } = require('path')

let tempCache;
let tempDir;
//let bufferLength;
//const moduleCache = {};
//const transpiledCache = {};

const compile = require('node-syncify').build(require.resolve('./compile.js'));

function compilePy(cwd, source, destination) {
  process.chdir(cwd);
  try {
    compile(cwd, source, destination);
    return {};
  }
  catch (error) {
    return {stderr: error};
  }
}

function replace_dot(item, index, array) {
  if (index === 0) return item;
  else if (array.length === (index + 1)) return '-' + item;
  return '.' + item;
}

const openSync = (options) => {
  const suffix = options.suffix;
  delete options.suffix;
  const path = require('temp').path(options).split('.').map(replace_dot).join('') + suffix;
  require('fs').writeFileSync(path, '');
  return {path};
}

const getTemp = (rootPath) => {
  if (tempCache) return tempCache;
  rootPath = require('path').join(rootPath, '__pycache__');
  if (!require('fs').existsSync(rootPath)) require('fs').mkdirSync(rootPath);
  tempCache = [require('temp').track()];
  tempDir = tempCache[0].mkdirSync({dir: rootPath, prefix: 'python-cache-'});
  tempCache[1] = openSync({dir: tempDir, suffix: '.js'}).path;
  //const buffer = Buffer.from(rapydscript_variables + require('fs').readFileSync(join(require.resolve('rapydscript-ng'), '../../release/baselib-plain-pretty.js')).toString() + '\nmodule.exports = function (module, exports, rapydscript_module) {\nrapydscript_module(' + module_variables + ')\n};');
  //bufferLength = buffer.length;
  //require('fs').writeFileSync(tempCache[1], buffer);
  process.on('SIGINT', () => process.exit()); //This fixes mkdirSync not deleting directory when CTRL-C'ed
  return tempCache;
}

let transpiledTemp;
let moduleTemp;
let lockTemp;
let appendTranspiled;
let appendModule;

const getCache = (rootPath) => {
  let is_stale = false;
  if (!transpiledTemp) transpiledTemp = join(require('os').tmpdir(), 'rapydscript-transpiled-cache-' + Buffer.from(rootPath).toString('base64'));
  if (!moduleTemp) moduleTemp = join(require('os').tmpdir(), 'javascripthon-module-cache-' + Buffer.from(rootPath).toString('base64'));
  if (!lockTemp) lockTemp = join(require('os').tmpdir(), Buffer.from(rootPath + '-javascripthon').toString('base64'));
  if (!require('fs').existsSync(lockTemp)) {
    require('fs').writeFileSync(lockTemp, '');
    require('proper-lockfile').lockSync(lockTemp, {stale: 30 * 1000});
  }
  else if (!require('proper-lockfile').checkSync(lockTemp, {stale: 30 * 1000})) {
    is_stale = true;
    require('proper-lockfile').lockSync(lockTemp, {stale: 30 * 1000});
  }
  if (!require('fs').existsSync(transpiledTemp) || is_stale) {
    require('fs').writeFileSync(transpiledTemp, '"":""');
  }
  if (!require('fs').existsSync(moduleTemp) || is_stale) {
    require('fs').writeFileSync(moduleTemp, '"":""');
  }
  if (!appendTranspiled) appendTranspiled = (key, value) => require('fs').appendFileSync(transpiledTemp, ',' + JSON.stringify({[key]: value}).slice(1, -1));
  if (!appendModule) appendModule = (key, value) => require('fs').appendFileSync(moduleTemp, ',' + JSON.stringify({[key]: value}).slice(1, -1));  
  return [JSON.parse('{' + require('fs').readFileSync(transpiledTemp).toString() + '}'), JSON.parse('{' + require('fs').readFileSync(moduleTemp).toString() + '}')];
}

const defaultOptions = {}

const applyTransform = (p, t, state, value, calleeName, moduleString) => {
  const ext = extname(value)
  const options = Object.assign({}, defaultOptions, state.opts)
  const rootPath = state.file.opts.sourceRoot || process.cwd()
  const [transpiledCache, moduleCache] = getCache(rootPath);
  const scriptDirectory = dirname(resolve(transpiledCache[state.file.opts.filename] || state.file.opts.filename))
  const filePath = resolve(scriptDirectory, value)
  if (ext !== '.py' && ext !== '.pyj') {
    if (transpiledCache[state.file.opts.filename] && (ext || value.startsWith('.'))) moduleString.replaceWith(t.StringLiteral(filePath))
    return
  }
  if (moduleCache[filePath]) return moduleString.replaceWith(t.StringLiteral(moduleCache[filePath]))
  const fullPath = filePath
  let [temp, tempFile] = getTemp(rootPath)
  if (process.platform === 'win32') tempFile = tempFile.split('\\').join('\\\\');
  const tempPath = openSync({dir: tempDir, suffix: '.js'}).path
  //const newTempPath = openSync({dir: tempDir, suffix: '.js'}).path
  //let python_code = require('fs').readFileSync(fullPath).toString()
  const below_14 = parseInt(process.version.split('.')[0].slice(1)) < 14;
  if (!below_14) require('fs').copyFileSync(fullPath, require('path').join(tempDir, require('path').basename(fullPath)));
  const out = below_14 ? require('child_process').spawnSync('python3' , ['-m', 'metapensiero.pj', fullPath, '-o', tempPath]) : compilePy(tempDir, require('path').basename(fullPath), require('path').basename(tempPath))
  if (out.stderr && out.stderr.toString()) {
    throw /*new Error*/p.buildCodeFrameError('Failed to transpile ' + fullPath + '\n' + out.stderr.toString());
  }
  /*let code = require('fs').readFileSync(tempPath);
  code = 'require("' + tempFile + '")(module, module.exports, function (' + module_variables + ') {\n' + code + '\n});'
  require('fs').writeFileSync(tempPath, code)*/
  moduleString.replaceWith(t.StringLiteral(tempPath))
  //moduleCache[fullPath] = tempPath
  appendModule(fullPath, tempPath);
  //transpiledCache[/*(process.platform === 'darwin' ? '/private' : '') +*/ tempPath] = fullPath
  appendTranspiled(tempPath, fullPath)
  if ((!process.env.BABEL_ENV || process.env.BABEL_ENV !== 'development') && (!process.env.NODE_ENV || process.env.NODE_ENV !== 'development')) return
  require('fs').watchFile(fullPath, () => {
    try {
      console.log('\n' + fullPath + ' changes, recompiling...\n')
      //let python_code = require('fs').readFileSync(fullPath).toString()
      //const out = require('child_process').spawnSync(process.execPath , [join(require.resolve('rapydscript-ng'), '../../bin/rapydscript'), 'compile', '-m',  '-o',  newTempPath], {input: python_code})
      const below_14 = parseInt(process.version.split('.')[0].slice(1)) < 14;
      if (!below_14) require('fs').copyFileSync(fullPath, require('path').join(tempDir, require('path').basename(fullPath)));
      const out = below_14 ? require('child_process').spawnSync('python3' , ['-m', 'metapensiero.pj', fullPath, '-o', tempPath]) : compilePy(tempDir, require('path').basename(fullPath), require('path').basename(tempPath))
      if (out.stderr && out.stderr.toString()) throw new Error(out.stderr.toString());
      /*code = require('fs').readFileSync(newTempPath).toString();
      code = 'require("' + tempFile + '")(module, module.exports, function (' + module_variables + ') {\n' + code + '\n});'
      require('fs').writeFileSync(tempPath, code)*/
    }
    catch (error) {
      console.error(p.buildCodeFrameError('Failed to transpile ' + fullPath + '\n' + error.toString()));
    }
  });
}

function transformImportsInline ({ types: t }) {
  return {
    visitor: {
      ImportDeclaration (p, state) {
        applyTransform(p, t, state, p.node.source.value, 'import', {replaceWith: (ast) => (p.node.source = ast)})
      },
      CallExpression (p, state) {

        const callee = p.get('callee')
        if (!callee.isIdentifier()) return
        if (!callee.equals('name', 'require')) {
          //if (callee.equals('name', 'async') || callee.equals('name', 'asynchronous')) applyAsync(state, p.get('arguments')[0])
          return
        }

        const arg = p.get('arguments')[0]
        if (!arg || !arg.isStringLiteral()) {
          return
        }

        applyTransform(p, t, state, arg.node.value, 'require', arg)
      }
    }
  }
}

module.exports = transformImportsInline
module.exports.transformImportsInline = transformImportsInline
