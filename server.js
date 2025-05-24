"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var cors_1 = require("cors");
var axios_1 = require("axios");
var jsdom_1 = require("jsdom");
var app = (0, express_1.default)();
var port = 8080;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.post('/api/check-compatibility', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var url, response, html, dom, document_1, framework, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                url = req.body.url;
                if (!url) {
                    return [2 /*return*/, res.status(400).json({ error: 'URL is required' })];
                }
                return [4 /*yield*/, axios_1.default.get(url)];
            case 1:
                response = _a.sent();
                html = response.data;
                dom = new jsdom_1.JSDOM(html);
                document_1 = dom.window.document;
                framework = 'Unknown';
                // React detection
                if (html.includes('react') ||
                    document_1.querySelector('[data-reactroot]') ||
                    document_1.querySelector('[data-react-helmet]') ||
                    html.includes('_next/static') // Next.js specific
                ) {
                    framework = html.includes('_next/static') ? 'Next.js' : 'React';
                }
                // Vue detection
                else if (html.includes('vue.js') ||
                    document_1.querySelector('[data-v-')) {
                    framework = 'Vue.js';
                }
                // Angular detection
                else if (html.includes('ng-version') ||
                    document_1.querySelector('[ng-version]')) {
                    framework = 'Angular';
                }
                // Svelte detection
                else if (html.includes('svelte-')) {
                    framework = 'Svelte';
                }
                res.json({ framework: framework });
                return [3 /*break*/, 3];
            case 2:
                error_1 = _a.sent();
                console.error('Error checking compatibility:', error_1);
                res.status(500).json({ error: 'Failed to analyze website' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
app.listen(port, function () {
    console.log("Server running at http://localhost:".concat(port));
});
