function renderKeyboard(){
  if(state.mode==='boolean') return renderBooleanKeyboard();
  if(state.mode==='binary') return renderBinaryKeyboard();
  return renderDecimalKeyboard();
}

function opButton(kind){
  return `<div class="kb-btn op" onclick="addToken('${kind}')">${esc(opDisplay(kind))}</div>`;
}
function parenthesisButtons(){
  return `<div class="kb-paren-pair">
    <div class="kb-paren-btn" onclick="addToken('LPAREN')">(</div>
    <div class="kb-paren-btn" onclick="addToken('RPAREN')">)</div>
  </div>`;
}
function renderOperatorRows(){
  let rows='';
  if(state.advanced){
    rows += `<div class="kb-grid">${['NAND','NOR','XOR','XNOR'].map(opButton).join('')}</div>`;
  }
  rows += `<div class="kb-grid">${opButton('AND')}${opButton('OR')}${opButton('NOT')}${parenthesisButtons()}</div>`;
  return rows;
}

function renderBooleanKeyboard(){
  const vars=currentVars();
  const variableRow=state.advanced
    ? ''
    : `<div class="kb-grid">${vars.map(v=>`<div class="kb-btn" onclick="addToken('VAR','${v}')">${esc(v)}</div>`).join('')}</div>`;
  return `${variableRow}${renderOperatorRows()}`;
}

function renderBinaryKeyboard(){
  return `<div class="kb-grid">
    <div class="kb-btn wide" onclick="addToken('NUM','0')">0</div>
    <div class="kb-btn wide" onclick="addToken('NUM','1')">1</div>
  </div>
  ${renderOperatorRows()}`;
}

function renderDecimalKeyboard(){
  return `<div class="kb-grid">
    <div class="kb-btn" onclick="addToken('NUM','7')">7</div>
    <div class="kb-btn" onclick="addToken('NUM','8')">8</div>
    <div class="kb-btn" onclick="addToken('NUM','9')">9</div>
    ${opButton('AND')}
    <div class="kb-btn" onclick="addToken('NUM','4')">4</div>
    <div class="kb-btn" onclick="addToken('NUM','5')">5</div>
    <div class="kb-btn" onclick="addToken('NUM','6')">6</div>
    ${opButton('OR')}
    <div class="kb-btn" onclick="addToken('NUM','1')">1</div>
    <div class="kb-btn" onclick="addToken('NUM','2')">2</div>
    <div class="kb-btn" onclick="addToken('NUM','3')">3</div>
    ${opButton('NOT')}
    <div class="kb-btn" onclick="addToken('NUM','00')">00</div>
    <div class="kb-btn wide" onclick="addToken('NUM','0')">0</div>
    ${parenthesisButtons()}
  </div>
  ${state.advanced ? `<div class="kb-grid">${['NAND','NOR','XOR','XNOR'].map(opButton).join('')}</div>` : ''}`;
}
