import ts from '../node_modules/typescript/lib/typescript.js';
import { readFile, writeFile } from 'node:fs/promises';
const file = 'workers-api/src/index.ts';
const source = ts.createSourceFile(file, await readFile(file,'utf8'), ts.ScriptTarget.Latest, true);
const routes=[];
function visit(node) {
  if(ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source)==='app' && ['get','post','put','patch','delete','use'].includes(node.expression.name.text) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
    const args=node.arguments.slice(1);
    routes.push({method:node.expression.name.text.toUpperCase(),path:node.arguments[0].text,line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,
      middleware:args.filter(ts.isIdentifier).map(x=>x.text),inlineHandler:args.some(x=>ts.isArrowFunction(x))});
  }
  ts.forEachChild(node,visit);
}
visit(source);
await writeFile('AUDIT/evidence/active-api-routes.json',JSON.stringify(routes,null,2));
console.log(JSON.stringify({routes:routes.length,publicMutations:routes.filter(x=>['POST','PATCH','PUT','DELETE'].includes(x.method)&&!x.middleware.some(m=>/Auth/.test(m))).map(x=>x.method+' '+x.path)},null,2));
