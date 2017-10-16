import presetStage3 from "@babel/preset-stage-3";

import transformFunctionSent from "@babel/plugin-transform-function-sent";
import transformExportNamespace from "@babel/plugin-transform-export-namespace";
import transformNumericSeparator from "@babel/plugin-transform-numeric-separator";
import transformThrowExpressions from "@babel/plugin-transform-throw-expressions";

export default function() {
  return {
    presets: [presetStage3],
    plugins: [
      transformFunctionSent,
      transformExportNamespace,
      transformNumericSeparator,
      transformThrowExpressions,
    ],
  };
}
