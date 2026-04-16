export const CalculatorComponent = {
  render(parent = document.body) {
    if (document.getElementById('on-screen-calc')) {
      document.getElementById('on-screen-calc').remove()
    }

    const calc = document.createElement('div')
    calc.id = 'on-screen-calc'
    calc.className = 'glass scale-in'
    calc.style.cssText = `
      position: fixed;
      right: 20px;
      top: 100px;
      width: 320px;
      padding: 0;
      z-index: 99999;
      display: none;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
      border-radius: 16px;
      pointer-events: auto;
      user-select: none;
      font-family: 'Outfit', sans-serif;
    `
    // Layout
    calc.innerHTML = `
      <div id="calc-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(0,0,0,0.3); border-bottom: 1px solid rgba(255,255,255,0.05); cursor: grab;">
        <span style="font-weight: 900; font-size: 0.75rem; color: #ffffff; letter-spacing: 0.1em; display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="calculator" style="width:14px;"></i> ELITE CALCULATOR</span>
        <button id="close-calc" style="background: rgba(239, 68, 68, 0.1); color: #F87171; border: none; cursor: pointer; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: 900; transition: all 0.2s;">&times;</button>
      </div>
      <div style="padding: 16px;">
        <div style="width: 100%; min-height: 80px; padding: 12px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; margin-bottom: 16px; box-shadow: inset 0 2px 10px rgba(0,0,0,0.3); display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; align-items: flex-end;">
            <div id="calc-display" style="font-size: 1.5rem; color: #FFFFFF; font-weight: 700; font-family: 'JetBrains Mono', monospace; word-break: break-all; text-align: right; width: 100%;">0</div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;">
          <!-- Row 1: Scientific -->
          <button class="calc-btn fn" data-val="sin(">sin</button>
          <button class="calc-btn fn" data-val="cos(">cos</button>
          <button class="calc-btn fn" data-val="tan(">tan</button>
          <button class="calc-btn fn" data-val="log(">log</button>
          <button class="calc-btn fn" data-val="sqrt(">√</button>

          <!-- Row 2 -->
          <button class="calc-btn clear" data-val="C" style="color:#F87171; background:rgba(239,68,68,0.15); font-size: 0.9rem;">CLR</button>
          <button class="calc-btn clear" data-val="DEL" style="color:#FCA5A5; background:rgba(239,68,68,0.05);"><i data-lucide="delete" style="width:16px;"></i></button>
          <button class="calc-btn op" data-val="(">(</button>
          <button class="calc-btn op" data-val=")">)</button>
          <button class="calc-btn op" data-val="^">^</button>

          <!-- Row 3 -->
          <button class="calc-btn num" data-val="7">7</button>
          <button class="calc-btn num" data-val="8">8</button>
          <button class="calc-btn num" data-val="9">9</button>
          <button class="calc-btn op" data-val="/">÷</button>
          <button class="calc-btn op" data-val="*">×</button>

          <!-- Row 4 -->
          <button class="calc-btn num" data-val="4">4</button>
          <button class="calc-btn num" data-val="5">5</button>
          <button class="calc-btn num" data-val="6">6</button>
          <button class="calc-btn op" data-val="-">-</button>
          <button class="calc-btn" data-val="ans" style="font-size: 0.75rem;">ANS</button>

          <!-- Row 5 -->
          <button class="calc-btn num" data-val="1">1</button>
          <button class="calc-btn num" data-val="2">2</button>
          <button class="calc-btn num" data-val="3">3</button>
          <button class="calc-btn op" data-val="+">+</button>
          <button class="calc-btn equal" data-val="=" style="grid-row: span 2; background: var(--accent-primary); color: white; border: none; align-self: stretch;">=</button>

          <!-- Row 6 -->
          <button class="calc-btn num" data-val="0" style="grid-column: span 2;">0</button>
          <button class="calc-btn op" data-val=".">.</button>
          <button class="calc-btn op" data-val="EXP">E</button>
        </div>
      </div>
    `
    // Add dynamic CSS for buttons
    const style = document.createElement('style')
    style.textContent = `
      .calc-btn {
         padding: 0;
         height: 44px;
         font-size: 1.1rem;
         font-weight: 700;
         border-radius: 8px;
         border: 1px solid rgba(255,255,255,0.08);
         background: rgba(255,255,255,0.03);
         color: #fff;
         cursor: pointer;
         transition: transform 0.1s, background 0.2s;
         display: flex;
         align-items: center;
         justify-content: center;
      }
      .calc-btn:hover { background: rgba(255,255,255,0.1); }
      .calc-btn:active { transform: scale(0.95); }
      .calc-btn.fn { font-size: 0.8rem; background: rgba(37, 99, 235, 0.1); border-color: rgba(37, 99, 235, 0.2); color: #60A5FA; }
      .calc-btn.op { background: rgba(147, 51, 234, 0.15); color: #C084FC; border-color: rgba(147, 51, 234, 0.2); }
      .calc-btn.equal:hover { background: #1D4ED8; opacity: 0.9; }
    `
    calc.appendChild(style)
    parent.appendChild(calc)
    
    if (window.lucide) window.lucide.createIcons({ root: calc });

    // DRAGGABLE LOGIC
    let isDragging = false, dragX, dragY;
    const header = calc.querySelector('#calc-header');
    
    header.addEventListener('mousedown', e => {
       isDragging = true;
       dragX = e.clientX - calc.offsetLeft;
       dragY = e.clientY - calc.offsetTop;
       header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', e => {
       if (isDragging) {
         let newL = e.clientX - dragX;
         let newT = e.clientY - dragY;
         // Boundaries
         newL = Math.max(0, Math.min(newL, window.innerWidth - calc.offsetWidth));
         newT = Math.max(0, Math.min(newT, window.innerHeight - calc.offsetHeight));
         calc.style.left = newL + 'px';
         calc.style.top = newT + 'px';
         // Explicitly unset auto positioning
         calc.style.right = 'auto'; 
         calc.style.bottom = 'auto';
       }
    });

    document.addEventListener('mouseup', () => {
       if (isDragging) {
         isDragging = false;
         header.style.cursor = 'grab';
       }
    });

    // MATH EVALUATION STATE
    let expStr = '';
    let lastAns = '0';
    const dispNode = calc.querySelector('#calc-display');

    const updateUI = () => {
       dispNode.textContent = expStr === '' ? '0' : expStr;
    };

    const parseMath = (str) => {
        let parsed = str.replace(/ans/g, lastAns)
                        .replace(/EXP/g, 'e')
                        .replace(/sin\(/g, 'sinDeg(')
                        .replace(/cos\(/g, 'cosDeg(')
                        .replace(/tan\(/g, 'tanDeg(')
                        .replace(/log\(/g, 'Math.log10(')
                        .replace(/sqrt\(/g, 'Math.sqrt(')
                        .replace(/π/g, 'Math.PI')
                        .replace(/\^/g, '**');

        try {
           const sinDeg = (deg) => Math.sin(deg * Math.PI / 180);
           const cosDeg = (deg) => Math.cos(deg * Math.PI / 180);
           const tanDeg = (deg) => Math.tan(deg * Math.PI / 180);
           
           const evalFunc = new Function('sinDeg', 'cosDeg', 'tanDeg', 'Math', '"use strict"; return (' + parsed + ')');
           const res = evalFunc(sinDeg, cosDeg, tanDeg, Math);
           return (Number.isFinite(res)) ? Number(res.toPrecision(10)).toString() : 'Error';
        } catch {
           return 'Error';
        }
    };

    calc.onclick = (e) => {
      const btn = e.target.closest('.calc-btn');
      if (btn) {
        const val = btn.dataset.val;

        if (val === 'C') {
           expStr = '';
        } else if (val === 'DEL') {
           if (expStr !== 'Error' && expStr.length > 0) {
              expStr = expStr.slice(0, -1);
           }
        } else if (val === '=') {
           if (expStr !== '' && expStr !== 'Error') {
               const res = parseMath(expStr);
               if(res !== 'Error') lastAns = res;
               expStr = res;
           }
        } else {
           if (expStr === 'Error') expStr = '';
           expStr += val;
        }

        updateUI();
      }

      if (e.target.closest('#close-calc')) {
        calc.style.display = 'none';
      }
    };
  },

  toggle() {
    let calc = document.getElementById('on-screen-calc')
    if (!calc) {
       this.render(document.body);
       calc = document.getElementById('on-screen-calc');
    }
    calc.style.display = calc.style.display === 'none' ? 'block' : 'none';
  }
}
