const texts = {
  'N5': [{
    question: 'What’s the scale of the bonus payment for this section?',
    correctText: `Correct answer! The bonus payment for this section will be on the scale of $0.50.`,
    incorrectText: `Wrong answer! The bonus payment for this section will be on the scale of $0.50`,
    options: ['$0.50', '$5.00'],
    correctIndex: 0,
  }, {
    question: 'What’s the scale of the bonus payment for this section?',
    correctText: `Correct answer! The bonus payment for this section will be on the scale of $5.00.`,
    incorrectText: `Wrong answer! The bonus payment for this section will be on the scale of $5.00.`,
    options: ['$0.50', '$5.00'],
    correctIndex: 1,
  }],
  'N6': [{
    question: 'What’s the scale of the bonus payment for this section?',
    correctText: `Correct answer! The bonus payment for this section will be on the scale of $5.00.`,
    incorrectText: `Wrong answer! The bonus payment for this section will be on the scale of $5.00`,
    options: ['$0.50', '$5.00'],
    correctIndex: 1,
  }, {
    question: 'What’s the scale of the bonus payment for this section?',
    correctText: `Correct answer! The bonus payment for this section will be on the scale of $0.50.`,
    incorrectText: `Wrong answer! The bonus payment for this section will be on the scale of $0.50.`,
    options: ['$0.50', '$5.00'],
    correctIndex: 0,
  }],
}

const $beforeTaskSurvey = $('#survey-before-task');
const $afterInstructionsSurvey = $('#survey-after-instructions');

const surveyHTML = `
  <div class="d-flex h-100 flex-column justify-content-between">
  <div class="d-flex m-auto flex-column" style="max-width: 400px;">
      <p><strong class="survey__question"></strong></p>
      <div class="survey__checkboxes"></div>
      <div class="position-relative mt-2">
          <span class="position-absolute top-0 text-success font-weight-bold" style="display: none;"></span>
          <span class="position-absolute top-0 text-danger font-weight-bold" style="display: none;"></span>
      </div>
  </div>
  <div class="buttons mt-auto text-right">
      <input class="btn btn-primary" disabled type="button" id="start-button" value="Continue">
  </div>
  </div>
`

function makeMultiChoiceComponent ($el, question, choices, correctAnswerIndex, correctAnswerText, wrongAnswerText) {
  $el.html(surveyHTML);
  $el.find('.survey__question').text(question);
  $el.find('.survey__checkboxes').html(
    choices.map(
      (choice, i) => `
      <div class="form-check">
        <input value="${i}" class="form-check-input" type="radio" name="flexRadioDefault" id="survey__radio${i}">
        <label class="form-check-label" for="survey__radio${i}">
            ${choice}
        </label>
      </div>
      `).join('')
  );

  const $checkboxes = $el.find('input[type=radio]');
  const $submitButton = $el.find('.btn-primary');
  let answer = null;

  $checkboxes.on('change.makeMultiChoiceComponent', () => {
    const $checked = $el.find('input[type=radio]:checked');
    $checkboxes.attr('disabled', true);
    answer = +$checked.val();
    if (answer === correctAnswerIndex) {
      $el.find('.text-success').show().html(correctAnswerText);
    } else {
      $el.find('.text-danger').show().html(wrongAnswerText);
    }
    $submitButton.attr('disabled', false);
  });

  $submitButton.one('click.makeMultiChoiceComponent', () => {
    $checkboxes.unbind('change.makeMultiChoiceComponent');  
    $el.trigger('submit'); 
  });

  return { $el, complete: () => $el.html(''), value: () => choices[answer], isCorrect: () => answer === correctAnswerIndex };
}


export function beforeTaskSurvey (taskN, condition) {
  const survey = makeMultiChoiceComponent(
    $beforeTaskSurvey,
    texts[condition][taskN].question,
    texts[condition][taskN].options,
    texts[condition][taskN].correctIndex,
    texts[condition][taskN].correctText,
    texts[condition][taskN].incorrectText,
  );

  return survey;
}

export function afterInstructionsSurvey (tasks) {
  const survey = makeMultiChoiceComponent(
    $afterInstructionsSurvey,
    'What will be the long-run average of the process?',
    [0, 100, -100],
    0,
    'Correct answer! The long-run average will be 0.',
    'Wrong answer! The long-run average will be 0.'
  );

  return survey;
}

export function shouldRunAfterInstructionsSurvey (tasks, condition) {
  return tasks[0].processInfo !== "";
}

export function shouldRunBeforeTaskSurvey (taskN, condition) {
  return !!texts?.[condition]?.[taskN];
}
