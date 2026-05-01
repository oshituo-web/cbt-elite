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
      background: rgba(10, 16, 30, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(139, 92, 246, 0.3);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 32px 64px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.05);
      transition: top 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                  left 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                  bottom 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                  transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                  opacity 0.3s ease;
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
        scale: 2,
        logging: false,
        useCORS: true
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

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(r => setTimeout(r, 400));
      
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
      <div style="height: 3px; background: rgba(255,255,255,0.06); width: 100%;">
        <div style="height: 100%; background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary)); width: ${progress}%; transition: width 0.4s ease; border-radius: 0 2px 2px 0;"></div>
      </div>
      ${screenshotUrl ? `
        <div style="width: 100%; height: 170px; overflow: hidden; background: rgba(0,0,0,0.6); position: relative; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid rgba(255,255,255,0.05);">
          <img src="${screenshotUrl}"
            style="max-width: 90%; max-height: 90%; object-fit: contain; display: block; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
        </div>` : ''}
      <div style="padding: 1.5rem 1.75rem 1.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem; gap: 1rem;">
          <h3 style="font-family: 'Outfit'; font-weight: 900; margin: 0; font-size: 1.2rem; color: #ffffff; line-height: 1.2;">${step.title}</h3>
          <button class="skip-tour" style="background: none; border: none; color: rgba(255,255,255,0.4); font-size: 0.65rem; font-weight: 700; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; padding: 0; flex-shrink: 0;">Skip</button>
        </div>
        <p style="color: rgba(255,255,255,0.72); font-size: 0.9rem; line-height: 1.65; margin: 0 0 1.5rem 0;">${step.text}</p>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; gap: 5px; align-items: center;">
            ${this.steps.map((_, i) => `<div style="width: ${i === this.currentStep ? '18px' : '6px'}; height: 6px; border-radius: 3px; background: ${i === this.currentStep ? 'var(--accent-primary)' : 'rgba(255,255,255,0.15)'}; transition: all 0.3s ease;"></div>`).join('')}
          </div>
          <div style="display: flex; gap: 0.5rem;">
            ${!isFirst ? '<button class="tour-prev btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.65rem; border-radius: 10px; height: auto;">Back</button>' : ''}
            <button class="tour-next btn-primary" style="padding: 0.4rem 1rem; font-size: 0.65rem; font-weight: 800; border-radius: 10px; background: var(--accent-primary); color: white; border: none; height: auto;">${isLast ? 'GET STARTED 🚀' : 'NEXT →'}</button>
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
