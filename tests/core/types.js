/**
 * @typedef {Object} Issue
 * @property {string} type
 * @property {string} [message]
 * @property {string} [description]
 * @property {('high'|'medium'|'low'|'error'|'warning')} [severity]
 * @property {{file?:string,line?:number}} [location]
 */

/**
 * @typedef {Object} TestCase
 * @property {string} name
 * @property {string} path
 * @property {'react'|'next'|'angular'} framework
 */

// This file serves purely as a shared JSDoc type reference for the test suite.
export {}; 