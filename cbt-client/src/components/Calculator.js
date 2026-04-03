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
      width: 220px;
      padding: 1rem;
      z-index: 1000;
      display: none;
      background: #333;
      border: 1px solid var(--glass-border);
      pointer-events: all;
    `
    calc.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.75rem;">
        <span style="color: var(--text-primary);">Calculator</span>
        <button id="close-calc" style="padding: 2px 5px; background: none; color: var(--error); border: none; cursor: pointer;">X</button>
      </div>
      <input type="text" id="calc-display" readonly style="width: 100%; padding: 0.5rem; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); color: var(--text-primary); text-align: right; margin-bottom: 0.5rem; font-family: monospace; font-size: 1rem;">
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;">
        ${['7','8','9','/','4','5','6','*','1','2','3','-','0','.','=','+','C'].map(btn => `
          <button class="calc-btn" data-val="${btn}" style="padding: 0.75rem; font-size: 0.875rem; background: rgba(0,0,0,0.1); border: 1px solid var(--glass-border); color: var(--text-primary); cursor: pointer;">${btn}</button>
        `).join('')}
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
