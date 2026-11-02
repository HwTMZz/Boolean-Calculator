// ================================================================
// CORE ENGINE — Tokenizer -> Parser -> AST -> Evaluator
// Single source of truth used by Boolean / Binary / Decimal modes.
// ================================================================
const KEYWORDS = { AND:'AND', OR:'OR', NOT:'NOT', NAND:'NAND', NOR:'NOR', XOR:'XOR', XNOR:'XNOR' };
const SYMBOL_MAP = { '&':'AND', '|':'OR', '!':'NOT', '~':'NOT', '^':'XOR' };

function tokenize(input, leafType){
  const tokens=[]; let i=0; const n=input.length;
  const compactVars=['W','X','Y','Z','A','B','C','D','P','Q','R','S','X1','X2','X3','X4'];
  function compactVariableTokens(word,pos){
    const upper=word.toUpperCase();
    if(leafType!=='VAR') return null;
    if(!upper || !/[A-Z]/.test(upper)) return null;
    // Only split when the whole word can be losslessly segmented into known
    // Boolean variable names. This keeps X1, X2... intact.
    const memo=new Map();
    function segment(s){
      if(s.length===0) return [];
      if(memo.has(s)) return memo.get(s);
      for(const v of compactVars.sort((a,b)=>b.length-a.length)){
        if(s.startsWith(v)){
          const rest=segment(s.slice(v.length));
          if(rest!==null){
            const out=[v,...rest];
            memo.set(s,out);
            return out;
          }
        }
      }
      memo.set(s,null);
      return null;
    }
    const parts=segment(upper);
    return parts && parts.length>1 ? parts.map((v,idx)=>({type:'VAR',value:v,pos:pos+idx})) : null;
  }
  while(i<n){
    const c=input[i];
    if(/\s/.test(c)){i++;continue;}
    if(c==='('){tokens.push({type:'LPAREN',value:'(',pos:i});i++;continue;}
    if(c===')'){tokens.push({type:'RPAREN',value:')',pos:i});i++;continue;}
    if(SYMBOL_MAP[c]){tokens.push({type:'OP',value:SYMBOL_MAP[c],pos:i});i++;continue;}
    if(/[A-Za-z]/.test(c)){
      let j=i; while(j<n && /[A-Za-z0-9]/.test(input[j])) j++;
      const word=input.slice(i,j); const upper=word.toUpperCase();
      if(KEYWORDS[upper]){
        tokens.push({type:'OP',value:KEYWORDS[upper],pos:i});
      } else if(leafType==='VAR'){
        const compact=compactVariableTokens(word,i);
        if(compact){
          compact.forEach((tok,idx)=>{
            if(idx>0) tokens.push({type:'OP',value:'AND',pos:tok.pos});
            tokens.push(tok);
          });
        } else tokens.push({type:'VAR',value:upper,pos:i});
      } else {
        throw new SyntaxError(`Unexpected letters "${word}"`);
      }
      i=j; continue;
    }
    if(/[0-9]/.test(c)){
      let j=i; while(j<n && /[0-9]/.test(input[j])) j++;
      const digits=input.slice(i,j);
      if(leafType==='NUM'){ tokens.push({type:'NUM',value:digits,pos:i}); }
      else { throw new SyntaxError(`Unexpected number "${digits}"`); }
      i=j; continue;
    }
    throw new SyntaxError(`Unexpected character "${c}"`);
  }
  if(leafType!=='VAR') return tokens;
  const withImplicitAnd=[];
  const expressionEnd=new Set(['VAR','RPAREN']);
  const expressionStart=new Set(['VAR','LPAREN']);
  tokens.forEach(token=>{
    const previous=withImplicitAnd[withImplicitAnd.length-1];
    // Completed expressions followed by another operand imply AND.
    const beginsNegatedExpression=token.type==='OP' && token.value==='NOT';
    if(previous && expressionEnd.has(previous.type) && (expressionStart.has(token.type)||beginsNegatedExpression)){
      withImplicitAnd.push({type:'OP',value:'AND',pos:token.pos});
    }
    withImplicitAnd.push(token);
  });
  return withImplicitAnd;
}

function parse(tokens){
  let pos=0;
  const peek=()=>tokens[pos];
  const advance=()=>tokens[pos++];
  function expect(type){
    const t=peek();
    if(!t||t.type!==type){
      const friendly = type==='RPAREN' ? 'a closing parenthesis ")"' : type;
      throw new SyntaxError(t ? `Unexpected "${t.value}" — expected ${friendly}` : `Incomplete expression — expected ${friendly}`);
    }
    return advance();
  }
  function parseOr(){
    let node=parseXor();
    while(peek() && peek().type==='OP' && (peek().value==='OR'||peek().value==='NOR')){
      const op=advance(); const right=parseXor(); node={type:op.value,children:[node,right],pos:op.pos};
    }
    return node;
  }
  function parseXor(){
    let node=parseAnd();
    while(peek() && peek().type==='OP' && (peek().value==='XOR'||peek().value==='XNOR')){
      const op=advance(); const right=parseAnd(); node={type:op.value,children:[node,right],pos:op.pos};
    }
    return node;
  }
  function parseAnd(){
    let node=parseNot();
    while(peek() && peek().type==='OP' && (peek().value==='AND'||peek().value==='NAND')){
      const op=advance(); const right=parseNot(); node={type:op.value,children:[node,right],pos:op.pos};
    }
    return node;
  }
  function parseNot(){
    if(peek() && peek().type==='OP' && peek().value==='NOT'){
      const op=advance(); const child=parseNot(); return {type:'NOT',children:[child],pos:op.pos};
    }
    return parsePrimary();
  }
  function parsePrimary(){
    const t=peek();
    if(!t) throw new SyntaxError('Incomplete expression');
    if(t.type==='LPAREN'){ advance(); const node=parseOr(); expect('RPAREN'); return node; }
    if(t.type==='VAR'){ advance(); return {type:'VAR',name:t.value,pos:t.pos}; }
    if(t.type==='NUM'){ advance(); return {type:'NUM',value:t.value,pos:t.pos}; }
    throw new SyntaxError(`Unexpected token "${t.value}"`);
  }
  if(tokens.length===0) throw new SyntaxError('Empty expression');
  const ast=parseOr();
  if(pos<tokens.length) throw new SyntaxError(`Unexpected token "${tokens[pos].value}"`);
  return ast;
}

function extractVars(ast, order){
  const found=new Set();
  (function walk(node){ if(!node) return; if(node.type==='VAR'){found.add(node.name);return;} (node.children||[]).forEach(walk); })(ast);
  const preferred=order.filter(v=>found.has(v));
  const rest=[...found].filter(v=>!preferred.includes(v)).sort();
  return [...preferred, ...rest];
}

function serializeCanonical(node, parentPrec){
  const PREC={OR:1,NOR:1,XOR:2,XNOR:2,AND:3,NAND:3,NOT:4,VAR:5,NUM:5};
  const wrap=(s,p)=> (parentPrec!==undefined && p<parentPrec) ? `(${s})` : s;
  switch(node.type){
    case 'VAR': return node.name;
    case 'NUM': return node.value;
    case 'NOT': return `!${serializeCanonical(node.children[0],PREC.NOT)}`;
    case 'AND': return wrap(`${serializeCanonical(node.children[0],PREC.AND)} & ${serializeCanonical(node.children[1],PREC.AND)}`,PREC.AND);
    case 'OR': return wrap(`${serializeCanonical(node.children[0],PREC.OR)} | ${serializeCanonical(node.children[1],PREC.OR)}`,PREC.OR);
    case 'XOR': return wrap(`${serializeCanonical(node.children[0],PREC.XOR)} ^ ${serializeCanonical(node.children[1],PREC.XOR)}`,PREC.XOR);
    case 'NAND': return `!(${serializeCanonical(node.children[0])} & ${serializeCanonical(node.children[1])})`;
    case 'NOR': return `!(${serializeCanonical(node.children[0])} | ${serializeCanonical(node.children[1])})`;
    case 'XNOR': return `!(${serializeCanonical(node.children[0])} ^ ${serializeCanonical(node.children[1])})`;
  }
}

function annotateAST(ast){
  let nextId=0;
  const nodes=[];
  function walk(node,parent=null){
    node.id=`n${nextId++}`;
    node.parentId=parent ? parent.id : null;
    nodes.push(node);
    (node.children||[]).forEach(child=>walk(child,node));
  }
  walk(ast);
  return nodes;
}

function nodeLabel(node){
  if(!node) return '';
  if(node.type==='VAR') return node.name;
  if(node.type==='NUM') return node.value;
  if(node.type==='NOT') return `NOT ${nodeLabel(node.children[0])}`;
  const op=node.type;
  return `${nodeLabel(node.children[0])} ${op} ${nodeLabel(node.children[1])}`;
}

function astDependencies(node){
  const vars=new Set();
  (function walk(n){
    if(n.type==='VAR'){ vars.add(n.name); return; }
    (n.children||[]).forEach(walk);
  })(node);
  return [...vars];
}
