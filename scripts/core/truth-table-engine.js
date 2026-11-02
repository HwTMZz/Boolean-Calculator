function buildTruthTableModel(ast, vars){
  const analysis=astAnalysis(ast,vars);
  const rows=[];
  const n=vars.length;
  const total=1<<n;
  for(let i=0;i<total;i++){
    const bindings={}; const bits=[];
    for(let b=0;b<n;b++){
      const bit=(i>>(n-1-b))&1;
      bindings[vars[b]]=bit; bits.push(bit);
    }
    const detailed=evalBooleanDetailed(ast,bindings);
    rows.push({
      index:i,
      bits,
      bindings,
      values:detailed.values,
      result:detailed.value
    });
  }
  const variableColumns=analysis.nodes.filter(n=>n.type==='VAR');
  const intermediateColumns=analysis.nodes.filter(n=>n.type!=='VAR' && n.type!=='NUM' && n.id!==ast.id);
  const orderedColumns=[...variableColumns,...intermediateColumns,ast];
  const columns=orderedColumns.map(node=>({
    nodeId:node.id,
    label:node.type==='VAR' ? node.name : nodeLabel(node),
    type:node.type,
    dependencies:astDependencies(node),
    isVariable:node.type==='VAR',
    isResult:node.id===ast.id
  }));
  return {ast,vars,analysis,columns,rows,resultNodeId:ast.id};
}

function generateTruthTable(ast, vars){
  return buildTruthTableModel(ast,vars).rows.map(r=>({bits:r.bits,result:r.result}));
}
