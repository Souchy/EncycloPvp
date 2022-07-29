define('app',['require','exports','module'],function (require, exports, module) {"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = void 0;
var App = (function () {
    function App() {
    }
    App.prototype.configureRouter = function (config, router) {
        config.title = 'Aurelia';
        config.map([
            {
                route: ['', 'welcome'],
                name: 'welcome',
                moduleId: './welcome',
                nav: true,
                title: 'Welcome'
            },
            {
                route: 'users',
                name: 'users',
                moduleId: './users',
                nav: true,
                title: 'Github Users'
            },
            {
                route: 'child-router',
                name: 'child-router',
                moduleId: './child-router',
                nav: true,
                title: 'Child Router'
            }
        ]);
        this.router = router;
    };
    return App;
}());
exports.App = App;

});
;
define('text!app.html',[],function(){return "<template>\n  <require from=\"bootstrap/dist/css/bootstrap.min.css\"></require>\n  <require from=\"@fortawesome/fontawesome-free/css/all.min.css\"></require>\n  <require from=\"./styles.css\"></require>\n\n  <require from=\"./nav-bar.html\"></require>\n\n  <nav-bar router.bind=\"router\"></nav-bar>\n\n  <div class=\"page-host\">\n    <router-view></router-view>\n  </div>\n</template>\n";});;
define('blur-image',['require','exports','module','tslib','aurelia-framework'],function (require, exports, module) {"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlurImageCustomAttribute = void 0;
var tslib_1 = require("tslib");
var aurelia_framework_1 = require("aurelia-framework");
var BlurImageCustomAttribute = (function () {
    function BlurImageCustomAttribute(element) {
        this.element = element;
    }
    BlurImageCustomAttribute.prototype.valueChanged = function (newImage) {
        var _this = this;
        if (newImage.complete) {
            drawBlur(this.element, newImage);
        }
        else {
            newImage.onload = function () { return drawBlur(_this.element, newImage); };
        }
    };
    BlurImageCustomAttribute = tslib_1.__decorate([
        aurelia_framework_1.autoinject,
        tslib_1.__metadata("design:paramtypes", [Element])
    ], BlurImageCustomAttribute);
    return BlurImageCustomAttribute;
}());
exports.BlurImageCustomAttribute = BlurImageCustomAttribute;
var mul_table = [
    512, 512, 456, 512, 328, 456, 335, 512, 405, 328, 271, 456, 388, 335, 292, 512,
    454, 405, 364, 328, 298, 271, 496, 456, 420, 388, 360, 335, 312, 292, 273, 512,
    482, 454, 428, 405, 383, 364, 345, 328, 312, 298, 284, 271, 259, 496, 475, 456,
    437, 420, 404, 388, 374, 360, 347, 335, 323, 312, 302, 292, 282, 273, 265, 512,
    497, 482, 468, 454, 441, 428, 417, 405, 394, 383, 373, 364, 354, 345, 337, 328,
    320, 312, 305, 298, 291, 284, 278, 271, 265, 259, 507, 496, 485, 475, 465, 456,
    446, 437, 428, 420, 412, 404, 396, 388, 381, 374, 367, 360, 354, 347, 341, 335,
    329, 323, 318, 312, 307, 302, 297, 292, 287, 282, 278, 273, 269, 265, 261, 512,
    505, 497, 489, 482, 475, 468, 461, 454, 447, 441, 435, 428, 422, 417, 411, 405,
    399, 394, 389, 383, 378, 373, 368, 364, 359, 354, 350, 345, 341, 337, 332, 328,
    324, 320, 316, 312, 309, 305, 301, 298, 294, 291, 287, 284, 281, 278, 274, 271,
    268, 265, 262, 259, 257, 507, 501, 496, 491, 485, 480, 475, 470, 465, 460, 456,
    451, 446, 442, 437, 433, 428, 424, 420, 416, 412, 408, 404, 400, 396, 392, 388,
    385, 381, 377, 374, 370, 367, 363, 360, 357, 354, 350, 347, 344, 341, 338, 335,
    332, 329, 326, 323, 320, 318, 315, 312, 310, 307, 304, 302, 299, 297, 294, 292,
    289, 287, 285, 282, 280, 278, 275, 273, 271, 269, 267, 265, 263, 261, 259
];
var shg_table = [
    9, 11, 12, 13, 13, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17,
    17, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 18, 18, 18, 18, 19,
    19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 20, 20, 20,
    20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 21,
    21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21,
    21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 22, 22, 22, 22, 22, 22,
    22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22,
    22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 23,
    23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
    23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
    23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
    23, 23, 23, 23, 23, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
    24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
    24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
    24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
    24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24
];
var BLUR_RADIUS = 40;
function stackBlurCanvasRGBA(canvas, top_x, top_y, width, height, radius) {
    if (isNaN(radius) || radius < 1)
        return;
    radius |= 0;
    var context = canvas.getContext("2d");
    var imageData;
    try {
        imageData = context.getImageData(top_x, top_y, width, height);
    }
    catch (e) {
        throw new Error("unable to access image data: " + e);
    }
    var pixels = imageData.data;
    var x, y, i, p, yp, yi, yw, r_sum, g_sum, b_sum, a_sum, r_out_sum, g_out_sum, b_out_sum, a_out_sum, r_in_sum, g_in_sum, b_in_sum, a_in_sum, pr, pg, pb, pa, rbs;
    var div = radius + radius + 1;
    var w4 = width << 2;
    var widthMinus1 = width - 1;
    var heightMinus1 = height - 1;
    var radiusPlus1 = radius + 1;
    var sumFactor = radiusPlus1 * (radiusPlus1 + 1) / 2;
    var stackStart = new BlurStack();
    var stack = stackStart;
    for (i = 1; i < div; i++) {
        stack = stack.next = new BlurStack();
        if (i == radiusPlus1)
            var stackEnd = stack;
    }
    stack.next = stackStart;
    var stackIn = null;
    var stackOut = null;
    yw = yi = 0;
    var mul_sum = mul_table[radius];
    var shg_sum = shg_table[radius];
    for (y = 0; y < height; y++) {
        r_in_sum = g_in_sum = b_in_sum = a_in_sum = r_sum = g_sum = b_sum = a_sum = 0;
        r_out_sum = radiusPlus1 * (pr = pixels[yi]);
        g_out_sum = radiusPlus1 * (pg = pixels[yi + 1]);
        b_out_sum = radiusPlus1 * (pb = pixels[yi + 2]);
        a_out_sum = radiusPlus1 * (pa = pixels[yi + 3]);
        r_sum += sumFactor * pr;
        g_sum += sumFactor * pg;
        b_sum += sumFactor * pb;
        a_sum += sumFactor * pa;
        stack = stackStart;
        for (i = 0; i < radiusPlus1; i++) {
            stack.r = pr;
            stack.g = pg;
            stack.b = pb;
            stack.a = pa;
            stack = stack.next;
        }
        for (i = 1; i < radiusPlus1; i++) {
            p = yi + ((widthMinus1 < i ? widthMinus1 : i) << 2);
            r_sum += (stack.r = (pr = pixels[p])) * (rbs = radiusPlus1 - i);
            g_sum += (stack.g = (pg = pixels[p + 1])) * rbs;
            b_sum += (stack.b = (pb = pixels[p + 2])) * rbs;
            a_sum += (stack.a = (pa = pixels[p + 3])) * rbs;
            r_in_sum += pr;
            g_in_sum += pg;
            b_in_sum += pb;
            a_in_sum += pa;
            stack = stack.next;
        }
        stackIn = stackStart;
        stackOut = stackEnd;
        for (x = 0; x < width; x++) {
            pixels[yi + 3] = pa = (a_sum * mul_sum) >> shg_sum;
            if (pa != 0) {
                pa = 255 / pa;
                pixels[yi] = ((r_sum * mul_sum) >> shg_sum) * pa;
                pixels[yi + 1] = ((g_sum * mul_sum) >> shg_sum) * pa;
                pixels[yi + 2] = ((b_sum * mul_sum) >> shg_sum) * pa;
            }
            else {
                pixels[yi] = pixels[yi + 1] = pixels[yi + 2] = 0;
            }
            r_sum -= r_out_sum;
            g_sum -= g_out_sum;
            b_sum -= b_out_sum;
            a_sum -= a_out_sum;
            r_out_sum -= stackIn.r;
            g_out_sum -= stackIn.g;
            b_out_sum -= stackIn.b;
            a_out_sum -= stackIn.a;
            p = (yw + ((p = x + radius + 1) < widthMinus1 ? p : widthMinus1)) << 2;
            r_in_sum += (stackIn.r = pixels[p]);
            g_in_sum += (stackIn.g = pixels[p + 1]);
            b_in_sum += (stackIn.b = pixels[p + 2]);
            a_in_sum += (stackIn.a = pixels[p + 3]);
            r_sum += r_in_sum;
            g_sum += g_in_sum;
            b_sum += b_in_sum;
            a_sum += a_in_sum;
            stackIn = stackIn.next;
            r_out_sum += (pr = stackOut.r);
            g_out_sum += (pg = stackOut.g);
            b_out_sum += (pb = stackOut.b);
            a_out_sum += (pa = stackOut.a);
            r_in_sum -= pr;
            g_in_sum -= pg;
            b_in_sum -= pb;
            a_in_sum -= pa;
            stackOut = stackOut.next;
            yi += 4;
        }
        yw += width;
    }
    for (x = 0; x < width; x++) {
        g_in_sum = b_in_sum = a_in_sum = r_in_sum = g_sum = b_sum = a_sum = r_sum = 0;
        yi = x << 2;
        r_out_sum = radiusPlus1 * (pr = pixels[yi]);
        g_out_sum = radiusPlus1 * (pg = pixels[yi + 1]);
        b_out_sum = radiusPlus1 * (pb = pixels[yi + 2]);
        a_out_sum = radiusPlus1 * (pa = pixels[yi + 3]);
        r_sum += sumFactor * pr;
        g_sum += sumFactor * pg;
        b_sum += sumFactor * pb;
        a_sum += sumFactor * pa;
        stack = stackStart;
        for (i = 0; i < radiusPlus1; i++) {
            stack.r = pr;
            stack.g = pg;
            stack.b = pb;
            stack.a = pa;
            stack = stack.next;
        }
        yp = width;
        for (i = 1; i <= radius; i++) {
            yi = (yp + x) << 2;
            r_sum += (stack.r = (pr = pixels[yi])) * (rbs = radiusPlus1 - i);
            g_sum += (stack.g = (pg = pixels[yi + 1])) * rbs;
            b_sum += (stack.b = (pb = pixels[yi + 2])) * rbs;
            a_sum += (stack.a = (pa = pixels[yi + 3])) * rbs;
            r_in_sum += pr;
            g_in_sum += pg;
            b_in_sum += pb;
            a_in_sum += pa;
            stack = stack.next;
            if (i < heightMinus1) {
                yp += width;
            }
        }
        yi = x;
        stackIn = stackStart;
        stackOut = stackEnd;
        for (y = 0; y < height; y++) {
            p = yi << 2;
            pixels[p + 3] = pa = (a_sum * mul_sum) >> shg_sum;
            if (pa > 0) {
                pa = 255 / pa;
                pixels[p] = ((r_sum * mul_sum) >> shg_sum) * pa;
                pixels[p + 1] = ((g_sum * mul_sum) >> shg_sum) * pa;
                pixels[p + 2] = ((b_sum * mul_sum) >> shg_sum) * pa;
            }
            else {
                pixels[p] = pixels[p + 1] = pixels[p + 2] = 0;
            }
            r_sum -= r_out_sum;
            g_sum -= g_out_sum;
            b_sum -= b_out_sum;
            a_sum -= a_out_sum;
            r_out_sum -= stackIn.r;
            g_out_sum -= stackIn.g;
            b_out_sum -= stackIn.b;
            a_out_sum -= stackIn.a;
            p = (x + (((p = y + radiusPlus1) < heightMinus1 ? p : heightMinus1) * width)) << 2;
            r_sum += (r_in_sum += (stackIn.r = pixels[p]));
            g_sum += (g_in_sum += (stackIn.g = pixels[p + 1]));
            b_sum += (b_in_sum += (stackIn.b = pixels[p + 2]));
            a_sum += (a_in_sum += (stackIn.a = pixels[p + 3]));
            stackIn = stackIn.next;
            r_out_sum += (pr = stackOut.r);
            g_out_sum += (pg = stackOut.g);
            b_out_sum += (pb = stackOut.b);
            a_out_sum += (pa = stackOut.a);
            r_in_sum -= pr;
            g_in_sum -= pg;
            b_in_sum -= pb;
            a_in_sum -= pa;
            stackOut = stackOut.next;
            yi += width;
        }
    }
    context.putImageData(imageData, top_x, top_y);
}
function BlurStack() {
    this.r = 0;
    this.g = 0;
    this.b = 0;
    this.a = 0;
    this.next = null;
}
function drawBlur(canvas, image) {
    var w = canvas.width;
    var h = canvas.height;
    var canvasContext = canvas.getContext('2d');
    canvasContext.drawImage(image, 0, 0, w, h);
    stackBlurCanvasRGBA(canvas, 0, 0, w, h, BLUR_RADIUS);
}

});
;
define('child-router',['require','exports','module'],function (require, exports, module) {"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChildRouter = void 0;
var ChildRouter = (function () {
    function ChildRouter() {
        this.heading = 'Child Router';
    }
    ChildRouter.prototype.configureRouter = function (config, router) {
        config.map([
            {
                route: ['', 'welcome'],
                name: 'welcome',
                moduleId: './welcome',
                nav: true,
                title: 'Welcome'
            },
            {
                route: 'users',
                name: 'users',
                moduleId: './users',
                nav: true,
                title: 'Github Users'
            },
            {
                route: 'child-router',
                name: 'child-router',
                moduleId: './child-router',
                nav: true,
                title: 'Child Router'
            }
        ]);
        this.router = router;
    };
    return ChildRouter;
}());
exports.ChildRouter = ChildRouter;

});
;
define('text!child-router.html',[],function(){return "<template>\n  <section class=\"au-animate\">\n    <h2>${heading}</h2>\n    <div class=\"container-fluid card pt-3\">\n      <div class=\"row\">\n        <div class=\"col-md-2\">\n          <div class=\"card\">\n            <div class=\"list-group list-group-flush\">\n              <a\n                repeat.for=\"row of router.navigation\"\n                class=\"list-group-item list-group-item-action ${row.isActive ? 'active' : ''}\"\n                href.bind=\"row.href\">${row.title}</a>\n            </div>\n          </div>\n        </div>\n        <div class=\"col-md-10\">\n          <router-view></router-view>\n        </div>\n      </div>\n    </div>\n  </section>\n</template>\n";});;
define('environment',['require','exports','module'],function (require, exports, module) {"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    debug: true,
    testing: true
};

});
;
define('main',['require','exports','module','tslib','bootstrap','./environment'],function (require, exports, module) {"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configure = void 0;
var tslib_1 = require("tslib");
require("bootstrap");
var environment_1 = tslib_1.__importDefault(require("./environment"));
function configure(aurelia) {
    aurelia.use
        .standardConfiguration()
        .feature('resources');
    aurelia.use.developmentLogging(environment_1.default.debug ? 'debug' : 'warn');
    if (environment_1.default.testing) {
        aurelia.use.plugin('aurelia-testing');
    }
    aurelia.start().then(function () { return aurelia.setRoot(); });
}
exports.configure = configure;

});
;
define('text!nav-bar.html',[],function(){return "<template bindable=\"router\">\n  <nav class=\"navbar navbar-expand-lg fixed-top navbar-dark bg-dark\" role=\"navigation\">\n    <a class=\"navbar-brand\" href=\"#\">\n      <i class=\"fas fa-home\"></i>\n      <span>${router.title}</span>\n    </a>\n\n    <button class=\"navbar-toggler\" type=\"button\" data-toggle=\"collapse\" data-target=\"#navigation-navbar-collapse-1\" aria-controls=\"navigation-navbar-collapse-1\" aria-expanded=\"false\" aria-label=\"Toggle navigation\">\n      <span class=\"navbar-toggler-icon\"></span>\n    </button>\n\n    <div class=\"collapse navbar-collapse\" id=\"navigation-navbar-collapse-1\">\n      <ul class=\"navbar-nav mr-auto\">\n        <li repeat.for=\"row of router.navigation\" class=\"nav-item ${row.isActive ? 'active' : ''}\">\n          <a class=\"nav-link\" href.bind=\"row.href\">${row.title}</a>\n        </li>\n      </ul>\n\n      <ul class=\"navbar-nav\">\n        <li class=\"nav-item\" if.bind=\"router.isNavigating & debounce\">\n          <i class=\"fas fa-circle-notch fa-spin text-white fa-2x\"></i>\n        </li>\n      </ul>\n    </div>\n  </nav>\n</template>\n";});;
define('resources/index',['require','exports','module'],function (require, exports, module) {"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configure = void 0;
function configure(config) {
}
exports.configure = configure;

});
;
define('text!styles.css',[],function(){return "body {\n  margin: 0;\n}\n.page-host {\n  position: absolute;\n  left: 0;\n  right: 0;\n  top: 56px;\n  bottom: 0;\n  overflow-x: hidden;\n  overflow-y: auto;\n}\n@media print {\n  .page-host {\n    position: absolute;\n    left: 10px;\n    right: 0;\n    top: 56px;\n    bottom: 0;\n    overflow-y: inherit;\n    overflow-x: inherit;\n  }\n}\nsection {\n  margin: 1rem;\n}\n.navbar-nav li.loader {\n  margin: 12px 24px 0 6px;\n}\n.pictureDetail {\n  max-width: 425px;\n}\n/* animate page transitions */\nsection.au-enter-active {\n  -webkit-animation: fadeInRight 1s;\n  animation: fadeInRight 1s;\n}\ndiv.au-stagger {\n  /* 50ms will be applied between each successive enter operation */\n  -webkit-animation-delay: 50ms;\n  animation-delay: 50ms;\n}\n.user-card-container.au-enter {\n  opacity: 0;\n}\n.user-card-container.au-enter-active {\n  -webkit-animation: fadeIn 2s;\n  animation: fadeIn 2s;\n}\n.user-card {\n  overflow: hidden;\n  position: relative;\n  border: 1px solid #CCC;\n  border-radius: 8px;\n  text-align: center;\n  padding: 0;\n  background-color: #337ab7;\n  color: #88acd9;\n  margin-bottom: 32px;\n  box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);\n}\n.user-card .content {\n  margin-top: 10px;\n}\n.user-card .content .name {\n  color: white;\n  text-shadow: 0 0 6px rgba(0, 0, 0, 0.5);\n  font-size: 18px;\n}\n.user-card .header-bg {\n  /* This stretches the canvas across the entire hero unit */\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100%;\n  height: 70px;\n  border-bottom: 1px #FFF solid;\n  border-radius: 6px 6px 0 0;\n}\n.user-card .avatar {\n  position: relative;\n  margin-top: 15px;\n  z-index: 100;\n}\n.user-card .avatar img {\n  width: 100px;\n  height: 100px;\n  -webkit-border-radius: 50%;\n  -moz-border-radius: 50%;\n  border-radius: 50%;\n  border: 2px #FFF solid;\n}\n/* animation definitions */\n@-webkit-keyframes fadeInRight {\n  0% {\n    opacity: 0;\n    -webkit-transform: translate3d(100%, 0, 0);\n    transform: translate3d(100%, 0, 0);\n  }\n  100% {\n    opacity: 1;\n    -webkit-transform: none;\n    transform: none;\n  }\n}\n@keyframes fadeInRight {\n  0% {\n    opacity: 0;\n    -webkit-transform: translate3d(100%, 0, 0);\n    -ms-transform: translate3d(100%, 0, 0);\n    transform: translate3d(100%, 0, 0);\n  }\n  100% {\n    opacity: 1;\n    -webkit-transform: none;\n    -ms-transform: none;\n    transform: none;\n  }\n}\n@-webkit-keyframes fadeIn {\n  0% {\n    opacity: 0;\n  }\n  100% {\n    opacity: 1;\n  }\n}\n@keyframes fadeIn {\n  0% {\n    opacity: 0;\n  }\n  100% {\n    opacity: 1;\n  }\n}\n";});;
define('users',['require','exports','module','tslib','aurelia-framework','aurelia-fetch-client'],function (require, exports, module) {"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Users = void 0;
var tslib_1 = require("tslib");
var aurelia_framework_1 = require("aurelia-framework");
var aurelia_fetch_client_1 = require("aurelia-fetch-client");
var Users = (function () {
    function Users(http) {
        this.http = http;
        this.heading = 'Github Users';
        this.users = [];
        http.configure(function (config) {
            config
                .useStandardConfiguration()
                .withBaseUrl('https://api.github.com/');
        });
    }
    Users.prototype.activate = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var response, _a;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4, this.http.fetch('users')];
                    case 1:
                        response = _b.sent();
                        _a = this;
                        return [4, response.json()];
                    case 2:
                        _a.users = _b.sent();
                        return [2];
                }
            });
        });
    };
    Users = tslib_1.__decorate([
        aurelia_framework_1.autoinject,
        tslib_1.__metadata("design:paramtypes", [aurelia_fetch_client_1.HttpClient])
    ], Users);
    return Users;
}());
exports.Users = Users;

});
;
define('text!users.html',[],function(){return "<template>\n  <require from=\"./blur-image\"></require>\n\n  <section class=\"au-animate\">\n      <h2>${heading}</h2>\n      <div class=\"row au-stagger\">\n        <div class=\"col-sm-6 col-md-3 user-card-container au-animate\" repeat.for=\"user of users\">\n            <div class=\"user-card\">\n                <canvas class=\"header-bg\" width=\"250\" height=\"70\" blur-image.bind=\"image\"></canvas>\n                <div class=\"avatar\">\n                    <img src.bind=\"user.avatar_url\" crossorigin ref=\"image\"/>\n                </div>\n                <div class=\"content\">\n                    <p class=\"name\">${user.login}</p>\n                    <p><a target=\"_blank\" class=\"btn btn-default\" href.bind=\"user.html_url\">Contact</a></p>\n                </div>\n            </div>\n        </div>\n      </div>\n  </section>\n</template>\n";});;
define('welcome',['require','exports','module','tslib','aurelia-framework'],function (require, exports, module) {"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpperValueConverter = exports.Welcome = void 0;
var tslib_1 = require("tslib");
var aurelia_framework_1 = require("aurelia-framework");
var Welcome = (function () {
    function Welcome() {
        this.heading = 'Welcome to the Aurelia Navigation App!';
        this.firstName = 'John';
        this.lastName = 'Doe';
        this.previousValue = this.fullName;
    }
    Object.defineProperty(Welcome.prototype, "fullName", {
        get: function () {
            return "".concat(this.firstName, " ").concat(this.lastName);
        },
        enumerable: false,
        configurable: true
    });
    Welcome.prototype.submit = function () {
        this.previousValue = this.fullName;
        alert("Welcome, ".concat(this.fullName, "!"));
    };
    Welcome.prototype.canDeactivate = function () {
        if (this.fullName !== this.previousValue) {
            return confirm('Are you sure you want to leave?');
        }
    };
    tslib_1.__decorate([
        (0, aurelia_framework_1.computedFrom)('firstName', 'lastName'),
        tslib_1.__metadata("design:type", String),
        tslib_1.__metadata("design:paramtypes", [])
    ], Welcome.prototype, "fullName", null);
    return Welcome;
}());
exports.Welcome = Welcome;
var UpperValueConverter = (function () {
    function UpperValueConverter() {
    }
    UpperValueConverter.prototype.toView = function (value) {
        return value && value.toUpperCase();
    };
    return UpperValueConverter;
}());
exports.UpperValueConverter = UpperValueConverter;

});
;
define('text!welcome.html',[],function(){return "<template>\n  <section class=\"au-animate\">\n    <h2>${heading}</h2>\n    <form role=\"form\" submit.delegate=\"submit()\">\n      <div class=\"form-group\">\n        <label for=\"fn\">First Name</label>\n        <input type=\"text\" value.bind=\"firstName\" class=\"form-control\" id=\"fn\" placeholder=\"first name\">\n      </div>\n      <div class=\"form-group\">\n        <label for=\"ln\">Last Name</label>\n        <input type=\"text\" value.bind=\"lastName\" class=\"form-control\" id=\"ln\" placeholder=\"last name\">\n      </div>\n      <div class=\"form-group\">\n        <label>Full Name</label>\n        <p class=\"help-block\">${fullName | upper}</p>\n      </div>\n      <button type=\"submit\" class=\"btn btn-primary\">Submit</button>\n    </form>\n  </section>\n</template>\n";});;
define('resources',['resources/index'],function(m){return m;});
//# sourceMappingURL=app-bundle.js.map