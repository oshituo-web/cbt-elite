export const TimerService = {
  timer: null,
  timeLeft: 0,
  
  start(initialSeconds, onTick, onComplete) {
    this.timeLeft = initialSeconds;
    this.stop(); // Clear any existing
    
    this.timer = setInterval(() => {
      this.timeLeft--;
      if (onTick) onTick(this.timeLeft);
      
      if (this.timeLeft <= 0) {
        this.stop();
        if (onComplete) onComplete();
      }
    }, 1000);
  },
  
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  getRemainingTime() {
    return this.timeLeft;
  },
  
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
};
