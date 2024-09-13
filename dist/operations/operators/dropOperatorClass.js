"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var dropOperatorClass_exports = {};
__export(dropOperatorClass_exports, {
  dropOperatorClass: () => dropOperatorClass
});
module.exports = __toCommonJS(dropOperatorClass_exports);
function dropOperatorClass(mOptions) {
  const _drop = (operatorClassName, indexMethod, options = {}) => {
    const { ifExists = false, cascade = false } = options;
    const operatorClassNameStr = mOptions.literal(operatorClassName);
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    return `DROP OPERATOR CLASS${ifExistsStr} ${operatorClassNameStr} USING ${indexMethod}${cascadeStr};`;
  };
  return _drop;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  dropOperatorClass
});
