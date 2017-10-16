import syntaxTypeScript from "@babel/plugin-syntax-typescript";

import transpileEnum from "./enum";

function isInType(path) {
  switch (path.parent.type) {
    case "TSTypeReference":
    case "TSQualifiedName":
    case "TSExpressionWithTypeArguments":
    case "TSTypeQuery":
      return true;
    default:
      return false;
  }
}

interface State {
  programPath: any;
}

export default function({ types: t }) {
  return {
    inherits: syntaxTypeScript,
    visitor: {
      //"Pattern" alias doesn't include Identifier or RestElement.
      Pattern: visitPattern,
      Identifier: visitPattern,
      RestElement: visitPattern,

      Program(path, state: State) {
        state.programPath = path;
      },

      ImportDeclaration(path, state: State) {
        // Note: this will allow both `import { } from "m"` and `import "m";`.
        // In TypeScript, the former would be elided.
        if (path.node.specifiers.length === 0) {
          return;
        }

        let allElided = true;
        const importsToRemove: Path<Node>[] = [];

        for (const specifier of path.node.specifiers) {
          const binding = path.scope.getBinding(specifier.local.name);
          if (isImportTypeOnly(binding, state.programPath)) {
            importsToRemove.push(binding.path);
          } else {
            allElided = false;
          }
        }

        if (allElided) {
          path.remove();
        } else {
          for (const importPath of importsToRemove) {
            importPath.remove();
          }
        }
      },

      TSDeclareFunction(path) {
        path.remove();
      },

      TSDeclareMethod(path) {
        path.remove();
      },

      VariableDeclaration(path) {
        if (path.node.declare) path.remove();
      },

      ClassMethod(path) {
        const { node } = path;

        if (node.accessibility) node.accessibility = null;
        if (node.abstract) node.abstract = null;
        if (node.optional) node.optional = null;

        if (node.kind !== "constructor") {
          return;
        }

        // Collect parameter properties
        const parameterProperties = [];
        for (const param of node.params) {
          if (param.type === "TSParameterProperty") {
            parameterProperties.push(param.parameter);
          }
        }

        if (!parameterProperties.length) {
          return;
        }

        const assigns = parameterProperties.map(p => {
          let name;
          if (t.isIdentifier(p)) {
            name = p.name;
          } else if (t.isAssignmentPattern(p) && t.isIdentifier(p.left)) {
            name = p.left.name;
          } else {
            throw path.buildCodeFrameError(
              "Parameter properties can not be destructuring patterns.",
            );
          }

          const id = t.identifier(name);
          const thisDotName = t.memberExpression(t.thisExpression(), id);
          const assign = t.assignmentExpression("=", thisDotName, id);
          return t.expressionStatement(assign);
        });

        const statements = node.body.body;

        const first = statements[0];
        const startsWithSuperCall =
          first !== undefined &&
          t.isExpressionStatement(first) &&
          t.isCallExpression(first.expression) &&
          t.isSuper(first.expression.callee);

        // Make sure to put parameter properties *after* the `super` call.
        // TypeScript will enforce that a 'super()' call is the first statement
        // when there are parameter properties.
        node.body.body = startsWithSuperCall
          ? [first, ...assigns, ...statements.slice(1)]
          : [...assigns, ...statements];

        // Rest handled by Function visitor
      },

      TSParameterProperty(path) {
        path.replaceWith(path.node.parameter);
      },

      ClassProperty(path) {
        const { node } = path;
        if (!node.value) {
          path.remove();
          return;
        }

        if (node.accessibility) node.accessibility = null;
        if (node.abstract) node.abstract = null;
        if (node.optional) node.optional = null;
        if (node.typeAnnotation) node.typeAnnotation = null;
      },

      TSIndexSignature(path) {
        path.remove();
      },

      ClassDeclaration(path) {
        const { node } = path;
        if (node.declare) {
          path.remove();
          return;
        }
        if (node.abstract) node.abstract = null;
      },

      Class({ node }) {
        if (node.typeParameters) node.typeParameters = null;
        if (node.superTypeParameters) node.superTypeParameters = null;
        if (node.implements) node.implements = null;
      },

      Function({ node }) {
        if (node.typeParameters) node.typeParameters = null;
        if (node.returnType) node.returnType = null;

        const p0 = node.params[0];
        if (p0 && t.isIdentifier(p0) && p0.name === "this") {
          node.params.shift();
        }
      },

      TSModuleDeclaration(path) {
        if (!path.node.declare && path.node.id.type !== "StringLiteral") {
          throw path.buildCodeFrameError("Namespaces are not supported.");
        }
        path.remove();
      },

      TSInterfaceDeclaration(path) {
        path.remove();
      },

      TSTypeAliasDeclaration(path) {
        path.remove();
      },

      TSEnumDeclaration(path) {
        transpileEnum(path, t);
      },

      TSImportEqualsDeclaration(path) {
        throw path.buildCodeFrameError("`import =` is not supported.");
      },

      TSExportAssignment(path) {
        throw path.buildCodeFrameError("`export =` is not supported.");
      },

      TSTypeAssertion(path) {
        path.replaceWith(path.node.expression);
      },

      TSAsExpression(path) {
        path.replaceWith(path.node.expression);
      },

      TSNonNullExpression(path) {
        path.replaceWith(path.node.expression);
      },

      CallExpression(path) {
        path.node.typeParameters = null;
      },

      NewExpression(path) {
        path.node.typeParameters = null;
      },
    },
  };

  function visitPattern({ node }) {
    if (node.typeAnnotation) node.typeAnnotation = null;
    if (t.isIdentifier(node) && node.optional) node.optional = null;
    // 'access' and 'readonly' are only for parameter properties, so constructor visitor will handle them.
  }

  function isImportTypeOnly(binding, programPath) {
    for (const path of binding.referencePaths) {
      if (!isInType(path)) {
        return false;
      }
    }

    if (binding.identifier.name != "React") {
      return true;
    }

    // "React" is referenced as a value if there are any JSX elements in the code.
    let sourceFileHasJsx = false;
    programPath.traverse({
      JSXElement() {
        sourceFileHasJsx = true;
      },
    });
    return !sourceFileHasJsx;
  }
}
