/**
 * CSP patch for the bundled OpenCV.js build.
 *
 * The site's Content-Security-Policy deliberately omits 'unsafe-eval', but
 * @techstark/opencv-js is an Emscripten embind build compiled with dynamic
 * execution: at wasm runtime init it generates every C++ binding's JS invoker
 * with `new Function(...)`. Under the production CSP that first generated
 * function throws, `window.cv` never finishes initialising, and the whole
 * card-crop feature dies with "The card detector could not load".
 *
 * Emscripten has a supported eval-free mode (-s DYNAMIC_EXECUTION=0) that
 * implements the same four helpers with plain closures instead of generated
 * source strings. The published OpenCV builds aren't compiled with it, so this
 * module ports those closure implementations and splices them into the dist
 * file at build time (see the cardpop-opencv-csp-patch plugin in
 * vite.config.js). Semantics are unchanged — only the codegen is gone:
 *
 *   • createNamedFunction        — named wrapper purely for stack traces; the
 *                                  closure just loses the display name.
 *   • makeDynCaller              — wasm function-pointer trampoline.
 *   • craftInvokerFunction       — the per-method embind invoker (the hot one:
 *                                  every cv.* call goes through these).
 *   • __emval_get_method_caller  — C++ → JS method calls via emval.
 *
 * Every pattern must match exactly once and no dynamic-codegen callsite may
 * survive, or patching throws — so an @techstark/opencv-js upgrade that
 * changes this glue fails the build loudly instead of shipping a crop feature
 * that only works with 'unsafe-eval'.
 */

const PATCHES = [
  {
    name: 'createNamedFunction',
    find: /function createNamedFunction\(name,body\)\{name=makeLegalFunctionName\(name\);return new Function\("body",[\s\S]*?\)\(body\)\}/,
    replace:
      'function createNamedFunction(name,body){name=makeLegalFunctionName(name);' +
      'return function(){"use strict";return body.apply(this,arguments)}}',
  },
  {
    name: 'makeDynCaller',
    // `rawFunction` stays in scope — makeDynCaller is defined inside
    // embind__requireFunction, whose parameter it is.
    find: /function makeDynCaller\(dynCall\)\{var args=\[\];[\s\S]*?return new Function\("dynCall","rawFunction",body\)\(dynCall,rawFunction\)\}/,
    replace:
      'function makeDynCaller(dynCall){return function(){' +
      'var args=[rawFunction];for(var i=0;i<arguments.length;++i){args.push(arguments[i])}' +
      'return dynCall.apply(null,args)}}',
  },
  {
    name: 'craftInvokerFunction',
    find: /function craftInvokerFunction\(humanName,argTypes,classType,cppInvokerFunc,cppTargetFunc\)\{[\s\S]*?var invokerFunction=new_\(Function,args1\)\.apply\(null,args2\);return invokerFunction\}/,
    replace:
      'function craftInvokerFunction(humanName,argTypes,classType,cppInvokerFunc,cppTargetFunc){' +
      'var argCount=argTypes.length;' +
      'if(argCount<2){throwBindingError("argTypes array size mismatch! Must at least get return value and \'this\' types!")}' +
      'var isClassMethodFunc=argTypes[1]!==null&&classType!==null;' +
      // Same rule as the generated version: a destructor stack is needed as
      // soon as any argument type has not declared a destructorFunction yet.
      'var needsDestructorStack=false;' +
      'for(var i=1;i<argTypes.length;++i){if(argTypes[i]!==null&&argTypes[i].destructorFunction===undefined){needsDestructorStack=true;break}}' +
      'var returns=argTypes[0].name!=="void";' +
      'var expectedArgCount=argCount-2;' +
      'return function(){' +
      'if(arguments.length!==expectedArgCount){throwBindingError("function "+humanName+" called with "+arguments.length+" arguments, expected "+expectedArgCount+" args!")}' +
      'var destructors=needsDestructorStack?[]:null;' +
      'var thisWired;' +
      'if(isClassMethodFunc){thisWired=argTypes[1].toWireType(destructors,this)}' +
      'var argsWired=new Array(expectedArgCount);' +
      'for(var i=0;i<expectedArgCount;++i){argsWired[i]=argTypes[i+2].toWireType(destructors,arguments[i])}' +
      'var rv=cppInvokerFunc.apply(null,isClassMethodFunc?[cppTargetFunc,thisWired].concat(argsWired):[cppTargetFunc].concat(argsWired));' +
      'if(needsDestructorStack){runDestructors(destructors)}' +
      'else{for(var i=isClassMethodFunc?1:2;i<argTypes.length;++i){' +
      'var param=i===1?thisWired:argsWired[i-2];' +
      'var dtor=argTypes[i].destructorFunction;' +
      'if(dtor){dtor(param)}}}' +
      'if(returns){return argTypes[0].fromWireType(rv)}}}',
  },
  {
    // Not codegen, but the same CSP: the wasm binary is embedded as a data:
    // URI, and getBinaryPromise tries fetch() on it first — which connect-src
    // blocks, logging a scary console error before the inline-decode fallback
    // succeeds. instantiateAsync already guards with !isDataURI; give
    // getBinaryPromise the same guard so nothing is ever fetched.
    name: 'getBinaryPromise data-URI guard',
    find: /function getBinaryPromise\(\)\{if\(!wasmBinary&&\(ENVIRONMENT_IS_WEB\|\|ENVIRONMENT_IS_WORKER\)&&typeof fetch==="function"\)/,
    replace:
      'function getBinaryPromise(){if(!wasmBinary&&(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER)&&!isDataURI(wasmBinaryFile)&&typeof fetch==="function")',
  },
  {
    name: '__emval_get_method_caller',
    find: /function __emval_get_method_caller\(argCount,argTypes\)\{[\s\S]*?return __emval_addMethodCaller\(invokerFunction\)\}/,
    replace:
      'function __emval_get_method_caller(argCount,argTypes){' +
      'var types=__emval_lookupTypes(argCount,argTypes);' +
      'var retType=types[0];' +
      'var argN=argCount-1;' +
      'var invokerFunction=function(handle,name,destructors,args){' +
      'var offset=0;' +
      'var callArgs=new Array(argN);' +
      'for(var i=0;i<argN;++i){callArgs[i]=types[i+1].readValueFromPointer(args+offset);offset+=types[i+1].argPackAdvance}' +
      'var rv=handle[name].apply(handle,callArgs);' +
      'for(var i=0;i<argN;++i){if(types[i+1].deleteObject){types[i+1].deleteObject(callArgs[i])}}' +
      'if(!retType.isVoid){return retType.toWireType(destructors,rv)}};' +
      'return __emval_addMethodCaller(invokerFunction)}',
  },
];

// Any of these surviving the patch means OpenCV would still hit the CSP wall
// at runtime. `new_(Function` is the Function-constructor-by-another-name
// route both codegen helpers funnel through.
const RESIDUAL_CODEGEN = /new Function\(|new_\(Function/;

/**
 * @param {string} source - contents of @techstark/opencv-js dist/opencv.js
 * @returns {string} the same build with all dynamic code generation replaced
 * @throws when a pattern doesn't match exactly once, or codegen survives
 */
export function patchOpenCvSource(source) {
  let patched = source;
  for (const { name, find, replace } of PATCHES) {
    const matches = patched.match(new RegExp(find.source, 'g'));
    if (!matches || matches.length !== 1) {
      throw new Error(
        `opencv-csp-patch: expected exactly one match for ${name}, found ${matches ? matches.length : 0} — ` +
        'the @techstark/opencv-js build has changed; re-verify its embind glue against this patch',
      );
    }
    patched = patched.replace(find, replace);
  }
  if (RESIDUAL_CODEGEN.test(patched)) {
    throw new Error(
      'opencv-csp-patch: dynamic code generation remains after patching — ' +
      'the build would still require \'unsafe-eval\'; update the patch list',
    );
  }
  return patched;
}
