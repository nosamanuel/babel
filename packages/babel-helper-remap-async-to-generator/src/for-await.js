import * as t from "@babel/types";
import template from "@babel/template";

const awaitTemplate = `
  function* wrapper() {
    var ITERATOR_COMPLETION = true;
    var ITERATOR_HAD_ERROR_KEY = false;
    var ITERATOR_ERROR_KEY = undefined;
    try {
      for (
        var ITERATOR_KEY = GET_ITERATOR(OBJECT), STEP_KEY, STEP_VALUE;
        (
          STEP_KEY = yield AWAIT(ITERATOR_KEY.next()),
          ITERATOR_COMPLETION = STEP_KEY.done,
          STEP_VALUE = yield AWAIT(STEP_KEY.value),
          !ITERATOR_COMPLETION
        );
        ITERATOR_COMPLETION = true) {
      }
    } catch (err) {
      ITERATOR_HAD_ERROR_KEY = true;
      ITERATOR_ERROR_KEY = err;
    } finally {
      try {
        if (!ITERATOR_COMPLETION && ITERATOR_KEY.return != null) {
          yield AWAIT(ITERATOR_KEY.return());
        }
      } finally {
        if (ITERATOR_HAD_ERROR_KEY) {
          throw ITERATOR_ERROR_KEY;
        }
      }
    }
  }
`;
const buildForAwait = template(awaitTemplate);
const buildForAwaitWithoutWrapping = template(
  awaitTemplate.replace(/\bAWAIT\b/g, ""),
);

export default function(path, helpers) {
  const { node, scope, parent } = path;

  const stepKey = scope.generateUidIdentifier("step");
  const stepValue = scope.generateUidIdentifier("value");
  const left = node.left;
  let declar;

  if (t.isIdentifier(left) || t.isPattern(left) || t.isMemberExpression(left)) {
    // for await (i of test), for await ({ i } of test)
    declar = t.expressionStatement(
      t.assignmentExpression("=", left, stepValue),
    );
  } else if (t.isVariableDeclaration(left)) {
    // for await (let i of test)
    declar = t.variableDeclaration(left.kind, [
      t.variableDeclarator(left.declarations[0].id, stepValue),
    ]);
  }

  const build = helpers.wrapAwait
    ? buildForAwait
    : buildForAwaitWithoutWrapping;
  let template = build({
    ITERATOR_HAD_ERROR_KEY: scope.generateUidIdentifier("didIteratorError"),
    ITERATOR_COMPLETION: scope.generateUidIdentifier(
      "iteratorNormalCompletion",
    ),
    ITERATOR_ERROR_KEY: scope.generateUidIdentifier("iteratorError"),
    ITERATOR_KEY: scope.generateUidIdentifier("iterator"),
    GET_ITERATOR: helpers.getAsyncIterator,
    OBJECT: node.right,
    STEP_VALUE: stepValue,
    STEP_KEY: stepKey,
    AWAIT: helpers.wrapAwait,
  });

  // remove generator function wrapper
  template = template.body.body;

  const isLabeledParent = t.isLabeledStatement(parent);
  const tryBody = template[3].block.body;
  const loop = tryBody[0];

  if (isLabeledParent) {
    tryBody[0] = t.labeledStatement(parent.label, loop);
  }

  return {
    replaceParent: isLabeledParent,
    node: template,
    declar,
    loop,
  };
}
