export class ExamSessionManager {
  constructor(questions, initialAnswers = {}, shouldShuffle = true, groupBySubject = false) {
    this.originalQuestions = [...questions];
    this.userAnswers = initialAnswers;
    this.currentIndex = 0;
    this.startTime = Date.now();
    
    // Grouped Shuffle: Keep passages/groups together
    if (shouldShuffle) {
      if (groupBySubject) {
        this.questions = this.subjectGroupedShuffle([...questions]);
      } else {
        this.questions = this.groupedShuffle([...questions]);
      }
    } else {
      this.questions = [...questions];
    }
  }

  subjectGroupedShuffle(questions) {
    // 1. Group by subject name
    const subjectMap = {};
    questions.forEach(q => {
      const sub = q.subject || (Array.isArray(q.subjects) ? q.subjects[0]?.subject_name : q.subjects?.subject_name) || 'General';
      if (!subjectMap[sub]) subjectMap[sub] = [];
      subjectMap[sub].push(q);
    });

    // 2. For each subject, apply groupedShuffle to keep passages/groups together
    // 3. Keep the order of subjects as they appear or are defined (English usually first)
    const subjects = Object.keys(subjectMap);
    // Sort to ensure "Use of English" or "English" is first if it exists
    subjects.sort((a, b) => {
        const aLow = a.toLowerCase();
        const bLow = b.toLowerCase();
        if (aLow.includes('english')) return -1;
        if (bLow.includes('english')) return 1;
        return a.localeCompare(b);
    });

    const finalQuestions = [];
    subjects.forEach(sub => {
      finalQuestions.push(...this.groupedShuffle(subjectMap[sub]));
    });

    return finalQuestions;
  }

  groupedShuffle(questions) {
    const groups = [];
    const groupMap = new Map();
    const ungrouped = [];

    questions.forEach(q => {
      if (q.group_id) {
        if (!groupMap.has(q.group_id)) {
          const group = { id: q.group_id, items: [] };
          groups.push(group);
          groupMap.set(q.group_id, group);
        }
        groupMap.get(q.group_id).items.push(q);
      } else {
        ungrouped.push({ items: [q] });
      }
    });

    const allBundles = [...groups, ...ungrouped];
    
    // Shuffle the bundles
    for (let i = allBundles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allBundles[i], allBundles[j]] = [allBundles[j], allBundles[i]];
    }

    // Flatten back
    return allBundles.flatMap(b => b.items);
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
    const total = this.questions.length;
    const answered = Object.keys(this.userAnswers).length;
    return {
      current: this.currentIndex + 1,
      total: total,
      answered: answered,
      percentage: total > 0 ? Math.round((answered / total) * 100) : 0
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
        if (this.userAnswers[i] && this.userAnswers[i] === correctAnswer?.id) {
          correct++
        }
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
