let loaded = false;

let pyodide;

const wheel = require('fs').readFileSync(require('path').join(__dirname, './lib.whl'));
const script = require('fs').readFileSync(require('path').join(__dirname, './script.py')).toString();

globalThis.Blob = require('buffer').Blob;

async function load(cwd) {
  if (loaded) return;
  pyodide = await require('pyodide').loadPyodide();
  pyodide.unpackArchive(wheel.buffer, 'wheel');
  const mountDir = '/mnt';
  pyodide.FS.mkdir(mountDir);
  pyodide.FS.mount(pyodide.FS.filesystems.NODEFS, {root: '.'}, mountDir);
}

module.exports = async function compile(cwd, source, destination) {
  try {
    await load(cwd);
    pyodide.globals.set('source', require('path').posix.join('/mnt', source));
    pyodide.globals.set('destination', require('path').posix.join('/mnt', destination));
    pyodide.runPython(script);
  }
  catch (error) {
    throw new Error(error.stack);
  }
}

//module.exports(__dirname, './test/test.py', './test.js');
