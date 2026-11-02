function decToBits(decStr){ const num=parseInt(decStr,10)||0; return num.toString(2).split('').map(Number); }
function bitsToDec(bits){ return parseInt(bits.join('')||'0',2); }
function padBits(bits,len){ const a=bits.slice(); while(a.length<len) a.unshift(0); return a; }
function collectNumLeaves(ast){ const leaves=[]; (function walk(n){ if(n.type==='NUM'){leaves.push(n);return;} (n.children||[]).forEach(walk); })(ast); return leaves; }

function evalBitwiseWithTrace(ast, mode){
  const leaves=collectNumLeaves(ast);
  const bitArrays=leaves.map(l=> mode==='decimal' ? decToBits(l.value) : l.value.split('').map(Number));
  const width=Math.max(...bitArrays.map(a=>a.length),1);
  const cache=new Map();
  leaves.forEach((l,idx)=>cache.set(l, padBits(bitArrays[idx], width)));
  const trace=[];
  function ev(node){
    if(node.type==='NUM') return cache.get(node);
    if(node.type==='NOT'){ const a=ev(node.children[0]); const out=a.map(b=>b?0:1); trace.push({type:'NOT',a,out}); return out; }
    const a=ev(node.children[0]), b=ev(node.children[1]); const out=[];
    for(let i=0;i<width;i++){
      let bit;
      switch(node.type){
        case 'AND': bit=(a[i]&b[i]); break;
        case 'OR': bit=(a[i]|b[i]); break;
        case 'XOR': bit=(a[i]^b[i]); break;
        case 'NAND': bit=(a[i]&b[i])?0:1; break;
        case 'NOR': bit=(a[i]|b[i])?0:1; break;
        case 'XNOR': bit=(a[i]^b[i])?0:1; break;
      }
      out.push(bit);
    }
    trace.push({type:node.type,a,b,out});
    return out;
  }
  const result=ev(ast);
  return {bits:result, decimal:bitsToDec(result), trace, width, leavesBits:leaves.map((l,idx)=>padBits(bitArrays[idx],width))};
}
