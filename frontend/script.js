document.addEventListener('DOMContentLoaded', () => {
    // --- Wizard Steps ---
    const steps = document.querySelectorAll('.wizard-step');
    let currentStep = 0;

    // --- All Elements ---
    const uploadForm = document.getElementById('upload-form');
    const configForm = document.getElementById('config-form');
    const fileInput = document.getElementById('pdf-file');
    const fileNameDisplay = document.getElementById('file-name-display');
    const fileLabelText = document.getElementById('file-label-text');
    const generateBtn = document.getElementById('generate-btn');
    const loaderContainer = document.getElementById('loader-container');
    const errorMessage = document.getElementById('error-message');
    const backToUploadBtn = document.getElementById('back-to-upload-btn');
    
    const questionCounter = document.getElementById('question-counter');
    const timerDisplay = document.getElementById('timer');
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const nextBtn = document.getElementById('next-btn');

    const totalQuestionsSpan = document.getElementById('total-questions');
    const correctAnswersSpan = document.getElementById('correct-answers');
    const incorrectAnswersSpan = document.getElementById('incorrect-answers');
    const finalScoreSpan = document.getElementById('final-score');
    const resultsChartCanvas = document.getElementById('results-chart');
    const reviewContainer = document.getElementById('review-container');
    const restartBtn = document.getElementById('restart-btn');

    // --- State Variables ---
    let quizData = [];
    let userAnswers = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let timerInterval;
    let timeElapsed = 0;
    let uploadedFile = null;

    // --- Navigation Logic ---
    function showStep(stepIndex) {
        steps.forEach((step, index) => {
            if (index === stepIndex) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });
        currentStep = stepIndex;
    }

    // --- Event Listeners ---
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            uploadedFile = fileInput.files[0];
            fileNameDisplay.textContent = uploadedFile.name;
            fileLabelText.textContent = "File Selected!";
            setTimeout(() => showStep(1), 300); // Go to configure step
        } else {
            uploadedFile = null;
        }
    });

    backToUploadBtn.addEventListener('click', () => {
        showStep(0); // Go back to upload step
        fileNameDisplay.textContent = '';
        fileLabelText.textContent = "Click to choose a PDF file";
        uploadedFile = null;
        fileInput.value = ''; // Clear the file input
    });

    configForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!uploadedFile) {
            showError('Please go back and select a PDF file.');
            return;
        }

        const formData = new FormData(configForm);
        formData.append('file', uploadedFile);

        loaderContainer.style.display = 'block';
        errorMessage.textContent = '';
        generateBtn.disabled = true; // Disable button during generation
        backToUploadBtn.disabled = true;

        try {
            const response = await fetch('http://127.0.0.1:5000/generate-quiz', {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'An unknown server error occurred.');
            
            quizData = data.questions;
            if (quizData && quizData.length > 0) {
                startQuiz();
            } else {
                showError('Failed to generate a valid quiz.');
                showStep(1); // Go back to config step on failure
            }
        } catch (error) {
            showError(`Error: ${error.message}`);
            showStep(1); // Go back to config step on failure
        } finally {
            loaderContainer.style.display = 'none';
            generateBtn.disabled = false; // Re-enable button
            backToUploadBtn.disabled = false;
        }
    });
    
    nextBtn.addEventListener('click', () => {
        currentQuestionIndex++;
        if (currentQuestionIndex < quizData.length) {
            displayQuestion();
        } else {
            endQuiz();
        }
    });

    restartBtn.addEventListener('click', () => {
        showStep(0); // Go back to the very first step
        fileNameDisplay.textContent = '';
        fileLabelText.textContent = "Click to choose a PDF file";
        uploadedFile = null;
        fileInput.value = ''; // Clear the file input
    });

    // --- Quiz Logic ---
    function startQuiz() {
        resetState();
        showStep(2); // Show Quiz step
        startTimer();
        displayQuestion();
    }
    
    function displayQuestion() {
        const question = quizData[currentQuestionIndex];
        if (!question || !question.question || !Array.isArray(question.options)) {
            questionText.textContent = 'Error: Invalid question data.';
            optionsContainer.innerHTML = '';
            nextBtn.style.display = 'block';
            return;
        }

        questionCounter.textContent = `Question ${currentQuestionIndex + 1} of ${quizData.length}`;
        questionText.textContent = question.question;
        optionsContainer.innerHTML = '';
        
        question.options.forEach(option => {
            const button = document.createElement('button');
            button.textContent = option;
            button.classList.add('option-btn');
            button.onclick = (e) => handleOptionSelect(e, option);
            optionsContainer.appendChild(button);
        });
        nextBtn.style.display = 'none';
    }

    function handleOptionSelect(event, selectedOption) {
        userAnswers[currentQuestionIndex] = selectedOption;
        const correctAnswer = quizData[currentQuestionIndex].answer;
        
        Array.from(optionsContainer.children).forEach(btn => {
            btn.classList.add('disabled');
            if (btn.textContent === correctAnswer) btn.classList.add('correct');
        });

        if (selectedOption === correctAnswer) {
            score++;
            event.target.classList.add('correct');
        } else {
            event.target.classList.add('incorrect');
        }

        nextBtn.textContent = (currentQuestionIndex < quizData.length - 1) ? 'Next Question' : 'Finish & Review';
        nextBtn.style.display = 'block';
    }



    function endQuiz() {
        clearInterval(timerInterval);
        showStep(3); // Show Results step
        displayResults();
        displayReview();
    }

    function displayResults() {
        const totalQuestions = quizData.length;
        const incorrectAnswers = totalQuestions - score;
        const percentage = totalQuestions > 0 ? ((score / totalQuestions) * 100).toFixed(2) : 0;

        totalQuestionsSpan.textContent = totalQuestions;
        correctAnswersSpan.textContent = score;
        incorrectAnswersSpan.textContent = incorrectAnswers;
        finalScoreSpan.textContent = `${percentage}%`;

        const chart = Chart.getChart(resultsChartCanvas);
        if (chart) chart.destroy();

        new Chart(resultsChartCanvas, {
            type: 'pie',
            data: {
                labels: ['Correct', 'Incorrect'],
                datasets: [{ data: [score, incorrectAnswers], backgroundColor: ['#22c55e', '#ef4444'], hoverOffset: 4 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { color: 'var(--text-color)' } },
                    title: { display: true, text: 'Performance Breakdown', color: 'var(--text-color)' }
                }
            }
        });
    }
    
    function displayReview() {
        reviewContainer.innerHTML = '<h2>Review Your Answers</h2>';
        quizData.forEach((question, index) => {
            const userAnswer = userAnswers[index];
            const isCorrect = userAnswer === question.answer;

            const item = document.createElement('div');
            item.classList.add('review-item');
            item.innerHTML = `
                <h3>Q${index + 1}: ${question.question}</h3>
                <ul>
                    ${question.options.map(option => `
                        <li class="${option === userAnswer ? (isCorrect ? 'highlight-green' : 'highlight-red') : ''} ${option === question.answer ? 'correct-answer-text' : ''}">
                            ${option} ${option === userAnswer ? '<span class="user-answer">(Your Answer)</span>' : ''}
                        </li>
                    `).join('')}
                </ul>
                <p class="explanation-text"><i class="fa-solid fa-lightbulb"></i> Explanation: ${question.explanation}</p>
            `;
            reviewContainer.appendChild(item);
        });
    }

    function startTimer() {
        timeElapsed = 0;
        timerDisplay.innerHTML = '<i class="fa-regular fa-clock"></i> 00:00';
        timerInterval = setInterval(() => {
            timeElapsed++;
            const minutes = Math.floor(timeElapsed / 60).toString().padStart(2, '0');
            const seconds = (timeElapsed % 60).toString().padStart(2, '0');
            timerDisplay.innerHTML = `<i class="fa-regular fa-clock"></i> ${minutes}:${seconds}`;
        }, 1000);
    }
    
    function showError(message) { errorMessage.textContent = message; }

    function resetState() {
        userAnswers = [];
        currentQuestionIndex = 0;
        score = 0;
        clearInterval(timerInterval);
        timeElapsed = 0;
    }
    
    showStep(0); // Initialize on the first step
});