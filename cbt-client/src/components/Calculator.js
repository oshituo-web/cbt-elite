export const CalculatorComponent = {
  render(parent) {
    // Check if it already exists to avoid duplicates
    if (document.getElementById('on-screen-calc')) {
      document.getElementById('on-screen-calc').remove()
    }

    const calc = document.createElement('div')
    calc.id = 'on-screen-calc'
    calc.className = 'glass'
    calc.style.cssText = `
      position: fixed;
      right: 20px;
      bottom: 80px;
      width: 260px;
      padding: 0;
      z-index: 10000;
      display: none;
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid var(--primary);
      box-shadow: 0 0 20px rgba(37, 99, 235, 0.2), var(--shadow-lg);
      overflow: hidden;
      border-radius: 16px;
      pointer-events: all;
      user-select: none;
      font-family: 'Outfit', sans-serif;
    `
    calc.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(37, 99, 235, 0.1); border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span style="font-weight: 900; font-size: 0.85rem; color: #60A5FA; letter-spacing: 1.5px; text-shadow: 0 0 8px rgba(96, 165, 250, 0.5);">CBT ELITE CALCULATOR</span>
        <button id="close-calc" style="background: rgba(239, 68, 68, 0.1); color: #F87171; border: none; cursor: pointer; border-radius: 6px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: 900; transition: all 0.2s;">&times;</button>
      </div>
      <div style="padding: 16px;">
        <input type="text" id="calc-display" readonly placeholder="0" style="width: 100%; padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; color: #FFFFFF; text-align: right; margin-bottom: 16px; font-family: 'JetBrains Mono', monospace; font-size: 1.5rem; font-weight: 700; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); outline: none;">
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
          ${['C', '/', '*', '-'].map(op => `
            <button class="calc-btn" data-val="${op}" style="padding: 12px 0; font-size: 1rem; font-weight: 800; background: ${op === 'C' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(37, 99, 235, 0.15)'}; border: 1px solid ${op === 'C' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(37, 99, 235, 0.2)'}; color: ${op === 'C' ? '#F87171' : '#60A5FA'}; cursor: pointer; border-radius: 8px; transition: all 0.2s;">${op}</button>
          `).join('')}
          ${['7', '8', '9', '+', '4', '5', '6', '.', '1', '2', '3', '=', '0'].map(btn => {
            const isOperator = ['+', '='].includes(btn);
            const isZero = btn === '0';
            return `
              <button class="calc-btn" data-val="${btn}" style="padding: 12px 0; font-size: 1rem; font-weight: 700; background: ${isOperator ? 'var(--primary)' : 'rgba(255,255,255,0.03)'}; border: 1px solid ${isOperator ? 'transparent' : 'rgba(255,255,255,0.08)'}; color: #FFFFFF; cursor: pointer; border-radius: 8px; transition: all 0.15s; ${isZero ? 'grid-column: span 3;' : ''}" onmouseover="this.style.background='${isOperator ? '#1D4ED8' : 'rgba(255,255,255,0.08)'}'" onmouseout="this.style.background='${isOperator ? 'var(--primary)' : 'rgba(255,255,255,0.03)'}'">${btn}</button>
            `;
          }).join('')}
        </div>
      </div>
    `
    parent.appendChild(calc)

    let currentInput = ''
    const display = calc.querySelector('#calc-display')
    
    // Use event delegation on the calc container
    calc.onclick = (e) => {
      if (e.target.classList.contains('calc-btn')) {
        const val = e.target.dataset.val
        if (val === 'C') {
          currentInput = ''
        } else if (val === '=') {
          try {
            // Simple arithmetic evaluation
            currentInput = Function('"use strict";return (' + currentInput + ')')().toString()
          } catch {
            currentInput = 'Error'
          }
        } else {
          // Prevent double operators
          const lastChar = currentInput.slice(-1)
          if (['+', '-', '*', '/'].includes(val) && ['+', '-', '*', '/'].includes(lastChar)) {
            currentInput = currentInput.slice(0, -1) + val
          } else {
            currentInput += val
          }
        }
        display.value = currentInput
      }

      if (e.target.id === 'close-calc') {
        calc.style.display = 'none'
      }
    }
  },

  toggle() {
    const calc = document.getElementById('on-screen-calc')
    if (calc) {
      calc.style.display = calc.style.display === 'none' ? 'block' : 'none'
    }
  }
}
