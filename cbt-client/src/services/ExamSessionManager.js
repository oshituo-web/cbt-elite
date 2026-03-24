export class ExamSessionManager {
  constructor(questions, initialAnswers = {}, shouldShuffle = true) {
    // Phase 2: Randomization - Shuffle questions on start
    this.originalQuestions = [...questions];
    this.questions = shouldShuffle ? this.shuffle([...questions]) : [...questions];
    this.userAnswers = initialAnswers;
    this.currentIndex = 0;
    this.startTime = Date.now();
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }


  getCurrentQuestion() {
    return this.questions[this.currentIndex];
  }

  setAnswer(index, answer) {
    this.userAnswers[index] = answer;
  }

  getAnswer(index) {
    return this.userAnswers[index];
  }

  next() {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      return true;
    }
    return false;
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return true;
    }
    return false;
  }

  getProgress() {
    return {
      current: this.currentIndex + 1,
      total: this.questions.length,
      percentage: Math.round(((this.currentIndex + 1) / this.questions.length) * 100)
    };
  }

  getTimeTaken() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  getSummary() {
    const total = this.questions.length
    const timeTaken = this.getTimeTaken()
    let correct = 0
    this.questions.forEach((q, i) => {
      if (q.question_type !== 'theory') {
        const correctAnswer = q.answers?.find(a => a.is_correct)
        if (this.userAnswers[i] && this.userAnswers[i] === correctAnswer?.id) correct++
      }
    })
    return {
      userAnswers: { ...this.userAnswers },
      total,
      correct,
      timeTaken,
      score_percentage: total > 0 ? Math.round((correct / total) * 100) : 0
    }
  }
}
