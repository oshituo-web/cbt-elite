export const ExamCard = ({ title, description, colorClass, icon, dataExamTarget, extraClass }) => `
  <div class="glass card exam-card ${colorClass} ${extraClass}" data-exam="${dataExamTarget}">
    <div class="icon">${icon}</div>
    <h3>${title}</h3>
    <p>${description}</p>
  </div>
`;
