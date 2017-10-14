import babel from "rollup-plugin-babel";
import nodeResolve from "rollup-plugin-node-resolve";

export default {
  input: "src/index.js",
  output: {
    file: "lib/index.js",
    format: "cjs",
  },
  plugins: [
    babel({
      babelrc: false,
      presets: [
        [
          "env",
          {
            loose: true,
            modules: false,
            targets: {
              node: "4.2",
            },
          },
        ],
        "flow",
      ],
      plugins: ["external-helpers"],
    }),
    nodeResolve(),
  ],
};
