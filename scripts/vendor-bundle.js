(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.WHATWGFetch = {})));
}(this, (function (exports) { 'use strict';

  var global =
    (typeof globalThis !== 'undefined' && globalThis) ||
    (typeof self !== 'undefined' && self) ||
    (typeof global !== 'undefined' && global);

  var support = {
    searchParams: 'URLSearchParams' in global,
    iterable: 'Symbol' in global && 'iterator' in Symbol,
    blob:
      'FileReader' in global &&
      'Blob' in global &&
      (function() {
        try {
          new Blob();
          return true
        } catch (e) {
          return false
        }
      })(),
    formData: 'FormData' in global,
    arrayBuffer: 'ArrayBuffer' in global
  };

  function isDataView(obj) {
    return obj && DataView.prototype.isPrototypeOf(obj)
  }

  if (support.arrayBuffer) {
    var viewClasses = [
      '[object Int8Array]',
      '[object Uint8Array]',
      '[object Uint8ClampedArray]',
      '[object Int16Array]',
      '[object Uint16Array]',
      '[object Int32Array]',
      '[object Uint32Array]',
      '[object Float32Array]',
      '[object Float64Array]'
    ];

    var isArrayBufferView =
      ArrayBuffer.isView ||
      function(obj) {
        return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
      };
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name);
    }
    if (/[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(name) || name === '') {
      throw new TypeError('Invalid character in header field name: "' + name + '"')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value);
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift();
        return {done: value === undefined, value: value}
      }
    };

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      };
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {};

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value);
      }, this);
    } else if (Array.isArray(headers)) {
      headers.forEach(function(header) {
        this.append(header[0], header[1]);
      }, this);
    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name]);
      }, this);
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name);
    value = normalizeValue(value);
    var oldValue = this.map[name];
    this.map[name] = oldValue ? oldValue + ', ' + value : value;
  };

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)];
  };

  Headers.prototype.get = function(name) {
    name = normalizeName(name);
    return this.has(name) ? this.map[name] : null
  };

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  };

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = normalizeValue(value);
  };

  Headers.prototype.forEach = function(callback, thisArg) {
    for (var name in this.map) {
      if (this.map.hasOwnProperty(name)) {
        callback.call(thisArg, this.map[name], name, this);
      }
    }
  };

  Headers.prototype.keys = function() {
    var items = [];
    this.forEach(function(value, name) {
      items.push(name);
    });
    return iteratorFor(items)
  };

  Headers.prototype.values = function() {
    var items = [];
    this.forEach(function(value) {
      items.push(value);
    });
    return iteratorFor(items)
  };

  Headers.prototype.entries = function() {
    var items = [];
    this.forEach(function(value, name) {
      items.push([name, value]);
    });
    return iteratorFor(items)
  };

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries;
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true;
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result);
      };
      reader.onerror = function() {
        reject(reader.error);
      };
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader();
    var promise = fileReaderReady(reader);
    reader.readAsArrayBuffer(blob);
    return promise
  }

  function readBlobAsText(blob) {
    var reader = new FileReader();
    var promise = fileReaderReady(reader);
    reader.readAsText(blob);
    return promise
  }

  function readArrayBufferAsText(buf) {
    var view = new Uint8Array(buf);
    var chars = new Array(view.length);

    for (var i = 0; i < view.length; i++) {
      chars[i] = String.fromCharCode(view[i]);
    }
    return chars.join('')
  }

  function bufferClone(buf) {
    if (buf.slice) {
      return buf.slice(0)
    } else {
      var view = new Uint8Array(buf.byteLength);
      view.set(new Uint8Array(buf));
      return view.buffer
    }
  }

  function Body() {
    this.bodyUsed = false;

    this._initBody = function(body) {
      /*
        fetch-mock wraps the Response object in an ES6 Proxy to
        provide useful test harness features such as flush. However, on
        ES5 browsers without fetch or Proxy support pollyfills must be used;
        the proxy-pollyfill is unable to proxy an attribute unless it exists
        on the object before the Proxy is created. This change ensures
        Response.bodyUsed exists on the instance, while maintaining the
        semantic of setting Request.bodyUsed in the constructor before
        _initBody is called.
      */
      this.bodyUsed = this.bodyUsed;
      this._bodyInit = body;
      if (!body) {
        this._bodyText = '';
      } else if (typeof body === 'string') {
        this._bodyText = body;
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body;
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body;
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString();
      } else if (support.arrayBuffer && support.blob && isDataView(body)) {
        this._bodyArrayBuffer = bufferClone(body.buffer);
        // IE 10-11 can't handle a DataView body.
        this._bodyInit = new Blob([this._bodyArrayBuffer]);
      } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
        this._bodyArrayBuffer = bufferClone(body);
      } else {
        this._bodyText = body = Object.prototype.toString.call(body);
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8');
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type);
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
        }
      }
    };

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this);
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyArrayBuffer) {
          return Promise.resolve(new Blob([this._bodyArrayBuffer]))
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      };

      this.arrayBuffer = function() {
        if (this._bodyArrayBuffer) {
          var isConsumed = consumed(this);
          if (isConsumed) {
            return isConsumed
          }
          if (ArrayBuffer.isView(this._bodyArrayBuffer)) {
            return Promise.resolve(
              this._bodyArrayBuffer.buffer.slice(
                this._bodyArrayBuffer.byteOffset,
                this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
              )
            )
          } else {
            return Promise.resolve(this._bodyArrayBuffer)
          }
        } else {
          return this.blob().then(readBlobAsArrayBuffer)
        }
      };
    }

    this.text = function() {
      var rejected = consumed(this);
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return readBlobAsText(this._bodyBlob)
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
      } else if (this._bodyFormData) {
        throw new Error('could not read FormData body as text')
      } else {
        return Promise.resolve(this._bodyText)
      }
    };

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      };
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    };

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];

  function normalizeMethod(method) {
    var upcased = method.toUpperCase();
    return methods.indexOf(upcased) > -1 ? upcased : method
  }

  function Request(input, options) {
    if (!(this instanceof Request)) {
      throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
    }

    options = options || {};
    var body = options.body;

    if (input instanceof Request) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url;
      this.credentials = input.credentials;
      if (!options.headers) {
        this.headers = new Headers(input.headers);
      }
      this.method = input.method;
      this.mode = input.mode;
      this.signal = input.signal;
      if (!body && input._bodyInit != null) {
        body = input._bodyInit;
        input.bodyUsed = true;
      }
    } else {
      this.url = String(input);
    }

    this.credentials = options.credentials || this.credentials || 'same-origin';
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers);
    }
    this.method = normalizeMethod(options.method || this.method || 'GET');
    this.mode = options.mode || this.mode || null;
    this.signal = options.signal || this.signal;
    this.referrer = null;

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body);

    if (this.method === 'GET' || this.method === 'HEAD') {
      if (options.cache === 'no-store' || options.cache === 'no-cache') {
        // Search for a '_' parameter in the query string
        var reParamSearch = /([?&])_=[^&]*/;
        if (reParamSearch.test(this.url)) {
          // If it already exists then set the value with the current time
          this.url = this.url.replace(reParamSearch, '$1_=' + new Date().getTime());
        } else {
          // Otherwise add a new '_' parameter to the end with the current time
          var reQueryString = /\?/;
          this.url += (reQueryString.test(this.url) ? '&' : '?') + '_=' + new Date().getTime();
        }
      }
    }
  }

  Request.prototype.clone = function() {
    return new Request(this, {body: this._bodyInit})
  };

  function decode(body) {
    var form = new FormData();
    body
      .trim()
      .split('&')
      .forEach(function(bytes) {
        if (bytes) {
          var split = bytes.split('=');
          var name = split.shift().replace(/\+/g, ' ');
          var value = split.join('=').replace(/\+/g, ' ');
          form.append(decodeURIComponent(name), decodeURIComponent(value));
        }
      });
    return form
  }

  function parseHeaders(rawHeaders) {
    var headers = new Headers();
    // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
    // https://tools.ietf.org/html/rfc7230#section-3.2
    var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ');
    // Avoiding split via regex to work around a common IE11 bug with the core-js 3.6.0 regex polyfill
    // https://github.com/github/fetch/issues/748
    // https://github.com/zloirock/core-js/issues/751
    preProcessedHeaders
      .split('\r')
      .map(function(header) {
        return header.indexOf('\n') === 0 ? header.substr(1, header.length) : header
      })
      .forEach(function(line) {
        var parts = line.split(':');
        var key = parts.shift().trim();
        if (key) {
          var value = parts.join(':').trim();
          headers.append(key, value);
        }
      });
    return headers
  }

  Body.call(Request.prototype);

  function Response(bodyInit, options) {
    if (!(this instanceof Response)) {
      throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
    }
    if (!options) {
      options = {};
    }

    this.type = 'default';
    this.status = options.status === undefined ? 200 : options.status;
    this.ok = this.status >= 200 && this.status < 300;
    this.statusText = options.statusText === undefined ? '' : '' + options.statusText;
    this.headers = new Headers(options.headers);
    this.url = options.url || '';
    this._initBody(bodyInit);
  }

  Body.call(Response.prototype);

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  };

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''});
    response.type = 'error';
    return response
  };

  var redirectStatuses = [301, 302, 303, 307, 308];

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  };

  exports.DOMException = global.DOMException;
  try {
    new exports.DOMException();
  } catch (err) {
    exports.DOMException = function(message, name) {
      this.message = message;
      this.name = name;
      var error = Error(message);
      this.stack = error.stack;
    };
    exports.DOMException.prototype = Object.create(Error.prototype);
    exports.DOMException.prototype.constructor = exports.DOMException;
  }

  function fetch(input, init) {
    return new Promise(function(resolve, reject) {
      var request = new Request(input, init);

      if (request.signal && request.signal.aborted) {
        return reject(new exports.DOMException('Aborted', 'AbortError'))
      }

      var xhr = new XMLHttpRequest();

      function abortXhr() {
        xhr.abort();
      }

      xhr.onload = function() {
        var options = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: parseHeaders(xhr.getAllResponseHeaders() || '')
        };
        options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL');
        var body = 'response' in xhr ? xhr.response : xhr.responseText;
        setTimeout(function() {
          resolve(new Response(body, options));
        }, 0);
      };

      xhr.onerror = function() {
        setTimeout(function() {
          reject(new TypeError('Network request failed'));
        }, 0);
      };

      xhr.ontimeout = function() {
        setTimeout(function() {
          reject(new TypeError('Network request failed'));
        }, 0);
      };

      xhr.onabort = function() {
        setTimeout(function() {
          reject(new exports.DOMException('Aborted', 'AbortError'));
        }, 0);
      };

      function fixUrl(url) {
        try {
          return url === '' && global.location.href ? global.location.href : url
        } catch (e) {
          return url
        }
      }

      xhr.open(request.method, fixUrl(request.url), true);

      if (request.credentials === 'include') {
        xhr.withCredentials = true;
      } else if (request.credentials === 'omit') {
        xhr.withCredentials = false;
      }

      if ('responseType' in xhr) {
        if (support.blob) {
          xhr.responseType = 'blob';
        } else if (
          support.arrayBuffer &&
          request.headers.get('Content-Type') &&
          request.headers.get('Content-Type').indexOf('application/octet-stream') !== -1
        ) {
          xhr.responseType = 'arraybuffer';
        }
      }

      if (init && typeof init.headers === 'object' && !(init.headers instanceof Headers)) {
        Object.getOwnPropertyNames(init.headers).forEach(function(name) {
          xhr.setRequestHeader(name, normalizeValue(init.headers[name]));
        });
      } else {
        request.headers.forEach(function(value, name) {
          xhr.setRequestHeader(name, value);
        });
      }

      if (request.signal) {
        request.signal.addEventListener('abort', abortXhr);

        xhr.onreadystatechange = function() {
          // DONE (success or failure)
          if (xhr.readyState === 4) {
            request.signal.removeEventListener('abort', abortXhr);
          }
        };
      }

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit);
    })
  }

  fetch.polyfill = true;

  if (!global.fetch) {
    global.fetch = fetch;
    global.Headers = Headers;
    global.Request = Request;
    global.Response = Response;
  }

  exports.Headers = Headers;
  exports.Request = Request;
  exports.Response = Response;
  exports.fetch = fetch;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
;
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t():"function"==typeof define&&define.amd?define(t):t()}(0,function(){"use strict";function e(e){var t=this.constructor;return this.then(function(n){return t.resolve(e()).then(function(){return n})},function(n){return t.resolve(e()).then(function(){return t.reject(n)})})}function t(e){return new this(function(t,n){function o(e,n){if(n&&("object"==typeof n||"function"==typeof n)){var f=n.then;if("function"==typeof f)return void f.call(n,function(t){o(e,t)},function(n){r[e]={status:"rejected",reason:n},0==--i&&t(r)})}r[e]={status:"fulfilled",value:n},0==--i&&t(r)}if(!e||"undefined"==typeof e.length)return n(new TypeError(typeof e+" "+e+" is not iterable(cannot read property Symbol(Symbol.iterator))"));var r=Array.prototype.slice.call(e);if(0===r.length)return t([]);for(var i=r.length,f=0;r.length>f;f++)o(f,r[f])})}function n(e){return!(!e||"undefined"==typeof e.length)}function o(){}function r(e){if(!(this instanceof r))throw new TypeError("Promises must be constructed via new");if("function"!=typeof e)throw new TypeError("not a function");this._state=0,this._handled=!1,this._value=undefined,this._deferreds=[],l(e,this)}function i(e,t){for(;3===e._state;)e=e._value;0!==e._state?(e._handled=!0,r._immediateFn(function(){var n=1===e._state?t.onFulfilled:t.onRejected;if(null!==n){var o;try{o=n(e._value)}catch(r){return void u(t.promise,r)}f(t.promise,o)}else(1===e._state?f:u)(t.promise,e._value)})):e._deferreds.push(t)}function f(e,t){try{if(t===e)throw new TypeError("A promise cannot be resolved with itself.");if(t&&("object"==typeof t||"function"==typeof t)){var n=t.then;if(t instanceof r)return e._state=3,e._value=t,void c(e);if("function"==typeof n)return void l(function(e,t){return function(){e.apply(t,arguments)}}(n,t),e)}e._state=1,e._value=t,c(e)}catch(o){u(e,o)}}function u(e,t){e._state=2,e._value=t,c(e)}function c(e){2===e._state&&0===e._deferreds.length&&r._immediateFn(function(){e._handled||r._unhandledRejectionFn(e._value)});for(var t=0,n=e._deferreds.length;n>t;t++)i(e,e._deferreds[t]);e._deferreds=null}function l(e,t){var n=!1;try{e(function(e){n||(n=!0,f(t,e))},function(e){n||(n=!0,u(t,e))})}catch(o){if(n)return;n=!0,u(t,o)}}var a=setTimeout;r.prototype["catch"]=function(e){return this.then(null,e)},r.prototype.then=function(e,t){var n=new this.constructor(o);return i(this,new function(e,t,n){this.onFulfilled="function"==typeof e?e:null,this.onRejected="function"==typeof t?t:null,this.promise=n}(e,t,n)),n},r.prototype["finally"]=e,r.all=function(e){return new r(function(t,o){function r(e,n){try{if(n&&("object"==typeof n||"function"==typeof n)){var u=n.then;if("function"==typeof u)return void u.call(n,function(t){r(e,t)},o)}i[e]=n,0==--f&&t(i)}catch(c){o(c)}}if(!n(e))return o(new TypeError("Promise.all accepts an array"));var i=Array.prototype.slice.call(e);if(0===i.length)return t([]);for(var f=i.length,u=0;i.length>u;u++)r(u,i[u])})},r.allSettled=t,r.resolve=function(e){return e&&"object"==typeof e&&e.constructor===r?e:new r(function(t){t(e)})},r.reject=function(e){return new r(function(t,n){n(e)})},r.race=function(e){return new r(function(t,o){if(!n(e))return o(new TypeError("Promise.race accepts an array"));for(var i=0,f=e.length;f>i;i++)r.resolve(e[i]).then(t,o)})},r._immediateFn="function"==typeof setImmediate&&function(e){setImmediate(e)}||function(e){a(e,0)},r._unhandledRejectionFn=function(e){void 0!==console&&console&&console.warn("Possible Unhandled Promise Rejection:",e)};var s=function(){if("undefined"!=typeof self)return self;if("undefined"!=typeof window)return window;if("undefined"!=typeof global)return global;throw Error("unable to locate global object")}();"function"!=typeof s.Promise?s.Promise=r:(s.Promise.prototype["finally"]||(s.Promise.prototype["finally"]=e),s.Promise.allSettled||(s.Promise.allSettled=t))});
;
/** vim: et:ts=4:sw=4:sts=4
 * @license RequireJS 2.3.6 Copyright jQuery Foundation and other contributors.
 * Released under MIT license, https://github.com/requirejs/requirejs/blob/master/LICENSE
 */
//Not using strict: uneven strict support in browsers, #392, and causes
//problems with requirejs.exec()/transpiler plugins that may not be strict.
/*jslint regexp: true, nomen: true, sloppy: true */
/*global window, navigator, document, importScripts, setTimeout, opera */

var requirejs, require, define;
(function (global, setTimeout) {
    var req, s, head, baseElement, dataMain, src,
        interactiveScript, currentlyAddingScript, mainScript, subPath,
        version = '2.3.6',
        commentRegExp = /\/\*[\s\S]*?\*\/|([^:"'=]|^)\/\/.*$/mg,
        cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
        jsSuffixRegExp = /\.js$/,
        currDirRegExp = /^\.\//,
        op = Object.prototype,
        ostring = op.toString,
        hasOwn = op.hasOwnProperty,
        isBrowser = !!(typeof window !== 'undefined' && typeof navigator !== 'undefined' && window.document),
        isWebWorker = !isBrowser && typeof importScripts !== 'undefined',
        //PS3 indicates loaded and complete, but need to wait for complete
        //specifically. Sequence is 'loading', 'loaded', execution,
        // then 'complete'. The UA check is unfortunate, but not sure how
        //to feature test w/o causing perf issues.
        readyRegExp = isBrowser && navigator.platform === 'PLAYSTATION 3' ?
                      /^complete$/ : /^(complete|loaded)$/,
        defContextName = '_',
        //Oh the tragedy, detecting opera. See the usage of isOpera for reason.
        isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]',
        contexts = {},
        cfg = {},
        globalDefQueue = [],
        useInteractive = false;

    //Could match something like ')//comment', do not lose the prefix to comment.
    function commentReplace(match, singlePrefix) {
        return singlePrefix || '';
    }

    function isFunction(it) {
        return ostring.call(it) === '[object Function]';
    }

    function isArray(it) {
        return ostring.call(it) === '[object Array]';
    }

    /**
     * Helper function for iterating over an array. If the func returns
     * a true value, it will break out of the loop.
     */
    function each(ary, func) {
        if (ary) {
            var i;
            for (i = 0; i < ary.length; i += 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    /**
     * Helper function for iterating over an array backwards. If the func
     * returns a true value, it will break out of the loop.
     */
    function eachReverse(ary, func) {
        if (ary) {
            var i;
            for (i = ary.length - 1; i > -1; i -= 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    function getOwn(obj, prop) {
        return hasProp(obj, prop) && obj[prop];
    }

    /**
     * Cycles over properties in an object and calls a function for each
     * property value. If the function returns a truthy value, then the
     * iteration is stopped.
     */
    function eachProp(obj, func) {
        var prop;
        for (prop in obj) {
            if (hasProp(obj, prop)) {
                if (func(obj[prop], prop)) {
                    break;
                }
            }
        }
    }

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name.
     */
    function mixin(target, source, force, deepStringMixin) {
        if (source) {
            eachProp(source, function (value, prop) {
                if (force || !hasProp(target, prop)) {
                    if (deepStringMixin && typeof value === 'object' && value &&
                        !isArray(value) && !isFunction(value) &&
                        !(value instanceof RegExp)) {

                        if (!target[prop]) {
                            target[prop] = {};
                        }
                        mixin(target[prop], value, force, deepStringMixin);
                    } else {
                        target[prop] = value;
                    }
                }
            });
        }
        return target;
    }

    //Similar to Function.prototype.bind, but the 'this' object is specified
    //first, since it is easier to read/figure out what 'this' will be.
    function bind(obj, fn) {
        return function () {
            return fn.apply(obj, arguments);
        };
    }

    function scripts() {
        return document.getElementsByTagName('script');
    }

    function defaultOnError(err) {
        throw err;
    }

    //Allow getting a global that is expressed in
    //dot notation, like 'a.b.c'.
    function getGlobal(value) {
        if (!value) {
            return value;
        }
        var g = global;
        each(value.split('.'), function (part) {
            g = g[part];
        });
        return g;
    }

    /**
     * Constructs an error with a pointer to an URL with more information.
     * @param {String} id the error ID that maps to an ID on a web page.
     * @param {String} message human readable error.
     * @param {Error} [err] the original error, if there is one.
     *
     * @returns {Error}
     */
    function makeError(id, msg, err, requireModules) {
        var e = new Error(msg + '\nhttps://requirejs.org/docs/errors.html#' + id);
        e.requireType = id;
        e.requireModules = requireModules;
        if (err) {
            e.originalError = err;
        }
        return e;
    }

    if (typeof define !== 'undefined') {
        //If a define is already in play via another AMD loader,
        //do not overwrite.
        return;
    }

    if (typeof requirejs !== 'undefined') {
        if (isFunction(requirejs)) {
            //Do not overwrite an existing requirejs instance.
            return;
        }
        cfg = requirejs;
        requirejs = undefined;
    }

    //Allow for a require config object
    if (typeof require !== 'undefined' && !isFunction(require)) {
        //assume it is a config object.
        cfg = require;
        require = undefined;
    }

    function newContext(contextName) {
        var inCheckLoaded, Module, context, handlers,
            checkLoadedTimeoutId,
            config = {
                //Defaults. Do not set a default for map
                //config to speed up normalize(), which
                //will run faster if there is no default.
                waitSeconds: 7,
                baseUrl: './',
                paths: {},
                bundles: {},
                pkgs: {},
                shim: {},
                config: {}
            },
            registry = {},
            //registry of just enabled modules, to speed
            //cycle breaking code when lots of modules
            //are registered, but not activated.
            enabledRegistry = {},
            undefEvents = {},
            defQueue = [],
            defined = {},
            urlFetched = {},
            bundlesMap = {},
            requireCounter = 1,
            unnormalizedCounter = 1;

        /**
         * Trims the . and .. from an array of path segments.
         * It will keep a leading path segment if a .. will become
         * the first path segment, to help with module name lookups,
         * which act like paths, but can be remapped. But the end result,
         * all paths that use this function should look normalized.
         * NOTE: this method MODIFIES the input array.
         * @param {Array} ary the array of path segments.
         */
        function trimDots(ary) {
            var i, part;
            for (i = 0; i < ary.length; i++) {
                part = ary[i];
                if (part === '.') {
                    ary.splice(i, 1);
                    i -= 1;
                } else if (part === '..') {
                    // If at the start, or previous value is still ..,
                    // keep them so that when converted to a path it may
                    // still work when converted to a path, even though
                    // as an ID it is less than ideal. In larger point
                    // releases, may be better to just kick out an error.
                    if (i === 0 || (i === 1 && ary[2] === '..') || ary[i - 1] === '..') {
                        continue;
                    } else if (i > 0) {
                        ary.splice(i - 1, 2);
                        i -= 2;
                    }
                }
            }
        }

        /**
         * Given a relative module name, like ./something, normalize it to
         * a real name that can be mapped to a path.
         * @param {String} name the relative name
         * @param {String} baseName a real name that the name arg is relative
         * to.
         * @param {Boolean} applyMap apply the map config to the value. Should
         * only be done if this normalization is for a dependency ID.
         * @returns {String} normalized name
         */
        function normalize(name, baseName, applyMap) {
            var pkgMain, mapValue, nameParts, i, j, nameSegment, lastIndex,
                foundMap, foundI, foundStarMap, starI, normalizedBaseParts,
                baseParts = (baseName && baseName.split('/')),
                map = config.map,
                starMap = map && map['*'];

            //Adjust any relative paths.
            if (name) {
                name = name.split('/');
                lastIndex = name.length - 1;

                // If wanting node ID compatibility, strip .js from end
                // of IDs. Have to do this here, and not in nameToUrl
                // because node allows either .js or non .js to map
                // to same file.
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                // Starts with a '.' so need the baseName
                if (name[0].charAt(0) === '.' && baseParts) {
                    //Convert baseName to array, and lop off the last part,
                    //so that . matches that 'directory' and not name of the baseName's
                    //module. For instance, baseName of 'one/two/three', maps to
                    //'one/two/three.js', but we want the directory, 'one/two' for
                    //this normalization.
                    normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                    name = normalizedBaseParts.concat(name);
                }

                trimDots(name);
                name = name.join('/');
            }

            //Apply map config if available.
            if (applyMap && map && (baseParts || starMap)) {
                nameParts = name.split('/');

                outerLoop: for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join('/');

                    if (baseParts) {
                        //Find the longest baseName segment match in the config.
                        //So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = getOwn(map, baseParts.slice(0, j).join('/'));

                            //baseName segment has config, find if it has one for
                            //this name.
                            if (mapValue) {
                                mapValue = getOwn(mapValue, nameSegment);
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break outerLoop;
                                }
                            }
                        }
                    }

                    //Check for a star map match, but just hold on to it,
                    //if there is a shorter segment match later in a matching
                    //config, then favor over this star map.
                    if (!foundStarMap && starMap && getOwn(starMap, nameSegment)) {
                        foundStarMap = getOwn(starMap, nameSegment);
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            // If the name points to a package's name, use
            // the package main instead.
            pkgMain = getOwn(config.pkgs, name);

            return pkgMain ? pkgMain : name;
        }

        function removeScript(name) {
            if (isBrowser) {
                each(scripts(), function (scriptNode) {
                    if (scriptNode.getAttribute('data-requiremodule') === name &&
                            scriptNode.getAttribute('data-requirecontext') === context.contextName) {
                        scriptNode.parentNode.removeChild(scriptNode);
                        return true;
                    }
                });
            }
        }

        function hasPathFallback(id) {
            var pathConfig = getOwn(config.paths, id);
            if (pathConfig && isArray(pathConfig) && pathConfig.length > 1) {
                //Pop off the first array value, since it failed, and
                //retry
                pathConfig.shift();
                context.require.undef(id);

                //Custom require that does not do map translation, since
                //ID is "absolute", already mapped/resolved.
                context.makeRequire(null, {
                    skipMap: true
                })([id]);

                return true;
            }
        }

        //Turns a plugin!resource to [plugin, resource]
        //with the plugin being undefined if the name
        //did not have a plugin prefix.
        function splitPrefix(name) {
            var prefix,
                index = name ? name.indexOf('!') : -1;
            if (index > -1) {
                prefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            }
            return [prefix, name];
        }

        /**
         * Creates a module mapping that includes plugin prefix, module
         * name, and path. If parentModuleMap is provided it will
         * also normalize the name via require.normalize()
         *
         * @param {String} name the module name
         * @param {String} [parentModuleMap] parent module map
         * for the module name, used to resolve relative names.
         * @param {Boolean} isNormalized: is the ID already normalized.
         * This is true if this call is done for a define() module ID.
         * @param {Boolean} applyMap: apply the map config to the ID.
         * Should only be true if this map is for a dependency.
         *
         * @returns {Object}
         */
        function makeModuleMap(name, parentModuleMap, isNormalized, applyMap) {
            var url, pluginModule, suffix, nameParts,
                prefix = null,
                parentName = parentModuleMap ? parentModuleMap.name : null,
                originalName = name,
                isDefine = true,
                normalizedName = '';

            //If no name, then it means it is a require call, generate an
            //internal name.
            if (!name) {
                isDefine = false;
                name = '_@r' + (requireCounter += 1);
            }

            nameParts = splitPrefix(name);
            prefix = nameParts[0];
            name = nameParts[1];

            if (prefix) {
                prefix = normalize(prefix, parentName, applyMap);
                pluginModule = getOwn(defined, prefix);
            }

            //Account for relative paths if there is a base name.
            if (name) {
                if (prefix) {
                    if (isNormalized) {
                        normalizedName = name;
                    } else if (pluginModule && pluginModule.normalize) {
                        //Plugin is loaded, use its normalize method.
                        normalizedName = pluginModule.normalize(name, function (name) {
                            return normalize(name, parentName, applyMap);
                        });
                    } else {
                        // If nested plugin references, then do not try to
                        // normalize, as it will not normalize correctly. This
                        // places a restriction on resourceIds, and the longer
                        // term solution is not to normalize until plugins are
                        // loaded and all normalizations to allow for async
                        // loading of a loader plugin. But for now, fixes the
                        // common uses. Details in #1131
                        normalizedName = name.indexOf('!') === -1 ?
                                         normalize(name, parentName, applyMap) :
                                         name;
                    }
                } else {
                    //A regular module.
                    normalizedName = normalize(name, parentName, applyMap);

                    //Normalized name may be a plugin ID due to map config
                    //application in normalize. The map config values must
                    //already be normalized, so do not need to redo that part.
                    nameParts = splitPrefix(normalizedName);
                    prefix = nameParts[0];
                    normalizedName = nameParts[1];
                    isNormalized = true;

                    url = context.nameToUrl(normalizedName);
                }
            }

            //If the id is a plugin id that cannot be determined if it needs
            //normalization, stamp it with a unique ID so two matching relative
            //ids that may conflict can be separate.
            suffix = prefix && !pluginModule && !isNormalized ?
                     '_unnormalized' + (unnormalizedCounter += 1) :
                     '';

            return {
                prefix: prefix,
                name: normalizedName,
                parentMap: parentModuleMap,
                unnormalized: !!suffix,
                url: url,
                originalName: originalName,
                isDefine: isDefine,
                id: (prefix ?
                        prefix + '!' + normalizedName :
                        normalizedName) + suffix
            };
        }

        function getModule(depMap) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (!mod) {
                mod = registry[id] = new context.Module(depMap);
            }

            return mod;
        }

        function on(depMap, name, fn) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (hasProp(defined, id) &&
                    (!mod || mod.defineEmitComplete)) {
                if (name === 'defined') {
                    fn(defined[id]);
                }
            } else {
                mod = getModule(depMap);
                if (mod.error && name === 'error') {
                    fn(mod.error);
                } else {
                    mod.on(name, fn);
                }
            }
        }

        function onError(err, errback) {
            var ids = err.requireModules,
                notified = false;

            if (errback) {
                errback(err);
            } else {
                each(ids, function (id) {
                    var mod = getOwn(registry, id);
                    if (mod) {
                        //Set error on module, so it skips timeout checks.
                        mod.error = err;
                        if (mod.events.error) {
                            notified = true;
                            mod.emit('error', err);
                        }
                    }
                });

                if (!notified) {
                    req.onError(err);
                }
            }
        }

        /**
         * Internal method to transfer globalQueue items to this context's
         * defQueue.
         */
        function takeGlobalQueue() {
            //Push all the globalDefQueue items into the context's defQueue
            if (globalDefQueue.length) {
                each(globalDefQueue, function(queueItem) {
                    var id = queueItem[0];
                    if (typeof id === 'string') {
                        context.defQueueMap[id] = true;
                    }
                    defQueue.push(queueItem);
                });
                globalDefQueue = [];
            }
        }

        handlers = {
            'require': function (mod) {
                if (mod.require) {
                    return mod.require;
                } else {
                    return (mod.require = context.makeRequire(mod.map));
                }
            },
            'exports': function (mod) {
                mod.usingExports = true;
                if (mod.map.isDefine) {
                    if (mod.exports) {
                        return (defined[mod.map.id] = mod.exports);
                    } else {
                        return (mod.exports = defined[mod.map.id] = {});
                    }
                }
            },
            'module': function (mod) {
                if (mod.module) {
                    return mod.module;
                } else {
                    return (mod.module = {
                        id: mod.map.id,
                        uri: mod.map.url,
                        config: function () {
                            return getOwn(config.config, mod.map.id) || {};
                        },
                        exports: mod.exports || (mod.exports = {})
                    });
                }
            }
        };

        function cleanRegistry(id) {
            //Clean up machinery used for waiting modules.
            delete registry[id];
            delete enabledRegistry[id];
        }

        function breakCycle(mod, traced, processed) {
            var id = mod.map.id;

            if (mod.error) {
                mod.emit('error', mod.error);
            } else {
                traced[id] = true;
                each(mod.depMaps, function (depMap, i) {
                    var depId = depMap.id,
                        dep = getOwn(registry, depId);

                    //Only force things that have not completed
                    //being defined, so still in the registry,
                    //and only if it has not been matched up
                    //in the module already.
                    if (dep && !mod.depMatched[i] && !processed[depId]) {
                        if (getOwn(traced, depId)) {
                            mod.defineDep(i, defined[depId]);
                            mod.check(); //pass false?
                        } else {
                            breakCycle(dep, traced, processed);
                        }
                    }
                });
                processed[id] = true;
            }
        }

        function checkLoaded() {
            var err, usingPathFallback,
                waitInterval = config.waitSeconds * 1000,
                //It is possible to disable the wait interval by using waitSeconds of 0.
                expired = waitInterval && (context.startTime + waitInterval) < new Date().getTime(),
                noLoads = [],
                reqCalls = [],
                stillLoading = false,
                needCycleCheck = true;

            //Do not bother if this call was a result of a cycle break.
            if (inCheckLoaded) {
                return;
            }

            inCheckLoaded = true;

            //Figure out the state of all the modules.
            eachProp(enabledRegistry, function (mod) {
                var map = mod.map,
                    modId = map.id;

                //Skip things that are not enabled or in error state.
                if (!mod.enabled) {
                    return;
                }

                if (!map.isDefine) {
                    reqCalls.push(mod);
                }

                if (!mod.error) {
                    //If the module should be executed, and it has not
                    //been inited and time is up, remember it.
                    if (!mod.inited && expired) {
                        if (hasPathFallback(modId)) {
                            usingPathFallback = true;
                            stillLoading = true;
                        } else {
                            noLoads.push(modId);
                            removeScript(modId);
                        }
                    } else if (!mod.inited && mod.fetched && map.isDefine) {
                        stillLoading = true;
                        if (!map.prefix) {
                            //No reason to keep looking for unfinished
                            //loading. If the only stillLoading is a
                            //plugin resource though, keep going,
                            //because it may be that a plugin resource
                            //is waiting on a non-plugin cycle.
                            return (needCycleCheck = false);
                        }
                    }
                }
            });

            if (expired && noLoads.length) {
                //If wait time expired, throw error of unloaded modules.
                err = makeError('timeout', 'Load timeout for modules: ' + noLoads, null, noLoads);
                err.contextName = context.contextName;
                return onError(err);
            }

            //Not expired, check for a cycle.
            if (needCycleCheck) {
                each(reqCalls, function (mod) {
                    breakCycle(mod, {}, {});
                });
            }

            //If still waiting on loads, and the waiting load is something
            //other than a plugin resource, or there are still outstanding
            //scripts, then just try back later.
            if ((!expired || usingPathFallback) && stillLoading) {
                //Something is still waiting to load. Wait for it, but only
                //if a timeout is not already in effect.
                if ((isBrowser || isWebWorker) && !checkLoadedTimeoutId) {
                    checkLoadedTimeoutId = setTimeout(function () {
                        checkLoadedTimeoutId = 0;
                        checkLoaded();
                    }, 50);
                }
            }

            inCheckLoaded = false;
        }

        Module = function (map) {
            this.events = getOwn(undefEvents, map.id) || {};
            this.map = map;
            this.shim = getOwn(config.shim, map.id);
            this.depExports = [];
            this.depMaps = [];
            this.depMatched = [];
            this.pluginMaps = {};
            this.depCount = 0;

            /* this.exports this.factory
               this.depMaps = [],
               this.enabled, this.fetched
            */
        };

        Module.prototype = {
            init: function (depMaps, factory, errback, options) {
                options = options || {};

                //Do not do more inits if already done. Can happen if there
                //are multiple define calls for the same module. That is not
                //a normal, common case, but it is also not unexpected.
                if (this.inited) {
                    return;
                }

                this.factory = factory;

                if (errback) {
                    //Register for errors on this module.
                    this.on('error', errback);
                } else if (this.events.error) {
                    //If no errback already, but there are error listeners
                    //on this module, set up an errback to pass to the deps.
                    errback = bind(this, function (err) {
                        this.emit('error', err);
                    });
                }

                //Do a copy of the dependency array, so that
                //source inputs are not modified. For example
                //"shim" deps are passed in here directly, and
                //doing a direct modification of the depMaps array
                //would affect that config.
                this.depMaps = depMaps && depMaps.slice(0);

                this.errback = errback;

                //Indicate this module has be initialized
                this.inited = true;

                this.ignore = options.ignore;

                //Could have option to init this module in enabled mode,
                //or could have been previously marked as enabled. However,
                //the dependencies are not known until init is called. So
                //if enabled previously, now trigger dependencies as enabled.
                if (options.enabled || this.enabled) {
                    //Enable this module and dependencies.
                    //Will call this.check()
                    this.enable();
                } else {
                    this.check();
                }
            },

            defineDep: function (i, depExports) {
                //Because of cycles, defined callback for a given
                //export can be called more than once.
                if (!this.depMatched[i]) {
                    this.depMatched[i] = true;
                    this.depCount -= 1;
                    this.depExports[i] = depExports;
                }
            },

            fetch: function () {
                if (this.fetched) {
                    return;
                }
                this.fetched = true;

                context.startTime = (new Date()).getTime();

                var map = this.map;

                //If the manager is for a plugin managed resource,
                //ask the plugin to load it now.
                if (this.shim) {
                    context.makeRequire(this.map, {
                        enableBuildCallback: true
                    })(this.shim.deps || [], bind(this, function () {
                        return map.prefix ? this.callPlugin() : this.load();
                    }));
                } else {
                    //Regular dependency.
                    return map.prefix ? this.callPlugin() : this.load();
                }
            },

            load: function () {
                var url = this.map.url;

                //Regular dependency.
                if (!urlFetched[url]) {
                    urlFetched[url] = true;
                    context.load(this.map.id, url);
                }
            },

            /**
             * Checks if the module is ready to define itself, and if so,
             * define it.
             */
            check: function () {
                if (!this.enabled || this.enabling) {
                    return;
                }

                var err, cjsModule,
                    id = this.map.id,
                    depExports = this.depExports,
                    exports = this.exports,
                    factory = this.factory;

                if (!this.inited) {
                    // Only fetch if not already in the defQueue.
                    if (!hasProp(context.defQueueMap, id)) {
                        this.fetch();
                    }
                } else if (this.error) {
                    this.emit('error', this.error);
                } else if (!this.defining) {
                    //The factory could trigger another require call
                    //that would result in checking this module to
                    //define itself again. If already in the process
                    //of doing that, skip this work.
                    this.defining = true;

                    if (this.depCount < 1 && !this.defined) {
                        if (isFunction(factory)) {
                            //If there is an error listener, favor passing
                            //to that instead of throwing an error. However,
                            //only do it for define()'d  modules. require
                            //errbacks should not be called for failures in
                            //their callbacks (#699). However if a global
                            //onError is set, use that.
                            if ((this.events.error && this.map.isDefine) ||
                                req.onError !== defaultOnError) {
                                try {
                                    exports = context.execCb(id, factory, depExports, exports);
                                } catch (e) {
                                    err = e;
                                }
                            } else {
                                exports = context.execCb(id, factory, depExports, exports);
                            }

                            // Favor return value over exports. If node/cjs in play,
                            // then will not have a return value anyway. Favor
                            // module.exports assignment over exports object.
                            if (this.map.isDefine && exports === undefined) {
                                cjsModule = this.module;
                                if (cjsModule) {
                                    exports = cjsModule.exports;
                                } else if (this.usingExports) {
                                    //exports already set the defined value.
                                    exports = this.exports;
                                }
                            }

                            if (err) {
                                err.requireMap = this.map;
                                err.requireModules = this.map.isDefine ? [this.map.id] : null;
                                err.requireType = this.map.isDefine ? 'define' : 'require';
                                return onError((this.error = err));
                            }

                        } else {
                            //Just a literal value
                            exports = factory;
                        }

                        this.exports = exports;

                        if (this.map.isDefine && !this.ignore) {
                            defined[id] = exports;

                            if (req.onResourceLoad) {
                                var resLoadMaps = [];
                                each(this.depMaps, function (depMap) {
                                    resLoadMaps.push(depMap.normalizedMap || depMap);
                                });
                                req.onResourceLoad(context, this.map, resLoadMaps);
                            }
                        }

                        //Clean up
                        cleanRegistry(id);

                        this.defined = true;
                    }

                    //Finished the define stage. Allow calling check again
                    //to allow define notifications below in the case of a
                    //cycle.
                    this.defining = false;

                    if (this.defined && !this.defineEmitted) {
                        this.defineEmitted = true;
                        this.emit('defined', this.exports);
                        this.defineEmitComplete = true;
                    }

                }
            },

            callPlugin: function () {
                var map = this.map,
                    id = map.id,
                    //Map already normalized the prefix.
                    pluginMap = makeModuleMap(map.prefix);

                //Mark this as a dependency for this plugin, so it
                //can be traced for cycles.
                this.depMaps.push(pluginMap);

                on(pluginMap, 'defined', bind(this, function (plugin) {
                    var load, normalizedMap, normalizedMod,
                        bundleId = getOwn(bundlesMap, this.map.id),
                        name = this.map.name,
                        parentName = this.map.parentMap ? this.map.parentMap.name : null,
                        localRequire = context.makeRequire(map.parentMap, {
                            enableBuildCallback: true
                        });

                    //If current map is not normalized, wait for that
                    //normalized name to load instead of continuing.
                    if (this.map.unnormalized) {
                        //Normalize the ID if the plugin allows it.
                        if (plugin.normalize) {
                            name = plugin.normalize(name, function (name) {
                                return normalize(name, parentName, true);
                            }) || '';
                        }

                        //prefix and name should already be normalized, no need
                        //for applying map config again either.
                        normalizedMap = makeModuleMap(map.prefix + '!' + name,
                                                      this.map.parentMap,
                                                      true);
                        on(normalizedMap,
                            'defined', bind(this, function (value) {
                                this.map.normalizedMap = normalizedMap;
                                this.init([], function () { return value; }, null, {
                                    enabled: true,
                                    ignore: true
                                });
                            }));

                        normalizedMod = getOwn(registry, normalizedMap.id);
                        if (normalizedMod) {
                            //Mark this as a dependency for this plugin, so it
                            //can be traced for cycles.
                            this.depMaps.push(normalizedMap);

                            if (this.events.error) {
                                normalizedMod.on('error', bind(this, function (err) {
                                    this.emit('error', err);
                                }));
                            }
                            normalizedMod.enable();
                        }

                        return;
                    }

                    //If a paths config, then just load that file instead to
                    //resolve the plugin, as it is built into that paths layer.
                    if (bundleId) {
                        this.map.url = context.nameToUrl(bundleId);
                        this.load();
                        return;
                    }

                    load = bind(this, function (value) {
                        this.init([], function () { return value; }, null, {
                            enabled: true
                        });
                    });

                    load.error = bind(this, function (err) {
                        this.inited = true;
                        this.error = err;
                        err.requireModules = [id];

                        //Remove temp unnormalized modules for this module,
                        //since they will never be resolved otherwise now.
                        eachProp(registry, function (mod) {
                            if (mod.map.id.indexOf(id + '_unnormalized') === 0) {
                                cleanRegistry(mod.map.id);
                            }
                        });

                        onError(err);
                    });

                    //Allow plugins to load other code without having to know the
                    //context or how to 'complete' the load.
                    load.fromText = bind(this, function (text, textAlt) {
                        /*jslint evil: true */
                        var moduleName = map.name,
                            moduleMap = makeModuleMap(moduleName),
                            hasInteractive = useInteractive;

                        //As of 2.1.0, support just passing the text, to reinforce
                        //fromText only being called once per resource. Still
                        //support old style of passing moduleName but discard
                        //that moduleName in favor of the internal ref.
                        if (textAlt) {
                            text = textAlt;
                        }

                        //Turn off interactive script matching for IE for any define
                        //calls in the text, then turn it back on at the end.
                        if (hasInteractive) {
                            useInteractive = false;
                        }

                        //Prime the system by creating a module instance for
                        //it.
                        getModule(moduleMap);

                        //Transfer any config to this other module.
                        if (hasProp(config.config, id)) {
                            config.config[moduleName] = config.config[id];
                        }

                        try {
                            req.exec(text);
                        } catch (e) {
                            return onError(makeError('fromtexteval',
                                             'fromText eval for ' + id +
                                            ' failed: ' + e,
                                             e,
                                             [id]));
                        }

                        if (hasInteractive) {
                            useInteractive = true;
                        }

                        //Mark this as a dependency for the plugin
                        //resource
                        this.depMaps.push(moduleMap);

                        //Support anonymous modules.
                        context.completeLoad(moduleName);

                        //Bind the value of that module to the value for this
                        //resource ID.
                        localRequire([moduleName], load);
                    });

                    //Use parentName here since the plugin's name is not reliable,
                    //could be some weird string with no path that actually wants to
                    //reference the parentName's path.
                    plugin.load(map.name, localRequire, load, config);
                }));

                context.enable(pluginMap, this);
                this.pluginMaps[pluginMap.id] = pluginMap;
            },

            enable: function () {
                enabledRegistry[this.map.id] = this;
                this.enabled = true;

                //Set flag mentioning that the module is enabling,
                //so that immediate calls to the defined callbacks
                //for dependencies do not trigger inadvertent load
                //with the depCount still being zero.
                this.enabling = true;

                //Enable each dependency
                each(this.depMaps, bind(this, function (depMap, i) {
                    var id, mod, handler;

                    if (typeof depMap === 'string') {
                        //Dependency needs to be converted to a depMap
                        //and wired up to this module.
                        depMap = makeModuleMap(depMap,
                                               (this.map.isDefine ? this.map : this.map.parentMap),
                                               false,
                                               !this.skipMap);
                        this.depMaps[i] = depMap;

                        handler = getOwn(handlers, depMap.id);

                        if (handler) {
                            this.depExports[i] = handler(this);
                            return;
                        }

                        this.depCount += 1;

                        on(depMap, 'defined', bind(this, function (depExports) {
                            if (this.undefed) {
                                return;
                            }
                            this.defineDep(i, depExports);
                            this.check();
                        }));

                        if (this.errback) {
                            on(depMap, 'error', bind(this, this.errback));
                        } else if (this.events.error) {
                            // No direct errback on this module, but something
                            // else is listening for errors, so be sure to
                            // propagate the error correctly.
                            on(depMap, 'error', bind(this, function(err) {
                                this.emit('error', err);
                            }));
                        }
                    }

                    id = depMap.id;
                    mod = registry[id];

                    //Skip special modules like 'require', 'exports', 'module'
                    //Also, don't call enable if it is already enabled,
                    //important in circular dependency cases.
                    if (!hasProp(handlers, id) && mod && !mod.enabled) {
                        context.enable(depMap, this);
                    }
                }));

                //Enable each plugin that is used in
                //a dependency
                eachProp(this.pluginMaps, bind(this, function (pluginMap) {
                    var mod = getOwn(registry, pluginMap.id);
                    if (mod && !mod.enabled) {
                        context.enable(pluginMap, this);
                    }
                }));

                this.enabling = false;

                this.check();
            },

            on: function (name, cb) {
                var cbs = this.events[name];
                if (!cbs) {
                    cbs = this.events[name] = [];
                }
                cbs.push(cb);
            },

            emit: function (name, evt) {
                each(this.events[name], function (cb) {
                    cb(evt);
                });
                if (name === 'error') {
                    //Now that the error handler was triggered, remove
                    //the listeners, since this broken Module instance
                    //can stay around for a while in the registry.
                    delete this.events[name];
                }
            }
        };

        function callGetModule(args) {
            //Skip modules already defined.
            if (!hasProp(defined, args[0])) {
                getModule(makeModuleMap(args[0], null, true)).init(args[1], args[2]);
            }
        }

        function removeListener(node, func, name, ieName) {
            //Favor detachEvent because of IE9
            //issue, see attachEvent/addEventListener comment elsewhere
            //in this file.
            if (node.detachEvent && !isOpera) {
                //Probably IE. If not it will throw an error, which will be
                //useful to know.
                if (ieName) {
                    node.detachEvent(ieName, func);
                }
            } else {
                node.removeEventListener(name, func, false);
            }
        }

        /**
         * Given an event from a script node, get the requirejs info from it,
         * and then removes the event listeners on the node.
         * @param {Event} evt
         * @returns {Object}
         */
        function getScriptData(evt) {
            //Using currentTarget instead of target for Firefox 2.0's sake. Not
            //all old browsers will be supported, but this one was easy enough
            //to support and still makes sense.
            var node = evt.currentTarget || evt.srcElement;

            //Remove the listeners once here.
            removeListener(node, context.onScriptLoad, 'load', 'onreadystatechange');
            removeListener(node, context.onScriptError, 'error');

            return {
                node: node,
                id: node && node.getAttribute('data-requiremodule')
            };
        }

        function intakeDefines() {
            var args;

            //Any defined modules in the global queue, intake them now.
            takeGlobalQueue();

            //Make sure any remaining defQueue items get properly processed.
            while (defQueue.length) {
                args = defQueue.shift();
                if (args[0] === null) {
                    return onError(makeError('mismatch', 'Mismatched anonymous define() module: ' +
                        args[args.length - 1]));
                } else {
                    //args are id, deps, factory. Should be normalized by the
                    //define() function.
                    callGetModule(args);
                }
            }
            context.defQueueMap = {};
        }

        context = {
            config: config,
            contextName: contextName,
            registry: registry,
            defined: defined,
            urlFetched: urlFetched,
            defQueue: defQueue,
            defQueueMap: {},
            Module: Module,
            makeModuleMap: makeModuleMap,
            nextTick: req.nextTick,
            onError: onError,

            /**
             * Set a configuration for the context.
             * @param {Object} cfg config object to integrate.
             */
            configure: function (cfg) {
                //Make sure the baseUrl ends in a slash.
                if (cfg.baseUrl) {
                    if (cfg.baseUrl.charAt(cfg.baseUrl.length - 1) !== '/') {
                        cfg.baseUrl += '/';
                    }
                }

                // Convert old style urlArgs string to a function.
                if (typeof cfg.urlArgs === 'string') {
                    var urlArgs = cfg.urlArgs;
                    cfg.urlArgs = function(id, url) {
                        return (url.indexOf('?') === -1 ? '?' : '&') + urlArgs;
                    };
                }

                //Save off the paths since they require special processing,
                //they are additive.
                var shim = config.shim,
                    objs = {
                        paths: true,
                        bundles: true,
                        config: true,
                        map: true
                    };

                eachProp(cfg, function (value, prop) {
                    if (objs[prop]) {
                        if (!config[prop]) {
                            config[prop] = {};
                        }
                        mixin(config[prop], value, true, true);
                    } else {
                        config[prop] = value;
                    }
                });

                //Reverse map the bundles
                if (cfg.bundles) {
                    eachProp(cfg.bundles, function (value, prop) {
                        each(value, function (v) {
                            if (v !== prop) {
                                bundlesMap[v] = prop;
                            }
                        });
                    });
                }

                //Merge shim
                if (cfg.shim) {
                    eachProp(cfg.shim, function (value, id) {
                        //Normalize the structure
                        if (isArray(value)) {
                            value = {
                                deps: value
                            };
                        }
                        if ((value.exports || value.init) && !value.exportsFn) {
                            value.exportsFn = context.makeShimExports(value);
                        }
                        shim[id] = value;
                    });
                    config.shim = shim;
                }

                //Adjust packages if necessary.
                if (cfg.packages) {
                    each(cfg.packages, function (pkgObj) {
                        var location, name;

                        pkgObj = typeof pkgObj === 'string' ? {name: pkgObj} : pkgObj;

                        name = pkgObj.name;
                        location = pkgObj.location;
                        if (location) {
                            config.paths[name] = pkgObj.location;
                        }

                        //Save pointer to main module ID for pkg name.
                        //Remove leading dot in main, so main paths are normalized,
                        //and remove any trailing .js, since different package
                        //envs have different conventions: some use a module name,
                        //some use a file name.
                        config.pkgs[name] = pkgObj.name + '/' + (pkgObj.main || 'main')
                                     .replace(currDirRegExp, '')
                                     .replace(jsSuffixRegExp, '');
                    });
                }

                //If there are any "waiting to execute" modules in the registry,
                //update the maps for them, since their info, like URLs to load,
                //may have changed.
                eachProp(registry, function (mod, id) {
                    //If module already has init called, since it is too
                    //late to modify them, and ignore unnormalized ones
                    //since they are transient.
                    if (!mod.inited && !mod.map.unnormalized) {
                        mod.map = makeModuleMap(id, null, true);
                    }
                });

                //If a deps array or a config callback is specified, then call
                //require with those args. This is useful when require is defined as a
                //config object before require.js is loaded.
                if (cfg.deps || cfg.callback) {
                    context.require(cfg.deps || [], cfg.callback);
                }
            },

            makeShimExports: function (value) {
                function fn() {
                    var ret;
                    if (value.init) {
                        ret = value.init.apply(global, arguments);
                    }
                    return ret || (value.exports && getGlobal(value.exports));
                }
                return fn;
            },

            makeRequire: function (relMap, options) {
                options = options || {};

                function localRequire(deps, callback, errback) {
                    var id, map, requireMod;

                    if (options.enableBuildCallback && callback && isFunction(callback)) {
                        callback.__requireJsBuild = true;
                    }

                    if (typeof deps === 'string') {
                        if (isFunction(callback)) {
                            //Invalid call
                            return onError(makeError('requireargs', 'Invalid require call'), errback);
                        }

                        //If require|exports|module are requested, get the
                        //value for them from the special handlers. Caveat:
                        //this only works while module is being defined.
                        if (relMap && hasProp(handlers, deps)) {
                            return handlers[deps](registry[relMap.id]);
                        }

                        //Synchronous access to one module. If require.get is
                        //available (as in the Node adapter), prefer that.
                        if (req.get) {
                            return req.get(context, deps, relMap, localRequire);
                        }

                        //Normalize module name, if it contains . or ..
                        map = makeModuleMap(deps, relMap, false, true);
                        id = map.id;

                        if (!hasProp(defined, id)) {
                            return onError(makeError('notloaded', 'Module name "' +
                                        id +
                                        '" has not been loaded yet for context: ' +
                                        contextName +
                                        (relMap ? '' : '. Use require([])')));
                        }
                        return defined[id];
                    }

                    //Grab defines waiting in the global queue.
                    intakeDefines();

                    //Mark all the dependencies as needing to be loaded.
                    context.nextTick(function () {
                        //Some defines could have been added since the
                        //require call, collect them.
                        intakeDefines();

                        requireMod = getModule(makeModuleMap(null, relMap));

                        //Store if map config should be applied to this require
                        //call for dependencies.
                        requireMod.skipMap = options.skipMap;

                        requireMod.init(deps, callback, errback, {
                            enabled: true
                        });

                        checkLoaded();
                    });

                    return localRequire;
                }

                mixin(localRequire, {
                    isBrowser: isBrowser,

                    /**
                     * Converts a module name + .extension into an URL path.
                     * *Requires* the use of a module name. It does not support using
                     * plain URLs like nameToUrl.
                     */
                    toUrl: function (moduleNamePlusExt) {
                        var ext,
                            index = moduleNamePlusExt.lastIndexOf('.'),
                            segment = moduleNamePlusExt.split('/')[0],
                            isRelative = segment === '.' || segment === '..';

                        //Have a file extension alias, and it is not the
                        //dots from a relative path.
                        if (index !== -1 && (!isRelative || index > 1)) {
                            ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
                            moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
                        }

                        return context.nameToUrl(normalize(moduleNamePlusExt,
                                                relMap && relMap.id, true), ext,  true);
                    },

                    defined: function (id) {
                        return hasProp(defined, makeModuleMap(id, relMap, false, true).id);
                    },

                    specified: function (id) {
                        id = makeModuleMap(id, relMap, false, true).id;
                        return hasProp(defined, id) || hasProp(registry, id);
                    }
                });

                //Only allow undef on top level require calls
                if (!relMap) {
                    localRequire.undef = function (id) {
                        //Bind any waiting define() calls to this context,
                        //fix for #408
                        takeGlobalQueue();

                        var map = makeModuleMap(id, relMap, true),
                            mod = getOwn(registry, id);

                        mod.undefed = true;
                        removeScript(id);

                        delete defined[id];
                        delete urlFetched[map.url];
                        delete undefEvents[id];

                        //Clean queued defines too. Go backwards
                        //in array so that the splices do not
                        //mess up the iteration.
                        eachReverse(defQueue, function(args, i) {
                            if (args[0] === id) {
                                defQueue.splice(i, 1);
                            }
                        });
                        delete context.defQueueMap[id];

                        if (mod) {
                            //Hold on to listeners in case the
                            //module will be attempted to be reloaded
                            //using a different config.
                            if (mod.events.defined) {
                                undefEvents[id] = mod.events;
                            }

                            cleanRegistry(id);
                        }
                    };
                }

                return localRequire;
            },

            /**
             * Called to enable a module if it is still in the registry
             * awaiting enablement. A second arg, parent, the parent module,
             * is passed in for context, when this method is overridden by
             * the optimizer. Not shown here to keep code compact.
             */
            enable: function (depMap) {
                var mod = getOwn(registry, depMap.id);
                if (mod) {
                    getModule(depMap).enable();
                }
            },

            /**
             * Internal method used by environment adapters to complete a load event.
             * A load event could be a script load or just a load pass from a synchronous
             * load call.
             * @param {String} moduleName the name of the module to potentially complete.
             */
            completeLoad: function (moduleName) {
                var found, args, mod,
                    shim = getOwn(config.shim, moduleName) || {},
                    shExports = shim.exports;

                takeGlobalQueue();

                while (defQueue.length) {
                    args = defQueue.shift();
                    if (args[0] === null) {
                        args[0] = moduleName;
                        //If already found an anonymous module and bound it
                        //to this name, then this is some other anon module
                        //waiting for its completeLoad to fire.
                        if (found) {
                            break;
                        }
                        found = true;
                    } else if (args[0] === moduleName) {
                        //Found matching define call for this script!
                        found = true;
                    }

                    callGetModule(args);
                }
                context.defQueueMap = {};

                //Do this after the cycle of callGetModule in case the result
                //of those calls/init calls changes the registry.
                mod = getOwn(registry, moduleName);

                if (!found && !hasProp(defined, moduleName) && mod && !mod.inited) {
                    if (config.enforceDefine && (!shExports || !getGlobal(shExports))) {
                        if (hasPathFallback(moduleName)) {
                            return;
                        } else {
                            return onError(makeError('nodefine',
                                             'No define call for ' + moduleName,
                                             null,
                                             [moduleName]));
                        }
                    } else {
                        //A script that does not call define(), so just simulate
                        //the call for it.
                        callGetModule([moduleName, (shim.deps || []), shim.exportsFn]);
                    }
                }

                checkLoaded();
            },

            /**
             * Converts a module name to a file path. Supports cases where
             * moduleName may actually be just an URL.
             * Note that it **does not** call normalize on the moduleName,
             * it is assumed to have already been normalized. This is an
             * internal API, not a public one. Use toUrl for the public API.
             */
            nameToUrl: function (moduleName, ext, skipExt) {
                var paths, syms, i, parentModule, url,
                    parentPath, bundleId,
                    pkgMain = getOwn(config.pkgs, moduleName);

                if (pkgMain) {
                    moduleName = pkgMain;
                }

                bundleId = getOwn(bundlesMap, moduleName);

                if (bundleId) {
                    return context.nameToUrl(bundleId, ext, skipExt);
                }

                //If a colon is in the URL, it indicates a protocol is used and it is just
                //an URL to a file, or if it starts with a slash, contains a query arg (i.e. ?)
                //or ends with .js, then assume the user meant to use an url and not a module id.
                //The slash is important for protocol-less URLs as well as full paths.
                if (req.jsExtRegExp.test(moduleName)) {
                    //Just a plain path, not module name lookup, so just return it.
                    //Add extension if it is included. This is a bit wonky, only non-.js things pass
                    //an extension, this method probably needs to be reworked.
                    url = moduleName + (ext || '');
                } else {
                    //A module that needs to be converted to a path.
                    paths = config.paths;

                    syms = moduleName.split('/');
                    //For each module name segment, see if there is a path
                    //registered for it. Start with most specific name
                    //and work up from it.
                    for (i = syms.length; i > 0; i -= 1) {
                        parentModule = syms.slice(0, i).join('/');

                        parentPath = getOwn(paths, parentModule);
                        if (parentPath) {
                            //If an array, it means there are a few choices,
                            //Choose the one that is desired
                            if (isArray(parentPath)) {
                                parentPath = parentPath[0];
                            }
                            syms.splice(0, i, parentPath);
                            break;
                        }
                    }

                    //Join the path parts together, then figure out if baseUrl is needed.
                    url = syms.join('/');
                    url += (ext || (/^data\:|^blob\:|\?/.test(url) || skipExt ? '' : '.js'));
                    url = (url.charAt(0) === '/' || url.match(/^[\w\+\.\-]+:/) ? '' : config.baseUrl) + url;
                }

                return config.urlArgs && !/^blob\:/.test(url) ?
                       url + config.urlArgs(moduleName, url) : url;
            },

            //Delegates to req.load. Broken out as a separate function to
            //allow overriding in the optimizer.
            load: function (id, url) {
                req.load(context, id, url);
            },

            /**
             * Executes a module callback function. Broken out as a separate function
             * solely to allow the build system to sequence the files in the built
             * layer in the right sequence.
             *
             * @private
             */
            execCb: function (name, callback, args, exports) {
                return callback.apply(exports, args);
            },

            /**
             * callback for script loads, used to check status of loading.
             *
             * @param {Event} evt the event from the browser for the script
             * that was loaded.
             */
            onScriptLoad: function (evt) {
                //Using currentTarget instead of target for Firefox 2.0's sake. Not
                //all old browsers will be supported, but this one was easy enough
                //to support and still makes sense.
                if (evt.type === 'load' ||
                        (readyRegExp.test((evt.currentTarget || evt.srcElement).readyState))) {
                    //Reset interactive script so a script node is not held onto for
                    //to long.
                    interactiveScript = null;

                    //Pull out the name of the module and the context.
                    var data = getScriptData(evt);
                    context.completeLoad(data.id);
                }
            },

            /**
             * Callback for script errors.
             */
            onScriptError: function (evt) {
                var data = getScriptData(evt);
                if (!hasPathFallback(data.id)) {
                    var parents = [];
                    eachProp(registry, function(value, key) {
                        if (key.indexOf('_@r') !== 0) {
                            each(value.depMaps, function(depMap) {
                                if (depMap.id === data.id) {
                                    parents.push(key);
                                    return true;
                                }
                            });
                        }
                    });
                    return onError(makeError('scripterror', 'Script error for "' + data.id +
                                             (parents.length ?
                                             '", needed by: ' + parents.join(', ') :
                                             '"'), evt, [data.id]));
                }
            }
        };

        context.require = context.makeRequire();
        return context;
    }

    /**
     * Main entry point.
     *
     * If the only argument to require is a string, then the module that
     * is represented by that string is fetched for the appropriate context.
     *
     * If the first argument is an array, then it will be treated as an array
     * of dependency string names to fetch. An optional function callback can
     * be specified to execute when all of those dependencies are available.
     *
     * Make a local req variable to help Caja compliance (it assumes things
     * on a require that are not standardized), and to give a short
     * name for minification/local scope use.
     */
    req = requirejs = function (deps, callback, errback, optional) {

        //Find the right context, use default
        var context, config,
            contextName = defContextName;

        // Determine if have config object in the call.
        if (!isArray(deps) && typeof deps !== 'string') {
            // deps is a config object
            config = deps;
            if (isArray(callback)) {
                // Adjust args if there are dependencies
                deps = callback;
                callback = errback;
                errback = optional;
            } else {
                deps = [];
            }
        }

        if (config && config.context) {
            contextName = config.context;
        }

        context = getOwn(contexts, contextName);
        if (!context) {
            context = contexts[contextName] = req.s.newContext(contextName);
        }

        if (config) {
            context.configure(config);
        }

        return context.require(deps, callback, errback);
    };

    /**
     * Support require.config() to make it easier to cooperate with other
     * AMD loaders on globally agreed names.
     */
    req.config = function (config) {
        return req(config);
    };

    /**
     * Execute something after the current tick
     * of the event loop. Override for other envs
     * that have a better solution than setTimeout.
     * @param  {Function} fn function to execute later.
     */
    req.nextTick = typeof setTimeout !== 'undefined' ? function (fn) {
        setTimeout(fn, 4);
    } : function (fn) { fn(); };

    /**
     * Export require as a global, but only if it does not already exist.
     */
    if (!require) {
        require = req;
    }

    req.version = version;

    //Used to filter out dependencies that are already paths.
    req.jsExtRegExp = /^\/|:|\?|\.js$/;
    req.isBrowser = isBrowser;
    s = req.s = {
        contexts: contexts,
        newContext: newContext
    };

    //Create default context.
    req({});

    //Exports some context-sensitive methods on global require.
    each([
        'toUrl',
        'undef',
        'defined',
        'specified'
    ], function (prop) {
        //Reference from contexts instead of early binding to default context,
        //so that during builds, the latest instance of the default context
        //with its config gets used.
        req[prop] = function () {
            var ctx = contexts[defContextName];
            return ctx.require[prop].apply(ctx, arguments);
        };
    });

    if (isBrowser) {
        head = s.head = document.getElementsByTagName('head')[0];
        //If BASE tag is in play, using appendChild is a problem for IE6.
        //When that browser dies, this can be removed. Details in this jQuery bug:
        //http://dev.jquery.com/ticket/2709
        baseElement = document.getElementsByTagName('base')[0];
        if (baseElement) {
            head = s.head = baseElement.parentNode;
        }
    }

    /**
     * Any errors that require explicitly generates will be passed to this
     * function. Intercept/override it if you want custom error handling.
     * @param {Error} err the error object.
     */
    req.onError = defaultOnError;

    /**
     * Creates the node for the load command. Only used in browser envs.
     */
    req.createNode = function (config, moduleName, url) {
        var node = config.xhtml ?
                document.createElementNS('http://www.w3.org/1999/xhtml', 'html:script') :
                document.createElement('script');
        node.type = config.scriptType || 'text/javascript';
        node.charset = 'utf-8';
        node.async = true;
        return node;
    };

    /**
     * Does the request to load a module for the browser case.
     * Make this a separate function to allow other environments
     * to override it.
     *
     * @param {Object} context the require context to find state.
     * @param {String} moduleName the name of the module.
     * @param {Object} url the URL to the module.
     */
    req.load = function (context, moduleName, url) {
        var config = (context && context.config) || {},
            node;
        if (isBrowser) {
            //In the browser so use a script tag
            node = req.createNode(config, moduleName, url);

            node.setAttribute('data-requirecontext', context.contextName);
            node.setAttribute('data-requiremodule', moduleName);

            //Set up load listener. Test attachEvent first because IE9 has
            //a subtle issue in its addEventListener and script onload firings
            //that do not match the behavior of all other browsers with
            //addEventListener support, which fire the onload event for a
            //script right after the script execution. See:
            //https://connect.microsoft.com/IE/feedback/details/648057/script-onload-event-is-not-fired-immediately-after-script-execution
            //UNFORTUNATELY Opera implements attachEvent but does not follow the script
            //script execution mode.
            if (node.attachEvent &&
                    //Check if node.attachEvent is artificially added by custom script or
                    //natively supported by browser
                    //read https://github.com/requirejs/requirejs/issues/187
                    //if we can NOT find [native code] then it must NOT natively supported.
                    //in IE8, node.attachEvent does not have toString()
                    //Note the test for "[native code" with no closing brace, see:
                    //https://github.com/requirejs/requirejs/issues/273
                    !(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) &&
                    !isOpera) {
                //Probably IE. IE (at least 6-8) do not fire
                //script onload right after executing the script, so
                //we cannot tie the anonymous define call to a name.
                //However, IE reports the script as being in 'interactive'
                //readyState at the time of the define call.
                useInteractive = true;

                node.attachEvent('onreadystatechange', context.onScriptLoad);
                //It would be great to add an error handler here to catch
                //404s in IE9+. However, onreadystatechange will fire before
                //the error handler, so that does not help. If addEventListener
                //is used, then IE will fire error before load, but we cannot
                //use that pathway given the connect.microsoft.com issue
                //mentioned above about not doing the 'script execute,
                //then fire the script load event listener before execute
                //next script' that other browsers do.
                //Best hope: IE10 fixes the issues,
                //and then destroys all installs of IE 6-9.
                //node.attachEvent('onerror', context.onScriptError);
            } else {
                node.addEventListener('load', context.onScriptLoad, false);
                node.addEventListener('error', context.onScriptError, false);
            }
            node.src = url;

            //Calling onNodeCreated after all properties on the node have been
            //set, but before it is placed in the DOM.
            if (config.onNodeCreated) {
                config.onNodeCreated(node, config, moduleName, url);
            }

            //For some cache cases in IE 6-8, the script executes before the end
            //of the appendChild execution, so to tie an anonymous define
            //call to the module name (which is stored on the node), hold on
            //to a reference to this node, but clear after the DOM insertion.
            currentlyAddingScript = node;
            if (baseElement) {
                head.insertBefore(node, baseElement);
            } else {
                head.appendChild(node);
            }
            currentlyAddingScript = null;

            return node;
        } else if (isWebWorker) {
            try {
                //In a web worker, use importScripts. This is not a very
                //efficient use of importScripts, importScripts will block until
                //its script is downloaded and evaluated. However, if web workers
                //are in play, the expectation is that a build has been done so
                //that only one script needs to be loaded anyway. This may need
                //to be reevaluated if other use cases become common.

                // Post a task to the event loop to work around a bug in WebKit
                // where the worker gets garbage-collected after calling
                // importScripts(): https://webkit.org/b/153317
                setTimeout(function() {}, 0);
                importScripts(url);

                //Account for anonymous modules
                context.completeLoad(moduleName);
            } catch (e) {
                context.onError(makeError('importscripts',
                                'importScripts failed for ' +
                                    moduleName + ' at ' + url,
                                e,
                                [moduleName]));
            }
        }
    };

    function getInteractiveScript() {
        if (interactiveScript && interactiveScript.readyState === 'interactive') {
            return interactiveScript;
        }

        eachReverse(scripts(), function (script) {
            if (script.readyState === 'interactive') {
                return (interactiveScript = script);
            }
        });
        return interactiveScript;
    }

    //Look for a data-main script attribute, which could also adjust the baseUrl.
    if (isBrowser && !cfg.skipDataMain) {
        //Figure out baseUrl. Get it from the script tag with require.js in it.
        eachReverse(scripts(), function (script) {
            //Set the 'head' where we can append children by
            //using the script's parent.
            if (!head) {
                head = script.parentNode;
            }

            //Look for a data-main attribute to set main script for the page
            //to load. If it is there, the path to data main becomes the
            //baseUrl, if it is not already set.
            dataMain = script.getAttribute('data-main');
            if (dataMain) {
                //Preserve dataMain in case it is a path (i.e. contains '?')
                mainScript = dataMain;

                //Set final baseUrl if there is not already an explicit one,
                //but only do so if the data-main value is not a loader plugin
                //module ID.
                if (!cfg.baseUrl && mainScript.indexOf('!') === -1) {
                    //Pull off the directory of data-main for use as the
                    //baseUrl.
                    src = mainScript.split('/');
                    mainScript = src.pop();
                    subPath = src.length ? src.join('/')  + '/' : './';

                    cfg.baseUrl = subPath;
                }

                //Strip off any trailing .js since mainScript is now
                //like a module name.
                mainScript = mainScript.replace(jsSuffixRegExp, '');

                //If mainScript is still a path, fall back to dataMain
                if (req.jsExtRegExp.test(mainScript)) {
                    mainScript = dataMain;
                }

                //Put the data-main script in the files to load.
                cfg.deps = cfg.deps ? cfg.deps.concat(mainScript) : [mainScript];

                return true;
            }
        });
    }

    /**
     * The function that handles definitions of modules. Differs from
     * require() in that a string for the module should be the first argument,
     * and the function to execute after dependencies are loaded should
     * return a value to define the module corresponding to the first argument's
     * name.
     */
    define = function (name, deps, callback) {
        var node, context;

        //Allow for anonymous modules
        if (typeof name !== 'string') {
            //Adjust args appropriately
            callback = deps;
            deps = name;
            name = null;
        }

        //This module may not have dependencies
        if (!isArray(deps)) {
            callback = deps;
            deps = null;
        }

        //If no name, and callback is a function, then figure out if it a
        //CommonJS thing with dependencies.
        if (!deps && isFunction(callback)) {
            deps = [];
            //Remove comments from the callback string,
            //look for require calls, and pull them into the dependencies,
            //but only if there are function args.
            if (callback.length) {
                callback
                    .toString()
                    .replace(commentRegExp, commentReplace)
                    .replace(cjsRequireRegExp, function (match, dep) {
                        deps.push(dep);
                    });

                //May be a CommonJS thing even without require calls, but still
                //could use exports, and module. Avoid doing exports and module
                //work though if it just needs require.
                //REQUIRES the function to expect the CommonJS variables in the
                //order listed below.
                deps = (callback.length === 1 ? ['require'] : ['require', 'exports', 'module']).concat(deps);
            }
        }

        //If in IE 6-8 and hit an anonymous define() call, do the interactive
        //work.
        if (useInteractive) {
            node = currentlyAddingScript || getInteractiveScript();
            if (node) {
                if (!name) {
                    name = node.getAttribute('data-requiremodule');
                }
                context = contexts[node.getAttribute('data-requirecontext')];
            }
        }

        //Always save off evaluating the def call until the script onload handler.
        //This allows multiple modules to be in a file without prematurely
        //tracing dependencies, and allows for anonymous module support,
        //where the module name is not known until the script onload event
        //occurs. If no context, use the global queue, and get it processed
        //in the onscript load callback.
        if (context) {
            context.defQueue.push([name, deps, callback]);
            context.defQueueMap[name] = true;
        } else {
            globalDefQueue.push([name, deps, callback]);
        }
    };

    define.amd = {
        jQuery: true
    };

    /**
     * Executes the text. Normally just uses eval, but can be modified
     * to use a better, environment-specific call. Only used for transpiling
     * loader plugins, not for plain JS modules.
     * @param {String} text the text to execute/evaluate.
     */
    req.exec = function (text) {
        /*jslint evil: true */
        return eval(text);
    };

    //Set up with config info.
    req(cfg);
}(this, (typeof setTimeout === 'undefined' ? undefined : setTimeout)));
;
var global = this; _aureliaConfigureModuleLoader();;
define('text!@fortawesome/fontawesome-free/css/all.min.css',[],function(){return "/*!\n * Font Awesome Free 5.15.4 by @fontawesome - https://fontawesome.com\n * License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License)\n */\n.fa,.fab,.fad,.fal,.far,.fas{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;display:inline-block;font-style:normal;font-variant:normal;text-rendering:auto;line-height:1}.fa-lg{font-size:1.33333em;line-height:.75em;vertical-align:-.0667em}.fa-xs{font-size:.75em}.fa-sm{font-size:.875em}.fa-1x{font-size:1em}.fa-2x{font-size:2em}.fa-3x{font-size:3em}.fa-4x{font-size:4em}.fa-5x{font-size:5em}.fa-6x{font-size:6em}.fa-7x{font-size:7em}.fa-8x{font-size:8em}.fa-9x{font-size:9em}.fa-10x{font-size:10em}.fa-fw{text-align:center;width:1.25em}.fa-ul{list-style-type:none;margin-left:2.5em;padding-left:0}.fa-ul>li{position:relative}.fa-li{left:-2em;position:absolute;text-align:center;width:2em;line-height:inherit}.fa-border{border:.08em solid #eee;border-radius:.1em;padding:.2em .25em .15em}.fa-pull-left{float:left}.fa-pull-right{float:right}.fa.fa-pull-left,.fab.fa-pull-left,.fal.fa-pull-left,.far.fa-pull-left,.fas.fa-pull-left{margin-right:.3em}.fa.fa-pull-right,.fab.fa-pull-right,.fal.fa-pull-right,.far.fa-pull-right,.fas.fa-pull-right{margin-left:.3em}.fa-spin{-webkit-animation:fa-spin 2s linear infinite;animation:fa-spin 2s linear infinite}.fa-pulse{-webkit-animation:fa-spin 1s steps(8) infinite;animation:fa-spin 1s steps(8) infinite}@-webkit-keyframes fa-spin{0%{-webkit-transform:rotate(0deg);transform:rotate(0deg)}to{-webkit-transform:rotate(1turn);transform:rotate(1turn)}}@keyframes fa-spin{0%{-webkit-transform:rotate(0deg);transform:rotate(0deg)}to{-webkit-transform:rotate(1turn);transform:rotate(1turn)}}.fa-rotate-90{-ms-filter:\"progid:DXImageTransform.Microsoft.BasicImage(rotation=1)\";-webkit-transform:rotate(90deg);transform:rotate(90deg)}.fa-rotate-180{-ms-filter:\"progid:DXImageTransform.Microsoft.BasicImage(rotation=2)\";-webkit-transform:rotate(180deg);transform:rotate(180deg)}.fa-rotate-270{-ms-filter:\"progid:DXImageTransform.Microsoft.BasicImage(rotation=3)\";-webkit-transform:rotate(270deg);transform:rotate(270deg)}.fa-flip-horizontal{-ms-filter:\"progid:DXImageTransform.Microsoft.BasicImage(rotation=0, mirror=1)\";-webkit-transform:scaleX(-1);transform:scaleX(-1)}.fa-flip-vertical{-webkit-transform:scaleY(-1);transform:scaleY(-1)}.fa-flip-both,.fa-flip-horizontal.fa-flip-vertical,.fa-flip-vertical{-ms-filter:\"progid:DXImageTransform.Microsoft.BasicImage(rotation=2, mirror=1)\"}.fa-flip-both,.fa-flip-horizontal.fa-flip-vertical{-webkit-transform:scale(-1);transform:scale(-1)}:root .fa-flip-both,:root .fa-flip-horizontal,:root .fa-flip-vertical,:root .fa-rotate-90,:root .fa-rotate-180,:root .fa-rotate-270{-webkit-filter:none;filter:none}.fa-stack{display:inline-block;height:2em;line-height:2em;position:relative;vertical-align:middle;width:2.5em}.fa-stack-1x,.fa-stack-2x{left:0;position:absolute;text-align:center;width:100%}.fa-stack-1x{line-height:inherit}.fa-stack-2x{font-size:2em}.fa-inverse{color:#fff}.fa-500px:before{content:\"\\f26e\"}.fa-accessible-icon:before{content:\"\\f368\"}.fa-accusoft:before{content:\"\\f369\"}.fa-acquisitions-incorporated:before{content:\"\\f6af\"}.fa-ad:before{content:\"\\f641\"}.fa-address-book:before{content:\"\\f2b9\"}.fa-address-card:before{content:\"\\f2bb\"}.fa-adjust:before{content:\"\\f042\"}.fa-adn:before{content:\"\\f170\"}.fa-adversal:before{content:\"\\f36a\"}.fa-affiliatetheme:before{content:\"\\f36b\"}.fa-air-freshener:before{content:\"\\f5d0\"}.fa-airbnb:before{content:\"\\f834\"}.fa-algolia:before{content:\"\\f36c\"}.fa-align-center:before{content:\"\\f037\"}.fa-align-justify:before{content:\"\\f039\"}.fa-align-left:before{content:\"\\f036\"}.fa-align-right:before{content:\"\\f038\"}.fa-alipay:before{content:\"\\f642\"}.fa-allergies:before{content:\"\\f461\"}.fa-amazon:before{content:\"\\f270\"}.fa-amazon-pay:before{content:\"\\f42c\"}.fa-ambulance:before{content:\"\\f0f9\"}.fa-american-sign-language-interpreting:before{content:\"\\f2a3\"}.fa-amilia:before{content:\"\\f36d\"}.fa-anchor:before{content:\"\\f13d\"}.fa-android:before{content:\"\\f17b\"}.fa-angellist:before{content:\"\\f209\"}.fa-angle-double-down:before{content:\"\\f103\"}.fa-angle-double-left:before{content:\"\\f100\"}.fa-angle-double-right:before{content:\"\\f101\"}.fa-angle-double-up:before{content:\"\\f102\"}.fa-angle-down:before{content:\"\\f107\"}.fa-angle-left:before{content:\"\\f104\"}.fa-angle-right:before{content:\"\\f105\"}.fa-angle-up:before{content:\"\\f106\"}.fa-angry:before{content:\"\\f556\"}.fa-angrycreative:before{content:\"\\f36e\"}.fa-angular:before{content:\"\\f420\"}.fa-ankh:before{content:\"\\f644\"}.fa-app-store:before{content:\"\\f36f\"}.fa-app-store-ios:before{content:\"\\f370\"}.fa-apper:before{content:\"\\f371\"}.fa-apple:before{content:\"\\f179\"}.fa-apple-alt:before{content:\"\\f5d1\"}.fa-apple-pay:before{content:\"\\f415\"}.fa-archive:before{content:\"\\f187\"}.fa-archway:before{content:\"\\f557\"}.fa-arrow-alt-circle-down:before{content:\"\\f358\"}.fa-arrow-alt-circle-left:before{content:\"\\f359\"}.fa-arrow-alt-circle-right:before{content:\"\\f35a\"}.fa-arrow-alt-circle-up:before{content:\"\\f35b\"}.fa-arrow-circle-down:before{content:\"\\f0ab\"}.fa-arrow-circle-left:before{content:\"\\f0a8\"}.fa-arrow-circle-right:before{content:\"\\f0a9\"}.fa-arrow-circle-up:before{content:\"\\f0aa\"}.fa-arrow-down:before{content:\"\\f063\"}.fa-arrow-left:before{content:\"\\f060\"}.fa-arrow-right:before{content:\"\\f061\"}.fa-arrow-up:before{content:\"\\f062\"}.fa-arrows-alt:before{content:\"\\f0b2\"}.fa-arrows-alt-h:before{content:\"\\f337\"}.fa-arrows-alt-v:before{content:\"\\f338\"}.fa-artstation:before{content:\"\\f77a\"}.fa-assistive-listening-systems:before{content:\"\\f2a2\"}.fa-asterisk:before{content:\"\\f069\"}.fa-asymmetrik:before{content:\"\\f372\"}.fa-at:before{content:\"\\f1fa\"}.fa-atlas:before{content:\"\\f558\"}.fa-atlassian:before{content:\"\\f77b\"}.fa-atom:before{content:\"\\f5d2\"}.fa-audible:before{content:\"\\f373\"}.fa-audio-description:before{content:\"\\f29e\"}.fa-autoprefixer:before{content:\"\\f41c\"}.fa-avianex:before{content:\"\\f374\"}.fa-aviato:before{content:\"\\f421\"}.fa-award:before{content:\"\\f559\"}.fa-aws:before{content:\"\\f375\"}.fa-baby:before{content:\"\\f77c\"}.fa-baby-carriage:before{content:\"\\f77d\"}.fa-backspace:before{content:\"\\f55a\"}.fa-backward:before{content:\"\\f04a\"}.fa-bacon:before{content:\"\\f7e5\"}.fa-bacteria:before{content:\"\\e059\"}.fa-bacterium:before{content:\"\\e05a\"}.fa-bahai:before{content:\"\\f666\"}.fa-balance-scale:before{content:\"\\f24e\"}.fa-balance-scale-left:before{content:\"\\f515\"}.fa-balance-scale-right:before{content:\"\\f516\"}.fa-ban:before{content:\"\\f05e\"}.fa-band-aid:before{content:\"\\f462\"}.fa-bandcamp:before{content:\"\\f2d5\"}.fa-barcode:before{content:\"\\f02a\"}.fa-bars:before{content:\"\\f0c9\"}.fa-baseball-ball:before{content:\"\\f433\"}.fa-basketball-ball:before{content:\"\\f434\"}.fa-bath:before{content:\"\\f2cd\"}.fa-battery-empty:before{content:\"\\f244\"}.fa-battery-full:before{content:\"\\f240\"}.fa-battery-half:before{content:\"\\f242\"}.fa-battery-quarter:before{content:\"\\f243\"}.fa-battery-three-quarters:before{content:\"\\f241\"}.fa-battle-net:before{content:\"\\f835\"}.fa-bed:before{content:\"\\f236\"}.fa-beer:before{content:\"\\f0fc\"}.fa-behance:before{content:\"\\f1b4\"}.fa-behance-square:before{content:\"\\f1b5\"}.fa-bell:before{content:\"\\f0f3\"}.fa-bell-slash:before{content:\"\\f1f6\"}.fa-bezier-curve:before{content:\"\\f55b\"}.fa-bible:before{content:\"\\f647\"}.fa-bicycle:before{content:\"\\f206\"}.fa-biking:before{content:\"\\f84a\"}.fa-bimobject:before{content:\"\\f378\"}.fa-binoculars:before{content:\"\\f1e5\"}.fa-biohazard:before{content:\"\\f780\"}.fa-birthday-cake:before{content:\"\\f1fd\"}.fa-bitbucket:before{content:\"\\f171\"}.fa-bitcoin:before{content:\"\\f379\"}.fa-bity:before{content:\"\\f37a\"}.fa-black-tie:before{content:\"\\f27e\"}.fa-blackberry:before{content:\"\\f37b\"}.fa-blender:before{content:\"\\f517\"}.fa-blender-phone:before{content:\"\\f6b6\"}.fa-blind:before{content:\"\\f29d\"}.fa-blog:before{content:\"\\f781\"}.fa-blogger:before{content:\"\\f37c\"}.fa-blogger-b:before{content:\"\\f37d\"}.fa-bluetooth:before{content:\"\\f293\"}.fa-bluetooth-b:before{content:\"\\f294\"}.fa-bold:before{content:\"\\f032\"}.fa-bolt:before{content:\"\\f0e7\"}.fa-bomb:before{content:\"\\f1e2\"}.fa-bone:before{content:\"\\f5d7\"}.fa-bong:before{content:\"\\f55c\"}.fa-book:before{content:\"\\f02d\"}.fa-book-dead:before{content:\"\\f6b7\"}.fa-book-medical:before{content:\"\\f7e6\"}.fa-book-open:before{content:\"\\f518\"}.fa-book-reader:before{content:\"\\f5da\"}.fa-bookmark:before{content:\"\\f02e\"}.fa-bootstrap:before{content:\"\\f836\"}.fa-border-all:before{content:\"\\f84c\"}.fa-border-none:before{content:\"\\f850\"}.fa-border-style:before{content:\"\\f853\"}.fa-bowling-ball:before{content:\"\\f436\"}.fa-box:before{content:\"\\f466\"}.fa-box-open:before{content:\"\\f49e\"}.fa-box-tissue:before{content:\"\\e05b\"}.fa-boxes:before{content:\"\\f468\"}.fa-braille:before{content:\"\\f2a1\"}.fa-brain:before{content:\"\\f5dc\"}.fa-bread-slice:before{content:\"\\f7ec\"}.fa-briefcase:before{content:\"\\f0b1\"}.fa-briefcase-medical:before{content:\"\\f469\"}.fa-broadcast-tower:before{content:\"\\f519\"}.fa-broom:before{content:\"\\f51a\"}.fa-brush:before{content:\"\\f55d\"}.fa-btc:before{content:\"\\f15a\"}.fa-buffer:before{content:\"\\f837\"}.fa-bug:before{content:\"\\f188\"}.fa-building:before{content:\"\\f1ad\"}.fa-bullhorn:before{content:\"\\f0a1\"}.fa-bullseye:before{content:\"\\f140\"}.fa-burn:before{content:\"\\f46a\"}.fa-buromobelexperte:before{content:\"\\f37f\"}.fa-bus:before{content:\"\\f207\"}.fa-bus-alt:before{content:\"\\f55e\"}.fa-business-time:before{content:\"\\f64a\"}.fa-buy-n-large:before{content:\"\\f8a6\"}.fa-buysellads:before{content:\"\\f20d\"}.fa-calculator:before{content:\"\\f1ec\"}.fa-calendar:before{content:\"\\f133\"}.fa-calendar-alt:before{content:\"\\f073\"}.fa-calendar-check:before{content:\"\\f274\"}.fa-calendar-day:before{content:\"\\f783\"}.fa-calendar-minus:before{content:\"\\f272\"}.fa-calendar-plus:before{content:\"\\f271\"}.fa-calendar-times:before{content:\"\\f273\"}.fa-calendar-week:before{content:\"\\f784\"}.fa-camera:before{content:\"\\f030\"}.fa-camera-retro:before{content:\"\\f083\"}.fa-campground:before{content:\"\\f6bb\"}.fa-canadian-maple-leaf:before{content:\"\\f785\"}.fa-candy-cane:before{content:\"\\f786\"}.fa-cannabis:before{content:\"\\f55f\"}.fa-capsules:before{content:\"\\f46b\"}.fa-car:before{content:\"\\f1b9\"}.fa-car-alt:before{content:\"\\f5de\"}.fa-car-battery:before{content:\"\\f5df\"}.fa-car-crash:before{content:\"\\f5e1\"}.fa-car-side:before{content:\"\\f5e4\"}.fa-caravan:before{content:\"\\f8ff\"}.fa-caret-down:before{content:\"\\f0d7\"}.fa-caret-left:before{content:\"\\f0d9\"}.fa-caret-right:before{content:\"\\f0da\"}.fa-caret-square-down:before{content:\"\\f150\"}.fa-caret-square-left:before{content:\"\\f191\"}.fa-caret-square-right:before{content:\"\\f152\"}.fa-caret-square-up:before{content:\"\\f151\"}.fa-caret-up:before{content:\"\\f0d8\"}.fa-carrot:before{content:\"\\f787\"}.fa-cart-arrow-down:before{content:\"\\f218\"}.fa-cart-plus:before{content:\"\\f217\"}.fa-cash-register:before{content:\"\\f788\"}.fa-cat:before{content:\"\\f6be\"}.fa-cc-amazon-pay:before{content:\"\\f42d\"}.fa-cc-amex:before{content:\"\\f1f3\"}.fa-cc-apple-pay:before{content:\"\\f416\"}.fa-cc-diners-club:before{content:\"\\f24c\"}.fa-cc-discover:before{content:\"\\f1f2\"}.fa-cc-jcb:before{content:\"\\f24b\"}.fa-cc-mastercard:before{content:\"\\f1f1\"}.fa-cc-paypal:before{content:\"\\f1f4\"}.fa-cc-stripe:before{content:\"\\f1f5\"}.fa-cc-visa:before{content:\"\\f1f0\"}.fa-centercode:before{content:\"\\f380\"}.fa-centos:before{content:\"\\f789\"}.fa-certificate:before{content:\"\\f0a3\"}.fa-chair:before{content:\"\\f6c0\"}.fa-chalkboard:before{content:\"\\f51b\"}.fa-chalkboard-teacher:before{content:\"\\f51c\"}.fa-charging-station:before{content:\"\\f5e7\"}.fa-chart-area:before{content:\"\\f1fe\"}.fa-chart-bar:before{content:\"\\f080\"}.fa-chart-line:before{content:\"\\f201\"}.fa-chart-pie:before{content:\"\\f200\"}.fa-check:before{content:\"\\f00c\"}.fa-check-circle:before{content:\"\\f058\"}.fa-check-double:before{content:\"\\f560\"}.fa-check-square:before{content:\"\\f14a\"}.fa-cheese:before{content:\"\\f7ef\"}.fa-chess:before{content:\"\\f439\"}.fa-chess-bishop:before{content:\"\\f43a\"}.fa-chess-board:before{content:\"\\f43c\"}.fa-chess-king:before{content:\"\\f43f\"}.fa-chess-knight:before{content:\"\\f441\"}.fa-chess-pawn:before{content:\"\\f443\"}.fa-chess-queen:before{content:\"\\f445\"}.fa-chess-rook:before{content:\"\\f447\"}.fa-chevron-circle-down:before{content:\"\\f13a\"}.fa-chevron-circle-left:before{content:\"\\f137\"}.fa-chevron-circle-right:before{content:\"\\f138\"}.fa-chevron-circle-up:before{content:\"\\f139\"}.fa-chevron-down:before{content:\"\\f078\"}.fa-chevron-left:before{content:\"\\f053\"}.fa-chevron-right:before{content:\"\\f054\"}.fa-chevron-up:before{content:\"\\f077\"}.fa-child:before{content:\"\\f1ae\"}.fa-chrome:before{content:\"\\f268\"}.fa-chromecast:before{content:\"\\f838\"}.fa-church:before{content:\"\\f51d\"}.fa-circle:before{content:\"\\f111\"}.fa-circle-notch:before{content:\"\\f1ce\"}.fa-city:before{content:\"\\f64f\"}.fa-clinic-medical:before{content:\"\\f7f2\"}.fa-clipboard:before{content:\"\\f328\"}.fa-clipboard-check:before{content:\"\\f46c\"}.fa-clipboard-list:before{content:\"\\f46d\"}.fa-clock:before{content:\"\\f017\"}.fa-clone:before{content:\"\\f24d\"}.fa-closed-captioning:before{content:\"\\f20a\"}.fa-cloud:before{content:\"\\f0c2\"}.fa-cloud-download-alt:before{content:\"\\f381\"}.fa-cloud-meatball:before{content:\"\\f73b\"}.fa-cloud-moon:before{content:\"\\f6c3\"}.fa-cloud-moon-rain:before{content:\"\\f73c\"}.fa-cloud-rain:before{content:\"\\f73d\"}.fa-cloud-showers-heavy:before{content:\"\\f740\"}.fa-cloud-sun:before{content:\"\\f6c4\"}.fa-cloud-sun-rain:before{content:\"\\f743\"}.fa-cloud-upload-alt:before{content:\"\\f382\"}.fa-cloudflare:before{content:\"\\e07d\"}.fa-cloudscale:before{content:\"\\f383\"}.fa-cloudsmith:before{content:\"\\f384\"}.fa-cloudversify:before{content:\"\\f385\"}.fa-cocktail:before{content:\"\\f561\"}.fa-code:before{content:\"\\f121\"}.fa-code-branch:before{content:\"\\f126\"}.fa-codepen:before{content:\"\\f1cb\"}.fa-codiepie:before{content:\"\\f284\"}.fa-coffee:before{content:\"\\f0f4\"}.fa-cog:before{content:\"\\f013\"}.fa-cogs:before{content:\"\\f085\"}.fa-coins:before{content:\"\\f51e\"}.fa-columns:before{content:\"\\f0db\"}.fa-comment:before{content:\"\\f075\"}.fa-comment-alt:before{content:\"\\f27a\"}.fa-comment-dollar:before{content:\"\\f651\"}.fa-comment-dots:before{content:\"\\f4ad\"}.fa-comment-medical:before{content:\"\\f7f5\"}.fa-comment-slash:before{content:\"\\f4b3\"}.fa-comments:before{content:\"\\f086\"}.fa-comments-dollar:before{content:\"\\f653\"}.fa-compact-disc:before{content:\"\\f51f\"}.fa-compass:before{content:\"\\f14e\"}.fa-compress:before{content:\"\\f066\"}.fa-compress-alt:before{content:\"\\f422\"}.fa-compress-arrows-alt:before{content:\"\\f78c\"}.fa-concierge-bell:before{content:\"\\f562\"}.fa-confluence:before{content:\"\\f78d\"}.fa-connectdevelop:before{content:\"\\f20e\"}.fa-contao:before{content:\"\\f26d\"}.fa-cookie:before{content:\"\\f563\"}.fa-cookie-bite:before{content:\"\\f564\"}.fa-copy:before{content:\"\\f0c5\"}.fa-copyright:before{content:\"\\f1f9\"}.fa-cotton-bureau:before{content:\"\\f89e\"}.fa-couch:before{content:\"\\f4b8\"}.fa-cpanel:before{content:\"\\f388\"}.fa-creative-commons:before{content:\"\\f25e\"}.fa-creative-commons-by:before{content:\"\\f4e7\"}.fa-creative-commons-nc:before{content:\"\\f4e8\"}.fa-creative-commons-nc-eu:before{content:\"\\f4e9\"}.fa-creative-commons-nc-jp:before{content:\"\\f4ea\"}.fa-creative-commons-nd:before{content:\"\\f4eb\"}.fa-creative-commons-pd:before{content:\"\\f4ec\"}.fa-creative-commons-pd-alt:before{content:\"\\f4ed\"}.fa-creative-commons-remix:before{content:\"\\f4ee\"}.fa-creative-commons-sa:before{content:\"\\f4ef\"}.fa-creative-commons-sampling:before{content:\"\\f4f0\"}.fa-creative-commons-sampling-plus:before{content:\"\\f4f1\"}.fa-creative-commons-share:before{content:\"\\f4f2\"}.fa-creative-commons-zero:before{content:\"\\f4f3\"}.fa-credit-card:before{content:\"\\f09d\"}.fa-critical-role:before{content:\"\\f6c9\"}.fa-crop:before{content:\"\\f125\"}.fa-crop-alt:before{content:\"\\f565\"}.fa-cross:before{content:\"\\f654\"}.fa-crosshairs:before{content:\"\\f05b\"}.fa-crow:before{content:\"\\f520\"}.fa-crown:before{content:\"\\f521\"}.fa-crutch:before{content:\"\\f7f7\"}.fa-css3:before{content:\"\\f13c\"}.fa-css3-alt:before{content:\"\\f38b\"}.fa-cube:before{content:\"\\f1b2\"}.fa-cubes:before{content:\"\\f1b3\"}.fa-cut:before{content:\"\\f0c4\"}.fa-cuttlefish:before{content:\"\\f38c\"}.fa-d-and-d:before{content:\"\\f38d\"}.fa-d-and-d-beyond:before{content:\"\\f6ca\"}.fa-dailymotion:before{content:\"\\e052\"}.fa-dashcube:before{content:\"\\f210\"}.fa-database:before{content:\"\\f1c0\"}.fa-deaf:before{content:\"\\f2a4\"}.fa-deezer:before{content:\"\\e077\"}.fa-delicious:before{content:\"\\f1a5\"}.fa-democrat:before{content:\"\\f747\"}.fa-deploydog:before{content:\"\\f38e\"}.fa-deskpro:before{content:\"\\f38f\"}.fa-desktop:before{content:\"\\f108\"}.fa-dev:before{content:\"\\f6cc\"}.fa-deviantart:before{content:\"\\f1bd\"}.fa-dharmachakra:before{content:\"\\f655\"}.fa-dhl:before{content:\"\\f790\"}.fa-diagnoses:before{content:\"\\f470\"}.fa-diaspora:before{content:\"\\f791\"}.fa-dice:before{content:\"\\f522\"}.fa-dice-d20:before{content:\"\\f6cf\"}.fa-dice-d6:before{content:\"\\f6d1\"}.fa-dice-five:before{content:\"\\f523\"}.fa-dice-four:before{content:\"\\f524\"}.fa-dice-one:before{content:\"\\f525\"}.fa-dice-six:before{content:\"\\f526\"}.fa-dice-three:before{content:\"\\f527\"}.fa-dice-two:before{content:\"\\f528\"}.fa-digg:before{content:\"\\f1a6\"}.fa-digital-ocean:before{content:\"\\f391\"}.fa-digital-tachograph:before{content:\"\\f566\"}.fa-directions:before{content:\"\\f5eb\"}.fa-discord:before{content:\"\\f392\"}.fa-discourse:before{content:\"\\f393\"}.fa-disease:before{content:\"\\f7fa\"}.fa-divide:before{content:\"\\f529\"}.fa-dizzy:before{content:\"\\f567\"}.fa-dna:before{content:\"\\f471\"}.fa-dochub:before{content:\"\\f394\"}.fa-docker:before{content:\"\\f395\"}.fa-dog:before{content:\"\\f6d3\"}.fa-dollar-sign:before{content:\"\\f155\"}.fa-dolly:before{content:\"\\f472\"}.fa-dolly-flatbed:before{content:\"\\f474\"}.fa-donate:before{content:\"\\f4b9\"}.fa-door-closed:before{content:\"\\f52a\"}.fa-door-open:before{content:\"\\f52b\"}.fa-dot-circle:before{content:\"\\f192\"}.fa-dove:before{content:\"\\f4ba\"}.fa-download:before{content:\"\\f019\"}.fa-draft2digital:before{content:\"\\f396\"}.fa-drafting-compass:before{content:\"\\f568\"}.fa-dragon:before{content:\"\\f6d5\"}.fa-draw-polygon:before{content:\"\\f5ee\"}.fa-dribbble:before{content:\"\\f17d\"}.fa-dribbble-square:before{content:\"\\f397\"}.fa-dropbox:before{content:\"\\f16b\"}.fa-drum:before{content:\"\\f569\"}.fa-drum-steelpan:before{content:\"\\f56a\"}.fa-drumstick-bite:before{content:\"\\f6d7\"}.fa-drupal:before{content:\"\\f1a9\"}.fa-dumbbell:before{content:\"\\f44b\"}.fa-dumpster:before{content:\"\\f793\"}.fa-dumpster-fire:before{content:\"\\f794\"}.fa-dungeon:before{content:\"\\f6d9\"}.fa-dyalog:before{content:\"\\f399\"}.fa-earlybirds:before{content:\"\\f39a\"}.fa-ebay:before{content:\"\\f4f4\"}.fa-edge:before{content:\"\\f282\"}.fa-edge-legacy:before{content:\"\\e078\"}.fa-edit:before{content:\"\\f044\"}.fa-egg:before{content:\"\\f7fb\"}.fa-eject:before{content:\"\\f052\"}.fa-elementor:before{content:\"\\f430\"}.fa-ellipsis-h:before{content:\"\\f141\"}.fa-ellipsis-v:before{content:\"\\f142\"}.fa-ello:before{content:\"\\f5f1\"}.fa-ember:before{content:\"\\f423\"}.fa-empire:before{content:\"\\f1d1\"}.fa-envelope:before{content:\"\\f0e0\"}.fa-envelope-open:before{content:\"\\f2b6\"}.fa-envelope-open-text:before{content:\"\\f658\"}.fa-envelope-square:before{content:\"\\f199\"}.fa-envira:before{content:\"\\f299\"}.fa-equals:before{content:\"\\f52c\"}.fa-eraser:before{content:\"\\f12d\"}.fa-erlang:before{content:\"\\f39d\"}.fa-ethereum:before{content:\"\\f42e\"}.fa-ethernet:before{content:\"\\f796\"}.fa-etsy:before{content:\"\\f2d7\"}.fa-euro-sign:before{content:\"\\f153\"}.fa-evernote:before{content:\"\\f839\"}.fa-exchange-alt:before{content:\"\\f362\"}.fa-exclamation:before{content:\"\\f12a\"}.fa-exclamation-circle:before{content:\"\\f06a\"}.fa-exclamation-triangle:before{content:\"\\f071\"}.fa-expand:before{content:\"\\f065\"}.fa-expand-alt:before{content:\"\\f424\"}.fa-expand-arrows-alt:before{content:\"\\f31e\"}.fa-expeditedssl:before{content:\"\\f23e\"}.fa-external-link-alt:before{content:\"\\f35d\"}.fa-external-link-square-alt:before{content:\"\\f360\"}.fa-eye:before{content:\"\\f06e\"}.fa-eye-dropper:before{content:\"\\f1fb\"}.fa-eye-slash:before{content:\"\\f070\"}.fa-facebook:before{content:\"\\f09a\"}.fa-facebook-f:before{content:\"\\f39e\"}.fa-facebook-messenger:before{content:\"\\f39f\"}.fa-facebook-square:before{content:\"\\f082\"}.fa-fan:before{content:\"\\f863\"}.fa-fantasy-flight-games:before{content:\"\\f6dc\"}.fa-fast-backward:before{content:\"\\f049\"}.fa-fast-forward:before{content:\"\\f050\"}.fa-faucet:before{content:\"\\e005\"}.fa-fax:before{content:\"\\f1ac\"}.fa-feather:before{content:\"\\f52d\"}.fa-feather-alt:before{content:\"\\f56b\"}.fa-fedex:before{content:\"\\f797\"}.fa-fedora:before{content:\"\\f798\"}.fa-female:before{content:\"\\f182\"}.fa-fighter-jet:before{content:\"\\f0fb\"}.fa-figma:before{content:\"\\f799\"}.fa-file:before{content:\"\\f15b\"}.fa-file-alt:before{content:\"\\f15c\"}.fa-file-archive:before{content:\"\\f1c6\"}.fa-file-audio:before{content:\"\\f1c7\"}.fa-file-code:before{content:\"\\f1c9\"}.fa-file-contract:before{content:\"\\f56c\"}.fa-file-csv:before{content:\"\\f6dd\"}.fa-file-download:before{content:\"\\f56d\"}.fa-file-excel:before{content:\"\\f1c3\"}.fa-file-export:before{content:\"\\f56e\"}.fa-file-image:before{content:\"\\f1c5\"}.fa-file-import:before{content:\"\\f56f\"}.fa-file-invoice:before{content:\"\\f570\"}.fa-file-invoice-dollar:before{content:\"\\f571\"}.fa-file-medical:before{content:\"\\f477\"}.fa-file-medical-alt:before{content:\"\\f478\"}.fa-file-pdf:before{content:\"\\f1c1\"}.fa-file-powerpoint:before{content:\"\\f1c4\"}.fa-file-prescription:before{content:\"\\f572\"}.fa-file-signature:before{content:\"\\f573\"}.fa-file-upload:before{content:\"\\f574\"}.fa-file-video:before{content:\"\\f1c8\"}.fa-file-word:before{content:\"\\f1c2\"}.fa-fill:before{content:\"\\f575\"}.fa-fill-drip:before{content:\"\\f576\"}.fa-film:before{content:\"\\f008\"}.fa-filter:before{content:\"\\f0b0\"}.fa-fingerprint:before{content:\"\\f577\"}.fa-fire:before{content:\"\\f06d\"}.fa-fire-alt:before{content:\"\\f7e4\"}.fa-fire-extinguisher:before{content:\"\\f134\"}.fa-firefox:before{content:\"\\f269\"}.fa-firefox-browser:before{content:\"\\e007\"}.fa-first-aid:before{content:\"\\f479\"}.fa-first-order:before{content:\"\\f2b0\"}.fa-first-order-alt:before{content:\"\\f50a\"}.fa-firstdraft:before{content:\"\\f3a1\"}.fa-fish:before{content:\"\\f578\"}.fa-fist-raised:before{content:\"\\f6de\"}.fa-flag:before{content:\"\\f024\"}.fa-flag-checkered:before{content:\"\\f11e\"}.fa-flag-usa:before{content:\"\\f74d\"}.fa-flask:before{content:\"\\f0c3\"}.fa-flickr:before{content:\"\\f16e\"}.fa-flipboard:before{content:\"\\f44d\"}.fa-flushed:before{content:\"\\f579\"}.fa-fly:before{content:\"\\f417\"}.fa-folder:before{content:\"\\f07b\"}.fa-folder-minus:before{content:\"\\f65d\"}.fa-folder-open:before{content:\"\\f07c\"}.fa-folder-plus:before{content:\"\\f65e\"}.fa-font:before{content:\"\\f031\"}.fa-font-awesome:before{content:\"\\f2b4\"}.fa-font-awesome-alt:before{content:\"\\f35c\"}.fa-font-awesome-flag:before{content:\"\\f425\"}.fa-font-awesome-logo-full:before{content:\"\\f4e6\"}.fa-fonticons:before{content:\"\\f280\"}.fa-fonticons-fi:before{content:\"\\f3a2\"}.fa-football-ball:before{content:\"\\f44e\"}.fa-fort-awesome:before{content:\"\\f286\"}.fa-fort-awesome-alt:before{content:\"\\f3a3\"}.fa-forumbee:before{content:\"\\f211\"}.fa-forward:before{content:\"\\f04e\"}.fa-foursquare:before{content:\"\\f180\"}.fa-free-code-camp:before{content:\"\\f2c5\"}.fa-freebsd:before{content:\"\\f3a4\"}.fa-frog:before{content:\"\\f52e\"}.fa-frown:before{content:\"\\f119\"}.fa-frown-open:before{content:\"\\f57a\"}.fa-fulcrum:before{content:\"\\f50b\"}.fa-funnel-dollar:before{content:\"\\f662\"}.fa-futbol:before{content:\"\\f1e3\"}.fa-galactic-republic:before{content:\"\\f50c\"}.fa-galactic-senate:before{content:\"\\f50d\"}.fa-gamepad:before{content:\"\\f11b\"}.fa-gas-pump:before{content:\"\\f52f\"}.fa-gavel:before{content:\"\\f0e3\"}.fa-gem:before{content:\"\\f3a5\"}.fa-genderless:before{content:\"\\f22d\"}.fa-get-pocket:before{content:\"\\f265\"}.fa-gg:before{content:\"\\f260\"}.fa-gg-circle:before{content:\"\\f261\"}.fa-ghost:before{content:\"\\f6e2\"}.fa-gift:before{content:\"\\f06b\"}.fa-gifts:before{content:\"\\f79c\"}.fa-git:before{content:\"\\f1d3\"}.fa-git-alt:before{content:\"\\f841\"}.fa-git-square:before{content:\"\\f1d2\"}.fa-github:before{content:\"\\f09b\"}.fa-github-alt:before{content:\"\\f113\"}.fa-github-square:before{content:\"\\f092\"}.fa-gitkraken:before{content:\"\\f3a6\"}.fa-gitlab:before{content:\"\\f296\"}.fa-gitter:before{content:\"\\f426\"}.fa-glass-cheers:before{content:\"\\f79f\"}.fa-glass-martini:before{content:\"\\f000\"}.fa-glass-martini-alt:before{content:\"\\f57b\"}.fa-glass-whiskey:before{content:\"\\f7a0\"}.fa-glasses:before{content:\"\\f530\"}.fa-glide:before{content:\"\\f2a5\"}.fa-glide-g:before{content:\"\\f2a6\"}.fa-globe:before{content:\"\\f0ac\"}.fa-globe-africa:before{content:\"\\f57c\"}.fa-globe-americas:before{content:\"\\f57d\"}.fa-globe-asia:before{content:\"\\f57e\"}.fa-globe-europe:before{content:\"\\f7a2\"}.fa-gofore:before{content:\"\\f3a7\"}.fa-golf-ball:before{content:\"\\f450\"}.fa-goodreads:before{content:\"\\f3a8\"}.fa-goodreads-g:before{content:\"\\f3a9\"}.fa-google:before{content:\"\\f1a0\"}.fa-google-drive:before{content:\"\\f3aa\"}.fa-google-pay:before{content:\"\\e079\"}.fa-google-play:before{content:\"\\f3ab\"}.fa-google-plus:before{content:\"\\f2b3\"}.fa-google-plus-g:before{content:\"\\f0d5\"}.fa-google-plus-square:before{content:\"\\f0d4\"}.fa-google-wallet:before{content:\"\\f1ee\"}.fa-gopuram:before{content:\"\\f664\"}.fa-graduation-cap:before{content:\"\\f19d\"}.fa-gratipay:before{content:\"\\f184\"}.fa-grav:before{content:\"\\f2d6\"}.fa-greater-than:before{content:\"\\f531\"}.fa-greater-than-equal:before{content:\"\\f532\"}.fa-grimace:before{content:\"\\f57f\"}.fa-grin:before{content:\"\\f580\"}.fa-grin-alt:before{content:\"\\f581\"}.fa-grin-beam:before{content:\"\\f582\"}.fa-grin-beam-sweat:before{content:\"\\f583\"}.fa-grin-hearts:before{content:\"\\f584\"}.fa-grin-squint:before{content:\"\\f585\"}.fa-grin-squint-tears:before{content:\"\\f586\"}.fa-grin-stars:before{content:\"\\f587\"}.fa-grin-tears:before{content:\"\\f588\"}.fa-grin-tongue:before{content:\"\\f589\"}.fa-grin-tongue-squint:before{content:\"\\f58a\"}.fa-grin-tongue-wink:before{content:\"\\f58b\"}.fa-grin-wink:before{content:\"\\f58c\"}.fa-grip-horizontal:before{content:\"\\f58d\"}.fa-grip-lines:before{content:\"\\f7a4\"}.fa-grip-lines-vertical:before{content:\"\\f7a5\"}.fa-grip-vertical:before{content:\"\\f58e\"}.fa-gripfire:before{content:\"\\f3ac\"}.fa-grunt:before{content:\"\\f3ad\"}.fa-guilded:before{content:\"\\e07e\"}.fa-guitar:before{content:\"\\f7a6\"}.fa-gulp:before{content:\"\\f3ae\"}.fa-h-square:before{content:\"\\f0fd\"}.fa-hacker-news:before{content:\"\\f1d4\"}.fa-hacker-news-square:before{content:\"\\f3af\"}.fa-hackerrank:before{content:\"\\f5f7\"}.fa-hamburger:before{content:\"\\f805\"}.fa-hammer:before{content:\"\\f6e3\"}.fa-hamsa:before{content:\"\\f665\"}.fa-hand-holding:before{content:\"\\f4bd\"}.fa-hand-holding-heart:before{content:\"\\f4be\"}.fa-hand-holding-medical:before{content:\"\\e05c\"}.fa-hand-holding-usd:before{content:\"\\f4c0\"}.fa-hand-holding-water:before{content:\"\\f4c1\"}.fa-hand-lizard:before{content:\"\\f258\"}.fa-hand-middle-finger:before{content:\"\\f806\"}.fa-hand-paper:before{content:\"\\f256\"}.fa-hand-peace:before{content:\"\\f25b\"}.fa-hand-point-down:before{content:\"\\f0a7\"}.fa-hand-point-left:before{content:\"\\f0a5\"}.fa-hand-point-right:before{content:\"\\f0a4\"}.fa-hand-point-up:before{content:\"\\f0a6\"}.fa-hand-pointer:before{content:\"\\f25a\"}.fa-hand-rock:before{content:\"\\f255\"}.fa-hand-scissors:before{content:\"\\f257\"}.fa-hand-sparkles:before{content:\"\\e05d\"}.fa-hand-spock:before{content:\"\\f259\"}.fa-hands:before{content:\"\\f4c2\"}.fa-hands-helping:before{content:\"\\f4c4\"}.fa-hands-wash:before{content:\"\\e05e\"}.fa-handshake:before{content:\"\\f2b5\"}.fa-handshake-alt-slash:before{content:\"\\e05f\"}.fa-handshake-slash:before{content:\"\\e060\"}.fa-hanukiah:before{content:\"\\f6e6\"}.fa-hard-hat:before{content:\"\\f807\"}.fa-hashtag:before{content:\"\\f292\"}.fa-hat-cowboy:before{content:\"\\f8c0\"}.fa-hat-cowboy-side:before{content:\"\\f8c1\"}.fa-hat-wizard:before{content:\"\\f6e8\"}.fa-hdd:before{content:\"\\f0a0\"}.fa-head-side-cough:before{content:\"\\e061\"}.fa-head-side-cough-slash:before{content:\"\\e062\"}.fa-head-side-mask:before{content:\"\\e063\"}.fa-head-side-virus:before{content:\"\\e064\"}.fa-heading:before{content:\"\\f1dc\"}.fa-headphones:before{content:\"\\f025\"}.fa-headphones-alt:before{content:\"\\f58f\"}.fa-headset:before{content:\"\\f590\"}.fa-heart:before{content:\"\\f004\"}.fa-heart-broken:before{content:\"\\f7a9\"}.fa-heartbeat:before{content:\"\\f21e\"}.fa-helicopter:before{content:\"\\f533\"}.fa-highlighter:before{content:\"\\f591\"}.fa-hiking:before{content:\"\\f6ec\"}.fa-hippo:before{content:\"\\f6ed\"}.fa-hips:before{content:\"\\f452\"}.fa-hire-a-helper:before{content:\"\\f3b0\"}.fa-history:before{content:\"\\f1da\"}.fa-hive:before{content:\"\\e07f\"}.fa-hockey-puck:before{content:\"\\f453\"}.fa-holly-berry:before{content:\"\\f7aa\"}.fa-home:before{content:\"\\f015\"}.fa-hooli:before{content:\"\\f427\"}.fa-hornbill:before{content:\"\\f592\"}.fa-horse:before{content:\"\\f6f0\"}.fa-horse-head:before{content:\"\\f7ab\"}.fa-hospital:before{content:\"\\f0f8\"}.fa-hospital-alt:before{content:\"\\f47d\"}.fa-hospital-symbol:before{content:\"\\f47e\"}.fa-hospital-user:before{content:\"\\f80d\"}.fa-hot-tub:before{content:\"\\f593\"}.fa-hotdog:before{content:\"\\f80f\"}.fa-hotel:before{content:\"\\f594\"}.fa-hotjar:before{content:\"\\f3b1\"}.fa-hourglass:before{content:\"\\f254\"}.fa-hourglass-end:before{content:\"\\f253\"}.fa-hourglass-half:before{content:\"\\f252\"}.fa-hourglass-start:before{content:\"\\f251\"}.fa-house-damage:before{content:\"\\f6f1\"}.fa-house-user:before{content:\"\\e065\"}.fa-houzz:before{content:\"\\f27c\"}.fa-hryvnia:before{content:\"\\f6f2\"}.fa-html5:before{content:\"\\f13b\"}.fa-hubspot:before{content:\"\\f3b2\"}.fa-i-cursor:before{content:\"\\f246\"}.fa-ice-cream:before{content:\"\\f810\"}.fa-icicles:before{content:\"\\f7ad\"}.fa-icons:before{content:\"\\f86d\"}.fa-id-badge:before{content:\"\\f2c1\"}.fa-id-card:before{content:\"\\f2c2\"}.fa-id-card-alt:before{content:\"\\f47f\"}.fa-ideal:before{content:\"\\e013\"}.fa-igloo:before{content:\"\\f7ae\"}.fa-image:before{content:\"\\f03e\"}.fa-images:before{content:\"\\f302\"}.fa-imdb:before{content:\"\\f2d8\"}.fa-inbox:before{content:\"\\f01c\"}.fa-indent:before{content:\"\\f03c\"}.fa-industry:before{content:\"\\f275\"}.fa-infinity:before{content:\"\\f534\"}.fa-info:before{content:\"\\f129\"}.fa-info-circle:before{content:\"\\f05a\"}.fa-innosoft:before{content:\"\\e080\"}.fa-instagram:before{content:\"\\f16d\"}.fa-instagram-square:before{content:\"\\e055\"}.fa-instalod:before{content:\"\\e081\"}.fa-intercom:before{content:\"\\f7af\"}.fa-internet-explorer:before{content:\"\\f26b\"}.fa-invision:before{content:\"\\f7b0\"}.fa-ioxhost:before{content:\"\\f208\"}.fa-italic:before{content:\"\\f033\"}.fa-itch-io:before{content:\"\\f83a\"}.fa-itunes:before{content:\"\\f3b4\"}.fa-itunes-note:before{content:\"\\f3b5\"}.fa-java:before{content:\"\\f4e4\"}.fa-jedi:before{content:\"\\f669\"}.fa-jedi-order:before{content:\"\\f50e\"}.fa-jenkins:before{content:\"\\f3b6\"}.fa-jira:before{content:\"\\f7b1\"}.fa-joget:before{content:\"\\f3b7\"}.fa-joint:before{content:\"\\f595\"}.fa-joomla:before{content:\"\\f1aa\"}.fa-journal-whills:before{content:\"\\f66a\"}.fa-js:before{content:\"\\f3b8\"}.fa-js-square:before{content:\"\\f3b9\"}.fa-jsfiddle:before{content:\"\\f1cc\"}.fa-kaaba:before{content:\"\\f66b\"}.fa-kaggle:before{content:\"\\f5fa\"}.fa-key:before{content:\"\\f084\"}.fa-keybase:before{content:\"\\f4f5\"}.fa-keyboard:before{content:\"\\f11c\"}.fa-keycdn:before{content:\"\\f3ba\"}.fa-khanda:before{content:\"\\f66d\"}.fa-kickstarter:before{content:\"\\f3bb\"}.fa-kickstarter-k:before{content:\"\\f3bc\"}.fa-kiss:before{content:\"\\f596\"}.fa-kiss-beam:before{content:\"\\f597\"}.fa-kiss-wink-heart:before{content:\"\\f598\"}.fa-kiwi-bird:before{content:\"\\f535\"}.fa-korvue:before{content:\"\\f42f\"}.fa-landmark:before{content:\"\\f66f\"}.fa-language:before{content:\"\\f1ab\"}.fa-laptop:before{content:\"\\f109\"}.fa-laptop-code:before{content:\"\\f5fc\"}.fa-laptop-house:before{content:\"\\e066\"}.fa-laptop-medical:before{content:\"\\f812\"}.fa-laravel:before{content:\"\\f3bd\"}.fa-lastfm:before{content:\"\\f202\"}.fa-lastfm-square:before{content:\"\\f203\"}.fa-laugh:before{content:\"\\f599\"}.fa-laugh-beam:before{content:\"\\f59a\"}.fa-laugh-squint:before{content:\"\\f59b\"}.fa-laugh-wink:before{content:\"\\f59c\"}.fa-layer-group:before{content:\"\\f5fd\"}.fa-leaf:before{content:\"\\f06c\"}.fa-leanpub:before{content:\"\\f212\"}.fa-lemon:before{content:\"\\f094\"}.fa-less:before{content:\"\\f41d\"}.fa-less-than:before{content:\"\\f536\"}.fa-less-than-equal:before{content:\"\\f537\"}.fa-level-down-alt:before{content:\"\\f3be\"}.fa-level-up-alt:before{content:\"\\f3bf\"}.fa-life-ring:before{content:\"\\f1cd\"}.fa-lightbulb:before{content:\"\\f0eb\"}.fa-line:before{content:\"\\f3c0\"}.fa-link:before{content:\"\\f0c1\"}.fa-linkedin:before{content:\"\\f08c\"}.fa-linkedin-in:before{content:\"\\f0e1\"}.fa-linode:before{content:\"\\f2b8\"}.fa-linux:before{content:\"\\f17c\"}.fa-lira-sign:before{content:\"\\f195\"}.fa-list:before{content:\"\\f03a\"}.fa-list-alt:before{content:\"\\f022\"}.fa-list-ol:before{content:\"\\f0cb\"}.fa-list-ul:before{content:\"\\f0ca\"}.fa-location-arrow:before{content:\"\\f124\"}.fa-lock:before{content:\"\\f023\"}.fa-lock-open:before{content:\"\\f3c1\"}.fa-long-arrow-alt-down:before{content:\"\\f309\"}.fa-long-arrow-alt-left:before{content:\"\\f30a\"}.fa-long-arrow-alt-right:before{content:\"\\f30b\"}.fa-long-arrow-alt-up:before{content:\"\\f30c\"}.fa-low-vision:before{content:\"\\f2a8\"}.fa-luggage-cart:before{content:\"\\f59d\"}.fa-lungs:before{content:\"\\f604\"}.fa-lungs-virus:before{content:\"\\e067\"}.fa-lyft:before{content:\"\\f3c3\"}.fa-magento:before{content:\"\\f3c4\"}.fa-magic:before{content:\"\\f0d0\"}.fa-magnet:before{content:\"\\f076\"}.fa-mail-bulk:before{content:\"\\f674\"}.fa-mailchimp:before{content:\"\\f59e\"}.fa-male:before{content:\"\\f183\"}.fa-mandalorian:before{content:\"\\f50f\"}.fa-map:before{content:\"\\f279\"}.fa-map-marked:before{content:\"\\f59f\"}.fa-map-marked-alt:before{content:\"\\f5a0\"}.fa-map-marker:before{content:\"\\f041\"}.fa-map-marker-alt:before{content:\"\\f3c5\"}.fa-map-pin:before{content:\"\\f276\"}.fa-map-signs:before{content:\"\\f277\"}.fa-markdown:before{content:\"\\f60f\"}.fa-marker:before{content:\"\\f5a1\"}.fa-mars:before{content:\"\\f222\"}.fa-mars-double:before{content:\"\\f227\"}.fa-mars-stroke:before{content:\"\\f229\"}.fa-mars-stroke-h:before{content:\"\\f22b\"}.fa-mars-stroke-v:before{content:\"\\f22a\"}.fa-mask:before{content:\"\\f6fa\"}.fa-mastodon:before{content:\"\\f4f6\"}.fa-maxcdn:before{content:\"\\f136\"}.fa-mdb:before{content:\"\\f8ca\"}.fa-medal:before{content:\"\\f5a2\"}.fa-medapps:before{content:\"\\f3c6\"}.fa-medium:before{content:\"\\f23a\"}.fa-medium-m:before{content:\"\\f3c7\"}.fa-medkit:before{content:\"\\f0fa\"}.fa-medrt:before{content:\"\\f3c8\"}.fa-meetup:before{content:\"\\f2e0\"}.fa-megaport:before{content:\"\\f5a3\"}.fa-meh:before{content:\"\\f11a\"}.fa-meh-blank:before{content:\"\\f5a4\"}.fa-meh-rolling-eyes:before{content:\"\\f5a5\"}.fa-memory:before{content:\"\\f538\"}.fa-mendeley:before{content:\"\\f7b3\"}.fa-menorah:before{content:\"\\f676\"}.fa-mercury:before{content:\"\\f223\"}.fa-meteor:before{content:\"\\f753\"}.fa-microblog:before{content:\"\\e01a\"}.fa-microchip:before{content:\"\\f2db\"}.fa-microphone:before{content:\"\\f130\"}.fa-microphone-alt:before{content:\"\\f3c9\"}.fa-microphone-alt-slash:before{content:\"\\f539\"}.fa-microphone-slash:before{content:\"\\f131\"}.fa-microscope:before{content:\"\\f610\"}.fa-microsoft:before{content:\"\\f3ca\"}.fa-minus:before{content:\"\\f068\"}.fa-minus-circle:before{content:\"\\f056\"}.fa-minus-square:before{content:\"\\f146\"}.fa-mitten:before{content:\"\\f7b5\"}.fa-mix:before{content:\"\\f3cb\"}.fa-mixcloud:before{content:\"\\f289\"}.fa-mixer:before{content:\"\\e056\"}.fa-mizuni:before{content:\"\\f3cc\"}.fa-mobile:before{content:\"\\f10b\"}.fa-mobile-alt:before{content:\"\\f3cd\"}.fa-modx:before{content:\"\\f285\"}.fa-monero:before{content:\"\\f3d0\"}.fa-money-bill:before{content:\"\\f0d6\"}.fa-money-bill-alt:before{content:\"\\f3d1\"}.fa-money-bill-wave:before{content:\"\\f53a\"}.fa-money-bill-wave-alt:before{content:\"\\f53b\"}.fa-money-check:before{content:\"\\f53c\"}.fa-money-check-alt:before{content:\"\\f53d\"}.fa-monument:before{content:\"\\f5a6\"}.fa-moon:before{content:\"\\f186\"}.fa-mortar-pestle:before{content:\"\\f5a7\"}.fa-mosque:before{content:\"\\f678\"}.fa-motorcycle:before{content:\"\\f21c\"}.fa-mountain:before{content:\"\\f6fc\"}.fa-mouse:before{content:\"\\f8cc\"}.fa-mouse-pointer:before{content:\"\\f245\"}.fa-mug-hot:before{content:\"\\f7b6\"}.fa-music:before{content:\"\\f001\"}.fa-napster:before{content:\"\\f3d2\"}.fa-neos:before{content:\"\\f612\"}.fa-network-wired:before{content:\"\\f6ff\"}.fa-neuter:before{content:\"\\f22c\"}.fa-newspaper:before{content:\"\\f1ea\"}.fa-nimblr:before{content:\"\\f5a8\"}.fa-node:before{content:\"\\f419\"}.fa-node-js:before{content:\"\\f3d3\"}.fa-not-equal:before{content:\"\\f53e\"}.fa-notes-medical:before{content:\"\\f481\"}.fa-npm:before{content:\"\\f3d4\"}.fa-ns8:before{content:\"\\f3d5\"}.fa-nutritionix:before{content:\"\\f3d6\"}.fa-object-group:before{content:\"\\f247\"}.fa-object-ungroup:before{content:\"\\f248\"}.fa-octopus-deploy:before{content:\"\\e082\"}.fa-odnoklassniki:before{content:\"\\f263\"}.fa-odnoklassniki-square:before{content:\"\\f264\"}.fa-oil-can:before{content:\"\\f613\"}.fa-old-republic:before{content:\"\\f510\"}.fa-om:before{content:\"\\f679\"}.fa-opencart:before{content:\"\\f23d\"}.fa-openid:before{content:\"\\f19b\"}.fa-opera:before{content:\"\\f26a\"}.fa-optin-monster:before{content:\"\\f23c\"}.fa-orcid:before{content:\"\\f8d2\"}.fa-osi:before{content:\"\\f41a\"}.fa-otter:before{content:\"\\f700\"}.fa-outdent:before{content:\"\\f03b\"}.fa-page4:before{content:\"\\f3d7\"}.fa-pagelines:before{content:\"\\f18c\"}.fa-pager:before{content:\"\\f815\"}.fa-paint-brush:before{content:\"\\f1fc\"}.fa-paint-roller:before{content:\"\\f5aa\"}.fa-palette:before{content:\"\\f53f\"}.fa-palfed:before{content:\"\\f3d8\"}.fa-pallet:before{content:\"\\f482\"}.fa-paper-plane:before{content:\"\\f1d8\"}.fa-paperclip:before{content:\"\\f0c6\"}.fa-parachute-box:before{content:\"\\f4cd\"}.fa-paragraph:before{content:\"\\f1dd\"}.fa-parking:before{content:\"\\f540\"}.fa-passport:before{content:\"\\f5ab\"}.fa-pastafarianism:before{content:\"\\f67b\"}.fa-paste:before{content:\"\\f0ea\"}.fa-patreon:before{content:\"\\f3d9\"}.fa-pause:before{content:\"\\f04c\"}.fa-pause-circle:before{content:\"\\f28b\"}.fa-paw:before{content:\"\\f1b0\"}.fa-paypal:before{content:\"\\f1ed\"}.fa-peace:before{content:\"\\f67c\"}.fa-pen:before{content:\"\\f304\"}.fa-pen-alt:before{content:\"\\f305\"}.fa-pen-fancy:before{content:\"\\f5ac\"}.fa-pen-nib:before{content:\"\\f5ad\"}.fa-pen-square:before{content:\"\\f14b\"}.fa-pencil-alt:before{content:\"\\f303\"}.fa-pencil-ruler:before{content:\"\\f5ae\"}.fa-penny-arcade:before{content:\"\\f704\"}.fa-people-arrows:before{content:\"\\e068\"}.fa-people-carry:before{content:\"\\f4ce\"}.fa-pepper-hot:before{content:\"\\f816\"}.fa-perbyte:before{content:\"\\e083\"}.fa-percent:before{content:\"\\f295\"}.fa-percentage:before{content:\"\\f541\"}.fa-periscope:before{content:\"\\f3da\"}.fa-person-booth:before{content:\"\\f756\"}.fa-phabricator:before{content:\"\\f3db\"}.fa-phoenix-framework:before{content:\"\\f3dc\"}.fa-phoenix-squadron:before{content:\"\\f511\"}.fa-phone:before{content:\"\\f095\"}.fa-phone-alt:before{content:\"\\f879\"}.fa-phone-slash:before{content:\"\\f3dd\"}.fa-phone-square:before{content:\"\\f098\"}.fa-phone-square-alt:before{content:\"\\f87b\"}.fa-phone-volume:before{content:\"\\f2a0\"}.fa-photo-video:before{content:\"\\f87c\"}.fa-php:before{content:\"\\f457\"}.fa-pied-piper:before{content:\"\\f2ae\"}.fa-pied-piper-alt:before{content:\"\\f1a8\"}.fa-pied-piper-hat:before{content:\"\\f4e5\"}.fa-pied-piper-pp:before{content:\"\\f1a7\"}.fa-pied-piper-square:before{content:\"\\e01e\"}.fa-piggy-bank:before{content:\"\\f4d3\"}.fa-pills:before{content:\"\\f484\"}.fa-pinterest:before{content:\"\\f0d2\"}.fa-pinterest-p:before{content:\"\\f231\"}.fa-pinterest-square:before{content:\"\\f0d3\"}.fa-pizza-slice:before{content:\"\\f818\"}.fa-place-of-worship:before{content:\"\\f67f\"}.fa-plane:before{content:\"\\f072\"}.fa-plane-arrival:before{content:\"\\f5af\"}.fa-plane-departure:before{content:\"\\f5b0\"}.fa-plane-slash:before{content:\"\\e069\"}.fa-play:before{content:\"\\f04b\"}.fa-play-circle:before{content:\"\\f144\"}.fa-playstation:before{content:\"\\f3df\"}.fa-plug:before{content:\"\\f1e6\"}.fa-plus:before{content:\"\\f067\"}.fa-plus-circle:before{content:\"\\f055\"}.fa-plus-square:before{content:\"\\f0fe\"}.fa-podcast:before{content:\"\\f2ce\"}.fa-poll:before{content:\"\\f681\"}.fa-poll-h:before{content:\"\\f682\"}.fa-poo:before{content:\"\\f2fe\"}.fa-poo-storm:before{content:\"\\f75a\"}.fa-poop:before{content:\"\\f619\"}.fa-portrait:before{content:\"\\f3e0\"}.fa-pound-sign:before{content:\"\\f154\"}.fa-power-off:before{content:\"\\f011\"}.fa-pray:before{content:\"\\f683\"}.fa-praying-hands:before{content:\"\\f684\"}.fa-prescription:before{content:\"\\f5b1\"}.fa-prescription-bottle:before{content:\"\\f485\"}.fa-prescription-bottle-alt:before{content:\"\\f486\"}.fa-print:before{content:\"\\f02f\"}.fa-procedures:before{content:\"\\f487\"}.fa-product-hunt:before{content:\"\\f288\"}.fa-project-diagram:before{content:\"\\f542\"}.fa-pump-medical:before{content:\"\\e06a\"}.fa-pump-soap:before{content:\"\\e06b\"}.fa-pushed:before{content:\"\\f3e1\"}.fa-puzzle-piece:before{content:\"\\f12e\"}.fa-python:before{content:\"\\f3e2\"}.fa-qq:before{content:\"\\f1d6\"}.fa-qrcode:before{content:\"\\f029\"}.fa-question:before{content:\"\\f128\"}.fa-question-circle:before{content:\"\\f059\"}.fa-quidditch:before{content:\"\\f458\"}.fa-quinscape:before{content:\"\\f459\"}.fa-quora:before{content:\"\\f2c4\"}.fa-quote-left:before{content:\"\\f10d\"}.fa-quote-right:before{content:\"\\f10e\"}.fa-quran:before{content:\"\\f687\"}.fa-r-project:before{content:\"\\f4f7\"}.fa-radiation:before{content:\"\\f7b9\"}.fa-radiation-alt:before{content:\"\\f7ba\"}.fa-rainbow:before{content:\"\\f75b\"}.fa-random:before{content:\"\\f074\"}.fa-raspberry-pi:before{content:\"\\f7bb\"}.fa-ravelry:before{content:\"\\f2d9\"}.fa-react:before{content:\"\\f41b\"}.fa-reacteurope:before{content:\"\\f75d\"}.fa-readme:before{content:\"\\f4d5\"}.fa-rebel:before{content:\"\\f1d0\"}.fa-receipt:before{content:\"\\f543\"}.fa-record-vinyl:before{content:\"\\f8d9\"}.fa-recycle:before{content:\"\\f1b8\"}.fa-red-river:before{content:\"\\f3e3\"}.fa-reddit:before{content:\"\\f1a1\"}.fa-reddit-alien:before{content:\"\\f281\"}.fa-reddit-square:before{content:\"\\f1a2\"}.fa-redhat:before{content:\"\\f7bc\"}.fa-redo:before{content:\"\\f01e\"}.fa-redo-alt:before{content:\"\\f2f9\"}.fa-registered:before{content:\"\\f25d\"}.fa-remove-format:before{content:\"\\f87d\"}.fa-renren:before{content:\"\\f18b\"}.fa-reply:before{content:\"\\f3e5\"}.fa-reply-all:before{content:\"\\f122\"}.fa-replyd:before{content:\"\\f3e6\"}.fa-republican:before{content:\"\\f75e\"}.fa-researchgate:before{content:\"\\f4f8\"}.fa-resolving:before{content:\"\\f3e7\"}.fa-restroom:before{content:\"\\f7bd\"}.fa-retweet:before{content:\"\\f079\"}.fa-rev:before{content:\"\\f5b2\"}.fa-ribbon:before{content:\"\\f4d6\"}.fa-ring:before{content:\"\\f70b\"}.fa-road:before{content:\"\\f018\"}.fa-robot:before{content:\"\\f544\"}.fa-rocket:before{content:\"\\f135\"}.fa-rocketchat:before{content:\"\\f3e8\"}.fa-rockrms:before{content:\"\\f3e9\"}.fa-route:before{content:\"\\f4d7\"}.fa-rss:before{content:\"\\f09e\"}.fa-rss-square:before{content:\"\\f143\"}.fa-ruble-sign:before{content:\"\\f158\"}.fa-ruler:before{content:\"\\f545\"}.fa-ruler-combined:before{content:\"\\f546\"}.fa-ruler-horizontal:before{content:\"\\f547\"}.fa-ruler-vertical:before{content:\"\\f548\"}.fa-running:before{content:\"\\f70c\"}.fa-rupee-sign:before{content:\"\\f156\"}.fa-rust:before{content:\"\\e07a\"}.fa-sad-cry:before{content:\"\\f5b3\"}.fa-sad-tear:before{content:\"\\f5b4\"}.fa-safari:before{content:\"\\f267\"}.fa-salesforce:before{content:\"\\f83b\"}.fa-sass:before{content:\"\\f41e\"}.fa-satellite:before{content:\"\\f7bf\"}.fa-satellite-dish:before{content:\"\\f7c0\"}.fa-save:before{content:\"\\f0c7\"}.fa-schlix:before{content:\"\\f3ea\"}.fa-school:before{content:\"\\f549\"}.fa-screwdriver:before{content:\"\\f54a\"}.fa-scribd:before{content:\"\\f28a\"}.fa-scroll:before{content:\"\\f70e\"}.fa-sd-card:before{content:\"\\f7c2\"}.fa-search:before{content:\"\\f002\"}.fa-search-dollar:before{content:\"\\f688\"}.fa-search-location:before{content:\"\\f689\"}.fa-search-minus:before{content:\"\\f010\"}.fa-search-plus:before{content:\"\\f00e\"}.fa-searchengin:before{content:\"\\f3eb\"}.fa-seedling:before{content:\"\\f4d8\"}.fa-sellcast:before{content:\"\\f2da\"}.fa-sellsy:before{content:\"\\f213\"}.fa-server:before{content:\"\\f233\"}.fa-servicestack:before{content:\"\\f3ec\"}.fa-shapes:before{content:\"\\f61f\"}.fa-share:before{content:\"\\f064\"}.fa-share-alt:before{content:\"\\f1e0\"}.fa-share-alt-square:before{content:\"\\f1e1\"}.fa-share-square:before{content:\"\\f14d\"}.fa-shekel-sign:before{content:\"\\f20b\"}.fa-shield-alt:before{content:\"\\f3ed\"}.fa-shield-virus:before{content:\"\\e06c\"}.fa-ship:before{content:\"\\f21a\"}.fa-shipping-fast:before{content:\"\\f48b\"}.fa-shirtsinbulk:before{content:\"\\f214\"}.fa-shoe-prints:before{content:\"\\f54b\"}.fa-shopify:before{content:\"\\e057\"}.fa-shopping-bag:before{content:\"\\f290\"}.fa-shopping-basket:before{content:\"\\f291\"}.fa-shopping-cart:before{content:\"\\f07a\"}.fa-shopware:before{content:\"\\f5b5\"}.fa-shower:before{content:\"\\f2cc\"}.fa-shuttle-van:before{content:\"\\f5b6\"}.fa-sign:before{content:\"\\f4d9\"}.fa-sign-in-alt:before{content:\"\\f2f6\"}.fa-sign-language:before{content:\"\\f2a7\"}.fa-sign-out-alt:before{content:\"\\f2f5\"}.fa-signal:before{content:\"\\f012\"}.fa-signature:before{content:\"\\f5b7\"}.fa-sim-card:before{content:\"\\f7c4\"}.fa-simplybuilt:before{content:\"\\f215\"}.fa-sink:before{content:\"\\e06d\"}.fa-sistrix:before{content:\"\\f3ee\"}.fa-sitemap:before{content:\"\\f0e8\"}.fa-sith:before{content:\"\\f512\"}.fa-skating:before{content:\"\\f7c5\"}.fa-sketch:before{content:\"\\f7c6\"}.fa-skiing:before{content:\"\\f7c9\"}.fa-skiing-nordic:before{content:\"\\f7ca\"}.fa-skull:before{content:\"\\f54c\"}.fa-skull-crossbones:before{content:\"\\f714\"}.fa-skyatlas:before{content:\"\\f216\"}.fa-skype:before{content:\"\\f17e\"}.fa-slack:before{content:\"\\f198\"}.fa-slack-hash:before{content:\"\\f3ef\"}.fa-slash:before{content:\"\\f715\"}.fa-sleigh:before{content:\"\\f7cc\"}.fa-sliders-h:before{content:\"\\f1de\"}.fa-slideshare:before{content:\"\\f1e7\"}.fa-smile:before{content:\"\\f118\"}.fa-smile-beam:before{content:\"\\f5b8\"}.fa-smile-wink:before{content:\"\\f4da\"}.fa-smog:before{content:\"\\f75f\"}.fa-smoking:before{content:\"\\f48d\"}.fa-smoking-ban:before{content:\"\\f54d\"}.fa-sms:before{content:\"\\f7cd\"}.fa-snapchat:before{content:\"\\f2ab\"}.fa-snapchat-ghost:before{content:\"\\f2ac\"}.fa-snapchat-square:before{content:\"\\f2ad\"}.fa-snowboarding:before{content:\"\\f7ce\"}.fa-snowflake:before{content:\"\\f2dc\"}.fa-snowman:before{content:\"\\f7d0\"}.fa-snowplow:before{content:\"\\f7d2\"}.fa-soap:before{content:\"\\e06e\"}.fa-socks:before{content:\"\\f696\"}.fa-solar-panel:before{content:\"\\f5ba\"}.fa-sort:before{content:\"\\f0dc\"}.fa-sort-alpha-down:before{content:\"\\f15d\"}.fa-sort-alpha-down-alt:before{content:\"\\f881\"}.fa-sort-alpha-up:before{content:\"\\f15e\"}.fa-sort-alpha-up-alt:before{content:\"\\f882\"}.fa-sort-amount-down:before{content:\"\\f160\"}.fa-sort-amount-down-alt:before{content:\"\\f884\"}.fa-sort-amount-up:before{content:\"\\f161\"}.fa-sort-amount-up-alt:before{content:\"\\f885\"}.fa-sort-down:before{content:\"\\f0dd\"}.fa-sort-numeric-down:before{content:\"\\f162\"}.fa-sort-numeric-down-alt:before{content:\"\\f886\"}.fa-sort-numeric-up:before{content:\"\\f163\"}.fa-sort-numeric-up-alt:before{content:\"\\f887\"}.fa-sort-up:before{content:\"\\f0de\"}.fa-soundcloud:before{content:\"\\f1be\"}.fa-sourcetree:before{content:\"\\f7d3\"}.fa-spa:before{content:\"\\f5bb\"}.fa-space-shuttle:before{content:\"\\f197\"}.fa-speakap:before{content:\"\\f3f3\"}.fa-speaker-deck:before{content:\"\\f83c\"}.fa-spell-check:before{content:\"\\f891\"}.fa-spider:before{content:\"\\f717\"}.fa-spinner:before{content:\"\\f110\"}.fa-splotch:before{content:\"\\f5bc\"}.fa-spotify:before{content:\"\\f1bc\"}.fa-spray-can:before{content:\"\\f5bd\"}.fa-square:before{content:\"\\f0c8\"}.fa-square-full:before{content:\"\\f45c\"}.fa-square-root-alt:before{content:\"\\f698\"}.fa-squarespace:before{content:\"\\f5be\"}.fa-stack-exchange:before{content:\"\\f18d\"}.fa-stack-overflow:before{content:\"\\f16c\"}.fa-stackpath:before{content:\"\\f842\"}.fa-stamp:before{content:\"\\f5bf\"}.fa-star:before{content:\"\\f005\"}.fa-star-and-crescent:before{content:\"\\f699\"}.fa-star-half:before{content:\"\\f089\"}.fa-star-half-alt:before{content:\"\\f5c0\"}.fa-star-of-david:before{content:\"\\f69a\"}.fa-star-of-life:before{content:\"\\f621\"}.fa-staylinked:before{content:\"\\f3f5\"}.fa-steam:before{content:\"\\f1b6\"}.fa-steam-square:before{content:\"\\f1b7\"}.fa-steam-symbol:before{content:\"\\f3f6\"}.fa-step-backward:before{content:\"\\f048\"}.fa-step-forward:before{content:\"\\f051\"}.fa-stethoscope:before{content:\"\\f0f1\"}.fa-sticker-mule:before{content:\"\\f3f7\"}.fa-sticky-note:before{content:\"\\f249\"}.fa-stop:before{content:\"\\f04d\"}.fa-stop-circle:before{content:\"\\f28d\"}.fa-stopwatch:before{content:\"\\f2f2\"}.fa-stopwatch-20:before{content:\"\\e06f\"}.fa-store:before{content:\"\\f54e\"}.fa-store-alt:before{content:\"\\f54f\"}.fa-store-alt-slash:before{content:\"\\e070\"}.fa-store-slash:before{content:\"\\e071\"}.fa-strava:before{content:\"\\f428\"}.fa-stream:before{content:\"\\f550\"}.fa-street-view:before{content:\"\\f21d\"}.fa-strikethrough:before{content:\"\\f0cc\"}.fa-stripe:before{content:\"\\f429\"}.fa-stripe-s:before{content:\"\\f42a\"}.fa-stroopwafel:before{content:\"\\f551\"}.fa-studiovinari:before{content:\"\\f3f8\"}.fa-stumbleupon:before{content:\"\\f1a4\"}.fa-stumbleupon-circle:before{content:\"\\f1a3\"}.fa-subscript:before{content:\"\\f12c\"}.fa-subway:before{content:\"\\f239\"}.fa-suitcase:before{content:\"\\f0f2\"}.fa-suitcase-rolling:before{content:\"\\f5c1\"}.fa-sun:before{content:\"\\f185\"}.fa-superpowers:before{content:\"\\f2dd\"}.fa-superscript:before{content:\"\\f12b\"}.fa-supple:before{content:\"\\f3f9\"}.fa-surprise:before{content:\"\\f5c2\"}.fa-suse:before{content:\"\\f7d6\"}.fa-swatchbook:before{content:\"\\f5c3\"}.fa-swift:before{content:\"\\f8e1\"}.fa-swimmer:before{content:\"\\f5c4\"}.fa-swimming-pool:before{content:\"\\f5c5\"}.fa-symfony:before{content:\"\\f83d\"}.fa-synagogue:before{content:\"\\f69b\"}.fa-sync:before{content:\"\\f021\"}.fa-sync-alt:before{content:\"\\f2f1\"}.fa-syringe:before{content:\"\\f48e\"}.fa-table:before{content:\"\\f0ce\"}.fa-table-tennis:before{content:\"\\f45d\"}.fa-tablet:before{content:\"\\f10a\"}.fa-tablet-alt:before{content:\"\\f3fa\"}.fa-tablets:before{content:\"\\f490\"}.fa-tachometer-alt:before{content:\"\\f3fd\"}.fa-tag:before{content:\"\\f02b\"}.fa-tags:before{content:\"\\f02c\"}.fa-tape:before{content:\"\\f4db\"}.fa-tasks:before{content:\"\\f0ae\"}.fa-taxi:before{content:\"\\f1ba\"}.fa-teamspeak:before{content:\"\\f4f9\"}.fa-teeth:before{content:\"\\f62e\"}.fa-teeth-open:before{content:\"\\f62f\"}.fa-telegram:before{content:\"\\f2c6\"}.fa-telegram-plane:before{content:\"\\f3fe\"}.fa-temperature-high:before{content:\"\\f769\"}.fa-temperature-low:before{content:\"\\f76b\"}.fa-tencent-weibo:before{content:\"\\f1d5\"}.fa-tenge:before{content:\"\\f7d7\"}.fa-terminal:before{content:\"\\f120\"}.fa-text-height:before{content:\"\\f034\"}.fa-text-width:before{content:\"\\f035\"}.fa-th:before{content:\"\\f00a\"}.fa-th-large:before{content:\"\\f009\"}.fa-th-list:before{content:\"\\f00b\"}.fa-the-red-yeti:before{content:\"\\f69d\"}.fa-theater-masks:before{content:\"\\f630\"}.fa-themeco:before{content:\"\\f5c6\"}.fa-themeisle:before{content:\"\\f2b2\"}.fa-thermometer:before{content:\"\\f491\"}.fa-thermometer-empty:before{content:\"\\f2cb\"}.fa-thermometer-full:before{content:\"\\f2c7\"}.fa-thermometer-half:before{content:\"\\f2c9\"}.fa-thermometer-quarter:before{content:\"\\f2ca\"}.fa-thermometer-three-quarters:before{content:\"\\f2c8\"}.fa-think-peaks:before{content:\"\\f731\"}.fa-thumbs-down:before{content:\"\\f165\"}.fa-thumbs-up:before{content:\"\\f164\"}.fa-thumbtack:before{content:\"\\f08d\"}.fa-ticket-alt:before{content:\"\\f3ff\"}.fa-tiktok:before{content:\"\\e07b\"}.fa-times:before{content:\"\\f00d\"}.fa-times-circle:before{content:\"\\f057\"}.fa-tint:before{content:\"\\f043\"}.fa-tint-slash:before{content:\"\\f5c7\"}.fa-tired:before{content:\"\\f5c8\"}.fa-toggle-off:before{content:\"\\f204\"}.fa-toggle-on:before{content:\"\\f205\"}.fa-toilet:before{content:\"\\f7d8\"}.fa-toilet-paper:before{content:\"\\f71e\"}.fa-toilet-paper-slash:before{content:\"\\e072\"}.fa-toolbox:before{content:\"\\f552\"}.fa-tools:before{content:\"\\f7d9\"}.fa-tooth:before{content:\"\\f5c9\"}.fa-torah:before{content:\"\\f6a0\"}.fa-torii-gate:before{content:\"\\f6a1\"}.fa-tractor:before{content:\"\\f722\"}.fa-trade-federation:before{content:\"\\f513\"}.fa-trademark:before{content:\"\\f25c\"}.fa-traffic-light:before{content:\"\\f637\"}.fa-trailer:before{content:\"\\e041\"}.fa-train:before{content:\"\\f238\"}.fa-tram:before{content:\"\\f7da\"}.fa-transgender:before{content:\"\\f224\"}.fa-transgender-alt:before{content:\"\\f225\"}.fa-trash:before{content:\"\\f1f8\"}.fa-trash-alt:before{content:\"\\f2ed\"}.fa-trash-restore:before{content:\"\\f829\"}.fa-trash-restore-alt:before{content:\"\\f82a\"}.fa-tree:before{content:\"\\f1bb\"}.fa-trello:before{content:\"\\f181\"}.fa-trophy:before{content:\"\\f091\"}.fa-truck:before{content:\"\\f0d1\"}.fa-truck-loading:before{content:\"\\f4de\"}.fa-truck-monster:before{content:\"\\f63b\"}.fa-truck-moving:before{content:\"\\f4df\"}.fa-truck-pickup:before{content:\"\\f63c\"}.fa-tshirt:before{content:\"\\f553\"}.fa-tty:before{content:\"\\f1e4\"}.fa-tumblr:before{content:\"\\f173\"}.fa-tumblr-square:before{content:\"\\f174\"}.fa-tv:before{content:\"\\f26c\"}.fa-twitch:before{content:\"\\f1e8\"}.fa-twitter:before{content:\"\\f099\"}.fa-twitter-square:before{content:\"\\f081\"}.fa-typo3:before{content:\"\\f42b\"}.fa-uber:before{content:\"\\f402\"}.fa-ubuntu:before{content:\"\\f7df\"}.fa-uikit:before{content:\"\\f403\"}.fa-umbraco:before{content:\"\\f8e8\"}.fa-umbrella:before{content:\"\\f0e9\"}.fa-umbrella-beach:before{content:\"\\f5ca\"}.fa-uncharted:before{content:\"\\e084\"}.fa-underline:before{content:\"\\f0cd\"}.fa-undo:before{content:\"\\f0e2\"}.fa-undo-alt:before{content:\"\\f2ea\"}.fa-uniregistry:before{content:\"\\f404\"}.fa-unity:before{content:\"\\e049\"}.fa-universal-access:before{content:\"\\f29a\"}.fa-university:before{content:\"\\f19c\"}.fa-unlink:before{content:\"\\f127\"}.fa-unlock:before{content:\"\\f09c\"}.fa-unlock-alt:before{content:\"\\f13e\"}.fa-unsplash:before{content:\"\\e07c\"}.fa-untappd:before{content:\"\\f405\"}.fa-upload:before{content:\"\\f093\"}.fa-ups:before{content:\"\\f7e0\"}.fa-usb:before{content:\"\\f287\"}.fa-user:before{content:\"\\f007\"}.fa-user-alt:before{content:\"\\f406\"}.fa-user-alt-slash:before{content:\"\\f4fa\"}.fa-user-astronaut:before{content:\"\\f4fb\"}.fa-user-check:before{content:\"\\f4fc\"}.fa-user-circle:before{content:\"\\f2bd\"}.fa-user-clock:before{content:\"\\f4fd\"}.fa-user-cog:before{content:\"\\f4fe\"}.fa-user-edit:before{content:\"\\f4ff\"}.fa-user-friends:before{content:\"\\f500\"}.fa-user-graduate:before{content:\"\\f501\"}.fa-user-injured:before{content:\"\\f728\"}.fa-user-lock:before{content:\"\\f502\"}.fa-user-md:before{content:\"\\f0f0\"}.fa-user-minus:before{content:\"\\f503\"}.fa-user-ninja:before{content:\"\\f504\"}.fa-user-nurse:before{content:\"\\f82f\"}.fa-user-plus:before{content:\"\\f234\"}.fa-user-secret:before{content:\"\\f21b\"}.fa-user-shield:before{content:\"\\f505\"}.fa-user-slash:before{content:\"\\f506\"}.fa-user-tag:before{content:\"\\f507\"}.fa-user-tie:before{content:\"\\f508\"}.fa-user-times:before{content:\"\\f235\"}.fa-users:before{content:\"\\f0c0\"}.fa-users-cog:before{content:\"\\f509\"}.fa-users-slash:before{content:\"\\e073\"}.fa-usps:before{content:\"\\f7e1\"}.fa-ussunnah:before{content:\"\\f407\"}.fa-utensil-spoon:before{content:\"\\f2e5\"}.fa-utensils:before{content:\"\\f2e7\"}.fa-vaadin:before{content:\"\\f408\"}.fa-vector-square:before{content:\"\\f5cb\"}.fa-venus:before{content:\"\\f221\"}.fa-venus-double:before{content:\"\\f226\"}.fa-venus-mars:before{content:\"\\f228\"}.fa-vest:before{content:\"\\e085\"}.fa-vest-patches:before{content:\"\\e086\"}.fa-viacoin:before{content:\"\\f237\"}.fa-viadeo:before{content:\"\\f2a9\"}.fa-viadeo-square:before{content:\"\\f2aa\"}.fa-vial:before{content:\"\\f492\"}.fa-vials:before{content:\"\\f493\"}.fa-viber:before{content:\"\\f409\"}.fa-video:before{content:\"\\f03d\"}.fa-video-slash:before{content:\"\\f4e2\"}.fa-vihara:before{content:\"\\f6a7\"}.fa-vimeo:before{content:\"\\f40a\"}.fa-vimeo-square:before{content:\"\\f194\"}.fa-vimeo-v:before{content:\"\\f27d\"}.fa-vine:before{content:\"\\f1ca\"}.fa-virus:before{content:\"\\e074\"}.fa-virus-slash:before{content:\"\\e075\"}.fa-viruses:before{content:\"\\e076\"}.fa-vk:before{content:\"\\f189\"}.fa-vnv:before{content:\"\\f40b\"}.fa-voicemail:before{content:\"\\f897\"}.fa-volleyball-ball:before{content:\"\\f45f\"}.fa-volume-down:before{content:\"\\f027\"}.fa-volume-mute:before{content:\"\\f6a9\"}.fa-volume-off:before{content:\"\\f026\"}.fa-volume-up:before{content:\"\\f028\"}.fa-vote-yea:before{content:\"\\f772\"}.fa-vr-cardboard:before{content:\"\\f729\"}.fa-vuejs:before{content:\"\\f41f\"}.fa-walking:before{content:\"\\f554\"}.fa-wallet:before{content:\"\\f555\"}.fa-warehouse:before{content:\"\\f494\"}.fa-watchman-monitoring:before{content:\"\\e087\"}.fa-water:before{content:\"\\f773\"}.fa-wave-square:before{content:\"\\f83e\"}.fa-waze:before{content:\"\\f83f\"}.fa-weebly:before{content:\"\\f5cc\"}.fa-weibo:before{content:\"\\f18a\"}.fa-weight:before{content:\"\\f496\"}.fa-weight-hanging:before{content:\"\\f5cd\"}.fa-weixin:before{content:\"\\f1d7\"}.fa-whatsapp:before{content:\"\\f232\"}.fa-whatsapp-square:before{content:\"\\f40c\"}.fa-wheelchair:before{content:\"\\f193\"}.fa-whmcs:before{content:\"\\f40d\"}.fa-wifi:before{content:\"\\f1eb\"}.fa-wikipedia-w:before{content:\"\\f266\"}.fa-wind:before{content:\"\\f72e\"}.fa-window-close:before{content:\"\\f410\"}.fa-window-maximize:before{content:\"\\f2d0\"}.fa-window-minimize:before{content:\"\\f2d1\"}.fa-window-restore:before{content:\"\\f2d2\"}.fa-windows:before{content:\"\\f17a\"}.fa-wine-bottle:before{content:\"\\f72f\"}.fa-wine-glass:before{content:\"\\f4e3\"}.fa-wine-glass-alt:before{content:\"\\f5ce\"}.fa-wix:before{content:\"\\f5cf\"}.fa-wizards-of-the-coast:before{content:\"\\f730\"}.fa-wodu:before{content:\"\\e088\"}.fa-wolf-pack-battalion:before{content:\"\\f514\"}.fa-won-sign:before{content:\"\\f159\"}.fa-wordpress:before{content:\"\\f19a\"}.fa-wordpress-simple:before{content:\"\\f411\"}.fa-wpbeginner:before{content:\"\\f297\"}.fa-wpexplorer:before{content:\"\\f2de\"}.fa-wpforms:before{content:\"\\f298\"}.fa-wpressr:before{content:\"\\f3e4\"}.fa-wrench:before{content:\"\\f0ad\"}.fa-x-ray:before{content:\"\\f497\"}.fa-xbox:before{content:\"\\f412\"}.fa-xing:before{content:\"\\f168\"}.fa-xing-square:before{content:\"\\f169\"}.fa-y-combinator:before{content:\"\\f23b\"}.fa-yahoo:before{content:\"\\f19e\"}.fa-yammer:before{content:\"\\f840\"}.fa-yandex:before{content:\"\\f413\"}.fa-yandex-international:before{content:\"\\f414\"}.fa-yarn:before{content:\"\\f7e3\"}.fa-yelp:before{content:\"\\f1e9\"}.fa-yen-sign:before{content:\"\\f157\"}.fa-yin-yang:before{content:\"\\f6ad\"}.fa-yoast:before{content:\"\\f2b1\"}.fa-youtube:before{content:\"\\f167\"}.fa-youtube-square:before{content:\"\\f431\"}.fa-zhihu:before{content:\"\\f63f\"}.sr-only{border:0;clip:rect(0,0,0,0);height:1px;margin:-1px;overflow:hidden;padding:0;position:absolute;width:1px}.sr-only-focusable:active,.sr-only-focusable:focus{clip:auto;height:auto;margin:0;overflow:visible;position:static;width:auto}@font-face{font-family:\"Font Awesome 5 Brands\";font-style:normal;font-weight:400;font-display:block;src:url(../webfonts/fa-brands-400.eot);src:url(../webfonts/fa-brands-400.eot?#iefix) format(\"embedded-opentype\"),url(../webfonts/fa-brands-400.woff2) format(\"woff2\"),url(../webfonts/fa-brands-400.woff) format(\"woff\"),url(../webfonts/fa-brands-400.ttf) format(\"truetype\"),url(../webfonts/fa-brands-400.svg#fontawesome) format(\"svg\")}.fab{font-family:\"Font Awesome 5 Brands\"}@font-face{font-family:\"Font Awesome 5 Free\";font-style:normal;font-weight:400;font-display:block;src:url(../webfonts/fa-regular-400.eot);src:url(../webfonts/fa-regular-400.eot?#iefix) format(\"embedded-opentype\"),url(../webfonts/fa-regular-400.woff2) format(\"woff2\"),url(../webfonts/fa-regular-400.woff) format(\"woff\"),url(../webfonts/fa-regular-400.ttf) format(\"truetype\"),url(../webfonts/fa-regular-400.svg#fontawesome) format(\"svg\")}.fab,.far{font-weight:400}@font-face{font-family:\"Font Awesome 5 Free\";font-style:normal;font-weight:900;font-display:block;src:url(../webfonts/fa-solid-900.eot);src:url(../webfonts/fa-solid-900.eot?#iefix) format(\"embedded-opentype\"),url(../webfonts/fa-solid-900.woff2) format(\"woff2\"),url(../webfonts/fa-solid-900.woff) format(\"woff\"),url(../webfonts/fa-solid-900.ttf) format(\"truetype\"),url(../webfonts/fa-solid-900.svg#fontawesome) format(\"svg\")}.fa,.far,.fas{font-family:\"Font Awesome 5 Free\"}.fa,.fas{font-weight:900}";});;
define('aurelia-binding/dist/commonjs/aurelia-binding',['require','exports','module','aurelia-logging','aurelia-pal','aurelia-task-queue','aurelia-metadata'],function (require, exports, module) {'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getSetObserver = exports.BindingEngine = exports.NameExpression = exports.Listener = exports.ListenerExpression = exports.BindingBehaviorResource = exports.ValueConverterResource = exports.Call = exports.CallExpression = exports.Binding = exports.BindingExpression = exports.ObjectObservationAdapter = exports.ObserverLocator = exports.SVGAnalyzer = exports.presentationAttributes = exports.presentationElements = exports.elements = exports.ComputedExpression = exports.ClassObserver = exports.SelectValueObserver = exports.CheckedObserver = exports.ValueAttributeObserver = exports.StyleObserver = exports.DataAttributeObserver = exports.dataAttributeAccessor = exports.XLinkAttributeObserver = exports.SetterObserver = exports.PrimitiveObserver = exports.propertyAccessor = exports.DirtyCheckProperty = exports.DirtyChecker = exports.EventSubscriber = exports.EventManager = exports.delegationStrategy = exports.getMapObserver = exports.ParserImplementation = exports.Parser = exports.bindingMode = exports.ExpressionCloner = exports.Unparser = exports.LiteralObject = exports.LiteralArray = exports.LiteralTemplate = exports.LiteralString = exports.LiteralPrimitive = exports.Unary = exports.Binary = exports.CallFunction = exports.CallMember = exports.CallScope = exports.AccessKeyed = exports.AccessMember = exports.AccessScope = exports.AccessThis = exports.Conditional = exports.Assign = exports.ValueConverter = exports.BindingBehavior = exports.Expression = exports.getArrayObserver = exports.CollectionLengthObserver = exports.ModifyCollectionObserver = exports.ExpressionObserver = exports.sourceContext = exports.targetContext = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _dec, _dec2, _class, _dec3, _class2, _dec4, _class3, _dec5, _class5, _dec6, _class7, _dec7, _class8, _dec8, _class9, _dec9, _class10, _class12, _temp, _dec10, _class13, _class14, _temp2;

exports.camelCase = camelCase;
exports.createOverrideContext = createOverrideContext;
exports.getContextFor = getContextFor;
exports.createScopeForTest = createScopeForTest;
exports.connectable = connectable;
exports.enqueueBindingConnect = enqueueBindingConnect;
exports.setConnectQueueThreshold = setConnectQueueThreshold;
exports.enableConnectQueue = enableConnectQueue;
exports.disableConnectQueue = disableConnectQueue;
exports.getConnectQueueSize = getConnectQueueSize;
exports.subscriberCollection = subscriberCollection;
exports.calcSplices = calcSplices;
exports.mergeSplice = mergeSplice;
exports.projectArraySplices = projectArraySplices;
exports.getChangeRecords = getChangeRecords;
exports.cloneExpression = cloneExpression;
exports.hasDeclaredDependencies = hasDeclaredDependencies;
exports.declarePropertyDependencies = declarePropertyDependencies;
exports.computedFrom = computedFrom;
exports.createComputedObserver = createComputedObserver;
exports.valueConverter = valueConverter;
exports.bindingBehavior = bindingBehavior;
exports.observable = observable;
exports.connectBindingToSignal = connectBindingToSignal;
exports.signalBindings = signalBindings;

var _aureliaLogging = require('aurelia-logging');

var LogManager = _interopRequireWildcard(_aureliaLogging);

var _aureliaPal = require('aurelia-pal');

var _aureliaTaskQueue = require('aurelia-task-queue');

var _aureliaMetadata = require('aurelia-metadata');

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }



var targetContext = exports.targetContext = 'Binding:target';
var sourceContext = exports.sourceContext = 'Binding:source';

var map = Object.create(null);

function camelCase(name) {
  if (name in map) {
    return map[name];
  }
  var result = name.charAt(0).toLowerCase() + name.slice(1).replace(/[_.-](\w|$)/g, function (_, x) {
    return x.toUpperCase();
  });
  map[name] = result;
  return result;
}

function createOverrideContext(bindingContext, parentOverrideContext) {
  return {
    bindingContext: bindingContext,
    parentOverrideContext: parentOverrideContext || null
  };
}

function getContextFor(name, scope, ancestor) {
  var oc = scope.overrideContext;

  if (ancestor) {
    while (ancestor && oc) {
      ancestor--;
      oc = oc.parentOverrideContext;
    }
    if (ancestor || !oc) {
      return undefined;
    }
    return name in oc ? oc : oc.bindingContext;
  }

  while (oc && !(name in oc) && !(oc.bindingContext && name in oc.bindingContext)) {
    oc = oc.parentOverrideContext;
  }
  if (oc) {
    return name in oc ? oc : oc.bindingContext;
  }

  return scope.bindingContext || scope.overrideContext;
}

function createScopeForTest(bindingContext, parentBindingContext) {
  if (parentBindingContext) {
    return {
      bindingContext: bindingContext,
      overrideContext: createOverrideContext(bindingContext, createOverrideContext(parentBindingContext))
    };
  }
  return {
    bindingContext: bindingContext,
    overrideContext: createOverrideContext(bindingContext)
  };
}

var slotNames = [];
var versionSlotNames = [];
var lastSlot = -1;
function ensureEnoughSlotNames(currentSlot) {
  if (currentSlot === lastSlot) {
    lastSlot += 5;
    var ii = slotNames.length = versionSlotNames.length = lastSlot + 1;
    for (var i = currentSlot + 1; i < ii; ++i) {
      slotNames[i] = '_observer' + i;
      versionSlotNames[i] = '_observerVersion' + i;
    }
  }
}
ensureEnoughSlotNames(-1);

function addObserver(observer) {
  var observerSlots = this._observerSlots === undefined ? 0 : this._observerSlots;
  var i = observerSlots;
  while (i-- && this[slotNames[i]] !== observer) {}

  if (i === -1) {
    i = 0;
    while (this[slotNames[i]]) {
      i++;
    }
    this[slotNames[i]] = observer;
    observer.subscribe(sourceContext, this);

    if (i === observerSlots) {
      this._observerSlots = i + 1;
    }
  }

  if (this._version === undefined) {
    this._version = 0;
  }
  this[versionSlotNames[i]] = this._version;
  ensureEnoughSlotNames(i);
}

function observeProperty(obj, propertyName) {
  var observer = this.observerLocator.getObserver(obj, propertyName);
  addObserver.call(this, observer);
}

function observeArray(array) {
  var observer = this.observerLocator.getArrayObserver(array);
  addObserver.call(this, observer);
}

function unobserve(all) {
  var i = this._observerSlots;
  while (i--) {
    if (all || this[versionSlotNames[i]] !== this._version) {
      var observer = this[slotNames[i]];
      this[slotNames[i]] = null;
      if (observer) {
        observer.unsubscribe(sourceContext, this);
      }
    }
  }
}

function connectable() {
  return function (target) {
    target.prototype.observeProperty = observeProperty;
    target.prototype.observeArray = observeArray;
    target.prototype.unobserve = unobserve;
    target.prototype.addObserver = addObserver;
  };
}

var queue = [];
var queued = {};
var nextId = 0;
var minimumImmediate = 100;
var frameBudget = 15;

var isFlushRequested = false;
var immediate = 0;

function flush(animationFrameStart) {
  var length = queue.length;
  var i = 0;
  while (i < length) {
    var binding = queue[i];
    queued[binding.__connectQueueId] = false;
    binding.connect(true);
    i++;

    if (i % 100 === 0 && _aureliaPal.PLATFORM.performance.now() - animationFrameStart > frameBudget) {
      break;
    }
  }
  queue.splice(0, i);

  if (queue.length) {
    _aureliaPal.PLATFORM.requestAnimationFrame(flush);
  } else {
    isFlushRequested = false;
    immediate = 0;
  }
}

function enqueueBindingConnect(binding) {
  if (immediate < minimumImmediate) {
    immediate++;
    binding.connect(false);
  } else {
    var id = binding.__connectQueueId;
    if (id === undefined) {
      id = nextId;
      nextId++;
      binding.__connectQueueId = id;
    }

    if (!queued[id]) {
      queue.push(binding);
      queued[id] = true;
    }
  }
  if (!isFlushRequested) {
    isFlushRequested = true;
    _aureliaPal.PLATFORM.requestAnimationFrame(flush);
  }
}

function setConnectQueueThreshold(value) {
  minimumImmediate = value;
}

function enableConnectQueue() {
  setConnectQueueThreshold(100);
}

function disableConnectQueue() {
  setConnectQueueThreshold(Number.MAX_SAFE_INTEGER);
}

function getConnectQueueSize() {
  return queue.length;
}

function addSubscriber(context, callable) {
  if (this.hasSubscriber(context, callable)) {
    return false;
  }
  if (!this._context0) {
    this._context0 = context;
    this._callable0 = callable;
    return true;
  }
  if (!this._context1) {
    this._context1 = context;
    this._callable1 = callable;
    return true;
  }
  if (!this._context2) {
    this._context2 = context;
    this._callable2 = callable;
    return true;
  }
  if (!this._contextsRest) {
    this._contextsRest = [context];
    this._callablesRest = [callable];
    return true;
  }
  this._contextsRest.push(context);
  this._callablesRest.push(callable);
  return true;
}

function removeSubscriber(context, callable) {
  if (this._context0 === context && this._callable0 === callable) {
    this._context0 = null;
    this._callable0 = null;
    return true;
  }
  if (this._context1 === context && this._callable1 === callable) {
    this._context1 = null;
    this._callable1 = null;
    return true;
  }
  if (this._context2 === context && this._callable2 === callable) {
    this._context2 = null;
    this._callable2 = null;
    return true;
  }
  var callables = this._callablesRest;
  if (callables === undefined || callables.length === 0) {
    return false;
  }
  var contexts = this._contextsRest;
  var i = 0;
  while (!(callables[i] === callable && contexts[i] === context) && callables.length > i) {
    i++;
  }
  if (i >= callables.length) {
    return false;
  }
  contexts.splice(i, 1);
  callables.splice(i, 1);
  return true;
}

var arrayPool1 = [];
var arrayPool2 = [];
var poolUtilization = [];

function callSubscribers(newValue, oldValue) {
  var context0 = this._context0;
  var callable0 = this._callable0;
  var context1 = this._context1;
  var callable1 = this._callable1;
  var context2 = this._context2;
  var callable2 = this._callable2;
  var length = this._contextsRest ? this._contextsRest.length : 0;
  var contextsRest = void 0;
  var callablesRest = void 0;
  var poolIndex = void 0;
  var i = void 0;
  if (length) {
    poolIndex = poolUtilization.length;
    while (poolIndex-- && poolUtilization[poolIndex]) {}
    if (poolIndex < 0) {
      poolIndex = poolUtilization.length;
      contextsRest = [];
      callablesRest = [];
      poolUtilization.push(true);
      arrayPool1.push(contextsRest);
      arrayPool2.push(callablesRest);
    } else {
      poolUtilization[poolIndex] = true;
      contextsRest = arrayPool1[poolIndex];
      callablesRest = arrayPool2[poolIndex];
    }

    i = length;
    while (i--) {
      contextsRest[i] = this._contextsRest[i];
      callablesRest[i] = this._callablesRest[i];
    }
  }

  if (context0) {
    if (callable0) {
      callable0.call(context0, newValue, oldValue);
    } else {
      context0(newValue, oldValue);
    }
  }
  if (context1) {
    if (callable1) {
      callable1.call(context1, newValue, oldValue);
    } else {
      context1(newValue, oldValue);
    }
  }
  if (context2) {
    if (callable2) {
      callable2.call(context2, newValue, oldValue);
    } else {
      context2(newValue, oldValue);
    }
  }
  if (length) {
    for (i = 0; i < length; i++) {
      var callable = callablesRest[i];
      var context = contextsRest[i];
      if (callable) {
        callable.call(context, newValue, oldValue);
      } else {
        context(newValue, oldValue);
      }
      contextsRest[i] = null;
      callablesRest[i] = null;
    }
    poolUtilization[poolIndex] = false;
  }
}

function hasSubscribers() {
  return !!(this._context0 || this._context1 || this._context2 || this._contextsRest && this._contextsRest.length);
}

function hasSubscriber(context, callable) {
  var has = this._context0 === context && this._callable0 === callable || this._context1 === context && this._callable1 === callable || this._context2 === context && this._callable2 === callable;
  if (has) {
    return true;
  }
  var index = void 0;
  var contexts = this._contextsRest;
  if (!contexts || (index = contexts.length) === 0) {
    return false;
  }
  var callables = this._callablesRest;
  while (index--) {
    if (contexts[index] === context && callables[index] === callable) {
      return true;
    }
  }
  return false;
}

function subscriberCollection() {
  return function (target) {
    target.prototype.addSubscriber = addSubscriber;
    target.prototype.removeSubscriber = removeSubscriber;
    target.prototype.callSubscribers = callSubscribers;
    target.prototype.hasSubscribers = hasSubscribers;
    target.prototype.hasSubscriber = hasSubscriber;
  };
}

var ExpressionObserver = exports.ExpressionObserver = (_dec = connectable(), _dec2 = subscriberCollection(), _dec(_class = _dec2(_class = function () {
  function ExpressionObserver(scope, expression, observerLocator, lookupFunctions) {
    

    this.scope = scope;
    this.expression = expression;
    this.observerLocator = observerLocator;
    this.lookupFunctions = lookupFunctions;
  }

  ExpressionObserver.prototype.getValue = function getValue() {
    return this.expression.evaluate(this.scope, this.lookupFunctions);
  };

  ExpressionObserver.prototype.setValue = function setValue(newValue) {
    this.expression.assign(this.scope, newValue);
  };

  ExpressionObserver.prototype.subscribe = function subscribe(context, callable) {
    var _this = this;

    if (!this.hasSubscribers()) {
      this.oldValue = this.expression.evaluate(this.scope, this.lookupFunctions);
      this.expression.connect(this, this.scope);
    }
    this.addSubscriber(context, callable);
    if (arguments.length === 1 && context instanceof Function) {
      return {
        dispose: function dispose() {
          _this.unsubscribe(context, callable);
        }
      };
    }
  };

  ExpressionObserver.prototype.unsubscribe = function unsubscribe(context, callable) {
    if (this.removeSubscriber(context, callable) && !this.hasSubscribers()) {
      this.unobserve(true);
      this.oldValue = undefined;
    }
  };

  ExpressionObserver.prototype.call = function call() {
    var newValue = this.expression.evaluate(this.scope, this.lookupFunctions);
    var oldValue = this.oldValue;
    if (newValue !== oldValue) {
      this.oldValue = newValue;
      this.callSubscribers(newValue, oldValue);
    }
    this._version++;
    this.expression.connect(this, this.scope);
    this.unobserve(false);
  };

  return ExpressionObserver;
}()) || _class) || _class);


function isIndex(s) {
  return +s === s >>> 0;
}

function toNumber(s) {
  return +s;
}

function newSplice(index, removed, addedCount) {
  return {
    index: index,
    removed: removed,
    addedCount: addedCount
  };
}

var EDIT_LEAVE = 0;
var EDIT_UPDATE = 1;
var EDIT_ADD = 2;
var EDIT_DELETE = 3;

function ArraySplice() {}

ArraySplice.prototype = {
  calcEditDistances: function calcEditDistances(current, currentStart, currentEnd, old, oldStart, oldEnd) {
    var rowCount = oldEnd - oldStart + 1;
    var columnCount = currentEnd - currentStart + 1;
    var distances = new Array(rowCount);
    var north = void 0;
    var west = void 0;

    for (var i = 0; i < rowCount; ++i) {
      distances[i] = new Array(columnCount);
      distances[i][0] = i;
    }

    for (var j = 0; j < columnCount; ++j) {
      distances[0][j] = j;
    }

    for (var _i = 1; _i < rowCount; ++_i) {
      for (var _j = 1; _j < columnCount; ++_j) {
        if (this.equals(current[currentStart + _j - 1], old[oldStart + _i - 1])) {
          distances[_i][_j] = distances[_i - 1][_j - 1];
        } else {
          north = distances[_i - 1][_j] + 1;
          west = distances[_i][_j - 1] + 1;
          distances[_i][_j] = north < west ? north : west;
        }
      }
    }

    return distances;
  },

  spliceOperationsFromEditDistances: function spliceOperationsFromEditDistances(distances) {
    var i = distances.length - 1;
    var j = distances[0].length - 1;
    var current = distances[i][j];
    var edits = [];
    while (i > 0 || j > 0) {
      if (i === 0) {
        edits.push(EDIT_ADD);
        j--;
        continue;
      }
      if (j === 0) {
        edits.push(EDIT_DELETE);
        i--;
        continue;
      }
      var northWest = distances[i - 1][j - 1];
      var west = distances[i - 1][j];
      var north = distances[i][j - 1];

      var min = void 0;
      if (west < north) {
        min = west < northWest ? west : northWest;
      } else {
        min = north < northWest ? north : northWest;
      }

      if (min === northWest) {
        if (northWest === current) {
          edits.push(EDIT_LEAVE);
        } else {
          edits.push(EDIT_UPDATE);
          current = northWest;
        }
        i--;
        j--;
      } else if (min === west) {
        edits.push(EDIT_DELETE);
        i--;
        current = west;
      } else {
        edits.push(EDIT_ADD);
        j--;
        current = north;
      }
    }

    edits.reverse();
    return edits;
  },

  calcSplices: function calcSplices(current, currentStart, currentEnd, old, oldStart, oldEnd) {
    var prefixCount = 0;
    var suffixCount = 0;

    var minLength = Math.min(currentEnd - currentStart, oldEnd - oldStart);
    if (currentStart === 0 && oldStart === 0) {
      prefixCount = this.sharedPrefix(current, old, minLength);
    }

    if (currentEnd === current.length && oldEnd === old.length) {
      suffixCount = this.sharedSuffix(current, old, minLength - prefixCount);
    }

    currentStart += prefixCount;
    oldStart += prefixCount;
    currentEnd -= suffixCount;
    oldEnd -= suffixCount;

    if (currentEnd - currentStart === 0 && oldEnd - oldStart === 0) {
      return [];
    }

    if (currentStart === currentEnd) {
      var _splice = newSplice(currentStart, [], 0);
      while (oldStart < oldEnd) {
        _splice.removed.push(old[oldStart++]);
      }

      return [_splice];
    } else if (oldStart === oldEnd) {
      return [newSplice(currentStart, [], currentEnd - currentStart)];
    }

    var ops = this.spliceOperationsFromEditDistances(this.calcEditDistances(current, currentStart, currentEnd, old, oldStart, oldEnd));

    var splice = undefined;
    var splices = [];
    var index = currentStart;
    var oldIndex = oldStart;
    for (var i = 0; i < ops.length; ++i) {
      switch (ops[i]) {
        case EDIT_LEAVE:
          if (splice) {
            splices.push(splice);
            splice = undefined;
          }

          index++;
          oldIndex++;
          break;
        case EDIT_UPDATE:
          if (!splice) {
            splice = newSplice(index, [], 0);
          }

          splice.addedCount++;
          index++;

          splice.removed.push(old[oldIndex]);
          oldIndex++;
          break;
        case EDIT_ADD:
          if (!splice) {
            splice = newSplice(index, [], 0);
          }

          splice.addedCount++;
          index++;
          break;
        case EDIT_DELETE:
          if (!splice) {
            splice = newSplice(index, [], 0);
          }

          splice.removed.push(old[oldIndex]);
          oldIndex++;
          break;
      }
    }

    if (splice) {
      splices.push(splice);
    }
    return splices;
  },

  sharedPrefix: function sharedPrefix(current, old, searchLength) {
    for (var i = 0; i < searchLength; ++i) {
      if (!this.equals(current[i], old[i])) {
        return i;
      }
    }

    return searchLength;
  },

  sharedSuffix: function sharedSuffix(current, old, searchLength) {
    var index1 = current.length;
    var index2 = old.length;
    var count = 0;
    while (count < searchLength && this.equals(current[--index1], old[--index2])) {
      count++;
    }

    return count;
  },

  calculateSplices: function calculateSplices(current, previous) {
    return this.calcSplices(current, 0, current.length, previous, 0, previous.length);
  },

  equals: function equals(currentValue, previousValue) {
    return currentValue === previousValue;
  }
};

var arraySplice = new ArraySplice();

function calcSplices(current, currentStart, currentEnd, old, oldStart, oldEnd) {
  return arraySplice.calcSplices(current, currentStart, currentEnd, old, oldStart, oldEnd);
}

function intersect(start1, end1, start2, end2) {
  if (end1 < start2 || end2 < start1) {
    return -1;
  }

  if (end1 === start2 || end2 === start1) {
    return 0;
  }

  if (start1 < start2) {
    if (end1 < end2) {
      return end1 - start2;
    }

    return end2 - start2;
  }

  if (end2 < end1) {
    return end2 - start1;
  }

  return end1 - start1;
}

function mergeSplice(splices, index, removed, addedCount) {
  var splice = newSplice(index, removed, addedCount);

  var inserted = false;
  var insertionOffset = 0;

  for (var i = 0; i < splices.length; i++) {
    var current = splices[i];
    current.index += insertionOffset;

    if (inserted) {
      continue;
    }

    var intersectCount = intersect(splice.index, splice.index + splice.removed.length, current.index, current.index + current.addedCount);

    if (intersectCount >= 0) {

      splices.splice(i, 1);
      i--;

      insertionOffset -= current.addedCount - current.removed.length;

      splice.addedCount += current.addedCount - intersectCount;
      var deleteCount = splice.removed.length + current.removed.length - intersectCount;

      if (!splice.addedCount && !deleteCount) {
        inserted = true;
      } else {
        var currentRemoved = current.removed;

        if (splice.index < current.index) {
          var prepend = splice.removed.slice(0, current.index - splice.index);
          Array.prototype.push.apply(prepend, currentRemoved);
          currentRemoved = prepend;
        }

        if (splice.index + splice.removed.length > current.index + current.addedCount) {
          var append = splice.removed.slice(current.index + current.addedCount - splice.index);
          Array.prototype.push.apply(currentRemoved, append);
        }

        splice.removed = currentRemoved;
        if (current.index < splice.index) {
          splice.index = current.index;
        }
      }
    } else if (splice.index < current.index) {

      inserted = true;

      splices.splice(i, 0, splice);
      i++;

      var offset = splice.addedCount - splice.removed.length;
      current.index += offset;
      insertionOffset += offset;
    }
  }

  if (!inserted) {
    splices.push(splice);
  }
}

function createInitialSplices(array, changeRecords) {
  var splices = [];

  for (var i = 0; i < changeRecords.length; i++) {
    var record = changeRecords[i];
    switch (record.type) {
      case 'splice':
        mergeSplice(splices, record.index, record.removed.slice(), record.addedCount);
        break;
      case 'add':
      case 'update':
      case 'delete':
        if (!isIndex(record.name)) {
          continue;
        }

        var index = toNumber(record.name);
        if (index < 0) {
          continue;
        }

        mergeSplice(splices, index, [record.oldValue], record.type === 'delete' ? 0 : 1);
        break;
      default:
        console.error('Unexpected record type: ' + JSON.stringify(record));
        break;
    }
  }

  return splices;
}

function projectArraySplices(array, changeRecords) {
  var splices = [];

  createInitialSplices(array, changeRecords).forEach(function (splice) {
    if (splice.addedCount === 1 && splice.removed.length === 1) {
      if (splice.removed[0] !== array[splice.index]) {
        splices.push(splice);
      }

      return;
    }

    splices = splices.concat(calcSplices(array, splice.index, splice.index + splice.addedCount, splice.removed, 0, splice.removed.length));
  });

  return splices;
}

function newRecord(type, object, key, oldValue) {
  return {
    type: type,
    object: object,
    key: key,
    oldValue: oldValue
  };
}

function getChangeRecords(map) {
  var entries = new Array(map.size);
  var keys = map.keys();
  var i = 0;
  var item = void 0;

  while (item = keys.next()) {
    if (item.done) {
      break;
    }

    entries[i] = newRecord('added', map, item.value);
    i++;
  }

  return entries;
}

var ModifyCollectionObserver = exports.ModifyCollectionObserver = (_dec3 = subscriberCollection(), _dec3(_class2 = function () {
  function ModifyCollectionObserver(taskQueue, collection) {
    

    this.taskQueue = taskQueue;
    this.queued = false;
    this.changeRecords = null;
    this.oldCollection = null;
    this.collection = collection;
    this.lengthPropertyName = collection instanceof Map || collection instanceof Set ? 'size' : 'length';
  }

  ModifyCollectionObserver.prototype.subscribe = function subscribe(context, callable) {
    this.addSubscriber(context, callable);
  };

  ModifyCollectionObserver.prototype.unsubscribe = function unsubscribe(context, callable) {
    this.removeSubscriber(context, callable);
  };

  ModifyCollectionObserver.prototype.addChangeRecord = function addChangeRecord(changeRecord) {
    if (!this.hasSubscribers() && !this.lengthObserver) {
      return;
    }

    if (changeRecord.type === 'splice') {
      var index = changeRecord.index;
      var arrayLength = changeRecord.object.length;
      if (index > arrayLength) {
        index = arrayLength - changeRecord.addedCount;
      } else if (index < 0) {
        index = arrayLength + changeRecord.removed.length + index - changeRecord.addedCount;
      }
      if (index < 0) {
        index = 0;
      }
      changeRecord.index = index;
    }

    if (this.changeRecords === null) {
      this.changeRecords = [changeRecord];
    } else {
      this.changeRecords.push(changeRecord);
    }

    if (!this.queued) {
      this.queued = true;
      this.taskQueue.queueMicroTask(this);
    }
  };

  ModifyCollectionObserver.prototype.flushChangeRecords = function flushChangeRecords() {
    if (this.changeRecords && this.changeRecords.length || this.oldCollection) {
      this.call();
    }
  };

  ModifyCollectionObserver.prototype.reset = function reset(oldCollection) {
    this.oldCollection = oldCollection;

    if (this.hasSubscribers() && !this.queued) {
      this.queued = true;
      this.taskQueue.queueMicroTask(this);
    }
  };

  ModifyCollectionObserver.prototype.getLengthObserver = function getLengthObserver() {
    return this.lengthObserver || (this.lengthObserver = new CollectionLengthObserver(this.collection));
  };

  ModifyCollectionObserver.prototype.call = function call() {
    var changeRecords = this.changeRecords;
    var oldCollection = this.oldCollection;
    var records = void 0;

    this.queued = false;
    this.changeRecords = [];
    this.oldCollection = null;

    if (this.hasSubscribers()) {
      if (oldCollection) {
        if (this.collection instanceof Map || this.collection instanceof Set) {
          records = getChangeRecords(oldCollection);
        } else {
          records = calcSplices(this.collection, 0, this.collection.length, oldCollection, 0, oldCollection.length);
        }
      } else {
        if (this.collection instanceof Map || this.collection instanceof Set) {
          records = changeRecords;
        } else {
          records = projectArraySplices(this.collection, changeRecords);
        }
      }

      this.callSubscribers(records);
    }

    if (this.lengthObserver) {
      this.lengthObserver.call(this.collection[this.lengthPropertyName]);
    }
  };

  return ModifyCollectionObserver;
}()) || _class2);
var CollectionLengthObserver = exports.CollectionLengthObserver = (_dec4 = subscriberCollection(), _dec4(_class3 = function () {
  function CollectionLengthObserver(collection) {
    

    this.collection = collection;
    this.lengthPropertyName = collection instanceof Map || collection instanceof Set ? 'size' : 'length';
    this.currentValue = collection[this.lengthPropertyName];
  }

  CollectionLengthObserver.prototype.getValue = function getValue() {
    return this.collection[this.lengthPropertyName];
  };

  CollectionLengthObserver.prototype.setValue = function setValue(newValue) {
    this.collection[this.lengthPropertyName] = newValue;
  };

  CollectionLengthObserver.prototype.subscribe = function subscribe(context, callable) {
    this.addSubscriber(context, callable);
  };

  CollectionLengthObserver.prototype.unsubscribe = function unsubscribe(context, callable) {
    this.removeSubscriber(context, callable);
  };

  CollectionLengthObserver.prototype.call = function call(newValue) {
    var oldValue = this.currentValue;
    this.callSubscribers(newValue, oldValue);
    this.currentValue = newValue;
  };

  return CollectionLengthObserver;
}()) || _class3);

var arrayProto = Array.prototype;
var pop = arrayProto.pop;
var push = arrayProto.push;
var reverse = arrayProto.reverse;
var shift = arrayProto.shift;
var sort = arrayProto.sort;
var splice = arrayProto.splice;
var unshift = arrayProto.unshift;

if (arrayProto.__au_patched__) {
  LogManager.getLogger('array-observation').warn('Detected 2nd attempt of patching array from Aurelia binding.' + ' This is probably caused by dependency mismatch between core modules and a 3rd party plugin.' + ' Please see https://github.com/aurelia/cli/pull/906 if you are using webpack.');
} else {
  Reflect.defineProperty(arrayProto, '__au_patched__', { value: 1 });
  arrayProto.pop = function () {
    var notEmpty = this.length > 0;
    var methodCallResult = pop.apply(this, arguments);
    if (notEmpty && this.__array_observer__ !== undefined) {
      this.__array_observer__.addChangeRecord({
        type: 'delete',
        object: this,
        name: this.length,
        oldValue: methodCallResult
      });
    }
    return methodCallResult;
  };

  arrayProto.push = function () {
    var methodCallResult = push.apply(this, arguments);
    if (this.__array_observer__ !== undefined) {
      this.__array_observer__.addChangeRecord({
        type: 'splice',
        object: this,
        index: this.length - arguments.length,
        removed: [],
        addedCount: arguments.length
      });
    }
    return methodCallResult;
  };

  arrayProto.reverse = function () {
    var oldArray = void 0;
    if (this.__array_observer__ !== undefined) {
      this.__array_observer__.flushChangeRecords();
      oldArray = this.slice();
    }
    var methodCallResult = reverse.apply(this, arguments);
    if (this.__array_observer__ !== undefined) {
      this.__array_observer__.reset(oldArray);
    }
    return methodCallResult;
  };

  arrayProto.shift = function () {
    var notEmpty = this.length > 0;
    var methodCallResult = shift.apply(this, arguments);
    if (notEmpty && this.__array_observer__ !== undefined) {
      this.__array_observer__.addChangeRecord({
        type: 'delete',
        object: this,
        name: 0,
        oldValue: methodCallResult
      });
    }
    return methodCallResult;
  };

  arrayProto.sort = function () {
    var oldArray = void 0;
    if (this.__array_observer__ !== undefined) {
      this.__array_observer__.flushChangeRecords();
      oldArray = this.slice();
    }
    var methodCallResult = sort.apply(this, arguments);
    if (this.__array_observer__ !== undefined) {
      this.__array_observer__.reset(oldArray);
    }
    return methodCallResult;
  };

  arrayProto.splice = function () {
    var methodCallResult = splice.apply(this, arguments);
    if (this.__array_observer__ !== undefined) {
      this.__array_observer__.addChangeRecord({
        type: 'splice',
        object: this,
        index: +arguments[0],
        removed: methodCallResult,
        addedCount: arguments.length > 2 ? arguments.length - 2 : 0
      });
    }
    return methodCallResult;
  };

  arrayProto.unshift = function () {
    var methodCallResult = unshift.apply(this, arguments);
    if (this.__array_observer__ !== undefined) {
      this.__array_observer__.addChangeRecord({
        type: 'splice',
        object: this,
        index: 0,
        removed: [],
        addedCount: arguments.length
      });
    }
    return methodCallResult;
  };
}

function _getArrayObserver(taskQueue, array) {
  return ModifyArrayObserver.for(taskQueue, array);
}

exports.getArrayObserver = _getArrayObserver;

var ModifyArrayObserver = function (_ModifyCollectionObse) {
  _inherits(ModifyArrayObserver, _ModifyCollectionObse);

  function ModifyArrayObserver(taskQueue, array) {
    

    return _possibleConstructorReturn(this, _ModifyCollectionObse.call(this, taskQueue, array));
  }

  ModifyArrayObserver.for = function _for(taskQueue, array) {
    if (!('__array_observer__' in array)) {
      Reflect.defineProperty(array, '__array_observer__', {
        value: ModifyArrayObserver.create(taskQueue, array),
        enumerable: false, configurable: false
      });
    }
    return array.__array_observer__;
  };

  ModifyArrayObserver.create = function create(taskQueue, array) {
    return new ModifyArrayObserver(taskQueue, array);
  };

  return ModifyArrayObserver;
}(ModifyCollectionObserver);

var Expression = exports.Expression = function () {
  function Expression() {
    

    this.isAssignable = false;
  }

  Expression.prototype.evaluate = function evaluate(scope, lookupFunctions, args) {
    throw new Error('Binding expression "' + this + '" cannot be evaluated.');
  };

  Expression.prototype.assign = function assign(scope, value, lookupFunctions) {
    throw new Error('Binding expression "' + this + '" cannot be assigned to.');
  };

  Expression.prototype.toString = function toString() {
    return typeof FEATURE_NO_UNPARSER === 'undefined' ? _Unparser.unparse(this) : Function.prototype.toString.call(this);
  };

  return Expression;
}();

var BindingBehavior = exports.BindingBehavior = function (_Expression) {
  _inherits(BindingBehavior, _Expression);

  function BindingBehavior(expression, name, args) {
    

    var _this3 = _possibleConstructorReturn(this, _Expression.call(this));

    _this3.expression = expression;
    _this3.name = name;
    _this3.args = args;
    return _this3;
  }

  BindingBehavior.prototype.evaluate = function evaluate(scope, lookupFunctions) {
    return this.expression.evaluate(scope, lookupFunctions);
  };

  BindingBehavior.prototype.assign = function assign(scope, value, lookupFunctions) {
    return this.expression.assign(scope, value, lookupFunctions);
  };

  BindingBehavior.prototype.accept = function accept(visitor) {
    return visitor.visitBindingBehavior(this);
  };

  BindingBehavior.prototype.connect = function connect(binding, scope) {
    this.expression.connect(binding, scope);
  };

  BindingBehavior.prototype.bind = function bind(binding, scope, lookupFunctions) {
    if (this.expression.expression && this.expression.bind) {
      this.expression.bind(binding, scope, lookupFunctions);
    }
    var behavior = lookupFunctions.bindingBehaviors(this.name);
    if (!behavior) {
      throw new Error('No BindingBehavior named "' + this.name + '" was found!');
    }
    var behaviorKey = 'behavior-' + this.name;
    if (binding[behaviorKey]) {
      throw new Error('A binding behavior named "' + this.name + '" has already been applied to "' + this.expression + '"');
    }
    binding[behaviorKey] = behavior;
    behavior.bind.apply(behavior, [binding, scope].concat(evalList(scope, this.args, binding.lookupFunctions)));
  };

  BindingBehavior.prototype.unbind = function unbind(binding, scope) {
    var behaviorKey = 'behavior-' + this.name;
    binding[behaviorKey].unbind(binding, scope);
    binding[behaviorKey] = null;
    if (this.expression.expression && this.expression.unbind) {
      this.expression.unbind(binding, scope);
    }
  };

  return BindingBehavior;
}(Expression);

var ValueConverter = exports.ValueConverter = function (_Expression2) {
  _inherits(ValueConverter, _Expression2);

  function ValueConverter(expression, name, args) {
    

    var _this4 = _possibleConstructorReturn(this, _Expression2.call(this));

    _this4.expression = expression;
    _this4.name = name;
    _this4.args = args;
    _this4.allArgs = [expression].concat(args);
    return _this4;
  }

  ValueConverter.prototype.evaluate = function evaluate(scope, lookupFunctions) {
    var converter = lookupFunctions.valueConverters(this.name);
    if (!converter) {
      throw new Error('No ValueConverter named "' + this.name + '" was found!');
    }

    if ('toView' in converter) {
      return converter.toView.apply(converter, evalList(scope, this.allArgs, lookupFunctions));
    }

    return this.allArgs[0].evaluate(scope, lookupFunctions);
  };

  ValueConverter.prototype.assign = function assign(scope, value, lookupFunctions) {
    var converter = lookupFunctions.valueConverters(this.name);
    if (!converter) {
      throw new Error('No ValueConverter named "' + this.name + '" was found!');
    }

    if ('fromView' in converter) {
      value = converter.fromView.apply(converter, [value].concat(evalList(scope, this.args, lookupFunctions)));
    }

    return this.allArgs[0].assign(scope, value, lookupFunctions);
  };

  ValueConverter.prototype.accept = function accept(visitor) {
    return visitor.visitValueConverter(this);
  };

  ValueConverter.prototype.connect = function connect(binding, scope) {
    var expressions = this.allArgs;
    var i = expressions.length;
    while (i--) {
      expressions[i].connect(binding, scope);
    }
    var converter = binding.lookupFunctions.valueConverters(this.name);
    if (!converter) {
      throw new Error('No ValueConverter named "' + this.name + '" was found!');
    }
    var signals = converter.signals;
    if (signals === undefined) {
      return;
    }
    i = signals.length;
    while (i--) {
      connectBindingToSignal(binding, signals[i]);
    }
  };

  return ValueConverter;
}(Expression);

var Assign = exports.Assign = function (_Expression3) {
  _inherits(Assign, _Expression3);

  function Assign(target, value) {
    

    var _this5 = _possibleConstructorReturn(this, _Expression3.call(this));

    _this5.target = target;
    _this5.value = value;
    _this5.isAssignable = true;
    return _this5;
  }

  Assign.prototype.evaluate = function evaluate(scope, lookupFunctions) {
    return this.target.assign(scope, this.value.evaluate(scope, lookupFunctions));
  };

  Assign.prototype.accept = function accept(vistor) {
    vistor.visitAssign(this);
  };

  Assign.prototype.connect = function connect(binding, scope) {};

  Assign.prototype.assign = function assign(scope, value) {
    this.value.assign(scope, value);
    this.target.assign(scope, value);
  };

  return Assign;
}(Expression);

var Conditional = exports.Conditional = function (_Expression4) {
  _inherits(Conditional, _Expression4);

  function Conditional(condition, yes, no) {
    

    var _this6 = _possibleConstructorReturn(this, _Expression4.call(this));

    _this6.condition = condition;
    _this6.yes = yes;
    _this6.no = no;
    return _this6;
  }

  Conditional.prototype.evaluate = function evaluate(scope, lookupFunctions) {
    return !!this.condition.evaluate(scope, lookupFunctions) ? this.yes.evaluate(scope, lookupFunctions) : this.no.evaluate(scope, lookupFunctions);
  };

  Conditional.prototype.accept = function accept(visitor) {
    return visitor.visitConditional(this);
  };

  Conditional.prototype.connect = function connect(binding, scope) {
    this.condition.connect(binding, scope);
    if (this.condition.evaluate(scope)) {
      this.yes.connect(binding, scope);
    } else {
      this.no.connect(binding, scope);
    }
  };

  return Conditional;
}(Expression);

var AccessThis = exports.AccessThis = function (_Expression5) {
  _inherits(AccessThis, _Expression5);

  function AccessThis(ancestor) {
    

    var _this7 = _possibleConstructorReturn(this, _Expression5.call(this));

    _this7.ancestor = ancestor;
    return _this7;
  }

  AccessThis.prototype.evaluate = function evaluate(scope, lookupFunctions) {
    var oc = scope.overrideContext;
    var i = this.ancestor;
    while (i-- && oc) {
      oc = oc.parentOverrideContext;
    }
    return i < 1 && oc ? oc.bindingContext : undefined;
  };

  AccessThis.prototype.accept = function accept(visitor) {
    return visitor.visitAccessThis(this);
  };

  AccessThis.prototype.connect = function connect(binding, scope) {};

  return AccessThis;
}(Expression);

var AccessScope = exports.AccessScope = function (_Expression6) {
  _inherits(AccessScope, _Expression6);

  function AccessScope(name, ancestor) {
    

    var _this8 = _possibleConstructorReturn(this, _Expression6.call(this));

    _this8.name = name;
    _this8.ancestor = ancestor;
    _this8.isAssignable = true;
    return _this8;
  }

  AccessScope.prototype.evaluate = function evaluate(scope, lookupFunctions) {
    var context = getContextFor(this.name, scope, this.ancestor);
    return context[this.name];
  };

  AccessScope.prototype.assign = function assign(scope, value) {
    var context = getContextFor(this.name, scope, this.ancestor);
    return context ? context[this.name] = value : undefined;
  };

  AccessScope.prototype.accept = function accept(visitor) {
    return visitor.visitAccessScope(this);
  };

  AccessScope.prototype.connect = function connect(binding, scope) {
    var context = getContextFor(this.name, scope, this.ancestor);
    binding.observeProperty(context, this.name);
  };

  return AccessScope;
}(Expression);

var AccessMember = exports.AccessMember = function (_Expression7) {
  _inherits(AccessMember, _Expression7);

  function AccessMember(object, name) {
    

    var _this9 = _possibleConstructorReturn(this, _Expression7.call(this));

    _this9.object = object;
    _this9.name = name;
    _this9.isAssignable = true;
    return _this9;
  }

  AccessMember.prototype.evaluate = function evaluate(scope, lookupFunctions) {
    var instance = this.object.evaluate(scope, lookupFunctions);
    return instance === null || instance === undefined ? instance : instance[this.name];
  };

  AccessMember.prototype.assign = function assign(scope, value) {
    var instance = this.object.evaluate(scope);

    if (instance === null || instance === undefined) {
      instance = {};
      this.object.assign(scope, instance);
    }

    instance[this.name] = value;
    return value;
  };

  AccessMember.prototype.accept = function accept(visitor) {
    return visitor.visitAccessMember(this);
  };

  AccessMember.prototype.connect = function connect(binding, scope) {
    this.object.connect(binding, scope);
    var obj = this.object.evaluate(scope);
    if (obj) {
      binding.observeProperty(obj, this.name);
    }
  };

  return AccessMember;
}(Expression);

var AccessKeyed = exports.AccessKeyed = function (_Expression8) {
  _inherits(AccessKeyed, _Expression8);

  function AccessKeyed(object, key) {
    

    var _this10 = _possibleConstructorReturn(this, _Expression8.call(this));

    _this10.object = object;
    _this10.key = key;
    _this10.isAssignable = true;
    return _this10;
  }

  AccessKeyed.prototype.evaluate = function evaluate(scope, lookupFunctions) {
    var instance = this.object.evaluate(scope, lookupFunctions);
    var lookup = this.key.evaluate(scope, lookupFunctions);
    return getKeyed(instance, lookup);
  };

  AccessKeyed.prototype.assign = function assign(scope, value) {
    var instance = this.object.evaluate(scope);
    var lookup = this.key.evaluate(scope);
    return setKeyed(instance, lookup, value);
  };

  AccessKeyed.prototype.accept = function accept(visitor) {
    return visitor.visitAccessKeyed(this);
  };

  AccessKeyed.prototype.connect = function connect(binding, scope) {
    this.object.connect(binding, scope);
    var obj = this.object.evaluate(scope);
    if (obj instanceof Object) {
      this.key.connect(binding, scope);
      var key = this.key.evaluate(scope);

      if (key !== null && key !== undefined && !(Array.isArray(obj) && typeof key === 'number')) {
        binding.observeProperty(obj, key);
      }
    }
  };

  return AccessKeyed;
}(Expression);

var CallScope = exports.CallScope = function (_Expression9) {
  _inherits(CallScope, _Expression9);

  function CallScope(name, args, ancestor) {
    

    var _this11 = _possibleConstructorReturn(this, _Expression9.call(this));

    _this11.name = name;
    _this11.args = args;
    _this11.ancestor = ancestor;
    return _this11;
  }

  CallScope.prototype.evaluate = function evaluate(scope, lookupFunctions, mustEvaluate) {
    var args = evalList(scope, this.args, lookupFunctions);
    var context = getContextFor(this.name, scope, this.ancestor);
    var func = getFunction(context, this.name, mustEvaluate);
    if (func) {
      return func.apply(context, args);
    }
    return undefined;
  };

  CallScope.prototype.accept = function accept(visitor) {
    return visitor.visitCallScope(this);
  };

  CallScope.prototype.connect = function connect(binding, scope) {
    var args = this.args;
    var i = args.length;
    while (i--) {
      args[i].connect(binding, scope);
    }
  };

  return CallScope;
}(Expression);

var CallMember = exports.CallMember = function (_Expression10) {
  _inherits(CallMember, _Expression10);

  function CallMember(object, name, args) {
    

    var _this12 = _possibleConstructorReturn(this, _Expression10.call(this));

    _this12.object = object;
    _this12.name = name;
    _this12.args = args;
    return _this12;
  }

  CallMember.prototype.evaluate = function evaluate(scope, lookupFunctions, mustEvaluate) {
    var instance = this.object.evaluate(scope, lookupFunctions);
    var args = evalList(scope, this.args, lookupFunctions);
    var func = getFunction(instance, this.name, mustEvaluate);
    if (func) {
      return func.apply(instance, args);
    }
    return undefined;
  };

  CallMember.prototype.accept = function accept(visitor) {
    return visitor.visitCallMember(this);
  };

  CallMember.prototype.connect = function connect(binding, scope) {
    this.object.connect(binding, scope);
    var obj = this.object.evaluate(scope);
    if (getFunction(obj, this.name, false)) {
      var args = this.args;
      var i = args.length;
      while (i--) {
        args[i].connect(binding, scope);
      }
    }
  };

  return CallMember;
}(Expression);

var CallFunction = exports.CallFunction = function (_Expression11) {
  _inherits(CallFunction, _Expression11);

  function CallFunction(func, args) {
    

    var _this13 = _possibleConstructorReturn(this, _Expression11.call(this));

    _this13.func = func;
    _this13.args = args;
    return _this13;
  }

  CallFunction.prototype.evaluate = function evaluate(scope, lookupFunctions, mustEvaluate) {
    var func = this.func.evaluate(scope, lookupFunctions);
    if (typeof func === 'function') {
      return func.apply(null, evalList(scope, this.args, lookupFunctions));
    }
    if (!mustEvaluate && (func === null || func === undefined)) {
      return undefined;
    }
    throw new Error(this.func + ' is not a function');
  };

  CallFunction.prototype.accept = function accept(visitor) {
    return visitor.visitCallFunction(this);
  };

  CallFunction.prototype.connect = function connect(binding, scope) {
    this.func.connect(binding, scope);
    var func = this.func.evaluate(scope);
    if (typeof func === 'function') {
      var args = this.args;
      var i = args.length;
      while (i--) {
        args[i].connect(binding, scope);
      }
    }
  };

  return CallFunction;
}(Expression);

var Binary = exports.Binary = function (_Expression12) {
  _inherits(Binary, _Expression12);

  function Binary(operation, left, right) {
    

    var _this14 = _possibleConstructorReturn(this, _Expression12.call(this));

    _this14.operation = operation;
    _this14.left = left;
    _this14.right = right;
    return _this14;
  }

  Binary.prototype.evaluate = function evaluate(scope, lookupFunctions) {
    var left = this.left.evaluate(scope, lookupFunctions);

    switch (this.operation) {
      case '&&':
        return left && this.right.evaluate(scope, lookupFunctions);
      case '||':
        return left || this.right.evaluate(scope, lookupFunctions);
    }

    var right = this.right.evaluate(scope, lookupFunctions);

    switch (this.operation) {
      case '==':
        return left == right;
      case '===':
        return left === right;
      case '!=':
        return left != right;
      case '!==':
        return left !== right;
      case 'instanceof':
        return typeof right === 'function' && left instanceof right;
      case 'in':
        return (typeof right === 'undefined' ? 'undefined' : _typeof(right)) === 'object' && right !== null && left in right;
    }

    if (left === null || right === null || left === undefined || right === undefined) {
      switch (this.operation) {
        case '+':
          if (left !== null && left !== undefined) return left;
          if (right !== null && right !== undefined) return right;
          return 0;
        case '-':
          if (left !== null && left !== undefined) return left;
          if (right !== null && right !== undefined) return 0 - right;
          return 0;
      }

      return null;
    }

    switch (this.operation) {
      case '+':
        return autoConvertAdd(left, right);
      case '-':
        return left - right;
      case '*':
        return left * right;
      case '/':
        return left / right;
      case '%':
        return left % right;
      case '<':
        return left < right;
      case '>':
        return left > right;
      case '<=':
        return left <= right;
      case '>=':
        return left >= right;
      case '^':
        return left ^ right;
    }

    throw new Error('Internal error [' + this.operation + '] not handled');
  };

  Binary.prototype.accept = function accept(visitor) {
    return visitor.visitBinary(this);
  };

  Binary.prototype.connect = function connect(binding, scope) {
    this.left.connect(binding, scope);
    var left = this.left.evaluate(scope);
    if (this.operation === '&&' && !left || this.operation === '||' && left) {
      return;
    }
    this.right.connect(binding, scope);
  };

  return Binary;
}(Expression);

var Unary = exports.Unary = function (_Expression13) {
  _inherits(Unary, _Expression13);

  function Unary(operation, expression) {
    

    var _this15 = _possibleConstructorReturn(this, _Expression13.call(this));

    _this15.operation = operation;
    _this15.expression = expression;
    return _this15;
  }

  Unary.prototype.evaluate = function evaluate(scope, lookupFunctions) {
    switch (this.operation) {
      case '!':
        return !this.expression.evaluate(scope, lookupFunctions);
      case 'typeof':
        return _typeof(this.expression.evaluate(scope, lookupFunctions));
      case 'void':
        return void this.expression.evaluate(scope, lookupFunctions);
    }

    throw new Error('Internal error [' + this.operation + '] not handled');
  };

  Unary.prototype.accept = function accept(visitor) {
    return visitor.visitPrefix(this);
  };

  Unary.prototype.connect = function connect(binding, scope) {
    this.expression.connect(binding, scope);
  };

  return Unary;
}(Expression);

var LiteralPrimitive = exports.LiteralPrimitive = function (_Expression14) {
  _inherits(LiteralPrimitive, _Expression14);

  function LiteralPrimitive(value) {
    

    var _this16 = _possibleConstructorReturn(this, _Expression14.call(this));

    _this16.value = value;
    return _this16;
  }

  LiteralPrimitive.prototype.evaluate = function evaluate(scope, lookupFunctions) {
    return this.value;
  };

  LiteralPrimitive.prototype.accept = function accept(visitor) {
    return visitor.visitLiteralPrimitive(this);
  };

  LiteralPrimitive.prototype.connect = function connect(binding, scope) {};

  return LiteralPrimitive;
}(Expression);

var LiteralString = exports.LiteralString = function (_Expression15) {
  _inherits(LiteralString, _Expression15);

  function LiteralString(value) {
    

    var _this17 = _possibleConstructorReturn(this, _Expression15.call(this));

    _this17.value = value;
    return _this17;
  }

  LiteralString.prototype.evaluate = function evaluate(scope, lookupFunctions) {
    return this.value;
  };

  LiteralString.prototype.accept = function accept(visitor) {
    return visitor.visitLiteralString(this);
  };

  LiteralString.prototype.connect = function connect(binding, scope) {};

  return LiteralString;
}(Expression);

var LiteralTemplate = exports.LiteralTemplate = function (_Expression16) {
  _inherits(LiteralTemplate, _Expression16);

  function LiteralTemplate(cooked, expressions, raw, tag) {
    

    var _this18 = _possibleConstructorReturn(this, _Expression16.call(this));

    _this18.cooked = cooked;
    _this18.expressions = expressions || [];
    _this18.length = _this18.expressions.length;
    _this18.tagged = tag !== undefined;
    if (_this18.tagged) {
      _this18.cooked.raw = raw;
      _this18.tag = tag;
      if (tag instanceof AccessScope) {
        _this18.contextType = 'Scope';
      } else if (tag instanceof AccessMember || tag instanceof AccessKeyed) {
        _this18.contextType = 'Object';
      } else {
        throw new Error(_this18.tag + ' is not a valid template tag');
      }
    }
    return _this18;
  }

  LiteralTemplate.prototype.getScopeContext = function getScopeContext(scope, lookupFunctions) {
    return getContextFor(this.tag.name, scope, this.tag.ancestor);
  };

  LiteralTemplate.prototype.getObjectContext = function getObjectContext(scope, lookupFunctions) {
    return this.tag.object.evaluate(scope, lookupFunctions);
  };

  LiteralTemplate.prototype.evaluate = function evaluate(scope, lookupFunctions, mustEvaluate) {
    var results = new Array(this.length);
    for (var i = 0; i < this.length; i++) {
      results[i] = this.expressions[i].evaluate(scope, lookupFunctions);
    }
    if (this.tagged) {
      var func = this.tag.evaluate(scope, lookupFunctions);
      if (typeof func === 'function') {
        var context = this['get' + this.contextType + 'Context'](scope, lookupFunctions);
        return func.call.apply(func, [context, this.cooked].concat(results));
      }
      if (!mustEvaluate) {
        return null;
      }
      throw new Error(this.tag + ' is not a function');
    }
    var result = this.cooked[0];
    for (var _i2 = 0; _i2 < this.length; _i2++) {
      result = String.prototype.concat(result, results[_i2], this.cooked[_i2 + 1]);
    }
    return result;
  };

  LiteralTemplate.prototype.accept = function accept(visitor) {
    return visitor.visitLiteralTemplate(this);
  };

  LiteralTemplate.prototype.connect = function connect(binding, scope) {
    for (var i = 0; i < this.length; i++) {
      this.expressions[i].connect(binding, scope);
    }
    if (this.tagged) {
      this.tag.connect(binding, scope);
    }
  };

  return LiteralTemplate;
}(Expression);

var LiteralArray = exports.LiteralArray = function (_Expression17) {
  _inherits(LiteralArray, _Expression17);

  function LiteralArray(elements) {
    

    var _this19 = _possibleConstructorReturn(this, _Expression17.call(this));

    _this19.elements = elements;
    return _this19;
  }

  LiteralArray.prototype.evaluate = function evaluate(scope, lookupFunctions) {
    var elements = this.elements;
    var result = [];

    for (var i = 0, length = elements.length; i < length; ++i) {
      result[i] = elements[i].evaluate(scope, lookupFunctions);
    }

    return result;
  };

  LiteralArray.prototype.accept = function accept(visitor) {
    return visitor.visitLiteralArray(this);
  };

  LiteralArray.prototype.connect = function connect(binding, scope) {
    var length = this.elements.length;
    for (var i = 0; i < length; i++) {
      this.elements[i].connect(binding, scope);
    }
  };

  return LiteralArray;
}(Expression);

var LiteralObject = exports.LiteralObject = function (_Expression18) {
  _inherits(LiteralObject, _Expression18);

  function LiteralObject(keys, values) {
    

    var _this20 = _possibleConstructorReturn(this, _Expression18.call(this));

    _this20.keys = keys;
    _this20.values = values;
    return _this20;
  }

  LiteralObject.prototype.evaluate = function evaluate(scope, lookupFunctions) {
    var instance = {};
    var keys = this.keys;
    var values = this.values;

    for (var i = 0, length = keys.length; i < length; ++i) {
      instance[keys[i]] = values[i].evaluate(scope, lookupFunctions);
    }

    return instance;
  };

  LiteralObject.prototype.accept = function accept(visitor) {
    return visitor.visitLiteralObject(this);
  };

  LiteralObject.prototype.connect = function connect(binding, scope) {
    var length = this.keys.length;
    for (var i = 0; i < length; i++) {
      this.values[i].connect(binding, scope);
    }
  };

  return LiteralObject;
}(Expression);

function evalList(scope, list, lookupFunctions) {
  var length = list.length;
  var result = [];
  for (var i = 0; i < length; i++) {
    result[i] = list[i].evaluate(scope, lookupFunctions);
  }
  return result;
}

function autoConvertAdd(a, b) {
  if (a !== null && b !== null) {
    if (typeof a === 'string' && typeof b !== 'string') {
      return a + b.toString();
    }

    if (typeof a !== 'string' && typeof b === 'string') {
      return a.toString() + b;
    }

    return a + b;
  }

  if (a !== null) {
    return a;
  }

  if (b !== null) {
    return b;
  }

  return 0;
}

function getFunction(obj, name, mustExist) {
  var func = obj === null || obj === undefined ? null : obj[name];
  if (typeof func === 'function') {
    return func;
  }
  if (!mustExist && (func === null || func === undefined)) {
    return null;
  }
  throw new Error(name + ' is not a function');
}

function getKeyed(obj, key) {
  if (Array.isArray(obj)) {
    return obj[parseInt(key, 10)];
  } else if (obj) {
    return obj[key];
  } else if (obj === null || obj === undefined) {
    return undefined;
  }

  return obj[key];
}

function setKeyed(obj, key, value) {
  if (Array.isArray(obj)) {
    var index = parseInt(key, 10);

    if (obj.length <= index) {
      obj.length = index + 1;
    }

    obj[index] = value;
  } else {
    obj[key] = value;
  }

  return value;
}

var _Unparser = null;

exports.Unparser = _Unparser;
if (typeof FEATURE_NO_UNPARSER === 'undefined') {
  exports.Unparser = _Unparser = function () {
    function Unparser(buffer) {
      

      this.buffer = buffer;
    }

    Unparser.unparse = function unparse(expression) {
      var buffer = [];
      var visitor = new _Unparser(buffer);

      expression.accept(visitor);

      return buffer.join('');
    };

    Unparser.prototype.write = function write(text) {
      this.buffer.push(text);
    };

    Unparser.prototype.writeArgs = function writeArgs(args) {
      this.write('(');

      for (var i = 0, length = args.length; i < length; ++i) {
        if (i !== 0) {
          this.write(',');
        }

        args[i].accept(this);
      }

      this.write(')');
    };

    Unparser.prototype.visitBindingBehavior = function visitBindingBehavior(behavior) {
      var args = behavior.args;

      behavior.expression.accept(this);
      this.write('&' + behavior.name);

      for (var i = 0, length = args.length; i < length; ++i) {
        this.write(':');
        args[i].accept(this);
      }
    };

    Unparser.prototype.visitValueConverter = function visitValueConverter(converter) {
      var args = converter.args;

      converter.expression.accept(this);
      this.write('|' + converter.name);

      for (var i = 0, length = args.length; i < length; ++i) {
        this.write(':');
        args[i].accept(this);
      }
    };

    Unparser.prototype.visitAssign = function visitAssign(assign) {
      assign.target.accept(this);
      this.write('=');
      assign.value.accept(this);
    };

    Unparser.prototype.visitConditional = function visitConditional(conditional) {
      conditional.condition.accept(this);
      this.write('?');
      conditional.yes.accept(this);
      this.write(':');
      conditional.no.accept(this);
    };

    Unparser.prototype.visitAccessThis = function visitAccessThis(access) {
      if (access.ancestor === 0) {
        this.write('$this');
        return;
      }
      this.write('$parent');
      var i = access.ancestor - 1;
      while (i--) {
        this.write('.$parent');
      }
    };

    Unparser.prototype.visitAccessScope = function visitAccessScope(access) {
      var i = access.ancestor;
      while (i--) {
        this.write('$parent.');
      }
      this.write(access.name);
    };

    Unparser.prototype.visitAccessMember = function visitAccessMember(access) {
      access.object.accept(this);
      this.write('.' + access.name);
    };

    Unparser.prototype.visitAccessKeyed = function visitAccessKeyed(access) {
      access.object.accept(this);
      this.write('[');
      access.key.accept(this);
      this.write(']');
    };

    Unparser.prototype.visitCallScope = function visitCallScope(call) {
      var i = call.ancestor;
      while (i--) {
        this.write('$parent.');
      }
      this.write(call.name);
      this.writeArgs(call.args);
    };

    Unparser.prototype.visitCallFunction = function visitCallFunction(call) {
      call.func.accept(this);
      this.writeArgs(call.args);
    };

    Unparser.prototype.visitCallMember = function visitCallMember(call) {
      call.object.accept(this);
      this.write('.' + call.name);
      this.writeArgs(call.args);
    };

    Unparser.prototype.visitPrefix = function visitPrefix(prefix) {
      this.write('(' + prefix.operation);
      if (prefix.operation.charCodeAt(0) >= 97) {
        this.write(' ');
      }
      prefix.expression.accept(this);
      this.write(')');
    };

    Unparser.prototype.visitBinary = function visitBinary(binary) {
      binary.left.accept(this);
      if (binary.operation.charCodeAt(0) === 105) {
        this.write(' ' + binary.operation + ' ');
      } else {
        this.write(binary.operation);
      }
      binary.right.accept(this);
    };

    Unparser.prototype.visitLiteralPrimitive = function visitLiteralPrimitive(literal) {
      this.write('' + literal.value);
    };

    Unparser.prototype.visitLiteralArray = function visitLiteralArray(literal) {
      var elements = literal.elements;

      this.write('[');

      for (var i = 0, length = elements.length; i < length; ++i) {
        if (i !== 0) {
          this.write(',');
        }

        elements[i].accept(this);
      }

      this.write(']');
    };

    Unparser.prototype.visitLiteralObject = function visitLiteralObject(literal) {
      var keys = literal.keys;
      var values = literal.values;

      this.write('{');

      for (var i = 0, length = keys.length; i < length; ++i) {
        if (i !== 0) {
          this.write(',');
        }

        this.write('\'' + keys[i] + '\':');
        values[i].accept(this);
      }

      this.write('}');
    };

    Unparser.prototype.visitLiteralString = function visitLiteralString(literal) {
      var escaped = literal.value.replace(/'/g, "\'");
      this.write('\'' + escaped + '\'');
    };

    Unparser.prototype.visitLiteralTemplate = function visitLiteralTemplate(literal) {
      var cooked = literal.cooked,
          expressions = literal.expressions;

      var length = expressions.length;
      this.write('`');
      this.write(cooked[0]);
      for (var i = 0; i < length; i++) {
        expressions[i].accept(this);
        this.write(cooked[i + 1]);
      }
      this.write('`');
    };

    return Unparser;
  }();
}

var ExpressionCloner = exports.ExpressionCloner = function () {
  function ExpressionCloner() {
    
  }

  ExpressionCloner.prototype.cloneExpressionArray = function cloneExpressionArray(array) {
    var clonedArray = [];
    var i = array.length;
    while (i--) {
      clonedArray[i] = array[i].accept(this);
    }
    return clonedArray;
  };

  ExpressionCloner.prototype.visitBindingBehavior = function visitBindingBehavior(behavior) {
    return new BindingBehavior(behavior.expression.accept(this), behavior.name, this.cloneExpressionArray(behavior.args));
  };

  ExpressionCloner.prototype.visitValueConverter = function visitValueConverter(converter) {
    return new ValueConverter(converter.expression.accept(this), converter.name, this.cloneExpressionArray(converter.args));
  };

  ExpressionCloner.prototype.visitAssign = function visitAssign(assign) {
    return new Assign(assign.target.accept(this), assign.value.accept(this));
  };

  ExpressionCloner.prototype.visitConditional = function visitConditional(conditional) {
    return new Conditional(conditional.condition.accept(this), conditional.yes.accept(this), conditional.no.accept(this));
  };

  ExpressionCloner.prototype.visitAccessThis = function visitAccessThis(access) {
    return new AccessThis(access.ancestor);
  };

  ExpressionCloner.prototype.visitAccessScope = function visitAccessScope(access) {
    return new AccessScope(access.name, access.ancestor);
  };

  ExpressionCloner.prototype.visitAccessMember = function visitAccessMember(access) {
    return new AccessMember(access.object.accept(this), access.name);
  };

  ExpressionCloner.prototype.visitAccessKeyed = function visitAccessKeyed(access) {
    return new AccessKeyed(access.object.accept(this), access.key.accept(this));
  };

  ExpressionCloner.prototype.visitCallScope = function visitCallScope(call) {
    return new CallScope(call.name, this.cloneExpressionArray(call.args), call.ancestor);
  };

  ExpressionCloner.prototype.visitCallFunction = function visitCallFunction(call) {
    return new CallFunction(call.func.accept(this), this.cloneExpressionArray(call.args));
  };

  ExpressionCloner.prototype.visitCallMember = function visitCallMember(call) {
    return new CallMember(call.object.accept(this), call.name, this.cloneExpressionArray(call.args));
  };

  ExpressionCloner.prototype.visitUnary = function visitUnary(unary) {
    return new Unary(prefix.operation, prefix.expression.accept(this));
  };

  ExpressionCloner.prototype.visitBinary = function visitBinary(binary) {
    return new Binary(binary.operation, binary.left.accept(this), binary.right.accept(this));
  };

  ExpressionCloner.prototype.visitLiteralPrimitive = function visitLiteralPrimitive(literal) {
    return new LiteralPrimitive(literal);
  };

  ExpressionCloner.prototype.visitLiteralArray = function visitLiteralArray(literal) {
    return new LiteralArray(this.cloneExpressionArray(literal.elements));
  };

  ExpressionCloner.prototype.visitLiteralObject = function visitLiteralObject(literal) {
    return new LiteralObject(literal.keys, this.cloneExpressionArray(literal.values));
  };

  ExpressionCloner.prototype.visitLiteralString = function visitLiteralString(literal) {
    return new LiteralString(literal.value);
  };

  ExpressionCloner.prototype.visitLiteralTemplate = function visitLiteralTemplate(literal) {
    return new LiteralTemplate(literal.cooked, this.cloneExpressionArray(literal.expressions), literal.raw, literal.tag && literal.tag.accept(this));
  };

  return ExpressionCloner;
}();

function cloneExpression(expression) {
  var visitor = new ExpressionCloner();
  return expression.accept(visitor);
}

var bindingMode = exports.bindingMode = {
  oneTime: 0,
  toView: 1,
  oneWay: 1,
  twoWay: 2,
  fromView: 3
};

var Parser = exports.Parser = function () {
  function Parser() {
    

    this.cache = Object.create(null);
  }

  Parser.prototype.parse = function parse(src) {
    src = src || '';

    return this.cache[src] || (this.cache[src] = new ParserImplementation(src).parseBindingBehavior());
  };

  return Parser;
}();

var fromCharCode = String.fromCharCode;

var ParserImplementation = exports.ParserImplementation = function () {
  _createClass(ParserImplementation, [{
    key: 'raw',
    get: function get() {
      return this.src.slice(this.start, this.idx);
    }
  }]);

  function ParserImplementation(src) {
    

    this.idx = 0;

    this.start = 0;

    this.src = src;
    this.len = src.length;

    this.tkn = T$EOF;

    this.val = undefined;

    this.ch = src.charCodeAt(0);
  }

  ParserImplementation.prototype.parseBindingBehavior = function parseBindingBehavior() {
    this.nextToken();
    if (this.tkn & T$ExpressionTerminal) {
      this.err('Invalid start of expression');
    }
    var result = this.parseValueConverter();
    while (this.opt(T$Ampersand)) {
      result = new BindingBehavior(result, this.val, this.parseVariadicArgs());
    }
    if (this.tkn !== T$EOF) {
      this.err('Unconsumed token ' + this.raw);
    }
    return result;
  };

  ParserImplementation.prototype.parseValueConverter = function parseValueConverter() {
    var result = this.parseExpression();
    while (this.opt(T$Bar)) {
      result = new ValueConverter(result, this.val, this.parseVariadicArgs());
    }
    return result;
  };

  ParserImplementation.prototype.parseVariadicArgs = function parseVariadicArgs() {
    this.nextToken();
    var result = [];
    while (this.opt(T$Colon)) {
      result.push(this.parseExpression());
    }
    return result;
  };

  ParserImplementation.prototype.parseExpression = function parseExpression() {
    var exprStart = this.idx;
    var result = this.parseConditional();

    while (this.tkn === T$Eq) {
      if (!result.isAssignable) {
        this.err('Expression ' + this.src.slice(exprStart, this.start) + ' is not assignable');
      }
      this.nextToken();
      exprStart = this.idx;
      result = new Assign(result, this.parseConditional());
    }
    return result;
  };

  ParserImplementation.prototype.parseConditional = function parseConditional() {
    var result = this.parseBinary(0);

    if (this.opt(T$Question)) {
      var yes = this.parseExpression();
      this.expect(T$Colon);
      result = new Conditional(result, yes, this.parseExpression());
    }
    return result;
  };

  ParserImplementation.prototype.parseBinary = function parseBinary(minPrecedence) {
    var left = this.parseLeftHandSide(0);

    while (this.tkn & T$BinaryOp) {
      var opToken = this.tkn;
      if ((opToken & T$Precedence) <= minPrecedence) {
        break;
      }
      this.nextToken();
      left = new Binary(TokenValues[opToken & T$TokenMask], left, this.parseBinary(opToken & T$Precedence));
    }
    return left;
  };

  ParserImplementation.prototype.parseLeftHandSide = function parseLeftHandSide(context) {
    var result = void 0;

    primary: switch (this.tkn) {
      case T$Plus:
        this.nextToken();
        return this.parseLeftHandSide(0);
      case T$Minus:
        this.nextToken();
        return new Binary('-', new LiteralPrimitive(0), this.parseLeftHandSide(0));
      case T$Bang:
      case T$TypeofKeyword:
      case T$VoidKeyword:
        var op = TokenValues[this.tkn & T$TokenMask];
        this.nextToken();
        return new Unary(op, this.parseLeftHandSide(0));
      case T$ParentScope:
        {
          do {
            this.nextToken();
            context++;
            if (this.opt(T$Period)) {
              if (this.tkn === T$Period) {
                this.err();
              }
              continue;
            } else if (this.tkn & T$AccessScopeTerminal) {
              result = new AccessThis(context & C$Ancestor);

              context = context & C$ShorthandProp | C$This;
              break primary;
            } else {
              this.err();
            }
          } while (this.tkn === T$ParentScope);
        }

      case T$Identifier:
        {
          result = new AccessScope(this.val, context & C$Ancestor);
          this.nextToken();
          context = context & C$ShorthandProp | C$Scope;
          break;
        }
      case T$ThisScope:
        this.nextToken();
        result = new AccessThis(0);
        context = context & C$ShorthandProp | C$This;
        break;
      case T$LParen:
        this.nextToken();
        result = this.parseExpression();
        this.expect(T$RParen);
        context = C$Primary;
        break;
      case T$LBracket:
        {
          this.nextToken();
          var _elements = [];
          if (this.tkn !== T$RBracket) {
            do {
              _elements.push(this.parseExpression());
            } while (this.opt(T$Comma));
          }
          this.expect(T$RBracket);
          result = new LiteralArray(_elements);
          context = C$Primary;
          break;
        }
      case T$LBrace:
        {
          var keys = [];
          var values = [];
          this.nextToken();
          while (this.tkn !== T$RBrace) {
            if (this.tkn & T$IdentifierOrKeyword) {
              var ch = this.ch,
                  tkn = this.tkn,
                  idx = this.idx;

              keys.push(this.val);
              this.nextToken();
              if (this.opt(T$Colon)) {
                values.push(this.parseExpression());
              } else {
                this.ch = ch;
                this.tkn = tkn;
                this.idx = idx;
                values.push(this.parseLeftHandSide(C$ShorthandProp));
              }
            } else if (this.tkn & T$Literal) {
              keys.push(this.val);
              this.nextToken();
              this.expect(T$Colon);
              values.push(this.parseExpression());
            } else {
              this.err();
            }
            if (this.tkn !== T$RBrace) {
              this.expect(T$Comma);
            }
          }
          this.expect(T$RBrace);
          result = new LiteralObject(keys, values);
          context = C$Primary;
          break;
        }
      case T$StringLiteral:
        result = new LiteralString(this.val);
        this.nextToken();
        context = C$Primary;
        break;
      case T$TemplateTail:
        result = new LiteralTemplate([this.val]);
        this.nextToken();
        context = C$Primary;
        break;
      case T$TemplateContinuation:
        result = this.parseTemplate(0);
        context = C$Primary;
        break;
      case T$NumericLiteral:
        {
          result = new LiteralPrimitive(this.val);
          this.nextToken();

          break;
        }
      case T$NullKeyword:
      case T$UndefinedKeyword:
      case T$TrueKeyword:
      case T$FalseKeyword:
        result = new LiteralPrimitive(TokenValues[this.tkn & T$TokenMask]);
        this.nextToken();
        context = C$Primary;
        break;
      default:
        if (this.idx >= this.len) {
          this.err('Unexpected end of expression');
        } else {
          this.err();
        }
    }

    if (context & C$ShorthandProp) {
      return result;
    }

    var name = this.val;
    while (this.tkn & T$MemberOrCallExpression) {
      switch (this.tkn) {
        case T$Period:
          this.nextToken();
          if (!(this.tkn & T$IdentifierOrKeyword)) {
            this.err();
          }
          name = this.val;
          this.nextToken();

          context = context & C$Primary | (context & (C$This | C$Scope)) << 1 | context & C$Member | (context & C$Keyed) >> 1 | (context & C$Call) >> 2;
          if (this.tkn === T$LParen) {
            continue;
          }
          if (context & C$Scope) {
            result = new AccessScope(name, result.ancestor);
          } else {
            result = new AccessMember(result, name);
          }
          continue;
        case T$LBracket:
          this.nextToken();
          context = C$Keyed;
          result = new AccessKeyed(result, this.parseExpression());
          this.expect(T$RBracket);
          break;
        case T$LParen:
          this.nextToken();
          var args = [];
          while (this.tkn !== T$RParen) {
            args.push(this.parseExpression());
            if (!this.opt(T$Comma)) {
              break;
            }
          }
          this.expect(T$RParen);
          if (context & C$Scope) {
            result = new CallScope(name, args, result.ancestor);
          } else if (context & (C$Member | C$Primary)) {
            result = new CallMember(result, name, args);
          } else {
            result = new CallFunction(result, args);
          }
          context = C$Call;
          break;
        case T$TemplateTail:
          result = new LiteralTemplate([this.val], [], [this.raw], result);
          this.nextToken();
          break;
        case T$TemplateContinuation:
          result = this.parseTemplate(context | C$Tagged, result);
      }
    }

    return result;
  };

  ParserImplementation.prototype.parseTemplate = function parseTemplate(context, func) {
    var cooked = [this.val];
    var raw = context & C$Tagged ? [this.raw] : undefined;
    this.expect(T$TemplateContinuation);
    var expressions = [this.parseExpression()];

    while ((this.tkn = this.scanTemplateTail()) !== T$TemplateTail) {
      cooked.push(this.val);
      if (context & C$Tagged) {
        raw.push(this.raw);
      }
      this.expect(T$TemplateContinuation);
      expressions.push(this.parseExpression());
    }

    cooked.push(this.val);
    if (context & C$Tagged) {
      raw.push(this.raw);
    }
    this.nextToken();
    return new LiteralTemplate(cooked, expressions, raw, func);
  };

  ParserImplementation.prototype.nextToken = function nextToken() {
    while (this.idx < this.len) {
      if (this.ch <= 0x20) {
        this.next();
        continue;
      }
      this.start = this.idx;
      if (this.ch === 0x24 || this.ch >= 0x61 && this.ch <= 0x7A) {
        this.tkn = this.scanIdentifier();
        return;
      }

      if ((this.tkn = CharScanners[this.ch](this)) !== null) {
        return;
      }
    }
    this.tkn = T$EOF;
  };

  ParserImplementation.prototype.next = function next() {
    return this.ch = this.src.charCodeAt(++this.idx);
  };

  ParserImplementation.prototype.scanIdentifier = function scanIdentifier() {
    while (AsciiIdParts.has(this.next()) || this.ch > 0x7F && IdParts[this.ch]) {}

    return KeywordLookup[this.val = this.raw] || T$Identifier;
  };

  ParserImplementation.prototype.scanNumber = function scanNumber(isFloat) {
    if (isFloat) {
      this.val = 0;
    } else {
      this.val = this.ch - 0x30;
      while (this.next() <= 0x39 && this.ch >= 0x30) {
        this.val = this.val * 10 + this.ch - 0x30;
      }
    }

    if (isFloat || this.ch === 0x2E) {
      if (!isFloat) {
        this.next();
      }
      var start = this.idx;
      var value = this.ch - 0x30;
      while (this.next() <= 0x39 && this.ch >= 0x30) {
        value = value * 10 + this.ch - 0x30;
      }
      this.val = this.val + value / Math.pow(10, this.idx - start);
    }

    if (this.ch === 0x65 || this.ch === 0x45) {
      var _start = this.idx;

      this.next();
      if (this.ch === 0x2D || this.ch === 0x2B) {
        this.next();
      }

      if (!(this.ch >= 0x30 && this.ch <= 0x39)) {
        this.idx = _start;
        this.err('Invalid exponent');
      }
      while (this.next() <= 0x39 && this.ch >= 0x30) {}
      this.val = parseFloat(this.src.slice(this.start, this.idx));
    }

    return T$NumericLiteral;
  };

  ParserImplementation.prototype.scanString = function scanString() {
    var quote = this.ch;
    this.next();

    var buffer = void 0;
    var marker = this.idx;

    while (this.ch !== quote) {
      if (this.ch === 0x5C) {
        if (!buffer) {
          buffer = [];
        }

        buffer.push(this.src.slice(marker, this.idx));

        this.next();

        var _unescaped = void 0;

        if (this.ch === 0x75) {
          this.next();

          if (this.idx + 4 < this.len) {
            var hex = this.src.slice(this.idx, this.idx + 4);

            if (!/[A-Z0-9]{4}/i.test(hex)) {
              this.err('Invalid unicode escape [\\u' + hex + ']');
            }

            _unescaped = parseInt(hex, 16);
            this.idx += 4;
            this.ch = this.src.charCodeAt(this.idx);
          } else {
            this.err();
          }
        } else {
          _unescaped = unescape(this.ch);
          this.next();
        }

        buffer.push(fromCharCode(_unescaped));
        marker = this.idx;
      } else if (this.ch === 0 || this.idx >= this.len) {
        this.err('Unterminated quote');
      } else {
        this.next();
      }
    }

    var last = this.src.slice(marker, this.idx);
    this.next();
    var unescaped = last;

    if (buffer !== null && buffer !== undefined) {
      buffer.push(last);
      unescaped = buffer.join('');
    }

    this.val = unescaped;
    return T$StringLiteral;
  };

  ParserImplementation.prototype.scanTemplate = function scanTemplate() {
    var tail = true;
    var result = '';

    while (this.next() !== 0x60) {
      if (this.ch === 0x24) {
        if (this.idx + 1 < this.len && this.src.charCodeAt(this.idx + 1) === 0x7B) {
          this.idx++;
          tail = false;
          break;
        } else {
          result += '$';
        }
      } else if (this.ch === 0x5C) {
        result += fromCharCode(unescape(this.next()));
      } else if (this.ch === 0 || this.idx >= this.len) {
        this.err('Unterminated template literal');
      } else {
        result += fromCharCode(this.ch);
      }
    }

    this.next();
    this.val = result;
    if (tail) {
      return T$TemplateTail;
    }
    return T$TemplateContinuation;
  };

  ParserImplementation.prototype.scanTemplateTail = function scanTemplateTail() {
    if (this.idx >= this.len) {
      this.err('Unterminated template');
    }
    this.idx--;
    return this.scanTemplate();
  };

  ParserImplementation.prototype.err = function err() {
    var message = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'Unexpected token ' + this.raw;
    var column = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.start;

    throw new Error('Parser Error: ' + message + ' at column ' + column + ' in expression [' + this.src + ']');
  };

  ParserImplementation.prototype.opt = function opt(token) {
    if (this.tkn === token) {
      this.nextToken();
      return true;
    }

    return false;
  };

  ParserImplementation.prototype.expect = function expect(token) {
    if (this.tkn === token) {
      this.nextToken();
    } else {
      this.err('Missing expected token ' + TokenValues[token & T$TokenMask], this.idx);
    }
  };

  return ParserImplementation;
}();

function unescape(code) {
  switch (code) {
    case 0x66:
      return 0xC;
    case 0x6E:
      return 0xA;
    case 0x72:
      return 0xD;
    case 0x74:
      return 0x9;
    case 0x76:
      return 0xB;
    default:
      return code;
  }
}

var C$This = 1 << 10;
var C$Scope = 1 << 11;
var C$Member = 1 << 12;
var C$Keyed = 1 << 13;
var C$Call = 1 << 14;
var C$Primary = 1 << 15;
var C$ShorthandProp = 1 << 16;
var C$Tagged = 1 << 17;

var C$Ancestor = (1 << 9) - 1;

var T$TokenMask = (1 << 6) - 1;

var T$PrecShift = 6;

var T$Precedence = 7 << T$PrecShift;

var T$ExpressionTerminal = 1 << 11;

var T$ClosingToken = 1 << 12;

var T$OpeningToken = 1 << 13;

var T$AccessScopeTerminal = 1 << 14;
var T$Keyword = 1 << 15;
var T$EOF = 1 << 16 | T$AccessScopeTerminal | T$ExpressionTerminal;
var T$Identifier = 1 << 17;
var T$IdentifierOrKeyword = T$Identifier | T$Keyword;
var T$Literal = 1 << 18;
var T$NumericLiteral = 1 << 19 | T$Literal;
var T$StringLiteral = 1 << 20 | T$Literal;
var T$BinaryOp = 1 << 21;

var T$UnaryOp = 1 << 22;

var T$MemberExpression = 1 << 23;

var T$MemberOrCallExpression = 1 << 24;
var T$TemplateTail = 1 << 25 | T$MemberOrCallExpression;
var T$TemplateContinuation = 1 << 26 | T$MemberOrCallExpression;

var T$FalseKeyword = 0 | T$Keyword | T$Literal;
var T$TrueKeyword = 1 | T$Keyword | T$Literal;
var T$NullKeyword = 2 | T$Keyword | T$Literal;
var T$UndefinedKeyword = 3 | T$Keyword | T$Literal;
var T$ThisScope = 4 | T$IdentifierOrKeyword;
var T$ParentScope = 5 | T$IdentifierOrKeyword;

var T$LParen = 6 | T$OpeningToken | T$AccessScopeTerminal | T$MemberOrCallExpression;
var T$LBrace = 7 | T$OpeningToken;
var T$Period = 8 | T$MemberExpression | T$MemberOrCallExpression;
var T$RBrace = 9 | T$AccessScopeTerminal | T$ClosingToken | T$ExpressionTerminal;
var T$RParen = 10 | T$AccessScopeTerminal | T$ClosingToken | T$ExpressionTerminal;
var T$Comma = 11 | T$AccessScopeTerminal;
var T$LBracket = 12 | T$OpeningToken | T$AccessScopeTerminal | T$MemberExpression | T$MemberOrCallExpression;
var T$RBracket = 13 | T$ClosingToken | T$ExpressionTerminal;
var T$Colon = 14 | T$AccessScopeTerminal;
var T$Question = 15;

var T$Ampersand = 18 | T$AccessScopeTerminal;
var T$Bar = 19 | T$AccessScopeTerminal;
var T$BarBar = 20 | 1 << T$PrecShift | T$BinaryOp;
var T$AmpersandAmpersand = 21 | 2 << T$PrecShift | T$BinaryOp;
var T$Caret = 22 | 3 << T$PrecShift | T$BinaryOp;
var T$EqEq = 23 | 4 << T$PrecShift | T$BinaryOp;
var T$BangEq = 24 | 4 << T$PrecShift | T$BinaryOp;
var T$EqEqEq = 25 | 4 << T$PrecShift | T$BinaryOp;
var T$BangEqEq = 26 | 4 << T$PrecShift | T$BinaryOp;
var T$Lt = 27 | 5 << T$PrecShift | T$BinaryOp;
var T$Gt = 28 | 5 << T$PrecShift | T$BinaryOp;
var T$LtEq = 29 | 5 << T$PrecShift | T$BinaryOp;
var T$GtEq = 30 | 5 << T$PrecShift | T$BinaryOp;
var T$InKeyword = 31 | 5 << T$PrecShift | T$BinaryOp | T$Keyword;
var T$InstanceOfKeyword = 32 | 5 << T$PrecShift | T$BinaryOp | T$Keyword;
var T$Plus = 33 | 6 << T$PrecShift | T$BinaryOp | T$UnaryOp;
var T$Minus = 34 | 6 << T$PrecShift | T$BinaryOp | T$UnaryOp;
var T$TypeofKeyword = 35 | T$UnaryOp | T$Keyword;
var T$VoidKeyword = 36 | T$UnaryOp | T$Keyword;
var T$Star = 37 | 7 << T$PrecShift | T$BinaryOp;
var T$Percent = 38 | 7 << T$PrecShift | T$BinaryOp;
var T$Slash = 39 | 7 << T$PrecShift | T$BinaryOp;
var T$Eq = 40;
var T$Bang = 41 | T$UnaryOp;

var KeywordLookup = Object.create(null);
KeywordLookup.true = T$TrueKeyword;
KeywordLookup.null = T$NullKeyword;
KeywordLookup.false = T$FalseKeyword;
KeywordLookup.undefined = T$UndefinedKeyword;
KeywordLookup.$this = T$ThisScope;
KeywordLookup.$parent = T$ParentScope;
KeywordLookup.in = T$InKeyword;
KeywordLookup.instanceof = T$InstanceOfKeyword;
KeywordLookup.typeof = T$TypeofKeyword;
KeywordLookup.void = T$VoidKeyword;

var TokenValues = [false, true, null, undefined, '$this', '$parent', '(', '{', '.', '}', ')', ',', '[', ']', ':', '?', '\'', '"', '&', '|', '||', '&&', '^', '==', '!=', '===', '!==', '<', '>', '<=', '>=', 'in', 'instanceof', '+', '-', 'typeof', 'void', '*', '%', '/', '=', '!'];

var codes = {
  AsciiIdPart: [0x24, 0, 0x30, 0x3A, 0x41, 0x5B, 0x5F, 0, 0x61, 0x7B],
  IdStart: [0x24, 0, 0x41, 0x5B, 0x5F, 0, 0x61, 0x7B, 0xAA, 0, 0xBA, 0, 0xC0, 0xD7, 0xD8, 0xF7, 0xF8, 0x2B9, 0x2E0, 0x2E5, 0x1D00, 0x1D26, 0x1D2C, 0x1D5D, 0x1D62, 0x1D66, 0x1D6B, 0x1D78, 0x1D79, 0x1DBF, 0x1E00, 0x1F00, 0x2071, 0, 0x207F, 0, 0x2090, 0x209D, 0x212A, 0x212C, 0x2132, 0, 0x214E, 0, 0x2160, 0x2189, 0x2C60, 0x2C80, 0xA722, 0xA788, 0xA78B, 0xA7AF, 0xA7B0, 0xA7B8, 0xA7F7, 0xA800, 0xAB30, 0xAB5B, 0xAB5C, 0xAB65, 0xFB00, 0xFB07, 0xFF21, 0xFF3B, 0xFF41, 0xFF5B],
  Digit: [0x30, 0x3A],
  Skip: [0, 0x21, 0x7F, 0xA1]
};

function decompress(lookup, set, compressed, value) {
  var rangeCount = compressed.length;
  for (var i = 0; i < rangeCount; i += 2) {
    var start = compressed[i];
    var end = compressed[i + 1];
    end = end > 0 ? end : start + 1;
    if (lookup) {
      var j = start;
      while (j < end) {
        lookup[j] = value;
        j++;
      }
    }
    if (set) {
      for (var ch = start; ch < end; ch++) {
        set.add(ch);
      }
    }
  }
}

function returnToken(token) {
  return function (p) {
    p.next();
    return token;
  };
}
function unexpectedCharacter(p) {
  p.err('Unexpected character [' + fromCharCode(p.ch) + ']');
  return null;
}

var AsciiIdParts = new Set();
decompress(null, AsciiIdParts, codes.AsciiIdPart, true);

var IdParts = new Uint8Array(0xFFFF);
decompress(IdParts, null, codes.IdStart, 1);
decompress(IdParts, null, codes.Digit, 1);

var CharScanners = new Array(0xFFFF);
var ci = 0;
while (ci < 0xFFFF) {
  CharScanners[ci] = unexpectedCharacter;
  ci++;
}

decompress(CharScanners, null, codes.Skip, function (p) {
  p.next();
  return null;
});
decompress(CharScanners, null, codes.IdStart, function (p) {
  return p.scanIdentifier();
});
decompress(CharScanners, null, codes.Digit, function (p) {
  return p.scanNumber(false);
});

CharScanners[0x22] = CharScanners[0x27] = function (p) {
  return p.scanString();
};
CharScanners[0x60] = function (p) {
  return p.scanTemplate();
};

CharScanners[0x21] = function (p) {
  if (p.next() !== 0x3D) {
    return T$Bang;
  }
  if (p.next() !== 0x3D) {
    return T$BangEq;
  }
  p.next();
  return T$BangEqEq;
};

CharScanners[0x3D] = function (p) {
  if (p.next() !== 0x3D) {
    return T$Eq;
  }
  if (p.next() !== 0x3D) {
    return T$EqEq;
  }
  p.next();
  return T$EqEqEq;
};

CharScanners[0x26] = function (p) {
  if (p.next() !== 0x26) {
    return T$Ampersand;
  }
  p.next();
  return T$AmpersandAmpersand;
};

CharScanners[0x7C] = function (p) {
  if (p.next() !== 0x7C) {
    return T$Bar;
  }
  p.next();
  return T$BarBar;
};

CharScanners[0x2E] = function (p) {
  if (p.next() <= 0x39 && p.ch >= 0x30) {
    return p.scanNumber(true);
  }
  return T$Period;
};

CharScanners[0x3C] = function (p) {
  if (p.next() !== 0x3D) {
    return T$Lt;
  }
  p.next();
  return T$LtEq;
};

CharScanners[0x3E] = function (p) {
  if (p.next() !== 0x3D) {
    return T$Gt;
  }
  p.next();
  return T$GtEq;
};

CharScanners[0x25] = returnToken(T$Percent);
CharScanners[0x28] = returnToken(T$LParen);
CharScanners[0x29] = returnToken(T$RParen);
CharScanners[0x2A] = returnToken(T$Star);
CharScanners[0x2B] = returnToken(T$Plus);
CharScanners[0x2C] = returnToken(T$Comma);
CharScanners[0x2D] = returnToken(T$Minus);
CharScanners[0x2F] = returnToken(T$Slash);
CharScanners[0x3A] = returnToken(T$Colon);
CharScanners[0x3F] = returnToken(T$Question);
CharScanners[0x5B] = returnToken(T$LBracket);
CharScanners[0x5D] = returnToken(T$RBracket);
CharScanners[0x5E] = returnToken(T$Caret);
CharScanners[0x7B] = returnToken(T$LBrace);
CharScanners[0x7D] = returnToken(T$RBrace);

var mapProto = Map.prototype;

function _getMapObserver(taskQueue, map) {
  return ModifyMapObserver.for(taskQueue, map);
}

exports.getMapObserver = _getMapObserver;

var ModifyMapObserver = function (_ModifyCollectionObse2) {
  _inherits(ModifyMapObserver, _ModifyCollectionObse2);

  function ModifyMapObserver(taskQueue, map) {
    

    return _possibleConstructorReturn(this, _ModifyCollectionObse2.call(this, taskQueue, map));
  }

  ModifyMapObserver.for = function _for(taskQueue, map) {
    if (!('__map_observer__' in map)) {
      Reflect.defineProperty(map, '__map_observer__', {
        value: ModifyMapObserver.create(taskQueue, map),
        enumerable: false, configurable: false
      });
    }
    return map.__map_observer__;
  };

  ModifyMapObserver.create = function create(taskQueue, map) {
    var observer = new ModifyMapObserver(taskQueue, map);

    var proto = mapProto;
    if (proto.set !== map.set || proto.delete !== map.delete || proto.clear !== map.clear) {
      proto = {
        set: map.set,
        delete: map.delete,
        clear: map.clear
      };
    }

    map.set = function () {
      var hasValue = map.has(arguments[0]);
      var type = hasValue ? 'update' : 'add';
      var oldValue = map.get(arguments[0]);
      var methodCallResult = proto.set.apply(map, arguments);
      if (!hasValue || oldValue !== map.get(arguments[0])) {
        observer.addChangeRecord({
          type: type,
          object: map,
          key: arguments[0],
          oldValue: oldValue
        });
      }
      return methodCallResult;
    };

    map.delete = function () {
      var hasValue = map.has(arguments[0]);
      var oldValue = map.get(arguments[0]);
      var methodCallResult = proto.delete.apply(map, arguments);
      if (hasValue) {
        observer.addChangeRecord({
          type: 'delete',
          object: map,
          key: arguments[0],
          oldValue: oldValue
        });
      }
      return methodCallResult;
    };

    map.clear = function () {
      var methodCallResult = proto.clear.apply(map, arguments);
      observer.addChangeRecord({
        type: 'clear',
        object: map
      });
      return methodCallResult;
    };

    return observer;
  };

  return ModifyMapObserver;
}(ModifyCollectionObserver);

var emLogger = LogManager.getLogger('event-manager');

function findOriginalEventTarget(event) {
  return event.composedPath && event.composedPath()[0] || event.deepPath && event.deepPath()[0] || event.path && event.path[0] || event.target;
}

function stopPropagation() {
  this.standardStopPropagation();
  this.propagationStopped = true;
}

function handleCapturedEvent(event) {
  event.propagationStopped = false;
  var target = findOriginalEventTarget(event);

  var orderedCallbacks = [];

  while (target) {
    if (target.capturedCallbacks) {
      var callback = target.capturedCallbacks[event.type];
      if (callback) {
        if (event.stopPropagation !== stopPropagation) {
          event.standardStopPropagation = event.stopPropagation;
          event.stopPropagation = stopPropagation;
        }
        orderedCallbacks.push(callback);
      }
    }
    target = target.parentNode;
  }
  for (var i = orderedCallbacks.length - 1; i >= 0 && !event.propagationStopped; i--) {
    var orderedCallback = orderedCallbacks[i];
    if ('handleEvent' in orderedCallback) {
      orderedCallback.handleEvent(event);
    } else {
      orderedCallback(event);
    }
  }
}

var CapturedHandlerEntry = function () {
  function CapturedHandlerEntry(eventName) {
    

    this.eventName = eventName;
    this.count = 0;
  }

  CapturedHandlerEntry.prototype.increment = function increment() {
    this.count++;

    if (this.count === 1) {
      _aureliaPal.DOM.addEventListener(this.eventName, handleCapturedEvent, true);
    }
  };

  CapturedHandlerEntry.prototype.decrement = function decrement() {
    if (this.count === 0) {
      emLogger.warn('The same EventListener was disposed multiple times.');
    } else if (--this.count === 0) {
      _aureliaPal.DOM.removeEventListener(this.eventName, handleCapturedEvent, true);
    }
  };

  return CapturedHandlerEntry;
}();

var DelegateHandlerEntry = function () {
  function DelegateHandlerEntry(eventName, eventManager) {
    

    this.eventName = eventName;
    this.count = 0;
    this.eventManager = eventManager;
  }

  DelegateHandlerEntry.prototype.handleEvent = function handleEvent(event) {
    event.propagationStopped = false;
    var target = findOriginalEventTarget(event);

    while (target && !event.propagationStopped) {
      if (target.delegatedCallbacks) {
        var callback = target.delegatedCallbacks[event.type];
        if (callback) {
          if (event.stopPropagation !== stopPropagation) {
            event.standardStopPropagation = event.stopPropagation;
            event.stopPropagation = stopPropagation;
          }
          if ('handleEvent' in callback) {
            callback.handleEvent(event);
          } else {
            callback(event);
          }
        }
      }

      var parent = target.parentNode;
      var shouldEscapeShadowRoot = this.eventManager.escapeShadowRoot && parent instanceof ShadowRoot;

      target = shouldEscapeShadowRoot ? parent.host : parent;
    }
  };

  DelegateHandlerEntry.prototype.increment = function increment() {
    this.count++;

    if (this.count === 1) {
      _aureliaPal.DOM.addEventListener(this.eventName, this, false);
    }
  };

  DelegateHandlerEntry.prototype.decrement = function decrement() {
    if (this.count === 0) {
      emLogger.warn('The same EventListener was disposed multiple times.');
    } else if (--this.count === 0) {
      _aureliaPal.DOM.removeEventListener(this.eventName, this, false);
    }
  };

  return DelegateHandlerEntry;
}();

var DelegationEntryHandler = function () {
  function DelegationEntryHandler(entry, lookup, targetEvent) {
    

    this.entry = entry;
    this.lookup = lookup;
    this.targetEvent = targetEvent;
  }

  DelegationEntryHandler.prototype.dispose = function dispose() {
    if (this.lookup[this.targetEvent]) {
      this.entry.decrement();
      this.lookup[this.targetEvent] = null;
    } else {
      emLogger.warn('Calling .dispose() on already disposed eventListener');
    }
  };

  return DelegationEntryHandler;
}();

var EventHandler = function () {
  function EventHandler(target, targetEvent, callback) {
    

    this.target = target;
    this.targetEvent = targetEvent;
    this.callback = callback;
  }

  EventHandler.prototype.dispose = function dispose() {
    this.target.removeEventListener(this.targetEvent, this.callback);
  };

  return EventHandler;
}();

var DefaultEventStrategy = function () {
  function DefaultEventStrategy(eventManager) {
    

    this.delegatedHandlers = {};
    this.capturedHandlers = {};

    this.eventManager = eventManager;
  }

  DefaultEventStrategy.prototype.subscribe = function subscribe(target, targetEvent, callback, strategy, disposable) {
    var delegatedHandlers = void 0;
    var capturedHandlers = void 0;
    var handlerEntry = void 0;

    if (strategy === delegationStrategy.bubbling) {
      delegatedHandlers = this.delegatedHandlers;
      handlerEntry = delegatedHandlers[targetEvent] || (delegatedHandlers[targetEvent] = new DelegateHandlerEntry(targetEvent, this.eventManager));
      var delegatedCallbacks = target.delegatedCallbacks || (target.delegatedCallbacks = {});
      if (!delegatedCallbacks[targetEvent]) {
        handlerEntry.increment();
      } else {
        emLogger.warn('Overriding previous callback for event listener', { event: targetEvent, callback: callback, previousCallback: delegatedCallbacks[targetEvent] });
      }
      delegatedCallbacks[targetEvent] = callback;

      if (disposable === true) {
        return new DelegationEntryHandler(handlerEntry, delegatedCallbacks, targetEvent);
      }

      return function () {
        handlerEntry.decrement();
        delegatedCallbacks[targetEvent] = null;
      };
    }
    if (strategy === delegationStrategy.capturing) {
      capturedHandlers = this.capturedHandlers;
      handlerEntry = capturedHandlers[targetEvent] || (capturedHandlers[targetEvent] = new CapturedHandlerEntry(targetEvent));
      var capturedCallbacks = target.capturedCallbacks || (target.capturedCallbacks = {});
      if (!capturedCallbacks[targetEvent]) {
        handlerEntry.increment();
      } else {
        emLogger.error('already have a callback for event', { event: targetEvent, callback: callback });
      }
      capturedCallbacks[targetEvent] = callback;

      if (disposable === true) {
        return new DelegationEntryHandler(handlerEntry, capturedCallbacks, targetEvent);
      }

      return function () {
        handlerEntry.decrement();
        capturedCallbacks[targetEvent] = null;
      };
    }

    target.addEventListener(targetEvent, callback);

    if (disposable === true) {
      return new EventHandler(target, targetEvent, callback);
    }

    return function () {
      target.removeEventListener(targetEvent, callback);
    };
  };

  return DefaultEventStrategy;
}();

var delegationStrategy = exports.delegationStrategy = {
  none: 0,
  capturing: 1,
  bubbling: 2
};

var EventManager = exports.EventManager = function () {
  function EventManager() {
    var escapeShadowRoot = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

    

    this.elementHandlerLookup = {};
    this.eventStrategyLookup = {};
    this.escapeShadowRoot = escapeShadowRoot;

    this.registerElementConfig({
      tagName: 'input',
      properties: {
        value: ['change', 'input'],
        checked: ['change', 'input'],
        files: ['change', 'input']
      }
    });

    this.registerElementConfig({
      tagName: 'textarea',
      properties: {
        value: ['change', 'input']
      }
    });

    this.registerElementConfig({
      tagName: 'select',
      properties: {
        value: ['change']
      }
    });

    this.registerElementConfig({
      tagName: 'content editable',
      properties: {
        value: ['change', 'input', 'blur', 'keyup', 'paste']
      }
    });

    this.registerElementConfig({
      tagName: 'scrollable element',
      properties: {
        scrollTop: ['scroll'],
        scrollLeft: ['scroll']
      }
    });

    this.defaultEventStrategy = new DefaultEventStrategy(this);
  }

  EventManager.prototype.registerElementConfig = function registerElementConfig(config) {
    var tagName = config.tagName.toLowerCase();
    var properties = config.properties;
    var propertyName = void 0;

    var lookup = this.elementHandlerLookup[tagName] = {};

    for (propertyName in properties) {
      if (properties.hasOwnProperty(propertyName)) {
        lookup[propertyName] = properties[propertyName];
      }
    }
  };

  EventManager.prototype.registerEventStrategy = function registerEventStrategy(eventName, strategy) {
    this.eventStrategyLookup[eventName] = strategy;
  };

  EventManager.prototype.getElementHandler = function getElementHandler(target, propertyName) {
    var tagName = void 0;
    var lookup = this.elementHandlerLookup;

    if (target.tagName) {
      tagName = target.tagName.toLowerCase();

      if (lookup[tagName] && lookup[tagName][propertyName]) {
        return new EventSubscriber(lookup[tagName][propertyName]);
      }

      if (propertyName === 'textContent' || propertyName === 'innerHTML') {
        return new EventSubscriber(lookup['content editable'].value);
      }

      if (propertyName === 'scrollTop' || propertyName === 'scrollLeft') {
        return new EventSubscriber(lookup['scrollable element'][propertyName]);
      }
    }

    return null;
  };

  EventManager.prototype.addEventListener = function addEventListener(target, targetEvent, callbackOrListener, delegate, disposable) {
    return (this.eventStrategyLookup[targetEvent] || this.defaultEventStrategy).subscribe(target, targetEvent, callbackOrListener, delegate, disposable);
  };

  return EventManager;
}();

var EventSubscriber = exports.EventSubscriber = function () {
  function EventSubscriber(events) {
    

    this.events = events;
    this.element = null;
    this.handler = null;
  }

  EventSubscriber.prototype.subscribe = function subscribe(element, callbackOrListener) {
    this.element = element;
    this.handler = callbackOrListener;

    var events = this.events;
    for (var i = 0, ii = events.length; ii > i; ++i) {
      element.addEventListener(events[i], callbackOrListener);
    }
  };

  EventSubscriber.prototype.dispose = function dispose() {
    if (this.element === null) {
      return;
    }
    var element = this.element;
    var callbackOrListener = this.handler;
    var events = this.events;
    for (var i = 0, ii = events.length; ii > i; ++i) {
      element.removeEventListener(events[i], callbackOrListener);
    }
    this.element = this.handler = null;
  };

  return EventSubscriber;
}();

var DirtyChecker = exports.DirtyChecker = function () {
  function DirtyChecker() {
    

    this.tracked = [];
    this.checkDelay = 120;
  }

  DirtyChecker.prototype.addProperty = function addProperty(property) {
    var tracked = this.tracked;

    tracked.push(property);

    if (tracked.length === 1) {
      this.scheduleDirtyCheck();
    }
  };

  DirtyChecker.prototype.removeProperty = function removeProperty(property) {
    var tracked = this.tracked;
    tracked.splice(tracked.indexOf(property), 1);
  };

  DirtyChecker.prototype.scheduleDirtyCheck = function scheduleDirtyCheck() {
    var _this22 = this;

    setTimeout(function () {
      return _this22.check();
    }, this.checkDelay);
  };

  DirtyChecker.prototype.check = function check() {
    var tracked = this.tracked;
    var i = tracked.length;

    while (i--) {
      var current = tracked[i];

      if (current.isDirty()) {
        current.call();
      }
    }

    if (tracked.length) {
      this.scheduleDirtyCheck();
    }
  };

  return DirtyChecker;
}();

var DirtyCheckProperty = exports.DirtyCheckProperty = (_dec5 = subscriberCollection(), _dec5(_class5 = function () {
  function DirtyCheckProperty(dirtyChecker, obj, propertyName) {
    

    this.dirtyChecker = dirtyChecker;
    this.obj = obj;
    this.propertyName = propertyName;
  }

  DirtyCheckProperty.prototype.getValue = function getValue() {
    return this.obj[this.propertyName];
  };

  DirtyCheckProperty.prototype.setValue = function setValue(newValue) {
    this.obj[this.propertyName] = newValue;
  };

  DirtyCheckProperty.prototype.call = function call() {
    var oldValue = this.oldValue;
    var newValue = this.getValue();

    this.callSubscribers(newValue, oldValue);

    this.oldValue = newValue;
  };

  DirtyCheckProperty.prototype.isDirty = function isDirty() {
    return this.oldValue !== this.obj[this.propertyName];
  };

  DirtyCheckProperty.prototype.subscribe = function subscribe(context, callable) {
    if (!this.hasSubscribers()) {
      this.oldValue = this.getValue();
      this.dirtyChecker.addProperty(this);
    }
    this.addSubscriber(context, callable);
  };

  DirtyCheckProperty.prototype.unsubscribe = function unsubscribe(context, callable) {
    if (this.removeSubscriber(context, callable) && !this.hasSubscribers()) {
      this.dirtyChecker.removeProperty(this);
    }
  };

  return DirtyCheckProperty;
}()) || _class5);


var logger = LogManager.getLogger('property-observation');

var propertyAccessor = exports.propertyAccessor = {
  getValue: function getValue(obj, propertyName) {
    return obj[propertyName];
  },
  setValue: function setValue(value, obj, propertyName) {
    obj[propertyName] = value;
  }
};

var PrimitiveObserver = exports.PrimitiveObserver = function () {
  function PrimitiveObserver(primitive, propertyName) {
    

    this.doNotCache = true;

    this.primitive = primitive;
    this.propertyName = propertyName;
  }

  PrimitiveObserver.prototype.getValue = function getValue() {
    return this.primitive[this.propertyName];
  };

  PrimitiveObserver.prototype.setValue = function setValue() {
    var type = _typeof(this.primitive);
    throw new Error('The ' + this.propertyName + ' property of a ' + type + ' (' + this.primitive + ') cannot be assigned.');
  };

  PrimitiveObserver.prototype.subscribe = function subscribe() {};

  PrimitiveObserver.prototype.unsubscribe = function unsubscribe() {};

  return PrimitiveObserver;
}();

var SetterObserver = exports.SetterObserver = (_dec6 = subscriberCollection(), _dec6(_class7 = function () {
  function SetterObserver(taskQueue, obj, propertyName) {
    

    this.taskQueue = taskQueue;
    this.obj = obj;
    this.propertyName = propertyName;
    this.queued = false;
    this.observing = false;
  }

  SetterObserver.prototype.getValue = function getValue() {
    return this.obj[this.propertyName];
  };

  SetterObserver.prototype.setValue = function setValue(newValue) {
    this.obj[this.propertyName] = newValue;
  };

  SetterObserver.prototype.getterValue = function getterValue() {
    return this.currentValue;
  };

  SetterObserver.prototype.setterValue = function setterValue(newValue) {
    var oldValue = this.currentValue;

    if (oldValue !== newValue) {
      if (!this.queued) {
        this.oldValue = oldValue;
        this.queued = true;
        this.taskQueue.queueMicroTask(this);
      }

      this.currentValue = newValue;
    }
  };

  SetterObserver.prototype.call = function call() {
    var oldValue = this.oldValue;
    var newValue = this.oldValue = this.currentValue;

    this.queued = false;

    this.callSubscribers(newValue, oldValue);
  };

  SetterObserver.prototype.subscribe = function subscribe(context, callable) {
    if (!this.observing) {
      this.convertProperty();
    }
    this.addSubscriber(context, callable);
  };

  SetterObserver.prototype.unsubscribe = function unsubscribe(context, callable) {
    this.removeSubscriber(context, callable);
  };

  SetterObserver.prototype.convertProperty = function convertProperty() {
    this.observing = true;
    this.currentValue = this.obj[this.propertyName];
    this.setValue = this.setterValue;
    this.getValue = this.getterValue;

    if (!Reflect.defineProperty(this.obj, this.propertyName, {
      configurable: true,
      enumerable: this.propertyName in this.obj ? this.obj.propertyIsEnumerable(this.propertyName) : true,
      get: this.getValue.bind(this),
      set: this.setValue.bind(this)
    })) {
      logger.warn('Cannot observe property \'' + this.propertyName + '\' of object', this.obj);
    }
  };

  return SetterObserver;
}()) || _class7);

var XLinkAttributeObserver = exports.XLinkAttributeObserver = function () {
  function XLinkAttributeObserver(element, propertyName, attributeName) {
    

    this.element = element;
    this.propertyName = propertyName;
    this.attributeName = attributeName;
  }

  XLinkAttributeObserver.prototype.getValue = function getValue() {
    return this.element.getAttributeNS('http://www.w3.org/1999/xlink', this.attributeName);
  };

  XLinkAttributeObserver.prototype.setValue = function setValue(newValue) {
    return this.element.setAttributeNS('http://www.w3.org/1999/xlink', this.attributeName, newValue);
  };

  XLinkAttributeObserver.prototype.subscribe = function subscribe() {
    throw new Error('Observation of a "' + this.element.nodeName + '" element\'s "' + this.propertyName + '" property is not supported.');
  };

  return XLinkAttributeObserver;
}();

var dataAttributeAccessor = exports.dataAttributeAccessor = {
  getValue: function getValue(obj, propertyName) {
    return obj.getAttribute(propertyName);
  },
  setValue: function setValue(value, obj, propertyName) {
    if (value === null || value === undefined) {
      obj.removeAttribute(propertyName);
    } else {
      obj.setAttribute(propertyName, value);
    }
  }
};

var DataAttributeObserver = exports.DataAttributeObserver = function () {
  function DataAttributeObserver(element, propertyName) {
    

    this.element = element;
    this.propertyName = propertyName;
  }

  DataAttributeObserver.prototype.getValue = function getValue() {
    return this.element.getAttribute(this.propertyName);
  };

  DataAttributeObserver.prototype.setValue = function setValue(newValue) {
    if (newValue === null || newValue === undefined) {
      return this.element.removeAttribute(this.propertyName);
    }
    return this.element.setAttribute(this.propertyName, newValue);
  };

  DataAttributeObserver.prototype.subscribe = function subscribe() {
    throw new Error('Observation of a "' + this.element.nodeName + '" element\'s "' + this.propertyName + '" property is not supported.');
  };

  return DataAttributeObserver;
}();

var StyleObserver = exports.StyleObserver = function () {
  function StyleObserver(element, propertyName) {
    

    this.element = element;
    this.propertyName = propertyName;

    this.styles = null;
    this.version = 0;
  }

  StyleObserver.prototype.getValue = function getValue() {
    return this.element.style.cssText;
  };

  StyleObserver.prototype._setProperty = function _setProperty(style, value) {
    var priority = '';

    if (value !== null && value !== undefined && typeof value.indexOf === 'function' && value.indexOf('!important') !== -1) {
      priority = 'important';
      value = value.replace('!important', '');
    }
    this.element.style.setProperty(style, value, priority);
  };

  StyleObserver.prototype.setValue = function setValue(newValue) {
    var styles = this.styles || {};
    var style = void 0;
    var version = this.version;

    if (newValue !== null && newValue !== undefined) {
      if (newValue instanceof Object) {
        var value = void 0;
        for (style in newValue) {
          if (newValue.hasOwnProperty(style)) {
            value = newValue[style];
            style = style.replace(/([A-Z])/g, function (m) {
              return '-' + m.toLowerCase();
            });
            styles[style] = version;
            this._setProperty(style, value);
          }
        }
      } else if (newValue.length) {
        var rx = /\s*([\w\-]+)\s*:\s*((?:(?:[\w\-]+\(\s*(?:"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[\w\-]+\(\s*(?:^"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\)]*)\),?|[^\)]*)\),?|"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^;]*),?\s*)+);?/g;
        var pair = void 0;
        while ((pair = rx.exec(newValue)) !== null) {
          style = pair[1];
          if (!style) {
            continue;
          }

          styles[style] = version;
          this._setProperty(style, pair[2]);
        }
      }
    }

    this.styles = styles;
    this.version += 1;

    if (version === 0) {
      return;
    }

    version -= 1;
    for (style in styles) {
      if (!styles.hasOwnProperty(style) || styles[style] !== version) {
        continue;
      }

      this.element.style.removeProperty(style);
    }
  };

  StyleObserver.prototype.subscribe = function subscribe() {
    throw new Error('Observation of a "' + this.element.nodeName + '" element\'s "' + this.propertyName + '" property is not supported.');
  };

  return StyleObserver;
}();

var ValueAttributeObserver = exports.ValueAttributeObserver = (_dec7 = subscriberCollection(), _dec7(_class8 = function () {
  function ValueAttributeObserver(element, propertyName, handler) {
    

    this.element = element;
    this.propertyName = propertyName;
    this.handler = handler;
    if (propertyName === 'files') {
      this.setValue = function () {};
    }
  }

  ValueAttributeObserver.prototype.getValue = function getValue() {
    return this.element[this.propertyName];
  };

  ValueAttributeObserver.prototype.setValue = function setValue(newValue) {
    newValue = newValue === undefined || newValue === null ? '' : newValue;
    if (this.element[this.propertyName] !== newValue) {
      this.element[this.propertyName] = newValue;
      this.notify();
    }
  };

  ValueAttributeObserver.prototype.notify = function notify() {
    var oldValue = this.oldValue;
    var newValue = this.getValue();

    this.callSubscribers(newValue, oldValue);

    this.oldValue = newValue;
  };

  ValueAttributeObserver.prototype.handleEvent = function handleEvent() {
    this.notify();
  };

  ValueAttributeObserver.prototype.subscribe = function subscribe(context, callable) {
    if (!this.hasSubscribers()) {
      this.oldValue = this.getValue();
      this.handler.subscribe(this.element, this);
    }

    this.addSubscriber(context, callable);
  };

  ValueAttributeObserver.prototype.unsubscribe = function unsubscribe(context, callable) {
    if (this.removeSubscriber(context, callable) && !this.hasSubscribers()) {
      this.handler.dispose();
    }
  };

  return ValueAttributeObserver;
}()) || _class8);


var checkedArrayContext = 'CheckedObserver:array';
var checkedValueContext = 'CheckedObserver:value';

var CheckedObserver = exports.CheckedObserver = (_dec8 = subscriberCollection(), _dec8(_class9 = function () {
  function CheckedObserver(element, handler, observerLocator) {
    

    this.element = element;
    this.handler = handler;
    this.observerLocator = observerLocator;
  }

  CheckedObserver.prototype.getValue = function getValue() {
    return this.value;
  };

  CheckedObserver.prototype.setValue = function setValue(newValue) {
    if (this.initialSync && this.value === newValue) {
      return;
    }

    if (this.arrayObserver) {
      this.arrayObserver.unsubscribe(checkedArrayContext, this);
      this.arrayObserver = null;
    }

    if (this.element.type === 'checkbox' && Array.isArray(newValue)) {
      this.arrayObserver = this.observerLocator.getArrayObserver(newValue);
      this.arrayObserver.subscribe(checkedArrayContext, this);
    }

    this.oldValue = this.value;
    this.value = newValue;
    this.synchronizeElement();
    this.notify();

    if (!this.initialSync) {
      this.initialSync = true;
      this.observerLocator.taskQueue.queueMicroTask(this);
    }
  };

  CheckedObserver.prototype.call = function call(context, splices) {
    this.synchronizeElement();

    if (!this.valueObserver) {
      this.valueObserver = this.element.__observers__.model || this.element.__observers__.value;
      if (this.valueObserver) {
        this.valueObserver.subscribe(checkedValueContext, this);
      }
    }
  };

  CheckedObserver.prototype.synchronizeElement = function synchronizeElement() {
    var value = this.value;
    var element = this.element;
    var elementValue = element.hasOwnProperty('model') ? element.model : element.value;
    var isRadio = element.type === 'radio';
    var matcher = element.matcher || function (a, b) {
      return a === b;
    };

    element.checked = isRadio && !!matcher(value, elementValue) || !isRadio && value === true || !isRadio && Array.isArray(value) && value.findIndex(function (item) {
      return !!matcher(item, elementValue);
    }) !== -1;
  };

  CheckedObserver.prototype.synchronizeValue = function synchronizeValue() {
    var value = this.value;
    var element = this.element;
    var elementValue = element.hasOwnProperty('model') ? element.model : element.value;
    var index = void 0;
    var matcher = element.matcher || function (a, b) {
      return a === b;
    };

    if (element.type === 'checkbox') {
      if (Array.isArray(value)) {
        index = value.findIndex(function (item) {
          return !!matcher(item, elementValue);
        });
        if (element.checked && index === -1) {
          value.push(elementValue);
        } else if (!element.checked && index !== -1) {
          value.splice(index, 1);
        }

        return;
      }

      value = element.checked;
    } else if (element.checked) {
      value = elementValue;
    } else {
      return;
    }

    this.oldValue = this.value;
    this.value = value;
    this.notify();
  };

  CheckedObserver.prototype.notify = function notify() {
    var oldValue = this.oldValue;
    var newValue = this.value;

    if (newValue === oldValue) {
      return;
    }

    this.callSubscribers(newValue, oldValue);
  };

  CheckedObserver.prototype.handleEvent = function handleEvent() {
    this.synchronizeValue();
  };

  CheckedObserver.prototype.subscribe = function subscribe(context, callable) {
    if (!this.hasSubscribers()) {
      this.handler.subscribe(this.element, this);
    }
    this.addSubscriber(context, callable);
  };

  CheckedObserver.prototype.unsubscribe = function unsubscribe(context, callable) {
    if (this.removeSubscriber(context, callable) && !this.hasSubscribers()) {
      this.handler.dispose();
    }
  };

  CheckedObserver.prototype.unbind = function unbind() {
    if (this.arrayObserver) {
      this.arrayObserver.unsubscribe(checkedArrayContext, this);
      this.arrayObserver = null;
    }
    if (this.valueObserver) {
      this.valueObserver.unsubscribe(checkedValueContext, this);
    }
  };

  return CheckedObserver;
}()) || _class9);


var selectArrayContext = 'SelectValueObserver:array';

var SelectValueObserver = exports.SelectValueObserver = (_dec9 = subscriberCollection(), _dec9(_class10 = function () {
  function SelectValueObserver(element, handler, observerLocator) {
    

    this.element = element;
    this.handler = handler;
    this.observerLocator = observerLocator;
  }

  SelectValueObserver.prototype.getValue = function getValue() {
    return this.value;
  };

  SelectValueObserver.prototype.setValue = function setValue(newValue) {
    if (newValue !== null && newValue !== undefined && this.element.multiple && !Array.isArray(newValue)) {
      throw new Error('Only null or Array instances can be bound to a multi-select.');
    }
    if (this.value === newValue) {
      return;
    }

    if (this.arrayObserver) {
      this.arrayObserver.unsubscribe(selectArrayContext, this);
      this.arrayObserver = null;
    }

    if (Array.isArray(newValue)) {
      this.arrayObserver = this.observerLocator.getArrayObserver(newValue);
      this.arrayObserver.subscribe(selectArrayContext, this);
    }

    this.oldValue = this.value;
    this.value = newValue;
    this.synchronizeOptions();
    this.notify();

    if (!this.initialSync) {
      this.initialSync = true;
      this.observerLocator.taskQueue.queueMicroTask(this);
    }
  };

  SelectValueObserver.prototype.call = function call(context, splices) {
    this.synchronizeOptions();
  };

  SelectValueObserver.prototype.synchronizeOptions = function synchronizeOptions() {
    var value = this.value;
    var isArray = void 0;

    if (Array.isArray(value)) {
      isArray = true;
    }

    var options = this.element.options;
    var i = options.length;
    var matcher = this.element.matcher || function (a, b) {
      return a === b;
    };

    var _loop = function _loop() {
      var option = options.item(i);
      var optionValue = option.hasOwnProperty('model') ? option.model : option.value;
      if (isArray) {
        option.selected = value.findIndex(function (item) {
          return !!matcher(optionValue, item);
        }) !== -1;
        return 'continue';
      }
      option.selected = !!matcher(optionValue, value);
    };

    while (i--) {
      var _ret = _loop();

      if (_ret === 'continue') continue;
    }
  };

  SelectValueObserver.prototype.synchronizeValue = function synchronizeValue() {
    var _this23 = this;

    var options = this.element.options;
    var count = 0;
    var value = [];

    for (var i = 0, ii = options.length; i < ii; i++) {
      var _option = options.item(i);
      if (!_option.selected) {
        continue;
      }
      value.push(_option.hasOwnProperty('model') ? _option.model : _option.value);
      count++;
    }

    if (this.element.multiple) {
      if (Array.isArray(this.value)) {
        var _ret2 = function () {
          var matcher = _this23.element.matcher || function (a, b) {
            return a === b;
          };

          var i = 0;

          var _loop2 = function _loop2() {
            var a = _this23.value[i];
            if (value.findIndex(function (b) {
              return matcher(a, b);
            }) === -1) {
              _this23.value.splice(i, 1);
            } else {
              i++;
            }
          };

          while (i < _this23.value.length) {
            _loop2();
          }

          i = 0;

          var _loop3 = function _loop3() {
            var a = value[i];
            if (_this23.value.findIndex(function (b) {
              return matcher(a, b);
            }) === -1) {
              _this23.value.push(a);
            }
            i++;
          };

          while (i < value.length) {
            _loop3();
          }
          return {
            v: void 0
          };
        }();

        if ((typeof _ret2 === 'undefined' ? 'undefined' : _typeof(_ret2)) === "object") return _ret2.v;
      }
    } else {
      if (count === 0) {
        value = null;
      } else {
        value = value[0];
      }
    }

    if (value !== this.value) {
      this.oldValue = this.value;
      this.value = value;
      this.notify();
    }
  };

  SelectValueObserver.prototype.notify = function notify() {
    var oldValue = this.oldValue;
    var newValue = this.value;

    this.callSubscribers(newValue, oldValue);
  };

  SelectValueObserver.prototype.handleEvent = function handleEvent() {
    this.synchronizeValue();
  };

  SelectValueObserver.prototype.subscribe = function subscribe(context, callable) {
    if (!this.hasSubscribers()) {
      this.handler.subscribe(this.element, this);
    }
    this.addSubscriber(context, callable);
  };

  SelectValueObserver.prototype.unsubscribe = function unsubscribe(context, callable) {
    if (this.removeSubscriber(context, callable) && !this.hasSubscribers()) {
      this.handler.dispose();
    }
  };

  SelectValueObserver.prototype.bind = function bind() {
    var _this24 = this;

    this.domObserver = _aureliaPal.DOM.createMutationObserver(function () {
      _this24.synchronizeOptions();
      _this24.synchronizeValue();
    });
    this.domObserver.observe(this.element, { childList: true, subtree: true, characterData: true });
  };

  SelectValueObserver.prototype.unbind = function unbind() {
    this.domObserver.disconnect();
    this.domObserver = null;

    if (this.arrayObserver) {
      this.arrayObserver.unsubscribe(selectArrayContext, this);
      this.arrayObserver = null;
    }
  };

  return SelectValueObserver;
}()) || _class10);

var ClassObserver = exports.ClassObserver = function () {
  function ClassObserver(element) {
    

    this.element = element;
    this.doNotCache = true;
    this.value = '';
    this.version = 0;
  }

  ClassObserver.prototype.getValue = function getValue() {
    return this.value;
  };

  ClassObserver.prototype.setValue = function setValue(newValue) {
    var nameIndex = this.nameIndex || {};
    var version = this.version;
    var names = void 0;
    var name = void 0;

    if (newValue !== null && newValue !== undefined && newValue.length) {
      names = newValue.split(/\s+/);
      for (var i = 0, length = names.length; i < length; i++) {
        name = names[i];
        if (name === '') {
          continue;
        }
        nameIndex[name] = version;
        this.element.classList.add(name);
      }
    }

    this.value = newValue;
    this.nameIndex = nameIndex;
    this.version += 1;

    if (version === 0) {
      return;
    }

    version -= 1;
    for (name in nameIndex) {
      if (!nameIndex.hasOwnProperty(name) || nameIndex[name] !== version) {
        continue;
      }
      this.element.classList.remove(name);
    }
  };

  ClassObserver.prototype.subscribe = function subscribe() {
    throw new Error('Observation of a "' + this.element.nodeName + '" element\'s "class" property is not supported.');
  };

  return ClassObserver;
}();

function hasDeclaredDependencies(descriptor) {
  return !!(descriptor && descriptor.get && descriptor.get.dependencies);
}

function declarePropertyDependencies(ctor, propertyName, dependencies) {
  var descriptor = Object.getOwnPropertyDescriptor(ctor.prototype, propertyName);
  descriptor.get.dependencies = dependencies;
}

function computedFrom() {
  for (var _len = arguments.length, rest = Array(_len), _key = 0; _key < _len; _key++) {
    rest[_key] = arguments[_key];
  }

  return function (target, key, descriptor) {
    descriptor.get.dependencies = rest;
    return descriptor;
  };
}

var ComputedExpression = exports.ComputedExpression = function (_Expression19) {
  _inherits(ComputedExpression, _Expression19);

  function ComputedExpression(name, dependencies) {
    

    var _this25 = _possibleConstructorReturn(this, _Expression19.call(this));

    _this25.name = name;
    _this25.dependencies = dependencies;
    _this25.isAssignable = true;
    return _this25;
  }

  ComputedExpression.prototype.evaluate = function evaluate(scope, lookupFunctions) {
    return scope.bindingContext[this.name];
  };

  ComputedExpression.prototype.assign = function assign(scope, value) {
    scope.bindingContext[this.name] = value;
  };

  ComputedExpression.prototype.accept = function accept(visitor) {
    throw new Error('not implemented');
  };

  ComputedExpression.prototype.connect = function connect(binding, scope) {
    var dependencies = this.dependencies;
    var i = dependencies.length;
    while (i--) {
      dependencies[i].connect(binding, scope);
    }
  };

  return ComputedExpression;
}(Expression);

function createComputedObserver(obj, propertyName, descriptor, observerLocator) {
  var dependencies = descriptor.get.dependencies;
  if (!(dependencies instanceof ComputedExpression)) {
    var i = dependencies.length;
    while (i--) {
      dependencies[i] = observerLocator.parser.parse(dependencies[i]);
    }
    dependencies = descriptor.get.dependencies = new ComputedExpression(propertyName, dependencies);
  }

  var scope = { bindingContext: obj, overrideContext: createOverrideContext(obj) };
  return new ExpressionObserver(scope, dependencies, observerLocator);
}

var svgElements = void 0;
var svgPresentationElements = void 0;
var svgPresentationAttributes = void 0;
var svgAnalyzer = void 0;

if (typeof FEATURE_NO_SVG === 'undefined') {
  svgElements = {
    a: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'target', 'transform', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    altGlyph: ['class', 'dx', 'dy', 'externalResourcesRequired', 'format', 'glyphRef', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rotate', 'style', 'systemLanguage', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    altGlyphDef: ['id', 'xml:base', 'xml:lang', 'xml:space'],
    altGlyphItem: ['id', 'xml:base', 'xml:lang', 'xml:space'],
    animate: ['accumulate', 'additive', 'attributeName', 'attributeType', 'begin', 'by', 'calcMode', 'dur', 'end', 'externalResourcesRequired', 'fill', 'from', 'id', 'keySplines', 'keyTimes', 'max', 'min', 'onbegin', 'onend', 'onload', 'onrepeat', 'repeatCount', 'repeatDur', 'requiredExtensions', 'requiredFeatures', 'restart', 'systemLanguage', 'to', 'values', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    animateColor: ['accumulate', 'additive', 'attributeName', 'attributeType', 'begin', 'by', 'calcMode', 'dur', 'end', 'externalResourcesRequired', 'fill', 'from', 'id', 'keySplines', 'keyTimes', 'max', 'min', 'onbegin', 'onend', 'onload', 'onrepeat', 'repeatCount', 'repeatDur', 'requiredExtensions', 'requiredFeatures', 'restart', 'systemLanguage', 'to', 'values', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    animateMotion: ['accumulate', 'additive', 'begin', 'by', 'calcMode', 'dur', 'end', 'externalResourcesRequired', 'fill', 'from', 'id', 'keyPoints', 'keySplines', 'keyTimes', 'max', 'min', 'onbegin', 'onend', 'onload', 'onrepeat', 'origin', 'path', 'repeatCount', 'repeatDur', 'requiredExtensions', 'requiredFeatures', 'restart', 'rotate', 'systemLanguage', 'to', 'values', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    animateTransform: ['accumulate', 'additive', 'attributeName', 'attributeType', 'begin', 'by', 'calcMode', 'dur', 'end', 'externalResourcesRequired', 'fill', 'from', 'id', 'keySplines', 'keyTimes', 'max', 'min', 'onbegin', 'onend', 'onload', 'onrepeat', 'repeatCount', 'repeatDur', 'requiredExtensions', 'requiredFeatures', 'restart', 'systemLanguage', 'to', 'type', 'values', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    circle: ['class', 'cx', 'cy', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'r', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    clipPath: ['class', 'clipPathUnits', 'externalResourcesRequired', 'id', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    'color-profile': ['id', 'local', 'name', 'rendering-intent', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    cursor: ['externalResourcesRequired', 'id', 'requiredExtensions', 'requiredFeatures', 'systemLanguage', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    defs: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    desc: ['class', 'id', 'style', 'xml:base', 'xml:lang', 'xml:space'],
    ellipse: ['class', 'cx', 'cy', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rx', 'ry', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    feBlend: ['class', 'height', 'id', 'in', 'in2', 'mode', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feColorMatrix: ['class', 'height', 'id', 'in', 'result', 'style', 'type', 'values', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feComponentTransfer: ['class', 'height', 'id', 'in', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feComposite: ['class', 'height', 'id', 'in', 'in2', 'k1', 'k2', 'k3', 'k4', 'operator', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feConvolveMatrix: ['bias', 'class', 'divisor', 'edgeMode', 'height', 'id', 'in', 'kernelMatrix', 'kernelUnitLength', 'order', 'preserveAlpha', 'result', 'style', 'targetX', 'targetY', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feDiffuseLighting: ['class', 'diffuseConstant', 'height', 'id', 'in', 'kernelUnitLength', 'result', 'style', 'surfaceScale', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feDisplacementMap: ['class', 'height', 'id', 'in', 'in2', 'result', 'scale', 'style', 'width', 'x', 'xChannelSelector', 'xml:base', 'xml:lang', 'xml:space', 'y', 'yChannelSelector'],
    feDistantLight: ['azimuth', 'elevation', 'id', 'xml:base', 'xml:lang', 'xml:space'],
    feFlood: ['class', 'height', 'id', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feFuncA: ['amplitude', 'exponent', 'id', 'intercept', 'offset', 'slope', 'tableValues', 'type', 'xml:base', 'xml:lang', 'xml:space'],
    feFuncB: ['amplitude', 'exponent', 'id', 'intercept', 'offset', 'slope', 'tableValues', 'type', 'xml:base', 'xml:lang', 'xml:space'],
    feFuncG: ['amplitude', 'exponent', 'id', 'intercept', 'offset', 'slope', 'tableValues', 'type', 'xml:base', 'xml:lang', 'xml:space'],
    feFuncR: ['amplitude', 'exponent', 'id', 'intercept', 'offset', 'slope', 'tableValues', 'type', 'xml:base', 'xml:lang', 'xml:space'],
    feGaussianBlur: ['class', 'height', 'id', 'in', 'result', 'stdDeviation', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feImage: ['class', 'externalResourcesRequired', 'height', 'id', 'preserveAspectRatio', 'result', 'style', 'width', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feMerge: ['class', 'height', 'id', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feMergeNode: ['id', 'xml:base', 'xml:lang', 'xml:space'],
    feMorphology: ['class', 'height', 'id', 'in', 'operator', 'radius', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feOffset: ['class', 'dx', 'dy', 'height', 'id', 'in', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    fePointLight: ['id', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y', 'z'],
    feSpecularLighting: ['class', 'height', 'id', 'in', 'kernelUnitLength', 'result', 'specularConstant', 'specularExponent', 'style', 'surfaceScale', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feSpotLight: ['id', 'limitingConeAngle', 'pointsAtX', 'pointsAtY', 'pointsAtZ', 'specularExponent', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y', 'z'],
    feTile: ['class', 'height', 'id', 'in', 'result', 'style', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    feTurbulence: ['baseFrequency', 'class', 'height', 'id', 'numOctaves', 'result', 'seed', 'stitchTiles', 'style', 'type', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    filter: ['class', 'externalResourcesRequired', 'filterRes', 'filterUnits', 'height', 'id', 'primitiveUnits', 'style', 'width', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    font: ['class', 'externalResourcesRequired', 'horiz-adv-x', 'horiz-origin-x', 'horiz-origin-y', 'id', 'style', 'vert-adv-y', 'vert-origin-x', 'vert-origin-y', 'xml:base', 'xml:lang', 'xml:space'],
    'font-face': ['accent-height', 'alphabetic', 'ascent', 'bbox', 'cap-height', 'descent', 'font-family', 'font-size', 'font-stretch', 'font-style', 'font-variant', 'font-weight', 'hanging', 'id', 'ideographic', 'mathematical', 'overline-position', 'overline-thickness', 'panose-1', 'slope', 'stemh', 'stemv', 'strikethrough-position', 'strikethrough-thickness', 'underline-position', 'underline-thickness', 'unicode-range', 'units-per-em', 'v-alphabetic', 'v-hanging', 'v-ideographic', 'v-mathematical', 'widths', 'x-height', 'xml:base', 'xml:lang', 'xml:space'],
    'font-face-format': ['id', 'string', 'xml:base', 'xml:lang', 'xml:space'],
    'font-face-name': ['id', 'name', 'xml:base', 'xml:lang', 'xml:space'],
    'font-face-src': ['id', 'xml:base', 'xml:lang', 'xml:space'],
    'font-face-uri': ['id', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    foreignObject: ['class', 'externalResourcesRequired', 'height', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    g: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    glyph: ['arabic-form', 'class', 'd', 'glyph-name', 'horiz-adv-x', 'id', 'lang', 'orientation', 'style', 'unicode', 'vert-adv-y', 'vert-origin-x', 'vert-origin-y', 'xml:base', 'xml:lang', 'xml:space'],
    glyphRef: ['class', 'dx', 'dy', 'format', 'glyphRef', 'id', 'style', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    hkern: ['g1', 'g2', 'id', 'k', 'u1', 'u2', 'xml:base', 'xml:lang', 'xml:space'],
    image: ['class', 'externalResourcesRequired', 'height', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'preserveAspectRatio', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'width', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    line: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'x1', 'x2', 'xml:base', 'xml:lang', 'xml:space', 'y1', 'y2'],
    linearGradient: ['class', 'externalResourcesRequired', 'gradientTransform', 'gradientUnits', 'id', 'spreadMethod', 'style', 'x1', 'x2', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y1', 'y2'],
    marker: ['class', 'externalResourcesRequired', 'id', 'markerHeight', 'markerUnits', 'markerWidth', 'orient', 'preserveAspectRatio', 'refX', 'refY', 'style', 'viewBox', 'xml:base', 'xml:lang', 'xml:space'],
    mask: ['class', 'externalResourcesRequired', 'height', 'id', 'maskContentUnits', 'maskUnits', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    metadata: ['id', 'xml:base', 'xml:lang', 'xml:space'],
    'missing-glyph': ['class', 'd', 'horiz-adv-x', 'id', 'style', 'vert-adv-y', 'vert-origin-x', 'vert-origin-y', 'xml:base', 'xml:lang', 'xml:space'],
    mpath: ['externalResourcesRequired', 'id', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    path: ['class', 'd', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'pathLength', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    pattern: ['class', 'externalResourcesRequired', 'height', 'id', 'patternContentUnits', 'patternTransform', 'patternUnits', 'preserveAspectRatio', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'viewBox', 'width', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    polygon: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'points', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    polyline: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'points', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    radialGradient: ['class', 'cx', 'cy', 'externalResourcesRequired', 'fx', 'fy', 'gradientTransform', 'gradientUnits', 'id', 'r', 'spreadMethod', 'style', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    rect: ['class', 'externalResourcesRequired', 'height', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rx', 'ry', 'style', 'systemLanguage', 'transform', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    script: ['externalResourcesRequired', 'id', 'type', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    set: ['attributeName', 'attributeType', 'begin', 'dur', 'end', 'externalResourcesRequired', 'fill', 'id', 'max', 'min', 'onbegin', 'onend', 'onload', 'onrepeat', 'repeatCount', 'repeatDur', 'requiredExtensions', 'requiredFeatures', 'restart', 'systemLanguage', 'to', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    stop: ['class', 'id', 'offset', 'style', 'xml:base', 'xml:lang', 'xml:space'],
    style: ['id', 'media', 'title', 'type', 'xml:base', 'xml:lang', 'xml:space'],
    svg: ['baseProfile', 'class', 'contentScriptType', 'contentStyleType', 'externalResourcesRequired', 'height', 'id', 'onabort', 'onactivate', 'onclick', 'onerror', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onresize', 'onscroll', 'onunload', 'onzoom', 'preserveAspectRatio', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'version', 'viewBox', 'width', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y', 'zoomAndPan'],
    switch: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'xml:base', 'xml:lang', 'xml:space'],
    symbol: ['class', 'externalResourcesRequired', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'preserveAspectRatio', 'style', 'viewBox', 'xml:base', 'xml:lang', 'xml:space'],
    text: ['class', 'dx', 'dy', 'externalResourcesRequired', 'id', 'lengthAdjust', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rotate', 'style', 'systemLanguage', 'textLength', 'transform', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    textPath: ['class', 'externalResourcesRequired', 'id', 'lengthAdjust', 'method', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'spacing', 'startOffset', 'style', 'systemLanguage', 'textLength', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space'],
    title: ['class', 'id', 'style', 'xml:base', 'xml:lang', 'xml:space'],
    tref: ['class', 'dx', 'dy', 'externalResourcesRequired', 'id', 'lengthAdjust', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rotate', 'style', 'systemLanguage', 'textLength', 'x', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    tspan: ['class', 'dx', 'dy', 'externalResourcesRequired', 'id', 'lengthAdjust', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'rotate', 'style', 'systemLanguage', 'textLength', 'x', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    use: ['class', 'externalResourcesRequired', 'height', 'id', 'onactivate', 'onclick', 'onfocusin', 'onfocusout', 'onload', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'requiredExtensions', 'requiredFeatures', 'style', 'systemLanguage', 'transform', 'width', 'x', 'xlink:actuate', 'xlink:arcrole', 'xlink:href', 'xlink:role', 'xlink:show', 'xlink:title', 'xlink:type', 'xml:base', 'xml:lang', 'xml:space', 'y'],
    view: ['externalResourcesRequired', 'id', 'preserveAspectRatio', 'viewBox', 'viewTarget', 'xml:base', 'xml:lang', 'xml:space', 'zoomAndPan'],
    vkern: ['g1', 'g2', 'id', 'k', 'u1', 'u2', 'xml:base', 'xml:lang', 'xml:space']
  };


  svgPresentationElements = {
    'a': true,
    'altGlyph': true,
    'animate': true,
    'animateColor': true,
    'circle': true,
    'clipPath': true,
    'defs': true,
    'ellipse': true,
    'feBlend': true,
    'feColorMatrix': true,
    'feComponentTransfer': true,
    'feComposite': true,
    'feConvolveMatrix': true,
    'feDiffuseLighting': true,
    'feDisplacementMap': true,
    'feFlood': true,
    'feGaussianBlur': true,
    'feImage': true,
    'feMerge': true,
    'feMorphology': true,
    'feOffset': true,
    'feSpecularLighting': true,
    'feTile': true,
    'feTurbulence': true,
    'filter': true,
    'font': true,
    'foreignObject': true,
    'g': true,
    'glyph': true,
    'glyphRef': true,
    'image': true,
    'line': true,
    'linearGradient': true,
    'marker': true,
    'mask': true,
    'missing-glyph': true,
    'path': true,
    'pattern': true,
    'polygon': true,
    'polyline': true,
    'radialGradient': true,
    'rect': true,
    'stop': true,
    'svg': true,
    'switch': true,
    'symbol': true,
    'text': true,
    'textPath': true,
    'tref': true,
    'tspan': true,
    'use': true
  };

  svgPresentationAttributes = {
    'alignment-baseline': true,
    'baseline-shift': true,
    'clip-path': true,
    'clip-rule': true,
    'clip': true,
    'color-interpolation-filters': true,
    'color-interpolation': true,
    'color-profile': true,
    'color-rendering': true,
    'color': true,
    'cursor': true,
    'direction': true,
    'display': true,
    'dominant-baseline': true,
    'enable-background': true,
    'fill-opacity': true,
    'fill-rule': true,
    'fill': true,
    'filter': true,
    'flood-color': true,
    'flood-opacity': true,
    'font-family': true,
    'font-size-adjust': true,
    'font-size': true,
    'font-stretch': true,
    'font-style': true,
    'font-variant': true,
    'font-weight': true,
    'glyph-orientation-horizontal': true,
    'glyph-orientation-vertical': true,
    'image-rendering': true,
    'kerning': true,
    'letter-spacing': true,
    'lighting-color': true,
    'marker-end': true,
    'marker-mid': true,
    'marker-start': true,
    'mask': true,
    'opacity': true,
    'overflow': true,
    'pointer-events': true,
    'shape-rendering': true,
    'stop-color': true,
    'stop-opacity': true,
    'stroke-dasharray': true,
    'stroke-dashoffset': true,
    'stroke-linecap': true,
    'stroke-linejoin': true,
    'stroke-miterlimit': true,
    'stroke-opacity': true,
    'stroke-width': true,
    'stroke': true,
    'text-anchor': true,
    'text-decoration': true,
    'text-rendering': true,
    'unicode-bidi': true,
    'visibility': true,
    'word-spacing': true,
    'writing-mode': true
  };

  var createElement = function createElement(html) {
    var div = _aureliaPal.DOM.createElement('div');
    div.innerHTML = html;
    return div.firstChild;
  };

  svgAnalyzer = function () {
    function SVGAnalyzer() {
      

      if (createElement('<svg><altGlyph /></svg>').firstElementChild.nodeName === 'altglyph' && elements.altGlyph) {
        elements.altglyph = elements.altGlyph;
        delete elements.altGlyph;
        elements.altglyphdef = elements.altGlyphDef;
        delete elements.altGlyphDef;
        elements.altglyphitem = elements.altGlyphItem;
        delete elements.altGlyphItem;
        elements.glyphref = elements.glyphRef;
        delete elements.glyphRef;
      }
    }

    SVGAnalyzer.prototype.isStandardSvgAttribute = function isStandardSvgAttribute(nodeName, attributeName) {
      return presentationElements[nodeName] && presentationAttributes[attributeName] || elements[nodeName] && elements[nodeName].indexOf(attributeName) !== -1;
    };

    return SVGAnalyzer;
  }();
}

var elements = exports.elements = svgElements;
var presentationElements = exports.presentationElements = svgPresentationElements;
var presentationAttributes = exports.presentationAttributes = svgPresentationAttributes;
var SVGAnalyzer = exports.SVGAnalyzer = svgAnalyzer || function () {
  function _class11() {
    
  }

  _class11.prototype.isStandardSvgAttribute = function isStandardSvgAttribute() {
    return false;
  };

  return _class11;
}();

var ObserverLocator = exports.ObserverLocator = (_temp = _class12 = function () {
  function ObserverLocator(taskQueue, eventManager, dirtyChecker, svgAnalyzer, parser) {
    

    this.taskQueue = taskQueue;
    this.eventManager = eventManager;
    this.dirtyChecker = dirtyChecker;
    this.svgAnalyzer = svgAnalyzer;
    this.parser = parser;

    this.adapters = [];
    this.logger = LogManager.getLogger('observer-locator');
  }

  ObserverLocator.prototype.getObserver = function getObserver(obj, propertyName) {
    var observersLookup = obj.__observers__;
    var observer = void 0;

    if (observersLookup && propertyName in observersLookup) {
      return observersLookup[propertyName];
    }

    observer = this.createPropertyObserver(obj, propertyName);

    if (!observer.doNotCache) {
      if (observersLookup === undefined) {
        observersLookup = this.getOrCreateObserversLookup(obj);
      }

      observersLookup[propertyName] = observer;
    }

    return observer;
  };

  ObserverLocator.prototype.getOrCreateObserversLookup = function getOrCreateObserversLookup(obj) {
    return obj.__observers__ || this.createObserversLookup(obj);
  };

  ObserverLocator.prototype.createObserversLookup = function createObserversLookup(obj) {
    var value = {};

    if (!Reflect.defineProperty(obj, '__observers__', {
      enumerable: false,
      configurable: false,
      writable: false,
      value: value
    })) {
      this.logger.warn('Cannot add observers to object', obj);
    }

    return value;
  };

  ObserverLocator.prototype.addAdapter = function addAdapter(adapter) {
    this.adapters.push(adapter);
  };

  ObserverLocator.prototype.getAdapterObserver = function getAdapterObserver(obj, propertyName, descriptor) {
    for (var i = 0, ii = this.adapters.length; i < ii; i++) {
      var adapter = this.adapters[i];
      var observer = adapter.getObserver(obj, propertyName, descriptor);
      if (observer) {
        return observer;
      }
    }
    return null;
  };

  ObserverLocator.prototype.createPropertyObserver = function createPropertyObserver(obj, propertyName) {
    var descriptor = void 0;
    var handler = void 0;
    var xlinkResult = void 0;

    if (!(obj instanceof Object)) {
      return new PrimitiveObserver(obj, propertyName);
    }

    if (obj instanceof _aureliaPal.DOM.Element) {
      if (propertyName === 'class') {
        return new ClassObserver(obj);
      }
      if (propertyName === 'style' || propertyName === 'css') {
        return new StyleObserver(obj, propertyName);
      }
      handler = this.eventManager.getElementHandler(obj, propertyName);
      if (propertyName === 'value' && obj.tagName.toLowerCase() === 'select') {
        return new SelectValueObserver(obj, handler, this);
      }
      if (propertyName === 'checked' && obj.tagName.toLowerCase() === 'input') {
        return new CheckedObserver(obj, handler, this);
      }
      if (handler) {
        return new ValueAttributeObserver(obj, propertyName, handler);
      }
      xlinkResult = /^xlink:(.+)$/.exec(propertyName);
      if (xlinkResult) {
        return new XLinkAttributeObserver(obj, propertyName, xlinkResult[1]);
      }
      if (propertyName === 'role' && (obj instanceof _aureliaPal.DOM.Element || obj instanceof _aureliaPal.DOM.SVGElement) || /^\w+:|^data-|^aria-/.test(propertyName) || obj instanceof _aureliaPal.DOM.SVGElement && this.svgAnalyzer.isStandardSvgAttribute(obj.nodeName, propertyName)) {
        return new DataAttributeObserver(obj, propertyName);
      }
    }

    descriptor = Object.getPropertyDescriptor(obj, propertyName);

    if (hasDeclaredDependencies(descriptor)) {
      return createComputedObserver(obj, propertyName, descriptor, this);
    }

    if (descriptor) {
      var existingGetterOrSetter = descriptor.get || descriptor.set;
      if (existingGetterOrSetter) {
        if (existingGetterOrSetter.getObserver) {
          return existingGetterOrSetter.getObserver(obj);
        }

        var adapterObserver = this.getAdapterObserver(obj, propertyName, descriptor);
        if (adapterObserver) {
          return adapterObserver;
        }
        return new DirtyCheckProperty(this.dirtyChecker, obj, propertyName);
      }
    }

    if (obj instanceof Array) {
      if (propertyName === 'length') {
        return this.getArrayObserver(obj).getLengthObserver();
      }

      return new DirtyCheckProperty(this.dirtyChecker, obj, propertyName);
    } else if (obj instanceof Map) {
      if (propertyName === 'size') {
        return this.getMapObserver(obj).getLengthObserver();
      }

      return new DirtyCheckProperty(this.dirtyChecker, obj, propertyName);
    } else if (obj instanceof Set) {
      if (propertyName === 'size') {
        return this.getSetObserver(obj).getLengthObserver();
      }

      return new DirtyCheckProperty(this.dirtyChecker, obj, propertyName);
    }

    return new SetterObserver(this.taskQueue, obj, propertyName);
  };

  ObserverLocator.prototype.getAccessor = function getAccessor(obj, propertyName) {
    if (obj instanceof _aureliaPal.DOM.Element) {
      if (propertyName === 'class' || propertyName === 'style' || propertyName === 'css' || propertyName === 'value' && (obj.tagName.toLowerCase() === 'input' || obj.tagName.toLowerCase() === 'select') || propertyName === 'checked' && obj.tagName.toLowerCase() === 'input' || propertyName === 'model' && obj.tagName.toLowerCase() === 'input' || /^xlink:.+$/.exec(propertyName)) {
        return this.getObserver(obj, propertyName);
      }
      if (/^\w+:|^data-|^aria-/.test(propertyName) || obj instanceof _aureliaPal.DOM.SVGElement && this.svgAnalyzer.isStandardSvgAttribute(obj.nodeName, propertyName) || obj.tagName.toLowerCase() === 'img' && propertyName === 'src' || obj.tagName.toLowerCase() === 'a' && propertyName === 'href') {
        return dataAttributeAccessor;
      }
    }
    return propertyAccessor;
  };

  ObserverLocator.prototype.getArrayObserver = function getArrayObserver(array) {
    return _getArrayObserver(this.taskQueue, array);
  };

  ObserverLocator.prototype.getMapObserver = function getMapObserver(map) {
    return _getMapObserver(this.taskQueue, map);
  };

  ObserverLocator.prototype.getSetObserver = function getSetObserver(set) {
    return _getSetObserver(this.taskQueue, set);
  };

  return ObserverLocator;
}(), _class12.inject = [_aureliaTaskQueue.TaskQueue, EventManager, DirtyChecker, SVGAnalyzer, Parser], _temp);

var ObjectObservationAdapter = exports.ObjectObservationAdapter = function () {
  function ObjectObservationAdapter() {
    
  }

  ObjectObservationAdapter.prototype.getObserver = function getObserver(object, propertyName, descriptor) {
    throw new Error('BindingAdapters must implement getObserver(object, propertyName).');
  };

  return ObjectObservationAdapter;
}();

var BindingExpression = exports.BindingExpression = function () {
  function BindingExpression(observerLocator, targetProperty, sourceExpression, mode, lookupFunctions, attribute) {
    

    this.observerLocator = observerLocator;
    this.targetProperty = targetProperty;
    this.sourceExpression = sourceExpression;
    this.mode = mode;
    this.lookupFunctions = lookupFunctions;
    this.attribute = attribute;
    this.discrete = false;
  }

  BindingExpression.prototype.createBinding = function createBinding(target) {
    return new Binding(this.observerLocator, this.sourceExpression, target, this.targetProperty, this.mode, this.lookupFunctions);
  };

  return BindingExpression;
}();

var Binding = exports.Binding = (_dec10 = connectable(), _dec10(_class13 = function () {
  function Binding(observerLocator, sourceExpression, target, targetProperty, mode, lookupFunctions) {
    

    this.observerLocator = observerLocator;
    this.sourceExpression = sourceExpression;
    this.target = target;
    this.targetProperty = targetProperty;
    this.mode = mode;
    this.lookupFunctions = lookupFunctions;
  }

  Binding.prototype.updateTarget = function updateTarget(value) {
    this.targetObserver.setValue(value, this.target, this.targetProperty);
  };

  Binding.prototype.updateSource = function updateSource(value) {
    this.sourceExpression.assign(this.source, value, this.lookupFunctions);
  };

  Binding.prototype.call = function call(context, newValue, oldValue) {
    if (!this.isBound) {
      return;
    }
    if (context === sourceContext) {
      oldValue = this.targetObserver.getValue(this.target, this.targetProperty);
      newValue = this.sourceExpression.evaluate(this.source, this.lookupFunctions);
      if (newValue !== oldValue) {
        this.updateTarget(newValue);
      }
      if (this.mode !== bindingMode.oneTime) {
        this._version++;
        this.sourceExpression.connect(this, this.source);
        this.unobserve(false);
      }
      return;
    }
    if (context === targetContext) {
      if (newValue !== this.sourceExpression.evaluate(this.source, this.lookupFunctions)) {
        this.updateSource(newValue);
      }
      return;
    }
    throw new Error('Unexpected call context ' + context);
  };

  Binding.prototype.bind = function bind(source) {
    if (this.isBound) {
      if (this.source === source) {
        return;
      }
      this.unbind();
    }
    this.isBound = true;
    this.source = source;

    if (this.sourceExpression.bind) {
      this.sourceExpression.bind(this, source, this.lookupFunctions);
    }

    var mode = this.mode;
    if (!this.targetObserver) {
      var method = mode === bindingMode.twoWay || mode === bindingMode.fromView ? 'getObserver' : 'getAccessor';
      this.targetObserver = this.observerLocator[method](this.target, this.targetProperty);
    }

    if ('bind' in this.targetObserver) {
      this.targetObserver.bind();
    }
    if (this.mode !== bindingMode.fromView) {
      var value = this.sourceExpression.evaluate(source, this.lookupFunctions);
      this.updateTarget(value);
    }

    if (mode === bindingMode.oneTime) {
      return;
    } else if (mode === bindingMode.toView) {
      enqueueBindingConnect(this);
    } else if (mode === bindingMode.twoWay) {
      this.sourceExpression.connect(this, source);
      this.targetObserver.subscribe(targetContext, this);
    } else if (mode === bindingMode.fromView) {
      this.targetObserver.subscribe(targetContext, this);
    }
  };

  Binding.prototype.unbind = function unbind() {
    if (!this.isBound) {
      return;
    }
    this.isBound = false;
    if (this.sourceExpression.unbind) {
      this.sourceExpression.unbind(this, this.source);
    }
    this.source = null;
    if ('unbind' in this.targetObserver) {
      this.targetObserver.unbind();
    }
    if (this.targetObserver.unsubscribe) {
      this.targetObserver.unsubscribe(targetContext, this);
    }
    this.unobserve(true);
  };

  Binding.prototype.connect = function connect(evaluate) {
    if (!this.isBound) {
      return;
    }
    if (evaluate) {
      var value = this.sourceExpression.evaluate(this.source, this.lookupFunctions);
      this.updateTarget(value);
    }
    this.sourceExpression.connect(this, this.source);
  };

  return Binding;
}()) || _class13);

var CallExpression = exports.CallExpression = function () {
  function CallExpression(observerLocator, targetProperty, sourceExpression, lookupFunctions) {
    

    this.observerLocator = observerLocator;
    this.targetProperty = targetProperty;
    this.sourceExpression = sourceExpression;
    this.lookupFunctions = lookupFunctions;
  }

  CallExpression.prototype.createBinding = function createBinding(target) {
    return new Call(this.observerLocator, this.sourceExpression, target, this.targetProperty, this.lookupFunctions);
  };

  return CallExpression;
}();

var Call = exports.Call = function () {
  function Call(observerLocator, sourceExpression, target, targetProperty, lookupFunctions) {
    

    this.sourceExpression = sourceExpression;
    this.target = target;
    this.targetProperty = observerLocator.getObserver(target, targetProperty);
    this.lookupFunctions = lookupFunctions;
  }

  Call.prototype.callSource = function callSource($event) {
    var overrideContext = this.source.overrideContext;
    Object.assign(overrideContext, $event);
    overrideContext.$event = $event;
    var mustEvaluate = true;
    var result = this.sourceExpression.evaluate(this.source, this.lookupFunctions, mustEvaluate);
    delete overrideContext.$event;
    for (var prop in $event) {
      delete overrideContext[prop];
    }
    return result;
  };

  Call.prototype.bind = function bind(source) {
    var _this26 = this;

    if (this.isBound) {
      if (this.source === source) {
        return;
      }
      this.unbind();
    }
    this.isBound = true;
    this.source = source;

    if (this.sourceExpression.bind) {
      this.sourceExpression.bind(this, source, this.lookupFunctions);
    }
    this.targetProperty.setValue(function ($event) {
      return _this26.callSource($event);
    });
  };

  Call.prototype.unbind = function unbind() {
    if (!this.isBound) {
      return;
    }
    this.isBound = false;
    if (this.sourceExpression.unbind) {
      this.sourceExpression.unbind(this, this.source);
    }
    this.source = null;
    this.targetProperty.setValue(null);
  };

  return Call;
}();

var ValueConverterResource = exports.ValueConverterResource = function () {
  function ValueConverterResource(name) {
    

    this.name = name;
  }

  ValueConverterResource.convention = function convention(name) {
    if (name.endsWith('ValueConverter')) {
      return new ValueConverterResource(camelCase(name.substring(0, name.length - 14)));
    }
  };

  ValueConverterResource.prototype.initialize = function initialize(container, target) {
    this.instance = container.get(target);
  };

  ValueConverterResource.prototype.register = function register(registry, name) {
    registry.registerValueConverter(name || this.name, this.instance);
  };

  ValueConverterResource.prototype.load = function load(container, target) {};

  return ValueConverterResource;
}();

function valueConverter(nameOrTarget) {
  if (nameOrTarget === undefined || typeof nameOrTarget === 'string') {
    return function (target) {
      _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.resource, new ValueConverterResource(nameOrTarget), target);
    };
  }

  _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.resource, new ValueConverterResource(), nameOrTarget);
}

var BindingBehaviorResource = exports.BindingBehaviorResource = function () {
  function BindingBehaviorResource(name) {
    

    this.name = name;
  }

  BindingBehaviorResource.convention = function convention(name) {
    if (name.endsWith('BindingBehavior')) {
      return new BindingBehaviorResource(camelCase(name.substring(0, name.length - 15)));
    }
  };

  BindingBehaviorResource.prototype.initialize = function initialize(container, target) {
    this.instance = container.get(target);
  };

  BindingBehaviorResource.prototype.register = function register(registry, name) {
    registry.registerBindingBehavior(name || this.name, this.instance);
  };

  BindingBehaviorResource.prototype.load = function load(container, target) {};

  return BindingBehaviorResource;
}();

function bindingBehavior(nameOrTarget) {
  if (nameOrTarget === undefined || typeof nameOrTarget === 'string') {
    return function (target) {
      _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.resource, new BindingBehaviorResource(nameOrTarget), target);
    };
  }

  _aureliaMetadata.metadata.define(_aureliaMetadata.metadata.resource, new BindingBehaviorResource(), nameOrTarget);
}

var ListenerExpression = exports.ListenerExpression = function () {
  function ListenerExpression(eventManager, targetEvent, sourceExpression, delegationStrategy, preventDefault, lookupFunctions) {
    

    this.eventManager = eventManager;
    this.targetEvent = targetEvent;
    this.sourceExpression = sourceExpression;
    this.delegationStrategy = delegationStrategy;
    this.discrete = true;
    this.preventDefault = preventDefault;
    this.lookupFunctions = lookupFunctions;
  }

  ListenerExpression.prototype.createBinding = function createBinding(target) {
    return new Listener(this.eventManager, this.targetEvent, this.delegationStrategy, this.sourceExpression, target, this.preventDefault, this.lookupFunctions);
  };

  return ListenerExpression;
}();

var Listener = exports.Listener = function () {
  function Listener(eventManager, targetEvent, delegationStrategy, sourceExpression, target, preventDefault, lookupFunctions) {
    

    this.eventManager = eventManager;
    this.targetEvent = targetEvent;
    this.delegationStrategy = delegationStrategy;
    this.sourceExpression = sourceExpression;
    this.target = target;
    this.preventDefault = preventDefault;
    this.lookupFunctions = lookupFunctions;
  }

  Listener.prototype.callSource = function callSource(event) {
    var overrideContext = this.source.overrideContext;
    overrideContext.$event = event;
    var mustEvaluate = true;
    var result = this.sourceExpression.evaluate(this.source, this.lookupFunctions, mustEvaluate);
    delete overrideContext.$event;
    if (result !== true && this.preventDefault) {
      event.preventDefault();
    }
    return result;
  };

  Listener.prototype.handleEvent = function handleEvent(event) {
    this.callSource(event);
  };

  Listener.prototype.bind = function bind(source) {
    if (this.isBound) {
      if (this.source === source) {
        return;
      }
      this.unbind();
    }
    this.isBound = true;
    this.source = source;

    if (this.sourceExpression.bind) {
      this.sourceExpression.bind(this, source, this.lookupFunctions);
    }
    this._handler = this.eventManager.addEventListener(this.target, this.targetEvent, this, this.delegationStrategy, true);
  };

  Listener.prototype.unbind = function unbind() {
    if (!this.isBound) {
      return;
    }
    this.isBound = false;
    if (this.sourceExpression.unbind) {
      this.sourceExpression.unbind(this, this.source);
    }
    this.source = null;
    this._handler.dispose();
    this._handler = null;
  };

  return Listener;
}();

function getAU(element) {
  var au = element.au;

  if (au === undefined) {
    throw new Error('No Aurelia APIs are defined for the element: "' + element.tagName + '".');
  }

  return au;
}

var NameExpression = exports.NameExpression = function () {
  function NameExpression(sourceExpression, apiName, lookupFunctions) {
    

    this.sourceExpression = sourceExpression;
    this.apiName = apiName;
    this.lookupFunctions = lookupFunctions;
    this.discrete = true;
  }

  NameExpression.prototype.createBinding = function createBinding(target) {
    return new NameBinder(this.sourceExpression, NameExpression.locateAPI(target, this.apiName), this.lookupFunctions);
  };

  NameExpression.locateAPI = function locateAPI(element, apiName) {
    switch (apiName) {
      case 'element':
        return element;
      case 'controller':
        return getAU(element).controller;
      case 'view-model':
        return getAU(element).controller.viewModel;
      case 'view':
        return getAU(element).controller.view;
      default:
        var target = getAU(element)[apiName];

        if (target === undefined) {
          throw new Error('Attempted to reference "' + apiName + '", but it was not found amongst the target\'s API.');
        }

        return target.viewModel;
    }
  };

  return NameExpression;
}();

var NameBinder = function () {
  function NameBinder(sourceExpression, target, lookupFunctions) {
    

    this.sourceExpression = sourceExpression;
    this.target = target;
    this.lookupFunctions = lookupFunctions;
  }

  NameBinder.prototype.bind = function bind(source) {
    if (this.isBound) {
      if (this.source === source) {
        return;
      }
      this.unbind();
    }
    this.isBound = true;
    this.source = source;
    if (this.sourceExpression.bind) {
      this.sourceExpression.bind(this, source, this.lookupFunctions);
    }
    this.sourceExpression.assign(this.source, this.target, this.lookupFunctions);
  };

  NameBinder.prototype.unbind = function unbind() {
    if (!this.isBound) {
      return;
    }
    this.isBound = false;
    if (this.sourceExpression.evaluate(this.source, this.lookupFunctions) === this.target) {
      this.sourceExpression.assign(this.source, null, this.lookupFunctions);
    }
    if (this.sourceExpression.unbind) {
      this.sourceExpression.unbind(this, this.source);
    }
    this.source = null;
  };

  return NameBinder;
}();

var LookupFunctions = {
  bindingBehaviors: function bindingBehaviors(name) {
    return null;
  },
  valueConverters: function valueConverters(name) {
    return null;
  }
};

var BindingEngine = exports.BindingEngine = (_temp2 = _class14 = function () {
  function BindingEngine(observerLocator, parser) {
    

    this.observerLocator = observerLocator;
    this.parser = parser;
  }

  BindingEngine.prototype.createBindingExpression = function createBindingExpression(targetProperty, sourceExpression) {
    var mode = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : bindingMode.toView;
    var lookupFunctions = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : LookupFunctions;

    return new BindingExpression(this.observerLocator, targetProperty, this.parser.parse(sourceExpression), mode, lookupFunctions);
  };

  BindingEngine.prototype.propertyObserver = function propertyObserver(obj, propertyName) {
    var _this27 = this;

    return {
      subscribe: function subscribe(callback) {
        var observer = _this27.observerLocator.getObserver(obj, propertyName);
        observer.subscribe(callback);
        return {
          dispose: function dispose() {
            return observer.unsubscribe(callback);
          }
        };
      }
    };
  };

  BindingEngine.prototype.collectionObserver = function collectionObserver(collection) {
    var _this28 = this;

    return {
      subscribe: function subscribe(callback) {
        var observer = void 0;
        if (collection instanceof Array) {
          observer = _this28.observerLocator.getArrayObserver(collection);
        } else if (collection instanceof Map) {
          observer = _this28.observerLocator.getMapObserver(collection);
        } else if (collection instanceof Set) {
          observer = _this28.observerLocator.getSetObserver(collection);
        } else {
          throw new Error('collection must be an instance of Array, Map or Set.');
        }
        observer.subscribe(callback);
        return {
          dispose: function dispose() {
            return observer.unsubscribe(callback);
          }
        };
      }
    };
  };

  BindingEngine.prototype.expressionObserver = function expressionObserver(bindingContext, expression) {
    var scope = { bindingContext: bindingContext, overrideContext: createOverrideContext(bindingContext) };
    return new ExpressionObserver(scope, this.parser.parse(expression), this.observerLocator, LookupFunctions);
  };

  BindingEngine.prototype.parseExpression = function parseExpression(expression) {
    return this.parser.parse(expression);
  };

  BindingEngine.prototype.registerAdapter = function registerAdapter(adapter) {
    this.observerLocator.addAdapter(adapter);
  };

  return BindingEngine;
}(), _class14.inject = [ObserverLocator, Parser], _temp2);


var setProto = Set.prototype;

function _getSetObserver(taskQueue, set) {
  return ModifySetObserver.for(taskQueue, set);
}

exports.getSetObserver = _getSetObserver;

var ModifySetObserver = function (_ModifyCollectionObse3) {
  _inherits(ModifySetObserver, _ModifyCollectionObse3);

  function ModifySetObserver(taskQueue, set) {
    

    return _possibleConstructorReturn(this, _ModifyCollectionObse3.call(this, taskQueue, set));
  }

  ModifySetObserver.for = function _for(taskQueue, set) {
    if (!('__set_observer__' in set)) {
      Reflect.defineProperty(set, '__set_observer__', {
        value: ModifySetObserver.create(taskQueue, set),
        enumerable: false, configurable: false
      });
    }
    return set.__set_observer__;
  };

  ModifySetObserver.create = function create(taskQueue, set) {
    var observer = new ModifySetObserver(taskQueue, set);

    var proto = setProto;
    if (proto.add !== set.add || proto.delete !== set.delete || proto.clear !== set.clear) {
      proto = {
        add: set.add,
        delete: set.delete,
        clear: set.clear
      };
    }

    set.add = function () {
      var type = 'add';
      var oldSize = set.size;
      var methodCallResult = proto.add.apply(set, arguments);
      var hasValue = set.size === oldSize;
      if (!hasValue) {
        observer.addChangeRecord({
          type: type,
          object: set,
          value: Array.from(set).pop()
        });
      }
      return methodCallResult;
    };

    set.delete = function () {
      var hasValue = set.has(arguments[0]);
      var methodCallResult = proto.delete.apply(set, arguments);
      if (hasValue) {
        observer.addChangeRecord({
          type: 'delete',
          object: set,
          value: arguments[0]
        });
      }
      return methodCallResult;
    };

    set.clear = function () {
      var methodCallResult = proto.clear.apply(set, arguments);
      observer.addChangeRecord({
        type: 'clear',
        object: set
      });
      return methodCallResult;
    };

    return observer;
  };

  return ModifySetObserver;
}(ModifyCollectionObserver);

function observable(targetOrConfig, key, descriptor) {
  function deco(target, key, descriptor, config) {
    var isClassDecorator = key === undefined;
    if (isClassDecorator) {
      target = target.prototype;
      key = typeof config === 'string' ? config : config.name;
    }

    var innerPropertyName = '_' + key;
    var innerPropertyDescriptor = {
      configurable: true,
      enumerable: false,
      writable: true
    };

    var callbackName = config && config.changeHandler || key + 'Changed';

    if (descriptor) {
      if (typeof descriptor.initializer === 'function') {
        innerPropertyDescriptor.value = descriptor.initializer();
      }
    } else {
      descriptor = {};
    }

    if (!('enumerable' in descriptor)) {
      descriptor.enumerable = true;
    }

    delete descriptor.value;
    delete descriptor.writable;
    delete descriptor.initializer;

    Reflect.defineProperty(target, innerPropertyName, innerPropertyDescriptor);

    descriptor.get = function () {
      return this[innerPropertyName];
    };
    descriptor.set = function (newValue) {
      var oldValue = this[innerPropertyName];
      if (newValue === oldValue) {
        return;
      }

      this[innerPropertyName] = newValue;
      Reflect.defineProperty(this, innerPropertyName, { enumerable: false });

      if (this[callbackName]) {
        this[callbackName](newValue, oldValue, key);
      }
    };

    descriptor.get.dependencies = [innerPropertyName];

    if (isClassDecorator) {
      Reflect.defineProperty(target, key, descriptor);
    } else {
      return descriptor;
    }
  }

  if (key === undefined) {
    return function (t, k, d) {
      return deco(t, k, d, targetOrConfig);
    };
  }
  return deco(targetOrConfig, key, descriptor);
}

var signals = {};

function connectBindingToSignal(binding, name) {
  if (!signals.hasOwnProperty(name)) {
    signals[name] = 0;
  }
  binding.observeProperty(signals, name);
}

function signalBindings(name) {
  if (signals.hasOwnProperty(name)) {
    signals[name]++;
  }
}
});
;
define('aurelia-bootstrapper/dist/commonjs/aurelia-bootstrapper',['require','exports','module','aurelia-polyfills','aurelia-pal'],function (require, exports, module) {'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

require('aurelia-polyfills');
var aureliaPal = require('aurelia-pal');

var bootstrapPromises = [];
var startResolve;
var startPromise = new Promise(function (resolve) { return startResolve = resolve; });
var host = aureliaPal.PLATFORM.global;
var isNodeLike = typeof process !== 'undefined' && !process.browser;
function ready() {
    if (!host.document || host.document.readyState === 'complete') {
        return Promise.resolve();
    }
    return new Promise(function (resolve) {
        host.document.addEventListener('DOMContentLoaded', completed);
        host.addEventListener('load', completed);
        function completed() {
            host.document.removeEventListener('DOMContentLoaded', completed);
            host.removeEventListener('load', completed);
            resolve();
        }
    });
}
function createLoader() {
    if (aureliaPal.PLATFORM.Loader) {
        return Promise.resolve(new aureliaPal.PLATFORM.Loader());
    }
    if (typeof AURELIA_WEBPACK_2_0 === 'undefined') {
        if (typeof __webpack_require__ !== 'undefined') {
            var m = __webpack_require__(require.resolve('aurelia-loader-webpack'));
            return Promise.resolve(new m.WebpackLoader());
        }
        if (host.System && typeof host.System.config === 'function') {
            return host.System.normalize('aurelia-bootstrapper').then(function (bsn) {
                return host.System.normalize('aurelia-loader-default', bsn);
            }).then(function (loaderName) {
                return host.System.import(loaderName).then(function (m) { return new m.DefaultLoader(); });
            });
        }
        if (typeof host.require === 'function' && typeof host.define === 'function' && typeof host.define.amd === 'object') {
            return new Promise(function (resolve, reject) { return host.require(['aurelia-loader-default'], function (m) { return resolve(new m.DefaultLoader()); }, reject); });
        }
        if (isNodeLike && typeof module !== 'undefined' && typeof module.require !== 'undefined') {
            var m = module.require('aurelia-loader-nodejs');
            return Promise.resolve(new m.NodeJsLoader());
        }
    }
    return Promise.reject('No PLATFORM.Loader is defined and there is neither a System API (ES6) or a Require API (AMD) globally available to load your app.');
}
function initializePal(loader) {
    if (aureliaPal.isInitialized)
        return Promise.resolve();
    var type;
    var isRenderer = isNodeLike && (process.type === 'renderer' || process.versions['node-webkit']);
    if (isNodeLike && !isRenderer) {
        type = 'nodejs';
    }
    else if (typeof window !== 'undefined') {
        type = 'browser';
    }
    else if (typeof self !== 'undefined') {
        type = 'worker';
    }
    else {
        throw new Error('Could not determine platform implementation to load.');
    }
    return loader.loadModule('aurelia-pal-' + type)
        .then(function (palModule) { return type === 'nodejs' && !aureliaPal.isInitialized && palModule.globalize() || palModule.initialize(); });
}
function preparePlatform(loader) {
    var map = function (moduleId, relativeTo) {
        return loader.normalize(moduleId, relativeTo)
            .then(function (normalized) {
            loader.map(moduleId, normalized);
            return normalized;
        });
    };
    return initializePal(loader)
        .then(function () { return loader.normalize('aurelia-bootstrapper'); })
        .then(function (bootstrapperName) {
        var frameworkPromise = map(aureliaPal.PLATFORM.moduleName('aurelia-framework', { exports: ['Aurelia'] }), bootstrapperName);
        return Promise.all([
            frameworkPromise,
            frameworkPromise.then(function (frameworkName) { return map('aurelia-dependency-injection', frameworkName); }),
            map('aurelia-router', bootstrapperName),
            map('aurelia-logging-console', bootstrapperName)
        ]);
    })
        .then(function (_a) {
        var frameworkName = _a[0];
        return loader.loadModule(frameworkName);
    })
        .then(function (fx) { return startResolve(function () { return new fx.Aurelia(loader); }); });
}
function config(appHost, configModuleId, aurelia) {
    aurelia.host = appHost;
    aurelia.configModuleId = configModuleId || null;
    if (configModuleId) {
        return aurelia.loader
            .loadModule(configModuleId)
            .then(function (customConfig) {
            if (!customConfig.configure) {
                throw new Error("Cannot initialize module '".concat(configModuleId, "' without a configure function."));
            }
            return customConfig.configure(aurelia);
        });
    }
    aurelia.use
        .standardConfiguration()
        .developmentLogging();
    return aurelia.start().then(function () { return aurelia.setRoot(); });
}
function run() {
    return ready()
        .then(createLoader)
        .then(preparePlatform)
        .then(function () {
        var appHosts = host.document.querySelectorAll('[aurelia-app],[data-aurelia-app]');
        for (var i = 0, ii = appHosts.length; i < ii; ++i) {
            var appHost = appHosts[i];
            var mainModuleId = appHost.getAttribute('aurelia-app') || appHost.getAttribute('data-aurelia-app');
            bootstrap(config.bind(null, appHost, mainModuleId));
        }
        var toConsole = console.error.bind(console);
        var bootstraps = bootstrapPromises.map(function (p) { return p.catch(toConsole); });
        bootstrapPromises = null;
        return Promise.all(bootstraps);
    });
}
function bootstrap(configure) {
    var p = startPromise.then(function (factory) { return configure(factory()); });
    if (bootstrapPromises)
        bootstrapPromises.push(p);
    return p;
}
var starting = run();

exports.bootstrap = bootstrap;
exports.starting = starting;


});
;
define('aurelia-dependency-injection/dist/commonjs/aurelia-dependency-injection',['require','exports','module','aurelia-metadata','aurelia-pal'],function (require, exports, module) {'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var aureliaMetadata = require('aurelia-metadata');
var aureliaPal = require('aurelia-pal');

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */

function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}

function __metadata(metadataKey, metadataValue) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
}

function isInjectable(potentialTarget) {
    return !!potentialTarget;
}
function autoinject(potentialTarget) {
    var deco = function (target) {
        if (!target.hasOwnProperty('inject')) {
            target.inject = (aureliaMetadata.metadata.getOwn(aureliaMetadata.metadata.paramTypes, target) ||
                _emptyParameters).slice();
            if (target.inject && target.inject.length > 0) {
                if (target.inject[target.inject.length - 1] === Object) {
                    target.inject.splice(-1, 1);
                }
            }
        }
    };
    if (isInjectable(potentialTarget)) {
        return deco(potentialTarget);
    }
    return deco;
}
function inject() {
    var rest = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        rest[_i] = arguments[_i];
    }
    return function (target, _key, descriptor) {
        if (typeof descriptor === 'number') {
            autoinject(target);
            if (rest.length === 1) {
                target.inject[descriptor] = rest[0];
            }
            return;
        }
        if (descriptor) {
            var fn = descriptor.value;
            fn.inject = rest;
        }
        else {
            target.inject = rest;
        }
    };
}

var resolver = aureliaMetadata.protocol.create('aurelia:resolver', function (target) {
    if (!(typeof target.get === 'function')) {
        return 'Resolvers must implement: get(container: Container, key: any): any';
    }
    return true;
});
(function (Strategy) {
    Strategy[Strategy["instance"] = 0] = "instance";
    Strategy[Strategy["singleton"] = 1] = "singleton";
    Strategy[Strategy["transient"] = 2] = "transient";
    Strategy[Strategy["function"] = 3] = "function";
    Strategy[Strategy["array"] = 4] = "array";
    Strategy[Strategy["alias"] = 5] = "alias";
})(exports.Strategy || (exports.Strategy = {}));
function isStrategy(actual, expected, state) {
    return actual === expected;
}
var StrategyResolver = (function () {
    function StrategyResolver(strategy, state) {
        this.strategy = strategy;
        this.state = state;
    }
    StrategyResolver.prototype.get = function (container, key) {
        if (isStrategy(this.strategy, exports.Strategy.instance, this.state)) {
            return this.state;
        }
        if (isStrategy(this.strategy, exports.Strategy.singleton, this.state)) {
            var singleton = container.invoke(this.state);
            this.state = singleton;
            this.strategy = 0;
            return singleton;
        }
        if (isStrategy(this.strategy, exports.Strategy.transient, this.state)) {
            return container.invoke(this.state);
        }
        if (isStrategy(this.strategy, exports.Strategy.function, this.state)) {
            return this.state(container, key, this);
        }
        if (isStrategy(this.strategy, exports.Strategy.array, this.state)) {
            return this.state[0].get(container, key);
        }
        if (isStrategy(this.strategy, exports.Strategy.alias, this.state)) {
            return container.get(this.state);
        }
        throw new Error('Invalid strategy: ' + this.strategy);
    };
    StrategyResolver = __decorate([
        resolver(),
        __metadata("design:paramtypes", [Number, Object])
    ], StrategyResolver);
    return StrategyResolver;
}());
var Lazy = (function () {
    function Lazy(key) {
        this._key = key;
    }
    Lazy_1 = Lazy;
    Lazy.prototype.get = function (container) {
        var _this = this;
        return function () { return container.get(_this._key); };
    };
    Lazy.of = function (key) {
        return new Lazy_1(key);
    };
    var Lazy_1;
    Lazy = Lazy_1 = __decorate([
        resolver(),
        __metadata("design:paramtypes", [Object])
    ], Lazy);
    return Lazy;
}());
var All = (function () {
    function All(key) {
        this._key = key;
    }
    All_1 = All;
    All.prototype.get = function (container) {
        return container.getAll(this._key);
    };
    All.of = function (key) {
        return new All_1(key);
    };
    var All_1;
    All = All_1 = __decorate([
        resolver(),
        __metadata("design:paramtypes", [Object])
    ], All);
    return All;
}());
var Optional = (function () {
    function Optional(key, checkParent) {
        if (checkParent === void 0) { checkParent = true; }
        this._key = key;
        this._checkParent = checkParent;
    }
    Optional_1 = Optional;
    Optional.prototype.get = function (container) {
        if (container.hasResolver(this._key, this._checkParent)) {
            return container.get(this._key);
        }
        return null;
    };
    Optional.of = function (key, checkParent) {
        if (checkParent === void 0) { checkParent = true; }
        return new Optional_1(key, checkParent);
    };
    var Optional_1;
    Optional = Optional_1 = __decorate([
        resolver(),
        __metadata("design:paramtypes", [Object, Boolean])
    ], Optional);
    return Optional;
}());
var Parent = (function () {
    function Parent(key) {
        this._key = key;
    }
    Parent_1 = Parent;
    Parent.prototype.get = function (container) {
        return container.parent ? container.parent.get(this._key) : null;
    };
    Parent.of = function (key) {
        return new Parent_1(key);
    };
    var Parent_1;
    Parent = Parent_1 = __decorate([
        resolver(),
        __metadata("design:paramtypes", [Object])
    ], Parent);
    return Parent;
}());
var Factory = (function () {
    function Factory(key) {
        this._key = key;
    }
    Factory_1 = Factory;
    Factory.prototype.get = function (container) {
        var fn = this._key;
        var resolver = container.getResolver(fn);
        if (resolver && resolver.strategy === exports.Strategy.function) {
            fn = resolver.state;
        }
        return function () {
            var rest = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                rest[_i] = arguments[_i];
            }
            return container.invoke(fn, rest);
        };
    };
    Factory.of = function (key) {
        return new Factory_1(key);
    };
    var Factory_1;
    Factory = Factory_1 = __decorate([
        resolver(),
        __metadata("design:paramtypes", [Object])
    ], Factory);
    return Factory;
}());
var NewInstance = (function () {
    function NewInstance(key) {
        var dynamicDependencies = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            dynamicDependencies[_i - 1] = arguments[_i];
        }
        this.key = key;
        this.asKey = key;
        this.dynamicDependencies = dynamicDependencies;
    }
    NewInstance_1 = NewInstance;
    NewInstance.prototype.get = function (container) {
        var dynamicDependencies = this.dynamicDependencies.length > 0
            ? this.dynamicDependencies.map(function (dependency) {
                return dependency['protocol:aurelia:resolver']
                    ? dependency.get(container)
                    : container.get(dependency);
            })
            : undefined;
        var fn = this.key;
        var resolver = container.getResolver(fn);
        if (resolver && resolver.strategy === 3) {
            fn = resolver.state;
        }
        var instance = container.invoke(fn, dynamicDependencies);
        container.registerInstance(this.asKey, instance);
        return instance;
    };
    NewInstance.prototype.as = function (key) {
        this.asKey = key;
        return this;
    };
    NewInstance.of = function (key) {
        var dynamicDependencies = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            dynamicDependencies[_i - 1] = arguments[_i];
        }
        return new (NewInstance_1.bind.apply(NewInstance_1, [void 0, key].concat(dynamicDependencies)))();
    };
    var NewInstance_1;
    NewInstance = NewInstance_1 = __decorate([
        resolver(),
        __metadata("design:paramtypes", [Object, Object])
    ], NewInstance);
    return NewInstance;
}());
function getDecoratorDependencies(target) {
    autoinject(target);
    return target.inject;
}
function lazy(keyValue) {
    return function (target, _key, index) {
        var inject$$1 = getDecoratorDependencies(target);
        inject$$1[index] = Lazy.of(keyValue);
    };
}
function all(keyValue) {
    return function (target, _key, index) {
        var inject$$1 = getDecoratorDependencies(target);
        inject$$1[index] = All.of(keyValue);
    };
}
function optional(checkParentOrTarget) {
    if (checkParentOrTarget === void 0) { checkParentOrTarget = true; }
    var deco = function (checkParent) {
        return function (target, _key, index) {
            var inject$$1 = getDecoratorDependencies(target);
            inject$$1[index] = Optional.of(inject$$1[index], checkParent);
        };
    };
    if (typeof checkParentOrTarget === 'boolean') {
        return deco(checkParentOrTarget);
    }
    return deco(true);
}
function parent(target, _key, index) {
    var inject$$1 = getDecoratorDependencies(target);
    inject$$1[index] = Parent.of(inject$$1[index]);
}
function factory(keyValue) {
    return function (target, _key, index) {
        var inject$$1 = getDecoratorDependencies(target);
        inject$$1[index] = Factory.of(keyValue);
    };
}
function newInstance(asKeyOrTarget) {
    var dynamicDependencies = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        dynamicDependencies[_i - 1] = arguments[_i];
    }
    var deco = function (asKey) {
        return function (target, _key, index) {
            var inject$$1 = getDecoratorDependencies(target);
            inject$$1[index] = NewInstance.of.apply(NewInstance, [inject$$1[index]].concat(dynamicDependencies));
            if (!!asKey) {
                inject$$1[index].as(asKey);
            }
        };
    };
    if (arguments.length >= 1) {
        return deco(asKeyOrTarget);
    }
    return deco();
}

function validateKey(key) {
    if (key === null || key === undefined) {
        throw new Error('key/value cannot be null or undefined. Are you trying to inject/register something that doesn\'t exist with DI?');
    }
}
var _emptyParameters = Object.freeze([]);
aureliaMetadata.metadata.registration = 'aurelia:registration';
aureliaMetadata.metadata.invoker = 'aurelia:invoker';
var resolverDecorates = resolver.decorates;
var InvocationHandler = (function () {
    function InvocationHandler(fn, invoker, dependencies) {
        this.fn = fn;
        this.invoker = invoker;
        this.dependencies = dependencies;
    }
    InvocationHandler.prototype.invoke = function (container, dynamicDependencies) {
        return dynamicDependencies !== undefined
            ? this.invoker.invokeWithDynamicDependencies(container, this.fn, this.dependencies, dynamicDependencies)
            : this.invoker.invoke(container, this.fn, this.dependencies);
    };
    return InvocationHandler;
}());
function invokeWithDynamicDependencies(container, fn, staticDependencies, dynamicDependencies) {
    var i = staticDependencies.length;
    var args = new Array(i);
    var lookup;
    while (i--) {
        lookup = staticDependencies[i];
        if (lookup === null || lookup === undefined) {
            throw new Error('Constructor Parameter with index ' +
                i +
                ' cannot be null or undefined. Are you trying to inject/register something that doesn\'t exist with DI?');
        }
        else {
            args[i] = container.get(lookup);
        }
    }
    if (dynamicDependencies !== undefined) {
        args = args.concat(dynamicDependencies);
    }
    return Reflect.construct(fn, args);
}
var classInvoker = {
    invoke: function (container, Type, deps) {
        var instances = deps.map(function (dep) { return container.get(dep); });
        return Reflect.construct(Type, instances);
    },
    invokeWithDynamicDependencies: invokeWithDynamicDependencies
};
function getDependencies(f) {
    if (!f.hasOwnProperty('inject')) {
        return [];
    }
    if (typeof f.inject === 'function') {
        return f.inject();
    }
    return f.inject;
}
var Container = (function () {
    function Container(configuration) {
        if (configuration === undefined) {
            configuration = {};
        }
        this._configuration = configuration;
        this._onHandlerCreated = configuration.onHandlerCreated;
        this._handlers =
            configuration.handlers || (configuration.handlers = new Map());
        this._resolvers = new Map();
        this.root = this;
        this.parent = null;
    }
    Container.prototype.makeGlobal = function () {
        Container.instance = this;
        return this;
    };
    Container.prototype.setHandlerCreatedCallback = function (onHandlerCreated) {
        this._onHandlerCreated = onHandlerCreated;
        this._configuration.onHandlerCreated = onHandlerCreated;
    };
    Container.prototype.registerInstance = function (key, instance) {
        return this.registerResolver(key, new StrategyResolver(0, instance === undefined ? key : instance));
    };
    Container.prototype.registerSingleton = function (key, fn) {
        return this.registerResolver(key, new StrategyResolver(1, fn === undefined ? key : fn));
    };
    Container.prototype.registerTransient = function (key, fn) {
        return this.registerResolver(key, new StrategyResolver(2, fn === undefined ? key : fn));
    };
    Container.prototype.registerHandler = function (key, handler) {
        return this.registerResolver(key, new StrategyResolver(3, handler));
    };
    Container.prototype.registerAlias = function (originalKey, aliasKey) {
        return this.registerResolver(aliasKey, new StrategyResolver(5, originalKey));
    };
    Container.prototype.registerResolver = function (key, resolver$$1) {
        validateKey(key);
        var allResolvers = this._resolvers;
        var result = allResolvers.get(key);
        if (result === undefined) {
            allResolvers.set(key, resolver$$1);
        }
        else if (result.strategy === 4) {
            result.state.push(resolver$$1);
        }
        else {
            allResolvers.set(key, new StrategyResolver(4, [result, resolver$$1]));
        }
        return resolver$$1;
    };
    Container.prototype.autoRegister = function (key, fn) {
        fn = fn === undefined ? key : fn;
        if (typeof fn === 'function') {
            var registration = aureliaMetadata.metadata.get(aureliaMetadata.metadata.registration, fn);
            if (registration === undefined) {
                return this.registerResolver(key, new StrategyResolver(1, fn));
            }
            return registration.registerResolver(this, key, fn);
        }
        return this.registerResolver(key, new StrategyResolver(0, fn));
    };
    Container.prototype.autoRegisterAll = function (fns) {
        var i = fns.length;
        while (i--) {
            this.autoRegister(fns[i]);
        }
    };
    Container.prototype.unregister = function (key) {
        this._resolvers.delete(key);
    };
    Container.prototype.hasResolver = function (key, checkParent) {
        if (checkParent === void 0) { checkParent = false; }
        validateKey(key);
        return (this._resolvers.has(key) ||
            (checkParent &&
                this.parent !== null &&
                this.parent.hasResolver(key, checkParent)));
    };
    Container.prototype.getResolver = function (key) {
        return this._resolvers.get(key);
    };
    Container.prototype.get = function (key) {
        validateKey(key);
        if (key === Container) {
            return this;
        }
        if (resolverDecorates(key)) {
            return key.get(this, key);
        }
        var resolver$$1 = this._resolvers.get(key);
        if (resolver$$1 === undefined) {
            if (this.parent === null) {
                return this.autoRegister(key).get(this, key);
            }
            var registration = aureliaMetadata.metadata.get(aureliaMetadata.metadata.registration, key);
            if (registration === undefined) {
                return this.parent._get(key);
            }
            return registration.registerResolver(this, key, key).get(this, key);
        }
        return resolver$$1.get(this, key);
    };
    Container.prototype._get = function (key) {
        var resolver$$1 = this._resolvers.get(key);
        if (resolver$$1 === undefined) {
            if (this.parent === null) {
                return this.autoRegister(key).get(this, key);
            }
            return this.parent._get(key);
        }
        return resolver$$1.get(this, key);
    };
    Container.prototype.getAll = function (key) {
        validateKey(key);
        var resolver$$1 = this._resolvers.get(key);
        if (resolver$$1 === undefined) {
            if (this.parent === null) {
                return _emptyParameters;
            }
            return this.parent.getAll(key);
        }
        if (resolver$$1.strategy === 4) {
            var state = resolver$$1.state;
            var i = state.length;
            var results = new Array(i);
            while (i--) {
                results[i] = state[i].get(this, key);
            }
            return results;
        }
        return [resolver$$1.get(this, key)];
    };
    Container.prototype.createChild = function () {
        var child = new Container(this._configuration);
        child.root = this.root;
        child.parent = this;
        return child;
    };
    Container.prototype.invoke = function (fn, dynamicDependencies) {
        try {
            var handler = this._handlers.get(fn);
            if (handler === undefined) {
                handler = this._createInvocationHandler(fn);
                this._handlers.set(fn, handler);
            }
            return handler.invoke(this, dynamicDependencies);
        }
        catch (e) {
            throw new aureliaPal.AggregateError("Error invoking " + fn.name + ". Check the inner error for details.", e, true);
        }
    };
    Container.prototype._createInvocationHandler = function (fn) {
        var dependencies;
        if (fn.inject === undefined) {
            dependencies =
                aureliaMetadata.metadata.getOwn(aureliaMetadata.metadata.paramTypes, fn) || _emptyParameters;
        }
        else {
            dependencies = [];
            var ctor = fn;
            while (typeof ctor === 'function') {
                dependencies.push.apply(dependencies, getDependencies(ctor));
                ctor = Object.getPrototypeOf(ctor);
            }
        }
        var invoker = aureliaMetadata.metadata.getOwn(aureliaMetadata.metadata.invoker, fn) || classInvoker;
        var handler = new InvocationHandler(fn, invoker, dependencies);
        return this._onHandlerCreated !== undefined
            ? this._onHandlerCreated(handler)
            : handler;
    };
    return Container;
}());

function invoker(value) {
    return function (target) {
        aureliaMetadata.metadata.define(aureliaMetadata.metadata.invoker, value, target);
    };
}
function invokeAsFactory(potentialTarget) {
    var deco = function (target) {
        aureliaMetadata.metadata.define(aureliaMetadata.metadata.invoker, FactoryInvoker.instance, target);
    };
    return potentialTarget ? deco(potentialTarget) : deco;
}
var FactoryInvoker = (function () {
    function FactoryInvoker() {
    }
    FactoryInvoker.prototype.invoke = function (container, fn, dependencies) {
        var i = dependencies.length;
        var args = new Array(i);
        while (i--) {
            args[i] = container.get(dependencies[i]);
        }
        return fn.apply(undefined, args);
    };
    FactoryInvoker.prototype.invokeWithDynamicDependencies = function (container, fn, staticDependencies, dynamicDependencies) {
        var i = staticDependencies.length;
        var args = new Array(i);
        while (i--) {
            args[i] = container.get(staticDependencies[i]);
        }
        if (dynamicDependencies !== undefined) {
            args = args.concat(dynamicDependencies);
        }
        return fn.apply(undefined, args);
    };
    return FactoryInvoker;
}());
FactoryInvoker.instance = new FactoryInvoker();

function registration(value) {
    return function (target) {
        aureliaMetadata.metadata.define(aureliaMetadata.metadata.registration, value, target);
    };
}
function transient(key) {
    return registration(new TransientRegistration(key));
}
function singleton(keyOrRegisterInChild, registerInChild) {
    if (registerInChild === void 0) { registerInChild = false; }
    return registration(new SingletonRegistration(keyOrRegisterInChild, registerInChild));
}
var TransientRegistration = (function () {
    function TransientRegistration(key) {
        this._key = key;
    }
    TransientRegistration.prototype.registerResolver = function (container, key, fn) {
        var existingResolver = container.getResolver(this._key || key);
        return existingResolver === undefined
            ? container.registerTransient((this._key || key), fn)
            : existingResolver;
    };
    return TransientRegistration;
}());
var SingletonRegistration = (function () {
    function SingletonRegistration(keyOrRegisterInChild, registerInChild) {
        if (registerInChild === void 0) { registerInChild = false; }
        if (typeof keyOrRegisterInChild === 'boolean') {
            this._registerInChild = keyOrRegisterInChild;
        }
        else {
            this._key = keyOrRegisterInChild;
            this._registerInChild = registerInChild;
        }
    }
    SingletonRegistration.prototype.registerResolver = function (container, key, fn) {
        var targetContainer = this._registerInChild ? container : container.root;
        var existingResolver = targetContainer.getResolver(this._key || key);
        return existingResolver === undefined
            ? targetContainer.registerSingleton(this._key || key, fn)
            : existingResolver;
    };
    return SingletonRegistration;
}());

exports._emptyParameters = _emptyParameters;
exports.InvocationHandler = InvocationHandler;
exports.Container = Container;
exports.autoinject = autoinject;
exports.inject = inject;
exports.invoker = invoker;
exports.invokeAsFactory = invokeAsFactory;
exports.FactoryInvoker = FactoryInvoker;
exports.registration = registration;
exports.transient = transient;
exports.singleton = singleton;
exports.TransientRegistration = TransientRegistration;
exports.SingletonRegistration = SingletonRegistration;
exports.resolver = resolver;
exports.StrategyResolver = StrategyResolver;
exports.Lazy = Lazy;
exports.All = All;
exports.Optional = Optional;
exports.Parent = Parent;
exports.Factory = Factory;
exports.NewInstance = NewInstance;
exports.getDecoratorDependencies = getDecoratorDependencies;
exports.lazy = lazy;
exports.all = all;
exports.optional = optional;
exports.parent = parent;
exports.factory = factory;
exports.newInstance = newInstance;

});
;
define('aurelia-framework/dist/commonjs/aurelia-framework',['require','exports','module','aurelia-dependency-injection','aurelia-binding','aurelia-metadata','aurelia-templating','aurelia-loader','aurelia-task-queue','aurelia-path','aurelia-pal','aurelia-logging'],function (require, exports, module) {'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var aureliaDependencyInjection = require('aurelia-dependency-injection');
var aureliaBinding = require('aurelia-binding');
var aureliaMetadata = require('aurelia-metadata');
var aureliaTemplating = require('aurelia-templating');
var aureliaLoader = require('aurelia-loader');
var aureliaTaskQueue = require('aurelia-task-queue');
var aureliaPath = require('aurelia-path');
var aureliaPal = require('aurelia-pal');
var TheLogManager = require('aurelia-logging');

function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n["default"] = e;
    return Object.freeze(n);
}

var TheLogManager__namespace = /*#__PURE__*/_interopNamespace(TheLogManager);

var logger = TheLogManager__namespace.getLogger('aurelia');
var extPattern = /\.[^/.]+$/;
function runTasks(config, tasks) {
    var current;
    var next = function () {
        current = tasks.shift();
        if (current) {
            return Promise.resolve(current(config)).then(next);
        }
        return Promise.resolve();
    };
    return next();
}
function loadPlugin(fwConfig, loader, info) {
    logger.debug("Loading plugin ".concat(info.moduleId, "."));
    if (typeof info.moduleId === 'string') {
        fwConfig.resourcesRelativeTo = info.resourcesRelativeTo;
        var id = info.moduleId;
        if (info.resourcesRelativeTo.length > 1) {
            return loader.normalize(info.moduleId, info.resourcesRelativeTo[1])
                .then(function (normalizedId) { return _loadPlugin(normalizedId); });
        }
        return _loadPlugin(id);
    }
    else if (typeof info.configure === 'function') {
        if (fwConfig.configuredPlugins.indexOf(info.configure) !== -1) {
            return Promise.resolve();
        }
        fwConfig.configuredPlugins.push(info.configure);
        return Promise.resolve(info.configure.call(null, fwConfig, info.config || {}));
    }
    throw new Error(invalidConfigMsg(info.moduleId || info.configure, 'plugin'));
    function _loadPlugin(moduleId) {
        return loader.loadModule(moduleId).then(function (m) {
            if ('configure' in m) {
                if (fwConfig.configuredPlugins.indexOf(m.configure) !== -1) {
                    return Promise.resolve();
                }
                return Promise.resolve(m.configure(fwConfig, info.config || {})).then(function () {
                    fwConfig.configuredPlugins.push(m.configure);
                    fwConfig.resourcesRelativeTo = null;
                    logger.debug("Configured plugin ".concat(info.moduleId, "."));
                });
            }
            fwConfig.resourcesRelativeTo = null;
            logger.debug("Loaded plugin ".concat(info.moduleId, "."));
        });
    }
}
function loadResources(aurelia, resourcesToLoad, appResources) {
    if (Object.keys(resourcesToLoad).length === 0) {
        return Promise.resolve();
    }
    var viewEngine = aurelia.container.get(aureliaTemplating.ViewEngine);
    return Promise.all(Object.keys(resourcesToLoad).map(function (n) { return _normalize(resourcesToLoad[n]); }))
        .then(function (loads) {
        var names = [];
        var importIds = [];
        loads.forEach(function (l) {
            names.push(undefined);
            importIds.push(l.importId);
        });
        return viewEngine.importViewResources(importIds, names, appResources);
    });
    function _normalize(load) {
        var moduleId = load.moduleId;
        var ext = getExt(moduleId);
        if (isOtherResource(moduleId)) {
            moduleId = removeExt(moduleId);
        }
        return aurelia.loader.normalize(moduleId, load.relativeTo)
            .then(function (normalized) {
            return {
                name: load.moduleId,
                importId: isOtherResource(load.moduleId) ? addOriginalExt(normalized, ext) : normalized
            };
        });
    }
    function isOtherResource(name) {
        var ext = getExt(name);
        if (!ext)
            return false;
        if (ext === '')
            return false;
        if (ext === '.js' || ext === '.ts')
            return false;
        return true;
    }
    function removeExt(name) {
        return name.replace(extPattern, '');
    }
    function addOriginalExt(normalized, ext) {
        return removeExt(normalized) + '.' + ext;
    }
}
function getExt(name) {
    var match = name.match(extPattern);
    if (match && match.length > 0) {
        return (match[0].split('.'))[1];
    }
}
function loadBehaviors(config) {
    return Promise.all(config.behaviorsToLoad.map(function (m) { return m.load(config.container, m.target); })).then(function () {
        config.behaviorsToLoad = null;
    });
}
function assertProcessed(plugins) {
    if (plugins.processed) {
        throw new Error('This config instance has already been applied. To load more plugins or global resources, create a new FrameworkConfiguration instance.');
    }
}
function invalidConfigMsg(cfg, type) {
    return "Invalid ".concat(type, " [").concat(cfg, "], ").concat(type, " must be specified as functions or relative module IDs.");
}
var FrameworkConfiguration = (function () {
    function FrameworkConfiguration(aurelia) {
        var _this = this;
        this.aurelia = aurelia;
        this.container = aurelia.container;
        this.info = [];
        this.processed = false;
        this.preTasks = [];
        this.postTasks = [];
        this.behaviorsToLoad = [];
        this.configuredPlugins = [];
        this.resourcesToLoad = {};
        this.preTask(function () { return aurelia.loader.normalize('aurelia-bootstrapper', undefined)
            .then(function (name) { return _this.bootstrapperName = name; }); });
        this.postTask(function () { return loadResources(aurelia, _this.resourcesToLoad, aurelia.resources); });
    }
    FrameworkConfiguration.prototype.instance = function (type, instance) {
        this.container.registerInstance(type, instance);
        return this;
    };
    FrameworkConfiguration.prototype.singleton = function (type, implementation) {
        this.container.registerSingleton(type, implementation);
        return this;
    };
    FrameworkConfiguration.prototype.transient = function (type, implementation) {
        this.container.registerTransient(type, implementation);
        return this;
    };
    FrameworkConfiguration.prototype.preTask = function (task) {
        assertProcessed(this);
        this.preTasks.push(task);
        return this;
    };
    FrameworkConfiguration.prototype.postTask = function (task) {
        assertProcessed(this);
        this.postTasks.push(task);
        return this;
    };
    FrameworkConfiguration.prototype.feature = function (plugin, config) {
        if (config === void 0) { config = {}; }
        switch (typeof plugin) {
            case 'string':
                var hasIndex = /\/index$/i.test(plugin);
                var moduleId = hasIndex || getExt(plugin) ? plugin : plugin + '/index';
                var root = hasIndex ? plugin.slice(0, -6) : plugin;
                this.info.push({ moduleId: moduleId, resourcesRelativeTo: [root, ''], config: config });
                break;
            case 'function':
                this.info.push({ configure: plugin, config: config || {} });
                break;
            default:
                throw new Error(invalidConfigMsg(plugin, 'feature'));
        }
        return this;
    };
    FrameworkConfiguration.prototype.globalResources = function (resources) {
        var _this = this;
        assertProcessed(this);
        var toAdd = Array.isArray(resources) ? resources : arguments;
        var resource;
        var resourcesRelativeTo = this.resourcesRelativeTo || ['', ''];
        for (var i = 0, ii = toAdd.length; i < ii; ++i) {
            resource = toAdd[i];
            switch (typeof resource) {
                case 'string':
                    var parent_1 = resourcesRelativeTo[0];
                    var grandParent = resourcesRelativeTo[1];
                    var name_1 = resource;
                    if ((resource.startsWith('./') || resource.startsWith('../')) && parent_1 !== '') {
                        name_1 = aureliaPath.join(parent_1, resource);
                    }
                    this.resourcesToLoad[name_1] = { moduleId: name_1, relativeTo: grandParent };
                    break;
                case 'function':
                    var meta = this.aurelia.resources.autoRegister(this.container, resource);
                    if (meta instanceof aureliaTemplating.HtmlBehaviorResource && meta.elementName !== null) {
                        if (this.behaviorsToLoad.push(meta) === 1) {
                            this.postTask(function () { return loadBehaviors(_this); });
                        }
                    }
                    break;
                default:
                    throw new Error(invalidConfigMsg(resource, 'resource'));
            }
        }
        return this;
    };
    FrameworkConfiguration.prototype.globalName = function (resourcePath, newName) {
        assertProcessed(this);
        this.resourcesToLoad[resourcePath] = { moduleId: newName, relativeTo: '' };
        return this;
    };
    FrameworkConfiguration.prototype.plugin = function (plugin, pluginConfig) {
        assertProcessed(this);
        var info;
        switch (typeof plugin) {
            case 'string':
                info = { moduleId: plugin, resourcesRelativeTo: [plugin, ''], config: pluginConfig || {} };
                break;
            case 'function':
                info = { configure: plugin, config: pluginConfig || {} };
                break;
            default:
                throw new Error(invalidConfigMsg(plugin, 'plugin'));
        }
        this.info.push(info);
        return this;
    };
    FrameworkConfiguration.prototype._addNormalizedPlugin = function (name, config) {
        var _this = this;
        var plugin = { moduleId: name, resourcesRelativeTo: [name, ''], config: config || {} };
        this.info.push(plugin);
        this.preTask(function () {
            var relativeTo = [name, _this.bootstrapperName];
            plugin.moduleId = name;
            plugin.resourcesRelativeTo = relativeTo;
            return Promise.resolve();
        });
        return this;
    };
    FrameworkConfiguration.prototype.defaultBindingLanguage = function () {
        return this._addNormalizedPlugin('aurelia-templating-binding');
    };
    FrameworkConfiguration.prototype.router = function () {
        return this._addNormalizedPlugin('aurelia-templating-router');
    };
    FrameworkConfiguration.prototype.history = function () {
        return this._addNormalizedPlugin('aurelia-history-browser');
    };
    FrameworkConfiguration.prototype.defaultResources = function () {
        return this._addNormalizedPlugin('aurelia-templating-resources');
    };
    FrameworkConfiguration.prototype.eventAggregator = function () {
        return this._addNormalizedPlugin('aurelia-event-aggregator');
    };
    FrameworkConfiguration.prototype.basicConfiguration = function () {
        return this.defaultBindingLanguage().defaultResources().eventAggregator();
    };
    FrameworkConfiguration.prototype.standardConfiguration = function () {
        return this.basicConfiguration().history().router();
    };
    FrameworkConfiguration.prototype.developmentLogging = function (level) {
        var _this = this;
        var logLevel = level ? TheLogManager__namespace.logLevel[level] : undefined;
        if (logLevel === undefined) {
            logLevel = TheLogManager__namespace.logLevel.debug;
        }
        this.preTask(function () {
            return _this.aurelia.loader.normalize('aurelia-logging-console', _this.bootstrapperName).then(function (name) {
                return _this.aurelia.loader.loadModule(name).then(function (m) {
                    TheLogManager__namespace.addAppender(new m.ConsoleAppender());
                    TheLogManager__namespace.setLevel(logLevel);
                });
            });
        });
        return this;
    };
    FrameworkConfiguration.prototype.apply = function () {
        var _this = this;
        if (this.processed) {
            return Promise.resolve();
        }
        return runTasks(this, this.preTasks).then(function () {
            var loader = _this.aurelia.loader;
            var info = _this.info;
            var current;
            var next = function () {
                current = info.shift();
                if (current) {
                    return loadPlugin(_this, loader, current).then(next);
                }
                _this.processed = true;
                _this.configuredPlugins = null;
                return Promise.resolve();
            };
            return next().then(function () { return runTasks(_this, _this.postTasks); });
        });
    };
    return FrameworkConfiguration;
}());

function preventActionlessFormSubmit() {
    aureliaPal.DOM.addEventListener('submit', function (evt) {
        var target = evt.target;
        var action = target.action;
        if (target.tagName.toLowerCase() === 'form' && !action) {
            evt.preventDefault();
        }
    }, false);
}
var Aurelia = (function () {
    function Aurelia(loader, container, resources) {
        this.loader = loader || new aureliaPal.PLATFORM.Loader();
        this.container = container || (new aureliaDependencyInjection.Container()).makeGlobal();
        this.resources = resources || new aureliaTemplating.ViewResources();
        this.use = new FrameworkConfiguration(this);
        this.logger = TheLogManager__namespace.getLogger('aurelia');
        this.hostConfigured = false;
        this.host = null;
        this.use.instance(Aurelia, this);
        this.use.instance(aureliaLoader.Loader, this.loader);
        this.use.instance(aureliaTemplating.ViewResources, this.resources);
    }
    Aurelia.prototype.start = function () {
        var _this = this;
        if (this._started) {
            return this._started;
        }
        this.logger.info('Aurelia Starting');
        return this._started = this.use.apply().then(function () {
            preventActionlessFormSubmit();
            if (!_this.container.hasResolver(aureliaTemplating.BindingLanguage)) {
                var message = 'You must configure Aurelia with a BindingLanguage implementation.';
                _this.logger.error(message);
                throw new Error(message);
            }
            _this.logger.info('Aurelia Started');
            var evt = aureliaPal.DOM.createCustomEvent('aurelia-started', { bubbles: true, cancelable: true });
            aureliaPal.DOM.dispatchEvent(evt);
            return _this;
        });
    };
    Aurelia.prototype.enhance = function (bindingContext, applicationHost) {
        var _this = this;
        if (bindingContext === void 0) { bindingContext = {}; }
        if (applicationHost === void 0) { applicationHost = null; }
        this._configureHost(applicationHost || aureliaPal.DOM.querySelectorAll('body')[0]);
        return new Promise(function (resolve) {
            var engine = _this.container.get(aureliaTemplating.TemplatingEngine);
            _this.root = engine.enhance({ container: _this.container, element: _this.host, resources: _this.resources, bindingContext: bindingContext });
            _this.root.attached();
            _this._onAureliaComposed();
            resolve(_this);
        });
    };
    Aurelia.prototype.setRoot = function (root, applicationHost) {
        var _this = this;
        if (root === void 0) { root = null; }
        if (applicationHost === void 0) { applicationHost = null; }
        var instruction = {};
        if (this.root && this.root.viewModel && this.root.viewModel.router) {
            this.root.viewModel.router.deactivate();
            this.root.viewModel.router.reset();
        }
        this._configureHost(applicationHost);
        var engine = this.container.get(aureliaTemplating.TemplatingEngine);
        var transaction = this.container.get(aureliaTemplating.CompositionTransaction);
        delete transaction.initialComposition;
        if (!root) {
            if (this.configModuleId) {
                root = aureliaPath.relativeToFile('./app', this.configModuleId);
            }
            else {
                root = 'app';
            }
        }
        instruction.viewModel = root;
        instruction.container = instruction.childContainer = this.container;
        instruction.viewSlot = this.hostSlot;
        instruction.host = this.host;
        return engine.compose(instruction).then(function (r) {
            _this.root = r;
            instruction.viewSlot.attached();
            _this._onAureliaComposed();
            return _this;
        });
    };
    Aurelia.prototype._configureHost = function (applicationHost) {
        if (this.hostConfigured) {
            return;
        }
        applicationHost = applicationHost || this.host;
        if (!applicationHost || typeof applicationHost === 'string') {
            this.host = aureliaPal.DOM.getElementById(applicationHost || 'applicationHost');
        }
        else {
            this.host = applicationHost;
        }
        if (!this.host) {
            throw new Error('No applicationHost was specified.');
        }
        this.hostConfigured = true;
        this.host.aurelia = this;
        this.hostSlot = new aureliaTemplating.ViewSlot(this.host, true);
        this.hostSlot.transformChildNodesIntoView();
        this.container.registerInstance(aureliaPal.DOM.boundary, this.host);
    };
    Aurelia.prototype._onAureliaComposed = function () {
        var evt = aureliaPal.DOM.createCustomEvent('aurelia-composed', { bubbles: true, cancelable: true });
        setTimeout(function () { return aureliaPal.DOM.dispatchEvent(evt); }, 1);
    };
    return Aurelia;
}());

exports.LogManager = TheLogManager__namespace;
exports.Aurelia = Aurelia;
exports.FrameworkConfiguration = FrameworkConfiguration;
Object.keys(aureliaDependencyInjection).forEach(function (k) {
    if (k !== 'default' && !exports.hasOwnProperty(k)) Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () { return aureliaDependencyInjection[k]; }
    });
});
Object.keys(aureliaBinding).forEach(function (k) {
    if (k !== 'default' && !exports.hasOwnProperty(k)) Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () { return aureliaBinding[k]; }
    });
});
Object.keys(aureliaMetadata).forEach(function (k) {
    if (k !== 'default' && !exports.hasOwnProperty(k)) Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () { return aureliaMetadata[k]; }
    });
});
Object.keys(aureliaTemplating).forEach(function (k) {
    if (k !== 'default' && !exports.hasOwnProperty(k)) Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () { return aureliaTemplating[k]; }
    });
});
Object.keys(aureliaLoader).forEach(function (k) {
    if (k !== 'default' && !exports.hasOwnProperty(k)) Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () { return aureliaLoader[k]; }
    });
});
Object.keys(aureliaTaskQueue).forEach(function (k) {
    if (k !== 'default' && !exports.hasOwnProperty(k)) Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () { return aureliaTaskQueue[k]; }
    });
});
Object.keys(aureliaPath).forEach(function (k) {
    if (k !== 'default' && !exports.hasOwnProperty(k)) Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () { return aureliaPath[k]; }
    });
});
Object.keys(aureliaPal).forEach(function (k) {
    if (k !== 'default' && !exports.hasOwnProperty(k)) Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () { return aureliaPal[k]; }
    });
});


});
;
define('aurelia-loader-default/dist/commonjs/aurelia-loader-default',['require','exports','module','aurelia-loader','aurelia-pal','aurelia-metadata'],function (require, exports, module) {'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DefaultLoader = exports.TextTemplateLoader = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _aureliaLoader = require('aurelia-loader');

var _aureliaPal = require('aurelia-pal');

var _aureliaMetadata = require('aurelia-metadata');

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }



var TextTemplateLoader = exports.TextTemplateLoader = function () {
  function TextTemplateLoader() {
    
  }

  TextTemplateLoader.prototype.loadTemplate = function loadTemplate(loader, entry) {
    return loader.loadText(entry.address).then(function (text) {
      entry.template = _aureliaPal.DOM.createTemplateFromMarkup(text);
    });
  };

  return TextTemplateLoader;
}();

function ensureOriginOnExports(executed, name) {
  var target = executed;
  var key = void 0;
  var exportedValue = void 0;

  if (target.__useDefault) {
    target = target['default'];
  }

  _aureliaMetadata.Origin.set(target, new _aureliaMetadata.Origin(name, 'default'));

  for (key in target) {
    exportedValue = target[key];

    if (typeof exportedValue === 'function') {
      _aureliaMetadata.Origin.set(exportedValue, new _aureliaMetadata.Origin(name, key));
    }
  }

  return executed;
}

var DefaultLoader = exports.DefaultLoader = function (_Loader) {
  _inherits(DefaultLoader, _Loader);

  function DefaultLoader() {
    

    var _this = _possibleConstructorReturn(this, _Loader.call(this));

    _this.textPluginName = 'text';


    _this.moduleRegistry = Object.create(null);
    _this.useTemplateLoader(new TextTemplateLoader());

    var that = _this;

    _this.addPlugin('template-registry-entry', {
      'fetch': function fetch(address) {
        var entry = that.getOrCreateTemplateRegistryEntry(address);
        return entry.templateIsLoaded ? entry : that.templateLoader.loadTemplate(that, entry).then(function (x) {
          return entry;
        });
      }
    });
    return _this;
  }

  DefaultLoader.prototype.useTemplateLoader = function useTemplateLoader(templateLoader) {
    this.templateLoader = templateLoader;
  };

  DefaultLoader.prototype.loadAllModules = function loadAllModules(ids) {
    var loads = [];

    for (var i = 0, ii = ids.length; i < ii; ++i) {
      loads.push(this.loadModule(ids[i]));
    }

    return Promise.all(loads);
  };

  DefaultLoader.prototype.loadTemplate = function loadTemplate(url) {
    return this._import(this.applyPluginToUrl(url, 'template-registry-entry'));
  };

  DefaultLoader.prototype.loadText = function loadText(url) {
    return this._import(this.applyPluginToUrl(url, this.textPluginName)).then(function (textOrModule) {
      if (typeof textOrModule === 'string') {
        return textOrModule;
      }

      return textOrModule['default'];
    });
  };

  return DefaultLoader;
}(_aureliaLoader.Loader);

_aureliaPal.PLATFORM.Loader = DefaultLoader;

if (!_aureliaPal.PLATFORM.global.System || !_aureliaPal.PLATFORM.global.System.import) {
  if (_aureliaPal.PLATFORM.global.requirejs) {
    var getDefined = void 0;
    if (_typeof(_aureliaPal.PLATFORM.global.requirejs.s) === 'object') {
      getDefined = function getDefined() {
        return _aureliaPal.PLATFORM.global.requirejs.s.contexts._.defined;
      };
    } else if (_typeof(_aureliaPal.PLATFORM.global.requirejs.contexts) === 'object') {
      getDefined = function getDefined() {
        return _aureliaPal.PLATFORM.global.requirejs.contexts._.defined;
      };
    } else if (typeof _aureliaPal.PLATFORM.global.requirejs.definedValues === 'function') {
      getDefined = function getDefined() {
        return _aureliaPal.PLATFORM.global.requirejs.definedValues();
      };
    } else {
      getDefined = function getDefined() {
        return {};
      };
    }
    _aureliaPal.PLATFORM.eachModule = function (callback) {
      var defined = getDefined();
      for (var key in defined) {
        try {
          if (callback(key, defined[key])) return;
        } catch (e) {}
      }
    };
  } else {
    _aureliaPal.PLATFORM.eachModule = function (callback) {};
  }

  DefaultLoader.prototype._import = function (moduleId) {
    return new Promise(function (resolve, reject) {
      _aureliaPal.PLATFORM.global.require([moduleId], resolve, reject);
    });
  };

  DefaultLoader.prototype.loadModule = function (id) {
    var _this2 = this;

    var existing = this.moduleRegistry[id];
    if (existing !== undefined) {
      return Promise.resolve(existing);
    }

    return new Promise(function (resolve, reject) {
      _aureliaPal.PLATFORM.global.require([id], function (m) {
        _this2.moduleRegistry[id] = m;
        resolve(ensureOriginOnExports(m, id));
      }, reject);
    });
  };

  DefaultLoader.prototype.map = function (id, source) {};

  DefaultLoader.prototype.normalize = function (moduleId, relativeTo) {
    return Promise.resolve(moduleId);
  };

  DefaultLoader.prototype.normalizeSync = function (moduleId, relativeTo) {
    return moduleId;
  };

  DefaultLoader.prototype.applyPluginToUrl = function (url, pluginName) {
    return pluginName + '!' + url;
  };

  DefaultLoader.prototype.addPlugin = function (pluginName, implementation) {
    var nonAnonDefine = define;
    nonAnonDefine(pluginName, [], {
      'load': function load(name, req, onload) {
        var result = implementation.fetch(name);
        Promise.resolve(result).then(onload);
      }
    });
  };
} else {
  _aureliaPal.PLATFORM.eachModule = function (callback) {
    if (System.registry) {
      var keys = Array.from(System.registry.keys());
      for (var i = 0; i < keys.length; i++) {
        try {
          var key = keys[i];
          if (callback(key, System.registry.get(key))) {
            return;
          }
        } catch (e) {}
      }
      return;
    }

    var modules = System._loader.modules;

    for (var _key in modules) {
      try {
        if (callback(_key, modules[_key].module)) return;
      } catch (e) {}
    }
  };

  DefaultLoader.prototype._import = function (moduleId) {
    return System.import(moduleId);
  };

  DefaultLoader.prototype.loadModule = function (id) {
    var _this3 = this;

    return System.normalize(id).then(function (newId) {
      var existing = _this3.moduleRegistry[newId];
      if (existing !== undefined) {
        return Promise.resolve(existing);
      }

      return System.import(newId).then(function (m) {
        _this3.moduleRegistry[newId] = m;
        return ensureOriginOnExports(m, newId);
      });
    });
  };

  DefaultLoader.prototype.map = function (id, source) {
    var _map;

    System.config({ map: (_map = {}, _map[id] = source, _map) });
  };

  DefaultLoader.prototype.normalizeSync = function (moduleId, relativeTo) {
    return System.normalizeSync(moduleId, relativeTo);
  };

  DefaultLoader.prototype.normalize = function (moduleId, relativeTo) {
    return System.normalize(moduleId, relativeTo);
  };

  DefaultLoader.prototype.applyPluginToUrl = function (url, pluginName) {
    return url + '!' + pluginName;
  };

  DefaultLoader.prototype.addPlugin = function (pluginName, implementation) {
    System.set(pluginName, System.newModule({
      'fetch': function fetch(load, _fetch) {
        var result = implementation.fetch(load.address);
        return Promise.resolve(result).then(function (x) {
          load.metadata.result = x;
          return '';
        });
      },
      'instantiate': function instantiate(load) {
        return load.metadata.result;
      }
    }));
  };
}
});
;
define('aurelia-loader/dist/commonjs/aurelia-loader',['require','exports','module','aurelia-path','aurelia-metadata'],function (require, exports, module) {'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Loader = exports.TemplateRegistryEntry = exports.TemplateDependency = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _aureliaPath = require('aurelia-path');

var _aureliaMetadata = require('aurelia-metadata');



var TemplateDependency = exports.TemplateDependency = function TemplateDependency(src, name) {
  

  this.src = src;
  this.name = name;
};

var TemplateRegistryEntry = exports.TemplateRegistryEntry = function () {
  function TemplateRegistryEntry(address) {
    

    this.templateIsLoaded = false;
    this.factoryIsReady = false;
    this.resources = null;
    this.dependencies = null;

    this.address = address;
    this.onReady = null;
    this._template = null;
    this._factory = null;
  }

  TemplateRegistryEntry.prototype.addDependency = function addDependency(src, name) {
    var finalSrc = typeof src === 'string' ? (0, _aureliaPath.relativeToFile)(src, this.address) : _aureliaMetadata.Origin.get(src).moduleId;

    this.dependencies.push(new TemplateDependency(finalSrc, name));
  };

  _createClass(TemplateRegistryEntry, [{
    key: 'template',
    get: function get() {
      return this._template;
    },
    set: function set(value) {
      var address = this.address;
      var requires = void 0;
      var current = void 0;
      var src = void 0;
      var dependencies = void 0;

      this._template = value;
      this.templateIsLoaded = true;

      requires = value.content.querySelectorAll('require');
      dependencies = this.dependencies = new Array(requires.length);

      for (var i = 0, ii = requires.length; i < ii; ++i) {
        current = requires[i];
        src = current.getAttribute('from');

        if (!src) {
          throw new Error('<require> element in ' + address + ' has no "from" attribute.');
        }

        dependencies[i] = new TemplateDependency((0, _aureliaPath.relativeToFile)(src, address), current.getAttribute('as'));

        if (current.parentNode) {
          current.parentNode.removeChild(current);
        }
      }
    }
  }, {
    key: 'factory',
    get: function get() {
      return this._factory;
    },
    set: function set(value) {
      this._factory = value;
      this.factoryIsReady = true;
    }
  }]);

  return TemplateRegistryEntry;
}();

var Loader = exports.Loader = function () {
  function Loader() {
    

    this.templateRegistry = {};
  }

  Loader.prototype.map = function map(id, source) {
    throw new Error('Loaders must implement map(id, source).');
  };

  Loader.prototype.normalizeSync = function normalizeSync(moduleId, relativeTo) {
    throw new Error('Loaders must implement normalizeSync(moduleId, relativeTo).');
  };

  Loader.prototype.normalize = function normalize(moduleId, relativeTo) {
    throw new Error('Loaders must implement normalize(moduleId: string, relativeTo: string): Promise<string>.');
  };

  Loader.prototype.loadModule = function loadModule(id) {
    throw new Error('Loaders must implement loadModule(id).');
  };

  Loader.prototype.loadAllModules = function loadAllModules(ids) {
    throw new Error('Loader must implement loadAllModules(ids).');
  };

  Loader.prototype.loadTemplate = function loadTemplate(url) {
    throw new Error('Loader must implement loadTemplate(url).');
  };

  Loader.prototype.loadText = function loadText(url) {
    throw new Error('Loader must implement loadText(url).');
  };

  Loader.prototype.applyPluginToUrl = function applyPluginToUrl(url, pluginName) {
    throw new Error('Loader must implement applyPluginToUrl(url, pluginName).');
  };

  Loader.prototype.addPlugin = function addPlugin(pluginName, implementation) {
    throw new Error('Loader must implement addPlugin(pluginName, implementation).');
  };

  Loader.prototype.getOrCreateTemplateRegistryEntry = function getOrCreateTemplateRegistryEntry(address) {
    return this.templateRegistry[address] || (this.templateRegistry[address] = new TemplateRegistryEntry(address));
  };

  return Loader;
}();
});
;
define('aurelia-logging/dist/commonjs/aurelia-logging',['require','exports','module'],function (require, exports, module) {'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getLogger = getLogger;
exports.addAppender = addAppender;
exports.removeAppender = removeAppender;
exports.getAppenders = getAppenders;
exports.clearAppenders = clearAppenders;
exports.addCustomLevel = addCustomLevel;
exports.removeCustomLevel = removeCustomLevel;
exports.setLevel = setLevel;
exports.getLevel = getLevel;



var logLevel = exports.logLevel = {
  none: 0,
  error: 10,
  warn: 20,
  info: 30,
  debug: 40
};

var loggers = {};
var appenders = [];
var globalDefaultLevel = logLevel.none;

var standardLevels = ['none', 'error', 'warn', 'info', 'debug'];
function isStandardLevel(level) {
  return standardLevels.filter(function (l) {
    return l === level;
  }).length > 0;
}

function appendArgs() {
  return [this].concat(Array.prototype.slice.call(arguments));
}

function logFactory(level) {
  var threshold = logLevel[level];
  return function () {
    if (this.level < threshold) {
      return;
    }

    var args = appendArgs.apply(this, arguments);
    var i = appenders.length;
    while (i--) {
      var _appenders$i;

      (_appenders$i = appenders[i])[level].apply(_appenders$i, args);
    }
  };
}

function logFactoryCustom(level) {
  var threshold = logLevel[level];
  return function () {
    if (this.level < threshold) {
      return;
    }

    var args = appendArgs.apply(this, arguments);
    var i = appenders.length;
    while (i--) {
      var appender = appenders[i];
      if (appender[level] !== undefined) {
        appender[level].apply(appender, args);
      }
    }
  };
}

function connectLoggers() {
  var proto = Logger.prototype;
  for (var _level in logLevel) {
    if (isStandardLevel(_level)) {
      if (_level !== 'none') {
        proto[_level] = logFactory(_level);
      }
    } else {
      proto[_level] = logFactoryCustom(_level);
    }
  }
}

function disconnectLoggers() {
  var proto = Logger.prototype;
  for (var _level2 in logLevel) {
    if (_level2 !== 'none') {
      proto[_level2] = function () {};
    }
  }
}

function getLogger(id) {
  return loggers[id] || new Logger(id);
}

function addAppender(appender) {
  if (appenders.push(appender) === 1) {
    connectLoggers();
  }
}

function removeAppender(appender) {
  appenders = appenders.filter(function (a) {
    return a !== appender;
  });
}

function getAppenders() {
  return [].concat(appenders);
}

function clearAppenders() {
  appenders = [];
  disconnectLoggers();
}

function addCustomLevel(name, value) {
  if (logLevel[name] !== undefined) {
    throw Error('Log level "' + name + '" already exists.');
  }

  if (isNaN(value)) {
    throw Error('Value must be a number.');
  }

  logLevel[name] = value;

  if (appenders.length > 0) {
    connectLoggers();
  } else {
    Logger.prototype[name] = function () {};
  }
}

function removeCustomLevel(name) {
  if (logLevel[name] === undefined) {
    return;
  }

  if (isStandardLevel(name)) {
    throw Error('Built-in log level "' + name + '" cannot be removed.');
  }

  delete logLevel[name];
  delete Logger.prototype[name];
}

function setLevel(level) {
  globalDefaultLevel = level;
  for (var key in loggers) {
    loggers[key].setLevel(level);
  }
}

function getLevel() {
  return globalDefaultLevel;
}

var Logger = exports.Logger = function () {
  function Logger(id) {
    

    var cached = loggers[id];
    if (cached) {
      return cached;
    }

    loggers[id] = this;
    this.id = id;
    this.level = globalDefaultLevel;
  }

  Logger.prototype.debug = function debug(message) {};

  Logger.prototype.info = function info(message) {};

  Logger.prototype.warn = function warn(message) {};

  Logger.prototype.error = function error(message) {};

  Logger.prototype.setLevel = function setLevel(level) {
    this.level = level;
  };

  Logger.prototype.isDebugEnabled = function isDebugEnabled() {
    return this.level === logLevel.debug;
  };

  return Logger;
}();
});
;
define('aurelia-metadata/dist/commonjs/aurelia-metadata',['require','exports','module','aurelia-pal'],function (require, exports, module) {'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Origin = exports.metadata = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.decorators = decorators;
exports.deprecated = deprecated;
exports.mixin = mixin;
exports.protocol = protocol;

var _aureliaPal = require('aurelia-pal');



function isObject(val) {
  return val && (typeof val === 'function' || (typeof val === 'undefined' ? 'undefined' : _typeof(val)) === 'object');
}

var metadata = exports.metadata = {
  resource: 'aurelia:resource',
  paramTypes: 'design:paramtypes',
  propertyType: 'design:type',
  properties: 'design:properties',
  get: function get(metadataKey, target, targetKey) {
    if (!isObject(target)) {
      return undefined;
    }
    var result = metadata.getOwn(metadataKey, target, targetKey);
    return result === undefined ? metadata.get(metadataKey, Object.getPrototypeOf(target), targetKey) : result;
  },
  getOwn: function getOwn(metadataKey, target, targetKey) {
    if (!isObject(target)) {
      return undefined;
    }
    return Reflect.getOwnMetadata(metadataKey, target, targetKey);
  },
  define: function define(metadataKey, metadataValue, target, targetKey) {
    Reflect.defineMetadata(metadataKey, metadataValue, target, targetKey);
  },
  getOrCreateOwn: function getOrCreateOwn(metadataKey, Type, target, targetKey) {
    var result = metadata.getOwn(metadataKey, target, targetKey);

    if (result === undefined) {
      result = new Type();
      Reflect.defineMetadata(metadataKey, result, target, targetKey);
    }

    return result;
  }
};

var originStorage = new Map();
var unknownOrigin = Object.freeze({ moduleId: undefined, moduleMember: undefined });

var Origin = exports.Origin = function () {
  function Origin(moduleId, moduleMember) {
    

    this.moduleId = moduleId;
    this.moduleMember = moduleMember;
  }

  Origin.get = function get(fn) {
    var origin = originStorage.get(fn);

    if (origin === undefined) {
      _aureliaPal.PLATFORM.eachModule(function (key, value) {
        if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object') {
          for (var name in value) {
            try {
              var exp = value[name];
              if (exp === fn) {
                originStorage.set(fn, origin = new Origin(key, name));
                return true;
              }
            } catch (e) {}
          }
        }

        if (value === fn) {
          originStorage.set(fn, origin = new Origin(key, 'default'));
          return true;
        }

        return false;
      });
    }

    return origin || unknownOrigin;
  };

  Origin.set = function set(fn, origin) {
    originStorage.set(fn, origin);
  };

  return Origin;
}();

function decorators() {
  for (var _len = arguments.length, rest = Array(_len), _key = 0; _key < _len; _key++) {
    rest[_key] = arguments[_key];
  }

  var applicator = function applicator(target, key, descriptor) {
    var i = rest.length;

    if (key) {
      descriptor = descriptor || {
        value: target[key],
        writable: true,
        configurable: true,
        enumerable: true
      };

      while (i--) {
        descriptor = rest[i](target, key, descriptor) || descriptor;
      }

      Object.defineProperty(target, key, descriptor);
    } else {
      while (i--) {
        target = rest[i](target) || target;
      }
    }

    return target;
  };

  applicator.on = applicator;
  return applicator;
}

function deprecated(optionsOrTarget, maybeKey, maybeDescriptor) {
  function decorator(target, key, descriptor) {
    var methodSignature = target.constructor.name + '#' + key;
    var options = maybeKey ? {} : optionsOrTarget || {};
    var message = 'DEPRECATION - ' + methodSignature;

    if (typeof descriptor.value !== 'function') {
      throw new SyntaxError('Only methods can be marked as deprecated.');
    }

    if (options.message) {
      message += ' - ' + options.message;
    }

    return _extends({}, descriptor, {
      value: function deprecationWrapper() {
        if (options.error) {
          throw new Error(message);
        } else {
          console.warn(message);
        }

        return descriptor.value.apply(this, arguments);
      }
    });
  }

  return maybeKey ? decorator(optionsOrTarget, maybeKey, maybeDescriptor) : decorator;
}

function mixin(behavior) {
  var instanceKeys = Object.keys(behavior);

  function _mixin(possible) {
    var decorator = function decorator(target) {
      var resolvedTarget = typeof target === 'function' ? target.prototype : target;

      var i = instanceKeys.length;
      while (i--) {
        var property = instanceKeys[i];
        Object.defineProperty(resolvedTarget, property, {
          value: behavior[property],
          writable: true
        });
      }
    };

    return possible ? decorator(possible) : decorator;
  }

  return _mixin;
}

function alwaysValid() {
  return true;
}
function noCompose() {}

function ensureProtocolOptions(options) {
  if (options === undefined) {
    options = {};
  } else if (typeof options === 'function') {
    options = {
      validate: options
    };
  }

  if (!options.validate) {
    options.validate = alwaysValid;
  }

  if (!options.compose) {
    options.compose = noCompose;
  }

  return options;
}

function createProtocolValidator(validate) {
  return function (target) {
    var result = validate(target);
    return result === true;
  };
}

function createProtocolAsserter(name, validate) {
  return function (target) {
    var result = validate(target);
    if (result !== true) {
      throw new Error(result || name + ' was not correctly implemented.');
    }
  };
}

function protocol(name, options) {
  options = ensureProtocolOptions(options);

  var result = function result(target) {
    var resolvedTarget = typeof target === 'function' ? target.prototype : target;

    options.compose(resolvedTarget);
    result.assert(resolvedTarget);

    Object.defineProperty(resolvedTarget, 'protocol:' + name, {
      enumerable: false,
      configurable: false,
      writable: false,
      value: true
    });
  };

  result.validate = createProtocolValidator(options.validate);
  result.assert = createProtocolAsserter(name, options.validate);

  return result;
}

protocol.create = function (name, options) {
  options = ensureProtocolOptions(options);
  var hidden = 'protocol:' + name;
  var result = function result(target) {
    var decorator = protocol(name, options);
    return target ? decorator(target) : decorator;
  };

  result.decorates = function (obj) {
    return obj[hidden] === true;
  };
  result.validate = createProtocolValidator(options.validate);
  result.assert = createProtocolAsserter(name, options.validate);

  return result;
};
});
;
define('aurelia-pal-browser/dist/commonjs/aurelia-pal-browser',['require','exports','module','aurelia-pal'],function (require, exports, module) {'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports._DOM = exports._FEATURE = exports._PLATFORM = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.initialize = initialize;

var _aureliaPal = require('aurelia-pal');

var _PLATFORM = exports._PLATFORM = {
  location: window.location,
  history: window.history,
  addEventListener: function addEventListener(eventName, callback, capture) {
    this.global.addEventListener(eventName, callback, capture);
  },
  removeEventListener: function removeEventListener(eventName, callback, capture) {
    this.global.removeEventListener(eventName, callback, capture);
  },

  performance: window.performance,
  requestAnimationFrame: function requestAnimationFrame(callback) {
    return this.global.requestAnimationFrame(callback);
  }
};

if (typeof FEATURE_NO_IE === 'undefined') {
  var test = function test() {};

  if (test.name === undefined) {
    Object.defineProperty(Function.prototype, 'name', {
      get: function get() {
        var name = this.toString().match(/^\s*function\s*(\S*)\s*\(/)[1];

        Object.defineProperty(this, 'name', { value: name });
        return name;
      }
    });
  }
}

if (typeof FEATURE_NO_IE === 'undefined') {
  if (!('classList' in document.createElement('_')) || document.createElementNS && !('classList' in document.createElementNS('http://www.w3.org/2000/svg', 'g'))) {
    var protoProp = 'prototype';
    var strTrim = String.prototype.trim;
    var arrIndexOf = Array.prototype.indexOf;
    var emptyArray = [];

    var DOMEx = function DOMEx(type, message) {
      this.name = type;
      this.code = DOMException[type];
      this.message = message;
    };

    var checkTokenAndGetIndex = function checkTokenAndGetIndex(classList, token) {
      if (token === '') {
        throw new DOMEx('SYNTAX_ERR', 'An invalid or illegal string was specified');
      }

      if (/\s/.test(token)) {
        throw new DOMEx('INVALID_CHARACTER_ERR', 'String contains an invalid character');
      }

      return arrIndexOf.call(classList, token);
    };

    var ClassList = function ClassList(elem) {
      var trimmedClasses = strTrim.call(elem.getAttribute('class') || '');
      var classes = trimmedClasses ? trimmedClasses.split(/\s+/) : emptyArray;

      for (var i = 0, ii = classes.length; i < ii; ++i) {
        this.push(classes[i]);
      }

      this._updateClassName = function () {
        elem.setAttribute('class', this.toString());
      };
    };

    var classListProto = ClassList[protoProp] = [];

    DOMEx[protoProp] = Error[protoProp];

    classListProto.item = function (i) {
      return this[i] || null;
    };

    classListProto.contains = function (token) {
      token += '';
      return checkTokenAndGetIndex(this, token) !== -1;
    };

    classListProto.add = function () {
      var tokens = arguments;
      var i = 0;
      var ii = tokens.length;
      var token = void 0;
      var updated = false;

      do {
        token = tokens[i] + '';
        if (checkTokenAndGetIndex(this, token) === -1) {
          this.push(token);
          updated = true;
        }
      } while (++i < ii);

      if (updated) {
        this._updateClassName();
      }
    };

    classListProto.remove = function () {
      var tokens = arguments;
      var i = 0;
      var ii = tokens.length;
      var token = void 0;
      var updated = false;
      var index = void 0;

      do {
        token = tokens[i] + '';
        index = checkTokenAndGetIndex(this, token);
        while (index !== -1) {
          this.splice(index, 1);
          updated = true;
          index = checkTokenAndGetIndex(this, token);
        }
      } while (++i < ii);

      if (updated) {
        this._updateClassName();
      }
    };

    classListProto.toggle = function (token, force) {
      token += '';

      var result = this.contains(token);
      var method = result ? force !== true && 'remove' : force !== false && 'add';

      if (method) {
        this[method](token);
      }

      if (force === true || force === false) {
        return force;
      }

      return !result;
    };

    classListProto.toString = function () {
      return this.join(' ');
    };

    Object.defineProperty(Element.prototype, 'classList', {
      get: function get() {
        return new ClassList(this);
      },
      enumerable: true,
      configurable: true
    });
  } else {
    var testElement = document.createElement('_');
    testElement.classList.add('c1', 'c2');

    if (!testElement.classList.contains('c2')) {
      var createMethod = function createMethod(method) {
        var original = DOMTokenList.prototype[method];

        DOMTokenList.prototype[method] = function (token) {
          for (var i = 0, ii = arguments.length; i < ii; ++i) {
            token = arguments[i];
            original.call(this, token);
          }
        };
      };

      createMethod('add');
      createMethod('remove');
    }

    testElement.classList.toggle('c3', false);

    if (testElement.classList.contains('c3')) {
      var _toggle = DOMTokenList.prototype.toggle;

      DOMTokenList.prototype.toggle = function (token, force) {
        if (1 in arguments && !this.contains(token) === !force) {
          return force;
        }

        return _toggle.call(this, token);
      };
    }

    testElement = null;
  }
}

if (typeof FEATURE_NO_IE === 'undefined') {
  var _filterEntries = function _filterEntries(key, value) {
    var i = 0,
        n = _entries.length,
        result = [];
    for (; i < n; i++) {
      if (_entries[i][key] == value) {
        result.push(_entries[i]);
      }
    }
    return result;
  };

  var _clearEntries = function _clearEntries(type, name) {
    var i = _entries.length,
        entry;
    while (i--) {
      entry = _entries[i];
      if (entry.entryType == type && (name === void 0 || entry.name == name)) {
        _entries.splice(i, 1);
      }
    }
  };

  // @license http://opensource.org/licenses/MIT
  if ('performance' in window === false) {
    window.performance = {};
  }

  if ('now' in window.performance === false) {
    var nowOffset = Date.now();

    if (performance.timing && performance.timing.navigationStart) {
      nowOffset = performance.timing.navigationStart;
    }

    window.performance.now = function now() {
      return Date.now() - nowOffset;
    };
  }

  var startOffset = Date.now ? Date.now() : +new Date();
  var _entries = [];
  var _marksIndex = {};

  ;

  if (!window.performance.mark) {
    window.performance.mark = window.performance.webkitMark || function (name) {
      var mark = {
        name: name,
        entryType: "mark",
        startTime: window.performance.now(),
        duration: 0
      };

      _entries.push(mark);
      _marksIndex[name] = mark;
    };
  }

  if (!window.performance.measure) {
    window.performance.measure = window.performance.webkitMeasure || function (name, startMark, endMark) {
      startMark = _marksIndex[startMark].startTime;
      endMark = _marksIndex[endMark].startTime;

      _entries.push({
        name: name,
        entryType: "measure",
        startTime: startMark,
        duration: endMark - startMark
      });
    };
  }

  if (!window.performance.getEntriesByType) {
    window.performance.getEntriesByType = window.performance.webkitGetEntriesByType || function (type) {
      return _filterEntries("entryType", type);
    };
  }

  if (!window.performance.getEntriesByName) {
    window.performance.getEntriesByName = window.performance.webkitGetEntriesByName || function (name) {
      return _filterEntries("name", name);
    };
  }

  if (!window.performance.clearMarks) {
    window.performance.clearMarks = window.performance.webkitClearMarks || function (name) {
      _clearEntries("mark", name);
    };
  }

  if (!window.performance.clearMeasures) {
    window.performance.clearMeasures = window.performance.webkitClearMeasures || function (name) {
      _clearEntries("measure", name);
    };
  }

  _PLATFORM.performance = window.performance;
}

if (typeof FEATURE_NO_IE === 'undefined') {
  var con = window.console = window.console || {};
  var nop = function nop() {};

  if (!con.memory) con.memory = {};
  ('assert,clear,count,debug,dir,dirxml,error,exception,group,' + 'groupCollapsed,groupEnd,info,log,markTimeline,profile,profiles,profileEnd,' + 'show,table,time,timeEnd,timeline,timelineEnd,timeStamp,trace,warn').split(',').forEach(function (m) {
    if (!con[m]) con[m] = nop;
  });

  if (_typeof(con.log) === 'object') {
    'log,info,warn,error,assert,dir,clear,profile,profileEnd'.split(',').forEach(function (method) {
      console[method] = this.bind(console[method], console);
    }, Function.prototype.call);
  }
}

if (typeof FEATURE_NO_IE === 'undefined') {
  if (!window.CustomEvent || typeof window.CustomEvent !== 'function') {
    var _CustomEvent = function _CustomEvent(event, params) {
      params = params || {
        bubbles: false,
        cancelable: false,
        detail: undefined
      };

      var evt = document.createEvent('CustomEvent');
      evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
      return evt;
    };

    _CustomEvent.prototype = window.Event.prototype;
    window.CustomEvent = _CustomEvent;
  }
}

if (Element && !Element.prototype.matches) {
  var proto = Element.prototype;
  proto.matches = proto.matchesSelector || proto.mozMatchesSelector || proto.msMatchesSelector || proto.oMatchesSelector || proto.webkitMatchesSelector;
}

var _FEATURE = exports._FEATURE = {
  shadowDOM: !!HTMLElement.prototype.attachShadow,
  scopedCSS: 'scoped' in document.createElement('style'),
  htmlTemplateElement: function () {
    var d = document.createElement('div');
    d.innerHTML = '<template></template>';
    return 'content' in d.children[0];
  }(),
  mutationObserver: !!(window.MutationObserver || window.WebKitMutationObserver),
  ensureHTMLTemplateElement: function ensureHTMLTemplateElement(t) {
    return t;
  }
};

if (typeof FEATURE_NO_IE === 'undefined') {
  var isSVGTemplate = function isSVGTemplate(el) {
    return el.tagName === 'template' && el.namespaceURI === 'http://www.w3.org/2000/svg';
  };

  var fixSVGTemplateElement = function fixSVGTemplateElement(el) {
    var template = el.ownerDocument.createElement('template');
    var attrs = el.attributes;
    var length = attrs.length;
    var attr = void 0;

    el.parentNode.insertBefore(template, el);

    while (length-- > 0) {
      attr = attrs[length];
      template.setAttribute(attr.name, attr.value);
      el.removeAttribute(attr.name);
    }

    el.parentNode.removeChild(el);

    return fixHTMLTemplateElement(template);
  };

  var fixHTMLTemplateElement = function fixHTMLTemplateElement(template) {
    var content = template.content = document.createDocumentFragment();
    var child = void 0;

    while (child = template.firstChild) {
      content.appendChild(child);
    }

    return template;
  };

  var fixHTMLTemplateElementRoot = function fixHTMLTemplateElementRoot(template) {
    var content = fixHTMLTemplateElement(template).content;
    var childTemplates = content.querySelectorAll('template');

    for (var i = 0, ii = childTemplates.length; i < ii; ++i) {
      var child = childTemplates[i];

      if (isSVGTemplate(child)) {
        fixSVGTemplateElement(child);
      } else {
        fixHTMLTemplateElement(child);
      }
    }

    return template;
  };

  if (!_FEATURE.htmlTemplateElement) {
    _FEATURE.ensureHTMLTemplateElement = fixHTMLTemplateElementRoot;
  }
}

var shadowPoly = window.ShadowDOMPolyfill || null;

var _DOM = exports._DOM = {
  Element: Element,
  NodeList: NodeList,
  SVGElement: SVGElement,
  boundary: 'aurelia-dom-boundary',
  addEventListener: function addEventListener(eventName, callback, capture) {
    document.addEventListener(eventName, callback, capture);
  },
  removeEventListener: function removeEventListener(eventName, callback, capture) {
    document.removeEventListener(eventName, callback, capture);
  },
  adoptNode: function adoptNode(node) {
    return document.adoptNode(node);
  },
  createAttribute: function createAttribute(name) {
    return document.createAttribute(name);
  },
  createElement: function createElement(tagName) {
    return document.createElement(tagName);
  },
  createTextNode: function createTextNode(text) {
    return document.createTextNode(text);
  },
  createComment: function createComment(text) {
    return document.createComment(text);
  },
  createDocumentFragment: function createDocumentFragment() {
    return document.createDocumentFragment();
  },
  createTemplateElement: function createTemplateElement() {
    var template = document.createElement('template');
    return _FEATURE.ensureHTMLTemplateElement(template);
  },
  createMutationObserver: function createMutationObserver(callback) {
    return new (window.MutationObserver || window.WebKitMutationObserver)(callback);
  },
  createCustomEvent: function createCustomEvent(eventType, options) {
    return new window.CustomEvent(eventType, options);
  },
  dispatchEvent: function dispatchEvent(evt) {
    document.dispatchEvent(evt);
  },
  getComputedStyle: function getComputedStyle(element) {
    return window.getComputedStyle(element);
  },
  getElementById: function getElementById(id) {
    return document.getElementById(id);
  },
  querySelector: function querySelector(query) {
    return document.querySelector(query);
  },
  querySelectorAll: function querySelectorAll(query) {
    return document.querySelectorAll(query);
  },
  nextElementSibling: function nextElementSibling(element) {
    if (element.nextElementSibling) {
      return element.nextElementSibling;
    }
    do {
      element = element.nextSibling;
    } while (element && element.nodeType !== 1);
    return element;
  },
  createTemplateFromMarkup: function createTemplateFromMarkup(markup) {
    var parser = document.createElement('div');
    parser.innerHTML = markup;

    var temp = parser.firstElementChild;
    if (!temp || temp.nodeName !== 'TEMPLATE') {
      throw new Error('Template markup must be wrapped in a <template> element e.g. <template> <!-- markup here --> </template>');
    }

    return _FEATURE.ensureHTMLTemplateElement(temp);
  },
  appendNode: function appendNode(newNode, parentNode) {
    (parentNode || document.body).appendChild(newNode);
  },
  replaceNode: function replaceNode(newNode, node, parentNode) {
    if (node.parentNode) {
      node.parentNode.replaceChild(newNode, node);
    } else if (shadowPoly !== null) {
      shadowPoly.unwrap(parentNode).replaceChild(shadowPoly.unwrap(newNode), shadowPoly.unwrap(node));
    } else {
      parentNode.replaceChild(newNode, node);
    }
  },
  removeNode: function removeNode(node, parentNode) {
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    } else if (parentNode) {
      if (shadowPoly !== null) {
        shadowPoly.unwrap(parentNode).removeChild(shadowPoly.unwrap(node));
      } else {
        parentNode.removeChild(node);
      }
    }
  },
  injectStyles: function injectStyles(styles, destination, prepend, id) {
    if (id) {
      var oldStyle = document.getElementById(id);
      if (oldStyle) {
        var isStyleTag = oldStyle.tagName.toLowerCase() === 'style';

        if (isStyleTag) {
          oldStyle.innerHTML = styles;
          return;
        }

        throw new Error('The provided id does not indicate a style tag.');
      }
    }

    var node = document.createElement('style');
    node.innerHTML = styles;
    node.type = 'text/css';

    if (id) {
      node.id = id;
    }

    destination = destination || document.head;

    if (prepend && destination.childNodes.length > 0) {
      destination.insertBefore(node, destination.childNodes[0]);
    } else {
      destination.appendChild(node);
    }

    return node;
  }
};

function initialize() {
  if (_aureliaPal.isInitialized) {
    return;
  }

  (0, _aureliaPal.initializePAL)(function (platform, feature, dom) {
    Object.assign(platform, _PLATFORM);
    Object.assign(feature, _FEATURE);
    Object.assign(dom, _DOM);

    Object.defineProperty(dom, 'title', {
      get: function get() {
        return document.title;
      },
      set: function set(value) {
        document.title = value;
      }
    });

    Object.defineProperty(dom, 'activeElement', {
      get: function get() {
        return document.activeElement;
      }
    });

    Object.defineProperty(platform, 'XMLHttpRequest', {
      get: function get() {
        return platform.global.XMLHttpRequest;
      }
    });
  });
}
});
;
define('aurelia-pal/dist/commonjs/aurelia-pal',['require','exports','module'],function (require, exports, module) {'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AggregateError = AggregateError;
exports.initializePAL = initializePAL;
exports.reset = reset;
function AggregateError(message, innerError, skipIfAlreadyAggregate) {
  if (innerError) {
    if (innerError.innerError && skipIfAlreadyAggregate) {
      return innerError;
    }

    var separator = '\n------------------------------------------------\n';

    message += separator + 'Inner Error:\n';

    if (typeof innerError === 'string') {
      message += 'Message: ' + innerError;
    } else {
      if (innerError.message) {
        message += 'Message: ' + innerError.message;
      } else {
        message += 'Unknown Inner Error Type. Displaying Inner Error as JSON:\n ' + JSON.stringify(innerError, null, '  ');
      }

      if (innerError.stack) {
        message += '\nInner Error Stack:\n' + innerError.stack;
        message += '\nEnd Inner Error Stack';
      }
    }

    message += separator;
  }

  var e = new Error(message);
  if (innerError) {
    e.innerError = innerError;
  }

  return e;
}

var FEATURE = exports.FEATURE = {};

var PLATFORM = exports.PLATFORM = {
  noop: function noop() {},
  eachModule: function eachModule() {},
  moduleName: function (_moduleName) {
    function moduleName(_x) {
      return _moduleName.apply(this, arguments);
    }

    moduleName.toString = function () {
      return _moduleName.toString();
    };

    return moduleName;
  }(function (moduleName) {
    return moduleName;
  })
};

PLATFORM.global = function () {
  if (typeof self !== 'undefined') {
    return self;
  }

  if (typeof global !== 'undefined') {
    return global;
  }

  return new Function('return this')();
}();

var DOM = exports.DOM = {};
var isInitialized = exports.isInitialized = false;
function initializePAL(callback) {
  if (isInitialized) {
    return;
  }
  exports.isInitialized = isInitialized = true;
  if (typeof Object.getPropertyDescriptor !== 'function') {
    Object.getPropertyDescriptor = function (subject, name) {
      var pd = Object.getOwnPropertyDescriptor(subject, name);
      var proto = Object.getPrototypeOf(subject);
      while (typeof pd === 'undefined' && proto !== null) {
        pd = Object.getOwnPropertyDescriptor(proto, name);
        proto = Object.getPrototypeOf(proto);
      }
      return pd;
    };
  }

  callback(PLATFORM, FEATURE, DOM);
}
function reset() {
  exports.isInitialized = isInitialized = false;
}
});
;
define('aurelia-path/dist/commonjs/aurelia-path',['require','exports','module'],function (require, exports, module) {'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function trimDots(ary) {
    for (var i = 0; i < ary.length; ++i) {
        var part = ary[i];
        if (part === '.') {
            ary.splice(i, 1);
            i -= 1;
        }
        else if (part === '..') {
            if (i === 0 || (i === 1 && ary[2] === '..') || ary[i - 1] === '..') {
                continue;
            }
            else if (i > 0) {
                ary.splice(i - 1, 2);
                i -= 2;
            }
        }
    }
}
function relativeToFile(name, file) {
    var fileParts = file && file.split('/');
    var nameParts = name.trim().split('/');
    if (nameParts[0].charAt(0) === '.' && fileParts) {
        var normalizedBaseParts = fileParts.slice(0, fileParts.length - 1);
        nameParts.unshift.apply(nameParts, normalizedBaseParts);
    }
    trimDots(nameParts);
    return nameParts.join('/');
}
function join(path1, path2) {
    if (!path1) {
        return path2;
    }
    if (!path2) {
        return path1;
    }
    var schemeMatch = path1.match(/^([^/]*?:)\//);
    var scheme = (schemeMatch && schemeMatch.length > 0) ? schemeMatch[1] : '';
    path1 = path1.substr(scheme.length);
    var urlPrefix;
    if (path1.indexOf('///') === 0 && scheme === 'file:') {
        urlPrefix = '///';
    }
    else if (path1.indexOf('//') === 0) {
        urlPrefix = '//';
    }
    else if (path1.indexOf('/') === 0) {
        urlPrefix = '/';
    }
    else {
        urlPrefix = '';
    }
    var trailingSlash = path2.slice(-1) === '/' ? '/' : '';
    var url1 = path1.split('/');
    var url2 = path2.split('/');
    var url3 = [];
    for (var i = 0, ii = url1.length; i < ii; ++i) {
        if (url1[i] === '..') {
            if (url3.length && url3[url3.length - 1] !== '..') {
                url3.pop();
            }
            else {
                url3.push(url1[i]);
            }
        }
        else if (url1[i] === '.' || url1[i] === '') {
            continue;
        }
        else {
            url3.push(url1[i]);
        }
    }
    for (var i = 0, ii = url2.length; i < ii; ++i) {
        if (url2[i] === '..') {
            if (url3.length && url3[url3.length - 1] !== '..') {
                url3.pop();
            }
            else {
                url3.push(url2[i]);
            }
        }
        else if (url2[i] === '.' || url2[i] === '') {
            continue;
        }
        else {
            url3.push(url2[i]);
        }
    }
    return scheme + urlPrefix + url3.join('/') + trailingSlash;
}
var encode = encodeURIComponent;
var encodeKey = function (k) { return encode(k).replace('%24', '$'); };
function buildParam(key, value, traditional) {
    var result = [];
    if (value === null || value === undefined) {
        return result;
    }
    if (Array.isArray(value)) {
        for (var i = 0, l = value.length; i < l; i++) {
            if (traditional) {
                result.push(encodeKey(key) + "=" + encode(value[i]));
            }
            else {
                var arrayKey = key + '[' + (typeof value[i] === 'object' && value[i] !== null ? i : '') + ']';
                result = result.concat(buildParam(arrayKey, value[i]));
            }
        }
    }
    else if (typeof (value) === 'object' && !traditional) {
        for (var propertyName in value) {
            result = result.concat(buildParam(key + '[' + propertyName + ']', value[propertyName]));
        }
    }
    else {
        result.push(encodeKey(key) + "=" + encode(value));
    }
    return result;
}
function buildQueryString(params, traditional) {
    var pairs = [];
    var keys = Object.keys(params || {}).sort();
    for (var i = 0, len = keys.length; i < len; i++) {
        var key = keys[i];
        pairs = pairs.concat(buildParam(key, params[key], traditional));
    }
    if (pairs.length === 0) {
        return '';
    }
    return pairs.join('&');
}
function processScalarParam(existedParam, value) {
    if (Array.isArray(existedParam)) {
        existedParam.push(value);
        return existedParam;
    }
    if (existedParam !== undefined) {
        return [existedParam, value];
    }
    return value;
}
function parseComplexParam(queryParams, keys, value) {
    var currentParams = queryParams;
    var keysLastIndex = keys.length - 1;
    for (var j = 0; j <= keysLastIndex; j++) {
        var key = keys[j] === '' ? currentParams.length : keys[j];
        preventPollution(key);
        if (j < keysLastIndex) {
            var prevValue = !currentParams[key] || typeof currentParams[key] === 'object' ? currentParams[key] : [currentParams[key]];
            currentParams = currentParams[key] = prevValue || (isNaN(keys[j + 1]) ? {} : []);
        }
        else {
            currentParams = currentParams[key] = value;
        }
    }
}
function parseQueryString(queryString) {
    var queryParams = {};
    if (!queryString || typeof queryString !== 'string') {
        return queryParams;
    }
    var query = queryString;
    if (query.charAt(0) === '?') {
        query = query.substr(1);
    }
    var pairs = query.replace(/\+/g, ' ').split('&');
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split('=');
        var key = decodeURIComponent(pair[0]);
        if (!key) {
            continue;
        }
        var keys = key.split('][');
        var keysLastIndex = keys.length - 1;
        if (/\[/.test(keys[0]) && /\]$/.test(keys[keysLastIndex])) {
            keys[keysLastIndex] = keys[keysLastIndex].replace(/\]$/, '');
            keys = keys.shift().split('[').concat(keys);
            keysLastIndex = keys.length - 1;
        }
        else {
            keysLastIndex = 0;
        }
        if (pair.length >= 2) {
            var value = pair[1] ? decodeURIComponent(pair[1]) : '';
            if (keysLastIndex) {
                parseComplexParam(queryParams, keys, value);
            }
            else {
                preventPollution(key);
                queryParams[key] = processScalarParam(queryParams[key], value);
            }
        }
        else {
            queryParams[key] = true;
        }
    }
    return queryParams;
}
function preventPollution(key) {
    if (key === '__proto__') {
        throw new Error('Prototype pollution detected.');
    }
}

exports.buildQueryString = buildQueryString;
exports.join = join;
exports.parseQueryString = parseQueryString;
exports.relativeToFile = relativeToFile;


});
;
define('aurelia-polyfills/dist/commonjs/aurelia-polyfills',['require','exports','module','aurelia-pal'],function (require, exports, module) {'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _aureliaPal = require('aurelia-pal');

if (typeof FEATURE_NO_ES2015 === 'undefined') {

  (function (Object, GOPS) {
    'use strict';

    if (GOPS in Object) return;

    var setDescriptor,
        G = _aureliaPal.PLATFORM.global,
        id = 0,
        random = '' + Math.random(),
        prefix = '__\x01symbol:',
        prefixLength = prefix.length,
        internalSymbol = '__\x01symbol@@' + random,
        DP = 'defineProperty',
        DPies = 'defineProperties',
        GOPN = 'getOwnPropertyNames',
        GOPD = 'getOwnPropertyDescriptor',
        PIE = 'propertyIsEnumerable',
        gOPN = Object[GOPN],
        gOPD = Object[GOPD],
        create = Object.create,
        keys = Object.keys,
        defineProperty = Object[DP],
        $defineProperties = Object[DPies],
        descriptor = gOPD(Object, GOPN),
        ObjectProto = Object.prototype,
        hOP = ObjectProto.hasOwnProperty,
        pIE = ObjectProto[PIE],
        toString = ObjectProto.toString,
        indexOf = Array.prototype.indexOf || function (v) {
      for (var i = this.length; i-- && this[i] !== v;) {}
      return i;
    },
        addInternalIfNeeded = function addInternalIfNeeded(o, uid, enumerable) {
      if (!hOP.call(o, internalSymbol)) {
        defineProperty(o, internalSymbol, {
          enumerable: false,
          configurable: false,
          writable: false,
          value: {}
        });
      }
      o[internalSymbol]['@@' + uid] = enumerable;
    },
        createWithSymbols = function createWithSymbols(proto, descriptors) {
      var self = create(proto);
      if (descriptors !== null && (typeof descriptors === 'undefined' ? 'undefined' : _typeof(descriptors)) === 'object') {
        gOPN(descriptors).forEach(function (key) {
          if (propertyIsEnumerable.call(descriptors, key)) {
            $defineProperty(self, key, descriptors[key]);
          }
        });
      }
      return self;
    },
        copyAsNonEnumerable = function copyAsNonEnumerable(descriptor) {
      var newDescriptor = create(descriptor);
      newDescriptor.enumerable = false;
      return newDescriptor;
    },
        get = function get() {},
        onlyNonSymbols = function onlyNonSymbols(name) {
      return name != internalSymbol && !hOP.call(source, name);
    },
        onlySymbols = function onlySymbols(name) {
      return name != internalSymbol && hOP.call(source, name);
    },
        propertyIsEnumerable = function propertyIsEnumerable(key) {
      var uid = '' + key;
      return onlySymbols(uid) ? hOP.call(this, uid) && this[internalSymbol] && this[internalSymbol]['@@' + uid] : pIE.call(this, key);
    },
        setAndGetSymbol = function setAndGetSymbol(uid) {
      var descriptor = {
        enumerable: false,
        configurable: true,
        get: get,
        set: function set(value) {
          setDescriptor(this, uid, {
            enumerable: false,
            configurable: true,
            writable: true,
            value: value
          });
          addInternalIfNeeded(this, uid, true);
        }
      };
      defineProperty(ObjectProto, uid, descriptor);
      return source[uid] = defineProperty(Object(uid), 'constructor', sourceConstructor);
    },
        _Symbol = function _Symbol2(description) {
      if (this && this !== G) {
        throw new TypeError('Symbol is not a constructor');
      }
      return setAndGetSymbol(prefix.concat(description || '', random, ++id));
    },
        source = create(null),
        sourceConstructor = { value: _Symbol },
        sourceMap = function sourceMap(uid) {
      return source[uid];
    },
        $defineProperty = function defineProp(o, key, descriptor) {
      var uid = '' + key;
      if (onlySymbols(uid)) {
        setDescriptor(o, uid, descriptor.enumerable ? copyAsNonEnumerable(descriptor) : descriptor);
        addInternalIfNeeded(o, uid, !!descriptor.enumerable);
      } else {
        defineProperty(o, key, descriptor);
      }
      return o;
    },
        $getOwnPropertySymbols = function getOwnPropertySymbols(o) {
      var cof = toString.call(o);
      o = cof === '[object String]' ? o.split('') : Object(o);
      return gOPN(o).filter(onlySymbols).map(sourceMap);
    };

    descriptor.value = $defineProperty;
    defineProperty(Object, DP, descriptor);

    descriptor.value = $getOwnPropertySymbols;
    defineProperty(Object, GOPS, descriptor);

    var cachedWindowNames = (typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object' ? Object.getOwnPropertyNames(window) : [];
    var originalObjectGetOwnPropertyNames = Object.getOwnPropertyNames;
    descriptor.value = function getOwnPropertyNames(o) {
      if (toString.call(o) === '[object Window]') {
        try {
          return originalObjectGetOwnPropertyNames(o);
        } catch (e) {
          return [].concat([], cachedWindowNames);
        }
      }
      return gOPN(o).filter(onlyNonSymbols);
    };
    defineProperty(Object, GOPN, descriptor);

    descriptor.value = function defineProperties(o, descriptors) {
      var symbols = $getOwnPropertySymbols(descriptors);
      if (symbols.length) {
        keys(descriptors).concat(symbols).forEach(function (uid) {
          if (propertyIsEnumerable.call(descriptors, uid)) {
            $defineProperty(o, uid, descriptors[uid]);
          }
        });
      } else {
        $defineProperties(o, descriptors);
      }
      return o;
    };
    defineProperty(Object, DPies, descriptor);

    descriptor.value = propertyIsEnumerable;
    defineProperty(ObjectProto, PIE, descriptor);

    descriptor.value = _Symbol;
    defineProperty(G, 'Symbol', descriptor);

    descriptor.value = function (key) {
      var uid = prefix.concat(prefix, key, random);
      return uid in ObjectProto ? source[uid] : setAndGetSymbol(uid);
    };
    defineProperty(_Symbol, 'for', descriptor);

    descriptor.value = function (symbol) {
      return hOP.call(source, symbol) ? symbol.slice(prefixLength * 2, -random.length) : void 0;
    };
    defineProperty(_Symbol, 'keyFor', descriptor);

    descriptor.value = function getOwnPropertyDescriptor(o, key) {
      var descriptor = gOPD(o, key);
      if (descriptor && onlySymbols(key)) {
        descriptor.enumerable = propertyIsEnumerable.call(o, key);
      }
      return descriptor;
    };
    defineProperty(Object, GOPD, descriptor);

    descriptor.value = function (proto, descriptors) {
      return arguments.length === 1 ? create(proto) : createWithSymbols(proto, descriptors);
    };
    defineProperty(Object, 'create', descriptor);

    descriptor.value = function () {
      var str = toString.call(this);
      return str === '[object String]' && onlySymbols(this) ? '[object Symbol]' : str;
    };
    defineProperty(ObjectProto, 'toString', descriptor);

    try {
      setDescriptor = create(defineProperty({}, prefix, {
        get: function get() {
          return defineProperty(this, prefix, { value: false })[prefix];
        }
      }))[prefix] || defineProperty;
    } catch (o_O) {
      setDescriptor = function setDescriptor(o, key, descriptor) {
        var protoDescriptor = gOPD(ObjectProto, key);
        delete ObjectProto[key];
        defineProperty(o, key, descriptor);
        defineProperty(ObjectProto, key, protoDescriptor);
      };
    }
  })(Object, 'getOwnPropertySymbols');

  (function (O, S) {
    var dP = O.defineProperty,
        ObjectProto = O.prototype,
        toString = ObjectProto.toString,
        toStringTag = 'toStringTag',
        descriptor;
    ['iterator', 'match', 'replace', 'search', 'split', 'hasInstance', 'isConcatSpreadable', 'unscopables', 'species', 'toPrimitive', toStringTag].forEach(function (name) {
      if (!(name in Symbol)) {
        dP(Symbol, name, { value: Symbol(name) });
        switch (name) {
          case toStringTag:
            descriptor = O.getOwnPropertyDescriptor(ObjectProto, 'toString');
            descriptor.value = function () {
              var str = toString.call(this),
                  tst = typeof this === 'undefined' || this === null ? undefined : this[Symbol.toStringTag];
              return typeof tst === 'undefined' ? str : '[object ' + tst + ']';
            };
            dP(ObjectProto, 'toString', descriptor);
            break;
        }
      }
    });
  })(Object, Symbol);

  (function (Si, AP, SP) {

    function returnThis() {
      return this;
    }

    if (!AP[Si]) AP[Si] = function () {
      var i = 0,
          self = this,
          iterator = {
        next: function next() {
          var done = self.length <= i;
          return done ? { done: done } : { done: done, value: self[i++] };
        }
      };
      iterator[Si] = returnThis;
      return iterator;
    };

    if (!SP[Si]) SP[Si] = function () {
      var fromCodePoint = String.fromCodePoint,
          self = this,
          i = 0,
          length = self.length,
          iterator = {
        next: function next() {
          var done = length <= i,
              c = done ? '' : fromCodePoint(self.codePointAt(i));
          i += c.length;
          return done ? { done: done } : { done: done, value: c };
        }
      };
      iterator[Si] = returnThis;
      return iterator;
    };
  })(Symbol.iterator, Array.prototype, String.prototype);
}

if (typeof FEATURE_NO_ES2015 === 'undefined') {

  Number.isNaN = Number.isNaN || function (value) {
    return value !== value;
  };

  Number.isFinite = Number.isFinite || function (value) {
    return typeof value === "number" && isFinite(value);
  };
}

if (!String.prototype.endsWith || function () {
  try {
    return !"ab".endsWith("a", 1);
  } catch (e) {
    return true;
  }
}()) {
  String.prototype.endsWith = function (searchString, position) {
    var subjectString = this.toString();
    if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
      position = subjectString.length;
    }
    position -= searchString.length;
    var lastIndex = subjectString.indexOf(searchString, position);
    return lastIndex !== -1 && lastIndex === position;
  };
}

if (!String.prototype.startsWith || function () {
  try {
    return !"ab".startsWith("b", 1);
  } catch (e) {
    return true;
  }
}()) {
  String.prototype.startsWith = function (searchString, position) {
    position = position || 0;
    return this.substr(position, searchString.length) === searchString;
  };
}

if (typeof FEATURE_NO_ES2015 === 'undefined') {

  if (!Array.from) {
    Array.from = function () {
      var toInteger = function toInteger(it) {
        return isNaN(it = +it) ? 0 : (it > 0 ? Math.floor : Math.ceil)(it);
      };
      var toLength = function toLength(it) {
        return it > 0 ? Math.min(toInteger(it), 0x1fffffffffffff) : 0;
      };
      var iterCall = function iterCall(iter, fn, val, index) {
        try {
          return fn(val, index);
        } catch (E) {
          if (typeof iter.return == 'function') iter.return();
          throw E;
        }
      };

      return function from(arrayLike) {
        var O = Object(arrayLike),
            C = typeof this == 'function' ? this : Array,
            aLen = arguments.length,
            mapfn = aLen > 1 ? arguments[1] : undefined,
            mapping = mapfn !== undefined,
            index = 0,
            iterFn = O[Symbol.iterator],
            length,
            result,
            step,
            iterator;
        if (mapping) mapfn = mapfn.bind(aLen > 2 ? arguments[2] : undefined);
        if (iterFn != undefined && !Array.isArray(arrayLike)) {
          for (iterator = iterFn.call(O), result = new C(); !(step = iterator.next()).done; index++) {
            result[index] = mapping ? iterCall(iterator, mapfn, step.value, index) : step.value;
          }
        } else {
          length = toLength(O.length);
          for (result = new C(length); length > index; index++) {
            result[index] = mapping ? mapfn(O[index], index) : O[index];
          }
        }
        result.length = index;
        return result;
      };
    }();
  }

  if (!Array.prototype.find) {
    Object.defineProperty(Array.prototype, 'find', {
      configurable: true,
      writable: true,
      enumerable: false,
      value: function value(predicate) {
        if (this === null) {
          throw new TypeError('Array.prototype.find called on null or undefined');
        }
        if (typeof predicate !== 'function') {
          throw new TypeError('predicate must be a function');
        }
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        var value;

        for (var i = 0; i < length; i++) {
          value = list[i];
          if (predicate.call(thisArg, value, i, list)) {
            return value;
          }
        }
        return undefined;
      }
    });
  }

  if (!Array.prototype.findIndex) {
    Object.defineProperty(Array.prototype, 'findIndex', {
      configurable: true,
      writable: true,
      enumerable: false,
      value: function value(predicate) {
        if (this === null) {
          throw new TypeError('Array.prototype.findIndex called on null or undefined');
        }
        if (typeof predicate !== 'function') {
          throw new TypeError('predicate must be a function');
        }
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        var value;

        for (var i = 0; i < length; i++) {
          value = list[i];
          if (predicate.call(thisArg, value, i, list)) {
            return i;
          }
        }
        return -1;
      }
    });
  }
}

if (typeof FEATURE_NO_ES2016 === 'undefined' && !Array.prototype.includes) {
  Object.defineProperty(Array.prototype, 'includes', {
    configurable: true,
    writable: true,
    enumerable: false,
    value: function value(searchElement) {
      var O = Object(this);
      var len = parseInt(O.length) || 0;
      if (len === 0) {
        return false;
      }
      var n = parseInt(arguments[1]) || 0;
      var k;
      if (n >= 0) {
        k = n;
      } else {
        k = len + n;
        if (k < 0) {
          k = 0;
        }
      }
      var currentElement;
      while (k < len) {
        currentElement = O[k];
        if (searchElement === currentElement || searchElement !== searchElement && currentElement !== currentElement) {
          return true;
        }
        k++;
      }
      return false;
    }
  });
}

if (typeof FEATURE_NO_ES2015 === 'undefined') {

  (function () {
    var needsFix = false;

    try {
      var s = Object.keys('a');
      needsFix = s.length !== 1 || s[0] !== '0';
    } catch (e) {
      needsFix = true;
    }

    if (needsFix) {
      Object.keys = function () {
        var hasOwnProperty = Object.prototype.hasOwnProperty,
            hasDontEnumBug = !{ toString: null }.propertyIsEnumerable('toString'),
            dontEnums = ['toString', 'toLocaleString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'constructor'],
            dontEnumsLength = dontEnums.length;

        return function (obj) {
          if (obj === undefined || obj === null) {
            throw TypeError('Cannot convert undefined or null to object');
          }

          obj = Object(obj);

          var result = [],
              prop,
              i;

          for (prop in obj) {
            if (hasOwnProperty.call(obj, prop)) {
              result.push(prop);
            }
          }

          if (hasDontEnumBug) {
            for (i = 0; i < dontEnumsLength; i++) {
              if (hasOwnProperty.call(obj, dontEnums[i])) {
                result.push(dontEnums[i]);
              }
            }
          }

          return result;
        };
      }();
    }
  })();

  (function (O) {
    if ('assign' in O) {
      return;
    }

    O.defineProperty(O, 'assign', {
      configurable: true,
      writable: true,
      value: function () {
        var gOPS = O.getOwnPropertySymbols,
            pIE = O.propertyIsEnumerable,
            filterOS = gOPS ? function (self) {
          return gOPS(self).filter(pIE, self);
        } : function () {
          return Array.prototype;
        };

        return function assign(where) {
          if (gOPS && !(where instanceof O)) {
            console.warn('problematic Symbols', where);
          }

          function set(keyOrSymbol) {
            where[keyOrSymbol] = arg[keyOrSymbol];
          }

          for (var i = 1, ii = arguments.length; i < ii; ++i) {
            var arg = arguments[i];

            if (arg === null || arg === undefined) {
              continue;
            }

            O.keys(arg).concat(filterOS(arg)).forEach(set);
          }

          return where;
        };
      }()
    });
  })(Object);

  if (!Object.is) {
    Object.is = function (x, y) {
      if (x === y) {
        return x !== 0 || 1 / x === 1 / y;
      } else {
        return x !== x && y !== y;
      }
    };
  }
}

if (typeof FEATURE_NO_ES2015 === 'undefined') {

  (function (global) {
    var i;

    var defineProperty = Object.defineProperty,
        is = function is(a, b) {
      return a === b || a !== a && b !== b;
    };

    if (typeof WeakMap == 'undefined') {
      global.WeakMap = createCollection({
        'delete': sharedDelete,

        clear: sharedClear,

        get: sharedGet,

        has: mapHas,

        set: sharedSet
      }, true);
    }

    if (typeof Map == 'undefined' || typeof new Map().values !== 'function' || !new Map().values().next) {
      var _createCollection;

      global.Map = createCollection((_createCollection = {
        'delete': sharedDelete,

        has: mapHas,

        get: sharedGet,

        set: sharedSet,

        keys: sharedKeys,

        values: sharedValues,

        entries: mapEntries,

        forEach: sharedForEach,

        clear: sharedClear
      }, _createCollection[Symbol.iterator] = mapEntries, _createCollection));
    }

    if (typeof Set == 'undefined' || typeof new Set().values !== 'function' || !new Set().values().next) {
      var _createCollection2;

      global.Set = createCollection((_createCollection2 = {
        has: setHas,

        add: sharedAdd,

        'delete': sharedDelete,

        clear: sharedClear,

        keys: sharedValues,
        values: sharedValues,

        entries: setEntries,

        forEach: sharedForEach
      }, _createCollection2[Symbol.iterator] = sharedValues, _createCollection2));
    }

    if (typeof WeakSet == 'undefined') {
      global.WeakSet = createCollection({
        'delete': sharedDelete,

        add: sharedAdd,

        clear: sharedClear,

        has: setHas
      }, true);
    }

    function createCollection(proto, objectOnly) {
      function Collection(a) {
        if (!this || this.constructor !== Collection) return new Collection(a);
        this._keys = [];
        this._values = [];
        this._itp = [];
        this.objectOnly = objectOnly;

        if (a) init.call(this, a);
      }

      if (!objectOnly) {
        defineProperty(proto, 'size', {
          get: sharedSize
        });
      }

      proto.constructor = Collection;
      Collection.prototype = proto;

      return Collection;
    }

    function init(a) {
      var i;

      if (this.add) a.forEach(this.add, this);else a.forEach(function (a) {
          this.set(a[0], a[1]);
        }, this);
    }

    function sharedDelete(key) {
      if (this.has(key)) {
        this._keys.splice(i, 1);
        this._values.splice(i, 1);

        this._itp.forEach(function (p) {
          if (i < p[0]) p[0]--;
        });
      }

      return -1 < i;
    };

    function sharedGet(key) {
      return this.has(key) ? this._values[i] : undefined;
    }

    function has(list, key) {
      if (this.objectOnly && key !== Object(key)) throw new TypeError("Invalid value used as weak collection key");

      if (key != key || key === 0) for (i = list.length; i-- && !is(list[i], key);) {} else i = list.indexOf(key);
      return -1 < i;
    }

    function setHas(value) {
      return has.call(this, this._values, value);
    }

    function mapHas(value) {
      return has.call(this, this._keys, value);
    }

    function sharedSet(key, value) {
      this.has(key) ? this._values[i] = value : this._values[this._keys.push(key) - 1] = value;
      return this;
    }

    function sharedAdd(value) {
      if (!this.has(value)) this._values.push(value);
      return this;
    }

    function sharedClear() {
      (this._keys || 0).length = this._values.length = 0;
    }

    function sharedKeys() {
      return sharedIterator(this._itp, this._keys);
    }

    function sharedValues() {
      return sharedIterator(this._itp, this._values);
    }

    function mapEntries() {
      return sharedIterator(this._itp, this._keys, this._values);
    }

    function setEntries() {
      return sharedIterator(this._itp, this._values, this._values);
    }

    function sharedIterator(itp, array, array2) {
      var _ref;

      var p = [0],
          done = false;
      itp.push(p);
      return _ref = {}, _ref[Symbol.iterator] = function () {
        return this;
      }, _ref.next = function next() {
        var v,
            k = p[0];
        if (!done && k < array.length) {
          v = array2 ? [array[k], array2[k]] : array[k];
          p[0]++;
        } else {
          done = true;
          itp.splice(itp.indexOf(p), 1);
        }
        return { done: done, value: v };
      }, _ref;
    }

    function sharedSize() {
      return this._values.length;
    }

    function sharedForEach(callback, context) {
      var it = this.entries();
      for (;;) {
        var r = it.next();
        if (r.done) break;
        callback.call(context, r.value[1], r.value[0], this);
      }
    }
  })(_aureliaPal.PLATFORM.global);
}

if (typeof FEATURE_NO_ES2015 === 'undefined') {

  var bind = Function.prototype.bind;

  if (typeof _aureliaPal.PLATFORM.global.Reflect === 'undefined') {
    _aureliaPal.PLATFORM.global.Reflect = {};
  }

  if (typeof Reflect.defineProperty !== 'function') {
    Reflect.defineProperty = function (target, propertyKey, descriptor) {
      if ((typeof target === 'undefined' ? 'undefined' : _typeof(target)) === 'object' ? target === null : typeof target !== 'function') {
        throw new TypeError('Reflect.defineProperty called on non-object');
      }
      try {
        Object.defineProperty(target, propertyKey, descriptor);
        return true;
      } catch (e) {
        return false;
      }
    };
  }

  if (typeof Reflect.construct !== 'function') {
    Reflect.construct = function (Target, args) {
      if (args) {
        switch (args.length) {
          case 0:
            return new Target();
          case 1:
            return new Target(args[0]);
          case 2:
            return new Target(args[0], args[1]);
          case 3:
            return new Target(args[0], args[1], args[2]);
          case 4:
            return new Target(args[0], args[1], args[2], args[3]);
        }
      }

      var a = [null];
      a.push.apply(a, args);
      return new (bind.apply(Target, a))();
    };
  }

  if (typeof Reflect.ownKeys !== 'function') {
    Reflect.ownKeys = function (o) {
      return Object.getOwnPropertyNames(o).concat(Object.getOwnPropertySymbols(o));
    };
  }
}

if (typeof FEATURE_NO_ESNEXT === 'undefined') {

  var emptyMetadata = Object.freeze({});
  var metadataContainerKey = '__metadata__';

  if (typeof Reflect.getOwnMetadata !== 'function') {
    Reflect.getOwnMetadata = function (metadataKey, target, targetKey) {
      if (target.hasOwnProperty(metadataContainerKey)) {
        return (target[metadataContainerKey][targetKey] || emptyMetadata)[metadataKey];
      }
    };
  }

  if (typeof Reflect.defineMetadata !== 'function') {
    Reflect.defineMetadata = function (metadataKey, metadataValue, target, targetKey) {
      var metadataContainer = target.hasOwnProperty(metadataContainerKey) ? target[metadataContainerKey] : target[metadataContainerKey] = {};
      var targetContainer = metadataContainer[targetKey] || (metadataContainer[targetKey] = {});
      targetContainer[metadataKey] = metadataValue;
    };
  }

  if (typeof Reflect.metadata !== 'function') {
    Reflect.metadata = function (metadataKey, metadataValue) {
      return function (target, targetKey) {
        Reflect.defineMetadata(metadataKey, metadataValue, target, targetKey);
      };
    };
  }
}
});
;
define('aurelia-task-queue/dist/commonjs/aurelia-task-queue',['require','exports','module','aurelia-pal'],function (require, exports, module) {'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TaskQueue = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _aureliaPal = require('aurelia-pal');



var stackSeparator = '\nEnqueued in TaskQueue by:\n';
var microStackSeparator = '\nEnqueued in MicroTaskQueue by:\n';

function makeRequestFlushFromMutationObserver(flush) {
  var observer = _aureliaPal.DOM.createMutationObserver(flush);
  var val = 'a';
  var node = _aureliaPal.DOM.createTextNode('a');
  var values = Object.create(null);
  values.a = 'b';
  values.b = 'a';
  observer.observe(node, { characterData: true });
  return function requestFlush() {
    node.data = val = values[val];
  };
}

function makeRequestFlushFromTimer(flush) {
  return function requestFlush() {
    var timeoutHandle = setTimeout(handleFlushTimer, 0);

    var intervalHandle = setInterval(handleFlushTimer, 50);
    function handleFlushTimer() {
      clearTimeout(timeoutHandle);
      clearInterval(intervalHandle);
      flush();
    }
  };
}

function onError(error, task, longStacks) {
  if (longStacks && task.stack && (typeof error === 'undefined' ? 'undefined' : _typeof(error)) === 'object' && error !== null) {
    error.stack = filterFlushStack(error.stack) + task.stack;
  }

  if ('onError' in task) {
    task.onError(error);
  } else {
    setTimeout(function () {
      throw error;
    }, 0);
  }
}

var TaskQueue = exports.TaskQueue = function () {
  function TaskQueue() {
    var _this = this;

    

    this.flushing = false;
    this.longStacks = false;

    this.microTaskQueue = [];
    this.microTaskQueueCapacity = 1024;
    this.taskQueue = [];

    if (_aureliaPal.FEATURE.mutationObserver) {
      this.requestFlushMicroTaskQueue = makeRequestFlushFromMutationObserver(function () {
        return _this.flushMicroTaskQueue();
      });
    } else {
      this.requestFlushMicroTaskQueue = makeRequestFlushFromTimer(function () {
        return _this.flushMicroTaskQueue();
      });
    }

    this.requestFlushTaskQueue = makeRequestFlushFromTimer(function () {
      return _this.flushTaskQueue();
    });
  }

  TaskQueue.prototype._flushQueue = function _flushQueue(queue, capacity) {
    var index = 0;
    var task = void 0;

    try {
      this.flushing = true;
      while (index < queue.length) {
        task = queue[index];
        if (this.longStacks) {
          this.stack = typeof task.stack === 'string' ? task.stack : undefined;
        }
        task.call();
        index++;

        if (index > capacity) {
          for (var scan = 0, newLength = queue.length - index; scan < newLength; scan++) {
            queue[scan] = queue[scan + index];
          }

          queue.length -= index;
          index = 0;
        }
      }
    } catch (error) {
      onError(error, task, this.longStacks);
    } finally {
      this.flushing = false;
    }
  };

  TaskQueue.prototype.queueMicroTask = function queueMicroTask(task) {
    if (this.microTaskQueue.length < 1) {
      this.requestFlushMicroTaskQueue();
    }

    if (this.longStacks) {
      task.stack = this.prepareQueueStack(microStackSeparator);
    }

    this.microTaskQueue.push(task);
  };

  TaskQueue.prototype.queueTask = function queueTask(task) {
    if (this.taskQueue.length < 1) {
      this.requestFlushTaskQueue();
    }

    if (this.longStacks) {
      task.stack = this.prepareQueueStack(stackSeparator);
    }

    this.taskQueue.push(task);
  };

  TaskQueue.prototype.flushTaskQueue = function flushTaskQueue() {
    var queue = this.taskQueue;
    this.taskQueue = [];
    this._flushQueue(queue, Number.MAX_VALUE);
  };

  TaskQueue.prototype.flushMicroTaskQueue = function flushMicroTaskQueue() {
    var queue = this.microTaskQueue;
    this._flushQueue(queue, this.microTaskQueueCapacity);
    queue.length = 0;
  };

  TaskQueue.prototype.prepareQueueStack = function prepareQueueStack(separator) {
    var stack = separator + filterQueueStack(captureStack());

    if (typeof this.stack === 'string') {
      stack = filterFlushStack(stack) + this.stack;
    }

    return stack;
  };

  return TaskQueue;
}();

function captureStack() {
  var error = new Error();

  if (error.stack) {
    return error.stack;
  }

  try {
    throw error;
  } catch (e) {
    return e.stack;
  }
}

function filterQueueStack(stack) {
  return stack.replace(/^[\s\S]*?\bqueue(Micro)?Task\b[^\n]*\n/, '');
}

function filterFlushStack(stack) {
  var index = stack.lastIndexOf('flushMicroTaskQueue');

  if (index < 0) {
    index = stack.lastIndexOf('flushTaskQueue');
    if (index < 0) {
      return stack;
    }
  }

  index = stack.lastIndexOf('\n', index);

  return index < 0 ? stack : stack.substr(0, index);
}
});
;
define('aurelia-templating/dist/commonjs/aurelia-templating',['require','exports','module','aurelia-pal','aurelia-loader','aurelia-metadata','aurelia-path','aurelia-logging','aurelia-binding','aurelia-dependency-injection','aurelia-task-queue'],function (require, exports, module) {'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var aureliaPal = require('aurelia-pal');
var aureliaLoader = require('aurelia-loader');
var aureliaMetadata = require('aurelia-metadata');
var aureliaPath = require('aurelia-path');
var LogManager = require('aurelia-logging');
var aureliaBinding = require('aurelia-binding');
var aureliaDependencyInjection = require('aurelia-dependency-injection');
var aureliaTaskQueue = require('aurelia-task-queue');

function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n["default"] = e;
    return Object.freeze(n);
}

var LogManager__namespace = /*#__PURE__*/_interopNamespace(LogManager);

var ElementEvents = (function () {
    function ElementEvents(element) {
        this.element = element;
        this.subscriptions = {};
    }
    ElementEvents.prototype._enqueueHandler = function (handler) {
        this.subscriptions[handler.eventName] = this.subscriptions[handler.eventName] || [];
        this.subscriptions[handler.eventName].push(handler);
    };
    ElementEvents.prototype._dequeueHandler = function (handler) {
        var index;
        var subscriptions = this.subscriptions[handler.eventName];
        if (subscriptions) {
            index = subscriptions.indexOf(handler);
            if (index > -1) {
                subscriptions.splice(index, 1);
            }
        }
        return handler;
    };
    ElementEvents.prototype.publish = function (eventName, detail, bubbles, cancelable) {
        if (detail === void 0) { detail = {}; }
        if (bubbles === void 0) { bubbles = true; }
        if (cancelable === void 0) { cancelable = true; }
        var event = aureliaPal.DOM.createCustomEvent(eventName, { cancelable: cancelable, bubbles: bubbles, detail: detail });
        this.element.dispatchEvent(event);
    };
    ElementEvents.prototype.subscribe = function (eventName, handler, captureOrOptions) {
        if (typeof handler === 'function') {
            if (captureOrOptions === undefined) {
                captureOrOptions = ElementEvents.defaultListenerOptions;
            }
            var eventHandler = new EventHandlerImpl(this, eventName, handler, captureOrOptions, false);
            return eventHandler;
        }
        return undefined;
    };
    ElementEvents.prototype.subscribeOnce = function (eventName, handler, captureOrOptions) {
        if (typeof handler === 'function') {
            if (captureOrOptions === undefined) {
                captureOrOptions = ElementEvents.defaultListenerOptions;
            }
            var eventHandler = new EventHandlerImpl(this, eventName, handler, captureOrOptions, true);
            return eventHandler;
        }
        return undefined;
    };
    ElementEvents.prototype.dispose = function (eventName) {
        if (eventName && typeof eventName === 'string') {
            var subscriptions = this.subscriptions[eventName];
            if (subscriptions) {
                while (subscriptions.length) {
                    var subscription = subscriptions.pop();
                    if (subscription) {
                        subscription.dispose();
                    }
                }
            }
        }
        else {
            this.disposeAll();
        }
    };
    ElementEvents.prototype.disposeAll = function () {
        for (var key in this.subscriptions) {
            this.dispose(key);
        }
    };
    ElementEvents.defaultListenerOptions = true;
    return ElementEvents;
}());
var EventHandlerImpl = (function () {
    function EventHandlerImpl(owner, eventName, handler, captureOrOptions, once) {
        this.owner = owner;
        this.eventName = eventName;
        this.handler = handler;
        this.capture = typeof captureOrOptions === 'boolean' ? captureOrOptions : captureOrOptions.capture;
        this.bubbles = !this.capture;
        this.captureOrOptions = captureOrOptions;
        this.once = once;
        owner.element.addEventListener(eventName, this, captureOrOptions);
        owner._enqueueHandler(this);
    }
    EventHandlerImpl.prototype.handleEvent = function (e) {
        var fn = this.handler;
        fn(e);
        if (this.once) {
            this.dispose();
        }
    };
    EventHandlerImpl.prototype.dispose = function () {
        this.owner.element.removeEventListener(this.eventName, this, this.captureOrOptions);
        this.owner._dequeueHandler(this);
        this.owner = this.handler = null;
    };
    return EventHandlerImpl;
}());

var ResourceLoadContext = (function () {
    function ResourceLoadContext() {
        this.dependencies = {};
    }
    ResourceLoadContext.prototype.addDependency = function (url) {
        this.dependencies[url] = true;
    };
    ResourceLoadContext.prototype.hasDependency = function (url) {
        return url in this.dependencies;
    };
    return ResourceLoadContext;
}());
var ViewCompileInstruction = (function () {
    function ViewCompileInstruction(targetShadowDOM, compileSurrogate) {
        if (targetShadowDOM === void 0) { targetShadowDOM = false; }
        if (compileSurrogate === void 0) { compileSurrogate = false; }
        this.targetShadowDOM = targetShadowDOM;
        this.compileSurrogate = compileSurrogate;
        this.associatedModuleId = null;
    }
    ViewCompileInstruction.normal = new ViewCompileInstruction();
    return ViewCompileInstruction;
}());
var BehaviorInstruction = (function () {
    function BehaviorInstruction() {
    }
    BehaviorInstruction.enhance = function () {
        var instruction = new BehaviorInstruction();
        instruction.enhance = true;
        return instruction;
    };
    BehaviorInstruction.unitTest = function (type, attributes) {
        var instruction = new BehaviorInstruction();
        instruction.type = type;
        instruction.attributes = attributes || {};
        return instruction;
    };
    BehaviorInstruction.element = function (node, type) {
        var instruction = new BehaviorInstruction();
        instruction.type = type;
        instruction.attributes = {};
        instruction.anchorIsContainer = !(node.hasAttribute('containerless') || type.containerless);
        instruction.initiatedByBehavior = true;
        return instruction;
    };
    BehaviorInstruction.attribute = function (attrName, type) {
        var instruction = new BehaviorInstruction();
        instruction.attrName = attrName;
        instruction.type = type || null;
        instruction.attributes = {};
        return instruction;
    };
    BehaviorInstruction.dynamic = function (host, viewModel, viewFactory) {
        var instruction = new BehaviorInstruction();
        instruction.host = host;
        instruction.viewModel = viewModel;
        instruction.viewFactory = viewFactory;
        instruction.inheritBindingContext = true;
        return instruction;
    };
    BehaviorInstruction.normal = new BehaviorInstruction();
    return BehaviorInstruction;
}());
var biProto = BehaviorInstruction.prototype;
biProto.initiatedByBehavior = false;
biProto.enhance = false;
biProto.partReplacements = null;
biProto.viewFactory = null;
biProto.originalAttrName = null;
biProto.skipContentProcessing = false;
biProto.contentFactory = null;
biProto.viewModel = null;
biProto.anchorIsContainer = false;
biProto.host = null;
biProto.attributes = null;
biProto.type = null;
biProto.attrName = null;
biProto.inheritBindingContext = false;
var TargetInstruction = (function () {
    function TargetInstruction() {
    }
    TargetInstruction.shadowSlot = function (parentInjectorId) {
        var instruction = new TargetInstruction();
        instruction.parentInjectorId = parentInjectorId;
        instruction.shadowSlot = true;
        return instruction;
    };
    TargetInstruction.contentExpression = function (expression) {
        var instruction = new TargetInstruction();
        instruction.contentExpression = expression;
        return instruction;
    };
    TargetInstruction.letElement = function (expressions) {
        var instruction = new TargetInstruction();
        instruction.expressions = expressions;
        instruction.letElement = true;
        return instruction;
    };
    TargetInstruction.lifting = function (parentInjectorId, liftingInstruction) {
        var instruction = new TargetInstruction();
        instruction.parentInjectorId = parentInjectorId;
        instruction.expressions = TargetInstruction.noExpressions;
        instruction.behaviorInstructions = [liftingInstruction];
        instruction.viewFactory = liftingInstruction.viewFactory;
        instruction.providers = [liftingInstruction.type.target];
        instruction.lifting = true;
        return instruction;
    };
    TargetInstruction.normal = function (injectorId, parentInjectorId, providers, behaviorInstructions, expressions, elementInstruction) {
        var instruction = new TargetInstruction();
        instruction.injectorId = injectorId;
        instruction.parentInjectorId = parentInjectorId;
        instruction.providers = providers;
        instruction.behaviorInstructions = behaviorInstructions;
        instruction.expressions = expressions;
        instruction.anchorIsContainer = elementInstruction ? elementInstruction.anchorIsContainer : true;
        instruction.elementInstruction = elementInstruction;
        return instruction;
    };
    TargetInstruction.surrogate = function (providers, behaviorInstructions, expressions, values) {
        var instruction = new TargetInstruction();
        instruction.expressions = expressions;
        instruction.behaviorInstructions = behaviorInstructions;
        instruction.providers = providers;
        instruction.values = values;
        return instruction;
    };
    TargetInstruction.noExpressions = Object.freeze([]);
    return TargetInstruction;
}());
var tiProto = TargetInstruction.prototype;
tiProto.injectorId = null;
tiProto.parentInjectorId = null;
tiProto.shadowSlot = false;
tiProto.slotName = null;
tiProto.slotFallbackFactory = null;
tiProto.contentExpression = null;
tiProto.letElement = false;
tiProto.expressions = null;
tiProto.expressions = null;
tiProto.providers = null;
tiProto.viewFactory = null;
tiProto.anchorIsContainer = false;
tiProto.elementInstruction = null;
tiProto.lifting = false;
tiProto.values = null;

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}

var capitalMatcher = /([A-Z])/g;
function addHyphenAndLower(char) {
    return '-' + char.toLowerCase();
}
function _hyphenate(name) {
    return (name.charAt(0).toLowerCase() + name.slice(1)).replace(capitalMatcher, addHyphenAndLower);
}
function _isAllWhitespace(node) {
    return !(node.auInterpolationTarget || (/[^\t\n\r ]/.test(node.textContent)));
}

var BehaviorPropertyObserver = (function () {
    function BehaviorPropertyObserver(taskQueue, obj, propertyName, selfSubscriber, initialValue) {
        this.taskQueue = taskQueue;
        this.obj = obj;
        this.propertyName = propertyName;
        this.notqueued = true;
        this.publishing = false;
        this.selfSubscriber = selfSubscriber;
        this.currentValue = this.oldValue = initialValue;
    }
    BehaviorPropertyObserver.prototype.getValue = function () {
        return this.currentValue;
    };
    BehaviorPropertyObserver.prototype.setValue = function (newValue) {
        var oldValue = this.currentValue;
        if (!Object.is(newValue, oldValue)) {
            this.oldValue = oldValue;
            this.currentValue = newValue;
            if (this.publishing && this.notqueued) {
                if (this.taskQueue.flushing) {
                    this.call();
                }
                else {
                    this.notqueued = false;
                    this.taskQueue.queueMicroTask(this);
                }
            }
        }
    };
    BehaviorPropertyObserver.prototype.call = function () {
        var oldValue = this.oldValue;
        var newValue = this.currentValue;
        this.notqueued = true;
        if (Object.is(newValue, oldValue)) {
            return;
        }
        if (this.selfSubscriber) {
            this.selfSubscriber(newValue, oldValue);
        }
        this.callSubscribers(newValue, oldValue);
        this.oldValue = newValue;
    };
    BehaviorPropertyObserver.prototype.callSubscribers = function (newValue, oldValue) {
        throw new Error('Method not implemented.');
    };
    BehaviorPropertyObserver.prototype.subscribe = function (context, callable) {
        this.addSubscriber(context, callable);
    };
    BehaviorPropertyObserver.prototype.addSubscriber = function (context, callable) {
        throw new Error('Method not implemented.');
    };
    BehaviorPropertyObserver.prototype.unsubscribe = function (context, callable) {
        this.removeSubscriber(context, callable);
    };
    BehaviorPropertyObserver.prototype.removeSubscriber = function (context, callable) {
        throw new Error('Method not implemented.');
    };
    BehaviorPropertyObserver = __decorate([
        aureliaBinding.subscriberCollection()
    ], BehaviorPropertyObserver);
    return BehaviorPropertyObserver;
}());

function getObserver(instance, name) {
    var lookup = instance.__observers__;
    if (lookup === undefined) {
        var ctor = Object.getPrototypeOf(instance).constructor;
        var behavior = aureliaMetadata.metadata.get(aureliaMetadata.metadata.resource, ctor);
        if (!behavior.isInitialized) {
            behavior.initialize(aureliaDependencyInjection.Container.instance || new aureliaDependencyInjection.Container(), instance.constructor);
        }
        lookup = behavior.observerLocator.getOrCreateObserversLookup(instance);
        behavior._ensurePropertiesDefined(instance, lookup);
    }
    return lookup[name];
}
var BindableProperty = (function () {
    function BindableProperty(nameOrConfig) {
        if (typeof nameOrConfig === 'string') {
            this.name = nameOrConfig;
        }
        else {
            Object.assign(this, nameOrConfig);
        }
        this.attribute = this.attribute || _hyphenate(this.name);
        var defaultBindingMode = this.defaultBindingMode;
        if (defaultBindingMode === null || defaultBindingMode === undefined) {
            this.defaultBindingMode = aureliaBinding.bindingMode.oneWay;
        }
        else if (typeof defaultBindingMode === 'string') {
            this.defaultBindingMode = aureliaBinding.bindingMode[defaultBindingMode] || aureliaBinding.bindingMode.oneWay;
        }
        this.changeHandler = this.changeHandler || null;
        this.owner = null;
        this.descriptor = null;
    }
    BindableProperty.prototype.registerWith = function (target, behavior, descriptor) {
        behavior.properties.push(this);
        behavior.attributes[this.attribute] = this;
        this.owner = behavior;
        if (descriptor) {
            this.descriptor = descriptor;
            return this._configureDescriptor(descriptor);
        }
        return undefined;
    };
    BindableProperty.prototype._configureDescriptor = function (descriptor) {
        var name = this.name;
        descriptor.configurable = true;
        descriptor.enumerable = true;
        if ('initializer' in descriptor) {
            this.defaultValue = descriptor.initializer;
            delete descriptor.initializer;
            delete descriptor.writable;
        }
        if ('value' in descriptor) {
            this.defaultValue = descriptor.value;
            delete descriptor.value;
            delete descriptor.writable;
        }
        descriptor.get = function () {
            return getObserver(this, name).getValue();
        };
        descriptor.set = function (value) {
            getObserver(this, name).setValue(value);
        };
        descriptor.get.getObserver = function (obj) {
            return getObserver(obj, name);
        };
        return descriptor;
    };
    BindableProperty.prototype.defineOn = function (target, behavior) {
        var name = this.name;
        var handlerName;
        if (this.changeHandler === null) {
            handlerName = name + 'Changed';
            if (handlerName in target.prototype) {
                this.changeHandler = handlerName;
            }
        }
        if (this.descriptor === null) {
            Object.defineProperty(target.prototype, name, this._configureDescriptor({}));
        }
    };
    BindableProperty.prototype.createObserver = function (viewModel) {
        var selfSubscriber = null;
        var defaultValue = this.defaultValue;
        var changeHandlerName = this.changeHandler;
        var name = this.name;
        var initialValue;
        if (this.hasOptions) {
            return undefined;
        }
        if (changeHandlerName in viewModel) {
            if ('propertyChanged' in viewModel) {
                selfSubscriber = function (newValue, oldValue) {
                    viewModel[changeHandlerName](newValue, oldValue);
                    viewModel.propertyChanged(name, newValue, oldValue);
                };
            }
            else {
                selfSubscriber = function (newValue, oldValue) { return viewModel[changeHandlerName](newValue, oldValue); };
            }
        }
        else if ('propertyChanged' in viewModel) {
            selfSubscriber = function (newValue, oldValue) { return viewModel.propertyChanged(name, newValue, oldValue); };
        }
        else if (changeHandlerName !== null) {
            throw new Error("Change handler ".concat(changeHandlerName, " was specified but not declared on the class."));
        }
        if (defaultValue !== undefined) {
            initialValue = typeof defaultValue === 'function' ? defaultValue.call(viewModel) : defaultValue;
        }
        return new BehaviorPropertyObserver(this.owner.taskQueue, viewModel, this.name, selfSubscriber, initialValue);
    };
    BindableProperty.prototype._initialize = function (viewModel, observerLookup, attributes, behaviorHandlesBind, boundProperties) {
        var selfSubscriber;
        var observer;
        var attribute;
        var defaultValue = this.defaultValue;
        if (this.isDynamic) {
            for (var key in attributes) {
                this._createDynamicProperty(viewModel, observerLookup, behaviorHandlesBind, key, attributes[key], boundProperties);
            }
        }
        else if (!this.hasOptions) {
            observer = observerLookup[this.name];
            if (attributes !== null) {
                selfSubscriber = observer.selfSubscriber;
                attribute = attributes[this.attribute];
                if (behaviorHandlesBind) {
                    observer.selfSubscriber = null;
                }
                if (typeof attribute === 'string') {
                    viewModel[this.name] = attribute;
                    observer.call();
                }
                else if (attribute) {
                    boundProperties.push({ observer: observer, binding: attribute.createBinding(viewModel) });
                }
                else if (defaultValue !== undefined) {
                    observer.call();
                }
                observer.selfSubscriber = selfSubscriber;
            }
            observer.publishing = true;
        }
    };
    BindableProperty.prototype._createDynamicProperty = function (viewModel, observerLookup, behaviorHandlesBind, name, attribute, boundProperties) {
        var changeHandlerName = name + 'Changed';
        var selfSubscriber = null;
        var observer;
        var info;
        if (changeHandlerName in viewModel) {
            if ('propertyChanged' in viewModel) {
                selfSubscriber = function (newValue, oldValue) {
                    viewModel[changeHandlerName](newValue, oldValue);
                    viewModel.propertyChanged(name, newValue, oldValue);
                };
            }
            else {
                selfSubscriber = function (newValue, oldValue) { return viewModel[changeHandlerName](newValue, oldValue); };
            }
        }
        else if ('propertyChanged' in viewModel) {
            selfSubscriber = function (newValue, oldValue) { return viewModel.propertyChanged(name, newValue, oldValue); };
        }
        observer = observerLookup[name] = new BehaviorPropertyObserver(this.owner.taskQueue, viewModel, name, selfSubscriber);
        Object.defineProperty(viewModel, name, {
            configurable: true,
            enumerable: true,
            get: observer.getValue.bind(observer),
            set: observer.setValue.bind(observer)
        });
        if (behaviorHandlesBind) {
            observer.selfSubscriber = null;
        }
        if (typeof attribute === 'string') {
            viewModel[name] = attribute;
            observer.call();
        }
        else if (attribute) {
            info = { observer: observer, binding: attribute.createBinding(viewModel) };
            boundProperties.push(info);
        }
        observer.publishing = true;
        observer.selfSubscriber = selfSubscriber;
    };
    return BindableProperty;
}());

var ViewLocator = (function () {
    function ViewLocator() {
    }
    ViewLocator.prototype.getViewStrategy = function (value) {
        if (!value) {
            return null;
        }
        if (typeof value === 'object' && 'getViewStrategy' in value) {
            var origin_1 = aureliaMetadata.Origin.get(value.constructor);
            value = value.getViewStrategy();
            if (typeof value === 'string') {
                value = new RelativeViewStrategy(value);
            }
            viewStrategy.assert(value);
            if (origin_1.moduleId) {
                value.makeRelativeTo(origin_1.moduleId);
            }
            return value;
        }
        if (typeof value === 'string') {
            value = new RelativeViewStrategy(value);
        }
        if (viewStrategy.validate(value)) {
            return value;
        }
        if (typeof value !== 'function') {
            value = value.constructor;
        }
        if ('$view' in value) {
            var c = value.$view;
            var view = void 0;
            c = typeof c === 'function' ? c.call(value) : c;
            if (c === null) {
                view = new NoViewStrategy();
            }
            else {
                view = c instanceof StaticViewStrategy ? c : new StaticViewStrategy(c);
            }
            aureliaMetadata.metadata.define(ViewLocator.viewStrategyMetadataKey, view, value);
            return view;
        }
        var origin = aureliaMetadata.Origin.get(value);
        var strategy = aureliaMetadata.metadata.get(ViewLocator.viewStrategyMetadataKey, value);
        if (!strategy) {
            if (!origin.moduleId) {
                throw new Error('Cannot determine default view strategy for object.\n' + value);
            }
            strategy = this.createFallbackViewStrategy(origin);
        }
        else if (origin.moduleId) {
            strategy.moduleId = origin.moduleId;
        }
        return strategy;
    };
    ViewLocator.prototype.createFallbackViewStrategy = function (origin) {
        return new ConventionalViewStrategy(this, origin);
    };
    ViewLocator.prototype.convertOriginToViewUrl = function (origin) {
        var moduleId = origin.moduleId;
        var id = (moduleId.endsWith('.js') || moduleId.endsWith('.ts')) ? moduleId.substring(0, moduleId.length - 3) : moduleId;
        return id + '.html';
    };
    ViewLocator.viewStrategyMetadataKey = 'aurelia:view-strategy';
    return ViewLocator;
}());

function mi(name) {
    throw new Error("BindingLanguage must implement ".concat(name, "()."));
}
var BindingLanguage = (function () {
    function BindingLanguage() {
    }
    BindingLanguage.prototype.inspectAttribute = function (resources, elementName, attrName, attrValue) {
        mi('inspectAttribute');
    };
    BindingLanguage.prototype.createAttributeInstruction = function (resources, element, info, existingInstruction, context) {
        mi('createAttributeInstruction');
    };
    BindingLanguage.prototype.createLetExpressions = function (resources, element) {
        mi('createLetExpressions');
    };
    BindingLanguage.prototype.inspectTextContent = function (resources, value) {
        mi('inspectTextContent');
    };
    return BindingLanguage;
}());

var noNodes = Object.freeze([]);
var SlotCustomAttribute = (function () {
    function SlotCustomAttribute(element) {
        this.element = element;
        this.element.auSlotAttribute = this;
    }
    SlotCustomAttribute.inject = function () {
        return [aureliaPal.DOM.Element];
    };
    SlotCustomAttribute.prototype.valueChanged = function (newValue, oldValue) { };
    return SlotCustomAttribute;
}());
var PassThroughSlot = (function () {
    function PassThroughSlot(anchor, name, destinationName, fallbackFactory) {
        this.anchor = anchor;
        this.anchor.viewSlot = this;
        this.name = name;
        this.destinationName = destinationName;
        this.fallbackFactory = fallbackFactory;
        this.destinationSlot = null;
        this.projections = 0;
        this.contentView = null;
        var attr = new SlotCustomAttribute(this.anchor);
        attr.value = this.destinationName;
    }
    Object.defineProperty(PassThroughSlot.prototype, "needsFallbackRendering", {
        get: function () {
            return this.fallbackFactory && this.projections === 0;
        },
        enumerable: false,
        configurable: true
    });
    PassThroughSlot.prototype.renderFallbackContent = function (view, nodes, projectionSource, index) {
        if (this.contentView === null) {
            this.contentView = this.fallbackFactory.create(this.ownerView.container);
            this.contentView.bind(this.ownerView.bindingContext, this.ownerView.overrideContext);
            var slots = Object.create(null);
            slots[this.destinationSlot.name] = this.destinationSlot;
            ShadowDOM.distributeView(this.contentView, slots, projectionSource, index, this.destinationSlot.name);
        }
    };
    PassThroughSlot.prototype.passThroughTo = function (destinationSlot) {
        this.destinationSlot = destinationSlot;
    };
    PassThroughSlot.prototype.addNode = function (view, node, projectionSource, index) {
        if (this.contentView !== null) {
            this.contentView.removeNodes();
            this.contentView.detached();
            this.contentView.unbind();
            this.contentView = null;
        }
        if (node.viewSlot instanceof PassThroughSlot) {
            node.viewSlot.passThroughTo(this);
            return;
        }
        this.projections++;
        this.destinationSlot.addNode(view, node, projectionSource, index);
    };
    PassThroughSlot.prototype.removeView = function (view, projectionSource) {
        this.projections--;
        this.destinationSlot.removeView(view, projectionSource);
        if (this.needsFallbackRendering) {
            this.renderFallbackContent(null, noNodes, projectionSource);
        }
    };
    PassThroughSlot.prototype.removeAll = function (projectionSource) {
        this.projections = 0;
        this.destinationSlot.removeAll(projectionSource);
        if (this.needsFallbackRendering) {
            this.renderFallbackContent(null, noNodes, projectionSource);
        }
    };
    PassThroughSlot.prototype.projectFrom = function (view, projectionSource) {
        this.destinationSlot.projectFrom(view, projectionSource);
    };
    PassThroughSlot.prototype.created = function (ownerView) {
        this.ownerView = ownerView;
    };
    PassThroughSlot.prototype.bind = function (view) {
        if (this.contentView) {
            this.contentView.bind(view.bindingContext, view.overrideContext);
        }
    };
    PassThroughSlot.prototype.attached = function () {
        if (this.contentView) {
            this.contentView.attached();
        }
    };
    PassThroughSlot.prototype.detached = function () {
        if (this.contentView) {
            this.contentView.detached();
        }
    };
    PassThroughSlot.prototype.unbind = function () {
        if (this.contentView) {
            this.contentView.unbind();
        }
    };
    return PassThroughSlot;
}());
var ShadowSlot = (function () {
    function ShadowSlot(anchor, name, fallbackFactory) {
        this.anchor = anchor;
        this.anchor.isContentProjectionSource = true;
        this.anchor.viewSlot = this;
        this.name = name;
        this.fallbackFactory = fallbackFactory;
        this.contentView = null;
        this.projections = 0;
        this.children = [];
        this.projectFromAnchors = null;
        this.destinationSlots = null;
    }
    Object.defineProperty(ShadowSlot.prototype, "needsFallbackRendering", {
        get: function () {
            return this.fallbackFactory && this.projections === 0;
        },
        enumerable: false,
        configurable: true
    });
    ShadowSlot.prototype.addNode = function (view, node, projectionSource, index, destination) {
        var $node = node;
        if (this.contentView !== null) {
            this.contentView.removeNodes();
            this.contentView.detached();
            this.contentView.unbind();
            this.contentView = null;
        }
        if ($node.viewSlot instanceof PassThroughSlot) {
            $node.viewSlot.passThroughTo(this);
            return;
        }
        if (this.destinationSlots !== null) {
            ShadowDOM.distributeNodes(view, [$node], this.destinationSlots, this, index);
        }
        else {
            $node.auOwnerView = view;
            $node.auProjectionSource = projectionSource;
            $node.auAssignedSlot = this;
            var anchor = this._findAnchor(view, $node, projectionSource, index);
            var parent_1 = anchor.parentNode;
            parent_1.insertBefore($node, anchor);
            this.children.push($node);
            this.projections++;
        }
    };
    ShadowSlot.prototype.removeView = function (view, projectionSource) {
        if (this.destinationSlots !== null) {
            ShadowDOM.undistributeView(view, this.destinationSlots, this);
        }
        else if (this.contentView && this.contentView.hasSlots) {
            ShadowDOM.undistributeView(view, this.contentView.slots, projectionSource);
        }
        else {
            var found = this.children.find(function (x) { return x.auSlotProjectFrom === projectionSource; });
            if (found) {
                var children = found.auProjectionChildren;
                var ownChildren = this.children;
                for (var i = 0, ii = children.length; i < ii; ++i) {
                    var child = children[i];
                    if (child.auOwnerView === view) {
                        children.splice(i, 1);
                        view.fragment.appendChild(child);
                        i--;
                        ii--;
                        this.projections--;
                        var idx = ownChildren.indexOf(child);
                        if (idx > -1) {
                            ownChildren.splice(idx, 1);
                        }
                    }
                }
                if (this.needsFallbackRendering) {
                    this.renderFallbackContent(view, noNodes, projectionSource);
                }
            }
        }
    };
    ShadowSlot.prototype.removeAll = function (projectionSource) {
        if (this.destinationSlots !== null) {
            ShadowDOM.undistributeAll(this.destinationSlots, this);
        }
        else if (this.contentView && this.contentView.hasSlots) {
            ShadowDOM.undistributeAll(this.contentView.slots, projectionSource);
        }
        else {
            var found = this.children.find(function (x) { return x.auSlotProjectFrom === projectionSource; });
            if (found) {
                var children = found.auProjectionChildren;
                var ownChildren = this.children;
                for (var i = 0, ii = children.length; i < ii; ++i) {
                    var child = children[i];
                    child.auOwnerView.fragment.appendChild(child);
                    this.projections--;
                    var idx = ownChildren.indexOf(child);
                    if (idx > -1) {
                        ownChildren.splice(idx, 1);
                    }
                }
                found.auProjectionChildren = [];
                if (this.needsFallbackRendering) {
                    this.renderFallbackContent(null, noNodes, projectionSource);
                }
            }
        }
    };
    ShadowSlot.prototype._findAnchor = function (view, node, projectionSource, index) {
        if (projectionSource) {
            var found = this.children.find(function (x) { return x.auSlotProjectFrom === projectionSource; });
            if (found) {
                if (index !== undefined) {
                    var children = found.auProjectionChildren;
                    var viewIndex = -1;
                    var lastView = void 0;
                    for (var i = 0, ii = children.length; i < ii; ++i) {
                        var current = children[i];
                        if (current.auOwnerView !== lastView) {
                            viewIndex++;
                            lastView = current.auOwnerView;
                            if (viewIndex >= index && lastView !== view) {
                                children.splice(i, 0, node);
                                return current;
                            }
                        }
                    }
                }
                found.auProjectionChildren.push(node);
                return found;
            }
        }
        return this.anchor;
    };
    ShadowSlot.prototype.projectTo = function (slots) {
        this.destinationSlots = slots;
    };
    ShadowSlot.prototype.projectFrom = function (view, projectionSource) {
        var anchor = aureliaPal.DOM.createComment('anchor');
        var parent = this.anchor.parentNode;
        anchor.auSlotProjectFrom = projectionSource;
        anchor.auOwnerView = view;
        anchor.auProjectionChildren = [];
        parent.insertBefore(anchor, this.anchor);
        this.children.push(anchor);
        if (this.projectFromAnchors === null) {
            this.projectFromAnchors = [];
        }
        this.projectFromAnchors.push(anchor);
    };
    ShadowSlot.prototype.renderFallbackContent = function (view, nodes, projectionSource, index) {
        if (this.contentView === null) {
            this.contentView = this.fallbackFactory.create(this.ownerView.container);
            this.contentView.bind(this.ownerView.bindingContext, this.ownerView.overrideContext);
            this.contentView.insertNodesBefore(this.anchor);
        }
        if (this.contentView.hasSlots) {
            var slots = this.contentView.slots;
            var projectFromAnchors = this.projectFromAnchors;
            if (projectFromAnchors !== null) {
                for (var slotName in slots) {
                    var slot = slots[slotName];
                    for (var i = 0, ii = projectFromAnchors.length; i < ii; ++i) {
                        var anchor = projectFromAnchors[i];
                        slot.projectFrom(anchor.auOwnerView, anchor.auSlotProjectFrom);
                    }
                }
            }
            this.fallbackSlots = slots;
            ShadowDOM.distributeNodes(view, nodes, slots, projectionSource, index);
        }
    };
    ShadowSlot.prototype.created = function (ownerView) {
        this.ownerView = ownerView;
    };
    ShadowSlot.prototype.bind = function (view) {
        if (this.contentView) {
            this.contentView.bind(view.bindingContext, view.overrideContext);
        }
    };
    ShadowSlot.prototype.attached = function () {
        if (this.contentView) {
            this.contentView.attached();
        }
    };
    ShadowSlot.prototype.detached = function () {
        if (this.contentView) {
            this.contentView.detached();
        }
    };
    ShadowSlot.prototype.unbind = function () {
        if (this.contentView) {
            this.contentView.unbind();
        }
    };
    return ShadowSlot;
}());
var ShadowDOM = (function () {
    function ShadowDOM() {
    }
    ShadowDOM.getSlotName = function (node) {
        if (node.auSlotAttribute === undefined) {
            return ShadowDOM.defaultSlotKey;
        }
        return node.auSlotAttribute.value;
    };
    ShadowDOM.distributeView = function (view, slots, projectionSource, index, destinationOverride) {
        var nodes;
        if (view === null) {
            nodes = noNodes;
        }
        else {
            var childNodes = view.fragment.childNodes;
            var ii = childNodes.length;
            nodes = new Array(ii);
            for (var i = 0; i < ii; ++i) {
                nodes[i] = childNodes[i];
            }
        }
        ShadowDOM.distributeNodes(view, nodes, slots, projectionSource, index, destinationOverride);
    };
    ShadowDOM.undistributeView = function (view, slots, projectionSource) {
        for (var slotName in slots) {
            slots[slotName].removeView(view, projectionSource);
        }
    };
    ShadowDOM.undistributeAll = function (slots, projectionSource) {
        for (var slotName in slots) {
            slots[slotName].removeAll(projectionSource);
        }
    };
    ShadowDOM.distributeNodes = function (view, nodes, slots, projectionSource, index, destinationOverride) {
        for (var i = 0, ii = nodes.length; i < ii; ++i) {
            var currentNode = nodes[i];
            var nodeType = currentNode.nodeType;
            if (currentNode.isContentProjectionSource) {
                currentNode.viewSlot.projectTo(slots);
                for (var slotName in slots) {
                    slots[slotName].projectFrom(view, currentNode.viewSlot);
                }
                nodes.splice(i, 1);
                ii--;
                i--;
            }
            else if (nodeType === 1 || nodeType === 3 || currentNode.viewSlot instanceof PassThroughSlot) {
                if (nodeType === 3 && _isAllWhitespace(currentNode)) {
                    nodes.splice(i, 1);
                    ii--;
                    i--;
                }
                else {
                    var found = slots[destinationOverride || ShadowDOM.getSlotName(currentNode)];
                    if (found) {
                        found.addNode(view, currentNode, projectionSource, index);
                        nodes.splice(i, 1);
                        ii--;
                        i--;
                    }
                }
            }
            else {
                nodes.splice(i, 1);
                ii--;
                i--;
            }
        }
        for (var slotName in slots) {
            var slot = slots[slotName];
            if (slot.needsFallbackRendering) {
                slot.renderFallbackContent(view, nodes, projectionSource, index);
            }
        }
    };
    ShadowDOM.defaultSlotKey = '__au-default-slot-key__';
    return ShadowDOM;
}());

var CompositionTransactionNotifier = (function () {
    function CompositionTransactionNotifier(owner) {
        this.owner = owner;
        this.owner._compositionCount++;
    }
    CompositionTransactionNotifier.prototype.done = function () {
        this.owner._compositionCount--;
        this.owner._tryCompleteTransaction();
    };
    return CompositionTransactionNotifier;
}());
var CompositionTransactionOwnershipToken = (function () {
    function CompositionTransactionOwnershipToken(owner) {
        this.owner = owner;
        this.owner._ownershipToken = this;
        this.thenable = this._createThenable();
    }
    CompositionTransactionOwnershipToken.prototype.waitForCompositionComplete = function () {
        this.owner._tryCompleteTransaction();
        return this.thenable;
    };
    CompositionTransactionOwnershipToken.prototype.resolve = function () {
        this._resolveCallback();
    };
    CompositionTransactionOwnershipToken.prototype._resolveCallback = function () {
        throw new Error("Method not implemented.");
    };
    CompositionTransactionOwnershipToken.prototype._createThenable = function () {
        var _this = this;
        return new Promise(function (resolve) {
            _this._resolveCallback = resolve;
        });
    };
    return CompositionTransactionOwnershipToken;
}());
var CompositionTransaction = (function () {
    function CompositionTransaction() {
        this._ownershipToken = null;
        this._compositionCount = 0;
    }
    CompositionTransaction.prototype.tryCapture = function () {
        return this._ownershipToken === null
            ? new CompositionTransactionOwnershipToken(this)
            : null;
    };
    CompositionTransaction.prototype.enlist = function () {
        return new CompositionTransactionNotifier(this);
    };
    CompositionTransaction.prototype._tryCompleteTransaction = function () {
        if (this._compositionCount <= 0) {
            this._compositionCount = 0;
            if (this._ownershipToken !== null) {
                var token = this._ownershipToken;
                this._ownershipToken = null;
                token.resolve();
            }
        }
    };
    return CompositionTransaction;
}());

var View = (function () {
    function View(container, viewFactory, fragment, controllers, bindings, children, slots) {
        this.container = container;
        this.viewFactory = viewFactory;
        this.resources = viewFactory.resources;
        this.fragment = fragment;
        this.firstChild = fragment.firstChild;
        this.lastChild = fragment.lastChild;
        this.controllers = controllers;
        this.bindings = bindings;
        this.children = children;
        this.slots = slots;
        this.hasSlots = false;
        this.fromCache = false;
        this.isBound = false;
        this.isAttached = false;
        this.bindingContext = null;
        this.overrideContext = null;
        this.controller = null;
        this.viewModelScope = null;
        this.animatableElement = undefined;
        this._isUserControlled = false;
        this.contentView = null;
        for (var _ in slots) {
            this.hasSlots = true;
            break;
        }
    }
    View.prototype.returnToCache = function () {
        this.viewFactory.returnViewToCache(this);
    };
    View.prototype.created = function () {
        var i;
        var ii;
        var controllers = this.controllers;
        for (i = 0, ii = controllers.length; i < ii; ++i) {
            controllers[i].created(this);
        }
    };
    View.prototype.bind = function (bindingContext, overrideContext, _systemUpdate) {
        var controllers;
        var bindings;
        var children;
        var i;
        var ii;
        if (_systemUpdate && this._isUserControlled) {
            return;
        }
        if (this.isBound) {
            if (this.bindingContext === bindingContext) {
                return;
            }
            this.unbind();
        }
        this.isBound = true;
        this.bindingContext = bindingContext;
        this.overrideContext = overrideContext || aureliaBinding.createOverrideContext(bindingContext);
        this.resources._invokeHook('beforeBind', this);
        bindings = this.bindings;
        for (i = 0, ii = bindings.length; i < ii; ++i) {
            bindings[i].bind(this);
        }
        if (this.viewModelScope !== null) {
            bindingContext.bind(this.viewModelScope.bindingContext, this.viewModelScope.overrideContext);
            this.viewModelScope = null;
        }
        controllers = this.controllers;
        for (i = 0, ii = controllers.length; i < ii; ++i) {
            controllers[i].bind(this);
        }
        children = this.children;
        for (i = 0, ii = children.length; i < ii; ++i) {
            children[i].bind(bindingContext, overrideContext, true);
        }
        if (this.hasSlots) {
            ShadowDOM.distributeView(this.contentView, this.slots);
        }
    };
    View.prototype.addBinding = function (binding) {
        this.bindings.push(binding);
        if (this.isBound) {
            binding.bind(this);
        }
    };
    View.prototype.unbind = function () {
        var controllers;
        var bindings;
        var children;
        var i;
        var ii;
        if (this.isBound) {
            this.isBound = false;
            this.resources._invokeHook('beforeUnbind', this);
            if (this.controller !== null) {
                this.controller.unbind();
            }
            bindings = this.bindings;
            for (i = 0, ii = bindings.length; i < ii; ++i) {
                bindings[i].unbind();
            }
            controllers = this.controllers;
            for (i = 0, ii = controllers.length; i < ii; ++i) {
                controllers[i].unbind();
            }
            children = this.children;
            for (i = 0, ii = children.length; i < ii; ++i) {
                children[i].unbind();
            }
            this.bindingContext = null;
            this.overrideContext = null;
        }
    };
    View.prototype.insertNodesBefore = function (refNode) {
        refNode.parentNode.insertBefore(this.fragment, refNode);
    };
    View.prototype.appendNodesTo = function (parent) {
        parent.appendChild(this.fragment);
    };
    View.prototype.removeNodes = function () {
        var fragment = this.fragment;
        var current = this.firstChild;
        var end = this.lastChild;
        var next;
        while (current) {
            next = current.nextSibling;
            fragment.appendChild(current);
            if (current === end) {
                break;
            }
            current = next;
        }
    };
    View.prototype.attached = function () {
        var controllers;
        var children;
        var i;
        var ii;
        if (this.isAttached) {
            return;
        }
        this.isAttached = true;
        if (this.controller !== null) {
            this.controller.attached();
        }
        controllers = this.controllers;
        for (i = 0, ii = controllers.length; i < ii; ++i) {
            controllers[i].attached();
        }
        children = this.children;
        for (i = 0, ii = children.length; i < ii; ++i) {
            children[i].attached();
        }
    };
    View.prototype.detached = function () {
        var controllers;
        var children;
        var i;
        var ii;
        if (this.isAttached) {
            this.isAttached = false;
            if (this.controller !== null) {
                this.controller.detached();
            }
            controllers = this.controllers;
            for (i = 0, ii = controllers.length; i < ii; ++i) {
                controllers[i].detached();
            }
            children = this.children;
            for (i = 0, ii = children.length; i < ii; ++i) {
                children[i].detached();
            }
        }
    };
    return View;
}());

var Animator = (function () {
    function Animator() {
    }
    Animator.prototype.enter = function (element) {
        return Promise.resolve(false);
    };
    Animator.prototype.leave = function (element) {
        return Promise.resolve(false);
    };
    Animator.prototype.removeClass = function (element, className) {
        element.classList.remove(className);
        return Promise.resolve(false);
    };
    Animator.prototype.addClass = function (element, className) {
        element.classList.add(className);
        return Promise.resolve(false);
    };
    Animator.prototype.animate = function (element, className) {
        return Promise.resolve(false);
    };
    Animator.prototype.runSequence = function (animations) {
        return Promise.resolve(false);
    };
    Animator.prototype.registerEffect = function (effectName, properties) { };
    Animator.prototype.unregisterEffect = function (effectName) { };
    return Animator;
}());

function getAnimatableElement(view) {
    if (view.animatableElement !== undefined) {
        return view.animatableElement;
    }
    var current = view.firstChild;
    while (current && current.nodeType !== 1) {
        current = current.nextSibling;
    }
    if (current && current.nodeType === 1) {
        return (view.animatableElement = current.classList.contains('au-animate') ? current : null);
    }
    return (view.animatableElement = null);
}
var ViewSlot = (function () {
    function ViewSlot(anchor, anchorIsContainer, animator) {
        if (animator === void 0) { animator = Animator.instance; }
        this.anchor = anchor;
        this.anchorIsContainer = anchorIsContainer;
        this.bindingContext = null;
        this.overrideContext = null;
        this.animator = animator;
        this.children = [];
        this.isBound = false;
        this.isAttached = false;
        this.contentSelectors = null;
        anchor.viewSlot = this;
        anchor.isContentProjectionSource = false;
    }
    ViewSlot.prototype.animateView = function (view, direction) {
        if (direction === void 0) { direction = 'enter'; }
        var animatableElement = getAnimatableElement(view);
        if (animatableElement !== null) {
            switch (direction) {
                case 'enter':
                    return this.animator.enter(animatableElement);
                case 'leave':
                    return this.animator.leave(animatableElement);
                default:
                    throw new Error('Invalid animation direction: ' + direction);
            }
        }
    };
    ViewSlot.prototype.transformChildNodesIntoView = function () {
        var parent = this.anchor;
        this.children.push({
            fragment: parent,
            firstChild: parent.firstChild,
            lastChild: parent.lastChild,
            returnToCache: function () { },
            removeNodes: function () {
                var last;
                while (last = parent.lastChild) {
                    parent.removeChild(last);
                }
            },
            created: function () { },
            bind: function () { },
            unbind: function () { },
            attached: function () { },
            detached: function () { }
        });
    };
    ViewSlot.prototype.bind = function (bindingContext, overrideContext) {
        var i;
        var ii;
        var children;
        if (this.isBound) {
            if (this.bindingContext === bindingContext) {
                return;
            }
            this.unbind();
        }
        this.isBound = true;
        this.bindingContext = bindingContext = bindingContext || this.bindingContext;
        this.overrideContext = overrideContext = overrideContext || this.overrideContext;
        children = this.children;
        for (i = 0, ii = children.length; i < ii; ++i) {
            children[i].bind(bindingContext, overrideContext, true);
        }
    };
    ViewSlot.prototype.unbind = function () {
        if (this.isBound) {
            var i = void 0;
            var ii = void 0;
            var children = this.children;
            this.isBound = false;
            this.bindingContext = null;
            this.overrideContext = null;
            for (i = 0, ii = children.length; i < ii; ++i) {
                children[i].unbind();
            }
        }
    };
    ViewSlot.prototype.add = function (view) {
        if (this.anchorIsContainer) {
            view.appendNodesTo(this.anchor);
        }
        else {
            view.insertNodesBefore(this.anchor);
        }
        this.children.push(view);
        if (this.isAttached) {
            view.attached();
            return this.animateView(view, 'enter');
        }
    };
    ViewSlot.prototype.insert = function (index, view) {
        var children = this.children;
        var length = children.length;
        if ((index === 0 && length === 0) || index >= length) {
            return this.add(view);
        }
        view.insertNodesBefore(children[index].firstChild);
        children.splice(index, 0, view);
        if (this.isAttached) {
            view.attached();
            return this.animateView(view, 'enter');
        }
    };
    ViewSlot.prototype.move = function (sourceIndex, targetIndex) {
        if (sourceIndex === targetIndex) {
            return;
        }
        var children = this.children;
        var view = children[sourceIndex];
        view.removeNodes();
        view.insertNodesBefore(children[targetIndex].firstChild);
        children.splice(sourceIndex, 1);
        children.splice(targetIndex, 0, view);
    };
    ViewSlot.prototype.remove = function (view, returnToCache, skipAnimation) {
        return this.removeAt(this.children.indexOf(view), returnToCache, skipAnimation);
    };
    ViewSlot.prototype.removeMany = function (viewsToRemove, returnToCache, skipAnimation) {
        var _this = this;
        var children = this.children;
        var ii = viewsToRemove.length;
        var i;
        var rmPromises = [];
        viewsToRemove.forEach(function (child) {
            if (skipAnimation) {
                child.removeNodes();
                return;
            }
            var animation = _this.animateView(child, 'leave');
            if (animation) {
                rmPromises.push(animation.then(function () { return child.removeNodes(); }));
            }
            else {
                child.removeNodes();
            }
        });
        var removeAction = function () {
            if (_this.isAttached) {
                for (i = 0; i < ii; ++i) {
                    viewsToRemove[i].detached();
                }
            }
            if (returnToCache) {
                for (i = 0; i < ii; ++i) {
                    viewsToRemove[i].returnToCache();
                }
            }
            for (i = 0; i < ii; ++i) {
                var index = children.indexOf(viewsToRemove[i]);
                if (index >= 0) {
                    children.splice(index, 1);
                }
            }
        };
        if (rmPromises.length > 0) {
            return Promise.all(rmPromises).then(function () { return removeAction(); });
        }
        return removeAction();
    };
    ViewSlot.prototype.removeAt = function (index, returnToCache, skipAnimation) {
        var _this = this;
        var view = this.children[index];
        var removeAction = function () {
            index = _this.children.indexOf(view);
            view.removeNodes();
            _this.children.splice(index, 1);
            if (_this.isAttached) {
                view.detached();
            }
            if (returnToCache) {
                view.returnToCache();
            }
            return view;
        };
        if (!skipAnimation) {
            var animation = this.animateView(view, 'leave');
            if (animation) {
                return animation.then(function () { return removeAction(); });
            }
        }
        return removeAction();
    };
    ViewSlot.prototype.removeAll = function (returnToCache, skipAnimation) {
        var _this = this;
        var children = this.children;
        var ii = children.length;
        var i;
        var rmPromises = [];
        children.forEach(function (child) {
            if (skipAnimation) {
                child.removeNodes();
                return;
            }
            var animation = _this.animateView(child, 'leave');
            if (animation) {
                rmPromises.push(animation.then(function () { return child.removeNodes(); }));
            }
            else {
                child.removeNodes();
            }
        });
        var removeAction = function () {
            if (_this.isAttached) {
                for (i = 0; i < ii; ++i) {
                    children[i].detached();
                }
            }
            if (returnToCache) {
                for (i = 0; i < ii; ++i) {
                    var child = children[i];
                    if (child) {
                        child.returnToCache();
                    }
                }
            }
            _this.children = [];
        };
        if (rmPromises.length > 0) {
            return Promise.all(rmPromises).then(function () { return removeAction(); });
        }
        return removeAction();
    };
    ViewSlot.prototype.attached = function () {
        var i;
        var ii;
        var children;
        var child;
        if (this.isAttached) {
            return;
        }
        this.isAttached = true;
        children = this.children;
        for (i = 0, ii = children.length; i < ii; ++i) {
            child = children[i];
            child.attached();
            this.animateView(child, 'enter');
        }
    };
    ViewSlot.prototype.detached = function () {
        var i;
        var ii;
        var children;
        if (this.isAttached) {
            this.isAttached = false;
            children = this.children;
            for (i = 0, ii = children.length; i < ii; ++i) {
                children[i].detached();
            }
        }
    };
    ViewSlot.prototype.projectTo = function (slots) {
        var _this = this;
        this.projectToSlots = slots;
        this.add = this._projectionAdd;
        this.insert = this._projectionInsert;
        this.move = this._projectionMove;
        this.remove = this._projectionRemove;
        this.removeAt = this._projectionRemoveAt;
        this.removeMany = this._projectionRemoveMany;
        this.removeAll = this._projectionRemoveAll;
        this.children.forEach(function (view) { return ShadowDOM.distributeView(view, slots, _this); });
    };
    ViewSlot.prototype._projectionAdd = function (view) {
        ShadowDOM.distributeView(view, this.projectToSlots, this);
        this.children.push(view);
        if (this.isAttached) {
            view.attached();
        }
    };
    ViewSlot.prototype._projectionInsert = function (index, view) {
        if ((index === 0 && !this.children.length) || index >= this.children.length) {
            this.add(view);
        }
        else {
            ShadowDOM.distributeView(view, this.projectToSlots, this, index);
            this.children.splice(index, 0, view);
            if (this.isAttached) {
                view.attached();
            }
        }
    };
    ViewSlot.prototype._projectionMove = function (sourceIndex, targetIndex) {
        if (sourceIndex === targetIndex) {
            return;
        }
        var children = this.children;
        var view = children[sourceIndex];
        ShadowDOM.undistributeView(view, this.projectToSlots, this);
        ShadowDOM.distributeView(view, this.projectToSlots, this, targetIndex);
        children.splice(sourceIndex, 1);
        children.splice(targetIndex, 0, view);
    };
    ViewSlot.prototype._projectionRemove = function (view, returnToCache) {
        ShadowDOM.undistributeView(view, this.projectToSlots, this);
        this.children.splice(this.children.indexOf(view), 1);
        if (this.isAttached) {
            view.detached();
        }
        if (returnToCache) {
            view.returnToCache();
        }
    };
    ViewSlot.prototype._projectionRemoveAt = function (index, returnToCache) {
        var view = this.children[index];
        ShadowDOM.undistributeView(view, this.projectToSlots, this);
        this.children.splice(index, 1);
        if (this.isAttached) {
            view.detached();
        }
        if (returnToCache) {
            view.returnToCache();
        }
    };
    ViewSlot.prototype._projectionRemoveMany = function (viewsToRemove, returnToCache) {
        var _this = this;
        viewsToRemove.forEach(function (view) { return _this.remove(view, returnToCache); });
    };
    ViewSlot.prototype._projectionRemoveAll = function (returnToCache) {
        ShadowDOM.undistributeAll(this.projectToSlots, this);
        var children = this.children;
        var ii = children.length;
        for (var i = 0; i < ii; ++i) {
            if (returnToCache) {
                children[i].returnToCache();
            }
            else if (this.isAttached) {
                children[i].detached();
            }
        }
        this.children = [];
    };
    return ViewSlot;
}());

var $resolver = aureliaDependencyInjection.resolver;
var ProviderResolver = (function () {
    function ProviderResolver() {
    }
    ProviderResolver.prototype.get = function (container, key) {
        var id = key.__providerId__;
        return id in container ? container[id] : (container[id] = container.invoke(key));
    };
    ProviderResolver = __decorate([
        $resolver
    ], ProviderResolver);
    return ProviderResolver;
}());
var providerResolverInstance = new ProviderResolver();
function elementContainerGet(key) {
    if (key === aureliaPal.DOM.Element) {
        return this.element;
    }
    if (key === BoundViewFactory) {
        if (this.boundViewFactory) {
            return this.boundViewFactory;
        }
        var factory = this.instruction.viewFactory;
        var partReplacements = this.partReplacements;
        if (partReplacements) {
            factory = partReplacements[factory.part] || factory;
        }
        this.boundViewFactory = new BoundViewFactory(this, factory, partReplacements);
        return this.boundViewFactory;
    }
    if (key === ViewSlot) {
        if (this.viewSlot === undefined) {
            this.viewSlot = new ViewSlot(this.element, this.instruction.anchorIsContainer);
            this.element.isContentProjectionSource = this.instruction.lifting;
            this.children.push(this.viewSlot);
        }
        return this.viewSlot;
    }
    if (key === ElementEvents) {
        return this.elementEvents || (this.elementEvents = new ElementEvents(this.element));
    }
    if (key === CompositionTransaction) {
        return this.compositionTransaction || (this.compositionTransaction = this.parent.get(key));
    }
    if (key === ViewResources) {
        return this.viewResources;
    }
    if (key === TargetInstruction) {
        return this.instruction;
    }
    return this.superGet(key);
}
function createElementContainer(parent, element, instruction, children, partReplacements, resources) {
    var container = parent.createChild();
    var providers;
    var i;
    container.element = element;
    container.instruction = instruction;
    container.children = children;
    container.viewResources = resources;
    container.partReplacements = partReplacements;
    providers = instruction.providers;
    i = providers.length;
    while (i--) {
        container._resolvers.set(providers[i], providerResolverInstance);
    }
    container.superGet = container.get;
    container.get = elementContainerGet;
    return container;
}
function hasAttribute(name) {
    return this._element.hasAttribute(name);
}
function getAttribute(name) {
    return this._element.getAttribute(name);
}
function setAttribute(name, value) {
    this._element.setAttribute(name, value);
}
function makeElementIntoAnchor(element, elementInstruction) {
    var anchor = aureliaPal.DOM.createComment('anchor');
    if (elementInstruction) {
        var firstChild = element.firstChild;
        if (firstChild && firstChild.tagName === 'AU-CONTENT') {
            anchor.contentElement = firstChild;
        }
        anchor._element = element;
        anchor.hasAttribute = hasAttribute;
        anchor.getAttribute = getAttribute;
        anchor.setAttribute = setAttribute;
    }
    aureliaPal.DOM.replaceNode(anchor, element);
    return anchor;
}
function applyInstructions(containers, element, instruction, controllers, bindings, children, shadowSlots, partReplacements, resources) {
    var behaviorInstructions = instruction.behaviorInstructions;
    var expressions = instruction.expressions;
    var elementContainer;
    var i;
    var ii;
    var current;
    var instance;
    if (instruction.contentExpression) {
        bindings.push(instruction.contentExpression.createBinding(element.nextSibling));
        element.nextSibling.auInterpolationTarget = true;
        element.parentNode.removeChild(element);
        return;
    }
    if (instruction.shadowSlot) {
        var commentAnchor = aureliaPal.DOM.createComment('slot');
        var slot = void 0;
        if (instruction.slotDestination) {
            slot = new PassThroughSlot(commentAnchor, instruction.slotName, instruction.slotDestination, instruction.slotFallbackFactory);
        }
        else {
            slot = new ShadowSlot(commentAnchor, instruction.slotName, instruction.slotFallbackFactory);
        }
        aureliaPal.DOM.replaceNode(commentAnchor, element);
        shadowSlots[instruction.slotName] = slot;
        controllers.push(slot);
        return;
    }
    if (instruction.letElement) {
        for (i = 0, ii = expressions.length; i < ii; ++i) {
            bindings.push(expressions[i].createBinding());
        }
        element.parentNode.removeChild(element);
        return;
    }
    if (behaviorInstructions.length) {
        if (!instruction.anchorIsContainer) {
            element = makeElementIntoAnchor(element, instruction.elementInstruction);
        }
        containers[instruction.injectorId] = elementContainer =
            createElementContainer(containers[instruction.parentInjectorId], element, instruction, children, partReplacements, resources);
        for (i = 0, ii = behaviorInstructions.length; i < ii; ++i) {
            current = behaviorInstructions[i];
            instance = current.type.create(elementContainer, current, element, bindings);
            controllers.push(instance);
        }
    }
    for (i = 0, ii = expressions.length; i < ii; ++i) {
        bindings.push(expressions[i].createBinding(element));
    }
}
function styleStringToObject(style, target) {
    var attributes = style.split(';');
    var firstIndexOfColon;
    var i;
    var current;
    var key;
    var value;
    target = target || {};
    for (i = 0; i < attributes.length; i++) {
        current = attributes[i];
        firstIndexOfColon = current.indexOf(':');
        key = current.substring(0, firstIndexOfColon).trim();
        value = current.substring(firstIndexOfColon + 1).trim();
        target[key] = value;
    }
    return target;
}
function styleObjectToString(obj) {
    var result = '';
    for (var key in obj) {
        result += key + ':' + obj[key] + ';';
    }
    return result;
}
function applySurrogateInstruction(container, element, instruction, controllers, bindings, children) {
    var behaviorInstructions = instruction.behaviorInstructions;
    var expressions = instruction.expressions;
    var providers = instruction.providers;
    var values = instruction.values;
    var i;
    var ii;
    var current;
    var instance;
    var currentAttributeValue;
    i = providers.length;
    while (i--) {
        container._resolvers.set(providers[i], providerResolverInstance);
    }
    for (var key in values) {
        currentAttributeValue = element.getAttribute(key);
        if (currentAttributeValue) {
            if (key === 'class') {
                element.setAttribute('class', currentAttributeValue + ' ' + values[key]);
            }
            else if (key === 'style') {
                var styleObject = styleStringToObject(values[key]);
                styleStringToObject(currentAttributeValue, styleObject);
                element.setAttribute('style', styleObjectToString(styleObject));
            }
        }
        else {
            element.setAttribute(key, values[key]);
        }
    }
    if (behaviorInstructions.length) {
        for (i = 0, ii = behaviorInstructions.length; i < ii; ++i) {
            current = behaviorInstructions[i];
            instance = current.type.create(container, current, element, bindings);
            if (instance.contentView) {
                children.push(instance.contentView);
            }
            controllers.push(instance);
        }
    }
    for (i = 0, ii = expressions.length; i < ii; ++i) {
        bindings.push(expressions[i].createBinding(element));
    }
}
var BoundViewFactory = (function () {
    function BoundViewFactory(parentContainer, viewFactory, partReplacements) {
        this.parentContainer = parentContainer;
        this.viewFactory = viewFactory;
        this.factoryCreateInstruction = { partReplacements: partReplacements };
    }
    BoundViewFactory.prototype.create = function () {
        var view = this.viewFactory.create(this.parentContainer.createChild(), this.factoryCreateInstruction);
        view._isUserControlled = true;
        return view;
    };
    Object.defineProperty(BoundViewFactory.prototype, "isCaching", {
        get: function () {
            return this.viewFactory.isCaching;
        },
        enumerable: false,
        configurable: true
    });
    BoundViewFactory.prototype.setCacheSize = function (size, doNotOverrideIfAlreadySet) {
        this.viewFactory.setCacheSize(size, doNotOverrideIfAlreadySet);
    };
    BoundViewFactory.prototype.getCachedView = function () {
        return this.viewFactory.getCachedView();
    };
    BoundViewFactory.prototype.returnViewToCache = function (view) {
        this.viewFactory.returnViewToCache(view);
    };
    return BoundViewFactory;
}());
var ViewFactory = (function () {
    function ViewFactory(template, instructions, resources) {
        this.isCaching = false;
        this.template = template;
        this.instructions = instructions;
        this.resources = resources;
        this.cacheSize = -1;
        this.cache = null;
    }
    ViewFactory.prototype.setCacheSize = function (size, doNotOverrideIfAlreadySet) {
        if (size) {
            if (size === '*') {
                size = Number.MAX_VALUE;
            }
            else if (typeof size === 'string') {
                size = parseInt(size, 10);
            }
        }
        if (this.cacheSize === -1 || !doNotOverrideIfAlreadySet) {
            this.cacheSize = Number(size);
        }
        if (this.cacheSize > 0) {
            this.cache = [];
        }
        else {
            this.cache = null;
        }
        this.isCaching = this.cacheSize > 0;
    };
    ViewFactory.prototype.getCachedView = function () {
        return this.cache !== null ? (this.cache.pop() || null) : null;
    };
    ViewFactory.prototype.returnViewToCache = function (view) {
        if (view.isAttached) {
            view.detached();
        }
        if (view.isBound) {
            view.unbind();
        }
        if (this.cache !== null && this.cache.length < this.cacheSize) {
            view.fromCache = true;
            this.cache.push(view);
        }
    };
    ViewFactory.prototype.create = function (container, createInstruction, element) {
        createInstruction = createInstruction || BehaviorInstruction.normal;
        var cachedView = this.getCachedView();
        if (cachedView !== null) {
            return cachedView;
        }
        var fragment = createInstruction.enhance ? this.template : this.template.cloneNode(true);
        var instructables = fragment.querySelectorAll('.au-target');
        var instructions = this.instructions;
        var resources = this.resources;
        var controllers = [];
        var bindings = [];
        var children = [];
        var shadowSlots = Object.create(null);
        var containers = { root: container };
        var partReplacements = createInstruction.partReplacements;
        var i;
        var ii;
        var view;
        var instructable;
        var instruction;
        this.resources._invokeHook('beforeCreate', this, container, fragment, createInstruction);
        if (element && this.surrogateInstruction !== null) {
            applySurrogateInstruction(container, element, this.surrogateInstruction, controllers, bindings, children);
        }
        if (createInstruction.enhance && fragment.hasAttribute('au-target-id')) {
            instructable = fragment;
            instruction = instructions[instructable.getAttribute('au-target-id')];
            applyInstructions(containers, instructable, instruction, controllers, bindings, children, shadowSlots, partReplacements, resources);
        }
        for (i = 0, ii = instructables.length; i < ii; ++i) {
            instructable = instructables[i];
            instruction = instructions[instructable.getAttribute('au-target-id')];
            applyInstructions(containers, instructable, instruction, controllers, bindings, children, shadowSlots, partReplacements, resources);
        }
        view = new View(container, this, fragment, controllers, bindings, children, shadowSlots);
        if (!createInstruction.initiatedByBehavior) {
            view.created();
        }
        this.resources._invokeHook('afterCreate', view);
        return view;
    };
    return ViewFactory;
}());

var nextInjectorId = 0;
function getNextInjectorId() {
    return ++nextInjectorId;
}
var lastAUTargetID = 0;
function getNextAUTargetID() {
    return (++lastAUTargetID).toString();
}
function makeIntoInstructionTarget(element) {
    var value = element.getAttribute('class');
    var auTargetID = getNextAUTargetID();
    element.setAttribute('class', (value ? value + ' au-target' : 'au-target'));
    element.setAttribute('au-target-id', auTargetID);
    return auTargetID;
}
function makeShadowSlot(compiler, resources, node, instructions, parentInjectorId) {
    var auShadowSlot = aureliaPal.DOM.createElement('au-shadow-slot');
    aureliaPal.DOM.replaceNode(auShadowSlot, node);
    var auTargetID = makeIntoInstructionTarget(auShadowSlot);
    var instruction = TargetInstruction.shadowSlot(parentInjectorId);
    instruction.slotName = node.getAttribute('name') || ShadowDOM.defaultSlotKey;
    instruction.slotDestination = node.getAttribute('slot');
    if (node.innerHTML.trim()) {
        var fragment = aureliaPal.DOM.createDocumentFragment();
        var child = void 0;
        while (child = node.firstChild) {
            fragment.appendChild(child);
        }
        instruction.slotFallbackFactory = compiler.compile(fragment, resources);
    }
    instructions[auTargetID] = instruction;
    return auShadowSlot;
}
var defaultLetHandler = BindingLanguage.prototype.createLetExpressions;
var ViewCompiler = (function () {
    function ViewCompiler(bindingLanguage, resources) {
        this.bindingLanguage = bindingLanguage;
        this.resources = resources;
    }
    ViewCompiler.inject = function () {
        return [BindingLanguage, ViewResources];
    };
    ViewCompiler.prototype.compile = function (source, resources, compileInstruction) {
        resources = resources || this.resources;
        compileInstruction = compileInstruction || ViewCompileInstruction.normal;
        source = typeof source === 'string' ? aureliaPal.DOM.createTemplateFromMarkup(source) : source;
        var content;
        var part;
        var cacheSize;
        if (source.content) {
            part = source.getAttribute('part');
            cacheSize = source.getAttribute('view-cache');
            content = aureliaPal.DOM.adoptNode(source.content);
        }
        else {
            content = source;
        }
        compileInstruction.targetShadowDOM = compileInstruction.targetShadowDOM && aureliaPal.FEATURE.shadowDOM;
        resources._invokeHook('beforeCompile', content, resources, compileInstruction);
        var instructions = {};
        this._compileNode(content, resources, instructions, source, 'root', !compileInstruction.targetShadowDOM);
        var firstChild = content.firstChild;
        if (firstChild && firstChild.nodeType === 1) {
            var targetId = firstChild.getAttribute('au-target-id');
            if (targetId) {
                var ins = instructions[targetId];
                if (ins.shadowSlot || ins.lifting || (ins.elementInstruction && !ins.elementInstruction.anchorIsContainer)) {
                    content.insertBefore(aureliaPal.DOM.createComment('view'), firstChild);
                }
            }
        }
        var factory = new ViewFactory(content, instructions, resources);
        factory.surrogateInstruction = compileInstruction.compileSurrogate ? this._compileSurrogate(source, resources) : null;
        factory.part = part;
        if (cacheSize) {
            factory.setCacheSize(cacheSize);
        }
        resources._invokeHook('afterCompile', factory);
        return factory;
    };
    ViewCompiler.prototype._compileNode = function (node, resources, instructions, parentNode, parentInjectorId, targetLightDOM) {
        switch (node.nodeType) {
            case 1:
                return this._compileElement(node, resources, instructions, parentNode, parentInjectorId, targetLightDOM);
            case 3:
                var expression = resources.getBindingLanguage(this.bindingLanguage).inspectTextContent(resources, node.wholeText);
                if (expression) {
                    var marker = aureliaPal.DOM.createElement('au-marker');
                    var auTargetID = makeIntoInstructionTarget(marker);
                    (node.parentNode || parentNode).insertBefore(marker, node);
                    node.textContent = ' ';
                    instructions[auTargetID] = TargetInstruction.contentExpression(expression);
                    while (node.nextSibling && node.nextSibling.nodeType === 3) {
                        (node.parentNode || parentNode).removeChild(node.nextSibling);
                    }
                }
                else {
                    while (node.nextSibling && node.nextSibling.nodeType === 3) {
                        node = node.nextSibling;
                    }
                }
                return node.nextSibling;
            case 11:
                var currentChild = node.firstChild;
                while (currentChild) {
                    currentChild = this._compileNode(currentChild, resources, instructions, node, parentInjectorId, targetLightDOM);
                }
                break;
        }
        return node.nextSibling;
    };
    ViewCompiler.prototype._compileSurrogate = function (node, resources) {
        var tagName = node.tagName.toLowerCase();
        var attributes = node.attributes;
        var bindingLanguage = resources.getBindingLanguage(this.bindingLanguage);
        var knownAttribute;
        var property;
        var instruction;
        var i;
        var ii;
        var attr;
        var attrName;
        var attrValue;
        var info;
        var type;
        var expressions = [];
        var expression;
        var behaviorInstructions = [];
        var values = {};
        var hasValues = false;
        var providers = [];
        for (i = 0, ii = attributes.length; i < ii; ++i) {
            attr = attributes[i];
            attrName = attr.name;
            attrValue = attr.value;
            info = bindingLanguage.inspectAttribute(resources, tagName, attrName, attrValue);
            type = resources.getAttribute(info.attrName);
            if (type) {
                knownAttribute = resources.mapAttribute(info.attrName);
                if (knownAttribute) {
                    property = type.attributes[knownAttribute];
                    if (property) {
                        info.defaultBindingMode = property.defaultBindingMode;
                        if (!info.command && !info.expression) {
                            info.command = property.hasOptions ? 'options' : null;
                        }
                        if (info.command && (info.command !== 'options') && type.primaryProperty) {
                            var primaryProperty = type.primaryProperty;
                            attrName = info.attrName = primaryProperty.attribute;
                            info.defaultBindingMode = primaryProperty.defaultBindingMode;
                        }
                    }
                }
            }
            instruction = bindingLanguage.createAttributeInstruction(resources, node, info, undefined, type);
            if (instruction) {
                if (instruction.alteredAttr) {
                    type = resources.getAttribute(instruction.attrName);
                }
                if (instruction.discrete) {
                    expressions.push(instruction);
                }
                else {
                    if (type) {
                        instruction.type = type;
                        this._configureProperties(instruction, resources);
                        if (type.liftsContent) {
                            throw new Error('You cannot place a template controller on a surrogate element.');
                        }
                        else {
                            behaviorInstructions.push(instruction);
                        }
                    }
                    else {
                        expressions.push(instruction.attributes[instruction.attrName]);
                    }
                }
            }
            else {
                if (type) {
                    instruction = BehaviorInstruction.attribute(attrName, type);
                    instruction.attributes[resources.mapAttribute(attrName)] = attrValue;
                    if (type.liftsContent) {
                        throw new Error('You cannot place a template controller on a surrogate element.');
                    }
                    else {
                        behaviorInstructions.push(instruction);
                    }
                }
                else if (attrName !== 'id' && attrName !== 'part' && attrName !== 'replace-part') {
                    hasValues = true;
                    values[attrName] = attrValue;
                }
            }
        }
        if (expressions.length || behaviorInstructions.length || hasValues) {
            for (i = 0, ii = behaviorInstructions.length; i < ii; ++i) {
                instruction = behaviorInstructions[i];
                instruction.type.compile(this, resources, node, instruction);
                providers.push(instruction.type.target);
            }
            for (i = 0, ii = expressions.length; i < ii; ++i) {
                expression = expressions[i];
                if (expression.attrToRemove !== undefined) {
                    node.removeAttribute(expression.attrToRemove);
                }
            }
            return TargetInstruction.surrogate(providers, behaviorInstructions, expressions, values);
        }
        return null;
    };
    ViewCompiler.prototype._compileElement = function (node, resources, instructions, parentNode, parentInjectorId, targetLightDOM) {
        var tagName = node.tagName.toLowerCase();
        var attributes = node.attributes;
        var expressions = [];
        var expression;
        var behaviorInstructions = [];
        var providers = [];
        var bindingLanguage = resources.getBindingLanguage(this.bindingLanguage);
        var liftingInstruction;
        var viewFactory;
        var type;
        var elementInstruction;
        var elementProperty;
        var i;
        var ii;
        var attr;
        var attrName;
        var attrValue;
        var originalAttrName;
        var instruction;
        var info;
        var property;
        var knownAttribute;
        var auTargetID;
        var injectorId;
        if (tagName === 'slot') {
            if (targetLightDOM) {
                node = makeShadowSlot(this, resources, node, instructions, parentInjectorId);
            }
            return node.nextSibling;
        }
        else if (tagName === 'template') {
            if (!('content' in node)) {
                throw new Error('You cannot place a template element within ' + node.namespaceURI + ' namespace');
            }
            viewFactory = this.compile(node, resources);
            viewFactory.part = node.getAttribute('part');
        }
        else {
            type = resources.getElement(node.getAttribute('as-element') || tagName);
            if (tagName === 'let' && !type && bindingLanguage.createLetExpressions !== defaultLetHandler) {
                expressions = bindingLanguage.createLetExpressions(resources, node);
                auTargetID = makeIntoInstructionTarget(node);
                instructions[auTargetID] = TargetInstruction.letElement(expressions);
                return node.nextSibling;
            }
            if (type) {
                elementInstruction = BehaviorInstruction.element(node, type);
                type.processAttributes(this, resources, node, attributes, elementInstruction);
                behaviorInstructions.push(elementInstruction);
            }
        }
        for (i = 0, ii = attributes.length; i < ii; ++i) {
            attr = attributes[i];
            originalAttrName = attrName = attr.name;
            attrValue = attr.value;
            info = bindingLanguage.inspectAttribute(resources, tagName, attrName, attrValue);
            if (targetLightDOM && info.attrName === 'slot') {
                info.attrName = attrName = 'au-slot';
            }
            type = resources.getAttribute(info.attrName);
            elementProperty = null;
            if (type) {
                knownAttribute = resources.mapAttribute(info.attrName);
                if (knownAttribute) {
                    property = type.attributes[knownAttribute];
                    if (property) {
                        info.defaultBindingMode = property.defaultBindingMode;
                        if (!info.command && !info.expression) {
                            info.command = property.hasOptions ? 'options' : null;
                        }
                        if (info.command && (info.command !== 'options') && type.primaryProperty) {
                            var primaryProperty = type.primaryProperty;
                            attrName = info.attrName = primaryProperty.attribute;
                            info.defaultBindingMode = primaryProperty.defaultBindingMode;
                        }
                    }
                }
            }
            else if (elementInstruction) {
                elementProperty = elementInstruction.type.attributes[info.attrName];
                if (elementProperty) {
                    info.defaultBindingMode = elementProperty.defaultBindingMode;
                }
            }
            if (elementProperty) {
                instruction = bindingLanguage.createAttributeInstruction(resources, node, info, elementInstruction);
            }
            else {
                instruction = bindingLanguage.createAttributeInstruction(resources, node, info, undefined, type);
            }
            if (instruction) {
                if (instruction.alteredAttr) {
                    type = resources.getAttribute(instruction.attrName);
                }
                if (instruction.discrete) {
                    expressions.push(instruction);
                }
                else {
                    if (type) {
                        instruction.type = type;
                        this._configureProperties(instruction, resources);
                        if (type.liftsContent) {
                            instruction.originalAttrName = originalAttrName;
                            liftingInstruction = instruction;
                            break;
                        }
                        else {
                            behaviorInstructions.push(instruction);
                        }
                    }
                    else if (elementProperty) {
                        elementInstruction.attributes[info.attrName].targetProperty = elementProperty.name;
                    }
                    else {
                        expressions.push(instruction.attributes[instruction.attrName]);
                    }
                }
            }
            else {
                if (type) {
                    instruction = BehaviorInstruction.attribute(attrName, type);
                    instruction.attributes[resources.mapAttribute(attrName)] = attrValue;
                    if (type.liftsContent) {
                        instruction.originalAttrName = originalAttrName;
                        liftingInstruction = instruction;
                        break;
                    }
                    else {
                        behaviorInstructions.push(instruction);
                    }
                }
                else if (elementProperty) {
                    elementInstruction.attributes[attrName] = attrValue;
                }
            }
        }
        if (liftingInstruction) {
            liftingInstruction.viewFactory = viewFactory;
            node = liftingInstruction.type.compile(this, resources, node, liftingInstruction, parentNode);
            auTargetID = makeIntoInstructionTarget(node);
            instructions[auTargetID] = TargetInstruction.lifting(parentInjectorId, liftingInstruction);
        }
        else {
            var skipContentProcessing = false;
            if (expressions.length || behaviorInstructions.length) {
                injectorId = behaviorInstructions.length ? getNextInjectorId() : false;
                for (i = 0, ii = behaviorInstructions.length; i < ii; ++i) {
                    instruction = behaviorInstructions[i];
                    instruction.type.compile(this, resources, node, instruction, parentNode);
                    providers.push(instruction.type.target);
                    skipContentProcessing = skipContentProcessing || instruction.skipContentProcessing;
                }
                for (i = 0, ii = expressions.length; i < ii; ++i) {
                    expression = expressions[i];
                    if (expression.attrToRemove !== undefined) {
                        node.removeAttribute(expression.attrToRemove);
                    }
                }
                auTargetID = makeIntoInstructionTarget(node);
                instructions[auTargetID] = TargetInstruction.normal(injectorId, parentInjectorId, providers, behaviorInstructions, expressions, elementInstruction);
            }
            if (skipContentProcessing) {
                return node.nextSibling;
            }
            var currentChild = node.firstChild;
            while (currentChild) {
                currentChild = this._compileNode(currentChild, resources, instructions, node, injectorId || parentInjectorId, targetLightDOM);
            }
        }
        return node.nextSibling;
    };
    ViewCompiler.prototype._configureProperties = function (instruction, resources) {
        var type = instruction.type;
        var attrName = instruction.attrName;
        var attributes = instruction.attributes;
        var property;
        var key;
        var value;
        var knownAttribute = resources.mapAttribute(attrName);
        if (knownAttribute && attrName in attributes && knownAttribute !== attrName) {
            attributes[knownAttribute] = attributes[attrName];
            delete attributes[attrName];
        }
        for (key in attributes) {
            value = attributes[key];
            if (value !== null && typeof value === 'object') {
                property = type.attributes[key];
                if (property !== undefined) {
                    value.targetProperty = property.name;
                }
                else {
                    value.targetProperty = key;
                }
            }
        }
    };
    return ViewCompiler;
}());

var ViewEngineHooksResource = (function () {
    function ViewEngineHooksResource() {
    }
    ViewEngineHooksResource.prototype.initialize = function (container, target) {
        this.instance = container.get(target);
    };
    ViewEngineHooksResource.prototype.register = function (registry, name) {
        registry.registerViewEngineHooks(this.instance);
    };
    ViewEngineHooksResource.prototype.load = function (container, target) { };
    ViewEngineHooksResource.convention = function (name) {
        if (name.endsWith('ViewEngineHooks')) {
            return new ViewEngineHooksResource();
        }
    };
    return ViewEngineHooksResource;
}());
function viewEngineHooks(target) {
    var deco = function (t) {
        aureliaMetadata.metadata.define(aureliaMetadata.metadata.resource, new ViewEngineHooksResource(), t);
    };
    return target ? deco(target) : deco;
}

var ResourceModule = (function () {
    function ResourceModule(moduleId) {
        this.id = moduleId;
        this.moduleInstance = null;
        this.mainResource = null;
        this.resources = null;
        this.viewStrategy = null;
        this.isInitialized = false;
        this.onLoaded = null;
        this.loadContext = null;
    }
    ResourceModule.prototype.initialize = function (container) {
        var current = this.mainResource;
        var resources = this.resources;
        var vs = this.viewStrategy;
        if (this.isInitialized) {
            return;
        }
        this.isInitialized = true;
        if (current !== undefined) {
            current.metadata.viewStrategy = vs;
            current.initialize(container);
        }
        for (var i = 0, ii = resources.length; i < ii; ++i) {
            current = resources[i];
            current.metadata.viewStrategy = vs;
            current.initialize(container);
        }
    };
    ResourceModule.prototype.register = function (registry, name) {
        var main = this.mainResource;
        var resources = this.resources;
        if (main !== undefined) {
            main.register(registry, name);
            name = null;
        }
        for (var i = 0, ii = resources.length; i < ii; ++i) {
            resources[i].register(registry, name);
            name = null;
        }
    };
    ResourceModule.prototype.load = function (container, loadContext) {
        if (this.onLoaded !== null) {
            return this.loadContext === loadContext ? Promise.resolve() : this.onLoaded;
        }
        var main = this.mainResource;
        var resources = this.resources;
        var loads;
        if (main !== undefined) {
            loads = new Array(resources.length + 1);
            loads[0] = main.load(container, loadContext);
            for (var i = 0, ii = resources.length; i < ii; ++i) {
                loads[i + 1] = resources[i].load(container, loadContext);
            }
        }
        else {
            loads = new Array(resources.length);
            for (var i = 0, ii = resources.length; i < ii; ++i) {
                loads[i] = resources[i].load(container, loadContext);
            }
        }
        this.loadContext = loadContext;
        this.onLoaded = Promise.all(loads);
        return this.onLoaded;
    };
    return ResourceModule;
}());
var ResourceDescription = (function () {
    function ResourceDescription(key, exportedValue, resourceTypeMeta) {
        if (!resourceTypeMeta) {
            resourceTypeMeta = aureliaMetadata.metadata.get(aureliaMetadata.metadata.resource, exportedValue);
            if (!resourceTypeMeta) {
                resourceTypeMeta = new HtmlBehaviorResource();
                resourceTypeMeta.elementName = _hyphenate(key);
                aureliaMetadata.metadata.define(aureliaMetadata.metadata.resource, resourceTypeMeta, exportedValue);
            }
        }
        if (resourceTypeMeta instanceof HtmlBehaviorResource) {
            if (resourceTypeMeta.elementName === undefined) {
                resourceTypeMeta.elementName = _hyphenate(key);
            }
            else if (resourceTypeMeta.attributeName === undefined) {
                resourceTypeMeta.attributeName = _hyphenate(key);
            }
            else if (resourceTypeMeta.attributeName === null && resourceTypeMeta.elementName === null) {
                HtmlBehaviorResource.convention(key, resourceTypeMeta);
            }
        }
        else if (!resourceTypeMeta.name) {
            resourceTypeMeta.name = _hyphenate(key);
        }
        this.metadata = resourceTypeMeta;
        this.value = exportedValue;
    }
    ResourceDescription.prototype.initialize = function (container) {
        this.metadata.initialize(container, this.value);
    };
    ResourceDescription.prototype.register = function (registry, name) {
        this.metadata.register(registry, name);
    };
    ResourceDescription.prototype.load = function (container, loadContext) {
        return this.metadata.load(container, this.value, loadContext);
    };
    return ResourceDescription;
}());
var ModuleAnalyzer = (function () {
    function ModuleAnalyzer() {
        this.cache = Object.create(null);
    }
    ModuleAnalyzer.prototype.getAnalysis = function (moduleId) {
        return this.cache[moduleId];
    };
    ModuleAnalyzer.prototype.analyze = function (moduleId, moduleInstance, mainResourceKey) {
        var mainResource;
        var fallbackValue;
        var fallbackKey;
        var resourceTypeMeta;
        var key;
        var exportedValue;
        var resources = [];
        var conventional;
        var vs;
        var resourceModule;
        resourceModule = this.cache[moduleId];
        if (resourceModule) {
            return resourceModule;
        }
        resourceModule = new ResourceModule(moduleId);
        this.cache[moduleId] = resourceModule;
        if (typeof moduleInstance === 'function') {
            moduleInstance = { 'default': moduleInstance };
        }
        if (mainResourceKey) {
            mainResource = new ResourceDescription(mainResourceKey, moduleInstance[mainResourceKey]);
        }
        for (key in moduleInstance) {
            exportedValue = moduleInstance[key];
            if (key === mainResourceKey || typeof exportedValue !== 'function') {
                continue;
            }
            resourceTypeMeta = aureliaMetadata.metadata.get(aureliaMetadata.metadata.resource, exportedValue);
            if (resourceTypeMeta) {
                if (resourceTypeMeta instanceof HtmlBehaviorResource) {
                    ViewResources.convention(exportedValue, resourceTypeMeta);
                    if (resourceTypeMeta.attributeName === null && resourceTypeMeta.elementName === null) {
                        HtmlBehaviorResource.convention(key, resourceTypeMeta);
                    }
                    if (resourceTypeMeta.attributeName === null && resourceTypeMeta.elementName === null) {
                        resourceTypeMeta.elementName = _hyphenate(key);
                    }
                }
                if (!mainResource && resourceTypeMeta instanceof HtmlBehaviorResource && resourceTypeMeta.elementName !== null) {
                    mainResource = new ResourceDescription(key, exportedValue, resourceTypeMeta);
                }
                else {
                    resources.push(new ResourceDescription(key, exportedValue, resourceTypeMeta));
                }
            }
            else if (viewStrategy.decorates(exportedValue)) {
                vs = exportedValue;
            }
            else if (exportedValue instanceof aureliaLoader.TemplateRegistryEntry) {
                vs = new TemplateRegistryViewStrategy(moduleId, exportedValue);
            }
            else {
                if (conventional = ViewResources.convention(exportedValue)) {
                    if (conventional.elementName !== null && !mainResource) {
                        mainResource = new ResourceDescription(key, exportedValue, conventional);
                    }
                    else {
                        resources.push(new ResourceDescription(key, exportedValue, conventional));
                    }
                    aureliaMetadata.metadata.define(aureliaMetadata.metadata.resource, conventional, exportedValue);
                }
                else if (conventional = HtmlBehaviorResource.convention(key)) {
                    if (conventional.elementName !== null && !mainResource) {
                        mainResource = new ResourceDescription(key, exportedValue, conventional);
                    }
                    else {
                        resources.push(new ResourceDescription(key, exportedValue, conventional));
                    }
                    aureliaMetadata.metadata.define(aureliaMetadata.metadata.resource, conventional, exportedValue);
                }
                else if (conventional = aureliaBinding.ValueConverterResource.convention(key)
                    || aureliaBinding.BindingBehaviorResource.convention(key)
                    || ViewEngineHooksResource.convention(key)) {
                    resources.push(new ResourceDescription(key, exportedValue, conventional));
                    aureliaMetadata.metadata.define(aureliaMetadata.metadata.resource, conventional, exportedValue);
                }
                else if (!fallbackValue) {
                    fallbackValue = exportedValue;
                    fallbackKey = key;
                }
            }
        }
        if (!mainResource && fallbackValue) {
            mainResource = new ResourceDescription(fallbackKey, fallbackValue);
        }
        resourceModule.moduleInstance = moduleInstance;
        resourceModule.mainResource = mainResource;
        resourceModule.resources = resources;
        resourceModule.viewStrategy = vs;
        return resourceModule;
    };
    return ModuleAnalyzer;
}());

var logger = LogManager__namespace.getLogger('templating');
function ensureRegistryEntry(loader, urlOrRegistryEntry) {
    if (urlOrRegistryEntry instanceof aureliaLoader.TemplateRegistryEntry) {
        return Promise.resolve(urlOrRegistryEntry);
    }
    return loader.loadTemplate(urlOrRegistryEntry);
}
var ProxyViewFactory = (function () {
    function ProxyViewFactory(promise) {
        var _this = this;
        promise.then(function (x) { return _this.viewFactory = x; });
    }
    ProxyViewFactory.prototype.create = function (container, bindingContext, createInstruction, element) {
        return this.viewFactory.create(container, bindingContext, createInstruction, element);
    };
    Object.defineProperty(ProxyViewFactory.prototype, "isCaching", {
        get: function () {
            return this.viewFactory.isCaching;
        },
        enumerable: false,
        configurable: true
    });
    ProxyViewFactory.prototype.setCacheSize = function (size, doNotOverrideIfAlreadySet) {
        this.viewFactory.setCacheSize(size, doNotOverrideIfAlreadySet);
    };
    ProxyViewFactory.prototype.getCachedView = function () {
        return this.viewFactory.getCachedView();
    };
    ProxyViewFactory.prototype.returnViewToCache = function (view) {
        this.viewFactory.returnViewToCache(view);
    };
    return ProxyViewFactory;
}());
var auSlotBehavior = null;
var ViewEngine = (function () {
    function ViewEngine(loader, container, viewCompiler, moduleAnalyzer, appResources) {
        this.loader = loader;
        this.container = container;
        this.viewCompiler = viewCompiler;
        this.moduleAnalyzer = moduleAnalyzer;
        this.appResources = appResources;
        this._pluginMap = {};
        if (auSlotBehavior === null) {
            auSlotBehavior = new HtmlBehaviorResource();
            auSlotBehavior.attributeName = 'au-slot';
            aureliaMetadata.metadata.define(aureliaMetadata.metadata.resource, auSlotBehavior, SlotCustomAttribute);
        }
        auSlotBehavior.initialize(container, SlotCustomAttribute);
        auSlotBehavior.register(appResources);
    }
    ViewEngine.inject = function () {
        return [aureliaLoader.Loader, aureliaDependencyInjection.Container, ViewCompiler, ModuleAnalyzer, ViewResources];
    };
    ViewEngine.prototype.addResourcePlugin = function (extension, implementation) {
        var name = extension.replace('.', '') + '-resource-plugin';
        this._pluginMap[extension] = name;
        this.loader.addPlugin(name, implementation);
    };
    ViewEngine.prototype.loadViewFactory = function (urlOrRegistryEntry, compileInstruction, loadContext, target) {
        var _this = this;
        loadContext = loadContext || new ResourceLoadContext();
        return ensureRegistryEntry(this.loader, urlOrRegistryEntry).then(function (registryEntry) {
            var url = registryEntry.address;
            if (registryEntry.onReady) {
                if (!loadContext.hasDependency(url)) {
                    loadContext.addDependency(url);
                    return registryEntry.onReady;
                }
                if (registryEntry.template === null) {
                    return registryEntry.onReady;
                }
                return Promise.resolve(new ProxyViewFactory(registryEntry.onReady));
            }
            loadContext.addDependency(url);
            registryEntry.onReady = _this.loadTemplateResources(registryEntry, compileInstruction, loadContext, target).then(function (resources) {
                registryEntry.resources = resources;
                if (registryEntry.template === null) {
                    return registryEntry.factory = null;
                }
                var viewFactory = _this.viewCompiler.compile(registryEntry.template, resources, compileInstruction);
                return registryEntry.factory = viewFactory;
            });
            return registryEntry.onReady;
        });
    };
    ViewEngine.prototype.loadTemplateResources = function (registryEntry, compileInstruction, loadContext, target) {
        var resources = new ViewResources(this.appResources, registryEntry.address);
        var dependencies = registryEntry.dependencies;
        var importIds;
        var names;
        compileInstruction = compileInstruction || ViewCompileInstruction.normal;
        if (dependencies.length === 0 && !compileInstruction.associatedModuleId) {
            return Promise.resolve(resources);
        }
        importIds = dependencies.map(function (x) { return x.src; });
        names = dependencies.map(function (x) { return x.name; });
        logger.debug("importing resources for ".concat(registryEntry.address), importIds);
        if (target) {
            var viewModelRequires = aureliaMetadata.metadata.get(ViewEngine.viewModelRequireMetadataKey, target);
            if (viewModelRequires) {
                var templateImportCount = importIds.length;
                for (var i = 0, ii = viewModelRequires.length; i < ii; ++i) {
                    var req = viewModelRequires[i];
                    var importId = typeof req === 'function'
                        ? aureliaMetadata.Origin.get(req).moduleId
                        : aureliaPath.relativeToFile(req.src || req, registryEntry.address);
                    if (importIds.indexOf(importId) === -1) {
                        importIds.push(importId);
                        names.push(req.as);
                    }
                }
                logger.debug("importing ViewModel resources for ".concat(compileInstruction.associatedModuleId), importIds.slice(templateImportCount));
            }
        }
        return this.importViewResources(importIds, names, resources, compileInstruction, loadContext);
    };
    ViewEngine.prototype.importViewModelResource = function (moduleImport, moduleMember) {
        var _this = this;
        return this.loader.loadModule(moduleImport).then(function (viewModelModule) {
            var normalizedId = aureliaMetadata.Origin.get(viewModelModule).moduleId;
            var resourceModule = _this.moduleAnalyzer.analyze(normalizedId, viewModelModule, moduleMember);
            if (!resourceModule.mainResource) {
                throw new Error("No view model found in module \"".concat(moduleImport, "\"."));
            }
            resourceModule.initialize(_this.container);
            return resourceModule.mainResource;
        });
    };
    ViewEngine.prototype.importViewResources = function (moduleIds, names, resources, compileInstruction, loadContext) {
        var _this = this;
        loadContext = loadContext || new ResourceLoadContext();
        compileInstruction = compileInstruction || ViewCompileInstruction.normal;
        moduleIds = moduleIds.map(function (x) { return _this._applyLoaderPlugin(x); });
        return this.loader.loadAllModules(moduleIds).then(function (imports) {
            var i;
            var ii;
            var analysis;
            var normalizedId;
            var current;
            var associatedModule;
            var container = _this.container;
            var moduleAnalyzer = _this.moduleAnalyzer;
            var allAnalysis = new Array(imports.length);
            for (i = 0, ii = imports.length; i < ii; ++i) {
                current = imports[i];
                normalizedId = aureliaMetadata.Origin.get(current).moduleId;
                analysis = moduleAnalyzer.analyze(normalizedId, current);
                analysis.initialize(container);
                analysis.register(resources, names[i]);
                allAnalysis[i] = analysis;
            }
            if (compileInstruction.associatedModuleId) {
                associatedModule = moduleAnalyzer.getAnalysis(compileInstruction.associatedModuleId);
                if (associatedModule) {
                    associatedModule.register(resources);
                }
            }
            for (i = 0, ii = allAnalysis.length; i < ii; ++i) {
                allAnalysis[i] = allAnalysis[i].load(container, loadContext);
            }
            return Promise.all(allAnalysis).then(function () { return resources; });
        });
    };
    ViewEngine.prototype._applyLoaderPlugin = function (id) {
        var index = id.lastIndexOf('.');
        if (index !== -1) {
            var ext = id.substring(index);
            var pluginName = this._pluginMap[ext];
            if (pluginName === undefined) {
                return id;
            }
            return this.loader.applyPluginToUrl(id, pluginName);
        }
        return id;
    };
    ViewEngine.viewModelRequireMetadataKey = 'aurelia:view-model-require';
    return ViewEngine;
}());

var Controller = (function () {
    function Controller(behavior, instruction, viewModel, container) {
        this.behavior = behavior;
        this.instruction = instruction;
        this.viewModel = viewModel;
        this.isAttached = false;
        this.view = null;
        this.isBound = false;
        this.scope = null;
        this.container = container;
        this.elementEvents = container.elementEvents || null;
        var observerLookup = behavior.observerLocator.getOrCreateObserversLookup(viewModel);
        var handlesBind = behavior.handlesBind;
        var attributes = instruction.attributes;
        var boundProperties = this.boundProperties = [];
        var properties = behavior.properties;
        var i;
        var ii;
        behavior._ensurePropertiesDefined(viewModel, observerLookup);
        for (i = 0, ii = properties.length; i < ii; ++i) {
            properties[i]._initialize(viewModel, observerLookup, attributes, handlesBind, boundProperties);
        }
    }
    Controller.prototype.created = function (owningView) {
        if (this.behavior.handlesCreated) {
            this.viewModel.created(owningView, this.view);
        }
    };
    Controller.prototype.automate = function (overrideContext, owningView) {
        this.view.bindingContext = this.viewModel;
        this.view.overrideContext = overrideContext || aureliaBinding.createOverrideContext(this.viewModel);
        this.view._isUserControlled = true;
        if (this.behavior.handlesCreated) {
            this.viewModel.created(owningView || null, this.view);
        }
        this.bind(this.view);
    };
    Controller.prototype.bind = function (scope) {
        var skipSelfSubscriber = this.behavior.handlesBind;
        var boundProperties = this.boundProperties;
        var i;
        var ii;
        var x;
        var observer;
        var selfSubscriber;
        if (this.isBound) {
            if (this.scope === scope) {
                return;
            }
            this.unbind();
        }
        this.isBound = true;
        this.scope = scope;
        for (i = 0, ii = boundProperties.length; i < ii; ++i) {
            x = boundProperties[i];
            observer = x.observer;
            selfSubscriber = observer.selfSubscriber;
            observer.publishing = false;
            if (skipSelfSubscriber) {
                observer.selfSubscriber = null;
            }
            x.binding.bind(scope);
            observer.call();
            observer.publishing = true;
            observer.selfSubscriber = selfSubscriber;
        }
        var overrideContext;
        if (this.view !== null) {
            if (skipSelfSubscriber) {
                this.view.viewModelScope = scope;
            }
            if (this.viewModel === scope.overrideContext.bindingContext) {
                overrideContext = scope.overrideContext;
            }
            else if (this.instruction.inheritBindingContext) {
                overrideContext = aureliaBinding.createOverrideContext(this.viewModel, scope.overrideContext);
            }
            else {
                overrideContext = aureliaBinding.createOverrideContext(this.viewModel);
                overrideContext.__parentOverrideContext = scope.overrideContext;
            }
            this.view.bind(this.viewModel, overrideContext);
        }
        else if (skipSelfSubscriber) {
            overrideContext = scope.overrideContext;
            if (scope.overrideContext.__parentOverrideContext !== undefined
                && this.viewModel.viewFactory && this.viewModel.viewFactory.factoryCreateInstruction.partReplacements) {
                overrideContext = Object.assign({}, scope.overrideContext);
                overrideContext.parentOverrideContext = scope.overrideContext.__parentOverrideContext;
            }
            this.viewModel.bind(scope.bindingContext, overrideContext);
        }
    };
    Controller.prototype.unbind = function () {
        if (this.isBound) {
            var boundProperties = this.boundProperties;
            var i = void 0;
            var ii = void 0;
            this.isBound = false;
            this.scope = null;
            if (this.view !== null) {
                this.view.unbind();
            }
            if (this.behavior.handlesUnbind) {
                this.viewModel.unbind();
            }
            if (this.elementEvents !== null) {
                this.elementEvents.disposeAll();
            }
            for (i = 0, ii = boundProperties.length; i < ii; ++i) {
                boundProperties[i].binding.unbind();
            }
        }
    };
    Controller.prototype.attached = function () {
        if (this.isAttached) {
            return;
        }
        this.isAttached = true;
        if (this.behavior.handlesAttached) {
            this.viewModel.attached();
        }
        if (this.view !== null) {
            this.view.attached();
        }
    };
    Controller.prototype.detached = function () {
        if (this.isAttached) {
            this.isAttached = false;
            if (this.view !== null) {
                this.view.detached();
            }
            if (this.behavior.handlesDetached) {
                this.viewModel.detached();
            }
        }
    };
    return Controller;
}());

var lastProviderId = 0;
function nextProviderId() {
    return ++lastProviderId;
}
function doProcessContent() { return true; }
function doProcessAttributes() { }
var HtmlBehaviorResource = (function () {
    function HtmlBehaviorResource() {
        this.elementName = null;
        this.attributeName = null;
        this.attributeDefaultBindingMode = undefined;
        this.liftsContent = false;
        this.targetShadowDOM = false;
        this.shadowDOMOptions = null;
        this.processAttributes = doProcessAttributes;
        this.processContent = doProcessContent;
        this.usesShadowDOM = false;
        this.childBindings = null;
        this.hasDynamicOptions = false;
        this.containerless = false;
        this.properties = [];
        this.attributes = {};
        this.isInitialized = false;
        this.primaryProperty = null;
    }
    HtmlBehaviorResource.convention = function (name, existing) {
        var behavior;
        if (name.endsWith('CustomAttribute')) {
            behavior = existing || new HtmlBehaviorResource();
            behavior.attributeName = _hyphenate(name.substring(0, name.length - 15));
        }
        if (name.endsWith('CustomElement')) {
            behavior = existing || new HtmlBehaviorResource();
            behavior.elementName = _hyphenate(name.substring(0, name.length - 13));
        }
        return behavior;
    };
    HtmlBehaviorResource.prototype.addChildBinding = function (behavior) {
        if (this.childBindings === null) {
            this.childBindings = [];
        }
        this.childBindings.push(behavior);
    };
    HtmlBehaviorResource.prototype.initialize = function (container, target) {
        var proto = target.prototype;
        var properties = this.properties;
        var attributeName = this.attributeName;
        var attributeDefaultBindingMode = this.attributeDefaultBindingMode;
        var i;
        var ii;
        var current;
        if (this.isInitialized) {
            return;
        }
        this.isInitialized = true;
        target.__providerId__ = nextProviderId();
        this.observerLocator = container.get(aureliaBinding.ObserverLocator);
        this.taskQueue = container.get(aureliaTaskQueue.TaskQueue);
        this.target = target;
        this.usesShadowDOM = this.targetShadowDOM && aureliaPal.FEATURE.shadowDOM;
        this.handlesCreated = ('created' in proto);
        this.handlesBind = ('bind' in proto);
        this.handlesUnbind = ('unbind' in proto);
        this.handlesAttached = ('attached' in proto);
        this.handlesDetached = ('detached' in proto);
        this.htmlName = this.elementName || this.attributeName;
        if (attributeName !== null) {
            if (properties.length === 0) {
                new BindableProperty({
                    name: 'value',
                    changeHandler: 'valueChanged' in proto ? 'valueChanged' : null,
                    attribute: attributeName,
                    defaultBindingMode: attributeDefaultBindingMode
                }).registerWith(target, this);
            }
            current = properties[0];
            if (properties.length === 1 && current.name === 'value') {
                current.isDynamic = current.hasOptions = this.hasDynamicOptions;
                current.defineOn(target, this);
            }
            else {
                for (i = 0, ii = properties.length; i < ii; ++i) {
                    properties[i].defineOn(target, this);
                    if (properties[i].primaryProperty) {
                        if (this.primaryProperty) {
                            throw new Error('Only one bindable property on a custom element can be defined as the default');
                        }
                        this.primaryProperty = properties[i];
                    }
                }
                current = new BindableProperty({
                    name: 'value',
                    changeHandler: 'valueChanged' in proto ? 'valueChanged' : null,
                    attribute: attributeName,
                    defaultBindingMode: attributeDefaultBindingMode
                });
                current.hasOptions = true;
                current.registerWith(target, this);
            }
        }
        else {
            for (i = 0, ii = properties.length; i < ii; ++i) {
                properties[i].defineOn(target, this);
            }
            this._copyInheritedProperties(container, target);
        }
    };
    HtmlBehaviorResource.prototype.register = function (registry, name) {
        var _this = this;
        if (this.attributeName !== null) {
            registry.registerAttribute(name || this.attributeName, this, this.attributeName);
            if (Array.isArray(this.aliases)) {
                this.aliases
                    .forEach(function (alias) {
                    registry.registerAttribute(alias, _this, _this.attributeName);
                });
            }
        }
        if (this.elementName !== null) {
            registry.registerElement(name || this.elementName, this);
        }
    };
    HtmlBehaviorResource.prototype.aliases = function (aliases) {
        throw new Error('Method not implemented.');
    };
    HtmlBehaviorResource.prototype.load = function (container, target, loadContext, viewStrategy, transientView) {
        var _this = this;
        var options;
        if (this.elementName !== null) {
            viewStrategy = container.get(ViewLocator).getViewStrategy(viewStrategy || this.viewStrategy || target);
            options = new ViewCompileInstruction(this.targetShadowDOM, true);
            if (!viewStrategy.moduleId) {
                viewStrategy.moduleId = aureliaMetadata.Origin.get(target).moduleId;
            }
            return viewStrategy
                .loadViewFactory(container.get(ViewEngine), options, loadContext, target)
                .then(function (viewFactory) {
                if (!transientView || !_this.viewFactory) {
                    _this.viewFactory = viewFactory;
                }
                return viewFactory;
            });
        }
        return Promise.resolve(this);
    };
    HtmlBehaviorResource.prototype.compile = function (compiler, resources, node, instruction, parentNode) {
        if (this.liftsContent) {
            if (!instruction.viewFactory) {
                var template = aureliaPal.DOM.createElement('template');
                var fragment = aureliaPal.DOM.createDocumentFragment();
                var cacheSize = node.getAttribute('view-cache');
                var part = node.getAttribute('part');
                node.removeAttribute(instruction.originalAttrName);
                aureliaPal.DOM.replaceNode(template, node, parentNode);
                fragment.appendChild(node);
                instruction.viewFactory = compiler.compile(fragment, resources);
                if (part) {
                    instruction.viewFactory.part = part;
                    node.removeAttribute('part');
                }
                if (cacheSize) {
                    instruction.viewFactory.setCacheSize(cacheSize);
                    node.removeAttribute('view-cache');
                }
                node = template;
            }
        }
        else if (this.elementName !== null) {
            var partReplacements = {};
            if (this.processContent(compiler, resources, node, instruction) && node.hasChildNodes()) {
                var currentChild = node.firstChild;
                var contentElement = this.usesShadowDOM ? null : aureliaPal.DOM.createElement('au-content');
                var nextSibling = void 0;
                var toReplace = void 0;
                while (currentChild) {
                    nextSibling = currentChild.nextSibling;
                    if (currentChild.tagName === 'TEMPLATE' && (toReplace = currentChild.getAttribute('replace-part'))) {
                        partReplacements[toReplace] = compiler.compile(currentChild, resources);
                        aureliaPal.DOM.removeNode(currentChild, parentNode);
                        instruction.partReplacements = partReplacements;
                    }
                    else if (contentElement !== null) {
                        if (currentChild.nodeType === 3 && _isAllWhitespace(currentChild)) {
                            aureliaPal.DOM.removeNode(currentChild, parentNode);
                        }
                        else {
                            contentElement.appendChild(currentChild);
                        }
                    }
                    currentChild = nextSibling;
                }
                if (contentElement !== null && contentElement.hasChildNodes()) {
                    node.appendChild(contentElement);
                }
                instruction.skipContentProcessing = false;
            }
            else {
                instruction.skipContentProcessing = true;
            }
        }
        else if (!this.processContent(compiler, resources, node, instruction)) {
            instruction.skipContentProcessing = true;
        }
        return node;
    };
    HtmlBehaviorResource.prototype.create = function (container, instruction, element, bindings) {
        var viewHost;
        var au = null;
        instruction = instruction || BehaviorInstruction.normal;
        element = element || null;
        bindings = bindings || null;
        if (this.elementName !== null && element) {
            if (this.usesShadowDOM) {
                viewHost = element.attachShadow(this.shadowDOMOptions);
                container.registerInstance(aureliaPal.DOM.boundary, viewHost);
            }
            else {
                viewHost = element;
                if (this.targetShadowDOM) {
                    container.registerInstance(aureliaPal.DOM.boundary, viewHost);
                }
            }
        }
        if (element !== null) {
            element.au = au = element.au || {};
        }
        var viewModel = instruction.viewModel || container.get(this.target);
        var controller = new Controller(this, instruction, viewModel, container);
        var childBindings = this.childBindings;
        var viewFactory;
        if (this.liftsContent) {
            au.controller = controller;
        }
        else if (this.elementName !== null) {
            viewFactory = instruction.viewFactory || this.viewFactory;
            container.viewModel = viewModel;
            if (viewFactory) {
                controller.view = viewFactory.create(container, instruction, element);
            }
            if (element !== null) {
                au.controller = controller;
                if (controller.view) {
                    if (!this.usesShadowDOM && (element.childNodes.length === 1 || element.contentElement)) {
                        var contentElement = element.childNodes[0] || element.contentElement;
                        controller.view.contentView = { fragment: contentElement };
                        contentElement.parentNode && aureliaPal.DOM.removeNode(contentElement);
                    }
                    if (instruction.anchorIsContainer) {
                        if (childBindings !== null) {
                            for (var i = 0, ii = childBindings.length; i < ii; ++i) {
                                controller.view.addBinding(childBindings[i].create(element, viewModel, controller));
                            }
                        }
                        controller.view.appendNodesTo(viewHost);
                    }
                    else {
                        controller.view.insertNodesBefore(viewHost);
                    }
                }
                else if (childBindings !== null) {
                    for (var i = 0, ii = childBindings.length; i < ii; ++i) {
                        bindings.push(childBindings[i].create(element, viewModel, controller));
                    }
                }
            }
            else if (controller.view) {
                controller.view.controller = controller;
                if (childBindings !== null) {
                    for (var i = 0, ii = childBindings.length; i < ii; ++i) {
                        controller.view.addBinding(childBindings[i].create(instruction.host, viewModel, controller));
                    }
                }
            }
            else if (childBindings !== null) {
                for (var i = 0, ii = childBindings.length; i < ii; ++i) {
                    bindings.push(childBindings[i].create(instruction.host, viewModel, controller));
                }
            }
        }
        else if (childBindings !== null) {
            for (var i = 0, ii = childBindings.length; i < ii; ++i) {
                bindings.push(childBindings[i].create(element, viewModel, controller));
            }
        }
        if (au !== null) {
            au[this.htmlName] = controller;
        }
        if (instruction.initiatedByBehavior && viewFactory) {
            controller.view.created();
        }
        return controller;
    };
    HtmlBehaviorResource.prototype._ensurePropertiesDefined = function (instance, lookup) {
        var properties;
        var i;
        var ii;
        var observer;
        if ('__propertiesDefined__' in lookup) {
            return;
        }
        lookup.__propertiesDefined__ = true;
        properties = this.properties;
        for (i = 0, ii = properties.length; i < ii; ++i) {
            observer = properties[i].createObserver(instance);
            if (observer !== undefined) {
                lookup[observer.propertyName] = observer;
            }
        }
    };
    HtmlBehaviorResource.prototype._copyInheritedProperties = function (container, target) {
        var behavior;
        var derived = target;
        while (true) {
            var proto = Object.getPrototypeOf(target.prototype);
            target = proto && proto.constructor;
            if (!target) {
                return;
            }
            behavior = aureliaMetadata.metadata.getOwn(aureliaMetadata.metadata.resource, target);
            if (behavior) {
                break;
            }
        }
        behavior.initialize(container, target);
        var _loop_1 = function (i, ii) {
            var prop = behavior.properties[i];
            if (this_1.properties.some(function (p) { return p.name === prop.name; })) {
                return "continue";
            }
            new BindableProperty(prop).registerWith(derived, this_1);
        };
        var this_1 = this;
        for (var i = 0, ii = behavior.properties.length; i < ii; ++i) {
            _loop_1(i);
        }
    };
    return HtmlBehaviorResource;
}());

function register(lookup, name, resource, type) {
    if (!name) {
        return;
    }
    var existing = lookup[name];
    if (existing) {
        if (existing !== resource) {
            throw new Error("Attempted to register ".concat(type, " when one with the same name already exists. Name: ").concat(name, "."));
        }
        return;
    }
    lookup[name] = resource;
}
function validateBehaviorName(name, type) {
    if (/[A-Z]/.test(name)) {
        var newName = _hyphenate(name);
        LogManager__namespace
            .getLogger('templating')
            .warn("'".concat(name, "' is not a valid ").concat(type, " name and has been converted to '").concat(newName, "'. Upper-case letters are not allowed because the DOM is not case-sensitive."));
        return newName;
    }
    return name;
}
var conventionMark = '__au_resource__';
var ViewResources = (function () {
    function ViewResources(parent, viewUrl) {
        this.bindingLanguage = null;
        this.parent = parent || null;
        this.hasParent = this.parent !== null;
        this.viewUrl = viewUrl || '';
        this.lookupFunctions = {
            valueConverters: this.getValueConverter.bind(this),
            bindingBehaviors: this.getBindingBehavior.bind(this)
        };
        this.attributes = Object.create(null);
        this.elements = Object.create(null);
        this.valueConverters = Object.create(null);
        this.bindingBehaviors = Object.create(null);
        this.attributeMap = Object.create(null);
        this.values = Object.create(null);
        this.beforeCompile = this.afterCompile = this.beforeCreate = this.afterCreate = this.beforeBind = this.beforeUnbind = false;
    }
    ViewResources.convention = function (target, existing) {
        var resource;
        if (existing && conventionMark in existing) {
            return existing;
        }
        if ('$resource' in target) {
            var config = target.$resource;
            if (typeof config === 'string') {
                resource = existing || new HtmlBehaviorResource();
                resource[conventionMark] = true;
                if (!resource.elementName) {
                    resource.elementName = validateBehaviorName(config, 'custom element');
                }
            }
            else {
                if (typeof config === 'function') {
                    config = config.call(target);
                }
                if (typeof config === 'string') {
                    config = { name: config };
                }
                config = Object.assign({}, config);
                var resourceType = config.type || 'element';
                var name_1 = config.name;
                switch (resourceType) {
                    case 'element':
                    case 'attribute':
                        resource = existing || new HtmlBehaviorResource();
                        resource[conventionMark] = true;
                        if (resourceType === 'element') {
                            if (!resource.elementName) {
                                resource.elementName = name_1
                                    ? validateBehaviorName(name_1, 'custom element')
                                    : _hyphenate(target.name);
                            }
                        }
                        else {
                            if (!resource.attributeName) {
                                resource.attributeName = name_1
                                    ? validateBehaviorName(name_1, 'custom attribute')
                                    : _hyphenate(target.name);
                            }
                        }
                        if ('templateController' in config) {
                            config.liftsContent = config.templateController;
                            delete config.templateController;
                        }
                        if ('defaultBindingMode' in config && resource.attributeDefaultBindingMode !== undefined) {
                            config.attributeDefaultBindingMode = config.defaultBindingMode;
                            delete config.defaultBindingMode;
                        }
                        delete config.name;
                        Object.assign(resource, config);
                        break;
                    case 'valueConverter':
                        resource = new aureliaBinding.ValueConverterResource(aureliaBinding.camelCase(name_1 || target.name));
                        break;
                    case 'bindingBehavior':
                        resource = new aureliaBinding.BindingBehaviorResource(aureliaBinding.camelCase(name_1 || target.name));
                        break;
                    case 'viewEngineHooks':
                        resource = new ViewEngineHooksResource();
                        break;
                }
            }
            if (resource instanceof HtmlBehaviorResource) {
                var bindables = typeof config === 'string' ? undefined : config.bindables;
                var currentProps = resource.properties;
                if (Array.isArray(bindables)) {
                    for (var i = 0, ii = bindables.length; ii > i; ++i) {
                        var prop = bindables[i];
                        if (!prop || (typeof prop !== 'string' && !prop.name)) {
                            throw new Error("Invalid bindable property at \"".concat(i, "\" for class \"").concat(target.name, "\". Expected either a string or an object with \"name\" property."));
                        }
                        var newProp = new BindableProperty(prop);
                        var existed = false;
                        for (var j = 0, jj = currentProps.length; jj > j; ++j) {
                            if (currentProps[j].name === newProp.name) {
                                existed = true;
                                break;
                            }
                        }
                        if (existed) {
                            continue;
                        }
                        newProp.registerWith(target, resource);
                    }
                }
            }
        }
        return resource;
    };
    ViewResources.prototype._tryAddHook = function (obj, name) {
        if (typeof obj[name] === 'function') {
            var func = obj[name].bind(obj);
            var counter = 1;
            var callbackName = void 0;
            while (this[callbackName = name + counter.toString()] !== undefined) {
                counter++;
            }
            this[name] = true;
            this[callbackName] = func;
        }
    };
    ViewResources.prototype._invokeHook = function (name, one, two, three, four) {
        if (this.hasParent) {
            this.parent._invokeHook(name, one, two, three, four);
        }
        if (this[name]) {
            this[name + '1'](one, two, three, four);
            var callbackName = name + '2';
            if (this[callbackName]) {
                this[callbackName](one, two, three, four);
                callbackName = name + '3';
                if (this[callbackName]) {
                    this[callbackName](one, two, three, four);
                    var counter = 4;
                    while (this[callbackName = name + counter.toString()] !== undefined) {
                        this[callbackName](one, two, three, four);
                        counter++;
                    }
                }
            }
        }
    };
    ViewResources.prototype.registerViewEngineHooks = function (hooks) {
        this._tryAddHook(hooks, 'beforeCompile');
        this._tryAddHook(hooks, 'afterCompile');
        this._tryAddHook(hooks, 'beforeCreate');
        this._tryAddHook(hooks, 'afterCreate');
        this._tryAddHook(hooks, 'beforeBind');
        this._tryAddHook(hooks, 'beforeUnbind');
    };
    ViewResources.prototype.getBindingLanguage = function (bindingLanguageFallback) {
        return this.bindingLanguage || (this.bindingLanguage = bindingLanguageFallback);
    };
    ViewResources.prototype.patchInParent = function (newParent) {
        var originalParent = this.parent;
        this.parent = newParent || null;
        this.hasParent = this.parent !== null;
        if (newParent.parent === null) {
            newParent.parent = originalParent;
            newParent.hasParent = originalParent !== null;
        }
    };
    ViewResources.prototype.relativeToView = function (path) {
        return aureliaPath.relativeToFile(path, this.viewUrl);
    };
    ViewResources.prototype.registerElement = function (tagName, behavior) {
        register(this.elements, tagName, behavior, 'an Element');
    };
    ViewResources.prototype.getElement = function (tagName) {
        return this.elements[tagName] || (this.hasParent ? this.parent.getElement(tagName) : null);
    };
    ViewResources.prototype.mapAttribute = function (attribute) {
        return this.attributeMap[attribute] || (this.hasParent ? this.parent.mapAttribute(attribute) : null);
    };
    ViewResources.prototype.registerAttribute = function (attribute, behavior, knownAttribute) {
        this.attributeMap[attribute] = knownAttribute;
        register(this.attributes, attribute, behavior, 'an Attribute');
    };
    ViewResources.prototype.getAttribute = function (attribute) {
        return this.attributes[attribute] || (this.hasParent ? this.parent.getAttribute(attribute) : null);
    };
    ViewResources.prototype.registerValueConverter = function (name, valueConverter) {
        register(this.valueConverters, name, valueConverter, 'a ValueConverter');
    };
    ViewResources.prototype.getValueConverter = function (name) {
        return this.valueConverters[name] || (this.hasParent ? this.parent.getValueConverter(name) : null);
    };
    ViewResources.prototype.registerBindingBehavior = function (name, bindingBehavior) {
        register(this.bindingBehaviors, name, bindingBehavior, 'a BindingBehavior');
    };
    ViewResources.prototype.getBindingBehavior = function (name) {
        return this.bindingBehaviors[name] || (this.hasParent ? this.parent.getBindingBehavior(name) : null);
    };
    ViewResources.prototype.registerValue = function (name, value) {
        register(this.values, name, value, 'a value');
    };
    ViewResources.prototype.getValue = function (name) {
        return this.values[name] || (this.hasParent ? this.parent.getValue(name) : null);
    };
    ViewResources.prototype.autoRegister = function (container, impl) {
        var resourceTypeMeta = aureliaMetadata.metadata.getOwn(aureliaMetadata.metadata.resource, impl);
        if (resourceTypeMeta) {
            if (resourceTypeMeta instanceof HtmlBehaviorResource) {
                ViewResources.convention(impl, resourceTypeMeta);
                if (resourceTypeMeta.attributeName === null && resourceTypeMeta.elementName === null) {
                    HtmlBehaviorResource.convention(impl.name, resourceTypeMeta);
                }
                if (resourceTypeMeta.attributeName === null && resourceTypeMeta.elementName === null) {
                    resourceTypeMeta.elementName = _hyphenate(impl.name);
                }
            }
        }
        else {
            resourceTypeMeta = ViewResources.convention(impl)
                || HtmlBehaviorResource.convention(impl.name)
                || aureliaBinding.ValueConverterResource.convention(impl.name)
                || aureliaBinding.BindingBehaviorResource.convention(impl.name)
                || ViewEngineHooksResource.convention(impl.name);
            if (!resourceTypeMeta) {
                resourceTypeMeta = new HtmlBehaviorResource();
                resourceTypeMeta.elementName = _hyphenate(impl.name);
            }
            aureliaMetadata.metadata.define(aureliaMetadata.metadata.resource, resourceTypeMeta, impl);
        }
        resourceTypeMeta.initialize(container, impl);
        resourceTypeMeta.register(this, undefined);
        return resourceTypeMeta;
    };
    return ViewResources;
}());

var viewStrategy = aureliaMetadata.protocol.create('aurelia:view-strategy', {
    validate: function (target) {
        if (!(typeof target.loadViewFactory === 'function')) {
            return 'View strategies must implement: loadViewFactory(viewEngine: ViewEngine, compileInstruction: ViewCompileInstruction, loadContext?: ResourceLoadContext): Promise<ViewFactory>';
        }
        return true;
    },
    compose: function (target) {
        if (!(typeof target.makeRelativeTo === 'function')) {
            target.makeRelativeTo = aureliaPal.PLATFORM.noop;
        }
    }
});
var RelativeViewStrategy = (function () {
    function RelativeViewStrategy(path) {
        this.path = path;
        this.absolutePath = null;
    }
    RelativeViewStrategy.prototype.loadViewFactory = function (viewEngine, compileInstruction, loadContext, target) {
        if (this.absolutePath === null && this.moduleId) {
            this.absolutePath = aureliaPath.relativeToFile(this.path, this.moduleId);
        }
        compileInstruction.associatedModuleId = this.moduleId;
        return viewEngine.loadViewFactory(this.absolutePath || this.path, compileInstruction, loadContext, target);
    };
    RelativeViewStrategy.prototype.makeRelativeTo = function (file) {
        if (this.absolutePath === null) {
            this.absolutePath = aureliaPath.relativeToFile(this.path, file);
        }
    };
    RelativeViewStrategy = __decorate([
        viewStrategy()
    ], RelativeViewStrategy);
    return RelativeViewStrategy;
}());
var ConventionalViewStrategy = (function () {
    function ConventionalViewStrategy(viewLocator, origin) {
        this.moduleId = origin.moduleId;
        this.viewUrl = viewLocator.convertOriginToViewUrl(origin);
    }
    ConventionalViewStrategy.prototype.loadViewFactory = function (viewEngine, compileInstruction, loadContext, target) {
        compileInstruction.associatedModuleId = this.moduleId;
        return viewEngine.loadViewFactory(this.viewUrl, compileInstruction, loadContext, target);
    };
    ConventionalViewStrategy = __decorate([
        viewStrategy()
    ], ConventionalViewStrategy);
    return ConventionalViewStrategy;
}());
var NoViewStrategy = (function () {
    function NoViewStrategy(dependencies, dependencyBaseUrl) {
        this.dependencies = dependencies || null;
        this.dependencyBaseUrl = dependencyBaseUrl || '';
    }
    NoViewStrategy.prototype.loadViewFactory = function (viewEngine, compileInstruction, loadContext, target) {
        var entry = this.entry;
        var dependencies = this.dependencies;
        if (entry && entry.factoryIsReady) {
            return Promise.resolve(null);
        }
        this.entry = entry = new aureliaLoader.TemplateRegistryEntry(this.moduleId || this.dependencyBaseUrl);
        entry.dependencies = [];
        entry.templateIsLoaded = true;
        if (dependencies !== null) {
            for (var i = 0, ii = dependencies.length; i < ii; ++i) {
                var current = dependencies[i];
                if (typeof current === 'string' || typeof current === 'function') {
                    entry.addDependency(current);
                }
                else {
                    entry.addDependency(current.from, current.as);
                }
            }
        }
        compileInstruction.associatedModuleId = this.moduleId;
        return viewEngine.loadViewFactory(entry, compileInstruction, loadContext, target);
    };
    NoViewStrategy = __decorate([
        viewStrategy()
    ], NoViewStrategy);
    return NoViewStrategy;
}());
var TemplateRegistryViewStrategy = (function () {
    function TemplateRegistryViewStrategy(moduleId, entry) {
        this.moduleId = moduleId;
        this.entry = entry;
    }
    TemplateRegistryViewStrategy.prototype.loadViewFactory = function (viewEngine, compileInstruction, loadContext, target) {
        var entry = this.entry;
        if (entry.factoryIsReady) {
            return Promise.resolve(entry.factory);
        }
        compileInstruction.associatedModuleId = this.moduleId;
        return viewEngine.loadViewFactory(entry, compileInstruction, loadContext, target);
    };
    TemplateRegistryViewStrategy = __decorate([
        viewStrategy()
    ], TemplateRegistryViewStrategy);
    return TemplateRegistryViewStrategy;
}());
var InlineViewStrategy = (function () {
    function InlineViewStrategy(markup, dependencies, dependencyBaseUrl) {
        this.markup = markup;
        this.dependencies = dependencies || null;
        this.dependencyBaseUrl = dependencyBaseUrl || '';
    }
    InlineViewStrategy.prototype.loadViewFactory = function (viewEngine, compileInstruction, loadContext, target) {
        var entry = this.entry;
        var dependencies = this.dependencies;
        if (entry && entry.factoryIsReady) {
            return Promise.resolve(entry.factory);
        }
        this.entry = entry = new aureliaLoader.TemplateRegistryEntry(this.moduleId || this.dependencyBaseUrl);
        entry.template = aureliaPal.DOM.createTemplateFromMarkup(this.markup);
        if (dependencies !== null) {
            for (var i = 0, ii = dependencies.length; i < ii; ++i) {
                var current = dependencies[i];
                if (typeof current === 'string' || typeof current === 'function') {
                    entry.addDependency(current);
                }
                else {
                    entry.addDependency(current.from, current.as);
                }
            }
        }
        compileInstruction.associatedModuleId = this.moduleId;
        return viewEngine.loadViewFactory(entry, compileInstruction, loadContext, target);
    };
    InlineViewStrategy = __decorate([
        viewStrategy()
    ], InlineViewStrategy);
    return InlineViewStrategy;
}());
var StaticViewStrategy = (function () {
    function StaticViewStrategy(config) {
        if (typeof config === 'string' || (config instanceof aureliaPal.DOM.Element && config.tagName === 'TEMPLATE')) {
            config = {
                template: config
            };
        }
        this.template = config.template;
        this.dependencies = config.dependencies || [];
        this.factoryIsReady = false;
        this.onReady = null;
        this.moduleId = 'undefined';
    }
    StaticViewStrategy.prototype.loadViewFactory = function (viewEngine, compileInstruction, loadContext, target) {
        var _this = this;
        if (this.factoryIsReady) {
            return Promise.resolve(this.factory);
        }
        var $deps = this.dependencies;
        var deps = typeof $deps === 'function' ? $deps() : $deps;
        deps = deps ? deps : [];
        deps = Array.isArray(deps) ? deps : [deps];
        return Promise.all(deps).then(function (dependencies) {
            var container = viewEngine.container;
            var appResources = viewEngine.appResources;
            var viewCompiler = viewEngine.viewCompiler;
            var viewResources = new ViewResources(appResources);
            var resource;
            var elDeps = [];
            if (target) {
                viewResources.autoRegister(container, target);
            }
            for (var _i = 0, dependencies_1 = dependencies; _i < dependencies_1.length; _i++) {
                var dep = dependencies_1[_i];
                if (typeof dep === 'function') {
                    resource = viewResources.autoRegister(container, dep);
                    if (resource.elementName !== null) {
                        elDeps.push(resource);
                    }
                }
                else if (dep && typeof dep === 'object') {
                    for (var key in dep) {
                        var exported = dep[key];
                        if (typeof exported === 'function') {
                            resource = viewResources.autoRegister(container, exported);
                            if (resource.elementName !== null) {
                                elDeps.push(resource);
                            }
                        }
                    }
                }
                else {
                    throw new Error("dependency neither function nor object. Received: \"".concat(typeof dep, "\""));
                }
            }
            return Promise.all(elDeps.map(function (el) { return el.load(container, el.target); })).then(function () {
                var factory = _this.template !== null
                    ? viewCompiler.compile(_this.template, viewResources, compileInstruction)
                    : null;
                _this.factoryIsReady = true;
                _this.factory = factory;
                return factory;
            });
        });
    };
    StaticViewStrategy = __decorate([
        viewStrategy()
    ], StaticViewStrategy);
    return StaticViewStrategy;
}());

function remove(viewSlot, previous) {
    return Array.isArray(previous)
        ? viewSlot.removeMany(previous, true)
        : viewSlot.remove(previous, true);
}
var SwapStrategies = {
    before: function (viewSlot, previous, callback) {
        return (previous === undefined)
            ? callback()
            : callback().then(function () { return remove(viewSlot, previous); });
    },
    with: function (viewSlot, previous, callback) {
        return (previous === undefined)
            ? callback()
            : Promise.all([remove(viewSlot, previous), callback()]);
    },
    after: function (viewSlot, previous, callback) {
        return Promise.resolve(viewSlot.removeAll(true)).then(callback);
    }
};

function tryActivateViewModel(context) {
    if (context.skipActivation || typeof context.viewModel.activate !== 'function') {
        return Promise.resolve();
    }
    return context.viewModel.activate(context.model) || Promise.resolve();
}
var CompositionEngine = (function () {
    function CompositionEngine(viewEngine, viewLocator) {
        this.viewEngine = viewEngine;
        this.viewLocator = viewLocator;
    }
    CompositionEngine.prototype._swap = function (context, view) {
        var swapStrategy = SwapStrategies[context.swapOrder] || SwapStrategies.after;
        var previousViews = context.viewSlot.children.slice();
        return swapStrategy(context.viewSlot, previousViews, function () {
            return Promise.resolve(context.viewSlot.add(view)).then(function () {
                if (context.currentController) {
                    context.currentController.unbind();
                }
            });
        }).then(function () {
            if (context.compositionTransactionNotifier) {
                context.compositionTransactionNotifier.done();
            }
        });
    };
    CompositionEngine.prototype._createControllerAndSwap = function (context) {
        var _this = this;
        return this.createController(context).then(function (controller) {
            if (context.compositionTransactionOwnershipToken) {
                return context.compositionTransactionOwnershipToken
                    .waitForCompositionComplete()
                    .then(function () {
                    controller.automate(context.overrideContext, context.owningView);
                    return _this._swap(context, controller.view);
                })
                    .then(function () { return controller; });
            }
            controller.automate(context.overrideContext, context.owningView);
            return _this._swap(context, controller.view).then(function () { return controller; });
        });
    };
    CompositionEngine.prototype.createController = function (context) {
        var _this = this;
        var childContainer;
        var viewModel;
        var viewModelResource;
        var m;
        return this
            .ensureViewModel(context)
            .then(tryActivateViewModel)
            .then(function () {
            childContainer = context.childContainer;
            viewModel = context.viewModel;
            viewModelResource = context.viewModelResource;
            m = viewModelResource.metadata;
            var viewStrategy = _this.viewLocator.getViewStrategy(context.view || viewModel);
            if (context.viewResources) {
                viewStrategy.makeRelativeTo(context.viewResources.viewUrl);
            }
            return m.load(childContainer, viewModelResource.value, null, viewStrategy, true);
        }).then(function (viewFactory) { return m.create(childContainer, BehaviorInstruction.dynamic(context.host, viewModel, viewFactory)); });
    };
    CompositionEngine.prototype.ensureViewModel = function (context) {
        var childContainer = context.childContainer = (context.childContainer || context.container.createChild());
        if (typeof context.viewModel === 'string') {
            context.viewModel = context.viewResources
                ? context.viewResources.relativeToView(context.viewModel)
                : context.viewModel;
            return this.viewEngine.importViewModelResource(context.viewModel).then(function (viewModelResource) {
                childContainer.autoRegister(viewModelResource.value);
                if (context.host) {
                    childContainer.registerInstance(aureliaPal.DOM.Element, context.host);
                }
                context.viewModel = childContainer.viewModel = childContainer.get(viewModelResource.value);
                context.viewModelResource = viewModelResource;
                return context;
            });
        }
        var ctor = context.viewModel.constructor;
        var isClass = typeof context.viewModel === 'function';
        if (isClass) {
            ctor = context.viewModel;
            childContainer.autoRegister(ctor);
        }
        var m = aureliaMetadata.metadata.getOrCreateOwn(aureliaMetadata.metadata.resource, HtmlBehaviorResource, ctor);
        m.elementName = m.elementName || 'dynamic-element';
        m.initialize(isClass ? childContainer : (context.container || childContainer), ctor);
        context.viewModelResource = { metadata: m, value: ctor };
        if (context.host) {
            childContainer.registerInstance(aureliaPal.DOM.Element, context.host);
        }
        childContainer.viewModel = context.viewModel = isClass ? childContainer.get(ctor) : context.viewModel;
        return Promise.resolve(context);
    };
    CompositionEngine.prototype.compose = function (context) {
        var _this = this;
        context.childContainer = context.childContainer || context.container.createChild();
        context.view = this.viewLocator.getViewStrategy(context.view);
        var transaction = context.childContainer.get(CompositionTransaction);
        var compositionTransactionOwnershipToken = transaction.tryCapture();
        if (compositionTransactionOwnershipToken) {
            context.compositionTransactionOwnershipToken = compositionTransactionOwnershipToken;
        }
        else {
            context.compositionTransactionNotifier = transaction.enlist();
        }
        if (context.viewModel) {
            return this._createControllerAndSwap(context);
        }
        else if (context.view) {
            if (context.viewResources) {
                context.view.makeRelativeTo(context.viewResources.viewUrl);
            }
            return context.view.loadViewFactory(this.viewEngine, new ViewCompileInstruction()).then(function (viewFactory) {
                var result = viewFactory.create(context.childContainer);
                result.bind(context.bindingContext, context.overrideContext);
                if (context.compositionTransactionOwnershipToken) {
                    return context.compositionTransactionOwnershipToken.waitForCompositionComplete()
                        .then(function () { return _this._swap(context, result); })
                        .then(function () { return result; });
                }
                return _this._swap(context, result).then(function () { return result; });
            });
        }
        else if (context.viewSlot) {
            context.viewSlot.removeAll();
            if (context.compositionTransactionNotifier) {
                context.compositionTransactionNotifier.done();
            }
            return Promise.resolve(null);
        }
        return Promise.resolve(null);
    };
    CompositionEngine = __decorate([
        aureliaDependencyInjection.inject(ViewEngine, ViewLocator)
    ], CompositionEngine);
    return CompositionEngine;
}());

var animationEvent = {
    enterBegin: 'animation:enter:begin',
    enterActive: 'animation:enter:active',
    enterDone: 'animation:enter:done',
    enterTimeout: 'animation:enter:timeout',
    leaveBegin: 'animation:leave:begin',
    leaveActive: 'animation:leave:active',
    leaveDone: 'animation:leave:done',
    leaveTimeout: 'animation:leave:timeout',
    staggerNext: 'animation:stagger:next',
    removeClassBegin: 'animation:remove-class:begin',
    removeClassActive: 'animation:remove-class:active',
    removeClassDone: 'animation:remove-class:done',
    removeClassTimeout: 'animation:remove-class:timeout',
    addClassBegin: 'animation:add-class:begin',
    addClassActive: 'animation:add-class:active',
    addClassDone: 'animation:add-class:done',
    addClassTimeout: 'animation:add-class:timeout',
    animateBegin: 'animation:animate:begin',
    animateActive: 'animation:animate:active',
    animateDone: 'animation:animate:done',
    animateTimeout: 'animation:animate:timeout',
    sequenceBegin: 'animation:sequence:begin',
    sequenceDone: 'animation:sequence:done'
};

function createChildObserverDecorator(selectorOrConfig, all) {
    return function (target, key, descriptor) {
        var actualTarget = typeof key === 'string' ? target.constructor : target;
        var r = aureliaMetadata.metadata.getOrCreateOwn(aureliaMetadata.metadata.resource, HtmlBehaviorResource, actualTarget);
        if (typeof selectorOrConfig === 'string') {
            selectorOrConfig = {
                selector: selectorOrConfig,
                name: key
            };
        }
        if (descriptor) {
            descriptor.writable = true;
            descriptor.configurable = true;
        }
        selectorOrConfig.all = all;
        r.addChildBinding(new ChildObserver(selectorOrConfig));
    };
}
function children(selectorOrConfig) {
    return createChildObserverDecorator(selectorOrConfig, true);
}
function child(selectorOrConfig) {
    return createChildObserverDecorator(selectorOrConfig, false);
}
var ChildObserver = (function () {
    function ChildObserver(config) {
        this.name = config.name;
        this.changeHandler = config.changeHandler || this.name + 'Changed';
        this.selector = config.selector;
        this.all = config.all;
    }
    ChildObserver.prototype.create = function (viewHost, viewModel, controller) {
        return new ChildObserverBinder(this.selector, viewHost, this.name, viewModel, controller, this.changeHandler, this.all);
    };
    return ChildObserver;
}());
var noMutations = [];
function trackMutation(groupedMutations, binder, record) {
    var mutations = groupedMutations.get(binder);
    if (!mutations) {
        mutations = [];
        groupedMutations.set(binder, mutations);
    }
    mutations.push(record);
}
function onChildChange(mutations, observer) {
    var binders = observer.binders;
    var bindersLength = binders.length;
    var groupedMutations = new Map();
    for (var i = 0, ii = mutations.length; i < ii; ++i) {
        var record = mutations[i];
        var added = record.addedNodes;
        var removed = record.removedNodes;
        for (var j = 0, jj = removed.length; j < jj; ++j) {
            var node = removed[j];
            if (node.nodeType === 1) {
                for (var k = 0; k < bindersLength; ++k) {
                    var binder = binders[k];
                    if (binder.onRemove(node)) {
                        trackMutation(groupedMutations, binder, record);
                    }
                }
            }
        }
        for (var j = 0, jj = added.length; j < jj; ++j) {
            var node = added[j];
            if (node.nodeType === 1) {
                for (var k = 0; k < bindersLength; ++k) {
                    var binder = binders[k];
                    if (binder.onAdd(node)) {
                        trackMutation(groupedMutations, binder, record);
                    }
                }
            }
        }
    }
    groupedMutations.forEach(function (mutationRecords, binder) {
        if (binder.isBound && binder.changeHandler !== null) {
            binder.viewModel[binder.changeHandler](mutationRecords);
        }
    });
}
var ChildObserverBinder = (function () {
    function ChildObserverBinder(selector, viewHost, property, viewModel, controller, changeHandler, all) {
        this.selector = selector;
        this.viewHost = viewHost;
        this.property = property;
        this.viewModel = viewModel;
        this.controller = controller;
        this.changeHandler = changeHandler in viewModel ? changeHandler : null;
        this.usesShadowDOM = controller.behavior.usesShadowDOM;
        this.all = all;
        if (!this.usesShadowDOM && controller.view && controller.view.contentView) {
            this.contentView = controller.view.contentView;
        }
        else {
            this.contentView = null;
        }
        this.source = null;
        this.isBound = false;
    }
    ChildObserverBinder.prototype.matches = function (element) {
        if (element.matches(this.selector)) {
            if (this.contentView === null) {
                return true;
            }
            var contentView = this.contentView;
            var assignedSlot = element.auAssignedSlot;
            if (assignedSlot && assignedSlot.projectFromAnchors) {
                var anchors = assignedSlot.projectFromAnchors;
                for (var i = 0, ii = anchors.length; i < ii; ++i) {
                    if (anchors[i].auOwnerView === contentView) {
                        return true;
                    }
                }
                return false;
            }
            return element.auOwnerView === contentView;
        }
        return false;
    };
    ChildObserverBinder.prototype.bind = function (source) {
        if (this.isBound) {
            if (this.source === source) {
                return;
            }
            this.source = source;
        }
        this.isBound = true;
        var viewHost = this.viewHost;
        var viewModel = this.viewModel;
        var observer = viewHost.__childObserver__;
        if (!observer) {
            observer = viewHost.__childObserver__ = aureliaPal.DOM.createMutationObserver(onChildChange);
            var options = {
                childList: true,
                subtree: !this.usesShadowDOM
            };
            observer.observe(viewHost, options);
            observer.binders = [];
        }
        observer.binders.push(this);
        if (this.usesShadowDOM) {
            var current = viewHost.firstElementChild;
            if (this.all) {
                var items = viewModel[this.property];
                if (!items) {
                    items = viewModel[this.property] = [];
                }
                else {
                    items.splice(0);
                }
                while (current) {
                    if (this.matches(current)) {
                        items.push(current.au && current.au.controller ? current.au.controller.viewModel : current);
                    }
                    current = current.nextElementSibling;
                }
                if (this.changeHandler !== null) {
                    this.viewModel[this.changeHandler](noMutations);
                }
            }
            else {
                while (current) {
                    if (this.matches(current)) {
                        var value = current.au && current.au.controller ? current.au.controller.viewModel : current;
                        this.viewModel[this.property] = value;
                        if (this.changeHandler !== null) {
                            this.viewModel[this.changeHandler](value);
                        }
                        break;
                    }
                    current = current.nextElementSibling;
                }
            }
        }
    };
    ChildObserverBinder.prototype.onRemove = function (element) {
        if (this.matches(element)) {
            var value = element.au && element.au.controller ? element.au.controller.viewModel : element;
            if (this.all) {
                var items = (this.viewModel[this.property] || (this.viewModel[this.property] = []));
                var index = items.indexOf(value);
                if (index !== -1) {
                    items.splice(index, 1);
                }
                return true;
            }
            var currentValue = this.viewModel[this.property];
            if (currentValue === value) {
                this.viewModel[this.property] = null;
                if (this.isBound && this.changeHandler !== null) {
                    this.viewModel[this.changeHandler](value);
                }
            }
        }
        return false;
    };
    ChildObserverBinder.prototype.onAdd = function (element) {
        if (this.matches(element)) {
            var value = element.au && element.au.controller ? element.au.controller.viewModel : element;
            if (this.all) {
                var items = (this.viewModel[this.property] || (this.viewModel[this.property] = []));
                if (this.selector === '*') {
                    items.push(value);
                    return true;
                }
                var index = 0;
                var prev = element.previousElementSibling;
                while (prev) {
                    if (this.matches(prev)) {
                        index++;
                    }
                    prev = prev.previousElementSibling;
                }
                items.splice(index, 0, value);
                return true;
            }
            this.viewModel[this.property] = value;
            if (this.isBound && this.changeHandler !== null) {
                this.viewModel[this.changeHandler](value);
            }
        }
        return false;
    };
    ChildObserverBinder.prototype.unbind = function () {
        if (!this.isBound) {
            return;
        }
        this.isBound = false;
        this.source = null;
        var childObserver = this.viewHost.__childObserver__;
        if (childObserver) {
            var binders = childObserver.binders;
            if (binders && binders.length) {
                var idx = binders.indexOf(this);
                if (idx !== -1) {
                    binders.splice(idx, 1);
                }
                if (binders.length === 0) {
                    childObserver.disconnect();
                    this.viewHost.__childObserver__ = null;
                }
            }
            if (this.usesShadowDOM) {
                this.viewModel[this.property] = null;
            }
        }
    };
    return ChildObserverBinder;
}());

var ElementConfigResource = (function () {
    function ElementConfigResource() {
    }
    ElementConfigResource.prototype.initialize = function (container, target) { };
    ElementConfigResource.prototype.register = function (registry, name) { };
    ElementConfigResource.prototype.load = function (container, target) {
        var config = new target();
        var eventManager = container.get(aureliaBinding.EventManager);
        eventManager.registerElementConfig(config);
    };
    return ElementConfigResource;
}());

function resource(instanceOrConfig) {
    return function (target) {
        var isConfig = typeof instanceOrConfig === 'string' || Object.getPrototypeOf(instanceOrConfig) === Object.prototype;
        if (isConfig) {
            target.$resource = instanceOrConfig;
        }
        else {
            aureliaMetadata.metadata.define(aureliaMetadata.metadata.resource, instanceOrConfig, target);
        }
    };
}
function behavior(override) {
    return function (target) {
        if (override instanceof HtmlBehaviorResource) {
            aureliaMetadata.metadata.define(aureliaMetadata.metadata.resource, override, target);
        }
        else {
            var r = aureliaMetadata.metadata.getOrCreateOwn(aureliaMetadata.metadata.resource, HtmlBehaviorResource, target);
            Object.assign(r, override);
        }
    };
}
function customElement(name) {
    return function (target) {
        var r = aureliaMetadata.metadata.getOrCreateOwn(aureliaMetadata.metadata.resource, HtmlBehaviorResource, target);
        r.elementName = validateBehaviorName(name, 'custom element');
    };
}
function customAttribute(name, defaultBindingMode, aliases) {
    return function (target) {
        var r = aureliaMetadata.metadata.getOrCreateOwn(aureliaMetadata.metadata.resource, HtmlBehaviorResource, target);
        r.attributeName = validateBehaviorName(name, 'custom attribute');
        r.attributeDefaultBindingMode = defaultBindingMode;
        r.aliases = aliases;
    };
}
function templateController(target) {
    var deco = function (t) {
        var r = aureliaMetadata.metadata.getOrCreateOwn(aureliaMetadata.metadata.resource, HtmlBehaviorResource, t);
        r.liftsContent = true;
    };
    return target ? deco(target) : deco;
}
function bindable(nameOrConfigOrTarget, key, descriptor) {
    var deco = function (target, key2, descriptor2) {
        var actualTarget = key2 ? target.constructor : target;
        var r = aureliaMetadata.metadata.getOrCreateOwn(aureliaMetadata.metadata.resource, HtmlBehaviorResource, actualTarget);
        var prop;
        if (key2) {
            nameOrConfigOrTarget = nameOrConfigOrTarget || {};
            nameOrConfigOrTarget.name = key2;
        }
        prop = new BindableProperty(nameOrConfigOrTarget);
        return prop.registerWith(actualTarget, r, descriptor2);
    };
    if (!nameOrConfigOrTarget) {
        return deco;
    }
    if (key) {
        var target = nameOrConfigOrTarget;
        nameOrConfigOrTarget = null;
        return deco(target, key, descriptor);
    }
    return deco;
}
function dynamicOptions(target) {
    var deco = function (t) {
        var r = aureliaMetadata.metadata.getOrCreateOwn(aureliaMetadata.metadata.resource, HtmlBehaviorResource, t);
        r.hasDynamicOptions = true;
    };
    return target ? deco(target) : deco;
}
var defaultShadowDOMOptions = { mode: 'open' };
function useShadowDOM(targetOrOptions) {
    var options = typeof targetOrOptions === 'function' || !targetOrOptions
        ? defaultShadowDOMOptions
        : targetOrOptions;
    var deco = function (t) {
        var r = aureliaMetadata.metadata.getOrCreateOwn(aureliaMetadata.metadata.resource, HtmlBehaviorResource, t);
        r.targetShadowDOM = true;
        r.shadowDOMOptions = options;
    };
    return typeof targetOrOptions === 'function' ? deco(targetOrOptions) : deco;
}
function processAttributes(processor) {
    return function (t) {
        var r = aureliaMetadata.metadata.getOrCreateOwn(aureliaMetadata.metadata.resource, HtmlBehaviorResource, t);
        r.processAttributes = function (compiler, resources, node, attributes, elementInstruction) {
            try {
                processor(compiler, resources, node, attributes, elementInstruction);
            }
            catch (error) {
                LogManager__namespace.getLogger('templating').error(error);
            }
        };
    };
}
function doNotProcessContent() { return false; }
function processContent(processor) {
    return function (t) {
        var r = aureliaMetadata.metadata.getOrCreateOwn(aureliaMetadata.metadata.resource, HtmlBehaviorResource, t);
        r.processContent = processor ? function (compiler, resources, node, instruction) {
            try {
                return processor(compiler, resources, node, instruction);
            }
            catch (error) {
                LogManager__namespace.getLogger('templating').error(error);
                return false;
            }
        } : doNotProcessContent;
    };
}
function containerless(target) {
    var deco = function (t) {
        var r = aureliaMetadata.metadata.getOrCreateOwn(aureliaMetadata.metadata.resource, HtmlBehaviorResource, t);
        r.containerless = true;
    };
    return target ? deco(target) : deco;
}
function useViewStrategy(strategy) {
    return function (target) {
        aureliaMetadata.metadata.define(ViewLocator.viewStrategyMetadataKey, strategy, target);
    };
}
function useView(path) {
    return useViewStrategy(new RelativeViewStrategy(path));
}
function inlineView(markup, dependencies, dependencyBaseUrl) {
    return useViewStrategy(new InlineViewStrategy(markup, dependencies, dependencyBaseUrl));
}
function noView(targetOrDependencies, dependencyBaseUrl) {
    var target;
    var dependencies;
    if (typeof targetOrDependencies === 'function') {
        target = targetOrDependencies;
    }
    else {
        dependencies = targetOrDependencies;
        target = undefined;
    }
    var deco = function (t) {
        aureliaMetadata.metadata.define(ViewLocator.viewStrategyMetadataKey, new NoViewStrategy(dependencies, dependencyBaseUrl), t);
    };
    return target ? deco(target) : deco;
}
function view(templateOrConfig) {
    return function (target) {
        target.$view = templateOrConfig;
    };
}
function elementConfig(target) {
    var deco = function (t) {
        aureliaMetadata.metadata.define(aureliaMetadata.metadata.resource, new ElementConfigResource(), t);
    };
    return target ? deco(target) : deco;
}
function viewResources() {
    var resources = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        resources[_i] = arguments[_i];
    }
    return function (target) {
        aureliaMetadata.metadata.define(ViewEngine.viewModelRequireMetadataKey, resources, target);
    };
}

var TemplatingEngine = (function () {
    function TemplatingEngine(container, moduleAnalyzer, viewCompiler, compositionEngine) {
        this._container = container;
        this._moduleAnalyzer = moduleAnalyzer;
        this._viewCompiler = viewCompiler;
        this._compositionEngine = compositionEngine;
        container.registerInstance(Animator, Animator.instance = new Animator());
    }
    TemplatingEngine.prototype.configureAnimator = function (animator) {
        this._container.unregister(Animator);
        this._container.registerInstance(Animator, Animator.instance = animator);
    };
    TemplatingEngine.prototype.compose = function (context) {
        return this._compositionEngine.compose(context);
    };
    TemplatingEngine.prototype.enhance = function (instruction) {
        if (instruction instanceof aureliaPal.DOM.Element) {
            instruction = { element: instruction };
        }
        var compilerInstructions = { letExpressions: [] };
        var resources = instruction.resources || this._container.get(ViewResources);
        this._viewCompiler._compileNode(instruction.element, resources, compilerInstructions, instruction.element.parentNode, 'root', true);
        var factory = new ViewFactory(instruction.element, compilerInstructions, resources);
        var container = instruction.container || this._container.createChild();
        var view = factory.create(container, BehaviorInstruction.enhance());
        view.bind(instruction.bindingContext || {}, instruction.overrideContext);
        view.firstChild = view.lastChild = view.fragment;
        view.fragment = aureliaPal.DOM.createDocumentFragment();
        view.attached();
        return view;
    };
    TemplatingEngine.inject = [aureliaDependencyInjection.Container, ModuleAnalyzer, ViewCompiler, CompositionEngine];
    return TemplatingEngine;
}());

exports.Animator = Animator;
exports.BehaviorInstruction = BehaviorInstruction;
exports.BehaviorPropertyObserver = BehaviorPropertyObserver;
exports.BindableProperty = BindableProperty;
exports.BindingLanguage = BindingLanguage;
exports.BoundViewFactory = BoundViewFactory;
exports.CompositionEngine = CompositionEngine;
exports.CompositionTransaction = CompositionTransaction;
exports.CompositionTransactionNotifier = CompositionTransactionNotifier;
exports.CompositionTransactionOwnershipToken = CompositionTransactionOwnershipToken;
exports.Controller = Controller;
exports.ConventionalViewStrategy = ConventionalViewStrategy;
exports.ElementConfigResource = ElementConfigResource;
exports.ElementEvents = ElementEvents;
exports.HtmlBehaviorResource = HtmlBehaviorResource;
exports.InlineViewStrategy = InlineViewStrategy;
exports.ModuleAnalyzer = ModuleAnalyzer;
exports.NoViewStrategy = NoViewStrategy;
exports.PassThroughSlot = PassThroughSlot;
exports.RelativeViewStrategy = RelativeViewStrategy;
exports.ResourceDescription = ResourceDescription;
exports.ResourceLoadContext = ResourceLoadContext;
exports.ResourceModule = ResourceModule;
exports.ShadowDOM = ShadowDOM;
exports.ShadowSlot = ShadowSlot;
exports.SlotCustomAttribute = SlotCustomAttribute;
exports.StaticViewStrategy = StaticViewStrategy;
exports.SwapStrategies = SwapStrategies;
exports.TargetInstruction = TargetInstruction;
exports.TemplateRegistryViewStrategy = TemplateRegistryViewStrategy;
exports.TemplatingEngine = TemplatingEngine;
exports.View = View;
exports.ViewCompileInstruction = ViewCompileInstruction;
exports.ViewCompiler = ViewCompiler;
exports.ViewEngine = ViewEngine;
exports.ViewEngineHooksResource = ViewEngineHooksResource;
exports.ViewFactory = ViewFactory;
exports.ViewLocator = ViewLocator;
exports.ViewResources = ViewResources;
exports.ViewSlot = ViewSlot;
exports._hyphenate = _hyphenate;
exports._isAllWhitespace = _isAllWhitespace;
exports.animationEvent = animationEvent;
exports.behavior = behavior;
exports.bindable = bindable;
exports.child = child;
exports.children = children;
exports.containerless = containerless;
exports.customAttribute = customAttribute;
exports.customElement = customElement;
exports.dynamicOptions = dynamicOptions;
exports.elementConfig = elementConfig;
exports.inlineView = inlineView;
exports.noView = noView;
exports.processAttributes = processAttributes;
exports.processContent = processContent;
exports.resource = resource;
exports.templateController = templateController;
exports.useShadowDOM = useShadowDOM;
exports.useView = useView;
exports.useViewStrategy = useViewStrategy;
exports.validateBehaviorName = validateBehaviorName;
exports.view = view;
exports.viewEngineHooks = viewEngineHooks;
exports.viewResources = viewResources;
exports.viewStrategy = viewStrategy;


});
;
define('aurelia-testing/dist/commonjs/aurelia-testing',['require','exports','module','aurelia-templating','aurelia-logging','aurelia-pal'],function (require, exports, module) {'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var aureliaTemplating = require('aurelia-templating');
var aureliaLogging = require('aurelia-logging');
var aureliaPal = require('aurelia-pal');

var CompileSpy = (function () {
    function CompileSpy(element, instruction) {
        aureliaLogging.getLogger('compile-spy').info(element.toString(), instruction);
    }
    Object.defineProperty(CompileSpy, "inject", {
        get: function () { return [aureliaPal.DOM.Element, aureliaTemplating.TargetInstruction]; },
        enumerable: false,
        configurable: true
    });
    CompileSpy.$resource = {
        type: 'attribute',
        name: 'compile-spy'
    };
    return CompileSpy;
}());

var ViewSpy = (function () {
    function ViewSpy() {
        this.logger = aureliaLogging.getLogger('view-spy');
    }
    ViewSpy.prototype._log = function (lifecycleName, context) {
        if (!this.value && lifecycleName === 'created') {
            this.logger.info(lifecycleName, this.view);
        }
        else if (this.value && this.value.indexOf(lifecycleName) !== -1) {
            this.logger.info(lifecycleName, this.view, context);
        }
    };
    ViewSpy.prototype.created = function (view) {
        this.view = view;
        this._log('created');
    };
    ViewSpy.prototype.bind = function (bindingContext) {
        this._log('bind', bindingContext);
    };
    ViewSpy.prototype.attached = function () {
        this._log('attached');
    };
    ViewSpy.prototype.detached = function () {
        this._log('detached');
    };
    ViewSpy.prototype.unbind = function () {
        this._log('unbind');
    };
    ViewSpy.$resource = {
        type: 'attribute',
        name: 'view-spy'
    };
    return ViewSpy;
}());

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

var __assign = function() {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};

function waitFor(getter, options) {
    if (options === void 0) { options = { present: true, interval: 50, timeout: 5000 }; }
    var timedOut = false;
    options = __assign({ present: true, interval: 50, timeout: 5000 }, options);
    function wait() {
        var element = getter();
        var found = element !== null && (!(element instanceof NodeList) &&
            !element.jquery || element.length > 0);
        if (!options.present === !found || timedOut) {
            return Promise.resolve(element);
        }
        return new Promise(function (rs) { return setTimeout(rs, options.interval); }).then(wait);
    }
    return Promise.race([
        new Promise(function (_, rj) { return setTimeout(function () {
            timedOut = true;
            rj(new Error(options.present ? 'Element not found' : 'Element not removed'));
        }, options.timeout); }),
        wait()
    ]);
}
function waitForDocumentElement(selector, options) {
    return waitFor(function () { return document.querySelector(selector); }, options);
}
function waitForDocumentElements(selector, options) {
    return waitFor(function () { return document.querySelectorAll(selector); }, options);
}

var StageComponent = (function () {
    function StageComponent() {
    }
    StageComponent.withResources = function (resources) {
        if (resources === void 0) { resources = []; }
        return new ComponentTester().withResources(resources);
    };
    return StageComponent;
}());
var ComponentTester = (function () {
    function ComponentTester() {
        this.resources = [];
    }
    ComponentTester.prototype.configure = function (aurelia) {
        return aurelia.use.standardConfiguration();
    };
    ComponentTester.prototype.bootstrap = function (configure) {
        this.configure = configure;
    };
    ComponentTester.prototype.withResources = function (resources) {
        this.resources = resources;
        return this;
    };
    ComponentTester.prototype.inView = function (html) {
        this.html = html;
        return this;
    };
    ComponentTester.prototype.boundTo = function (bindingContext) {
        this.bindingContext = bindingContext;
        return this;
    };
    ComponentTester.prototype.manuallyHandleLifecycle = function () {
        this._prepareLifecycle();
        return this;
    };
    ComponentTester.prototype.create = function (bootstrap) {
        var _this = this;
        return bootstrap(function (aurelia) {
            return Promise.resolve(_this.configure(aurelia)).then(function () {
                if (_this.resources) {
                    aurelia.use.globalResources(_this.resources);
                }
                return aurelia.start().then(function () {
                    _this.host = document.createElement('div');
                    _this.host.innerHTML = _this.html;
                    document.body.appendChild(_this.host);
                    return aurelia.enhance(_this.bindingContext, _this.host).then(function () {
                        _this.rootView = aurelia.root;
                        _this.element = _this.host.firstElementChild;
                        if (aurelia.root.controllers.length) {
                            _this.viewModel = aurelia.root.controllers[0].viewModel;
                        }
                        return new Promise(function (resolve) { return setTimeout(function () { return resolve(); }, 0); });
                    });
                });
            });
        });
    };
    ComponentTester.prototype.dispose = function () {
        if (this.host === undefined || this.rootView === undefined) {
            throw new Error('Cannot call ComponentTester.dispose() before ComponentTester.create()');
        }
        this.rootView.detached();
        this.rootView.unbind();
        return this.host.parentNode.removeChild(this.host);
    };
    ComponentTester.prototype._prepareLifecycle = function () {
        var _this = this;
        var bindPrototype = aureliaTemplating.View.prototype.bind;
        aureliaTemplating.View.prototype.bind = function () { };
        this.bind = function (bindingContext) { return new Promise(function (resolve) {
            aureliaTemplating.View.prototype.bind = bindPrototype;
            if (bindingContext !== undefined) {
                _this.bindingContext = bindingContext;
            }
            _this.rootView.bind(_this.bindingContext);
            setTimeout(function () { return resolve(); }, 0);
        }); };
        var attachedPrototype = aureliaTemplating.View.prototype.attached;
        aureliaTemplating.View.prototype.attached = function () { };
        this.attached = function () { return new Promise(function (resolve) {
            aureliaTemplating.View.prototype.attached = attachedPrototype;
            _this.rootView.attached();
            setTimeout(function () { return resolve(); }, 0);
        }); };
        this.detached = function () { return new Promise(function (resolve) {
            _this.rootView.detached();
            setTimeout(function () { return resolve(); }, 0);
        }); };
        this.unbind = function () { return new Promise(function (resolve) {
            _this.rootView.unbind();
            setTimeout(function () { return resolve(); }, 0);
        }); };
    };
    ComponentTester.prototype.waitForElement = function (selector, options) {
        var _this = this;
        return waitFor(function () { return _this.element.querySelector(selector); }, options);
    };
    ComponentTester.prototype.waitForElements = function (selector, options) {
        var _this = this;
        return waitFor(function () { return _this.element.querySelectorAll(selector); }, options);
    };
    return ComponentTester;
}());

function configure(config) {
    config.globalResources([CompileSpy, ViewSpy]);
}

exports.CompileSpy = CompileSpy;
exports.ComponentTester = ComponentTester;
exports.StageComponent = StageComponent;
exports.ViewSpy = ViewSpy;
exports.configure = configure;
exports.waitFor = waitFor;
exports.waitForDocumentElement = waitForDocumentElement;
exports.waitForDocumentElements = waitForDocumentElements;


});
;
define('text!bootstrap/dist/css/bootstrap.min.css',[],function(){return "@charset \"UTF-8\";/*!\n * Bootstrap  v5.2.0 (https://getbootstrap.com/)\n * Copyright 2011-2022 The Bootstrap Authors\n * Copyright 2011-2022 Twitter, Inc.\n * Licensed under MIT (https://github.com/twbs/bootstrap/blob/main/LICENSE)\n */:root{--bs-blue:#0d6efd;--bs-indigo:#6610f2;--bs-purple:#6f42c1;--bs-pink:#d63384;--bs-red:#dc3545;--bs-orange:#fd7e14;--bs-yellow:#ffc107;--bs-green:#198754;--bs-teal:#20c997;--bs-cyan:#0dcaf0;--bs-black:#000;--bs-white:#fff;--bs-gray:#6c757d;--bs-gray-dark:#343a40;--bs-gray-100:#f8f9fa;--bs-gray-200:#e9ecef;--bs-gray-300:#dee2e6;--bs-gray-400:#ced4da;--bs-gray-500:#adb5bd;--bs-gray-600:#6c757d;--bs-gray-700:#495057;--bs-gray-800:#343a40;--bs-gray-900:#212529;--bs-primary:#0d6efd;--bs-secondary:#6c757d;--bs-success:#198754;--bs-info:#0dcaf0;--bs-warning:#ffc107;--bs-danger:#dc3545;--bs-light:#f8f9fa;--bs-dark:#212529;--bs-primary-rgb:13,110,253;--bs-secondary-rgb:108,117,125;--bs-success-rgb:25,135,84;--bs-info-rgb:13,202,240;--bs-warning-rgb:255,193,7;--bs-danger-rgb:220,53,69;--bs-light-rgb:248,249,250;--bs-dark-rgb:33,37,41;--bs-white-rgb:255,255,255;--bs-black-rgb:0,0,0;--bs-body-color-rgb:33,37,41;--bs-body-bg-rgb:255,255,255;--bs-font-sans-serif:system-ui,-apple-system,\"Segoe UI\",Roboto,\"Helvetica Neue\",\"Noto Sans\",\"Liberation Sans\",Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\",\"Segoe UI Symbol\",\"Noto Color Emoji\";--bs-font-monospace:SFMono-Regular,Menlo,Monaco,Consolas,\"Liberation Mono\",\"Courier New\",monospace;--bs-gradient:linear-gradient(180deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0));--bs-body-font-family:var(--bs-font-sans-serif);--bs-body-font-size:1rem;--bs-body-font-weight:400;--bs-body-line-height:1.5;--bs-body-color:#212529;--bs-body-bg:#fff;--bs-border-width:1px;--bs-border-style:solid;--bs-border-color:#dee2e6;--bs-border-color-translucent:rgba(0, 0, 0, 0.175);--bs-border-radius:0.375rem;--bs-border-radius-sm:0.25rem;--bs-border-radius-lg:0.5rem;--bs-border-radius-xl:1rem;--bs-border-radius-2xl:2rem;--bs-border-radius-pill:50rem;--bs-link-color:#0d6efd;--bs-link-hover-color:#0a58ca;--bs-code-color:#d63384;--bs-highlight-bg:#fff3cd}*,::after,::before{box-sizing:border-box}@media (prefers-reduced-motion:no-preference){:root{scroll-behavior:smooth}}body{margin:0;font-family:var(--bs-body-font-family);font-size:var(--bs-body-font-size);font-weight:var(--bs-body-font-weight);line-height:var(--bs-body-line-height);color:var(--bs-body-color);text-align:var(--bs-body-text-align);background-color:var(--bs-body-bg);-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent}hr{margin:1rem 0;color:inherit;border:0;border-top:1px solid;opacity:.25}.h1,.h2,.h3,.h4,.h5,.h6,h1,h2,h3,h4,h5,h6{margin-top:0;margin-bottom:.5rem;font-weight:500;line-height:1.2}.h1,h1{font-size:calc(1.375rem + 1.5vw)}@media (min-width:1200px){.h1,h1{font-size:2.5rem}}.h2,h2{font-size:calc(1.325rem + .9vw)}@media (min-width:1200px){.h2,h2{font-size:2rem}}.h3,h3{font-size:calc(1.3rem + .6vw)}@media (min-width:1200px){.h3,h3{font-size:1.75rem}}.h4,h4{font-size:calc(1.275rem + .3vw)}@media (min-width:1200px){.h4,h4{font-size:1.5rem}}.h5,h5{font-size:1.25rem}.h6,h6{font-size:1rem}p{margin-top:0;margin-bottom:1rem}abbr[title]{-webkit-text-decoration:underline dotted;text-decoration:underline dotted;cursor:help;-webkit-text-decoration-skip-ink:none;text-decoration-skip-ink:none}address{margin-bottom:1rem;font-style:normal;line-height:inherit}ol,ul{padding-left:2rem}dl,ol,ul{margin-top:0;margin-bottom:1rem}ol ol,ol ul,ul ol,ul ul{margin-bottom:0}dt{font-weight:700}dd{margin-bottom:.5rem;margin-left:0}blockquote{margin:0 0 1rem}b,strong{font-weight:bolder}.small,small{font-size:.875em}.mark,mark{padding:.1875em;background-color:var(--bs-highlight-bg)}sub,sup{position:relative;font-size:.75em;line-height:0;vertical-align:baseline}sub{bottom:-.25em}sup{top:-.5em}a{color:var(--bs-link-color);text-decoration:underline}a:hover{color:var(--bs-link-hover-color)}a:not([href]):not([class]),a:not([href]):not([class]):hover{color:inherit;text-decoration:none}code,kbd,pre,samp{font-family:var(--bs-font-monospace);font-size:1em}pre{display:block;margin-top:0;margin-bottom:1rem;overflow:auto;font-size:.875em}pre code{font-size:inherit;color:inherit;word-break:normal}code{font-size:.875em;color:var(--bs-code-color);word-wrap:break-word}a>code{color:inherit}kbd{padding:.1875rem .375rem;font-size:.875em;color:var(--bs-body-bg);background-color:var(--bs-body-color);border-radius:.25rem}kbd kbd{padding:0;font-size:1em}figure{margin:0 0 1rem}img,svg{vertical-align:middle}table{caption-side:bottom;border-collapse:collapse}caption{padding-top:.5rem;padding-bottom:.5rem;color:#6c757d;text-align:left}th{text-align:inherit;text-align:-webkit-match-parent}tbody,td,tfoot,th,thead,tr{border-color:inherit;border-style:solid;border-width:0}label{display:inline-block}button{border-radius:0}button:focus:not(:focus-visible){outline:0}button,input,optgroup,select,textarea{margin:0;font-family:inherit;font-size:inherit;line-height:inherit}button,select{text-transform:none}[role=button]{cursor:pointer}select{word-wrap:normal}select:disabled{opacity:1}[list]:not([type=date]):not([type=datetime-local]):not([type=month]):not([type=week]):not([type=time])::-webkit-calendar-picker-indicator{display:none!important}[type=button],[type=reset],[type=submit],button{-webkit-appearance:button}[type=button]:not(:disabled),[type=reset]:not(:disabled),[type=submit]:not(:disabled),button:not(:disabled){cursor:pointer}::-moz-focus-inner{padding:0;border-style:none}textarea{resize:vertical}fieldset{min-width:0;padding:0;margin:0;border:0}legend{float:left;width:100%;padding:0;margin-bottom:.5rem;font-size:calc(1.275rem + .3vw);line-height:inherit}@media (min-width:1200px){legend{font-size:1.5rem}}legend+*{clear:left}::-webkit-datetime-edit-day-field,::-webkit-datetime-edit-fields-wrapper,::-webkit-datetime-edit-hour-field,::-webkit-datetime-edit-minute,::-webkit-datetime-edit-month-field,::-webkit-datetime-edit-text,::-webkit-datetime-edit-year-field{padding:0}::-webkit-inner-spin-button{height:auto}[type=search]{outline-offset:-2px;-webkit-appearance:textfield}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-color-swatch-wrapper{padding:0}::-webkit-file-upload-button{font:inherit;-webkit-appearance:button}::file-selector-button{font:inherit;-webkit-appearance:button}output{display:inline-block}iframe{border:0}summary{display:list-item;cursor:pointer}progress{vertical-align:baseline}[hidden]{display:none!important}.lead{font-size:1.25rem;font-weight:300}.display-1{font-size:calc(1.625rem + 4.5vw);font-weight:300;line-height:1.2}@media (min-width:1200px){.display-1{font-size:5rem}}.display-2{font-size:calc(1.575rem + 3.9vw);font-weight:300;line-height:1.2}@media (min-width:1200px){.display-2{font-size:4.5rem}}.display-3{font-size:calc(1.525rem + 3.3vw);font-weight:300;line-height:1.2}@media (min-width:1200px){.display-3{font-size:4rem}}.display-4{font-size:calc(1.475rem + 2.7vw);font-weight:300;line-height:1.2}@media (min-width:1200px){.display-4{font-size:3.5rem}}.display-5{font-size:calc(1.425rem + 2.1vw);font-weight:300;line-height:1.2}@media (min-width:1200px){.display-5{font-size:3rem}}.display-6{font-size:calc(1.375rem + 1.5vw);font-weight:300;line-height:1.2}@media (min-width:1200px){.display-6{font-size:2.5rem}}.list-unstyled{padding-left:0;list-style:none}.list-inline{padding-left:0;list-style:none}.list-inline-item{display:inline-block}.list-inline-item:not(:last-child){margin-right:.5rem}.initialism{font-size:.875em;text-transform:uppercase}.blockquote{margin-bottom:1rem;font-size:1.25rem}.blockquote>:last-child{margin-bottom:0}.blockquote-footer{margin-top:-1rem;margin-bottom:1rem;font-size:.875em;color:#6c757d}.blockquote-footer::before{content:\"— \"}.img-fluid{max-width:100%;height:auto}.img-thumbnail{padding:.25rem;background-color:#fff;border:1px solid var(--bs-border-color);border-radius:.375rem;max-width:100%;height:auto}.figure{display:inline-block}.figure-img{margin-bottom:.5rem;line-height:1}.figure-caption{font-size:.875em;color:#6c757d}.container,.container-fluid,.container-lg,.container-md,.container-sm,.container-xl,.container-xxl{--bs-gutter-x:1.5rem;--bs-gutter-y:0;width:100%;padding-right:calc(var(--bs-gutter-x) * .5);padding-left:calc(var(--bs-gutter-x) * .5);margin-right:auto;margin-left:auto}@media (min-width:576px){.container,.container-sm{max-width:540px}}@media (min-width:768px){.container,.container-md,.container-sm{max-width:720px}}@media (min-width:992px){.container,.container-lg,.container-md,.container-sm{max-width:960px}}@media (min-width:1200px){.container,.container-lg,.container-md,.container-sm,.container-xl{max-width:1140px}}@media (min-width:1400px){.container,.container-lg,.container-md,.container-sm,.container-xl,.container-xxl{max-width:1320px}}.row{--bs-gutter-x:1.5rem;--bs-gutter-y:0;display:flex;flex-wrap:wrap;margin-top:calc(-1 * var(--bs-gutter-y));margin-right:calc(-.5 * var(--bs-gutter-x));margin-left:calc(-.5 * var(--bs-gutter-x))}.row>*{flex-shrink:0;width:100%;max-width:100%;padding-right:calc(var(--bs-gutter-x) * .5);padding-left:calc(var(--bs-gutter-x) * .5);margin-top:var(--bs-gutter-y)}.col{flex:1 0 0%}.row-cols-auto>*{flex:0 0 auto;width:auto}.row-cols-1>*{flex:0 0 auto;width:100%}.row-cols-2>*{flex:0 0 auto;width:50%}.row-cols-3>*{flex:0 0 auto;width:33.3333333333%}.row-cols-4>*{flex:0 0 auto;width:25%}.row-cols-5>*{flex:0 0 auto;width:20%}.row-cols-6>*{flex:0 0 auto;width:16.6666666667%}.col-auto{flex:0 0 auto;width:auto}.col-1{flex:0 0 auto;width:8.33333333%}.col-2{flex:0 0 auto;width:16.66666667%}.col-3{flex:0 0 auto;width:25%}.col-4{flex:0 0 auto;width:33.33333333%}.col-5{flex:0 0 auto;width:41.66666667%}.col-6{flex:0 0 auto;width:50%}.col-7{flex:0 0 auto;width:58.33333333%}.col-8{flex:0 0 auto;width:66.66666667%}.col-9{flex:0 0 auto;width:75%}.col-10{flex:0 0 auto;width:83.33333333%}.col-11{flex:0 0 auto;width:91.66666667%}.col-12{flex:0 0 auto;width:100%}.offset-1{margin-left:8.33333333%}.offset-2{margin-left:16.66666667%}.offset-3{margin-left:25%}.offset-4{margin-left:33.33333333%}.offset-5{margin-left:41.66666667%}.offset-6{margin-left:50%}.offset-7{margin-left:58.33333333%}.offset-8{margin-left:66.66666667%}.offset-9{margin-left:75%}.offset-10{margin-left:83.33333333%}.offset-11{margin-left:91.66666667%}.g-0,.gx-0{--bs-gutter-x:0}.g-0,.gy-0{--bs-gutter-y:0}.g-1,.gx-1{--bs-gutter-x:0.25rem}.g-1,.gy-1{--bs-gutter-y:0.25rem}.g-2,.gx-2{--bs-gutter-x:0.5rem}.g-2,.gy-2{--bs-gutter-y:0.5rem}.g-3,.gx-3{--bs-gutter-x:1rem}.g-3,.gy-3{--bs-gutter-y:1rem}.g-4,.gx-4{--bs-gutter-x:1.5rem}.g-4,.gy-4{--bs-gutter-y:1.5rem}.g-5,.gx-5{--bs-gutter-x:3rem}.g-5,.gy-5{--bs-gutter-y:3rem}@media (min-width:576px){.col-sm{flex:1 0 0%}.row-cols-sm-auto>*{flex:0 0 auto;width:auto}.row-cols-sm-1>*{flex:0 0 auto;width:100%}.row-cols-sm-2>*{flex:0 0 auto;width:50%}.row-cols-sm-3>*{flex:0 0 auto;width:33.3333333333%}.row-cols-sm-4>*{flex:0 0 auto;width:25%}.row-cols-sm-5>*{flex:0 0 auto;width:20%}.row-cols-sm-6>*{flex:0 0 auto;width:16.6666666667%}.col-sm-auto{flex:0 0 auto;width:auto}.col-sm-1{flex:0 0 auto;width:8.33333333%}.col-sm-2{flex:0 0 auto;width:16.66666667%}.col-sm-3{flex:0 0 auto;width:25%}.col-sm-4{flex:0 0 auto;width:33.33333333%}.col-sm-5{flex:0 0 auto;width:41.66666667%}.col-sm-6{flex:0 0 auto;width:50%}.col-sm-7{flex:0 0 auto;width:58.33333333%}.col-sm-8{flex:0 0 auto;width:66.66666667%}.col-sm-9{flex:0 0 auto;width:75%}.col-sm-10{flex:0 0 auto;width:83.33333333%}.col-sm-11{flex:0 0 auto;width:91.66666667%}.col-sm-12{flex:0 0 auto;width:100%}.offset-sm-0{margin-left:0}.offset-sm-1{margin-left:8.33333333%}.offset-sm-2{margin-left:16.66666667%}.offset-sm-3{margin-left:25%}.offset-sm-4{margin-left:33.33333333%}.offset-sm-5{margin-left:41.66666667%}.offset-sm-6{margin-left:50%}.offset-sm-7{margin-left:58.33333333%}.offset-sm-8{margin-left:66.66666667%}.offset-sm-9{margin-left:75%}.offset-sm-10{margin-left:83.33333333%}.offset-sm-11{margin-left:91.66666667%}.g-sm-0,.gx-sm-0{--bs-gutter-x:0}.g-sm-0,.gy-sm-0{--bs-gutter-y:0}.g-sm-1,.gx-sm-1{--bs-gutter-x:0.25rem}.g-sm-1,.gy-sm-1{--bs-gutter-y:0.25rem}.g-sm-2,.gx-sm-2{--bs-gutter-x:0.5rem}.g-sm-2,.gy-sm-2{--bs-gutter-y:0.5rem}.g-sm-3,.gx-sm-3{--bs-gutter-x:1rem}.g-sm-3,.gy-sm-3{--bs-gutter-y:1rem}.g-sm-4,.gx-sm-4{--bs-gutter-x:1.5rem}.g-sm-4,.gy-sm-4{--bs-gutter-y:1.5rem}.g-sm-5,.gx-sm-5{--bs-gutter-x:3rem}.g-sm-5,.gy-sm-5{--bs-gutter-y:3rem}}@media (min-width:768px){.col-md{flex:1 0 0%}.row-cols-md-auto>*{flex:0 0 auto;width:auto}.row-cols-md-1>*{flex:0 0 auto;width:100%}.row-cols-md-2>*{flex:0 0 auto;width:50%}.row-cols-md-3>*{flex:0 0 auto;width:33.3333333333%}.row-cols-md-4>*{flex:0 0 auto;width:25%}.row-cols-md-5>*{flex:0 0 auto;width:20%}.row-cols-md-6>*{flex:0 0 auto;width:16.6666666667%}.col-md-auto{flex:0 0 auto;width:auto}.col-md-1{flex:0 0 auto;width:8.33333333%}.col-md-2{flex:0 0 auto;width:16.66666667%}.col-md-3{flex:0 0 auto;width:25%}.col-md-4{flex:0 0 auto;width:33.33333333%}.col-md-5{flex:0 0 auto;width:41.66666667%}.col-md-6{flex:0 0 auto;width:50%}.col-md-7{flex:0 0 auto;width:58.33333333%}.col-md-8{flex:0 0 auto;width:66.66666667%}.col-md-9{flex:0 0 auto;width:75%}.col-md-10{flex:0 0 auto;width:83.33333333%}.col-md-11{flex:0 0 auto;width:91.66666667%}.col-md-12{flex:0 0 auto;width:100%}.offset-md-0{margin-left:0}.offset-md-1{margin-left:8.33333333%}.offset-md-2{margin-left:16.66666667%}.offset-md-3{margin-left:25%}.offset-md-4{margin-left:33.33333333%}.offset-md-5{margin-left:41.66666667%}.offset-md-6{margin-left:50%}.offset-md-7{margin-left:58.33333333%}.offset-md-8{margin-left:66.66666667%}.offset-md-9{margin-left:75%}.offset-md-10{margin-left:83.33333333%}.offset-md-11{margin-left:91.66666667%}.g-md-0,.gx-md-0{--bs-gutter-x:0}.g-md-0,.gy-md-0{--bs-gutter-y:0}.g-md-1,.gx-md-1{--bs-gutter-x:0.25rem}.g-md-1,.gy-md-1{--bs-gutter-y:0.25rem}.g-md-2,.gx-md-2{--bs-gutter-x:0.5rem}.g-md-2,.gy-md-2{--bs-gutter-y:0.5rem}.g-md-3,.gx-md-3{--bs-gutter-x:1rem}.g-md-3,.gy-md-3{--bs-gutter-y:1rem}.g-md-4,.gx-md-4{--bs-gutter-x:1.5rem}.g-md-4,.gy-md-4{--bs-gutter-y:1.5rem}.g-md-5,.gx-md-5{--bs-gutter-x:3rem}.g-md-5,.gy-md-5{--bs-gutter-y:3rem}}@media (min-width:992px){.col-lg{flex:1 0 0%}.row-cols-lg-auto>*{flex:0 0 auto;width:auto}.row-cols-lg-1>*{flex:0 0 auto;width:100%}.row-cols-lg-2>*{flex:0 0 auto;width:50%}.row-cols-lg-3>*{flex:0 0 auto;width:33.3333333333%}.row-cols-lg-4>*{flex:0 0 auto;width:25%}.row-cols-lg-5>*{flex:0 0 auto;width:20%}.row-cols-lg-6>*{flex:0 0 auto;width:16.6666666667%}.col-lg-auto{flex:0 0 auto;width:auto}.col-lg-1{flex:0 0 auto;width:8.33333333%}.col-lg-2{flex:0 0 auto;width:16.66666667%}.col-lg-3{flex:0 0 auto;width:25%}.col-lg-4{flex:0 0 auto;width:33.33333333%}.col-lg-5{flex:0 0 auto;width:41.66666667%}.col-lg-6{flex:0 0 auto;width:50%}.col-lg-7{flex:0 0 auto;width:58.33333333%}.col-lg-8{flex:0 0 auto;width:66.66666667%}.col-lg-9{flex:0 0 auto;width:75%}.col-lg-10{flex:0 0 auto;width:83.33333333%}.col-lg-11{flex:0 0 auto;width:91.66666667%}.col-lg-12{flex:0 0 auto;width:100%}.offset-lg-0{margin-left:0}.offset-lg-1{margin-left:8.33333333%}.offset-lg-2{margin-left:16.66666667%}.offset-lg-3{margin-left:25%}.offset-lg-4{margin-left:33.33333333%}.offset-lg-5{margin-left:41.66666667%}.offset-lg-6{margin-left:50%}.offset-lg-7{margin-left:58.33333333%}.offset-lg-8{margin-left:66.66666667%}.offset-lg-9{margin-left:75%}.offset-lg-10{margin-left:83.33333333%}.offset-lg-11{margin-left:91.66666667%}.g-lg-0,.gx-lg-0{--bs-gutter-x:0}.g-lg-0,.gy-lg-0{--bs-gutter-y:0}.g-lg-1,.gx-lg-1{--bs-gutter-x:0.25rem}.g-lg-1,.gy-lg-1{--bs-gutter-y:0.25rem}.g-lg-2,.gx-lg-2{--bs-gutter-x:0.5rem}.g-lg-2,.gy-lg-2{--bs-gutter-y:0.5rem}.g-lg-3,.gx-lg-3{--bs-gutter-x:1rem}.g-lg-3,.gy-lg-3{--bs-gutter-y:1rem}.g-lg-4,.gx-lg-4{--bs-gutter-x:1.5rem}.g-lg-4,.gy-lg-4{--bs-gutter-y:1.5rem}.g-lg-5,.gx-lg-5{--bs-gutter-x:3rem}.g-lg-5,.gy-lg-5{--bs-gutter-y:3rem}}@media (min-width:1200px){.col-xl{flex:1 0 0%}.row-cols-xl-auto>*{flex:0 0 auto;width:auto}.row-cols-xl-1>*{flex:0 0 auto;width:100%}.row-cols-xl-2>*{flex:0 0 auto;width:50%}.row-cols-xl-3>*{flex:0 0 auto;width:33.3333333333%}.row-cols-xl-4>*{flex:0 0 auto;width:25%}.row-cols-xl-5>*{flex:0 0 auto;width:20%}.row-cols-xl-6>*{flex:0 0 auto;width:16.6666666667%}.col-xl-auto{flex:0 0 auto;width:auto}.col-xl-1{flex:0 0 auto;width:8.33333333%}.col-xl-2{flex:0 0 auto;width:16.66666667%}.col-xl-3{flex:0 0 auto;width:25%}.col-xl-4{flex:0 0 auto;width:33.33333333%}.col-xl-5{flex:0 0 auto;width:41.66666667%}.col-xl-6{flex:0 0 auto;width:50%}.col-xl-7{flex:0 0 auto;width:58.33333333%}.col-xl-8{flex:0 0 auto;width:66.66666667%}.col-xl-9{flex:0 0 auto;width:75%}.col-xl-10{flex:0 0 auto;width:83.33333333%}.col-xl-11{flex:0 0 auto;width:91.66666667%}.col-xl-12{flex:0 0 auto;width:100%}.offset-xl-0{margin-left:0}.offset-xl-1{margin-left:8.33333333%}.offset-xl-2{margin-left:16.66666667%}.offset-xl-3{margin-left:25%}.offset-xl-4{margin-left:33.33333333%}.offset-xl-5{margin-left:41.66666667%}.offset-xl-6{margin-left:50%}.offset-xl-7{margin-left:58.33333333%}.offset-xl-8{margin-left:66.66666667%}.offset-xl-9{margin-left:75%}.offset-xl-10{margin-left:83.33333333%}.offset-xl-11{margin-left:91.66666667%}.g-xl-0,.gx-xl-0{--bs-gutter-x:0}.g-xl-0,.gy-xl-0{--bs-gutter-y:0}.g-xl-1,.gx-xl-1{--bs-gutter-x:0.25rem}.g-xl-1,.gy-xl-1{--bs-gutter-y:0.25rem}.g-xl-2,.gx-xl-2{--bs-gutter-x:0.5rem}.g-xl-2,.gy-xl-2{--bs-gutter-y:0.5rem}.g-xl-3,.gx-xl-3{--bs-gutter-x:1rem}.g-xl-3,.gy-xl-3{--bs-gutter-y:1rem}.g-xl-4,.gx-xl-4{--bs-gutter-x:1.5rem}.g-xl-4,.gy-xl-4{--bs-gutter-y:1.5rem}.g-xl-5,.gx-xl-5{--bs-gutter-x:3rem}.g-xl-5,.gy-xl-5{--bs-gutter-y:3rem}}@media (min-width:1400px){.col-xxl{flex:1 0 0%}.row-cols-xxl-auto>*{flex:0 0 auto;width:auto}.row-cols-xxl-1>*{flex:0 0 auto;width:100%}.row-cols-xxl-2>*{flex:0 0 auto;width:50%}.row-cols-xxl-3>*{flex:0 0 auto;width:33.3333333333%}.row-cols-xxl-4>*{flex:0 0 auto;width:25%}.row-cols-xxl-5>*{flex:0 0 auto;width:20%}.row-cols-xxl-6>*{flex:0 0 auto;width:16.6666666667%}.col-xxl-auto{flex:0 0 auto;width:auto}.col-xxl-1{flex:0 0 auto;width:8.33333333%}.col-xxl-2{flex:0 0 auto;width:16.66666667%}.col-xxl-3{flex:0 0 auto;width:25%}.col-xxl-4{flex:0 0 auto;width:33.33333333%}.col-xxl-5{flex:0 0 auto;width:41.66666667%}.col-xxl-6{flex:0 0 auto;width:50%}.col-xxl-7{flex:0 0 auto;width:58.33333333%}.col-xxl-8{flex:0 0 auto;width:66.66666667%}.col-xxl-9{flex:0 0 auto;width:75%}.col-xxl-10{flex:0 0 auto;width:83.33333333%}.col-xxl-11{flex:0 0 auto;width:91.66666667%}.col-xxl-12{flex:0 0 auto;width:100%}.offset-xxl-0{margin-left:0}.offset-xxl-1{margin-left:8.33333333%}.offset-xxl-2{margin-left:16.66666667%}.offset-xxl-3{margin-left:25%}.offset-xxl-4{margin-left:33.33333333%}.offset-xxl-5{margin-left:41.66666667%}.offset-xxl-6{margin-left:50%}.offset-xxl-7{margin-left:58.33333333%}.offset-xxl-8{margin-left:66.66666667%}.offset-xxl-9{margin-left:75%}.offset-xxl-10{margin-left:83.33333333%}.offset-xxl-11{margin-left:91.66666667%}.g-xxl-0,.gx-xxl-0{--bs-gutter-x:0}.g-xxl-0,.gy-xxl-0{--bs-gutter-y:0}.g-xxl-1,.gx-xxl-1{--bs-gutter-x:0.25rem}.g-xxl-1,.gy-xxl-1{--bs-gutter-y:0.25rem}.g-xxl-2,.gx-xxl-2{--bs-gutter-x:0.5rem}.g-xxl-2,.gy-xxl-2{--bs-gutter-y:0.5rem}.g-xxl-3,.gx-xxl-3{--bs-gutter-x:1rem}.g-xxl-3,.gy-xxl-3{--bs-gutter-y:1rem}.g-xxl-4,.gx-xxl-4{--bs-gutter-x:1.5rem}.g-xxl-4,.gy-xxl-4{--bs-gutter-y:1.5rem}.g-xxl-5,.gx-xxl-5{--bs-gutter-x:3rem}.g-xxl-5,.gy-xxl-5{--bs-gutter-y:3rem}}.table{--bs-table-color:var(--bs-body-color);--bs-table-bg:transparent;--bs-table-border-color:var(--bs-border-color);--bs-table-accent-bg:transparent;--bs-table-striped-color:var(--bs-body-color);--bs-table-striped-bg:rgba(0, 0, 0, 0.05);--bs-table-active-color:var(--bs-body-color);--bs-table-active-bg:rgba(0, 0, 0, 0.1);--bs-table-hover-color:var(--bs-body-color);--bs-table-hover-bg:rgba(0, 0, 0, 0.075);width:100%;margin-bottom:1rem;color:var(--bs-table-color);vertical-align:top;border-color:var(--bs-table-border-color)}.table>:not(caption)>*>*{padding:.5rem .5rem;background-color:var(--bs-table-bg);border-bottom-width:1px;box-shadow:inset 0 0 0 9999px var(--bs-table-accent-bg)}.table>tbody{vertical-align:inherit}.table>thead{vertical-align:bottom}.table-group-divider{border-top:2px solid currentcolor}.caption-top{caption-side:top}.table-sm>:not(caption)>*>*{padding:.25rem .25rem}.table-bordered>:not(caption)>*{border-width:1px 0}.table-bordered>:not(caption)>*>*{border-width:0 1px}.table-borderless>:not(caption)>*>*{border-bottom-width:0}.table-borderless>:not(:first-child){border-top-width:0}.table-striped>tbody>tr:nth-of-type(odd)>*{--bs-table-accent-bg:var(--bs-table-striped-bg);color:var(--bs-table-striped-color)}.table-striped-columns>:not(caption)>tr>:nth-child(2n){--bs-table-accent-bg:var(--bs-table-striped-bg);color:var(--bs-table-striped-color)}.table-active{--bs-table-accent-bg:var(--bs-table-active-bg);color:var(--bs-table-active-color)}.table-hover>tbody>tr:hover>*{--bs-table-accent-bg:var(--bs-table-hover-bg);color:var(--bs-table-hover-color)}.table-primary{--bs-table-color:#000;--bs-table-bg:#cfe2ff;--bs-table-border-color:#bacbe6;--bs-table-striped-bg:#c5d7f2;--bs-table-striped-color:#000;--bs-table-active-bg:#bacbe6;--bs-table-active-color:#000;--bs-table-hover-bg:#bfd1ec;--bs-table-hover-color:#000;color:var(--bs-table-color);border-color:var(--bs-table-border-color)}.table-secondary{--bs-table-color:#000;--bs-table-bg:#e2e3e5;--bs-table-border-color:#cbccce;--bs-table-striped-bg:#d7d8da;--bs-table-striped-color:#000;--bs-table-active-bg:#cbccce;--bs-table-active-color:#000;--bs-table-hover-bg:#d1d2d4;--bs-table-hover-color:#000;color:var(--bs-table-color);border-color:var(--bs-table-border-color)}.table-success{--bs-table-color:#000;--bs-table-bg:#d1e7dd;--bs-table-border-color:#bcd0c7;--bs-table-striped-bg:#c7dbd2;--bs-table-striped-color:#000;--bs-table-active-bg:#bcd0c7;--bs-table-active-color:#000;--bs-table-hover-bg:#c1d6cc;--bs-table-hover-color:#000;color:var(--bs-table-color);border-color:var(--bs-table-border-color)}.table-info{--bs-table-color:#000;--bs-table-bg:#cff4fc;--bs-table-border-color:#badce3;--bs-table-striped-bg:#c5e8ef;--bs-table-striped-color:#000;--bs-table-active-bg:#badce3;--bs-table-active-color:#000;--bs-table-hover-bg:#bfe2e9;--bs-table-hover-color:#000;color:var(--bs-table-color);border-color:var(--bs-table-border-color)}.table-warning{--bs-table-color:#000;--bs-table-bg:#fff3cd;--bs-table-border-color:#e6dbb9;--bs-table-striped-bg:#f2e7c3;--bs-table-striped-color:#000;--bs-table-active-bg:#e6dbb9;--bs-table-active-color:#000;--bs-table-hover-bg:#ece1be;--bs-table-hover-color:#000;color:var(--bs-table-color);border-color:var(--bs-table-border-color)}.table-danger{--bs-table-color:#000;--bs-table-bg:#f8d7da;--bs-table-border-color:#dfc2c4;--bs-table-striped-bg:#eccccf;--bs-table-striped-color:#000;--bs-table-active-bg:#dfc2c4;--bs-table-active-color:#000;--bs-table-hover-bg:#e5c7ca;--bs-table-hover-color:#000;color:var(--bs-table-color);border-color:var(--bs-table-border-color)}.table-light{--bs-table-color:#000;--bs-table-bg:#f8f9fa;--bs-table-border-color:#dfe0e1;--bs-table-striped-bg:#ecedee;--bs-table-striped-color:#000;--bs-table-active-bg:#dfe0e1;--bs-table-active-color:#000;--bs-table-hover-bg:#e5e6e7;--bs-table-hover-color:#000;color:var(--bs-table-color);border-color:var(--bs-table-border-color)}.table-dark{--bs-table-color:#fff;--bs-table-bg:#212529;--bs-table-border-color:#373b3e;--bs-table-striped-bg:#2c3034;--bs-table-striped-color:#fff;--bs-table-active-bg:#373b3e;--bs-table-active-color:#fff;--bs-table-hover-bg:#323539;--bs-table-hover-color:#fff;color:var(--bs-table-color);border-color:var(--bs-table-border-color)}.table-responsive{overflow-x:auto;-webkit-overflow-scrolling:touch}@media (max-width:575.98px){.table-responsive-sm{overflow-x:auto;-webkit-overflow-scrolling:touch}}@media (max-width:767.98px){.table-responsive-md{overflow-x:auto;-webkit-overflow-scrolling:touch}}@media (max-width:991.98px){.table-responsive-lg{overflow-x:auto;-webkit-overflow-scrolling:touch}}@media (max-width:1199.98px){.table-responsive-xl{overflow-x:auto;-webkit-overflow-scrolling:touch}}@media (max-width:1399.98px){.table-responsive-xxl{overflow-x:auto;-webkit-overflow-scrolling:touch}}.form-label{margin-bottom:.5rem}.col-form-label{padding-top:calc(.375rem + 1px);padding-bottom:calc(.375rem + 1px);margin-bottom:0;font-size:inherit;line-height:1.5}.col-form-label-lg{padding-top:calc(.5rem + 1px);padding-bottom:calc(.5rem + 1px);font-size:1.25rem}.col-form-label-sm{padding-top:calc(.25rem + 1px);padding-bottom:calc(.25rem + 1px);font-size:.875rem}.form-text{margin-top:.25rem;font-size:.875em;color:#6c757d}.form-control{display:block;width:100%;padding:.375rem .75rem;font-size:1rem;font-weight:400;line-height:1.5;color:#212529;background-color:#fff;background-clip:padding-box;border:1px solid #ced4da;-webkit-appearance:none;-moz-appearance:none;appearance:none;border-radius:.375rem;transition:border-color .15s ease-in-out,box-shadow .15s ease-in-out}@media (prefers-reduced-motion:reduce){.form-control{transition:none}}.form-control[type=file]{overflow:hidden}.form-control[type=file]:not(:disabled):not([readonly]){cursor:pointer}.form-control:focus{color:#212529;background-color:#fff;border-color:#86b7fe;outline:0;box-shadow:0 0 0 .25rem rgba(13,110,253,.25)}.form-control::-webkit-date-and-time-value{height:1.5em}.form-control::-moz-placeholder{color:#6c757d;opacity:1}.form-control::placeholder{color:#6c757d;opacity:1}.form-control:disabled{background-color:#e9ecef;opacity:1}.form-control::-webkit-file-upload-button{padding:.375rem .75rem;margin:-.375rem -.75rem;-webkit-margin-end:.75rem;margin-inline-end:.75rem;color:#212529;background-color:#e9ecef;pointer-events:none;border-color:inherit;border-style:solid;border-width:0;border-inline-end-width:1px;border-radius:0;-webkit-transition:color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out,box-shadow .15s ease-in-out;transition:color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out,box-shadow .15s ease-in-out}.form-control::file-selector-button{padding:.375rem .75rem;margin:-.375rem -.75rem;-webkit-margin-end:.75rem;margin-inline-end:.75rem;color:#212529;background-color:#e9ecef;pointer-events:none;border-color:inherit;border-style:solid;border-width:0;border-inline-end-width:1px;border-radius:0;transition:color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out,box-shadow .15s ease-in-out}@media (prefers-reduced-motion:reduce){.form-control::-webkit-file-upload-button{-webkit-transition:none;transition:none}.form-control::file-selector-button{transition:none}}.form-control:hover:not(:disabled):not([readonly])::-webkit-file-upload-button{background-color:#dde0e3}.form-control:hover:not(:disabled):not([readonly])::file-selector-button{background-color:#dde0e3}.form-control-plaintext{display:block;width:100%;padding:.375rem 0;margin-bottom:0;line-height:1.5;color:#212529;background-color:transparent;border:solid transparent;border-width:1px 0}.form-control-plaintext:focus{outline:0}.form-control-plaintext.form-control-lg,.form-control-plaintext.form-control-sm{padding-right:0;padding-left:0}.form-control-sm{min-height:calc(1.5em + .5rem + 2px);padding:.25rem .5rem;font-size:.875rem;border-radius:.25rem}.form-control-sm::-webkit-file-upload-button{padding:.25rem .5rem;margin:-.25rem -.5rem;-webkit-margin-end:.5rem;margin-inline-end:.5rem}.form-control-sm::file-selector-button{padding:.25rem .5rem;margin:-.25rem -.5rem;-webkit-margin-end:.5rem;margin-inline-end:.5rem}.form-control-lg{min-height:calc(1.5em + 1rem + 2px);padding:.5rem 1rem;font-size:1.25rem;border-radius:.5rem}.form-control-lg::-webkit-file-upload-button{padding:.5rem 1rem;margin:-.5rem -1rem;-webkit-margin-end:1rem;margin-inline-end:1rem}.form-control-lg::file-selector-button{padding:.5rem 1rem;margin:-.5rem -1rem;-webkit-margin-end:1rem;margin-inline-end:1rem}textarea.form-control{min-height:calc(1.5em + .75rem + 2px)}textarea.form-control-sm{min-height:calc(1.5em + .5rem + 2px)}textarea.form-control-lg{min-height:calc(1.5em + 1rem + 2px)}.form-control-color{width:3rem;height:calc(1.5em + .75rem + 2px);padding:.375rem}.form-control-color:not(:disabled):not([readonly]){cursor:pointer}.form-control-color::-moz-color-swatch{border:0!important;border-radius:.375rem}.form-control-color::-webkit-color-swatch{border-radius:.375rem}.form-control-color.form-control-sm{height:calc(1.5em + .5rem + 2px)}.form-control-color.form-control-lg{height:calc(1.5em + 1rem + 2px)}.form-select{display:block;width:100%;padding:.375rem 2.25rem .375rem .75rem;-moz-padding-start:calc(0.75rem - 3px);font-size:1rem;font-weight:400;line-height:1.5;color:#212529;background-color:#fff;background-image:url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23343a40' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 5 6 6 6-6'/%3e%3c/svg%3e\");background-repeat:no-repeat;background-position:right .75rem center;background-size:16px 12px;border:1px solid #ced4da;border-radius:.375rem;transition:border-color .15s ease-in-out,box-shadow .15s ease-in-out;-webkit-appearance:none;-moz-appearance:none;appearance:none}@media (prefers-reduced-motion:reduce){.form-select{transition:none}}.form-select:focus{border-color:#86b7fe;outline:0;box-shadow:0 0 0 .25rem rgba(13,110,253,.25)}.form-select[multiple],.form-select[size]:not([size=\"1\"]){padding-right:.75rem;background-image:none}.form-select:disabled{background-color:#e9ecef}.form-select:-moz-focusring{color:transparent;text-shadow:0 0 0 #212529}.form-select-sm{padding-top:.25rem;padding-bottom:.25rem;padding-left:.5rem;font-size:.875rem;border-radius:.25rem}.form-select-lg{padding-top:.5rem;padding-bottom:.5rem;padding-left:1rem;font-size:1.25rem;border-radius:.5rem}.form-check{display:block;min-height:1.5rem;padding-left:1.5em;margin-bottom:.125rem}.form-check .form-check-input{float:left;margin-left:-1.5em}.form-check-reverse{padding-right:1.5em;padding-left:0;text-align:right}.form-check-reverse .form-check-input{float:right;margin-right:-1.5em;margin-left:0}.form-check-input{width:1em;height:1em;margin-top:.25em;vertical-align:top;background-color:#fff;background-repeat:no-repeat;background-position:center;background-size:contain;border:1px solid rgba(0,0,0,.25);-webkit-appearance:none;-moz-appearance:none;appearance:none;-webkit-print-color-adjust:exact;color-adjust:exact;print-color-adjust:exact}.form-check-input[type=checkbox]{border-radius:.25em}.form-check-input[type=radio]{border-radius:50%}.form-check-input:active{filter:brightness(90%)}.form-check-input:focus{border-color:#86b7fe;outline:0;box-shadow:0 0 0 .25rem rgba(13,110,253,.25)}.form-check-input:checked{background-color:#0d6efd;border-color:#0d6efd}.form-check-input:checked[type=checkbox]{background-image:url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3e%3cpath fill='none' stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='m6 10 3 3 6-6'/%3e%3c/svg%3e\")}.form-check-input:checked[type=radio]{background-image:url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='2' fill='%23fff'/%3e%3c/svg%3e\")}.form-check-input[type=checkbox]:indeterminate{background-color:#0d6efd;border-color:#0d6efd;background-image:url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3e%3cpath fill='none' stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='M6 10h8'/%3e%3c/svg%3e\")}.form-check-input:disabled{pointer-events:none;filter:none;opacity:.5}.form-check-input:disabled~.form-check-label,.form-check-input[disabled]~.form-check-label{cursor:default;opacity:.5}.form-switch{padding-left:2.5em}.form-switch .form-check-input{width:2em;margin-left:-2.5em;background-image:url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='rgba%280, 0, 0, 0.25%29'/%3e%3c/svg%3e\");background-position:left center;border-radius:2em;transition:background-position .15s ease-in-out}@media (prefers-reduced-motion:reduce){.form-switch .form-check-input{transition:none}}.form-switch .form-check-input:focus{background-image:url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%2386b7fe'/%3e%3c/svg%3e\")}.form-switch .form-check-input:checked{background-position:right center;background-image:url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23fff'/%3e%3c/svg%3e\")}.form-switch.form-check-reverse{padding-right:2.5em;padding-left:0}.form-switch.form-check-reverse .form-check-input{margin-right:-2.5em;margin-left:0}.form-check-inline{display:inline-block;margin-right:1rem}.btn-check{position:absolute;clip:rect(0,0,0,0);pointer-events:none}.btn-check:disabled+.btn,.btn-check[disabled]+.btn{pointer-events:none;filter:none;opacity:.65}.form-range{width:100%;height:1.5rem;padding:0;background-color:transparent;-webkit-appearance:none;-moz-appearance:none;appearance:none}.form-range:focus{outline:0}.form-range:focus::-webkit-slider-thumb{box-shadow:0 0 0 1px #fff,0 0 0 .25rem rgba(13,110,253,.25)}.form-range:focus::-moz-range-thumb{box-shadow:0 0 0 1px #fff,0 0 0 .25rem rgba(13,110,253,.25)}.form-range::-moz-focus-outer{border:0}.form-range::-webkit-slider-thumb{width:1rem;height:1rem;margin-top:-.25rem;background-color:#0d6efd;border:0;border-radius:1rem;-webkit-transition:background-color .15s ease-in-out,border-color .15s ease-in-out,box-shadow .15s ease-in-out;transition:background-color .15s ease-in-out,border-color .15s ease-in-out,box-shadow .15s ease-in-out;-webkit-appearance:none;appearance:none}@media (prefers-reduced-motion:reduce){.form-range::-webkit-slider-thumb{-webkit-transition:none;transition:none}}.form-range::-webkit-slider-thumb:active{background-color:#b6d4fe}.form-range::-webkit-slider-runnable-track{width:100%;height:.5rem;color:transparent;cursor:pointer;background-color:#dee2e6;border-color:transparent;border-radius:1rem}.form-range::-moz-range-thumb{width:1rem;height:1rem;background-color:#0d6efd;border:0;border-radius:1rem;-moz-transition:background-color .15s ease-in-out,border-color .15s ease-in-out,box-shadow .15s ease-in-out;transition:background-color .15s ease-in-out,border-color .15s ease-in-out,box-shadow .15s ease-in-out;-moz-appearance:none;appearance:none}@media (prefers-reduced-motion:reduce){.form-range::-moz-range-thumb{-moz-transition:none;transition:none}}.form-range::-moz-range-thumb:active{background-color:#b6d4fe}.form-range::-moz-range-track{width:100%;height:.5rem;color:transparent;cursor:pointer;background-color:#dee2e6;border-color:transparent;border-radius:1rem}.form-range:disabled{pointer-events:none}.form-range:disabled::-webkit-slider-thumb{background-color:#adb5bd}.form-range:disabled::-moz-range-thumb{background-color:#adb5bd}.form-floating{position:relative}.form-floating>.form-control,.form-floating>.form-control-plaintext,.form-floating>.form-select{height:calc(3.5rem + 2px);line-height:1.25}.form-floating>label{position:absolute;top:0;left:0;width:100%;height:100%;padding:1rem .75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none;border:1px solid transparent;transform-origin:0 0;transition:opacity .1s ease-in-out,transform .1s ease-in-out}@media (prefers-reduced-motion:reduce){.form-floating>label{transition:none}}.form-floating>.form-control,.form-floating>.form-control-plaintext{padding:1rem .75rem}.form-floating>.form-control-plaintext::-moz-placeholder,.form-floating>.form-control::-moz-placeholder{color:transparent}.form-floating>.form-control-plaintext::placeholder,.form-floating>.form-control::placeholder{color:transparent}.form-floating>.form-control-plaintext:not(:-moz-placeholder-shown),.form-floating>.form-control:not(:-moz-placeholder-shown){padding-top:1.625rem;padding-bottom:.625rem}.form-floating>.form-control-plaintext:focus,.form-floating>.form-control-plaintext:not(:placeholder-shown),.form-floating>.form-control:focus,.form-floating>.form-control:not(:placeholder-shown){padding-top:1.625rem;padding-bottom:.625rem}.form-floating>.form-control-plaintext:-webkit-autofill,.form-floating>.form-control:-webkit-autofill{padding-top:1.625rem;padding-bottom:.625rem}.form-floating>.form-select{padding-top:1.625rem;padding-bottom:.625rem}.form-floating>.form-control:not(:-moz-placeholder-shown)~label{opacity:.65;transform:scale(.85) translateY(-.5rem) translateX(.15rem)}.form-floating>.form-control-plaintext~label,.form-floating>.form-control:focus~label,.form-floating>.form-control:not(:placeholder-shown)~label,.form-floating>.form-select~label{opacity:.65;transform:scale(.85) translateY(-.5rem) translateX(.15rem)}.form-floating>.form-control:-webkit-autofill~label{opacity:.65;transform:scale(.85) translateY(-.5rem) translateX(.15rem)}.form-floating>.form-control-plaintext~label{border-width:1px 0}.input-group{position:relative;display:flex;flex-wrap:wrap;align-items:stretch;width:100%}.input-group>.form-control,.input-group>.form-floating,.input-group>.form-select{position:relative;flex:1 1 auto;width:1%;min-width:0}.input-group>.form-control:focus,.input-group>.form-floating:focus-within,.input-group>.form-select:focus{z-index:3}.input-group .btn{position:relative;z-index:2}.input-group .btn:focus{z-index:3}.input-group-text{display:flex;align-items:center;padding:.375rem .75rem;font-size:1rem;font-weight:400;line-height:1.5;color:#212529;text-align:center;white-space:nowrap;background-color:#e9ecef;border:1px solid #ced4da;border-radius:.375rem}.input-group-lg>.btn,.input-group-lg>.form-control,.input-group-lg>.form-select,.input-group-lg>.input-group-text{padding:.5rem 1rem;font-size:1.25rem;border-radius:.5rem}.input-group-sm>.btn,.input-group-sm>.form-control,.input-group-sm>.form-select,.input-group-sm>.input-group-text{padding:.25rem .5rem;font-size:.875rem;border-radius:.25rem}.input-group-lg>.form-select,.input-group-sm>.form-select{padding-right:3rem}.input-group:not(.has-validation)>.dropdown-toggle:nth-last-child(n+3),.input-group:not(.has-validation)>.form-floating:not(:last-child)>.form-control,.input-group:not(.has-validation)>.form-floating:not(:last-child)>.form-select,.input-group:not(.has-validation)>:not(:last-child):not(.dropdown-toggle):not(.dropdown-menu):not(.form-floating){border-top-right-radius:0;border-bottom-right-radius:0}.input-group.has-validation>.dropdown-toggle:nth-last-child(n+4),.input-group.has-validation>.form-floating:nth-last-child(n+3)>.form-control,.input-group.has-validation>.form-floating:nth-last-child(n+3)>.form-select,.input-group.has-validation>:nth-last-child(n+3):not(.dropdown-toggle):not(.dropdown-menu):not(.form-floating){border-top-right-radius:0;border-bottom-right-radius:0}.input-group>.form-floating:not(:first-child)>.form-control,.input-group>.form-floating:not(:first-child)>.form-select,.input-group>:not(:first-child):not(.dropdown-menu):not(.form-floating):not(.valid-tooltip):not(.valid-feedback):not(.invalid-tooltip):not(.invalid-feedback){margin-left:-1px;border-top-left-radius:0;border-bottom-left-radius:0}.valid-feedback{display:none;width:100%;margin-top:.25rem;font-size:.875em;color:#198754}.valid-tooltip{position:absolute;top:100%;z-index:5;display:none;max-width:100%;padding:.25rem .5rem;margin-top:.1rem;font-size:.875rem;color:#fff;background-color:rgba(25,135,84,.9);border-radius:.375rem}.is-valid~.valid-feedback,.is-valid~.valid-tooltip,.was-validated :valid~.valid-feedback,.was-validated :valid~.valid-tooltip{display:block}.form-control.is-valid,.was-validated .form-control:valid{border-color:#198754;padding-right:calc(1.5em + .75rem);background-image:url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3e%3cpath fill='%23198754' d='M2.3 6.73.6 4.53c-.4-1.04.46-1.4 1.1-.8l1.1 1.4 3.4-3.8c.6-.63 1.6-.27 1.2.7l-4 4.6c-.43.5-.8.4-1.1.1z'/%3e%3c/svg%3e\");background-repeat:no-repeat;background-position:right calc(.375em + .1875rem) center;background-size:calc(.75em + .375rem) calc(.75em + .375rem)}.form-control.is-valid:focus,.was-validated .form-control:valid:focus{border-color:#198754;box-shadow:0 0 0 .25rem rgba(25,135,84,.25)}.was-validated textarea.form-control:valid,textarea.form-control.is-valid{padding-right:calc(1.5em + .75rem);background-position:top calc(.375em + .1875rem) right calc(.375em + .1875rem)}.form-select.is-valid,.was-validated .form-select:valid{border-color:#198754}.form-select.is-valid:not([multiple]):not([size]),.form-select.is-valid:not([multiple])[size=\"1\"],.was-validated .form-select:valid:not([multiple]):not([size]),.was-validated .form-select:valid:not([multiple])[size=\"1\"]{padding-right:4.125rem;background-image:url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23343a40' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 5 6 6 6-6'/%3e%3c/svg%3e\"),url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3e%3cpath fill='%23198754' d='M2.3 6.73.6 4.53c-.4-1.04.46-1.4 1.1-.8l1.1 1.4 3.4-3.8c.6-.63 1.6-.27 1.2.7l-4 4.6c-.43.5-.8.4-1.1.1z'/%3e%3c/svg%3e\");background-position:right .75rem center,center right 2.25rem;background-size:16px 12px,calc(.75em + .375rem) calc(.75em + .375rem)}.form-select.is-valid:focus,.was-validated .form-select:valid:focus{border-color:#198754;box-shadow:0 0 0 .25rem rgba(25,135,84,.25)}.form-control-color.is-valid,.was-validated .form-control-color:valid{width:calc(3rem + calc(1.5em + .75rem))}.form-check-input.is-valid,.was-validated .form-check-input:valid{border-color:#198754}.form-check-input.is-valid:checked,.was-validated .form-check-input:valid:checked{background-color:#198754}.form-check-input.is-valid:focus,.was-validated .form-check-input:valid:focus{box-shadow:0 0 0 .25rem rgba(25,135,84,.25)}.form-check-input.is-valid~.form-check-label,.was-validated .form-check-input:valid~.form-check-label{color:#198754}.form-check-inline .form-check-input~.valid-feedback{margin-left:.5em}.input-group .form-control.is-valid,.input-group .form-select.is-valid,.was-validated .input-group .form-control:valid,.was-validated .input-group .form-select:valid{z-index:1}.input-group .form-control.is-valid:focus,.input-group .form-select.is-valid:focus,.was-validated .input-group .form-control:valid:focus,.was-validated .input-group .form-select:valid:focus{z-index:3}.invalid-feedback{display:none;width:100%;margin-top:.25rem;font-size:.875em;color:#dc3545}.invalid-tooltip{position:absolute;top:100%;z-index:5;display:none;max-width:100%;padding:.25rem .5rem;margin-top:.1rem;font-size:.875rem;color:#fff;background-color:rgba(220,53,69,.9);border-radius:.375rem}.is-invalid~.invalid-feedback,.is-invalid~.invalid-tooltip,.was-validated :invalid~.invalid-feedback,.was-validated :invalid~.invalid-tooltip{display:block}.form-control.is-invalid,.was-validated .form-control:invalid{border-color:#dc3545;padding-right:calc(1.5em + .75rem);background-image:url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' width='12' height='12' fill='none' stroke='%23dc3545'%3e%3ccircle cx='6' cy='6' r='4.5'/%3e%3cpath stroke-linejoin='round' d='M5.8 3.6h.4L6 6.5z'/%3e%3ccircle cx='6' cy='8.2' r='.6' fill='%23dc3545' stroke='none'/%3e%3c/svg%3e\");background-repeat:no-repeat;background-position:right calc(.375em + .1875rem) center;background-size:calc(.75em + .375rem) calc(.75em + .375rem)}.form-control.is-invalid:focus,.was-validated .form-control:invalid:focus{border-color:#dc3545;box-shadow:0 0 0 .25rem rgba(220,53,69,.25)}.was-validated textarea.form-control:invalid,textarea.form-control.is-invalid{padding-right:calc(1.5em + .75rem);background-position:top calc(.375em + .1875rem) right calc(.375em + .1875rem)}.form-select.is-invalid,.was-validated .form-select:invalid{border-color:#dc3545}.form-select.is-invalid:not([multiple]):not([size]),.form-select.is-invalid:not([multiple])[size=\"1\"],.was-validated .form-select:invalid:not([multiple]):not([size]),.was-validated .form-select:invalid:not([multiple])[size=\"1\"]{padding-right:4.125rem;background-image:url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23343a40' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 5 6 6 6-6'/%3e%3c/svg%3e\"),url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' width='12' height='12' fill='none' stroke='%23dc3545'%3e%3ccircle cx='6' cy='6' r='4.5'/%3e%3cpath stroke-linejoin='round' d='M5.8 3.6h.4L6 6.5z'/%3e%3ccircle cx='6' cy='8.2' r='.6' fill='%23dc3545' stroke='none'/%3e%3c/svg%3e\");background-position:right .75rem center,center right 2.25rem;background-size:16px 12px,calc(.75em + .375rem) calc(.75em + .375rem)}.form-select.is-invalid:focus,.was-validated .form-select:invalid:focus{border-color:#dc3545;box-shadow:0 0 0 .25rem rgba(220,53,69,.25)}.form-control-color.is-invalid,.was-validated .form-control-color:invalid{width:calc(3rem + calc(1.5em + .75rem))}.form-check-input.is-invalid,.was-validated .form-check-input:invalid{border-color:#dc3545}.form-check-input.is-invalid:checked,.was-validated .form-check-input:invalid:checked{background-color:#dc3545}.form-check-input.is-invalid:focus,.was-validated .form-check-input:invalid:focus{box-shadow:0 0 0 .25rem rgba(220,53,69,.25)}.form-check-input.is-invalid~.form-check-label,.was-validated .form-check-input:invalid~.form-check-label{color:#dc3545}.form-check-inline .form-check-input~.invalid-feedback{margin-left:.5em}.input-group .form-control.is-invalid,.input-group .form-select.is-invalid,.was-validated .input-group .form-control:invalid,.was-validated .input-group .form-select:invalid{z-index:2}.input-group .form-control.is-invalid:focus,.input-group .form-select.is-invalid:focus,.was-validated .input-group .form-control:invalid:focus,.was-validated .input-group .form-select:invalid:focus{z-index:3}.btn{--bs-btn-padding-x:0.75rem;--bs-btn-padding-y:0.375rem;--bs-btn-font-family: ;--bs-btn-font-size:1rem;--bs-btn-font-weight:400;--bs-btn-line-height:1.5;--bs-btn-color:#212529;--bs-btn-bg:transparent;--bs-btn-border-width:1px;--bs-btn-border-color:transparent;--bs-btn-border-radius:0.375rem;--bs-btn-box-shadow:inset 0 1px 0 rgba(255, 255, 255, 0.15),0 1px 1px rgba(0, 0, 0, 0.075);--bs-btn-disabled-opacity:0.65;--bs-btn-focus-box-shadow:0 0 0 0.25rem rgba(var(--bs-btn-focus-shadow-rgb), .5);display:inline-block;padding:var(--bs-btn-padding-y) var(--bs-btn-padding-x);font-family:var(--bs-btn-font-family);font-size:var(--bs-btn-font-size);font-weight:var(--bs-btn-font-weight);line-height:var(--bs-btn-line-height);color:var(--bs-btn-color);text-align:center;text-decoration:none;vertical-align:middle;cursor:pointer;-webkit-user-select:none;-moz-user-select:none;user-select:none;border:var(--bs-btn-border-width) solid var(--bs-btn-border-color);border-radius:var(--bs-btn-border-radius);background-color:var(--bs-btn-bg);transition:color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out,box-shadow .15s ease-in-out}@media (prefers-reduced-motion:reduce){.btn{transition:none}}.btn:hover{color:var(--bs-btn-hover-color);background-color:var(--bs-btn-hover-bg);border-color:var(--bs-btn-hover-border-color)}.btn-check:focus+.btn,.btn:focus{color:var(--bs-btn-hover-color);background-color:var(--bs-btn-hover-bg);border-color:var(--bs-btn-hover-border-color);outline:0;box-shadow:var(--bs-btn-focus-box-shadow)}.btn-check:active+.btn,.btn-check:checked+.btn,.btn.active,.btn.show,.btn:active{color:var(--bs-btn-active-color);background-color:var(--bs-btn-active-bg);border-color:var(--bs-btn-active-border-color)}.btn-check:active+.btn:focus,.btn-check:checked+.btn:focus,.btn.active:focus,.btn.show:focus,.btn:active:focus{box-shadow:var(--bs-btn-focus-box-shadow)}.btn.disabled,.btn:disabled,fieldset:disabled .btn{color:var(--bs-btn-disabled-color);pointer-events:none;background-color:var(--bs-btn-disabled-bg);border-color:var(--bs-btn-disabled-border-color);opacity:var(--bs-btn-disabled-opacity)}.btn-primary{--bs-btn-color:#fff;--bs-btn-bg:#0d6efd;--bs-btn-border-color:#0d6efd;--bs-btn-hover-color:#fff;--bs-btn-hover-bg:#0b5ed7;--bs-btn-hover-border-color:#0a58ca;--bs-btn-focus-shadow-rgb:49,132,253;--bs-btn-active-color:#fff;--bs-btn-active-bg:#0a58ca;--bs-btn-active-border-color:#0a53be;--bs-btn-active-shadow:inset 0 3px 5px rgba(0, 0, 0, 0.125);--bs-btn-disabled-color:#fff;--bs-btn-disabled-bg:#0d6efd;--bs-btn-disabled-border-color:#0d6efd}.btn-secondary{--bs-btn-color:#fff;--bs-btn-bg:#6c757d;--bs-btn-border-color:#6c757d;--bs-btn-hover-color:#fff;--bs-btn-hover-bg:#5c636a;--bs-btn-hover-border-color:#565e64;--bs-btn-focus-shadow-rgb:130,138,145;--bs-btn-active-color:#fff;--bs-btn-active-bg:#565e64;--bs-btn-active-border-color:#51585e;--bs-btn-active-shadow:inset 0 3px 5px rgba(0, 0, 0, 0.125);--bs-btn-disabled-color:#fff;--bs-btn-disabled-bg:#6c757d;--bs-btn-disabled-border-color:#6c757d}.btn-success{--bs-btn-color:#fff;--bs-btn-bg:#198754;--bs-btn-border-color:#198754;--bs-btn-hover-color:#fff;--bs-btn-hover-bg:#157347;--bs-btn-hover-border-color:#146c43;--bs-btn-focus-shadow-rgb:60,153,110;--bs-btn-active-color:#fff;--bs-btn-active-bg:#146c43;--bs-btn-active-border-color:#13653f;--bs-btn-active-shadow:inset 0 3px 5px rgba(0, 0, 0, 0.125);--bs-btn-disabled-color:#fff;--bs-btn-disabled-bg:#198754;--bs-btn-disabled-border-color:#198754}.btn-info{--bs-btn-color:#000;--bs-btn-bg:#0dcaf0;--bs-btn-border-color:#0dcaf0;--bs-btn-hover-color:#000;--bs-btn-hover-bg:#31d2f2;--bs-btn-hover-border-color:#25cff2;--bs-btn-focus-shadow-rgb:11,172,204;--bs-btn-active-color:#000;--bs-btn-active-bg:#3dd5f3;--bs-btn-active-border-color:#25cff2;--bs-btn-active-shadow:inset 0 3px 5px rgba(0, 0, 0, 0.125);--bs-btn-disabled-color:#000;--bs-btn-disabled-bg:#0dcaf0;--bs-btn-disabled-border-color:#0dcaf0}.btn-warning{--bs-btn-color:#000;--bs-btn-bg:#ffc107;--bs-btn-border-color:#ffc107;--bs-btn-hover-color:#000;--bs-btn-hover-bg:#ffca2c;--bs-btn-hover-border-color:#ffc720;--bs-btn-focus-shadow-rgb:217,164,6;--bs-btn-active-color:#000;--bs-btn-active-bg:#ffcd39;--bs-btn-active-border-color:#ffc720;--bs-btn-active-shadow:inset 0 3px 5px rgba(0, 0, 0, 0.125);--bs-btn-disabled-color:#000;--bs-btn-disabled-bg:#ffc107;--bs-btn-disabled-border-color:#ffc107}.btn-danger{--bs-btn-color:#fff;--bs-btn-bg:#dc3545;--bs-btn-border-color:#dc3545;--bs-btn-hover-color:#fff;--bs-btn-hover-bg:#bb2d3b;--bs-btn-hover-border-color:#b02a37;--bs-btn-focus-shadow-rgb:225,83,97;--bs-btn-active-color:#fff;--bs-btn-active-bg:#b02a37;--bs-btn-active-border-color:#a52834;--bs-btn-active-shadow:inset 0 3px 5px rgba(0, 0, 0, 0.125);--bs-btn-disabled-color:#fff;--bs-btn-disabled-bg:#dc3545;--bs-btn-disabled-border-color:#dc3545}.btn-light{--bs-btn-color:#000;--bs-btn-bg:#f8f9fa;--bs-btn-border-color:#f8f9fa;--bs-btn-hover-color:#000;--bs-btn-hover-bg:#d3d4d5;--bs-btn-hover-border-color:#c6c7c8;--bs-btn-focus-shadow-rgb:211,212,213;--bs-btn-active-color:#000;--bs-btn-active-bg:#c6c7c8;--bs-btn-active-border-color:#babbbc;--bs-btn-active-shadow:inset 0 3px 5px rgba(0, 0, 0, 0.125);--bs-btn-disabled-color:#000;--bs-btn-disabled-bg:#f8f9fa;--bs-btn-disabled-border-color:#f8f9fa}.btn-dark{--bs-btn-color:#fff;--bs-btn-bg:#212529;--bs-btn-border-color:#212529;--bs-btn-hover-color:#fff;--bs-btn-hover-bg:#424649;--bs-btn-hover-border-color:#373b3e;--bs-btn-focus-shadow-rgb:66,70,73;--bs-btn-active-color:#fff;--bs-btn-active-bg:#4d5154;--bs-btn-active-border-color:#373b3e;--bs-btn-active-shadow:inset 0 3px 5px rgba(0, 0, 0, 0.125);--bs-btn-disabled-color:#fff;--bs-btn-disabled-bg:#212529;--bs-btn-disabled-border-color:#212529}.btn-outline-primary{--bs-btn-color:#0d6efd;--bs-btn-border-color:#0d6efd;--bs-btn-hover-color:#fff;--bs-btn-hover-bg:#0d6efd;--bs-btn-hover-border-color:#0d6efd;--bs-btn-focus-shadow-rgb:13,110,253;--bs-btn-active-color:#fff;--bs-btn-active-bg:#0d6efd;--bs-btn-active-border-color:#0d6efd;--bs-btn-active-shadow:inset 0 3px 5px rgba(0, 0, 0, 0.125);--bs-btn-disabled-color:#0d6efd;--bs-btn-disabled-bg:transparent;--bs-btn-disabled-border-color:#0d6efd;--bs-gradient:none}.btn-outline-secondary{--bs-btn-color:#6c757d;--bs-btn-border-color:#6c757d;--bs-btn-hover-color:#fff;--bs-btn-hover-bg:#6c757d;--bs-btn-hover-border-color:#6c757d;--bs-btn-focus-shadow-rgb:108,117,125;--bs-btn-active-color:#fff;--bs-btn-active-bg:#6c757d;--bs-btn-active-border-color:#6c757d;--bs-btn-active-shadow:inset 0 3px 5px rgba(0, 0, 0, 0.125);--bs-btn-disabled-color:#6c757d;--bs-btn-disabled-bg:transparent;--bs-btn-disabled-border-color:#6c757d;--bs-gradient:none}.btn-outline-success{--bs-btn-color:#198754;--bs-btn-border-color:#198754;--bs-btn-hover-color:#fff;--bs-btn-hover-bg:#198754;--bs-btn-hover-border-color:#198754;--bs-btn-focus-shadow-rgb:25,135,84;--bs-btn-active-color:#fff;--bs-btn-active-bg:#198754;--bs-btn-active-border-color:#198754;--bs-btn-active-shadow:inset 0 3px 5px rgba(0, 0, 0, 0.125);--bs-btn-disabled-color:#198754;--bs-btn-disabled-bg:transparent;--bs-btn-disabled-border-color:#198754;--bs-gradient:none}.btn-outline-info{--bs-btn-color:#0dcaf0;--bs-btn-border-color:#0dcaf0;--bs-btn-hover-color:#000;--bs-btn-hover-bg:#0dcaf0;--bs-btn-hover-border-color:#0dcaf0;--bs-btn-focus-shadow-rgb:13,202,240;--bs-btn-active-color:#000;--bs-btn-active-bg:#0dcaf0;--bs-btn-active-border-color:#0dcaf0;--bs-btn-active-shadow:inset 0 3px 5px rgba(0, 0, 0, 0.125);--bs-btn-disabled-color:#0dcaf0;--bs-btn-disabled-bg:transparent;--bs-btn-disabled-border-color:#0dcaf0;--bs-gradient:none}.btn-outline-warning{--bs-btn-color:#ffc107;--bs-btn-border-color:#ffc107;--bs-btn-hover-color:#000;--bs-btn-hover-bg:#ffc107;--bs-btn-hover-border-color:#ffc107;--bs-btn-focus-shadow-rgb:255,193,7;--bs-btn-active-color:#000;--bs-btn-active-bg:#ffc107;--bs-btn-active-border-color:#ffc107;--bs-btn-active-shadow:inset 0 3px 5px rgba(0, 0, 0, 0.125);--bs-btn-disabled-color:#ffc107;--bs-btn-disabled-bg:transparent;--bs-btn-disabled-border-color:#ffc107;--bs-gradient:none}.btn-outline-danger{--bs-btn-color:#dc3545;--bs-btn-border-color:#dc3545;--bs-btn-hover-color:#fff;--bs-btn-hover-bg:#dc3545;--bs-btn-hover-border-color:#dc3545;--bs-btn-focus-shadow-rgb:220,53,69;--bs-btn-active-color:#fff;--bs-btn-active-bg:#dc3545;--bs-btn-active-border-color:#dc3545;--bs-btn-active-shadow:inset 0 3px 5px rgba(0, 0, 0, 0.125);--bs-btn-disabled-color:#dc3545;--bs-btn-disabled-bg:transparent;--bs-btn-disabled-border-color:#dc3545;--bs-gradient:none}.btn-outline-light{--bs-btn-color:#f8f9fa;--bs-btn-border-color:#f8f9fa;--bs-btn-hover-color:#000;--bs-btn-hover-bg:#f8f9fa;--bs-btn-hover-border-color:#f8f9fa;--bs-btn-focus-shadow-rgb:248,249,250;--bs-btn-active-color:#000;--bs-btn-active-bg:#f8f9fa;--bs-btn-active-border-color:#f8f9fa;--bs-btn-active-shadow:inset 0 3px 5px rgba(0, 0, 0, 0.125);--bs-btn-disabled-color:#f8f9fa;--bs-btn-disabled-bg:transparent;--bs-btn-disabled-border-color:#f8f9fa;--bs-gradient:none}.btn-outline-dark{--bs-btn-color:#212529;--bs-btn-border-color:#212529;--bs-btn-hover-color:#fff;--bs-btn-hover-bg:#212529;--bs-btn-hover-border-color:#212529;--bs-btn-focus-shadow-rgb:33,37,41;--bs-btn-active-color:#fff;--bs-btn-active-bg:#212529;--bs-btn-active-border-color:#212529;--bs-btn-active-shadow:inset 0 3px 5px rgba(0, 0, 0, 0.125);--bs-btn-disabled-color:#212529;--bs-btn-disabled-bg:transparent;--bs-btn-disabled-border-color:#212529;--bs-gradient:none}.btn-link{--bs-btn-font-weight:400;--bs-btn-color:var(--bs-link-color);--bs-btn-bg:transparent;--bs-btn-border-color:transparent;--bs-btn-hover-color:var(--bs-link-hover-color);--bs-btn-hover-border-color:transparent;--bs-btn-active-color:var(--bs-link-hover-color);--bs-btn-active-border-color:transparent;--bs-btn-disabled-color:#6c757d;--bs-btn-disabled-border-color:transparent;--bs-btn-box-shadow:none;--bs-btn-focus-shadow-rgb:49,132,253;text-decoration:underline}.btn-link:focus{color:var(--bs-btn-color)}.btn-link:hover{color:var(--bs-btn-hover-color)}.btn-group-lg>.btn,.btn-lg{--bs-btn-padding-y:0.5rem;--bs-btn-padding-x:1rem;--bs-btn-font-size:1.25rem;--bs-btn-border-radius:0.5rem}.btn-group-sm>.btn,.btn-sm{--bs-btn-padding-y:0.25rem;--bs-btn-padding-x:0.5rem;--bs-btn-font-size:0.875rem;--bs-btn-border-radius:0.25rem}.fade{transition:opacity .15s linear}@media (prefers-reduced-motion:reduce){.fade{transition:none}}.fade:not(.show){opacity:0}.collapse:not(.show){display:none}.collapsing{height:0;overflow:hidden;transition:height .35s ease}@media (prefers-reduced-motion:reduce){.collapsing{transition:none}}.collapsing.collapse-horizontal{width:0;height:auto;transition:width .35s ease}@media (prefers-reduced-motion:reduce){.collapsing.collapse-horizontal{transition:none}}.dropdown,.dropdown-center,.dropend,.dropstart,.dropup,.dropup-center{position:relative}.dropdown-toggle{white-space:nowrap}.dropdown-toggle::after{display:inline-block;margin-left:.255em;vertical-align:.255em;content:\"\";border-top:.3em solid;border-right:.3em solid transparent;border-bottom:0;border-left:.3em solid transparent}.dropdown-toggle:empty::after{margin-left:0}.dropdown-menu{--bs-dropdown-min-width:10rem;--bs-dropdown-padding-x:0;--bs-dropdown-padding-y:0.5rem;--bs-dropdown-spacer:0.125rem;--bs-dropdown-font-size:1rem;--bs-dropdown-color:#212529;--bs-dropdown-bg:#fff;--bs-dropdown-border-color:var(--bs-border-color-translucent);--bs-dropdown-border-radius:0.375rem;--bs-dropdown-border-width:1px;--bs-dropdown-inner-border-radius:calc(0.375rem - 1px);--bs-dropdown-divider-bg:var(--bs-border-color-translucent);--bs-dropdown-divider-margin-y:0.5rem;--bs-dropdown-box-shadow:0 0.5rem 1rem rgba(0, 0, 0, 0.15);--bs-dropdown-link-color:#212529;--bs-dropdown-link-hover-color:#1e2125;--bs-dropdown-link-hover-bg:#e9ecef;--bs-dropdown-link-active-color:#fff;--bs-dropdown-link-active-bg:#0d6efd;--bs-dropdown-link-disabled-color:#adb5bd;--bs-dropdown-item-padding-x:1rem;--bs-dropdown-item-padding-y:0.25rem;--bs-dropdown-header-color:#6c757d;--bs-dropdown-header-padding-x:1rem;--bs-dropdown-header-padding-y:0.5rem;position:absolute;z-index:1000;display:none;min-width:var(--bs-dropdown-min-width);padding:var(--bs-dropdown-padding-y) var(--bs-dropdown-padding-x);margin:0;font-size:var(--bs-dropdown-font-size);color:var(--bs-dropdown-color);text-align:left;list-style:none;background-color:var(--bs-dropdown-bg);background-clip:padding-box;border:var(--bs-dropdown-border-width) solid var(--bs-dropdown-border-color);border-radius:var(--bs-dropdown-border-radius)}.dropdown-menu[data-bs-popper]{top:100%;left:0;margin-top:var(--bs-dropdown-spacer)}.dropdown-menu-start{--bs-position:start}.dropdown-menu-start[data-bs-popper]{right:auto;left:0}.dropdown-menu-end{--bs-position:end}.dropdown-menu-end[data-bs-popper]{right:0;left:auto}@media (min-width:576px){.dropdown-menu-sm-start{--bs-position:start}.dropdown-menu-sm-start[data-bs-popper]{right:auto;left:0}.dropdown-menu-sm-end{--bs-position:end}.dropdown-menu-sm-end[data-bs-popper]{right:0;left:auto}}@media (min-width:768px){.dropdown-menu-md-start{--bs-position:start}.dropdown-menu-md-start[data-bs-popper]{right:auto;left:0}.dropdown-menu-md-end{--bs-position:end}.dropdown-menu-md-end[data-bs-popper]{right:0;left:auto}}@media (min-width:992px){.dropdown-menu-lg-start{--bs-position:start}.dropdown-menu-lg-start[data-bs-popper]{right:auto;left:0}.dropdown-menu-lg-end{--bs-position:end}.dropdown-menu-lg-end[data-bs-popper]{right:0;left:auto}}@media (min-width:1200px){.dropdown-menu-xl-start{--bs-position:start}.dropdown-menu-xl-start[data-bs-popper]{right:auto;left:0}.dropdown-menu-xl-end{--bs-position:end}.dropdown-menu-xl-end[data-bs-popper]{right:0;left:auto}}@media (min-width:1400px){.dropdown-menu-xxl-start{--bs-position:start}.dropdown-menu-xxl-start[data-bs-popper]{right:auto;left:0}.dropdown-menu-xxl-end{--bs-position:end}.dropdown-menu-xxl-end[data-bs-popper]{right:0;left:auto}}.dropup .dropdown-menu[data-bs-popper]{top:auto;bottom:100%;margin-top:0;margin-bottom:var(--bs-dropdown-spacer)}.dropup .dropdown-toggle::after{display:inline-block;margin-left:.255em;vertical-align:.255em;content:\"\";border-top:0;border-right:.3em solid transparent;border-bottom:.3em solid;border-left:.3em solid transparent}.dropup .dropdown-toggle:empty::after{margin-left:0}.dropend .dropdown-menu[data-bs-popper]{top:0;right:auto;left:100%;margin-top:0;margin-left:var(--bs-dropdown-spacer)}.dropend .dropdown-toggle::after{display:inline-block;margin-left:.255em;vertical-align:.255em;content:\"\";border-top:.3em solid transparent;border-right:0;border-bottom:.3em solid transparent;border-left:.3em solid}.dropend .dropdown-toggle:empty::after{margin-left:0}.dropend .dropdown-toggle::after{vertical-align:0}.dropstart .dropdown-menu[data-bs-popper]{top:0;right:100%;left:auto;margin-top:0;margin-right:var(--bs-dropdown-spacer)}.dropstart .dropdown-toggle::after{display:inline-block;margin-left:.255em;vertical-align:.255em;content:\"\"}.dropstart .dropdown-toggle::after{display:none}.dropstart .dropdown-toggle::before{display:inline-block;margin-right:.255em;vertical-align:.255em;content:\"\";border-top:.3em solid transparent;border-right:.3em solid;border-bottom:.3em solid transparent}.dropstart .dropdown-toggle:empty::after{margin-left:0}.dropstart .dropdown-toggle::before{vertical-align:0}.dropdown-divider{height:0;margin:var(--bs-dropdown-divider-margin-y) 0;overflow:hidden;border-top:1px solid var(--bs-dropdown-divider-bg);opacity:1}.dropdown-item{display:block;width:100%;padding:var(--bs-dropdown-item-padding-y) var(--bs-dropdown-item-padding-x);clear:both;font-weight:400;color:var(--bs-dropdown-link-color);text-align:inherit;text-decoration:none;white-space:nowrap;background-color:transparent;border:0}.dropdown-item:focus,.dropdown-item:hover{color:var(--bs-dropdown-link-hover-color);background-color:var(--bs-dropdown-link-hover-bg)}.dropdown-item.active,.dropdown-item:active{color:var(--bs-dropdown-link-active-color);text-decoration:none;background-color:var(--bs-dropdown-link-active-bg)}.dropdown-item.disabled,.dropdown-item:disabled{color:var(--bs-dropdown-link-disabled-color);pointer-events:none;background-color:transparent}.dropdown-menu.show{display:block}.dropdown-header{display:block;padding:var(--bs-dropdown-header-padding-y) var(--bs-dropdown-header-padding-x);margin-bottom:0;font-size:.875rem;color:var(--bs-dropdown-header-color);white-space:nowrap}.dropdown-item-text{display:block;padding:var(--bs-dropdown-item-padding-y) var(--bs-dropdown-item-padding-x);color:var(--bs-dropdown-link-color)}.dropdown-menu-dark{--bs-dropdown-color:#dee2e6;--bs-dropdown-bg:#343a40;--bs-dropdown-border-color:var(--bs-border-color-translucent);--bs-dropdown-box-shadow: ;--bs-dropdown-link-color:#dee2e6;--bs-dropdown-link-hover-color:#fff;--bs-dropdown-divider-bg:var(--bs-border-color-translucent);--bs-dropdown-link-hover-bg:rgba(255, 255, 255, 0.15);--bs-dropdown-link-active-color:#fff;--bs-dropdown-link-active-bg:#0d6efd;--bs-dropdown-link-disabled-color:#adb5bd;--bs-dropdown-header-color:#adb5bd}.btn-group,.btn-group-vertical{position:relative;display:inline-flex;vertical-align:middle}.btn-group-vertical>.btn,.btn-group>.btn{position:relative;flex:1 1 auto}.btn-group-vertical>.btn-check:checked+.btn,.btn-group-vertical>.btn-check:focus+.btn,.btn-group-vertical>.btn.active,.btn-group-vertical>.btn:active,.btn-group-vertical>.btn:focus,.btn-group-vertical>.btn:hover,.btn-group>.btn-check:checked+.btn,.btn-group>.btn-check:focus+.btn,.btn-group>.btn.active,.btn-group>.btn:active,.btn-group>.btn:focus,.btn-group>.btn:hover{z-index:1}.btn-toolbar{display:flex;flex-wrap:wrap;justify-content:flex-start}.btn-toolbar .input-group{width:auto}.btn-group{border-radius:.375rem}.btn-group>.btn-group:not(:first-child),.btn-group>.btn:not(:first-child){margin-left:-1px}.btn-group>.btn-group:not(:last-child)>.btn,.btn-group>.btn.dropdown-toggle-split:first-child,.btn-group>.btn:not(:last-child):not(.dropdown-toggle){border-top-right-radius:0;border-bottom-right-radius:0}.btn-group>.btn-group:not(:first-child)>.btn,.btn-group>.btn:nth-child(n+3),.btn-group>:not(.btn-check)+.btn{border-top-left-radius:0;border-bottom-left-radius:0}.dropdown-toggle-split{padding-right:.5625rem;padding-left:.5625rem}.dropdown-toggle-split::after,.dropend .dropdown-toggle-split::after,.dropup .dropdown-toggle-split::after{margin-left:0}.dropstart .dropdown-toggle-split::before{margin-right:0}.btn-group-sm>.btn+.dropdown-toggle-split,.btn-sm+.dropdown-toggle-split{padding-right:.375rem;padding-left:.375rem}.btn-group-lg>.btn+.dropdown-toggle-split,.btn-lg+.dropdown-toggle-split{padding-right:.75rem;padding-left:.75rem}.btn-group-vertical{flex-direction:column;align-items:flex-start;justify-content:center}.btn-group-vertical>.btn,.btn-group-vertical>.btn-group{width:100%}.btn-group-vertical>.btn-group:not(:first-child),.btn-group-vertical>.btn:not(:first-child){margin-top:-1px}.btn-group-vertical>.btn-group:not(:last-child)>.btn,.btn-group-vertical>.btn:not(:last-child):not(.dropdown-toggle){border-bottom-right-radius:0;border-bottom-left-radius:0}.btn-group-vertical>.btn-group:not(:first-child)>.btn,.btn-group-vertical>.btn~.btn{border-top-left-radius:0;border-top-right-radius:0}.nav{--bs-nav-link-padding-x:1rem;--bs-nav-link-padding-y:0.5rem;--bs-nav-link-font-weight: ;--bs-nav-link-color:var(--bs-link-color);--bs-nav-link-hover-color:var(--bs-link-hover-color);--bs-nav-link-disabled-color:#6c757d;display:flex;flex-wrap:wrap;padding-left:0;margin-bottom:0;list-style:none}.nav-link{display:block;padding:var(--bs-nav-link-padding-y) var(--bs-nav-link-padding-x);font-size:var(--bs-nav-link-font-size);font-weight:var(--bs-nav-link-font-weight);color:var(--bs-nav-link-color);text-decoration:none;transition:color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out}@media (prefers-reduced-motion:reduce){.nav-link{transition:none}}.nav-link:focus,.nav-link:hover{color:var(--bs-nav-link-hover-color)}.nav-link.disabled{color:var(--bs-nav-link-disabled-color);pointer-events:none;cursor:default}.nav-tabs{--bs-nav-tabs-border-width:1px;--bs-nav-tabs-border-color:#dee2e6;--bs-nav-tabs-border-radius:0.375rem;--bs-nav-tabs-link-hover-border-color:#e9ecef #e9ecef #dee2e6;--bs-nav-tabs-link-active-color:#495057;--bs-nav-tabs-link-active-bg:#fff;--bs-nav-tabs-link-active-border-color:#dee2e6 #dee2e6 #fff;border-bottom:var(--bs-nav-tabs-border-width) solid var(--bs-nav-tabs-border-color)}.nav-tabs .nav-link{margin-bottom:calc(var(--bs-nav-tabs-border-width) * -1);background:0 0;border:var(--bs-nav-tabs-border-width) solid transparent;border-top-left-radius:var(--bs-nav-tabs-border-radius);border-top-right-radius:var(--bs-nav-tabs-border-radius)}.nav-tabs .nav-link:focus,.nav-tabs .nav-link:hover{isolation:isolate;border-color:var(--bs-nav-tabs-link-hover-border-color)}.nav-tabs .nav-link.disabled,.nav-tabs .nav-link:disabled{color:var(--bs-nav-link-disabled-color);background-color:transparent;border-color:transparent}.nav-tabs .nav-item.show .nav-link,.nav-tabs .nav-link.active{color:var(--bs-nav-tabs-link-active-color);background-color:var(--bs-nav-tabs-link-active-bg);border-color:var(--bs-nav-tabs-link-active-border-color)}.nav-tabs .dropdown-menu{margin-top:calc(var(--bs-nav-tabs-border-width) * -1);border-top-left-radius:0;border-top-right-radius:0}.nav-pills{--bs-nav-pills-border-radius:0.375rem;--bs-nav-pills-link-active-color:#fff;--bs-nav-pills-link-active-bg:#0d6efd}.nav-pills .nav-link{background:0 0;border:0;border-radius:var(--bs-nav-pills-border-radius)}.nav-pills .nav-link:disabled{color:var(--bs-nav-link-disabled-color);background-color:transparent;border-color:transparent}.nav-pills .nav-link.active,.nav-pills .show>.nav-link{color:var(--bs-nav-pills-link-active-color);background-color:var(--bs-nav-pills-link-active-bg)}.nav-fill .nav-item,.nav-fill>.nav-link{flex:1 1 auto;text-align:center}.nav-justified .nav-item,.nav-justified>.nav-link{flex-basis:0;flex-grow:1;text-align:center}.nav-fill .nav-item .nav-link,.nav-justified .nav-item .nav-link{width:100%}.tab-content>.tab-pane{display:none}.tab-content>.active{display:block}.navbar{--bs-navbar-padding-x:0;--bs-navbar-padding-y:0.5rem;--bs-navbar-color:rgba(0, 0, 0, 0.55);--bs-navbar-hover-color:rgba(0, 0, 0, 0.7);--bs-navbar-disabled-color:rgba(0, 0, 0, 0.3);--bs-navbar-active-color:rgba(0, 0, 0, 0.9);--bs-navbar-brand-padding-y:0.3125rem;--bs-navbar-brand-margin-end:1rem;--bs-navbar-brand-font-size:1.25rem;--bs-navbar-brand-color:rgba(0, 0, 0, 0.9);--bs-navbar-brand-hover-color:rgba(0, 0, 0, 0.9);--bs-navbar-nav-link-padding-x:0.5rem;--bs-navbar-toggler-padding-y:0.25rem;--bs-navbar-toggler-padding-x:0.75rem;--bs-navbar-toggler-font-size:1.25rem;--bs-navbar-toggler-icon-bg:url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba%280, 0, 0, 0.55%29' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e\");--bs-navbar-toggler-border-color:rgba(0, 0, 0, 0.1);--bs-navbar-toggler-border-radius:0.375rem;--bs-navbar-toggler-focus-width:0.25rem;--bs-navbar-toggler-transition:box-shadow 0.15s ease-in-out;position:relative;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;padding:var(--bs-navbar-padding-y) var(--bs-navbar-padding-x)}.navbar>.container,.navbar>.container-fluid,.navbar>.container-lg,.navbar>.container-md,.navbar>.container-sm,.navbar>.container-xl,.navbar>.container-xxl{display:flex;flex-wrap:inherit;align-items:center;justify-content:space-between}.navbar-brand{padding-top:var(--bs-navbar-brand-padding-y);padding-bottom:var(--bs-navbar-brand-padding-y);margin-right:var(--bs-navbar-brand-margin-end);font-size:var(--bs-navbar-brand-font-size);color:var(--bs-navbar-brand-color);text-decoration:none;white-space:nowrap}.navbar-brand:focus,.navbar-brand:hover{color:var(--bs-navbar-brand-hover-color)}.navbar-nav{--bs-nav-link-padding-x:0;--bs-nav-link-padding-y:0.5rem;--bs-nav-link-font-weight: ;--bs-nav-link-color:var(--bs-navbar-color);--bs-nav-link-hover-color:var(--bs-navbar-hover-color);--bs-nav-link-disabled-color:var(--bs-navbar-disabled-color);display:flex;flex-direction:column;padding-left:0;margin-bottom:0;list-style:none}.navbar-nav .nav-link.active,.navbar-nav .show>.nav-link{color:var(--bs-navbar-active-color)}.navbar-nav .dropdown-menu{position:static}.navbar-text{padding-top:.5rem;padding-bottom:.5rem;color:var(--bs-navbar-color)}.navbar-text a,.navbar-text a:focus,.navbar-text a:hover{color:var(--bs-navbar-active-color)}.navbar-collapse{flex-basis:100%;flex-grow:1;align-items:center}.navbar-toggler{padding:var(--bs-navbar-toggler-padding-y) var(--bs-navbar-toggler-padding-x);font-size:var(--bs-navbar-toggler-font-size);line-height:1;color:var(--bs-navbar-color);background-color:transparent;border:var(--bs-border-width) solid var(--bs-navbar-toggler-border-color);border-radius:var(--bs-navbar-toggler-border-radius);transition:var(--bs-navbar-toggler-transition)}@media (prefers-reduced-motion:reduce){.navbar-toggler{transition:none}}.navbar-toggler:hover{text-decoration:none}.navbar-toggler:focus{text-decoration:none;outline:0;box-shadow:0 0 0 var(--bs-navbar-toggler-focus-width)}.navbar-toggler-icon{display:inline-block;width:1.5em;height:1.5em;vertical-align:middle;background-image:var(--bs-navbar-toggler-icon-bg);background-repeat:no-repeat;background-position:center;background-size:100%}.navbar-nav-scroll{max-height:var(--bs-scroll-height,75vh);overflow-y:auto}@media (min-width:576px){.navbar-expand-sm{flex-wrap:nowrap;justify-content:flex-start}.navbar-expand-sm .navbar-nav{flex-direction:row}.navbar-expand-sm .navbar-nav .dropdown-menu{position:absolute}.navbar-expand-sm .navbar-nav .nav-link{padding-right:var(--bs-navbar-nav-link-padding-x);padding-left:var(--bs-navbar-nav-link-padding-x)}.navbar-expand-sm .navbar-nav-scroll{overflow:visible}.navbar-expand-sm .navbar-collapse{display:flex!important;flex-basis:auto}.navbar-expand-sm .navbar-toggler{display:none}.navbar-expand-sm .offcanvas{position:static;z-index:auto;flex-grow:1;width:auto!important;height:auto!important;visibility:visible!important;background-color:transparent!important;border:0!important;transform:none!important;transition:none}.navbar-expand-sm .offcanvas .offcanvas-header{display:none}.navbar-expand-sm .offcanvas .offcanvas-body{display:flex;flex-grow:0;padding:0;overflow-y:visible}}@media (min-width:768px){.navbar-expand-md{flex-wrap:nowrap;justify-content:flex-start}.navbar-expand-md .navbar-nav{flex-direction:row}.navbar-expand-md .navbar-nav .dropdown-menu{position:absolute}.navbar-expand-md .navbar-nav .nav-link{padding-right:var(--bs-navbar-nav-link-padding-x);padding-left:var(--bs-navbar-nav-link-padding-x)}.navbar-expand-md .navbar-nav-scroll{overflow:visible}.navbar-expand-md .navbar-collapse{display:flex!important;flex-basis:auto}.navbar-expand-md .navbar-toggler{display:none}.navbar-expand-md .offcanvas{position:static;z-index:auto;flex-grow:1;width:auto!important;height:auto!important;visibility:visible!important;background-color:transparent!important;border:0!important;transform:none!important;transition:none}.navbar-expand-md .offcanvas .offcanvas-header{display:none}.navbar-expand-md .offcanvas .offcanvas-body{display:flex;flex-grow:0;padding:0;overflow-y:visible}}@media (min-width:992px){.navbar-expand-lg{flex-wrap:nowrap;justify-content:flex-start}.navbar-expand-lg .navbar-nav{flex-direction:row}.navbar-expand-lg .navbar-nav .dropdown-menu{position:absolute}.navbar-expand-lg .navbar-nav .nav-link{padding-right:var(--bs-navbar-nav-link-padding-x);padding-left:var(--bs-navbar-nav-link-padding-x)}.navbar-expand-lg .navbar-nav-scroll{overflow:visible}.navbar-expand-lg .navbar-collapse{display:flex!important;flex-basis:auto}.navbar-expand-lg .navbar-toggler{display:none}.navbar-expand-lg .offcanvas{position:static;z-index:auto;flex-grow:1;width:auto!important;height:auto!important;visibility:visible!important;background-color:transparent!important;border:0!important;transform:none!important;transition:none}.navbar-expand-lg .offcanvas .offcanvas-header{display:none}.navbar-expand-lg .offcanvas .offcanvas-body{display:flex;flex-grow:0;padding:0;overflow-y:visible}}@media (min-width:1200px){.navbar-expand-xl{flex-wrap:nowrap;justify-content:flex-start}.navbar-expand-xl .navbar-nav{flex-direction:row}.navbar-expand-xl .navbar-nav .dropdown-menu{position:absolute}.navbar-expand-xl .navbar-nav .nav-link{padding-right:var(--bs-navbar-nav-link-padding-x);padding-left:var(--bs-navbar-nav-link-padding-x)}.navbar-expand-xl .navbar-nav-scroll{overflow:visible}.navbar-expand-xl .navbar-collapse{display:flex!important;flex-basis:auto}.navbar-expand-xl .navbar-toggler{display:none}.navbar-expand-xl .offcanvas{position:static;z-index:auto;flex-grow:1;width:auto!important;height:auto!important;visibility:visible!important;background-color:transparent!important;border:0!important;transform:none!important;transition:none}.navbar-expand-xl .offcanvas .offcanvas-header{display:none}.navbar-expand-xl .offcanvas .offcanvas-body{display:flex;flex-grow:0;padding:0;overflow-y:visible}}@media (min-width:1400px){.navbar-expand-xxl{flex-wrap:nowrap;justify-content:flex-start}.navbar-expand-xxl .navbar-nav{flex-direction:row}.navbar-expand-xxl .navbar-nav .dropdown-menu{position:absolute}.navbar-expand-xxl .navbar-nav .nav-link{padding-right:var(--bs-navbar-nav-link-padding-x);padding-left:var(--bs-navbar-nav-link-padding-x)}.navbar-expand-xxl .navbar-nav-scroll{overflow:visible}.navbar-expand-xxl .navbar-collapse{display:flex!important;flex-basis:auto}.navbar-expand-xxl .navbar-toggler{display:none}.navbar-expand-xxl .offcanvas{position:static;z-index:auto;flex-grow:1;width:auto!important;height:auto!important;visibility:visible!important;background-color:transparent!important;border:0!important;transform:none!important;transition:none}.navbar-expand-xxl .offcanvas .offcanvas-header{display:none}.navbar-expand-xxl .offcanvas .offcanvas-body{display:flex;flex-grow:0;padding:0;overflow-y:visible}}.navbar-expand{flex-wrap:nowrap;justify-content:flex-start}.navbar-expand .navbar-nav{flex-direction:row}.navbar-expand .navbar-nav .dropdown-menu{position:absolute}.navbar-expand .navbar-nav .nav-link{padding-right:var(--bs-navbar-nav-link-padding-x);padding-left:var(--bs-navbar-nav-link-padding-x)}.navbar-expand .navbar-nav-scroll{overflow:visible}.navbar-expand .navbar-collapse{display:flex!important;flex-basis:auto}.navbar-expand .navbar-toggler{display:none}.navbar-expand .offcanvas{position:static;z-index:auto;flex-grow:1;width:auto!important;height:auto!important;visibility:visible!important;background-color:transparent!important;border:0!important;transform:none!important;transition:none}.navbar-expand .offcanvas .offcanvas-header{display:none}.navbar-expand .offcanvas .offcanvas-body{display:flex;flex-grow:0;padding:0;overflow-y:visible}.navbar-dark{--bs-navbar-color:rgba(255, 255, 255, 0.55);--bs-navbar-hover-color:rgba(255, 255, 255, 0.75);--bs-navbar-disabled-color:rgba(255, 255, 255, 0.25);--bs-navbar-active-color:#fff;--bs-navbar-brand-color:#fff;--bs-navbar-brand-hover-color:#fff;--bs-navbar-toggler-border-color:rgba(255, 255, 255, 0.1);--bs-navbar-toggler-icon-bg:url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba%28255, 255, 255, 0.55%29' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e\")}.card{--bs-card-spacer-y:1rem;--bs-card-spacer-x:1rem;--bs-card-title-spacer-y:0.5rem;--bs-card-border-width:1px;--bs-card-border-color:var(--bs-border-color-translucent);--bs-card-border-radius:0.375rem;--bs-card-box-shadow: ;--bs-card-inner-border-radius:calc(0.375rem - 1px);--bs-card-cap-padding-y:0.5rem;--bs-card-cap-padding-x:1rem;--bs-card-cap-bg:rgba(0, 0, 0, 0.03);--bs-card-cap-color: ;--bs-card-height: ;--bs-card-color: ;--bs-card-bg:#fff;--bs-card-img-overlay-padding:1rem;--bs-card-group-margin:0.75rem;position:relative;display:flex;flex-direction:column;min-width:0;height:var(--bs-card-height);word-wrap:break-word;background-color:var(--bs-card-bg);background-clip:border-box;border:var(--bs-card-border-width) solid var(--bs-card-border-color);border-radius:var(--bs-card-border-radius)}.card>hr{margin-right:0;margin-left:0}.card>.list-group{border-top:inherit;border-bottom:inherit}.card>.list-group:first-child{border-top-width:0;border-top-left-radius:var(--bs-card-inner-border-radius);border-top-right-radius:var(--bs-card-inner-border-radius)}.card>.list-group:last-child{border-bottom-width:0;border-bottom-right-radius:var(--bs-card-inner-border-radius);border-bottom-left-radius:var(--bs-card-inner-border-radius)}.card>.card-header+.list-group,.card>.list-group+.card-footer{border-top:0}.card-body{flex:1 1 auto;padding:var(--bs-card-spacer-y) var(--bs-card-spacer-x);color:var(--bs-card-color)}.card-title{margin-bottom:var(--bs-card-title-spacer-y)}.card-subtitle{margin-top:calc(-.5 * var(--bs-card-title-spacer-y));margin-bottom:0}.card-text:last-child{margin-bottom:0}.card-link+.card-link{margin-left:var(--bs-card-spacer-x)}.card-header{padding:var(--bs-card-cap-padding-y) var(--bs-card-cap-padding-x);margin-bottom:0;color:var(--bs-card-cap-color);background-color:var(--bs-card-cap-bg);border-bottom:var(--bs-card-border-width) solid var(--bs-card-border-color)}.card-header:first-child{border-radius:var(--bs-card-inner-border-radius) var(--bs-card-inner-border-radius) 0 0}.card-footer{padding:var(--bs-card-cap-padding-y) var(--bs-card-cap-padding-x);color:var(--bs-card-cap-color);background-color:var(--bs-card-cap-bg);border-top:var(--bs-card-border-width) solid var(--bs-card-border-color)}.card-footer:last-child{border-radius:0 0 var(--bs-card-inner-border-radius) var(--bs-card-inner-border-radius)}.card-header-tabs{margin-right:calc(-.5 * var(--bs-card-cap-padding-x));margin-bottom:calc(-1 * var(--bs-card-cap-padding-y));margin-left:calc(-.5 * var(--bs-card-cap-padding-x));border-bottom:0}.card-header-tabs .nav-link.active{background-color:var(--bs-card-bg);border-bottom-color:var(--bs-card-bg)}.card-header-pills{margin-right:calc(-.5 * var(--bs-card-cap-padding-x));margin-left:calc(-.5 * var(--bs-card-cap-padding-x))}.card-img-overlay{position:absolute;top:0;right:0;bottom:0;left:0;padding:var(--bs-card-img-overlay-padding);border-radius:var(--bs-card-inner-border-radius)}.card-img,.card-img-bottom,.card-img-top{width:100%}.card-img,.card-img-top{border-top-left-radius:var(--bs-card-inner-border-radius);border-top-right-radius:var(--bs-card-inner-border-radius)}.card-img,.card-img-bottom{border-bottom-right-radius:var(--bs-card-inner-border-radius);border-bottom-left-radius:var(--bs-card-inner-border-radius)}.card-group>.card{margin-bottom:var(--bs-card-group-margin)}@media (min-width:576px){.card-group{display:flex;flex-flow:row wrap}.card-group>.card{flex:1 0 0%;margin-bottom:0}.card-group>.card+.card{margin-left:0;border-left:0}.card-group>.card:not(:last-child){border-top-right-radius:0;border-bottom-right-radius:0}.card-group>.card:not(:last-child) .card-header,.card-group>.card:not(:last-child) .card-img-top{border-top-right-radius:0}.card-group>.card:not(:last-child) .card-footer,.card-group>.card:not(:last-child) .card-img-bottom{border-bottom-right-radius:0}.card-group>.card:not(:first-child){border-top-left-radius:0;border-bottom-left-radius:0}.card-group>.card:not(:first-child) .card-header,.card-group>.card:not(:first-child) .card-img-top{border-top-left-radius:0}.card-group>.card:not(:first-child) .card-footer,.card-group>.card:not(:first-child) .card-img-bottom{border-bottom-left-radius:0}}.accordion{--bs-accordion-color:#000;--bs-accordion-bg:#fff;--bs-accordion-transition:color 0.15s ease-in-out,background-color 0.15s ease-in-out,border-color 0.15s ease-in-out,box-shadow 0.15s ease-in-out,border-radius 0.15s ease;--bs-accordion-border-color:var(--bs-border-color);--bs-accordion-border-width:1px;--bs-accordion-border-radius:0.375rem;--bs-accordion-inner-border-radius:calc(0.375rem - 1px);--bs-accordion-btn-padding-x:1.25rem;--bs-accordion-btn-padding-y:1rem;--bs-accordion-btn-color:var(--bs-body-color);--bs-accordion-btn-bg:var(--bs-accordion-bg);--bs-accordion-btn-icon:url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='var%28--bs-body-color%29'%3e%3cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3e%3c/svg%3e\");--bs-accordion-btn-icon-width:1.25rem;--bs-accordion-btn-icon-transform:rotate(-180deg);--bs-accordion-btn-icon-transition:transform 0.2s ease-in-out;--bs-accordion-btn-active-icon:url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%230c63e4'%3e%3cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3e%3c/svg%3e\");--bs-accordion-btn-focus-border-color:#86b7fe;--bs-accordion-btn-focus-box-shadow:0 0 0 0.25rem rgba(13, 110, 253, 0.25);--bs-accordion-body-padding-x:1.25rem;--bs-accordion-body-padding-y:1rem;--bs-accordion-active-color:#0c63e4;--bs-accordion-active-bg:#e7f1ff}.accordion-button{position:relative;display:flex;align-items:center;width:100%;padding:var(--bs-accordion-btn-padding-y) var(--bs-accordion-btn-padding-x);font-size:1rem;color:var(--bs-accordion-btn-color);text-align:left;background-color:var(--bs-accordion-btn-bg);border:0;border-radius:0;overflow-anchor:none;transition:var(--bs-accordion-transition)}@media (prefers-reduced-motion:reduce){.accordion-button{transition:none}}.accordion-button:not(.collapsed){color:var(--bs-accordion-active-color);background-color:var(--bs-accordion-active-bg);box-shadow:inset 0 calc(var(--bs-accordion-border-width) * -1) 0 var(--bs-accordion-border-color)}.accordion-button:not(.collapsed)::after{background-image:var(--bs-accordion-btn-active-icon);transform:var(--bs-accordion-btn-icon-transform)}.accordion-button::after{flex-shrink:0;width:var(--bs-accordion-btn-icon-width);height:var(--bs-accordion-btn-icon-width);margin-left:auto;content:\"\";background-image:var(--bs-accordion-btn-icon);background-repeat:no-repeat;background-size:var(--bs-accordion-btn-icon-width);transition:var(--bs-accordion-btn-icon-transition)}@media (prefers-reduced-motion:reduce){.accordion-button::after{transition:none}}.accordion-button:hover{z-index:2}.accordion-button:focus{z-index:3;border-color:var(--bs-accordion-btn-focus-border-color);outline:0;box-shadow:var(--bs-accordion-btn-focus-box-shadow)}.accordion-header{margin-bottom:0}.accordion-item{color:var(--bs-accordion-color);background-color:var(--bs-accordion-bg);border:var(--bs-accordion-border-width) solid var(--bs-accordion-border-color)}.accordion-item:first-of-type{border-top-left-radius:var(--bs-accordion-border-radius);border-top-right-radius:var(--bs-accordion-border-radius)}.accordion-item:first-of-type .accordion-button{border-top-left-radius:var(--bs-accordion-inner-border-radius);border-top-right-radius:var(--bs-accordion-inner-border-radius)}.accordion-item:not(:first-of-type){border-top:0}.accordion-item:last-of-type{border-bottom-right-radius:var(--bs-accordion-border-radius);border-bottom-left-radius:var(--bs-accordion-border-radius)}.accordion-item:last-of-type .accordion-button.collapsed{border-bottom-right-radius:var(--bs-accordion-inner-border-radius);border-bottom-left-radius:var(--bs-accordion-inner-border-radius)}.accordion-item:last-of-type .accordion-collapse{border-bottom-right-radius:var(--bs-accordion-border-radius);border-bottom-left-radius:var(--bs-accordion-border-radius)}.accordion-body{padding:var(--bs-accordion-body-padding-y) var(--bs-accordion-body-padding-x)}.accordion-flush .accordion-collapse{border-width:0}.accordion-flush .accordion-item{border-right:0;border-left:0;border-radius:0}.accordion-flush .accordion-item:first-child{border-top:0}.accordion-flush .accordion-item:last-child{border-bottom:0}.accordion-flush .accordion-item .accordion-button{border-radius:0}.breadcrumb{--bs-breadcrumb-padding-x:0;--bs-breadcrumb-padding-y:0;--bs-breadcrumb-margin-bottom:1rem;--bs-breadcrumb-bg: ;--bs-breadcrumb-border-radius: ;--bs-breadcrumb-divider-color:#6c757d;--bs-breadcrumb-item-padding-x:0.5rem;--bs-breadcrumb-item-active-color:#6c757d;display:flex;flex-wrap:wrap;padding:var(--bs-breadcrumb-padding-y) var(--bs-breadcrumb-padding-x);margin-bottom:var(--bs-breadcrumb-margin-bottom);font-size:var(--bs-breadcrumb-font-size);list-style:none;background-color:var(--bs-breadcrumb-bg);border-radius:var(--bs-breadcrumb-border-radius)}.breadcrumb-item+.breadcrumb-item{padding-left:var(--bs-breadcrumb-item-padding-x)}.breadcrumb-item+.breadcrumb-item::before{float:left;padding-right:var(--bs-breadcrumb-item-padding-x);color:var(--bs-breadcrumb-divider-color);content:var(--bs-breadcrumb-divider, \"/\")}.breadcrumb-item.active{color:var(--bs-breadcrumb-item-active-color)}.pagination{--bs-pagination-padding-x:0.75rem;--bs-pagination-padding-y:0.375rem;--bs-pagination-font-size:1rem;--bs-pagination-color:var(--bs-link-color);--bs-pagination-bg:#fff;--bs-pagination-border-width:1px;--bs-pagination-border-color:#dee2e6;--bs-pagination-border-radius:0.375rem;--bs-pagination-hover-color:var(--bs-link-hover-color);--bs-pagination-hover-bg:#e9ecef;--bs-pagination-hover-border-color:#dee2e6;--bs-pagination-focus-color:var(--bs-link-hover-color);--bs-pagination-focus-bg:#e9ecef;--bs-pagination-focus-box-shadow:0 0 0 0.25rem rgba(13, 110, 253, 0.25);--bs-pagination-active-color:#fff;--bs-pagination-active-bg:#0d6efd;--bs-pagination-active-border-color:#0d6efd;--bs-pagination-disabled-color:#6c757d;--bs-pagination-disabled-bg:#fff;--bs-pagination-disabled-border-color:#dee2e6;display:flex;padding-left:0;list-style:none}.page-link{position:relative;display:block;padding:var(--bs-pagination-padding-y) var(--bs-pagination-padding-x);font-size:var(--bs-pagination-font-size);color:var(--bs-pagination-color);text-decoration:none;background-color:var(--bs-pagination-bg);border:var(--bs-pagination-border-width) solid var(--bs-pagination-border-color);transition:color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out,box-shadow .15s ease-in-out}@media (prefers-reduced-motion:reduce){.page-link{transition:none}}.page-link:hover{z-index:2;color:var(--bs-pagination-hover-color);background-color:var(--bs-pagination-hover-bg);border-color:var(--bs-pagination-hover-border-color)}.page-link:focus{z-index:3;color:var(--bs-pagination-focus-color);background-color:var(--bs-pagination-focus-bg);outline:0;box-shadow:var(--bs-pagination-focus-box-shadow)}.active>.page-link,.page-link.active{z-index:3;color:var(--bs-pagination-active-color);background-color:var(--bs-pagination-active-bg);border-color:var(--bs-pagination-active-border-color)}.disabled>.page-link,.page-link.disabled{color:var(--bs-pagination-disabled-color);pointer-events:none;background-color:var(--bs-pagination-disabled-bg);border-color:var(--bs-pagination-disabled-border-color)}.page-item:not(:first-child) .page-link{margin-left:-1px}.page-item:first-child .page-link{border-top-left-radius:var(--bs-pagination-border-radius);border-bottom-left-radius:var(--bs-pagination-border-radius)}.page-item:last-child .page-link{border-top-right-radius:var(--bs-pagination-border-radius);border-bottom-right-radius:var(--bs-pagination-border-radius)}.pagination-lg{--bs-pagination-padding-x:1.5rem;--bs-pagination-padding-y:0.75rem;--bs-pagination-font-size:1.25rem;--bs-pagination-border-radius:0.5rem}.pagination-sm{--bs-pagination-padding-x:0.5rem;--bs-pagination-padding-y:0.25rem;--bs-pagination-font-size:0.875rem;--bs-pagination-border-radius:0.25rem}.badge{--bs-badge-padding-x:0.65em;--bs-badge-padding-y:0.35em;--bs-badge-font-size:0.75em;--bs-badge-font-weight:700;--bs-badge-color:#fff;--bs-badge-border-radius:0.375rem;display:inline-block;padding:var(--bs-badge-padding-y) var(--bs-badge-padding-x);font-size:var(--bs-badge-font-size);font-weight:var(--bs-badge-font-weight);line-height:1;color:var(--bs-badge-color);text-align:center;white-space:nowrap;vertical-align:baseline;border-radius:var(--bs-badge-border-radius)}.badge:empty{display:none}.btn .badge{position:relative;top:-1px}.alert{--bs-alert-bg:transparent;--bs-alert-padding-x:1rem;--bs-alert-padding-y:1rem;--bs-alert-margin-bottom:1rem;--bs-alert-color:inherit;--bs-alert-border-color:transparent;--bs-alert-border:1px solid var(--bs-alert-border-color);--bs-alert-border-radius:0.375rem;position:relative;padding:var(--bs-alert-padding-y) var(--bs-alert-padding-x);margin-bottom:var(--bs-alert-margin-bottom);color:var(--bs-alert-color);background-color:var(--bs-alert-bg);border:var(--bs-alert-border);border-radius:var(--bs-alert-border-radius)}.alert-heading{color:inherit}.alert-link{font-weight:700}.alert-dismissible{padding-right:3rem}.alert-dismissible .btn-close{position:absolute;top:0;right:0;z-index:2;padding:1.25rem 1rem}.alert-primary{--bs-alert-color:#084298;--bs-alert-bg:#cfe2ff;--bs-alert-border-color:#b6d4fe}.alert-primary .alert-link{color:#06357a}.alert-secondary{--bs-alert-color:#41464b;--bs-alert-bg:#e2e3e5;--bs-alert-border-color:#d3d6d8}.alert-secondary .alert-link{color:#34383c}.alert-success{--bs-alert-color:#0f5132;--bs-alert-bg:#d1e7dd;--bs-alert-border-color:#badbcc}.alert-success .alert-link{color:#0c4128}.alert-info{--bs-alert-color:#055160;--bs-alert-bg:#cff4fc;--bs-alert-border-color:#b6effb}.alert-info .alert-link{color:#04414d}.alert-warning{--bs-alert-color:#664d03;--bs-alert-bg:#fff3cd;--bs-alert-border-color:#ffecb5}.alert-warning .alert-link{color:#523e02}.alert-danger{--bs-alert-color:#842029;--bs-alert-bg:#f8d7da;--bs-alert-border-color:#f5c2c7}.alert-danger .alert-link{color:#6a1a21}.alert-light{--bs-alert-color:#636464;--bs-alert-bg:#fefefe;--bs-alert-border-color:#fdfdfe}.alert-light .alert-link{color:#4f5050}.alert-dark{--bs-alert-color:#141619;--bs-alert-bg:#d3d3d4;--bs-alert-border-color:#bcbebf}.alert-dark .alert-link{color:#101214}@-webkit-keyframes progress-bar-stripes{0%{background-position-x:1rem}}@keyframes progress-bar-stripes{0%{background-position-x:1rem}}.progress{--bs-progress-height:1rem;--bs-progress-font-size:0.75rem;--bs-progress-bg:#e9ecef;--bs-progress-border-radius:0.375rem;--bs-progress-box-shadow:inset 0 1px 2px rgba(0, 0, 0, 0.075);--bs-progress-bar-color:#fff;--bs-progress-bar-bg:#0d6efd;--bs-progress-bar-transition:width 0.6s ease;display:flex;height:var(--bs-progress-height);overflow:hidden;font-size:var(--bs-progress-font-size);background-color:var(--bs-progress-bg);border-radius:var(--bs-progress-border-radius)}.progress-bar{display:flex;flex-direction:column;justify-content:center;overflow:hidden;color:var(--bs-progress-bar-color);text-align:center;white-space:nowrap;background-color:var(--bs-progress-bar-bg);transition:var(--bs-progress-bar-transition)}@media (prefers-reduced-motion:reduce){.progress-bar{transition:none}}.progress-bar-striped{background-image:linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent);background-size:var(--bs-progress-height) var(--bs-progress-height)}.progress-bar-animated{-webkit-animation:1s linear infinite progress-bar-stripes;animation:1s linear infinite progress-bar-stripes}@media (prefers-reduced-motion:reduce){.progress-bar-animated{-webkit-animation:none;animation:none}}.list-group{--bs-list-group-color:#212529;--bs-list-group-bg:#fff;--bs-list-group-border-color:rgba(0, 0, 0, 0.125);--bs-list-group-border-width:1px;--bs-list-group-border-radius:0.375rem;--bs-list-group-item-padding-x:1rem;--bs-list-group-item-padding-y:0.5rem;--bs-list-group-action-color:#495057;--bs-list-group-action-hover-color:#495057;--bs-list-group-action-hover-bg:#f8f9fa;--bs-list-group-action-active-color:#212529;--bs-list-group-action-active-bg:#e9ecef;--bs-list-group-disabled-color:#6c757d;--bs-list-group-disabled-bg:#fff;--bs-list-group-active-color:#fff;--bs-list-group-active-bg:#0d6efd;--bs-list-group-active-border-color:#0d6efd;display:flex;flex-direction:column;padding-left:0;margin-bottom:0;border-radius:var(--bs-list-group-border-radius)}.list-group-numbered{list-style-type:none;counter-reset:section}.list-group-numbered>.list-group-item::before{content:counters(section, \".\") \". \";counter-increment:section}.list-group-item-action{width:100%;color:var(--bs-list-group-action-color);text-align:inherit}.list-group-item-action:focus,.list-group-item-action:hover{z-index:1;color:var(--bs-list-group-action-hover-color);text-decoration:none;background-color:var(--bs-list-group-action-hover-bg)}.list-group-item-action:active{color:var(--bs-list-group-action-active-color);background-color:var(--bs-list-group-action-active-bg)}.list-group-item{position:relative;display:block;padding:var(--bs-list-group-item-padding-y) var(--bs-list-group-item-padding-x);color:var(--bs-list-group-color);text-decoration:none;background-color:var(--bs-list-group-bg);border:var(--bs-list-group-border-width) solid var(--bs-list-group-border-color)}.list-group-item:first-child{border-top-left-radius:inherit;border-top-right-radius:inherit}.list-group-item:last-child{border-bottom-right-radius:inherit;border-bottom-left-radius:inherit}.list-group-item.disabled,.list-group-item:disabled{color:var(--bs-list-group-disabled-color);pointer-events:none;background-color:var(--bs-list-group-disabled-bg)}.list-group-item.active{z-index:2;color:var(--bs-list-group-active-color);background-color:var(--bs-list-group-active-bg);border-color:var(--bs-list-group-active-border-color)}.list-group-item+.list-group-item{border-top-width:0}.list-group-item+.list-group-item.active{margin-top:calc(var(--bs-list-group-border-width) * -1);border-top-width:var(--bs-list-group-border-width)}.list-group-horizontal{flex-direction:row}.list-group-horizontal>.list-group-item:first-child{border-bottom-left-radius:var(--bs-list-group-border-radius);border-top-right-radius:0}.list-group-horizontal>.list-group-item:last-child{border-top-right-radius:var(--bs-list-group-border-radius);border-bottom-left-radius:0}.list-group-horizontal>.list-group-item.active{margin-top:0}.list-group-horizontal>.list-group-item+.list-group-item{border-top-width:var(--bs-list-group-border-width);border-left-width:0}.list-group-horizontal>.list-group-item+.list-group-item.active{margin-left:calc(var(--bs-list-group-border-width) * -1);border-left-width:var(--bs-list-group-border-width)}@media (min-width:576px){.list-group-horizontal-sm{flex-direction:row}.list-group-horizontal-sm>.list-group-item:first-child{border-bottom-left-radius:var(--bs-list-group-border-radius);border-top-right-radius:0}.list-group-horizontal-sm>.list-group-item:last-child{border-top-right-radius:var(--bs-list-group-border-radius);border-bottom-left-radius:0}.list-group-horizontal-sm>.list-group-item.active{margin-top:0}.list-group-horizontal-sm>.list-group-item+.list-group-item{border-top-width:var(--bs-list-group-border-width);border-left-width:0}.list-group-horizontal-sm>.list-group-item+.list-group-item.active{margin-left:calc(var(--bs-list-group-border-width) * -1);border-left-width:var(--bs-list-group-border-width)}}@media (min-width:768px){.list-group-horizontal-md{flex-direction:row}.list-group-horizontal-md>.list-group-item:first-child{border-bottom-left-radius:var(--bs-list-group-border-radius);border-top-right-radius:0}.list-group-horizontal-md>.list-group-item:last-child{border-top-right-radius:var(--bs-list-group-border-radius);border-bottom-left-radius:0}.list-group-horizontal-md>.list-group-item.active{margin-top:0}.list-group-horizontal-md>.list-group-item+.list-group-item{border-top-width:var(--bs-list-group-border-width);border-left-width:0}.list-group-horizontal-md>.list-group-item+.list-group-item.active{margin-left:calc(var(--bs-list-group-border-width) * -1);border-left-width:var(--bs-list-group-border-width)}}@media (min-width:992px){.list-group-horizontal-lg{flex-direction:row}.list-group-horizontal-lg>.list-group-item:first-child{border-bottom-left-radius:var(--bs-list-group-border-radius);border-top-right-radius:0}.list-group-horizontal-lg>.list-group-item:last-child{border-top-right-radius:var(--bs-list-group-border-radius);border-bottom-left-radius:0}.list-group-horizontal-lg>.list-group-item.active{margin-top:0}.list-group-horizontal-lg>.list-group-item+.list-group-item{border-top-width:var(--bs-list-group-border-width);border-left-width:0}.list-group-horizontal-lg>.list-group-item+.list-group-item.active{margin-left:calc(var(--bs-list-group-border-width) * -1);border-left-width:var(--bs-list-group-border-width)}}@media (min-width:1200px){.list-group-horizontal-xl{flex-direction:row}.list-group-horizontal-xl>.list-group-item:first-child{border-bottom-left-radius:var(--bs-list-group-border-radius);border-top-right-radius:0}.list-group-horizontal-xl>.list-group-item:last-child{border-top-right-radius:var(--bs-list-group-border-radius);border-bottom-left-radius:0}.list-group-horizontal-xl>.list-group-item.active{margin-top:0}.list-group-horizontal-xl>.list-group-item+.list-group-item{border-top-width:var(--bs-list-group-border-width);border-left-width:0}.list-group-horizontal-xl>.list-group-item+.list-group-item.active{margin-left:calc(var(--bs-list-group-border-width) * -1);border-left-width:var(--bs-list-group-border-width)}}@media (min-width:1400px){.list-group-horizontal-xxl{flex-direction:row}.list-group-horizontal-xxl>.list-group-item:first-child{border-bottom-left-radius:var(--bs-list-group-border-radius);border-top-right-radius:0}.list-group-horizontal-xxl>.list-group-item:last-child{border-top-right-radius:var(--bs-list-group-border-radius);border-bottom-left-radius:0}.list-group-horizontal-xxl>.list-group-item.active{margin-top:0}.list-group-horizontal-xxl>.list-group-item+.list-group-item{border-top-width:var(--bs-list-group-border-width);border-left-width:0}.list-group-horizontal-xxl>.list-group-item+.list-group-item.active{margin-left:calc(var(--bs-list-group-border-width) * -1);border-left-width:var(--bs-list-group-border-width)}}.list-group-flush{border-radius:0}.list-group-flush>.list-group-item{border-width:0 0 var(--bs-list-group-border-width)}.list-group-flush>.list-group-item:last-child{border-bottom-width:0}.list-group-item-primary{color:#084298;background-color:#cfe2ff}.list-group-item-primary.list-group-item-action:focus,.list-group-item-primary.list-group-item-action:hover{color:#084298;background-color:#bacbe6}.list-group-item-primary.list-group-item-action.active{color:#fff;background-color:#084298;border-color:#084298}.list-group-item-secondary{color:#41464b;background-color:#e2e3e5}.list-group-item-secondary.list-group-item-action:focus,.list-group-item-secondary.list-group-item-action:hover{color:#41464b;background-color:#cbccce}.list-group-item-secondary.list-group-item-action.active{color:#fff;background-color:#41464b;border-color:#41464b}.list-group-item-success{color:#0f5132;background-color:#d1e7dd}.list-group-item-success.list-group-item-action:focus,.list-group-item-success.list-group-item-action:hover{color:#0f5132;background-color:#bcd0c7}.list-group-item-success.list-group-item-action.active{color:#fff;background-color:#0f5132;border-color:#0f5132}.list-group-item-info{color:#055160;background-color:#cff4fc}.list-group-item-info.list-group-item-action:focus,.list-group-item-info.list-group-item-action:hover{color:#055160;background-color:#badce3}.list-group-item-info.list-group-item-action.active{color:#fff;background-color:#055160;border-color:#055160}.list-group-item-warning{color:#664d03;background-color:#fff3cd}.list-group-item-warning.list-group-item-action:focus,.list-group-item-warning.list-group-item-action:hover{color:#664d03;background-color:#e6dbb9}.list-group-item-warning.list-group-item-action.active{color:#fff;background-color:#664d03;border-color:#664d03}.list-group-item-danger{color:#842029;background-color:#f8d7da}.list-group-item-danger.list-group-item-action:focus,.list-group-item-danger.list-group-item-action:hover{color:#842029;background-color:#dfc2c4}.list-group-item-danger.list-group-item-action.active{color:#fff;background-color:#842029;border-color:#842029}.list-group-item-light{color:#636464;background-color:#fefefe}.list-group-item-light.list-group-item-action:focus,.list-group-item-light.list-group-item-action:hover{color:#636464;background-color:#e5e5e5}.list-group-item-light.list-group-item-action.active{color:#fff;background-color:#636464;border-color:#636464}.list-group-item-dark{color:#141619;background-color:#d3d3d4}.list-group-item-dark.list-group-item-action:focus,.list-group-item-dark.list-group-item-action:hover{color:#141619;background-color:#bebebf}.list-group-item-dark.list-group-item-action.active{color:#fff;background-color:#141619;border-color:#141619}.btn-close{box-sizing:content-box;width:1em;height:1em;padding:.25em .25em;color:#000;background:transparent url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23000'%3e%3cpath d='M.293.293a1 1 0 0 1 1.414 0L8 6.586 14.293.293a1 1 0 1 1 1.414 1.414L9.414 8l6.293 6.293a1 1 0 0 1-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 0 1-1.414-1.414L6.586 8 .293 1.707a1 1 0 0 1 0-1.414z'/%3e%3c/svg%3e\") center/1em auto no-repeat;border:0;border-radius:.375rem;opacity:.5}.btn-close:hover{color:#000;text-decoration:none;opacity:.75}.btn-close:focus{outline:0;box-shadow:0 0 0 .25rem rgba(13,110,253,.25);opacity:1}.btn-close.disabled,.btn-close:disabled{pointer-events:none;-webkit-user-select:none;-moz-user-select:none;user-select:none;opacity:.25}.btn-close-white{filter:invert(1) grayscale(100%) brightness(200%)}.toast{--bs-toast-padding-x:0.75rem;--bs-toast-padding-y:0.5rem;--bs-toast-spacing:1.5rem;--bs-toast-max-width:350px;--bs-toast-font-size:0.875rem;--bs-toast-color: ;--bs-toast-bg:rgba(255, 255, 255, 0.85);--bs-toast-border-width:1px;--bs-toast-border-color:var(--bs-border-color-translucent);--bs-toast-border-radius:0.375rem;--bs-toast-box-shadow:0 0.5rem 1rem rgba(0, 0, 0, 0.15);--bs-toast-header-color:#6c757d;--bs-toast-header-bg:rgba(255, 255, 255, 0.85);--bs-toast-header-border-color:rgba(0, 0, 0, 0.05);width:var(--bs-toast-max-width);max-width:100%;font-size:var(--bs-toast-font-size);color:var(--bs-toast-color);pointer-events:auto;background-color:var(--bs-toast-bg);background-clip:padding-box;border:var(--bs-toast-border-width) solid var(--bs-toast-border-color);box-shadow:var(--bs-toast-box-shadow);border-radius:var(--bs-toast-border-radius)}.toast.showing{opacity:0}.toast:not(.show){display:none}.toast-container{position:absolute;z-index:1090;width:-webkit-max-content;width:-moz-max-content;width:max-content;max-width:100%;pointer-events:none}.toast-container>:not(:last-child){margin-bottom:var(--bs-toast-spacing)}.toast-header{display:flex;align-items:center;padding:var(--bs-toast-padding-y) var(--bs-toast-padding-x);color:var(--bs-toast-header-color);background-color:var(--bs-toast-header-bg);background-clip:padding-box;border-bottom:var(--bs-toast-border-width) solid var(--bs-toast-header-border-color);border-top-left-radius:calc(var(--bs-toast-border-radius) - var(--bs-toast-border-width));border-top-right-radius:calc(var(--bs-toast-border-radius) - var(--bs-toast-border-width))}.toast-header .btn-close{margin-right:calc(var(--bs-toast-padding-x) * -.5);margin-left:var(--bs-toast-padding-x)}.toast-body{padding:var(--bs-toast-padding-x);word-wrap:break-word}.modal{--bs-modal-zindex:1055;--bs-modal-width:500px;--bs-modal-padding:1rem;--bs-modal-margin:0.5rem;--bs-modal-color: ;--bs-modal-bg:#fff;--bs-modal-border-color:var(--bs-border-color-translucent);--bs-modal-border-width:1px;--bs-modal-border-radius:0.5rem;--bs-modal-box-shadow:0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);--bs-modal-inner-border-radius:calc(0.5rem - 1px);--bs-modal-header-padding-x:1rem;--bs-modal-header-padding-y:1rem;--bs-modal-header-padding:1rem 1rem;--bs-modal-header-border-color:var(--bs-border-color);--bs-modal-header-border-width:1px;--bs-modal-title-line-height:1.5;--bs-modal-footer-gap:0.5rem;--bs-modal-footer-bg: ;--bs-modal-footer-border-color:var(--bs-border-color);--bs-modal-footer-border-width:1px;position:fixed;top:0;left:0;z-index:var(--bs-modal-zindex);display:none;width:100%;height:100%;overflow-x:hidden;overflow-y:auto;outline:0}.modal-dialog{position:relative;width:auto;margin:var(--bs-modal-margin);pointer-events:none}.modal.fade .modal-dialog{transition:transform .3s ease-out;transform:translate(0,-50px)}@media (prefers-reduced-motion:reduce){.modal.fade .modal-dialog{transition:none}}.modal.show .modal-dialog{transform:none}.modal.modal-static .modal-dialog{transform:scale(1.02)}.modal-dialog-scrollable{height:calc(100% - var(--bs-modal-margin) * 2)}.modal-dialog-scrollable .modal-content{max-height:100%;overflow:hidden}.modal-dialog-scrollable .modal-body{overflow-y:auto}.modal-dialog-centered{display:flex;align-items:center;min-height:calc(100% - var(--bs-modal-margin) * 2)}.modal-content{position:relative;display:flex;flex-direction:column;width:100%;color:var(--bs-modal-color);pointer-events:auto;background-color:var(--bs-modal-bg);background-clip:padding-box;border:var(--bs-modal-border-width) solid var(--bs-modal-border-color);border-radius:var(--bs-modal-border-radius);outline:0}.modal-backdrop{--bs-backdrop-zindex:1050;--bs-backdrop-bg:#000;--bs-backdrop-opacity:0.5;position:fixed;top:0;left:0;z-index:var(--bs-backdrop-zindex);width:100vw;height:100vh;background-color:var(--bs-backdrop-bg)}.modal-backdrop.fade{opacity:0}.modal-backdrop.show{opacity:var(--bs-backdrop-opacity)}.modal-header{display:flex;flex-shrink:0;align-items:center;justify-content:space-between;padding:var(--bs-modal-header-padding);border-bottom:var(--bs-modal-header-border-width) solid var(--bs-modal-header-border-color);border-top-left-radius:var(--bs-modal-inner-border-radius);border-top-right-radius:var(--bs-modal-inner-border-radius)}.modal-header .btn-close{padding:calc(var(--bs-modal-header-padding-y) * .5) calc(var(--bs-modal-header-padding-x) * .5);margin:calc(var(--bs-modal-header-padding-y) * -.5) calc(var(--bs-modal-header-padding-x) * -.5) calc(var(--bs-modal-header-padding-y) * -.5) auto}.modal-title{margin-bottom:0;line-height:var(--bs-modal-title-line-height)}.modal-body{position:relative;flex:1 1 auto;padding:var(--bs-modal-padding)}.modal-footer{display:flex;flex-shrink:0;flex-wrap:wrap;align-items:center;justify-content:flex-end;padding:calc(var(--bs-modal-padding) - var(--bs-modal-footer-gap) * .5);background-color:var(--bs-modal-footer-bg);border-top:var(--bs-modal-footer-border-width) solid var(--bs-modal-footer-border-color);border-bottom-right-radius:var(--bs-modal-inner-border-radius);border-bottom-left-radius:var(--bs-modal-inner-border-radius)}.modal-footer>*{margin:calc(var(--bs-modal-footer-gap) * .5)}@media (min-width:576px){.modal{--bs-modal-margin:1.75rem;--bs-modal-box-shadow:0 0.5rem 1rem rgba(0, 0, 0, 0.15)}.modal-dialog{max-width:var(--bs-modal-width);margin-right:auto;margin-left:auto}.modal-sm{--bs-modal-width:300px}}@media (min-width:992px){.modal-lg,.modal-xl{--bs-modal-width:800px}}@media (min-width:1200px){.modal-xl{--bs-modal-width:1140px}}.modal-fullscreen{width:100vw;max-width:none;height:100%;margin:0}.modal-fullscreen .modal-content{height:100%;border:0;border-radius:0}.modal-fullscreen .modal-footer,.modal-fullscreen .modal-header{border-radius:0}.modal-fullscreen .modal-body{overflow-y:auto}@media (max-width:575.98px){.modal-fullscreen-sm-down{width:100vw;max-width:none;height:100%;margin:0}.modal-fullscreen-sm-down .modal-content{height:100%;border:0;border-radius:0}.modal-fullscreen-sm-down .modal-footer,.modal-fullscreen-sm-down .modal-header{border-radius:0}.modal-fullscreen-sm-down .modal-body{overflow-y:auto}}@media (max-width:767.98px){.modal-fullscreen-md-down{width:100vw;max-width:none;height:100%;margin:0}.modal-fullscreen-md-down .modal-content{height:100%;border:0;border-radius:0}.modal-fullscreen-md-down .modal-footer,.modal-fullscreen-md-down .modal-header{border-radius:0}.modal-fullscreen-md-down .modal-body{overflow-y:auto}}@media (max-width:991.98px){.modal-fullscreen-lg-down{width:100vw;max-width:none;height:100%;margin:0}.modal-fullscreen-lg-down .modal-content{height:100%;border:0;border-radius:0}.modal-fullscreen-lg-down .modal-footer,.modal-fullscreen-lg-down .modal-header{border-radius:0}.modal-fullscreen-lg-down .modal-body{overflow-y:auto}}@media (max-width:1199.98px){.modal-fullscreen-xl-down{width:100vw;max-width:none;height:100%;margin:0}.modal-fullscreen-xl-down .modal-content{height:100%;border:0;border-radius:0}.modal-fullscreen-xl-down .modal-footer,.modal-fullscreen-xl-down .modal-header{border-radius:0}.modal-fullscreen-xl-down .modal-body{overflow-y:auto}}@media (max-width:1399.98px){.modal-fullscreen-xxl-down{width:100vw;max-width:none;height:100%;margin:0}.modal-fullscreen-xxl-down .modal-content{height:100%;border:0;border-radius:0}.modal-fullscreen-xxl-down .modal-footer,.modal-fullscreen-xxl-down .modal-header{border-radius:0}.modal-fullscreen-xxl-down .modal-body{overflow-y:auto}}.tooltip{--bs-tooltip-zindex:1080;--bs-tooltip-max-width:200px;--bs-tooltip-padding-x:0.5rem;--bs-tooltip-padding-y:0.25rem;--bs-tooltip-margin: ;--bs-tooltip-font-size:0.875rem;--bs-tooltip-color:#fff;--bs-tooltip-bg:#000;--bs-tooltip-border-radius:0.375rem;--bs-tooltip-opacity:0.9;--bs-tooltip-arrow-width:0.8rem;--bs-tooltip-arrow-height:0.4rem;z-index:var(--bs-tooltip-zindex);display:block;padding:var(--bs-tooltip-arrow-height);margin:var(--bs-tooltip-margin);font-family:var(--bs-font-sans-serif);font-style:normal;font-weight:400;line-height:1.5;text-align:left;text-align:start;text-decoration:none;text-shadow:none;text-transform:none;letter-spacing:normal;word-break:normal;white-space:normal;word-spacing:normal;line-break:auto;font-size:var(--bs-tooltip-font-size);word-wrap:break-word;opacity:0}.tooltip.show{opacity:var(--bs-tooltip-opacity)}.tooltip .tooltip-arrow{display:block;width:var(--bs-tooltip-arrow-width);height:var(--bs-tooltip-arrow-height)}.tooltip .tooltip-arrow::before{position:absolute;content:\"\";border-color:transparent;border-style:solid}.bs-tooltip-auto[data-popper-placement^=top] .tooltip-arrow,.bs-tooltip-top .tooltip-arrow{bottom:0}.bs-tooltip-auto[data-popper-placement^=top] .tooltip-arrow::before,.bs-tooltip-top .tooltip-arrow::before{top:-1px;border-width:var(--bs-tooltip-arrow-height) calc(var(--bs-tooltip-arrow-width) * .5) 0;border-top-color:var(--bs-tooltip-bg)}.bs-tooltip-auto[data-popper-placement^=right] .tooltip-arrow,.bs-tooltip-end .tooltip-arrow{left:0;width:var(--bs-tooltip-arrow-height);height:var(--bs-tooltip-arrow-width)}.bs-tooltip-auto[data-popper-placement^=right] .tooltip-arrow::before,.bs-tooltip-end .tooltip-arrow::before{right:-1px;border-width:calc(var(--bs-tooltip-arrow-width) * .5) var(--bs-tooltip-arrow-height) calc(var(--bs-tooltip-arrow-width) * .5) 0;border-right-color:var(--bs-tooltip-bg)}.bs-tooltip-auto[data-popper-placement^=bottom] .tooltip-arrow,.bs-tooltip-bottom .tooltip-arrow{top:0}.bs-tooltip-auto[data-popper-placement^=bottom] .tooltip-arrow::before,.bs-tooltip-bottom .tooltip-arrow::before{bottom:-1px;border-width:0 calc(var(--bs-tooltip-arrow-width) * .5) var(--bs-tooltip-arrow-height);border-bottom-color:var(--bs-tooltip-bg)}.bs-tooltip-auto[data-popper-placement^=left] .tooltip-arrow,.bs-tooltip-start .tooltip-arrow{right:0;width:var(--bs-tooltip-arrow-height);height:var(--bs-tooltip-arrow-width)}.bs-tooltip-auto[data-popper-placement^=left] .tooltip-arrow::before,.bs-tooltip-start .tooltip-arrow::before{left:-1px;border-width:calc(var(--bs-tooltip-arrow-width) * .5) 0 calc(var(--bs-tooltip-arrow-width) * .5) var(--bs-tooltip-arrow-height);border-left-color:var(--bs-tooltip-bg)}.tooltip-inner{max-width:var(--bs-tooltip-max-width);padding:var(--bs-tooltip-padding-y) var(--bs-tooltip-padding-x);color:var(--bs-tooltip-color);text-align:center;background-color:var(--bs-tooltip-bg);border-radius:var(--bs-tooltip-border-radius)}.popover{--bs-popover-zindex:1070;--bs-popover-max-width:276px;--bs-popover-font-size:0.875rem;--bs-popover-bg:#fff;--bs-popover-border-width:1px;--bs-popover-border-color:var(--bs-border-color-translucent);--bs-popover-border-radius:0.5rem;--bs-popover-inner-border-radius:calc(0.5rem - 1px);--bs-popover-box-shadow:0 0.5rem 1rem rgba(0, 0, 0, 0.15);--bs-popover-header-padding-x:1rem;--bs-popover-header-padding-y:0.5rem;--bs-popover-header-font-size:1rem;--bs-popover-header-color:var(--bs-heading-color);--bs-popover-header-bg:#f0f0f0;--bs-popover-body-padding-x:1rem;--bs-popover-body-padding-y:1rem;--bs-popover-body-color:#212529;--bs-popover-arrow-width:1rem;--bs-popover-arrow-height:0.5rem;--bs-popover-arrow-border:var(--bs-popover-border-color);z-index:var(--bs-popover-zindex);display:block;max-width:var(--bs-popover-max-width);font-family:var(--bs-font-sans-serif);font-style:normal;font-weight:400;line-height:1.5;text-align:left;text-align:start;text-decoration:none;text-shadow:none;text-transform:none;letter-spacing:normal;word-break:normal;white-space:normal;word-spacing:normal;line-break:auto;font-size:var(--bs-popover-font-size);word-wrap:break-word;background-color:var(--bs-popover-bg);background-clip:padding-box;border:var(--bs-popover-border-width) solid var(--bs-popover-border-color);border-radius:var(--bs-popover-border-radius)}.popover .popover-arrow{display:block;width:var(--bs-popover-arrow-width);height:var(--bs-popover-arrow-height)}.popover .popover-arrow::after,.popover .popover-arrow::before{position:absolute;display:block;content:\"\";border-color:transparent;border-style:solid;border-width:0}.bs-popover-auto[data-popper-placement^=top]>.popover-arrow,.bs-popover-top>.popover-arrow{bottom:calc(var(--bs-popover-arrow-height) * -1 - var(--bs-popover-border-width))}.bs-popover-auto[data-popper-placement^=top]>.popover-arrow::after,.bs-popover-auto[data-popper-placement^=top]>.popover-arrow::before,.bs-popover-top>.popover-arrow::after,.bs-popover-top>.popover-arrow::before{border-width:var(--bs-popover-arrow-height) calc(var(--bs-popover-arrow-width) * .5) 0}.bs-popover-auto[data-popper-placement^=top]>.popover-arrow::before,.bs-popover-top>.popover-arrow::before{bottom:0;border-top-color:var(--bs-popover-arrow-border)}.bs-popover-auto[data-popper-placement^=top]>.popover-arrow::after,.bs-popover-top>.popover-arrow::after{bottom:var(--bs-popover-border-width);border-top-color:var(--bs-popover-bg)}.bs-popover-auto[data-popper-placement^=right]>.popover-arrow,.bs-popover-end>.popover-arrow{left:calc(var(--bs-popover-arrow-height) * -1 - var(--bs-popover-border-width));width:var(--bs-popover-arrow-height);height:var(--bs-popover-arrow-width)}.bs-popover-auto[data-popper-placement^=right]>.popover-arrow::after,.bs-popover-auto[data-popper-placement^=right]>.popover-arrow::before,.bs-popover-end>.popover-arrow::after,.bs-popover-end>.popover-arrow::before{border-width:calc(var(--bs-popover-arrow-width) * .5) var(--bs-popover-arrow-height) calc(var(--bs-popover-arrow-width) * .5) 0}.bs-popover-auto[data-popper-placement^=right]>.popover-arrow::before,.bs-popover-end>.popover-arrow::before{left:0;border-right-color:var(--bs-popover-arrow-border)}.bs-popover-auto[data-popper-placement^=right]>.popover-arrow::after,.bs-popover-end>.popover-arrow::after{left:var(--bs-popover-border-width);border-right-color:var(--bs-popover-bg)}.bs-popover-auto[data-popper-placement^=bottom]>.popover-arrow,.bs-popover-bottom>.popover-arrow{top:calc(var(--bs-popover-arrow-height) * -1 - var(--bs-popover-border-width))}.bs-popover-auto[data-popper-placement^=bottom]>.popover-arrow::after,.bs-popover-auto[data-popper-placement^=bottom]>.popover-arrow::before,.bs-popover-bottom>.popover-arrow::after,.bs-popover-bottom>.popover-arrow::before{border-width:0 calc(var(--bs-popover-arrow-width) * .5) var(--bs-popover-arrow-height)}.bs-popover-auto[data-popper-placement^=bottom]>.popover-arrow::before,.bs-popover-bottom>.popover-arrow::before{top:0;border-bottom-color:var(--bs-popover-arrow-border)}.bs-popover-auto[data-popper-placement^=bottom]>.popover-arrow::after,.bs-popover-bottom>.popover-arrow::after{top:var(--bs-popover-border-width);border-bottom-color:var(--bs-popover-bg)}.bs-popover-auto[data-popper-placement^=bottom] .popover-header::before,.bs-popover-bottom .popover-header::before{position:absolute;top:0;left:50%;display:block;width:var(--bs-popover-arrow-width);margin-left:calc(var(--bs-popover-arrow-width) * -.5);content:\"\";border-bottom:var(--bs-popover-border-width) solid var(--bs-popover-header-bg)}.bs-popover-auto[data-popper-placement^=left]>.popover-arrow,.bs-popover-start>.popover-arrow{right:calc(var(--bs-popover-arrow-height) * -1 - var(--bs-popover-border-width));width:var(--bs-popover-arrow-height);height:var(--bs-popover-arrow-width)}.bs-popover-auto[data-popper-placement^=left]>.popover-arrow::after,.bs-popover-auto[data-popper-placement^=left]>.popover-arrow::before,.bs-popover-start>.popover-arrow::after,.bs-popover-start>.popover-arrow::before{border-width:calc(var(--bs-popover-arrow-width) * .5) 0 calc(var(--bs-popover-arrow-width) * .5) var(--bs-popover-arrow-height)}.bs-popover-auto[data-popper-placement^=left]>.popover-arrow::before,.bs-popover-start>.popover-arrow::before{right:0;border-left-color:var(--bs-popover-arrow-border)}.bs-popover-auto[data-popper-placement^=left]>.popover-arrow::after,.bs-popover-start>.popover-arrow::after{right:var(--bs-popover-border-width);border-left-color:var(--bs-popover-bg)}.popover-header{padding:var(--bs-popover-header-padding-y) var(--bs-popover-header-padding-x);margin-bottom:0;font-size:var(--bs-popover-header-font-size);color:var(--bs-popover-header-color);background-color:var(--bs-popover-header-bg);border-bottom:var(--bs-popover-border-width) solid var(--bs-popover-border-color);border-top-left-radius:var(--bs-popover-inner-border-radius);border-top-right-radius:var(--bs-popover-inner-border-radius)}.popover-header:empty{display:none}.popover-body{padding:var(--bs-popover-body-padding-y) var(--bs-popover-body-padding-x);color:var(--bs-popover-body-color)}.carousel{position:relative}.carousel.pointer-event{touch-action:pan-y}.carousel-inner{position:relative;width:100%;overflow:hidden}.carousel-inner::after{display:block;clear:both;content:\"\"}.carousel-item{position:relative;display:none;float:left;width:100%;margin-right:-100%;-webkit-backface-visibility:hidden;backface-visibility:hidden;transition:transform .6s ease-in-out}@media (prefers-reduced-motion:reduce){.carousel-item{transition:none}}.carousel-item-next,.carousel-item-prev,.carousel-item.active{display:block}.active.carousel-item-end,.carousel-item-next:not(.carousel-item-start){transform:translateX(100%)}.active.carousel-item-start,.carousel-item-prev:not(.carousel-item-end){transform:translateX(-100%)}.carousel-fade .carousel-item{opacity:0;transition-property:opacity;transform:none}.carousel-fade .carousel-item-next.carousel-item-start,.carousel-fade .carousel-item-prev.carousel-item-end,.carousel-fade .carousel-item.active{z-index:1;opacity:1}.carousel-fade .active.carousel-item-end,.carousel-fade .active.carousel-item-start{z-index:0;opacity:0;transition:opacity 0s .6s}@media (prefers-reduced-motion:reduce){.carousel-fade .active.carousel-item-end,.carousel-fade .active.carousel-item-start{transition:none}}.carousel-control-next,.carousel-control-prev{position:absolute;top:0;bottom:0;z-index:1;display:flex;align-items:center;justify-content:center;width:15%;padding:0;color:#fff;text-align:center;background:0 0;border:0;opacity:.5;transition:opacity .15s ease}@media (prefers-reduced-motion:reduce){.carousel-control-next,.carousel-control-prev{transition:none}}.carousel-control-next:focus,.carousel-control-next:hover,.carousel-control-prev:focus,.carousel-control-prev:hover{color:#fff;text-decoration:none;outline:0;opacity:.9}.carousel-control-prev{left:0}.carousel-control-next{right:0}.carousel-control-next-icon,.carousel-control-prev-icon{display:inline-block;width:2rem;height:2rem;background-repeat:no-repeat;background-position:50%;background-size:100% 100%}.carousel-control-prev-icon{background-image:url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23fff'%3e%3cpath d='M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z'/%3e%3c/svg%3e\")}.carousel-control-next-icon{background-image:url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23fff'%3e%3cpath d='M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z'/%3e%3c/svg%3e\")}.carousel-indicators{position:absolute;right:0;bottom:0;left:0;z-index:2;display:flex;justify-content:center;padding:0;margin-right:15%;margin-bottom:1rem;margin-left:15%;list-style:none}.carousel-indicators [data-bs-target]{box-sizing:content-box;flex:0 1 auto;width:30px;height:3px;padding:0;margin-right:3px;margin-left:3px;text-indent:-999px;cursor:pointer;background-color:#fff;background-clip:padding-box;border:0;border-top:10px solid transparent;border-bottom:10px solid transparent;opacity:.5;transition:opacity .6s ease}@media (prefers-reduced-motion:reduce){.carousel-indicators [data-bs-target]{transition:none}}.carousel-indicators .active{opacity:1}.carousel-caption{position:absolute;right:15%;bottom:1.25rem;left:15%;padding-top:1.25rem;padding-bottom:1.25rem;color:#fff;text-align:center}.carousel-dark .carousel-control-next-icon,.carousel-dark .carousel-control-prev-icon{filter:invert(1) grayscale(100)}.carousel-dark .carousel-indicators [data-bs-target]{background-color:#000}.carousel-dark .carousel-caption{color:#000}.spinner-border,.spinner-grow{display:inline-block;width:var(--bs-spinner-width);height:var(--bs-spinner-height);vertical-align:var(--bs-spinner-vertical-align);border-radius:50%;-webkit-animation:var(--bs-spinner-animation-speed) linear infinite var(--bs-spinner-animation-name);animation:var(--bs-spinner-animation-speed) linear infinite var(--bs-spinner-animation-name)}@-webkit-keyframes spinner-border{to{transform:rotate(360deg)}}@keyframes spinner-border{to{transform:rotate(360deg)}}.spinner-border{--bs-spinner-width:2rem;--bs-spinner-height:2rem;--bs-spinner-vertical-align:-0.125em;--bs-spinner-border-width:0.25em;--bs-spinner-animation-speed:0.75s;--bs-spinner-animation-name:spinner-border;border:var(--bs-spinner-border-width) solid currentcolor;border-right-color:transparent}.spinner-border-sm{--bs-spinner-width:1rem;--bs-spinner-height:1rem;--bs-spinner-border-width:0.2em}@-webkit-keyframes spinner-grow{0%{transform:scale(0)}50%{opacity:1;transform:none}}@keyframes spinner-grow{0%{transform:scale(0)}50%{opacity:1;transform:none}}.spinner-grow{--bs-spinner-width:2rem;--bs-spinner-height:2rem;--bs-spinner-vertical-align:-0.125em;--bs-spinner-animation-speed:0.75s;--bs-spinner-animation-name:spinner-grow;background-color:currentcolor;opacity:0}.spinner-grow-sm{--bs-spinner-width:1rem;--bs-spinner-height:1rem}@media (prefers-reduced-motion:reduce){.spinner-border,.spinner-grow{--bs-spinner-animation-speed:1.5s}}.offcanvas,.offcanvas-lg,.offcanvas-md,.offcanvas-sm,.offcanvas-xl,.offcanvas-xxl{--bs-offcanvas-width:400px;--bs-offcanvas-height:30vh;--bs-offcanvas-padding-x:1rem;--bs-offcanvas-padding-y:1rem;--bs-offcanvas-color: ;--bs-offcanvas-bg:#fff;--bs-offcanvas-border-width:1px;--bs-offcanvas-border-color:var(--bs-border-color-translucent);--bs-offcanvas-box-shadow:0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)}@media (max-width:575.98px){.offcanvas-sm{position:fixed;bottom:0;z-index:1045;display:flex;flex-direction:column;max-width:100%;color:var(--bs-offcanvas-color);visibility:hidden;background-color:var(--bs-offcanvas-bg);background-clip:padding-box;outline:0;transition:transform .3s ease-in-out}}@media (max-width:575.98px) and (prefers-reduced-motion:reduce){.offcanvas-sm{transition:none}}@media (max-width:575.98px){.offcanvas-sm.offcanvas-start{top:0;left:0;width:var(--bs-offcanvas-width);border-right:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateX(-100%)}}@media (max-width:575.98px){.offcanvas-sm.offcanvas-end{top:0;right:0;width:var(--bs-offcanvas-width);border-left:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateX(100%)}}@media (max-width:575.98px){.offcanvas-sm.offcanvas-top{top:0;right:0;left:0;height:var(--bs-offcanvas-height);max-height:100%;border-bottom:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateY(-100%)}}@media (max-width:575.98px){.offcanvas-sm.offcanvas-bottom{right:0;left:0;height:var(--bs-offcanvas-height);max-height:100%;border-top:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateY(100%)}}@media (max-width:575.98px){.offcanvas-sm.show:not(.hiding),.offcanvas-sm.showing{transform:none}}@media (max-width:575.98px){.offcanvas-sm.hiding,.offcanvas-sm.show,.offcanvas-sm.showing{visibility:visible}}@media (min-width:576px){.offcanvas-sm{--bs-offcanvas-height:auto;--bs-offcanvas-border-width:0;background-color:transparent!important}.offcanvas-sm .offcanvas-header{display:none}.offcanvas-sm .offcanvas-body{display:flex;flex-grow:0;padding:0;overflow-y:visible;background-color:transparent!important}}@media (max-width:767.98px){.offcanvas-md{position:fixed;bottom:0;z-index:1045;display:flex;flex-direction:column;max-width:100%;color:var(--bs-offcanvas-color);visibility:hidden;background-color:var(--bs-offcanvas-bg);background-clip:padding-box;outline:0;transition:transform .3s ease-in-out}}@media (max-width:767.98px) and (prefers-reduced-motion:reduce){.offcanvas-md{transition:none}}@media (max-width:767.98px){.offcanvas-md.offcanvas-start{top:0;left:0;width:var(--bs-offcanvas-width);border-right:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateX(-100%)}}@media (max-width:767.98px){.offcanvas-md.offcanvas-end{top:0;right:0;width:var(--bs-offcanvas-width);border-left:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateX(100%)}}@media (max-width:767.98px){.offcanvas-md.offcanvas-top{top:0;right:0;left:0;height:var(--bs-offcanvas-height);max-height:100%;border-bottom:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateY(-100%)}}@media (max-width:767.98px){.offcanvas-md.offcanvas-bottom{right:0;left:0;height:var(--bs-offcanvas-height);max-height:100%;border-top:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateY(100%)}}@media (max-width:767.98px){.offcanvas-md.show:not(.hiding),.offcanvas-md.showing{transform:none}}@media (max-width:767.98px){.offcanvas-md.hiding,.offcanvas-md.show,.offcanvas-md.showing{visibility:visible}}@media (min-width:768px){.offcanvas-md{--bs-offcanvas-height:auto;--bs-offcanvas-border-width:0;background-color:transparent!important}.offcanvas-md .offcanvas-header{display:none}.offcanvas-md .offcanvas-body{display:flex;flex-grow:0;padding:0;overflow-y:visible;background-color:transparent!important}}@media (max-width:991.98px){.offcanvas-lg{position:fixed;bottom:0;z-index:1045;display:flex;flex-direction:column;max-width:100%;color:var(--bs-offcanvas-color);visibility:hidden;background-color:var(--bs-offcanvas-bg);background-clip:padding-box;outline:0;transition:transform .3s ease-in-out}}@media (max-width:991.98px) and (prefers-reduced-motion:reduce){.offcanvas-lg{transition:none}}@media (max-width:991.98px){.offcanvas-lg.offcanvas-start{top:0;left:0;width:var(--bs-offcanvas-width);border-right:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateX(-100%)}}@media (max-width:991.98px){.offcanvas-lg.offcanvas-end{top:0;right:0;width:var(--bs-offcanvas-width);border-left:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateX(100%)}}@media (max-width:991.98px){.offcanvas-lg.offcanvas-top{top:0;right:0;left:0;height:var(--bs-offcanvas-height);max-height:100%;border-bottom:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateY(-100%)}}@media (max-width:991.98px){.offcanvas-lg.offcanvas-bottom{right:0;left:0;height:var(--bs-offcanvas-height);max-height:100%;border-top:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateY(100%)}}@media (max-width:991.98px){.offcanvas-lg.show:not(.hiding),.offcanvas-lg.showing{transform:none}}@media (max-width:991.98px){.offcanvas-lg.hiding,.offcanvas-lg.show,.offcanvas-lg.showing{visibility:visible}}@media (min-width:992px){.offcanvas-lg{--bs-offcanvas-height:auto;--bs-offcanvas-border-width:0;background-color:transparent!important}.offcanvas-lg .offcanvas-header{display:none}.offcanvas-lg .offcanvas-body{display:flex;flex-grow:0;padding:0;overflow-y:visible;background-color:transparent!important}}@media (max-width:1199.98px){.offcanvas-xl{position:fixed;bottom:0;z-index:1045;display:flex;flex-direction:column;max-width:100%;color:var(--bs-offcanvas-color);visibility:hidden;background-color:var(--bs-offcanvas-bg);background-clip:padding-box;outline:0;transition:transform .3s ease-in-out}}@media (max-width:1199.98px) and (prefers-reduced-motion:reduce){.offcanvas-xl{transition:none}}@media (max-width:1199.98px){.offcanvas-xl.offcanvas-start{top:0;left:0;width:var(--bs-offcanvas-width);border-right:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateX(-100%)}}@media (max-width:1199.98px){.offcanvas-xl.offcanvas-end{top:0;right:0;width:var(--bs-offcanvas-width);border-left:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateX(100%)}}@media (max-width:1199.98px){.offcanvas-xl.offcanvas-top{top:0;right:0;left:0;height:var(--bs-offcanvas-height);max-height:100%;border-bottom:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateY(-100%)}}@media (max-width:1199.98px){.offcanvas-xl.offcanvas-bottom{right:0;left:0;height:var(--bs-offcanvas-height);max-height:100%;border-top:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateY(100%)}}@media (max-width:1199.98px){.offcanvas-xl.show:not(.hiding),.offcanvas-xl.showing{transform:none}}@media (max-width:1199.98px){.offcanvas-xl.hiding,.offcanvas-xl.show,.offcanvas-xl.showing{visibility:visible}}@media (min-width:1200px){.offcanvas-xl{--bs-offcanvas-height:auto;--bs-offcanvas-border-width:0;background-color:transparent!important}.offcanvas-xl .offcanvas-header{display:none}.offcanvas-xl .offcanvas-body{display:flex;flex-grow:0;padding:0;overflow-y:visible;background-color:transparent!important}}@media (max-width:1399.98px){.offcanvas-xxl{position:fixed;bottom:0;z-index:1045;display:flex;flex-direction:column;max-width:100%;color:var(--bs-offcanvas-color);visibility:hidden;background-color:var(--bs-offcanvas-bg);background-clip:padding-box;outline:0;transition:transform .3s ease-in-out}}@media (max-width:1399.98px) and (prefers-reduced-motion:reduce){.offcanvas-xxl{transition:none}}@media (max-width:1399.98px){.offcanvas-xxl.offcanvas-start{top:0;left:0;width:var(--bs-offcanvas-width);border-right:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateX(-100%)}}@media (max-width:1399.98px){.offcanvas-xxl.offcanvas-end{top:0;right:0;width:var(--bs-offcanvas-width);border-left:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateX(100%)}}@media (max-width:1399.98px){.offcanvas-xxl.offcanvas-top{top:0;right:0;left:0;height:var(--bs-offcanvas-height);max-height:100%;border-bottom:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateY(-100%)}}@media (max-width:1399.98px){.offcanvas-xxl.offcanvas-bottom{right:0;left:0;height:var(--bs-offcanvas-height);max-height:100%;border-top:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateY(100%)}}@media (max-width:1399.98px){.offcanvas-xxl.show:not(.hiding),.offcanvas-xxl.showing{transform:none}}@media (max-width:1399.98px){.offcanvas-xxl.hiding,.offcanvas-xxl.show,.offcanvas-xxl.showing{visibility:visible}}@media (min-width:1400px){.offcanvas-xxl{--bs-offcanvas-height:auto;--bs-offcanvas-border-width:0;background-color:transparent!important}.offcanvas-xxl .offcanvas-header{display:none}.offcanvas-xxl .offcanvas-body{display:flex;flex-grow:0;padding:0;overflow-y:visible;background-color:transparent!important}}.offcanvas{position:fixed;bottom:0;z-index:1045;display:flex;flex-direction:column;max-width:100%;color:var(--bs-offcanvas-color);visibility:hidden;background-color:var(--bs-offcanvas-bg);background-clip:padding-box;outline:0;transition:transform .3s ease-in-out}@media (prefers-reduced-motion:reduce){.offcanvas{transition:none}}.offcanvas.offcanvas-start{top:0;left:0;width:var(--bs-offcanvas-width);border-right:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateX(-100%)}.offcanvas.offcanvas-end{top:0;right:0;width:var(--bs-offcanvas-width);border-left:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateX(100%)}.offcanvas.offcanvas-top{top:0;right:0;left:0;height:var(--bs-offcanvas-height);max-height:100%;border-bottom:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateY(-100%)}.offcanvas.offcanvas-bottom{right:0;left:0;height:var(--bs-offcanvas-height);max-height:100%;border-top:var(--bs-offcanvas-border-width) solid var(--bs-offcanvas-border-color);transform:translateY(100%)}.offcanvas.show:not(.hiding),.offcanvas.showing{transform:none}.offcanvas.hiding,.offcanvas.show,.offcanvas.showing{visibility:visible}.offcanvas-backdrop{position:fixed;top:0;left:0;z-index:1040;width:100vw;height:100vh;background-color:#000}.offcanvas-backdrop.fade{opacity:0}.offcanvas-backdrop.show{opacity:.5}.offcanvas-header{display:flex;align-items:center;justify-content:space-between;padding:var(--bs-offcanvas-padding-y) var(--bs-offcanvas-padding-x)}.offcanvas-header .btn-close{padding:calc(var(--bs-offcanvas-padding-y) * .5) calc(var(--bs-offcanvas-padding-x) * .5);margin-top:calc(var(--bs-offcanvas-padding-y) * -.5);margin-right:calc(var(--bs-offcanvas-padding-x) * -.5);margin-bottom:calc(var(--bs-offcanvas-padding-y) * -.5)}.offcanvas-title{margin-bottom:0;line-height:1.5}.offcanvas-body{flex-grow:1;padding:var(--bs-offcanvas-padding-y) var(--bs-offcanvas-padding-x);overflow-y:auto}.placeholder{display:inline-block;min-height:1em;vertical-align:middle;cursor:wait;background-color:currentcolor;opacity:.5}.placeholder.btn::before{display:inline-block;content:\"\"}.placeholder-xs{min-height:.6em}.placeholder-sm{min-height:.8em}.placeholder-lg{min-height:1.2em}.placeholder-glow .placeholder{-webkit-animation:placeholder-glow 2s ease-in-out infinite;animation:placeholder-glow 2s ease-in-out infinite}@-webkit-keyframes placeholder-glow{50%{opacity:.2}}@keyframes placeholder-glow{50%{opacity:.2}}.placeholder-wave{-webkit-mask-image:linear-gradient(130deg,#000 55%,rgba(0,0,0,0.8) 75%,#000 95%);mask-image:linear-gradient(130deg,#000 55%,rgba(0,0,0,0.8) 75%,#000 95%);-webkit-mask-size:200% 100%;mask-size:200% 100%;-webkit-animation:placeholder-wave 2s linear infinite;animation:placeholder-wave 2s linear infinite}@-webkit-keyframes placeholder-wave{100%{-webkit-mask-position:-200% 0%;mask-position:-200% 0%}}@keyframes placeholder-wave{100%{-webkit-mask-position:-200% 0%;mask-position:-200% 0%}}.clearfix::after{display:block;clear:both;content:\"\"}.text-bg-primary{color:#fff!important;background-color:RGBA(13,110,253,var(--bs-bg-opacity,1))!important}.text-bg-secondary{color:#fff!important;background-color:RGBA(108,117,125,var(--bs-bg-opacity,1))!important}.text-bg-success{color:#fff!important;background-color:RGBA(25,135,84,var(--bs-bg-opacity,1))!important}.text-bg-info{color:#000!important;background-color:RGBA(13,202,240,var(--bs-bg-opacity,1))!important}.text-bg-warning{color:#000!important;background-color:RGBA(255,193,7,var(--bs-bg-opacity,1))!important}.text-bg-danger{color:#fff!important;background-color:RGBA(220,53,69,var(--bs-bg-opacity,1))!important}.text-bg-light{color:#000!important;background-color:RGBA(248,249,250,var(--bs-bg-opacity,1))!important}.text-bg-dark{color:#fff!important;background-color:RGBA(33,37,41,var(--bs-bg-opacity,1))!important}.link-primary{color:#0d6efd!important}.link-primary:focus,.link-primary:hover{color:#0a58ca!important}.link-secondary{color:#6c757d!important}.link-secondary:focus,.link-secondary:hover{color:#565e64!important}.link-success{color:#198754!important}.link-success:focus,.link-success:hover{color:#146c43!important}.link-info{color:#0dcaf0!important}.link-info:focus,.link-info:hover{color:#3dd5f3!important}.link-warning{color:#ffc107!important}.link-warning:focus,.link-warning:hover{color:#ffcd39!important}.link-danger{color:#dc3545!important}.link-danger:focus,.link-danger:hover{color:#b02a37!important}.link-light{color:#f8f9fa!important}.link-light:focus,.link-light:hover{color:#f9fafb!important}.link-dark{color:#212529!important}.link-dark:focus,.link-dark:hover{color:#1a1e21!important}.ratio{position:relative;width:100%}.ratio::before{display:block;padding-top:var(--bs-aspect-ratio);content:\"\"}.ratio>*{position:absolute;top:0;left:0;width:100%;height:100%}.ratio-1x1{--bs-aspect-ratio:100%}.ratio-4x3{--bs-aspect-ratio:75%}.ratio-16x9{--bs-aspect-ratio:56.25%}.ratio-21x9{--bs-aspect-ratio:42.8571428571%}.fixed-top{position:fixed;top:0;right:0;left:0;z-index:1030}.fixed-bottom{position:fixed;right:0;bottom:0;left:0;z-index:1030}.sticky-top{position:-webkit-sticky;position:sticky;top:0;z-index:1020}.sticky-bottom{position:-webkit-sticky;position:sticky;bottom:0;z-index:1020}@media (min-width:576px){.sticky-sm-top{position:-webkit-sticky;position:sticky;top:0;z-index:1020}.sticky-sm-bottom{position:-webkit-sticky;position:sticky;bottom:0;z-index:1020}}@media (min-width:768px){.sticky-md-top{position:-webkit-sticky;position:sticky;top:0;z-index:1020}.sticky-md-bottom{position:-webkit-sticky;position:sticky;bottom:0;z-index:1020}}@media (min-width:992px){.sticky-lg-top{position:-webkit-sticky;position:sticky;top:0;z-index:1020}.sticky-lg-bottom{position:-webkit-sticky;position:sticky;bottom:0;z-index:1020}}@media (min-width:1200px){.sticky-xl-top{position:-webkit-sticky;position:sticky;top:0;z-index:1020}.sticky-xl-bottom{position:-webkit-sticky;position:sticky;bottom:0;z-index:1020}}@media (min-width:1400px){.sticky-xxl-top{position:-webkit-sticky;position:sticky;top:0;z-index:1020}.sticky-xxl-bottom{position:-webkit-sticky;position:sticky;bottom:0;z-index:1020}}.hstack{display:flex;flex-direction:row;align-items:center;align-self:stretch}.vstack{display:flex;flex:1 1 auto;flex-direction:column;align-self:stretch}.visually-hidden,.visually-hidden-focusable:not(:focus):not(:focus-within){position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}.stretched-link::after{position:absolute;top:0;right:0;bottom:0;left:0;z-index:1;content:\"\"}.text-truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vr{display:inline-block;align-self:stretch;width:1px;min-height:1em;background-color:currentcolor;opacity:.25}.align-baseline{vertical-align:baseline!important}.align-top{vertical-align:top!important}.align-middle{vertical-align:middle!important}.align-bottom{vertical-align:bottom!important}.align-text-bottom{vertical-align:text-bottom!important}.align-text-top{vertical-align:text-top!important}.float-start{float:left!important}.float-end{float:right!important}.float-none{float:none!important}.opacity-0{opacity:0!important}.opacity-25{opacity:.25!important}.opacity-50{opacity:.5!important}.opacity-75{opacity:.75!important}.opacity-100{opacity:1!important}.overflow-auto{overflow:auto!important}.overflow-hidden{overflow:hidden!important}.overflow-visible{overflow:visible!important}.overflow-scroll{overflow:scroll!important}.d-inline{display:inline!important}.d-inline-block{display:inline-block!important}.d-block{display:block!important}.d-grid{display:grid!important}.d-table{display:table!important}.d-table-row{display:table-row!important}.d-table-cell{display:table-cell!important}.d-flex{display:flex!important}.d-inline-flex{display:inline-flex!important}.d-none{display:none!important}.shadow{box-shadow:0 .5rem 1rem rgba(0,0,0,.15)!important}.shadow-sm{box-shadow:0 .125rem .25rem rgba(0,0,0,.075)!important}.shadow-lg{box-shadow:0 1rem 3rem rgba(0,0,0,.175)!important}.shadow-none{box-shadow:none!important}.position-static{position:static!important}.position-relative{position:relative!important}.position-absolute{position:absolute!important}.position-fixed{position:fixed!important}.position-sticky{position:-webkit-sticky!important;position:sticky!important}.top-0{top:0!important}.top-50{top:50%!important}.top-100{top:100%!important}.bottom-0{bottom:0!important}.bottom-50{bottom:50%!important}.bottom-100{bottom:100%!important}.start-0{left:0!important}.start-50{left:50%!important}.start-100{left:100%!important}.end-0{right:0!important}.end-50{right:50%!important}.end-100{right:100%!important}.translate-middle{transform:translate(-50%,-50%)!important}.translate-middle-x{transform:translateX(-50%)!important}.translate-middle-y{transform:translateY(-50%)!important}.border{border:var(--bs-border-width) var(--bs-border-style) var(--bs-border-color)!important}.border-0{border:0!important}.border-top{border-top:var(--bs-border-width) var(--bs-border-style) var(--bs-border-color)!important}.border-top-0{border-top:0!important}.border-end{border-right:var(--bs-border-width) var(--bs-border-style) var(--bs-border-color)!important}.border-end-0{border-right:0!important}.border-bottom{border-bottom:var(--bs-border-width) var(--bs-border-style) var(--bs-border-color)!important}.border-bottom-0{border-bottom:0!important}.border-start{border-left:var(--bs-border-width) var(--bs-border-style) var(--bs-border-color)!important}.border-start-0{border-left:0!important}.border-primary{--bs-border-opacity:1;border-color:rgba(var(--bs-primary-rgb),var(--bs-border-opacity))!important}.border-secondary{--bs-border-opacity:1;border-color:rgba(var(--bs-secondary-rgb),var(--bs-border-opacity))!important}.border-success{--bs-border-opacity:1;border-color:rgba(var(--bs-success-rgb),var(--bs-border-opacity))!important}.border-info{--bs-border-opacity:1;border-color:rgba(var(--bs-info-rgb),var(--bs-border-opacity))!important}.border-warning{--bs-border-opacity:1;border-color:rgba(var(--bs-warning-rgb),var(--bs-border-opacity))!important}.border-danger{--bs-border-opacity:1;border-color:rgba(var(--bs-danger-rgb),var(--bs-border-opacity))!important}.border-light{--bs-border-opacity:1;border-color:rgba(var(--bs-light-rgb),var(--bs-border-opacity))!important}.border-dark{--bs-border-opacity:1;border-color:rgba(var(--bs-dark-rgb),var(--bs-border-opacity))!important}.border-white{--bs-border-opacity:1;border-color:rgba(var(--bs-white-rgb),var(--bs-border-opacity))!important}.border-1{--bs-border-width:1px}.border-2{--bs-border-width:2px}.border-3{--bs-border-width:3px}.border-4{--bs-border-width:4px}.border-5{--bs-border-width:5px}.border-opacity-10{--bs-border-opacity:0.1}.border-opacity-25{--bs-border-opacity:0.25}.border-opacity-50{--bs-border-opacity:0.5}.border-opacity-75{--bs-border-opacity:0.75}.border-opacity-100{--bs-border-opacity:1}.w-25{width:25%!important}.w-50{width:50%!important}.w-75{width:75%!important}.w-100{width:100%!important}.w-auto{width:auto!important}.mw-100{max-width:100%!important}.vw-100{width:100vw!important}.min-vw-100{min-width:100vw!important}.h-25{height:25%!important}.h-50{height:50%!important}.h-75{height:75%!important}.h-100{height:100%!important}.h-auto{height:auto!important}.mh-100{max-height:100%!important}.vh-100{height:100vh!important}.min-vh-100{min-height:100vh!important}.flex-fill{flex:1 1 auto!important}.flex-row{flex-direction:row!important}.flex-column{flex-direction:column!important}.flex-row-reverse{flex-direction:row-reverse!important}.flex-column-reverse{flex-direction:column-reverse!important}.flex-grow-0{flex-grow:0!important}.flex-grow-1{flex-grow:1!important}.flex-shrink-0{flex-shrink:0!important}.flex-shrink-1{flex-shrink:1!important}.flex-wrap{flex-wrap:wrap!important}.flex-nowrap{flex-wrap:nowrap!important}.flex-wrap-reverse{flex-wrap:wrap-reverse!important}.justify-content-start{justify-content:flex-start!important}.justify-content-end{justify-content:flex-end!important}.justify-content-center{justify-content:center!important}.justify-content-between{justify-content:space-between!important}.justify-content-around{justify-content:space-around!important}.justify-content-evenly{justify-content:space-evenly!important}.align-items-start{align-items:flex-start!important}.align-items-end{align-items:flex-end!important}.align-items-center{align-items:center!important}.align-items-baseline{align-items:baseline!important}.align-items-stretch{align-items:stretch!important}.align-content-start{align-content:flex-start!important}.align-content-end{align-content:flex-end!important}.align-content-center{align-content:center!important}.align-content-between{align-content:space-between!important}.align-content-around{align-content:space-around!important}.align-content-stretch{align-content:stretch!important}.align-self-auto{align-self:auto!important}.align-self-start{align-self:flex-start!important}.align-self-end{align-self:flex-end!important}.align-self-center{align-self:center!important}.align-self-baseline{align-self:baseline!important}.align-self-stretch{align-self:stretch!important}.order-first{order:-1!important}.order-0{order:0!important}.order-1{order:1!important}.order-2{order:2!important}.order-3{order:3!important}.order-4{order:4!important}.order-5{order:5!important}.order-last{order:6!important}.m-0{margin:0!important}.m-1{margin:.25rem!important}.m-2{margin:.5rem!important}.m-3{margin:1rem!important}.m-4{margin:1.5rem!important}.m-5{margin:3rem!important}.m-auto{margin:auto!important}.mx-0{margin-right:0!important;margin-left:0!important}.mx-1{margin-right:.25rem!important;margin-left:.25rem!important}.mx-2{margin-right:.5rem!important;margin-left:.5rem!important}.mx-3{margin-right:1rem!important;margin-left:1rem!important}.mx-4{margin-right:1.5rem!important;margin-left:1.5rem!important}.mx-5{margin-right:3rem!important;margin-left:3rem!important}.mx-auto{margin-right:auto!important;margin-left:auto!important}.my-0{margin-top:0!important;margin-bottom:0!important}.my-1{margin-top:.25rem!important;margin-bottom:.25rem!important}.my-2{margin-top:.5rem!important;margin-bottom:.5rem!important}.my-3{margin-top:1rem!important;margin-bottom:1rem!important}.my-4{margin-top:1.5rem!important;margin-bottom:1.5rem!important}.my-5{margin-top:3rem!important;margin-bottom:3rem!important}.my-auto{margin-top:auto!important;margin-bottom:auto!important}.mt-0{margin-top:0!important}.mt-1{margin-top:.25rem!important}.mt-2{margin-top:.5rem!important}.mt-3{margin-top:1rem!important}.mt-4{margin-top:1.5rem!important}.mt-5{margin-top:3rem!important}.mt-auto{margin-top:auto!important}.me-0{margin-right:0!important}.me-1{margin-right:.25rem!important}.me-2{margin-right:.5rem!important}.me-3{margin-right:1rem!important}.me-4{margin-right:1.5rem!important}.me-5{margin-right:3rem!important}.me-auto{margin-right:auto!important}.mb-0{margin-bottom:0!important}.mb-1{margin-bottom:.25rem!important}.mb-2{margin-bottom:.5rem!important}.mb-3{margin-bottom:1rem!important}.mb-4{margin-bottom:1.5rem!important}.mb-5{margin-bottom:3rem!important}.mb-auto{margin-bottom:auto!important}.ms-0{margin-left:0!important}.ms-1{margin-left:.25rem!important}.ms-2{margin-left:.5rem!important}.ms-3{margin-left:1rem!important}.ms-4{margin-left:1.5rem!important}.ms-5{margin-left:3rem!important}.ms-auto{margin-left:auto!important}.p-0{padding:0!important}.p-1{padding:.25rem!important}.p-2{padding:.5rem!important}.p-3{padding:1rem!important}.p-4{padding:1.5rem!important}.p-5{padding:3rem!important}.px-0{padding-right:0!important;padding-left:0!important}.px-1{padding-right:.25rem!important;padding-left:.25rem!important}.px-2{padding-right:.5rem!important;padding-left:.5rem!important}.px-3{padding-right:1rem!important;padding-left:1rem!important}.px-4{padding-right:1.5rem!important;padding-left:1.5rem!important}.px-5{padding-right:3rem!important;padding-left:3rem!important}.py-0{padding-top:0!important;padding-bottom:0!important}.py-1{padding-top:.25rem!important;padding-bottom:.25rem!important}.py-2{padding-top:.5rem!important;padding-bottom:.5rem!important}.py-3{padding-top:1rem!important;padding-bottom:1rem!important}.py-4{padding-top:1.5rem!important;padding-bottom:1.5rem!important}.py-5{padding-top:3rem!important;padding-bottom:3rem!important}.pt-0{padding-top:0!important}.pt-1{padding-top:.25rem!important}.pt-2{padding-top:.5rem!important}.pt-3{padding-top:1rem!important}.pt-4{padding-top:1.5rem!important}.pt-5{padding-top:3rem!important}.pe-0{padding-right:0!important}.pe-1{padding-right:.25rem!important}.pe-2{padding-right:.5rem!important}.pe-3{padding-right:1rem!important}.pe-4{padding-right:1.5rem!important}.pe-5{padding-right:3rem!important}.pb-0{padding-bottom:0!important}.pb-1{padding-bottom:.25rem!important}.pb-2{padding-bottom:.5rem!important}.pb-3{padding-bottom:1rem!important}.pb-4{padding-bottom:1.5rem!important}.pb-5{padding-bottom:3rem!important}.ps-0{padding-left:0!important}.ps-1{padding-left:.25rem!important}.ps-2{padding-left:.5rem!important}.ps-3{padding-left:1rem!important}.ps-4{padding-left:1.5rem!important}.ps-5{padding-left:3rem!important}.gap-0{gap:0!important}.gap-1{gap:.25rem!important}.gap-2{gap:.5rem!important}.gap-3{gap:1rem!important}.gap-4{gap:1.5rem!important}.gap-5{gap:3rem!important}.font-monospace{font-family:var(--bs-font-monospace)!important}.fs-1{font-size:calc(1.375rem + 1.5vw)!important}.fs-2{font-size:calc(1.325rem + .9vw)!important}.fs-3{font-size:calc(1.3rem + .6vw)!important}.fs-4{font-size:calc(1.275rem + .3vw)!important}.fs-5{font-size:1.25rem!important}.fs-6{font-size:1rem!important}.fst-italic{font-style:italic!important}.fst-normal{font-style:normal!important}.fw-light{font-weight:300!important}.fw-lighter{font-weight:lighter!important}.fw-normal{font-weight:400!important}.fw-bold{font-weight:700!important}.fw-semibold{font-weight:600!important}.fw-bolder{font-weight:bolder!important}.lh-1{line-height:1!important}.lh-sm{line-height:1.25!important}.lh-base{line-height:1.5!important}.lh-lg{line-height:2!important}.text-start{text-align:left!important}.text-end{text-align:right!important}.text-center{text-align:center!important}.text-decoration-none{text-decoration:none!important}.text-decoration-underline{text-decoration:underline!important}.text-decoration-line-through{text-decoration:line-through!important}.text-lowercase{text-transform:lowercase!important}.text-uppercase{text-transform:uppercase!important}.text-capitalize{text-transform:capitalize!important}.text-wrap{white-space:normal!important}.text-nowrap{white-space:nowrap!important}.text-break{word-wrap:break-word!important;word-break:break-word!important}.text-primary{--bs-text-opacity:1;color:rgba(var(--bs-primary-rgb),var(--bs-text-opacity))!important}.text-secondary{--bs-text-opacity:1;color:rgba(var(--bs-secondary-rgb),var(--bs-text-opacity))!important}.text-success{--bs-text-opacity:1;color:rgba(var(--bs-success-rgb),var(--bs-text-opacity))!important}.text-info{--bs-text-opacity:1;color:rgba(var(--bs-info-rgb),var(--bs-text-opacity))!important}.text-warning{--bs-text-opacity:1;color:rgba(var(--bs-warning-rgb),var(--bs-text-opacity))!important}.text-danger{--bs-text-opacity:1;color:rgba(var(--bs-danger-rgb),var(--bs-text-opacity))!important}.text-light{--bs-text-opacity:1;color:rgba(var(--bs-light-rgb),var(--bs-text-opacity))!important}.text-dark{--bs-text-opacity:1;color:rgba(var(--bs-dark-rgb),var(--bs-text-opacity))!important}.text-black{--bs-text-opacity:1;color:rgba(var(--bs-black-rgb),var(--bs-text-opacity))!important}.text-white{--bs-text-opacity:1;color:rgba(var(--bs-white-rgb),var(--bs-text-opacity))!important}.text-body{--bs-text-opacity:1;color:rgba(var(--bs-body-color-rgb),var(--bs-text-opacity))!important}.text-muted{--bs-text-opacity:1;color:#6c757d!important}.text-black-50{--bs-text-opacity:1;color:rgba(0,0,0,.5)!important}.text-white-50{--bs-text-opacity:1;color:rgba(255,255,255,.5)!important}.text-reset{--bs-text-opacity:1;color:inherit!important}.text-opacity-25{--bs-text-opacity:0.25}.text-opacity-50{--bs-text-opacity:0.5}.text-opacity-75{--bs-text-opacity:0.75}.text-opacity-100{--bs-text-opacity:1}.bg-primary{--bs-bg-opacity:1;background-color:rgba(var(--bs-primary-rgb),var(--bs-bg-opacity))!important}.bg-secondary{--bs-bg-opacity:1;background-color:rgba(var(--bs-secondary-rgb),var(--bs-bg-opacity))!important}.bg-success{--bs-bg-opacity:1;background-color:rgba(var(--bs-success-rgb),var(--bs-bg-opacity))!important}.bg-info{--bs-bg-opacity:1;background-color:rgba(var(--bs-info-rgb),var(--bs-bg-opacity))!important}.bg-warning{--bs-bg-opacity:1;background-color:rgba(var(--bs-warning-rgb),var(--bs-bg-opacity))!important}.bg-danger{--bs-bg-opacity:1;background-color:rgba(var(--bs-danger-rgb),var(--bs-bg-opacity))!important}.bg-light{--bs-bg-opacity:1;background-color:rgba(var(--bs-light-rgb),var(--bs-bg-opacity))!important}.bg-dark{--bs-bg-opacity:1;background-color:rgba(var(--bs-dark-rgb),var(--bs-bg-opacity))!important}.bg-black{--bs-bg-opacity:1;background-color:rgba(var(--bs-black-rgb),var(--bs-bg-opacity))!important}.bg-white{--bs-bg-opacity:1;background-color:rgba(var(--bs-white-rgb),var(--bs-bg-opacity))!important}.bg-body{--bs-bg-opacity:1;background-color:rgba(var(--bs-body-bg-rgb),var(--bs-bg-opacity))!important}.bg-transparent{--bs-bg-opacity:1;background-color:transparent!important}.bg-opacity-10{--bs-bg-opacity:0.1}.bg-opacity-25{--bs-bg-opacity:0.25}.bg-opacity-50{--bs-bg-opacity:0.5}.bg-opacity-75{--bs-bg-opacity:0.75}.bg-opacity-100{--bs-bg-opacity:1}.bg-gradient{background-image:var(--bs-gradient)!important}.user-select-all{-webkit-user-select:all!important;-moz-user-select:all!important;user-select:all!important}.user-select-auto{-webkit-user-select:auto!important;-moz-user-select:auto!important;user-select:auto!important}.user-select-none{-webkit-user-select:none!important;-moz-user-select:none!important;user-select:none!important}.pe-none{pointer-events:none!important}.pe-auto{pointer-events:auto!important}.rounded{border-radius:var(--bs-border-radius)!important}.rounded-0{border-radius:0!important}.rounded-1{border-radius:var(--bs-border-radius-sm)!important}.rounded-2{border-radius:var(--bs-border-radius)!important}.rounded-3{border-radius:var(--bs-border-radius-lg)!important}.rounded-4{border-radius:var(--bs-border-radius-xl)!important}.rounded-5{border-radius:var(--bs-border-radius-2xl)!important}.rounded-circle{border-radius:50%!important}.rounded-pill{border-radius:var(--bs-border-radius-pill)!important}.rounded-top{border-top-left-radius:var(--bs-border-radius)!important;border-top-right-radius:var(--bs-border-radius)!important}.rounded-end{border-top-right-radius:var(--bs-border-radius)!important;border-bottom-right-radius:var(--bs-border-radius)!important}.rounded-bottom{border-bottom-right-radius:var(--bs-border-radius)!important;border-bottom-left-radius:var(--bs-border-radius)!important}.rounded-start{border-bottom-left-radius:var(--bs-border-radius)!important;border-top-left-radius:var(--bs-border-radius)!important}.visible{visibility:visible!important}.invisible{visibility:hidden!important}@media (min-width:576px){.float-sm-start{float:left!important}.float-sm-end{float:right!important}.float-sm-none{float:none!important}.d-sm-inline{display:inline!important}.d-sm-inline-block{display:inline-block!important}.d-sm-block{display:block!important}.d-sm-grid{display:grid!important}.d-sm-table{display:table!important}.d-sm-table-row{display:table-row!important}.d-sm-table-cell{display:table-cell!important}.d-sm-flex{display:flex!important}.d-sm-inline-flex{display:inline-flex!important}.d-sm-none{display:none!important}.flex-sm-fill{flex:1 1 auto!important}.flex-sm-row{flex-direction:row!important}.flex-sm-column{flex-direction:column!important}.flex-sm-row-reverse{flex-direction:row-reverse!important}.flex-sm-column-reverse{flex-direction:column-reverse!important}.flex-sm-grow-0{flex-grow:0!important}.flex-sm-grow-1{flex-grow:1!important}.flex-sm-shrink-0{flex-shrink:0!important}.flex-sm-shrink-1{flex-shrink:1!important}.flex-sm-wrap{flex-wrap:wrap!important}.flex-sm-nowrap{flex-wrap:nowrap!important}.flex-sm-wrap-reverse{flex-wrap:wrap-reverse!important}.justify-content-sm-start{justify-content:flex-start!important}.justify-content-sm-end{justify-content:flex-end!important}.justify-content-sm-center{justify-content:center!important}.justify-content-sm-between{justify-content:space-between!important}.justify-content-sm-around{justify-content:space-around!important}.justify-content-sm-evenly{justify-content:space-evenly!important}.align-items-sm-start{align-items:flex-start!important}.align-items-sm-end{align-items:flex-end!important}.align-items-sm-center{align-items:center!important}.align-items-sm-baseline{align-items:baseline!important}.align-items-sm-stretch{align-items:stretch!important}.align-content-sm-start{align-content:flex-start!important}.align-content-sm-end{align-content:flex-end!important}.align-content-sm-center{align-content:center!important}.align-content-sm-between{align-content:space-between!important}.align-content-sm-around{align-content:space-around!important}.align-content-sm-stretch{align-content:stretch!important}.align-self-sm-auto{align-self:auto!important}.align-self-sm-start{align-self:flex-start!important}.align-self-sm-end{align-self:flex-end!important}.align-self-sm-center{align-self:center!important}.align-self-sm-baseline{align-self:baseline!important}.align-self-sm-stretch{align-self:stretch!important}.order-sm-first{order:-1!important}.order-sm-0{order:0!important}.order-sm-1{order:1!important}.order-sm-2{order:2!important}.order-sm-3{order:3!important}.order-sm-4{order:4!important}.order-sm-5{order:5!important}.order-sm-last{order:6!important}.m-sm-0{margin:0!important}.m-sm-1{margin:.25rem!important}.m-sm-2{margin:.5rem!important}.m-sm-3{margin:1rem!important}.m-sm-4{margin:1.5rem!important}.m-sm-5{margin:3rem!important}.m-sm-auto{margin:auto!important}.mx-sm-0{margin-right:0!important;margin-left:0!important}.mx-sm-1{margin-right:.25rem!important;margin-left:.25rem!important}.mx-sm-2{margin-right:.5rem!important;margin-left:.5rem!important}.mx-sm-3{margin-right:1rem!important;margin-left:1rem!important}.mx-sm-4{margin-right:1.5rem!important;margin-left:1.5rem!important}.mx-sm-5{margin-right:3rem!important;margin-left:3rem!important}.mx-sm-auto{margin-right:auto!important;margin-left:auto!important}.my-sm-0{margin-top:0!important;margin-bottom:0!important}.my-sm-1{margin-top:.25rem!important;margin-bottom:.25rem!important}.my-sm-2{margin-top:.5rem!important;margin-bottom:.5rem!important}.my-sm-3{margin-top:1rem!important;margin-bottom:1rem!important}.my-sm-4{margin-top:1.5rem!important;margin-bottom:1.5rem!important}.my-sm-5{margin-top:3rem!important;margin-bottom:3rem!important}.my-sm-auto{margin-top:auto!important;margin-bottom:auto!important}.mt-sm-0{margin-top:0!important}.mt-sm-1{margin-top:.25rem!important}.mt-sm-2{margin-top:.5rem!important}.mt-sm-3{margin-top:1rem!important}.mt-sm-4{margin-top:1.5rem!important}.mt-sm-5{margin-top:3rem!important}.mt-sm-auto{margin-top:auto!important}.me-sm-0{margin-right:0!important}.me-sm-1{margin-right:.25rem!important}.me-sm-2{margin-right:.5rem!important}.me-sm-3{margin-right:1rem!important}.me-sm-4{margin-right:1.5rem!important}.me-sm-5{margin-right:3rem!important}.me-sm-auto{margin-right:auto!important}.mb-sm-0{margin-bottom:0!important}.mb-sm-1{margin-bottom:.25rem!important}.mb-sm-2{margin-bottom:.5rem!important}.mb-sm-3{margin-bottom:1rem!important}.mb-sm-4{margin-bottom:1.5rem!important}.mb-sm-5{margin-bottom:3rem!important}.mb-sm-auto{margin-bottom:auto!important}.ms-sm-0{margin-left:0!important}.ms-sm-1{margin-left:.25rem!important}.ms-sm-2{margin-left:.5rem!important}.ms-sm-3{margin-left:1rem!important}.ms-sm-4{margin-left:1.5rem!important}.ms-sm-5{margin-left:3rem!important}.ms-sm-auto{margin-left:auto!important}.p-sm-0{padding:0!important}.p-sm-1{padding:.25rem!important}.p-sm-2{padding:.5rem!important}.p-sm-3{padding:1rem!important}.p-sm-4{padding:1.5rem!important}.p-sm-5{padding:3rem!important}.px-sm-0{padding-right:0!important;padding-left:0!important}.px-sm-1{padding-right:.25rem!important;padding-left:.25rem!important}.px-sm-2{padding-right:.5rem!important;padding-left:.5rem!important}.px-sm-3{padding-right:1rem!important;padding-left:1rem!important}.px-sm-4{padding-right:1.5rem!important;padding-left:1.5rem!important}.px-sm-5{padding-right:3rem!important;padding-left:3rem!important}.py-sm-0{padding-top:0!important;padding-bottom:0!important}.py-sm-1{padding-top:.25rem!important;padding-bottom:.25rem!important}.py-sm-2{padding-top:.5rem!important;padding-bottom:.5rem!important}.py-sm-3{padding-top:1rem!important;padding-bottom:1rem!important}.py-sm-4{padding-top:1.5rem!important;padding-bottom:1.5rem!important}.py-sm-5{padding-top:3rem!important;padding-bottom:3rem!important}.pt-sm-0{padding-top:0!important}.pt-sm-1{padding-top:.25rem!important}.pt-sm-2{padding-top:.5rem!important}.pt-sm-3{padding-top:1rem!important}.pt-sm-4{padding-top:1.5rem!important}.pt-sm-5{padding-top:3rem!important}.pe-sm-0{padding-right:0!important}.pe-sm-1{padding-right:.25rem!important}.pe-sm-2{padding-right:.5rem!important}.pe-sm-3{padding-right:1rem!important}.pe-sm-4{padding-right:1.5rem!important}.pe-sm-5{padding-right:3rem!important}.pb-sm-0{padding-bottom:0!important}.pb-sm-1{padding-bottom:.25rem!important}.pb-sm-2{padding-bottom:.5rem!important}.pb-sm-3{padding-bottom:1rem!important}.pb-sm-4{padding-bottom:1.5rem!important}.pb-sm-5{padding-bottom:3rem!important}.ps-sm-0{padding-left:0!important}.ps-sm-1{padding-left:.25rem!important}.ps-sm-2{padding-left:.5rem!important}.ps-sm-3{padding-left:1rem!important}.ps-sm-4{padding-left:1.5rem!important}.ps-sm-5{padding-left:3rem!important}.gap-sm-0{gap:0!important}.gap-sm-1{gap:.25rem!important}.gap-sm-2{gap:.5rem!important}.gap-sm-3{gap:1rem!important}.gap-sm-4{gap:1.5rem!important}.gap-sm-5{gap:3rem!important}.text-sm-start{text-align:left!important}.text-sm-end{text-align:right!important}.text-sm-center{text-align:center!important}}@media (min-width:768px){.float-md-start{float:left!important}.float-md-end{float:right!important}.float-md-none{float:none!important}.d-md-inline{display:inline!important}.d-md-inline-block{display:inline-block!important}.d-md-block{display:block!important}.d-md-grid{display:grid!important}.d-md-table{display:table!important}.d-md-table-row{display:table-row!important}.d-md-table-cell{display:table-cell!important}.d-md-flex{display:flex!important}.d-md-inline-flex{display:inline-flex!important}.d-md-none{display:none!important}.flex-md-fill{flex:1 1 auto!important}.flex-md-row{flex-direction:row!important}.flex-md-column{flex-direction:column!important}.flex-md-row-reverse{flex-direction:row-reverse!important}.flex-md-column-reverse{flex-direction:column-reverse!important}.flex-md-grow-0{flex-grow:0!important}.flex-md-grow-1{flex-grow:1!important}.flex-md-shrink-0{flex-shrink:0!important}.flex-md-shrink-1{flex-shrink:1!important}.flex-md-wrap{flex-wrap:wrap!important}.flex-md-nowrap{flex-wrap:nowrap!important}.flex-md-wrap-reverse{flex-wrap:wrap-reverse!important}.justify-content-md-start{justify-content:flex-start!important}.justify-content-md-end{justify-content:flex-end!important}.justify-content-md-center{justify-content:center!important}.justify-content-md-between{justify-content:space-between!important}.justify-content-md-around{justify-content:space-around!important}.justify-content-md-evenly{justify-content:space-evenly!important}.align-items-md-start{align-items:flex-start!important}.align-items-md-end{align-items:flex-end!important}.align-items-md-center{align-items:center!important}.align-items-md-baseline{align-items:baseline!important}.align-items-md-stretch{align-items:stretch!important}.align-content-md-start{align-content:flex-start!important}.align-content-md-end{align-content:flex-end!important}.align-content-md-center{align-content:center!important}.align-content-md-between{align-content:space-between!important}.align-content-md-around{align-content:space-around!important}.align-content-md-stretch{align-content:stretch!important}.align-self-md-auto{align-self:auto!important}.align-self-md-start{align-self:flex-start!important}.align-self-md-end{align-self:flex-end!important}.align-self-md-center{align-self:center!important}.align-self-md-baseline{align-self:baseline!important}.align-self-md-stretch{align-self:stretch!important}.order-md-first{order:-1!important}.order-md-0{order:0!important}.order-md-1{order:1!important}.order-md-2{order:2!important}.order-md-3{order:3!important}.order-md-4{order:4!important}.order-md-5{order:5!important}.order-md-last{order:6!important}.m-md-0{margin:0!important}.m-md-1{margin:.25rem!important}.m-md-2{margin:.5rem!important}.m-md-3{margin:1rem!important}.m-md-4{margin:1.5rem!important}.m-md-5{margin:3rem!important}.m-md-auto{margin:auto!important}.mx-md-0{margin-right:0!important;margin-left:0!important}.mx-md-1{margin-right:.25rem!important;margin-left:.25rem!important}.mx-md-2{margin-right:.5rem!important;margin-left:.5rem!important}.mx-md-3{margin-right:1rem!important;margin-left:1rem!important}.mx-md-4{margin-right:1.5rem!important;margin-left:1.5rem!important}.mx-md-5{margin-right:3rem!important;margin-left:3rem!important}.mx-md-auto{margin-right:auto!important;margin-left:auto!important}.my-md-0{margin-top:0!important;margin-bottom:0!important}.my-md-1{margin-top:.25rem!important;margin-bottom:.25rem!important}.my-md-2{margin-top:.5rem!important;margin-bottom:.5rem!important}.my-md-3{margin-top:1rem!important;margin-bottom:1rem!important}.my-md-4{margin-top:1.5rem!important;margin-bottom:1.5rem!important}.my-md-5{margin-top:3rem!important;margin-bottom:3rem!important}.my-md-auto{margin-top:auto!important;margin-bottom:auto!important}.mt-md-0{margin-top:0!important}.mt-md-1{margin-top:.25rem!important}.mt-md-2{margin-top:.5rem!important}.mt-md-3{margin-top:1rem!important}.mt-md-4{margin-top:1.5rem!important}.mt-md-5{margin-top:3rem!important}.mt-md-auto{margin-top:auto!important}.me-md-0{margin-right:0!important}.me-md-1{margin-right:.25rem!important}.me-md-2{margin-right:.5rem!important}.me-md-3{margin-right:1rem!important}.me-md-4{margin-right:1.5rem!important}.me-md-5{margin-right:3rem!important}.me-md-auto{margin-right:auto!important}.mb-md-0{margin-bottom:0!important}.mb-md-1{margin-bottom:.25rem!important}.mb-md-2{margin-bottom:.5rem!important}.mb-md-3{margin-bottom:1rem!important}.mb-md-4{margin-bottom:1.5rem!important}.mb-md-5{margin-bottom:3rem!important}.mb-md-auto{margin-bottom:auto!important}.ms-md-0{margin-left:0!important}.ms-md-1{margin-left:.25rem!important}.ms-md-2{margin-left:.5rem!important}.ms-md-3{margin-left:1rem!important}.ms-md-4{margin-left:1.5rem!important}.ms-md-5{margin-left:3rem!important}.ms-md-auto{margin-left:auto!important}.p-md-0{padding:0!important}.p-md-1{padding:.25rem!important}.p-md-2{padding:.5rem!important}.p-md-3{padding:1rem!important}.p-md-4{padding:1.5rem!important}.p-md-5{padding:3rem!important}.px-md-0{padding-right:0!important;padding-left:0!important}.px-md-1{padding-right:.25rem!important;padding-left:.25rem!important}.px-md-2{padding-right:.5rem!important;padding-left:.5rem!important}.px-md-3{padding-right:1rem!important;padding-left:1rem!important}.px-md-4{padding-right:1.5rem!important;padding-left:1.5rem!important}.px-md-5{padding-right:3rem!important;padding-left:3rem!important}.py-md-0{padding-top:0!important;padding-bottom:0!important}.py-md-1{padding-top:.25rem!important;padding-bottom:.25rem!important}.py-md-2{padding-top:.5rem!important;padding-bottom:.5rem!important}.py-md-3{padding-top:1rem!important;padding-bottom:1rem!important}.py-md-4{padding-top:1.5rem!important;padding-bottom:1.5rem!important}.py-md-5{padding-top:3rem!important;padding-bottom:3rem!important}.pt-md-0{padding-top:0!important}.pt-md-1{padding-top:.25rem!important}.pt-md-2{padding-top:.5rem!important}.pt-md-3{padding-top:1rem!important}.pt-md-4{padding-top:1.5rem!important}.pt-md-5{padding-top:3rem!important}.pe-md-0{padding-right:0!important}.pe-md-1{padding-right:.25rem!important}.pe-md-2{padding-right:.5rem!important}.pe-md-3{padding-right:1rem!important}.pe-md-4{padding-right:1.5rem!important}.pe-md-5{padding-right:3rem!important}.pb-md-0{padding-bottom:0!important}.pb-md-1{padding-bottom:.25rem!important}.pb-md-2{padding-bottom:.5rem!important}.pb-md-3{padding-bottom:1rem!important}.pb-md-4{padding-bottom:1.5rem!important}.pb-md-5{padding-bottom:3rem!important}.ps-md-0{padding-left:0!important}.ps-md-1{padding-left:.25rem!important}.ps-md-2{padding-left:.5rem!important}.ps-md-3{padding-left:1rem!important}.ps-md-4{padding-left:1.5rem!important}.ps-md-5{padding-left:3rem!important}.gap-md-0{gap:0!important}.gap-md-1{gap:.25rem!important}.gap-md-2{gap:.5rem!important}.gap-md-3{gap:1rem!important}.gap-md-4{gap:1.5rem!important}.gap-md-5{gap:3rem!important}.text-md-start{text-align:left!important}.text-md-end{text-align:right!important}.text-md-center{text-align:center!important}}@media (min-width:992px){.float-lg-start{float:left!important}.float-lg-end{float:right!important}.float-lg-none{float:none!important}.d-lg-inline{display:inline!important}.d-lg-inline-block{display:inline-block!important}.d-lg-block{display:block!important}.d-lg-grid{display:grid!important}.d-lg-table{display:table!important}.d-lg-table-row{display:table-row!important}.d-lg-table-cell{display:table-cell!important}.d-lg-flex{display:flex!important}.d-lg-inline-flex{display:inline-flex!important}.d-lg-none{display:none!important}.flex-lg-fill{flex:1 1 auto!important}.flex-lg-row{flex-direction:row!important}.flex-lg-column{flex-direction:column!important}.flex-lg-row-reverse{flex-direction:row-reverse!important}.flex-lg-column-reverse{flex-direction:column-reverse!important}.flex-lg-grow-0{flex-grow:0!important}.flex-lg-grow-1{flex-grow:1!important}.flex-lg-shrink-0{flex-shrink:0!important}.flex-lg-shrink-1{flex-shrink:1!important}.flex-lg-wrap{flex-wrap:wrap!important}.flex-lg-nowrap{flex-wrap:nowrap!important}.flex-lg-wrap-reverse{flex-wrap:wrap-reverse!important}.justify-content-lg-start{justify-content:flex-start!important}.justify-content-lg-end{justify-content:flex-end!important}.justify-content-lg-center{justify-content:center!important}.justify-content-lg-between{justify-content:space-between!important}.justify-content-lg-around{justify-content:space-around!important}.justify-content-lg-evenly{justify-content:space-evenly!important}.align-items-lg-start{align-items:flex-start!important}.align-items-lg-end{align-items:flex-end!important}.align-items-lg-center{align-items:center!important}.align-items-lg-baseline{align-items:baseline!important}.align-items-lg-stretch{align-items:stretch!important}.align-content-lg-start{align-content:flex-start!important}.align-content-lg-end{align-content:flex-end!important}.align-content-lg-center{align-content:center!important}.align-content-lg-between{align-content:space-between!important}.align-content-lg-around{align-content:space-around!important}.align-content-lg-stretch{align-content:stretch!important}.align-self-lg-auto{align-self:auto!important}.align-self-lg-start{align-self:flex-start!important}.align-self-lg-end{align-self:flex-end!important}.align-self-lg-center{align-self:center!important}.align-self-lg-baseline{align-self:baseline!important}.align-self-lg-stretch{align-self:stretch!important}.order-lg-first{order:-1!important}.order-lg-0{order:0!important}.order-lg-1{order:1!important}.order-lg-2{order:2!important}.order-lg-3{order:3!important}.order-lg-4{order:4!important}.order-lg-5{order:5!important}.order-lg-last{order:6!important}.m-lg-0{margin:0!important}.m-lg-1{margin:.25rem!important}.m-lg-2{margin:.5rem!important}.m-lg-3{margin:1rem!important}.m-lg-4{margin:1.5rem!important}.m-lg-5{margin:3rem!important}.m-lg-auto{margin:auto!important}.mx-lg-0{margin-right:0!important;margin-left:0!important}.mx-lg-1{margin-right:.25rem!important;margin-left:.25rem!important}.mx-lg-2{margin-right:.5rem!important;margin-left:.5rem!important}.mx-lg-3{margin-right:1rem!important;margin-left:1rem!important}.mx-lg-4{margin-right:1.5rem!important;margin-left:1.5rem!important}.mx-lg-5{margin-right:3rem!important;margin-left:3rem!important}.mx-lg-auto{margin-right:auto!important;margin-left:auto!important}.my-lg-0{margin-top:0!important;margin-bottom:0!important}.my-lg-1{margin-top:.25rem!important;margin-bottom:.25rem!important}.my-lg-2{margin-top:.5rem!important;margin-bottom:.5rem!important}.my-lg-3{margin-top:1rem!important;margin-bottom:1rem!important}.my-lg-4{margin-top:1.5rem!important;margin-bottom:1.5rem!important}.my-lg-5{margin-top:3rem!important;margin-bottom:3rem!important}.my-lg-auto{margin-top:auto!important;margin-bottom:auto!important}.mt-lg-0{margin-top:0!important}.mt-lg-1{margin-top:.25rem!important}.mt-lg-2{margin-top:.5rem!important}.mt-lg-3{margin-top:1rem!important}.mt-lg-4{margin-top:1.5rem!important}.mt-lg-5{margin-top:3rem!important}.mt-lg-auto{margin-top:auto!important}.me-lg-0{margin-right:0!important}.me-lg-1{margin-right:.25rem!important}.me-lg-2{margin-right:.5rem!important}.me-lg-3{margin-right:1rem!important}.me-lg-4{margin-right:1.5rem!important}.me-lg-5{margin-right:3rem!important}.me-lg-auto{margin-right:auto!important}.mb-lg-0{margin-bottom:0!important}.mb-lg-1{margin-bottom:.25rem!important}.mb-lg-2{margin-bottom:.5rem!important}.mb-lg-3{margin-bottom:1rem!important}.mb-lg-4{margin-bottom:1.5rem!important}.mb-lg-5{margin-bottom:3rem!important}.mb-lg-auto{margin-bottom:auto!important}.ms-lg-0{margin-left:0!important}.ms-lg-1{margin-left:.25rem!important}.ms-lg-2{margin-left:.5rem!important}.ms-lg-3{margin-left:1rem!important}.ms-lg-4{margin-left:1.5rem!important}.ms-lg-5{margin-left:3rem!important}.ms-lg-auto{margin-left:auto!important}.p-lg-0{padding:0!important}.p-lg-1{padding:.25rem!important}.p-lg-2{padding:.5rem!important}.p-lg-3{padding:1rem!important}.p-lg-4{padding:1.5rem!important}.p-lg-5{padding:3rem!important}.px-lg-0{padding-right:0!important;padding-left:0!important}.px-lg-1{padding-right:.25rem!important;padding-left:.25rem!important}.px-lg-2{padding-right:.5rem!important;padding-left:.5rem!important}.px-lg-3{padding-right:1rem!important;padding-left:1rem!important}.px-lg-4{padding-right:1.5rem!important;padding-left:1.5rem!important}.px-lg-5{padding-right:3rem!important;padding-left:3rem!important}.py-lg-0{padding-top:0!important;padding-bottom:0!important}.py-lg-1{padding-top:.25rem!important;padding-bottom:.25rem!important}.py-lg-2{padding-top:.5rem!important;padding-bottom:.5rem!important}.py-lg-3{padding-top:1rem!important;padding-bottom:1rem!important}.py-lg-4{padding-top:1.5rem!important;padding-bottom:1.5rem!important}.py-lg-5{padding-top:3rem!important;padding-bottom:3rem!important}.pt-lg-0{padding-top:0!important}.pt-lg-1{padding-top:.25rem!important}.pt-lg-2{padding-top:.5rem!important}.pt-lg-3{padding-top:1rem!important}.pt-lg-4{padding-top:1.5rem!important}.pt-lg-5{padding-top:3rem!important}.pe-lg-0{padding-right:0!important}.pe-lg-1{padding-right:.25rem!important}.pe-lg-2{padding-right:.5rem!important}.pe-lg-3{padding-right:1rem!important}.pe-lg-4{padding-right:1.5rem!important}.pe-lg-5{padding-right:3rem!important}.pb-lg-0{padding-bottom:0!important}.pb-lg-1{padding-bottom:.25rem!important}.pb-lg-2{padding-bottom:.5rem!important}.pb-lg-3{padding-bottom:1rem!important}.pb-lg-4{padding-bottom:1.5rem!important}.pb-lg-5{padding-bottom:3rem!important}.ps-lg-0{padding-left:0!important}.ps-lg-1{padding-left:.25rem!important}.ps-lg-2{padding-left:.5rem!important}.ps-lg-3{padding-left:1rem!important}.ps-lg-4{padding-left:1.5rem!important}.ps-lg-5{padding-left:3rem!important}.gap-lg-0{gap:0!important}.gap-lg-1{gap:.25rem!important}.gap-lg-2{gap:.5rem!important}.gap-lg-3{gap:1rem!important}.gap-lg-4{gap:1.5rem!important}.gap-lg-5{gap:3rem!important}.text-lg-start{text-align:left!important}.text-lg-end{text-align:right!important}.text-lg-center{text-align:center!important}}@media (min-width:1200px){.float-xl-start{float:left!important}.float-xl-end{float:right!important}.float-xl-none{float:none!important}.d-xl-inline{display:inline!important}.d-xl-inline-block{display:inline-block!important}.d-xl-block{display:block!important}.d-xl-grid{display:grid!important}.d-xl-table{display:table!important}.d-xl-table-row{display:table-row!important}.d-xl-table-cell{display:table-cell!important}.d-xl-flex{display:flex!important}.d-xl-inline-flex{display:inline-flex!important}.d-xl-none{display:none!important}.flex-xl-fill{flex:1 1 auto!important}.flex-xl-row{flex-direction:row!important}.flex-xl-column{flex-direction:column!important}.flex-xl-row-reverse{flex-direction:row-reverse!important}.flex-xl-column-reverse{flex-direction:column-reverse!important}.flex-xl-grow-0{flex-grow:0!important}.flex-xl-grow-1{flex-grow:1!important}.flex-xl-shrink-0{flex-shrink:0!important}.flex-xl-shrink-1{flex-shrink:1!important}.flex-xl-wrap{flex-wrap:wrap!important}.flex-xl-nowrap{flex-wrap:nowrap!important}.flex-xl-wrap-reverse{flex-wrap:wrap-reverse!important}.justify-content-xl-start{justify-content:flex-start!important}.justify-content-xl-end{justify-content:flex-end!important}.justify-content-xl-center{justify-content:center!important}.justify-content-xl-between{justify-content:space-between!important}.justify-content-xl-around{justify-content:space-around!important}.justify-content-xl-evenly{justify-content:space-evenly!important}.align-items-xl-start{align-items:flex-start!important}.align-items-xl-end{align-items:flex-end!important}.align-items-xl-center{align-items:center!important}.align-items-xl-baseline{align-items:baseline!important}.align-items-xl-stretch{align-items:stretch!important}.align-content-xl-start{align-content:flex-start!important}.align-content-xl-end{align-content:flex-end!important}.align-content-xl-center{align-content:center!important}.align-content-xl-between{align-content:space-between!important}.align-content-xl-around{align-content:space-around!important}.align-content-xl-stretch{align-content:stretch!important}.align-self-xl-auto{align-self:auto!important}.align-self-xl-start{align-self:flex-start!important}.align-self-xl-end{align-self:flex-end!important}.align-self-xl-center{align-self:center!important}.align-self-xl-baseline{align-self:baseline!important}.align-self-xl-stretch{align-self:stretch!important}.order-xl-first{order:-1!important}.order-xl-0{order:0!important}.order-xl-1{order:1!important}.order-xl-2{order:2!important}.order-xl-3{order:3!important}.order-xl-4{order:4!important}.order-xl-5{order:5!important}.order-xl-last{order:6!important}.m-xl-0{margin:0!important}.m-xl-1{margin:.25rem!important}.m-xl-2{margin:.5rem!important}.m-xl-3{margin:1rem!important}.m-xl-4{margin:1.5rem!important}.m-xl-5{margin:3rem!important}.m-xl-auto{margin:auto!important}.mx-xl-0{margin-right:0!important;margin-left:0!important}.mx-xl-1{margin-right:.25rem!important;margin-left:.25rem!important}.mx-xl-2{margin-right:.5rem!important;margin-left:.5rem!important}.mx-xl-3{margin-right:1rem!important;margin-left:1rem!important}.mx-xl-4{margin-right:1.5rem!important;margin-left:1.5rem!important}.mx-xl-5{margin-right:3rem!important;margin-left:3rem!important}.mx-xl-auto{margin-right:auto!important;margin-left:auto!important}.my-xl-0{margin-top:0!important;margin-bottom:0!important}.my-xl-1{margin-top:.25rem!important;margin-bottom:.25rem!important}.my-xl-2{margin-top:.5rem!important;margin-bottom:.5rem!important}.my-xl-3{margin-top:1rem!important;margin-bottom:1rem!important}.my-xl-4{margin-top:1.5rem!important;margin-bottom:1.5rem!important}.my-xl-5{margin-top:3rem!important;margin-bottom:3rem!important}.my-xl-auto{margin-top:auto!important;margin-bottom:auto!important}.mt-xl-0{margin-top:0!important}.mt-xl-1{margin-top:.25rem!important}.mt-xl-2{margin-top:.5rem!important}.mt-xl-3{margin-top:1rem!important}.mt-xl-4{margin-top:1.5rem!important}.mt-xl-5{margin-top:3rem!important}.mt-xl-auto{margin-top:auto!important}.me-xl-0{margin-right:0!important}.me-xl-1{margin-right:.25rem!important}.me-xl-2{margin-right:.5rem!important}.me-xl-3{margin-right:1rem!important}.me-xl-4{margin-right:1.5rem!important}.me-xl-5{margin-right:3rem!important}.me-xl-auto{margin-right:auto!important}.mb-xl-0{margin-bottom:0!important}.mb-xl-1{margin-bottom:.25rem!important}.mb-xl-2{margin-bottom:.5rem!important}.mb-xl-3{margin-bottom:1rem!important}.mb-xl-4{margin-bottom:1.5rem!important}.mb-xl-5{margin-bottom:3rem!important}.mb-xl-auto{margin-bottom:auto!important}.ms-xl-0{margin-left:0!important}.ms-xl-1{margin-left:.25rem!important}.ms-xl-2{margin-left:.5rem!important}.ms-xl-3{margin-left:1rem!important}.ms-xl-4{margin-left:1.5rem!important}.ms-xl-5{margin-left:3rem!important}.ms-xl-auto{margin-left:auto!important}.p-xl-0{padding:0!important}.p-xl-1{padding:.25rem!important}.p-xl-2{padding:.5rem!important}.p-xl-3{padding:1rem!important}.p-xl-4{padding:1.5rem!important}.p-xl-5{padding:3rem!important}.px-xl-0{padding-right:0!important;padding-left:0!important}.px-xl-1{padding-right:.25rem!important;padding-left:.25rem!important}.px-xl-2{padding-right:.5rem!important;padding-left:.5rem!important}.px-xl-3{padding-right:1rem!important;padding-left:1rem!important}.px-xl-4{padding-right:1.5rem!important;padding-left:1.5rem!important}.px-xl-5{padding-right:3rem!important;padding-left:3rem!important}.py-xl-0{padding-top:0!important;padding-bottom:0!important}.py-xl-1{padding-top:.25rem!important;padding-bottom:.25rem!important}.py-xl-2{padding-top:.5rem!important;padding-bottom:.5rem!important}.py-xl-3{padding-top:1rem!important;padding-bottom:1rem!important}.py-xl-4{padding-top:1.5rem!important;padding-bottom:1.5rem!important}.py-xl-5{padding-top:3rem!important;padding-bottom:3rem!important}.pt-xl-0{padding-top:0!important}.pt-xl-1{padding-top:.25rem!important}.pt-xl-2{padding-top:.5rem!important}.pt-xl-3{padding-top:1rem!important}.pt-xl-4{padding-top:1.5rem!important}.pt-xl-5{padding-top:3rem!important}.pe-xl-0{padding-right:0!important}.pe-xl-1{padding-right:.25rem!important}.pe-xl-2{padding-right:.5rem!important}.pe-xl-3{padding-right:1rem!important}.pe-xl-4{padding-right:1.5rem!important}.pe-xl-5{padding-right:3rem!important}.pb-xl-0{padding-bottom:0!important}.pb-xl-1{padding-bottom:.25rem!important}.pb-xl-2{padding-bottom:.5rem!important}.pb-xl-3{padding-bottom:1rem!important}.pb-xl-4{padding-bottom:1.5rem!important}.pb-xl-5{padding-bottom:3rem!important}.ps-xl-0{padding-left:0!important}.ps-xl-1{padding-left:.25rem!important}.ps-xl-2{padding-left:.5rem!important}.ps-xl-3{padding-left:1rem!important}.ps-xl-4{padding-left:1.5rem!important}.ps-xl-5{padding-left:3rem!important}.gap-xl-0{gap:0!important}.gap-xl-1{gap:.25rem!important}.gap-xl-2{gap:.5rem!important}.gap-xl-3{gap:1rem!important}.gap-xl-4{gap:1.5rem!important}.gap-xl-5{gap:3rem!important}.text-xl-start{text-align:left!important}.text-xl-end{text-align:right!important}.text-xl-center{text-align:center!important}}@media (min-width:1400px){.float-xxl-start{float:left!important}.float-xxl-end{float:right!important}.float-xxl-none{float:none!important}.d-xxl-inline{display:inline!important}.d-xxl-inline-block{display:inline-block!important}.d-xxl-block{display:block!important}.d-xxl-grid{display:grid!important}.d-xxl-table{display:table!important}.d-xxl-table-row{display:table-row!important}.d-xxl-table-cell{display:table-cell!important}.d-xxl-flex{display:flex!important}.d-xxl-inline-flex{display:inline-flex!important}.d-xxl-none{display:none!important}.flex-xxl-fill{flex:1 1 auto!important}.flex-xxl-row{flex-direction:row!important}.flex-xxl-column{flex-direction:column!important}.flex-xxl-row-reverse{flex-direction:row-reverse!important}.flex-xxl-column-reverse{flex-direction:column-reverse!important}.flex-xxl-grow-0{flex-grow:0!important}.flex-xxl-grow-1{flex-grow:1!important}.flex-xxl-shrink-0{flex-shrink:0!important}.flex-xxl-shrink-1{flex-shrink:1!important}.flex-xxl-wrap{flex-wrap:wrap!important}.flex-xxl-nowrap{flex-wrap:nowrap!important}.flex-xxl-wrap-reverse{flex-wrap:wrap-reverse!important}.justify-content-xxl-start{justify-content:flex-start!important}.justify-content-xxl-end{justify-content:flex-end!important}.justify-content-xxl-center{justify-content:center!important}.justify-content-xxl-between{justify-content:space-between!important}.justify-content-xxl-around{justify-content:space-around!important}.justify-content-xxl-evenly{justify-content:space-evenly!important}.align-items-xxl-start{align-items:flex-start!important}.align-items-xxl-end{align-items:flex-end!important}.align-items-xxl-center{align-items:center!important}.align-items-xxl-baseline{align-items:baseline!important}.align-items-xxl-stretch{align-items:stretch!important}.align-content-xxl-start{align-content:flex-start!important}.align-content-xxl-end{align-content:flex-end!important}.align-content-xxl-center{align-content:center!important}.align-content-xxl-between{align-content:space-between!important}.align-content-xxl-around{align-content:space-around!important}.align-content-xxl-stretch{align-content:stretch!important}.align-self-xxl-auto{align-self:auto!important}.align-self-xxl-start{align-self:flex-start!important}.align-self-xxl-end{align-self:flex-end!important}.align-self-xxl-center{align-self:center!important}.align-self-xxl-baseline{align-self:baseline!important}.align-self-xxl-stretch{align-self:stretch!important}.order-xxl-first{order:-1!important}.order-xxl-0{order:0!important}.order-xxl-1{order:1!important}.order-xxl-2{order:2!important}.order-xxl-3{order:3!important}.order-xxl-4{order:4!important}.order-xxl-5{order:5!important}.order-xxl-last{order:6!important}.m-xxl-0{margin:0!important}.m-xxl-1{margin:.25rem!important}.m-xxl-2{margin:.5rem!important}.m-xxl-3{margin:1rem!important}.m-xxl-4{margin:1.5rem!important}.m-xxl-5{margin:3rem!important}.m-xxl-auto{margin:auto!important}.mx-xxl-0{margin-right:0!important;margin-left:0!important}.mx-xxl-1{margin-right:.25rem!important;margin-left:.25rem!important}.mx-xxl-2{margin-right:.5rem!important;margin-left:.5rem!important}.mx-xxl-3{margin-right:1rem!important;margin-left:1rem!important}.mx-xxl-4{margin-right:1.5rem!important;margin-left:1.5rem!important}.mx-xxl-5{margin-right:3rem!important;margin-left:3rem!important}.mx-xxl-auto{margin-right:auto!important;margin-left:auto!important}.my-xxl-0{margin-top:0!important;margin-bottom:0!important}.my-xxl-1{margin-top:.25rem!important;margin-bottom:.25rem!important}.my-xxl-2{margin-top:.5rem!important;margin-bottom:.5rem!important}.my-xxl-3{margin-top:1rem!important;margin-bottom:1rem!important}.my-xxl-4{margin-top:1.5rem!important;margin-bottom:1.5rem!important}.my-xxl-5{margin-top:3rem!important;margin-bottom:3rem!important}.my-xxl-auto{margin-top:auto!important;margin-bottom:auto!important}.mt-xxl-0{margin-top:0!important}.mt-xxl-1{margin-top:.25rem!important}.mt-xxl-2{margin-top:.5rem!important}.mt-xxl-3{margin-top:1rem!important}.mt-xxl-4{margin-top:1.5rem!important}.mt-xxl-5{margin-top:3rem!important}.mt-xxl-auto{margin-top:auto!important}.me-xxl-0{margin-right:0!important}.me-xxl-1{margin-right:.25rem!important}.me-xxl-2{margin-right:.5rem!important}.me-xxl-3{margin-right:1rem!important}.me-xxl-4{margin-right:1.5rem!important}.me-xxl-5{margin-right:3rem!important}.me-xxl-auto{margin-right:auto!important}.mb-xxl-0{margin-bottom:0!important}.mb-xxl-1{margin-bottom:.25rem!important}.mb-xxl-2{margin-bottom:.5rem!important}.mb-xxl-3{margin-bottom:1rem!important}.mb-xxl-4{margin-bottom:1.5rem!important}.mb-xxl-5{margin-bottom:3rem!important}.mb-xxl-auto{margin-bottom:auto!important}.ms-xxl-0{margin-left:0!important}.ms-xxl-1{margin-left:.25rem!important}.ms-xxl-2{margin-left:.5rem!important}.ms-xxl-3{margin-left:1rem!important}.ms-xxl-4{margin-left:1.5rem!important}.ms-xxl-5{margin-left:3rem!important}.ms-xxl-auto{margin-left:auto!important}.p-xxl-0{padding:0!important}.p-xxl-1{padding:.25rem!important}.p-xxl-2{padding:.5rem!important}.p-xxl-3{padding:1rem!important}.p-xxl-4{padding:1.5rem!important}.p-xxl-5{padding:3rem!important}.px-xxl-0{padding-right:0!important;padding-left:0!important}.px-xxl-1{padding-right:.25rem!important;padding-left:.25rem!important}.px-xxl-2{padding-right:.5rem!important;padding-left:.5rem!important}.px-xxl-3{padding-right:1rem!important;padding-left:1rem!important}.px-xxl-4{padding-right:1.5rem!important;padding-left:1.5rem!important}.px-xxl-5{padding-right:3rem!important;padding-left:3rem!important}.py-xxl-0{padding-top:0!important;padding-bottom:0!important}.py-xxl-1{padding-top:.25rem!important;padding-bottom:.25rem!important}.py-xxl-2{padding-top:.5rem!important;padding-bottom:.5rem!important}.py-xxl-3{padding-top:1rem!important;padding-bottom:1rem!important}.py-xxl-4{padding-top:1.5rem!important;padding-bottom:1.5rem!important}.py-xxl-5{padding-top:3rem!important;padding-bottom:3rem!important}.pt-xxl-0{padding-top:0!important}.pt-xxl-1{padding-top:.25rem!important}.pt-xxl-2{padding-top:.5rem!important}.pt-xxl-3{padding-top:1rem!important}.pt-xxl-4{padding-top:1.5rem!important}.pt-xxl-5{padding-top:3rem!important}.pe-xxl-0{padding-right:0!important}.pe-xxl-1{padding-right:.25rem!important}.pe-xxl-2{padding-right:.5rem!important}.pe-xxl-3{padding-right:1rem!important}.pe-xxl-4{padding-right:1.5rem!important}.pe-xxl-5{padding-right:3rem!important}.pb-xxl-0{padding-bottom:0!important}.pb-xxl-1{padding-bottom:.25rem!important}.pb-xxl-2{padding-bottom:.5rem!important}.pb-xxl-3{padding-bottom:1rem!important}.pb-xxl-4{padding-bottom:1.5rem!important}.pb-xxl-5{padding-bottom:3rem!important}.ps-xxl-0{padding-left:0!important}.ps-xxl-1{padding-left:.25rem!important}.ps-xxl-2{padding-left:.5rem!important}.ps-xxl-3{padding-left:1rem!important}.ps-xxl-4{padding-left:1.5rem!important}.ps-xxl-5{padding-left:3rem!important}.gap-xxl-0{gap:0!important}.gap-xxl-1{gap:.25rem!important}.gap-xxl-2{gap:.5rem!important}.gap-xxl-3{gap:1rem!important}.gap-xxl-4{gap:1.5rem!important}.gap-xxl-5{gap:3rem!important}.text-xxl-start{text-align:left!important}.text-xxl-end{text-align:right!important}.text-xxl-center{text-align:center!important}}@media (min-width:1200px){.fs-1{font-size:2.5rem!important}.fs-2{font-size:2rem!important}.fs-3{font-size:1.75rem!important}.fs-4{font-size:1.5rem!important}}@media print{.d-print-inline{display:inline!important}.d-print-inline-block{display:inline-block!important}.d-print-block{display:block!important}.d-print-grid{display:grid!important}.d-print-table{display:table!important}.d-print-table-row{display:table-row!important}.d-print-table-cell{display:table-cell!important}.d-print-flex{display:flex!important}.d-print-inline-flex{display:inline-flex!important}.d-print-none{display:none!important}}\n/*# sourceMappingURL=bootstrap.min.css.map */";});;
/**
 * @license text 2.0.16 Copyright jQuery Foundation and other contributors.
 * Released under MIT license, http://github.com/requirejs/text/LICENSE
 */
/*jslint regexp: true */
/*global require, XMLHttpRequest, ActiveXObject,
  define, window, process, Packages,
  java, location, Components, FileUtils */

define('text/text',['module'], function (module) {
    'use strict';

    var text, fs, Cc, Ci, xpcIsWindows,
        progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
        xmlRegExp = /^\s*<\?xml(\s)+version=[\'\"](\d)*.(\d)*[\'\"](\s)*\?>/im,
        bodyRegExp = /<body[^>]*>\s*([\s\S]+)\s*<\/body>/im,
        hasLocation = typeof location !== 'undefined' && location.href,
        defaultProtocol = hasLocation && location.protocol && location.protocol.replace(/\:/, ''),
        defaultHostName = hasLocation && location.hostname,
        defaultPort = hasLocation && (location.port || undefined),
        buildMap = {},
        masterConfig = (module.config && module.config()) || {};

    function useDefault(value, defaultValue) {
        return value === undefined || value === '' ? defaultValue : value;
    }

    //Allow for default ports for http and https.
    function isSamePort(protocol1, port1, protocol2, port2) {
        if (port1 === port2) {
            return true;
        } else if (protocol1 === protocol2) {
            if (protocol1 === 'http') {
                return useDefault(port1, '80') === useDefault(port2, '80');
            } else if (protocol1 === 'https') {
                return useDefault(port1, '443') === useDefault(port2, '443');
            }
        }
        return false;
    }

    text = {
        version: '2.0.16',

        strip: function (content) {
            //Strips <?xml ...?> declarations so that external SVG and XML
            //documents can be added to a document without worry. Also, if the string
            //is an HTML document, only the part inside the body tag is returned.
            if (content) {
                content = content.replace(xmlRegExp, "");
                var matches = content.match(bodyRegExp);
                if (matches) {
                    content = matches[1];
                }
            } else {
                content = "";
            }
            return content;
        },

        jsEscape: function (content) {
            return content.replace(/(['\\])/g, '\\$1')
                .replace(/[\f]/g, "\\f")
                .replace(/[\b]/g, "\\b")
                .replace(/[\n]/g, "\\n")
                .replace(/[\t]/g, "\\t")
                .replace(/[\r]/g, "\\r")
                .replace(/[\u2028]/g, "\\u2028")
                .replace(/[\u2029]/g, "\\u2029");
        },

        createXhr: masterConfig.createXhr || function () {
            //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
            var xhr, i, progId;
            if (typeof XMLHttpRequest !== "undefined") {
                return new XMLHttpRequest();
            } else if (typeof ActiveXObject !== "undefined") {
                for (i = 0; i < 3; i += 1) {
                    progId = progIds[i];
                    try {
                        xhr = new ActiveXObject(progId);
                    } catch (e) {}

                    if (xhr) {
                        progIds = [progId];  // so faster next time
                        break;
                    }
                }
            }

            return xhr;
        },

        /**
         * Parses a resource name into its component parts. Resource names
         * look like: module/name.ext!strip, where the !strip part is
         * optional.
         * @param {String} name the resource name
         * @returns {Object} with properties "moduleName", "ext" and "strip"
         * where strip is a boolean.
         */
        parseName: function (name) {
            var modName, ext, temp,
                strip = false,
                index = name.lastIndexOf("."),
                isRelative = name.indexOf('./') === 0 ||
                             name.indexOf('../') === 0;

            if (index !== -1 && (!isRelative || index > 1)) {
                modName = name.substring(0, index);
                ext = name.substring(index + 1);
            } else {
                modName = name;
            }

            temp = ext || modName;
            index = temp.indexOf("!");
            if (index !== -1) {
                //Pull off the strip arg.
                strip = temp.substring(index + 1) === "strip";
                temp = temp.substring(0, index);
                if (ext) {
                    ext = temp;
                } else {
                    modName = temp;
                }
            }

            return {
                moduleName: modName,
                ext: ext,
                strip: strip
            };
        },

        xdRegExp: /^((\w+)\:)?\/\/([^\/\\]+)/,

        /**
         * Is an URL on another domain. Only works for browser use, returns
         * false in non-browser environments. Only used to know if an
         * optimized .js version of a text resource should be loaded
         * instead.
         * @param {String} url
         * @returns Boolean
         */
        useXhr: function (url, protocol, hostname, port) {
            var uProtocol, uHostName, uPort,
                match = text.xdRegExp.exec(url);
            if (!match) {
                return true;
            }
            uProtocol = match[2];
            uHostName = match[3];

            uHostName = uHostName.split(':');
            uPort = uHostName[1];
            uHostName = uHostName[0];

            return (!uProtocol || uProtocol === protocol) &&
                   (!uHostName || uHostName.toLowerCase() === hostname.toLowerCase()) &&
                   ((!uPort && !uHostName) || isSamePort(uProtocol, uPort, protocol, port));
        },

        finishLoad: function (name, strip, content, onLoad) {
            content = strip ? text.strip(content) : content;
            if (masterConfig.isBuild) {
                buildMap[name] = content;
            }
            onLoad(content);
        },

        load: function (name, req, onLoad, config) {
            //Name has format: some.module.filext!strip
            //The strip part is optional.
            //if strip is present, then that means only get the string contents
            //inside a body tag in an HTML string. For XML/SVG content it means
            //removing the <?xml ...?> declarations so the content can be inserted
            //into the current doc without problems.

            // Do not bother with the work if a build and text will
            // not be inlined.
            if (config && config.isBuild && !config.inlineText) {
                onLoad();
                return;
            }

            masterConfig.isBuild = config && config.isBuild;

            var parsed = text.parseName(name),
                nonStripName = parsed.moduleName +
                    (parsed.ext ? '.' + parsed.ext : ''),
                url = req.toUrl(nonStripName),
                useXhr = (masterConfig.useXhr) ||
                         text.useXhr;

            // Do not load if it is an empty: url
            if (url.indexOf('empty:') === 0) {
                onLoad();
                return;
            }

            //Load the text. Use XHR if possible and in a browser.
            if (!hasLocation || useXhr(url, defaultProtocol, defaultHostName, defaultPort)) {
                text.get(url, function (content) {
                    text.finishLoad(name, parsed.strip, content, onLoad);
                }, function (err) {
                    if (onLoad.error) {
                        onLoad.error(err);
                    }
                });
            } else {
                //Need to fetch the resource across domains. Assume
                //the resource has been optimized into a JS module. Fetch
                //by the module name + extension, but do not include the
                //!strip part to avoid file system issues.
                req([nonStripName], function (content) {
                    text.finishLoad(parsed.moduleName + '.' + parsed.ext,
                                    parsed.strip, content, onLoad);
                }, function (err) {
                    if (onLoad.error) {
                        onLoad.error(err);
                    }
                });
            }
        },

        write: function (pluginName, moduleName, write, config) {
            if (buildMap.hasOwnProperty(moduleName)) {
                var content = text.jsEscape(buildMap[moduleName]);
                write.asModule(pluginName + "!" + moduleName,
                               "define(function () { return '" +
                                   content +
                               "';});\n");
            }
        },

        writeFile: function (pluginName, moduleName, req, write, config) {
            var parsed = text.parseName(moduleName),
                extPart = parsed.ext ? '.' + parsed.ext : '',
                nonStripName = parsed.moduleName + extPart,
                //Use a '.js' file name so that it indicates it is a
                //script that can be loaded across domains.
                fileName = req.toUrl(parsed.moduleName + extPart) + '.js';

            //Leverage own load() method to load plugin value, but only
            //write out values that do not have the strip argument,
            //to avoid any potential issues with ! in file names.
            text.load(nonStripName, req, function (value) {
                //Use own write() method to construct full module value.
                //But need to create shell that translates writeFile's
                //write() to the right interface.
                var textWrite = function (contents) {
                    return write(fileName, contents);
                };
                textWrite.asModule = function (moduleName, contents) {
                    return write.asModule(moduleName, fileName, contents);
                };

                text.write(pluginName, nonStripName, textWrite, config);
            }, config);
        }
    };

    if (masterConfig.env === 'node' || (!masterConfig.env &&
            typeof process !== "undefined" &&
            process.versions &&
            !!process.versions.node &&
            !process.versions['node-webkit'] &&
            !process.versions['atom-shell'])) {
        //Using special require.nodeRequire, something added by r.js.
        fs = require.nodeRequire('fs');

        text.get = function (url, callback, errback) {
            try {
                var file = fs.readFileSync(url, 'utf8');
                //Remove BOM (Byte Mark Order) from utf8 files if it is there.
                if (file[0] === '\uFEFF') {
                    file = file.substring(1);
                }
                callback(file);
            } catch (e) {
                if (errback) {
                    errback(e);
                }
            }
        };
    } else if (masterConfig.env === 'xhr' || (!masterConfig.env &&
            text.createXhr())) {
        text.get = function (url, callback, errback, headers) {
            var xhr = text.createXhr(), header;
            xhr.open('GET', url, true);

            //Allow plugins direct access to xhr headers
            if (headers) {
                for (header in headers) {
                    if (headers.hasOwnProperty(header)) {
                        xhr.setRequestHeader(header.toLowerCase(), headers[header]);
                    }
                }
            }

            //Allow overrides specified in config
            if (masterConfig.onXhr) {
                masterConfig.onXhr(xhr, url);
            }

            xhr.onreadystatechange = function (evt) {
                var status, err;
                //Do not explicitly handle errors, those should be
                //visible via console output in the browser.
                if (xhr.readyState === 4) {
                    status = xhr.status || 0;
                    if (status > 399 && status < 600) {
                        //An http 4xx or 5xx error. Signal an error.
                        err = new Error(url + ' HTTP status: ' + status);
                        err.xhr = xhr;
                        if (errback) {
                            errback(err);
                        }
                    } else {
                        callback(xhr.responseText);
                    }

                    if (masterConfig.onXhrComplete) {
                        masterConfig.onXhrComplete(xhr, url);
                    }
                }
            };
            xhr.send(null);
        };
    } else if (masterConfig.env === 'rhino' || (!masterConfig.env &&
            typeof Packages !== 'undefined' && typeof java !== 'undefined')) {
        //Why Java, why is this so awkward?
        text.get = function (url, callback) {
            var stringBuffer, line,
                encoding = "utf-8",
                file = new java.io.File(url),
                lineSeparator = java.lang.System.getProperty("line.separator"),
                input = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(file), encoding)),
                content = '';
            try {
                stringBuffer = new java.lang.StringBuffer();
                line = input.readLine();

                // Byte Order Mark (BOM) - The Unicode Standard, version 3.0, page 324
                // http://www.unicode.org/faq/utf_bom.html

                // Note that when we use utf-8, the BOM should appear as "EF BB BF", but it doesn't due to this bug in the JDK:
                // http://bugs.sun.com/bugdatabase/view_bug.do?bug_id=4508058
                if (line && line.length() && line.charAt(0) === 0xfeff) {
                    // Eat the BOM, since we've already found the encoding on this file,
                    // and we plan to concatenating this buffer with others; the BOM should
                    // only appear at the top of a file.
                    line = line.substring(1);
                }

                if (line !== null) {
                    stringBuffer.append(line);
                }

                while ((line = input.readLine()) !== null) {
                    stringBuffer.append(lineSeparator);
                    stringBuffer.append(line);
                }
                //Make sure we return a JavaScript string and not a Java string.
                content = String(stringBuffer.toString()); //String
            } finally {
                input.close();
            }
            callback(content);
        };
    } else if (masterConfig.env === 'xpconnect' || (!masterConfig.env &&
            typeof Components !== 'undefined' && Components.classes &&
            Components.interfaces)) {
        //Avert your gaze!
        Cc = Components.classes;
        Ci = Components.interfaces;
        Components.utils['import']('resource://gre/modules/FileUtils.jsm');
        xpcIsWindows = ('@mozilla.org/windows-registry-key;1' in Cc);

        text.get = function (url, callback) {
            var inStream, convertStream, fileObj,
                readData = {};

            if (xpcIsWindows) {
                url = url.replace(/\//g, '\\');
            }

            fileObj = new FileUtils.File(url);

            //XPCOM, you so crazy
            try {
                inStream = Cc['@mozilla.org/network/file-input-stream;1']
                           .createInstance(Ci.nsIFileInputStream);
                inStream.init(fileObj, 1, 0, false);

                convertStream = Cc['@mozilla.org/intl/converter-input-stream;1']
                                .createInstance(Ci.nsIConverterInputStream);
                convertStream.init(inStream, "utf-8", inStream.available(),
                Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

                convertStream.readString(inStream.available(), readData);
                convertStream.close();
                inStream.close();
                callback(readData.value);
            } catch (e) {
                throw new Error((fileObj && fileObj.path || '') + ': ' + e);
            }
        };
    }
    return text;
});
;
define('aurelia-binding',['aurelia-binding/dist/commonjs/aurelia-binding'],function(m){return m;});
define('aurelia-bootstrapper',['aurelia-bootstrapper/dist/commonjs/aurelia-bootstrapper'],function(m){return m;});
define('aurelia-dependency-injection',['aurelia-dependency-injection/dist/commonjs/aurelia-dependency-injection'],function(m){return m;});
define('aurelia-framework',['aurelia-framework/dist/commonjs/aurelia-framework'],function(m){return m;});
define('aurelia-loader',['aurelia-loader/dist/commonjs/aurelia-loader'],function(m){return m;});
define('aurelia-loader-default',['aurelia-loader-default/dist/commonjs/aurelia-loader-default'],function(m){return m;});
define('aurelia-logging',['aurelia-logging/dist/commonjs/aurelia-logging'],function(m){return m;});
define('aurelia-metadata',['aurelia-metadata/dist/commonjs/aurelia-metadata'],function(m){return m;});
define('aurelia-pal',['aurelia-pal/dist/commonjs/aurelia-pal'],function(m){return m;});
define('aurelia-pal-browser',['aurelia-pal-browser/dist/commonjs/aurelia-pal-browser'],function(m){return m;});
define('aurelia-path',['aurelia-path/dist/commonjs/aurelia-path'],function(m){return m;});
define('aurelia-polyfills',['aurelia-polyfills/dist/commonjs/aurelia-polyfills'],function(m){return m;});
define('aurelia-task-queue',['aurelia-task-queue/dist/commonjs/aurelia-task-queue'],function(m){return m;});
define('aurelia-templating',['aurelia-templating/dist/commonjs/aurelia-templating'],function(m){return m;});
define('aurelia-testing',['aurelia-testing/dist/commonjs/aurelia-testing'],function(m){return m;});
define('text',['text/text'],function(m){return m;});;
function _aureliaConfigureModuleLoader(){requirejs.config({
  "baseUrl": "src",
  "paths": {
    "root": "src",
    "resources": "resources",
    "elements": "resources/elements",
    "attributes": "resources/attributes",
    "valueConverters": "resources/value-converters",
    "bindingBehaviors": "resources/binding-behaviors",
    "app-bundle": "../scripts/app-bundle"
  },
  "packages": [],
  "stubModules": [],
  "shim": {},
  "bundles": {
    "app-bundle": [
      "text!app.html",
      "text!child-router.html",
      "text!components/sidebar.html",
      "text!nav-bar.html",
      "text!pages/breed.html",
      "text!pages/breeds.html",
      "text!pages/breeds/cra/builds.html",
      "text!pages/breeds/cra/index.html",
      "text!pages/breeds/ecaflip/index.html",
      "text!pages/breeds/eliotrope/index.html",
      "text!pages/breeds/eniripsa/builds.html",
      "text!pages/breeds/eniripsa/index.html",
      "text!pages/breeds/enutrof/index.html",
      "text!pages/breeds/feca/index.html",
      "text!pages/breeds/huppermage/index.html",
      "text!pages/breeds/iop/index.html",
      "text!pages/breeds/osamodas/index.html",
      "text!pages/breeds/ouginak/index.html",
      "text!pages/breeds/pandawa/index.html",
      "text!pages/breeds/roublard/index.html",
      "text!pages/breeds/sacrieur/index.html",
      "text!pages/breeds/sadida/index.html",
      "text!pages/breeds/sram/index.html",
      "text!pages/breeds/steamer/index.html",
      "text!pages/breeds/xelor/index.html",
      "text!pages/breeds/xelor/xelor.html",
      "text!pages/breeds/zobal/index.html",
      "text!styles.css",
      "text!users.html",
      "text!welcome.html"
    ]
  }
})}
//# sourceMappingURL=vendor-bundle.js.map