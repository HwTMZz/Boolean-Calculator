function astAnalysis(ast, vars){
  const nodes=annotateAST(ast);
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const opNodes=[];
  (function collectPostOrder(node){
    (node.children||[]).forEach(collectPostOrder);
    if(node.type!=='VAR' && node.type!=='NUM') opNodes.push(node);
  })(ast);
  const filters=[{
    id:'all',
    label:'Show All',
    nodeId:null,
    dependencies:[...vars],
    kind:'all'
  }];
  opNodes.forEach(node=>{
    const subtreeIds=[];
    (function collect(n){
      (n.children||[]).forEach(collect);
      subtreeIds.push(n.id);
    })(node);
    filters.push({
      id:`node-${node.id}`,
      label:nodeLabel(node),
      nodeId:node.id,
      dependencies:astDependencies(node),
      nodeIds:subtreeIds,
      kind:'node'
    });
  });
  return {nodes,byId,opNodes,filters};
}

function evalBooleanDetailed(ast, bindings){
  const values={};
  const trace=[];
  function ev(node){
    if(node.type==='VAR'){
      const value=bindings[node.name]|0;
      values[node.id]=value;
      return {value,text:node.name};
    }
    if(node.type==='NOT'){
      const c=ev(node.children[0]); const value=c.value?0:1;
      values[node.id]=value;
      trace.push({nodeId:node.id,type:'NOT',before:`NOT ${c.text}`,result:value,dependencies:astDependencies(node)});
      return {value,text:`NOT ${c.text}`};
    }
    const a=ev(node.children[0]), b=ev(node.children[1]); let value;
    switch(node.type){
      case 'AND': value=(a.value&&b.value)?1:0; break;
      case 'OR': value=(a.value||b.value)?1:0; break;
      case 'XOR': value=(a.value!==b.value)?1:0; break;
      case 'NAND': value=(a.value&&b.value)?0:1; break;
      case 'NOR': value=(a.value||b.value)?0:1; break;
      case 'XNOR': value=(a.value!==b.value)?1:0; break;
    }
    values[node.id]=value;
    trace.push({nodeId:node.id,type:node.type,before:`${a.text} ${node.type} ${b.text}`,result:value,dependencies:astDependencies(node)});
    return {value,text:nodeLabel(node)};
  }
  const final=ev(ast);
  return {value:final.value,values,trace};
}

function evalBooleanWithTrace(ast, bindings){
  const detailed=evalBooleanDetailed(ast,bindings);
  return {
    value:detailed.value,
    trace:detailed.trace.map(t=>({type:t.type,before:t.before,result:t.result,nodeId:t.nodeId,dependencies:t.dependencies}))
  };
}
