function currentVars(){ return VARSETS[state.varset]; }
function opDisplay(kind){
  if(state.notation==='symbol'){
    if(kind==='AND') return '*';
    if(kind==='OR') return '+';
    if(kind==='NOT') return '!';
  }
  return kind;
}
function formatBooleanNotation(text){
  if(state.notation==='symbol'){
    return text
      .replace(/\bAND\b/g,'*')
      .replace(/\bOR\b/g,'+')
      .replace(/\bNOT\s+(?=[A-Za-z0-9_(])/g,'!')
      .replace(/\bNOT\b/g,'!')
      .replace(/&/g,'*')
      .replace(/\|/g,'+');
  }
  return text
    .replace(/\s*[*&]\s*/g,' AND ')
    .replace(/\s*[+|]\s*/g,' OR ')
    .replace(/!([A-Za-z0-9_]+)/g,'NOT $1')
    .replace(/!\s*(?=\()/g,'NOT ')
    .replace(/\s+/g,' ')
    .trim();
}
function formatAstDisplay(node,parentPrecedence=0){
  const precedence={OR:1,NOR:1,XOR:2,XNOR:2,AND:3,NAND:3,NOT:4,VAR:5,NUM:5};
  let text;
  if(node.type==='VAR') text=node.name;
  else if(node.type==='NUM') text=node.value;
  else if(node.type==='NOT'){
    const child=node.children[0];
    const childText=formatAstDisplay(child,precedence.NOT);
    text=state.notation==='symbol'?`!${childText}`:`NOT ${childText}`;
  }else{
    const operator=opDisplay(node.type);
    text=`${formatAstDisplay(node.children[0],precedence[node.type])} ${operator} ${formatAstDisplay(node.children[1],precedence[node.type])}`;
  }
  return precedence[node.type]<parentPrecedence?`(${text})`:text;
}
function buildParseString(){
  return state.tokens.map(t=>{
    if(t.kind==='VAR'||t.kind==='NUM') return t.value;
    if(t.kind==='LPAREN') return '(';
    if(t.kind==='RPAREN') return ')';
    return t.kind;
  }).join(' ');
}
function expressionTokenSeparator(previous,current){
  if(!previous) return '';
  if(current.kind==='RPAREN'||previous.kind==='LPAREN') return '';
  if(state.notation==='symbol'&&previous.kind==='NOT') return '';
  return ' ';
}
function expressionTokenText(token){
  if(token.kind==='VAR'||token.kind==='NUM') return token.value;
  if(token.kind==='LPAREN') return '(';
  if(token.kind==='RPAREN') return ')';
  return opDisplay(token.kind);
}
function buildExpressionTextFromTokens(tokens){
  return tokens.reduce((text,token,index)=>
    text+expressionTokenSeparator(tokens[index-1],token)+expressionTokenText(token),''
  );
}
function buildExpressionText(){ return buildExpressionTextFromTokens(state.tokens); }
function buildDisplayHTML(){
  if(state.tokens.length===0) return null;
  return state.tokens.reduce((html,token,index)=>{
    const separator=expressionTokenSeparator(state.tokens[index-1],token);
    if(token.kind==='VAR'||token.kind==='NUM') return html+separator+esc(token.value);
    if(token.kind==='LPAREN') return html+separator+'(';
    if(token.kind==='RPAREN') return html+separator+')';
    return html+separator+`<b>${esc(opDisplay(token.kind))}</b>`;
  },'');
}
function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function leafTypeForMode(){ return state.mode==='boolean' ? 'VAR' : 'NUM'; }

function tryParseCurrent(){
  state.error=null;
  if(state.tokens.length===0) return null;
  try{
    const str=buildParseString();
    const toks=tokenize(str, leafTypeForMode());
    const ast=parse(toks);
    return ast;
  }catch(e){ state.error=e.message; return null; }
}
