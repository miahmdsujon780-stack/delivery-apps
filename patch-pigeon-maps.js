import fs from 'fs';
const files = ['node_modules/pigeon-maps/lib/index.esm.js', 'node_modules/pigeon-maps/lib/index.cjs.js'];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/function Map\(props\) {/g, 'function Map(props) {\n  if (!props) props = {};\n');
    content = content.replace(/function ZoomControl\(_ref\) {/g, 'function ZoomControl(_ref) {\n  if (!_ref) _ref = {};\n');
    content = content.replace(/function Marker\(props\) {/g, 'function Marker(props) {\n  if (!props) props = {};\n');
    content = content.replace(/function Overlay\(props\) {/g, 'function Overlay(props) {\n  if (!props) props = {};\n');
    fs.writeFileSync(file, content);
  }
});
console.log('patched pigeon-maps');
