import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {JSDOM} from 'jsdom';
const require=createRequire(new URL('../dashboard/package.json',import.meta.url));
const resolved=name=>pathToFileURL(require.resolve(name)).href;
async function jsxModule(file){
  const vite=await import(pathToFileURL(require.resolve('vite/package.json').replace(/package\.json$/,'dist/node/index.js')).href);
  const source=await readFile(new URL(file,import.meta.url),'utf8');
  const result=await vite.transformWithEsbuild(source,file,{loader:'jsx',jsx:'automatic'});
  const code=result.code.replace(/from "(react(?:\/jsx-runtime)?|react-dom)"/g,(_m,name)=>`from "${resolved(name)}"`).replace(/from '(react(?:\/jsx-runtime)?|react-dom)'/g,(_m,name)=>`from '${resolved(name)}'`);
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
test('custom dropdown supports keyboard selection, disabled options, escape and outside click',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
  const previous={};for(const key of ['window','document','navigator','HTMLElement']){previous[key]=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});}
  const {default:React,act}=await import(resolved('react'));
  const {createRoot}=await import(resolved('react-dom/client'));
  const {default:Select}=await jsxModule('../dashboard/src/components/Select.jsx');
  const root=createRoot(document.getElementById('root'));globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  let selected;
  try{
    await act(async()=>root.render(React.createElement(Select,{'aria-label':'Role',defaultValue:'member',onChange:e=>{selected=e.target.value;}},[
      React.createElement('option',{key:'member',value:'member'},'Member'),React.createElement('option',{key:'disabled',value:'disabled',disabled:true},'Disabled'),React.createElement('option',{key:'admin',value:'admin'},'Admin'),
    ])));
    const button=document.querySelector('[role=combobox]');assert.equal(button.textContent.includes('Member'),true);
    await act(async()=>button.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})));
    assert.equal(button.getAttribute('aria-expanded'),'true');assert.ok(button.getAttribute('aria-activedescendant').endsWith('-2'));
    await act(async()=>button.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
    assert.equal(selected,'admin');assert.equal(button.getAttribute('aria-expanded'),'false');
    await act(async()=>button.click());await act(async()=>button.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));assert.equal(document.querySelector('[role=listbox]'),null);
    await act(async()=>button.click());await act(async()=>document.body.dispatchEvent(new window.Event('pointerdown',{bubbles:true})));assert.equal(document.querySelector('[role=listbox]'),null);
  }finally{await act(async()=>root.unmount());dom.window.close();delete globalThis.IS_REACT_ACT_ENVIRONMENT;for(const [key,descriptor] of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
