export const ExamCard = ({ title, description, color, icon, dataExamTarget, extraClass }) => `
  <div class="exam-card ${color} ${extraClass}" data-exam="${dataExamTarget || title.split(' ')[0]}">
    <div class="exam-card-icon">${icon}</div>
    <div class="exam-card-content">
      <h3>${title}</h3>
      <p>${description}</p>
    </div>
    <button class="btn-primary card-action-btn">
       Start ${extraClass?.includes('practice') ? 'Practice' : 'Exam'}
    </button>
  </div>
`;
