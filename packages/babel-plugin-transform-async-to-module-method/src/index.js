import remapAsyncToGenerator from "@babel/helper-remap-async-to-generator";

import { addNamed } from "@babel/helper-module-imports";

export default function({ types: t }, options) {
  const { method, module } = options;
  return {
    visitor: {
      Function(path, state) {
        if (!path.node.async || path.node.generator) return;

        let wrapAsync = state.methodWrapper;
        if (wrapAsync) {
          wrapAsync = t.cloneDeep(wrapAsync);
        } else {
          wrapAsync = state.methodWrapper = addNamed(path, method, module);
        }

        remapAsyncToGenerator(path, state.file, {
          wrapAsync,
        });
      },
    },
  };
}
