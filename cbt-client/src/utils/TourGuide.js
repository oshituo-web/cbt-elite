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
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.className = 'tour-overlay';
    this.overlay.style.opacity = '0';
    this.overlay.style.visibility = 'hidden';

    this.spotlight = document.createElement('div');
    this.spotlight.className = 'tour-spotlight';

    this.bubble = document.createElement('div');
    this.bubble.className = 'tour-bubble';

    this.overlay.appendChild(this.spotlight);
    this.overlay.appendChild(this.bubble);
    document.body.appendChild(this.overlay);
  },

  start() {
    this.currentStep = 0;
    this.overlay.style.visibility = 'visible';
    this.overlay.style.opacity = '1';
    this.showStep();
  },

  showStep() {
    const step = this.steps[this.currentStep];
    const target = step.element ? document.querySelector(step.element) : null;

    if (target) {
      const rect = target.getBoundingClientRect();
      const padding = 10;
      this.spotlight.style.display = 'block';
      this.spotlight.style.top = `${rect.top + window.scrollY - padding}px`;
      this.spotlight.style.left = `${rect.left + window.scrollX - padding}px`;
      this.spotlight.style.width = `${rect.width + padding * 2}px`;
      this.spotlight.style.height = `${rect.height + padding * 2}px`;
      
      // Position bubble relative to spotlight
      this.positionBubble(rect);
    } else {
      // Full screen welcome or middle of screen
      this.spotlight.style.display = 'none';
      this.bubble.style.position = 'fixed';
      this.bubble.style.top = '50%';
      this.bubble.style.bottom = 'auto';
      this.bubble.style.left = '50%';
      this.bubble.style.transform = 'translate(-50%, -50%)';
      this.bubble.style.width = 'calc(100% - 40px)';
      this.bubble.style.maxWidth = '400px';
    }

    this.bubble.innerHTML = `
      <h3>${step.title}</h3>
      <p>${step.text}</p>
      <div class="tour-actions">
        <span class="tour-step-counter" style="font-size: 0.8rem;">${this.currentStep + 1} / ${this.steps.length}</span>
        <div style="display: flex; gap: 0.5rem;">
          ${this.currentStep > 0 ? '<button class="btn-secondary tour-prev" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">Back</button>' : ''}
          <button class="primary tour-next" style="padding: 0.4rem 1rem; font-size: 0.8rem; font-weight: 700;">${this.currentStep === this.steps.length - 1 ? 'Finish' : 'Next'}</button>
        </div>
      </div>
    `;

    this.bubble.querySelector('.tour-next').onclick = () => this.next();
    if (this.currentStep > 0) {
      this.bubble.querySelector('.tour-prev').onclick = () => this.prev();
    }
  },

  positionBubble(rect) {
    // Dock to bottom center on all devices to ensure visibility and consistency
    this.bubble.style.position = 'fixed';
    this.bubble.style.bottom = '20px';
    this.bubble.style.top = 'auto';
    this.bubble.style.left = '50%';
    this.bubble.style.transform = 'translateX(-50%)';
    this.bubble.style.width = 'calc(100% - 40px)';
    this.bubble.style.maxWidth = '400px';
    this.bubble.style.margin = '0 auto';
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
    this.overlay.style.opacity = '0';
    setTimeout(() => {
      this.overlay.style.visibility = 'hidden';
      if (this.onFinish) this.onFinish();
    }, 300);
  }
};
