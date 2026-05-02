export const TourGuide = {
  steps: [],
  currentStep: 0,
  overlay: null,
  spotlight: null,
  bubble: null,
  onFinish: null,

  init(steps, options = {}) {
    this.steps = steps;
    this.onFinish = options.onFinish;
    this.currentStep = 0;
    this.createUI();
  },

  createUI() {
    // Remove any stale overlay from a previous session
    const stale = document.querySelector('.tour-overlay');
    if (stale) stale.remove();
    this.overlay = null;

    this.overlay = document.createElement('div');
    this.overlay.className = 'tour-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 99999;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.35s ease, visibility 0.35s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    this.spotlight = document.createElement('div');
    this.spotlight.className = 'tour-spotlight';
    this.spotlight.style.cssText = `
      position: fixed;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.75);
      border-radius: 12px;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 100000;
      pointer-events: none;
      border: 2px solid var(--accent-primary);
      opacity: 0;
    `;

    this.bubble = document.createElement('div');
    this.bubble.className = 'tour-bubble';
    this.bubble.style.cssText = `
      position: fixed;
      z-index: 100001;
      width: min(420px, 92vw);
      background: rgba(10, 16, 30, 0.98);
      backdrop-filter: blur(30px);
      -webkit-backdrop-filter: blur(30px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.05);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      opacity: 0;
      pointer-events: none;
    `;

    this.overlay.appendChild(this.spotlight);
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.bubble);
    // Bubble is outside overlay so centering isn't affected by flex container
  },

  start() {
    // Rebuild DOM elements if they were removed by a previous finish()
    if (!this.overlay || !this.bubble) {
      this.createUI();
    }
    this.currentStep = 0;
    this.overlay.style.visibility = 'visible';
    this.overlay.style.opacity = '1';
    // Make bubble interactive and visible
    this.bubble.style.opacity = '1';
    this.bubble.style.pointerEvents = 'auto';
    this.showStep();
  },

  // Always reset ALL positional properties before placing bubble
  _resetBubble() {
    this.bubble.style.top = '';
    this.bubble.style.bottom = '';
    this.bubble.style.left = '';
    this.bubble.style.right = '';
    this.bubble.style.transform = '';
    this.bubble.style.marginLeft = '';
    this.bubble.style.marginTop = '';
  },

  _centerBubble() {
    this._resetBubble();
    this.bubble.style.top = '50%';
    this.bubble.style.left = '50%';
    this.bubble.style.transform = 'translate(-50%, -50%)';
  },

  async _captureScreenshot(selector) {
    if (!selector) return null;
    const el = document.querySelector(selector);
    if (!el) return null;
    
    try {
      // Ensure html2canvas is available (using the one from node_modules if possible, fallback to CDN)
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      
      const canvas = await window.html2canvas(el, { 
        backgroundColor: null, 
        scale: 2, // Sharpness
        logging: false,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 0
      });
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.error("TourGuide: html2canvas failed", e);
      return null;
    }
  },

  async showStep() {
    const step = this.steps[this.currentStep];
    
    // Execute onBefore hook if exists (e.g. to switch tabs)
    if (step.onBefore) {
      await step.onBefore();
      // Let the DOM settle after a tab switch
      await new Promise(r => setTimeout(r, 350));
    }

    const target = step.element ? document.querySelector(step.element) : null;
    let screenshotUrl = null;

    if (step.image) {
      screenshotUrl = step.image;
    } else if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(r => setTimeout(r, 450)); // Wait for scroll and animations
      
      screenshotUrl = await this._captureScreenshot(step.element);
    } 

    // Always center the bubble and hide the spotlight
    this.spotlight.style.opacity = '0';
    this.spotlight.style.top = '-9999px';
    this._centerBubble();

    this._renderBubbleContent(step, screenshotUrl);
  },



  _renderBubbleContent(step, screenshotUrl) {
    const progress = ((this.currentStep + 1) / this.steps.length) * 100;
    const isLast = this.currentStep === this.steps.length - 1;
    const isFirst = this.currentStep === 0;

    this.bubble.innerHTML = `
      <div style="height: 4px; background: rgba(255,255,255,0.06); width: 100%;">
        <div style="height: 100%; background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary)); width: ${progress}%; transition: width 0.4s ease; border-radius: 0 2px 2px 0;"></div>
      </div>
      ${screenshotUrl ? `
        <div style="width: 100%; height: 220px; overflow: hidden; background: #000; position: relative; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
          <div style="position: absolute; inset: 0; background: radial-gradient(circle at center, rgba(37, 99, 235, 0.1) 0%, transparent 80%);"></div>
          <img src="${screenshotUrl}"
            style="max-width: 95%; max-height: 90%; object-fit: contain; display: block; border-radius: 12px; box-shadow: 0 15px 45px rgba(0,0,0,0.7); filter: brightness(1.02) contrast(1.05);">
        </div>` : ''}
      <div style="padding: 1.75rem 2rem 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; gap: 1rem;">
          <h3 style="font-family: 'Outfit'; font-weight: 900; margin: 0; font-size: 1.3rem; color: #ffffff; line-height: 1.2;">${step.title}</h3>
          <button class="skip-tour" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); font-size: 0.65rem; font-weight: 800; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; border-radius: 8px; flex-shrink: 0; transition: all 0.2s;">Skip</button>
        </div>
        <p style="color: rgba(255,255,255,0.75); font-size: 0.95rem; line-height: 1.6; margin: 0 0 2rem 0; font-weight: 500;">${step.text}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 1.5rem;">
          <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
            ${this.steps.map((_, i) => `<div style="width: ${i === this.currentStep ? '20px' : '8px'}; height: 8px; border-radius: 4px; background: ${i === this.currentStep ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)'}; transition: all 0.3s ease;"></div>`).join('')}
          </div>
          <div style="display: flex; gap: 0.75rem; flex-shrink: 0;">
            ${!isFirst ? '<button class="tour-prev btn-secondary" style="padding: 0 1.25rem; font-size: 0.8rem; font-weight: 800; border-radius: 12px; height: 44px; min-width: 90px; color: white; border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.05);">BACK</button>' : ''}
            <button class="tour-next btn-primary" style="padding: 0 1.5rem; font-size: 0.85rem; font-weight: 900; border-radius: 12px; background: var(--accent-primary); color: white; border: none; height: 44px; min-width: 120px; box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);">${isLast ? 'START NOW 🚀' : 'NEXT →'}</button>
          </div>
        </div>
      </div>
    `;

    this.bubble.querySelector('.tour-next').onclick = () => this.next();
    this.bubble.querySelector('.skip-tour').onclick = () => this.finish();
    if (!isFirst) {
      this.bubble.querySelector('.tour-prev').onclick = () => this.prev();
    }
  },

  next() {
    this.currentStep++;
    if (this.currentStep >= this.steps.length) {
      this.finish();
    } else {
      this.showStep();
    }
  },

  prev() {
    this.currentStep--;
    this.showStep();
  },

  finish() {
    // Fade out
    this.overlay.style.opacity = '0';
    this.bubble.style.opacity = '0';
    this.bubble.style.pointerEvents = 'none';

    setTimeout(() => {
      // Fully remove both from the DOM so they can never block interaction
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      if (this.bubble && this.bubble.parentNode) {
        this.bubble.parentNode.removeChild(this.bubble);
      }
      // Reset references so createUI() can rebuild cleanly next time
      this.overlay = null;
      this.spotlight = null;
      this.bubble = null;

      // Fire the onFinish callback (navigates home, marks tour seen, etc.)
      if (this.onFinish) this.onFinish();
    }, 320);
  }
};
