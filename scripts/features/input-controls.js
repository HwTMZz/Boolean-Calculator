function expressionTokenIndexAtOffset(offset){
  let textOffset=0;
  let bestIndex=0;
  let bestDistance=Math.abs(offset);
  for(let index=0;index<state.tokens.length;index++){
    const separator=expressionTokenSeparator(state.tokens[index-1],state.tokens[index]);
    textOffset+=separator.length;
    const startDistance=Math.abs(offset-textOffset);
    if(startDistance<bestDistance){
      bestDistance=startDistance;
      bestIndex=index;
    }
    const tokenLength=expressionTokenText(state.tokens[index]).length;
    const afterToken=textOffset+tokenLength;
    const afterDistance=Math.abs(offset-afterToken);
    if(afterDistance<bestDistance){
      bestDistance=afterDistance;
      bestIndex=index+1;
    }
    textOffset=afterToken;
  }
  return bestIndex;
}

function captureExpressionCursor(){
  const input=document.getElementById('expression-input');
  if(!input) return;
  if(document.activeElement!==input && state.expressionCursorIndex!==null) return;
  const start=expressionTokenIndexAtOffset(input.selectionStart);
  const end=expressionTokenIndexAtOffset(input.selectionEnd);
  state.expressionSelection={start:Math.min(start,end),end:Math.max(start,end)};
  state.expressionCursorIndex=state.expressionSelection.start;
  updateExpressionCaret();
}

function expressionOffsetForTokenIndex(index){
  return buildExpressionTextFromTokens(state.tokens.slice(0,index)).length;
}

function restoreExpressionInput(){
  const input=document.getElementById('expression-input');
  if(!input) return;
  input.style.height='auto';
  input.style.height=`${Math.max(34,input.scrollHeight)}px`;
  const startToken=state.expressionSelection
    ? state.expressionSelection.start
    : state.expressionCursorIndex===null?state.tokens.length:state.expressionCursorIndex;
  const endToken=state.expressionSelection
    ? state.expressionSelection.end
    : startToken;
  const startOffset=expressionOffsetForTokenIndex(startToken);
  const endOffset=expressionOffsetForTokenIndex(endToken);
  input.focus({preventScroll:true});
  input.setSelectionRange(startOffset,endOffset);
  updateExpressionCaret();
}

function updateExpressionCaret(){
  const input=document.getElementById('expression-input');
  const caret=document.getElementById('expression-caret');
  if(!input||!caret) return;

  const tokenIndex=state.expressionSelection
    ? state.expressionSelection.start
    : state.expressionCursorIndex===null?state.tokens.length:state.expressionCursorIndex;
  const offset=Math.min(expressionOffsetForTokenIndex(tokenIndex),input.value.length);
  const inputRect=input.getBoundingClientRect();
  const wrapRect=input.parentElement.getBoundingClientRect();
  const computed=getComputedStyle(input);
  const mirror=document.createElement('div');
  mirror.setAttribute('aria-hidden','true');
  Object.assign(mirror.style,{
    position:'fixed',
    left:`${inputRect.left}px`,
    top:`${inputRect.top}px`,
    width:`${inputRect.width}px`,
    height:`${inputRect.height}px`,
    boxSizing:computed.boxSizing,
    border:computed.border,
    padding:computed.padding,
    font:computed.font,
    lineHeight:computed.lineHeight,
    letterSpacing:computed.letterSpacing,
    textAlign:computed.textAlign,
    textIndent:computed.textIndent,
    textTransform:computed.textTransform,
    whiteSpace:computed.whiteSpace,
    overflowWrap:computed.overflowWrap,
    wordBreak:computed.wordBreak,
    tabSize:computed.tabSize,
    visibility:'hidden',
    overflow:'hidden',
    pointerEvents:'none'
  });
  const textNode=document.createTextNode(input.value);
  mirror.appendChild(textNode);
  document.body.appendChild(mirror);

  const range=document.createRange();
  range.setStart(textNode,offset);
  range.collapse(true);
  let caretRect=range.getBoundingClientRect();
  if(caretRect.height===0 && offset>0){
    range.setStart(textNode,offset-1);
    range.setEnd(textNode,offset);
    caretRect=range.getBoundingClientRect();
    caret.style.left=`${caretRect.right-wrapRect.left}px`;
    caret.style.top=`${caretRect.top-wrapRect.top}px`;
  }else if(caretRect.height>0){
    caret.style.left=`${caretRect.left-wrapRect.left}px`;
    caret.style.top=`${caretRect.top-wrapRect.top}px`;
  }else{
    caret.style.left=`${inputRect.left+parseFloat(computed.paddingLeft)-wrapRect.left}px`;
    caret.style.top=`${inputRect.top+parseFloat(computed.paddingTop)-wrapRect.top}px`;
  }
  caret.style.height=`${parseFloat(computed.lineHeight)||parseFloat(computed.fontSize)*1.35}px`;
  caret.style.display='block';
  mirror.remove();
}

function addToken(kind, value){
  state.overlay=null;
  const selection=state.expressionSelection || {
    start:state.expressionCursorIndex===null?state.tokens.length:state.expressionCursorIndex,
    end:state.expressionCursorIndex===null?state.tokens.length:state.expressionCursorIndex
  };
  const insertAt=selection.start;
  if(selection.end>selection.start) state.tokens.splice(selection.start,selection.end-selection.start);
  if(kind==='PAREN'){
    const open=state.tokens.filter(t=>t.kind==='LPAREN').length;
    const close=state.tokens.filter(t=>t.kind==='RPAREN').length;
    state.tokens.splice(insertAt,0,{kind: open>close ? 'RPAREN' : 'LPAREN'});
  } else if(kind==='LPAREN'||kind==='RPAREN'){
    state.tokens.splice(insertAt,0,{kind});
  } else if(kind==='VAR'){
    state.tokens.splice(insertAt,0,{kind:'VAR', value});
  } else if(kind==='NUM'){
    const last=state.tokens[insertAt-1];
    if(last && last.kind==='NUM' && selection.end===selection.start){
      last.value += value;
      state.expressionCursorIndex=insertAt;
    }else{
      state.tokens.splice(insertAt,0,{kind:'NUM', value});
      state.expressionCursorIndex=insertAt+1;
    }
  } else {
    state.tokens.splice(insertAt,0,{kind});
    state.expressionCursorIndex=insertAt+1;
  }
  if(kind==='PAREN'||kind==='LPAREN'||kind==='RPAREN'||kind==='VAR') state.expressionCursorIndex=insertAt+1;
  state.expressionSelection=null;
  render();
}
function deleteToken(){
  state.overlay=null;
  const selection=state.expressionSelection || {
    start:state.expressionCursorIndex===null?state.tokens.length:state.expressionCursorIndex,
    end:state.expressionCursorIndex===null?state.tokens.length:state.expressionCursorIndex
  };
  if(selection.end>selection.start){
    state.tokens.splice(selection.start,selection.end-selection.start);
    state.expressionCursorIndex=selection.start;
  }else if(selection.start>0){
    state.tokens.splice(selection.start-1,1);
    state.expressionCursorIndex=selection.start-1;
  }
  state.expressionSelection=null;
  render();
}
function clearExpr(){
  state.overlay=null;
  state.tokens=[]; state.error=null;
  state.expressionCursorIndex=0; state.expressionSelection=null;
  render();
}
function cycleVarset(){
  const idx=VARSET_KEYS.indexOf(state.varset);
  const nextVarset=VARSET_KEYS[(idx+1)%VARSET_KEYS.length];
  const previousVars=VARSETS[state.varset];
  const nextVars=VARSETS[nextVarset];
  state.tokens.forEach(token=>{
    if(token.kind!=='VAR') return;
    const variableIndex=previousVars.indexOf(token.value);
    if(variableIndex>=0) token.value=nextVars[variableIndex];
  });
  previousVars.forEach((variable,index)=>{
    state.assignments[nextVars[index]]=state.assignments[variable]||'*';
  });
  state.varset=nextVarset;
  render();
}
function toggleNotation(){ state.notation = state.notation==='word' ? 'symbol' : 'word'; render(); }
function toggleAdvanced(){ state.advanced=!state.advanced; render(); }
function switchMode(m){
  if(state.mode===m) return;
  state.mode=m; state.tokens=[]; state.error=null; state.overlay=null;
  state.expressionCursorIndex=null; state.expressionSelection=null;
  render();
}
function cycleAssignment(v){
  const cur=state.assignments[v] || '*';
  state.assignments[v] = cur==='*' ? '0' : cur==='0' ? '1' : '*';
  render();
}
function resetAssignments(){
  currentVars().forEach(v=> state.assignments[v]='*');
  render();
}
function cameraTap(){
  alert('Camera / OCR expression input is a planned feature — not available yet.');
}
