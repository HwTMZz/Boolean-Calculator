function grayCode(bitsCount){
  const size=1<<bitsCount; const out=[];
  for(let i=0;i<size;i++){ const g=i^(i>>1); out.push(g.toString(2).padStart(bitsCount,'0')); }
  return out;
}

function buildKMap(ast, vars){
  const n=vars.length; const rowCount=Math.ceil(n/2); const colCount=n-rowCount;
  const rowVars=vars.slice(0,rowCount), colVars=vars.slice(rowCount);
  const rowCodes=grayCode(rowCount), colCodes= colCount>0?grayCode(colCount):[''];
  const grid=rowCodes.map(rc=>colCodes.map(cc=>{
    const bindings={};
    rowVars.forEach((v,idx)=>bindings[v]=Number(rc[idx]));
    colVars.forEach((v,idx)=>bindings[v]=Number(cc[idx]));
    return evalBooleanWithTrace(ast,bindings).value;
  }));
  return {rowVars,colVars,rowCodes,colCodes,grid};
}
