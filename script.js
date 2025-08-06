document.addEventListener('DOMContentLoaded', () => {
    // --- Wizard Steps ---
    const steps = document.querySelectorAll('.wizard-step');
    let currentStep = 0;

    // --- Element Selectors ---
    const configForm = document.getElementById('config-form');
    const fileInput = document.getElementById('pdf-file');
    const fileNameDisplay = document.getElementById('file-name-display');
    const fileLabelText = document.getElementById('file-label-text');
    const generateBtn = document.getElementById('generate-btn');
    const loaderContainer = document.getElementById('loader-container');
    const errorMessage = document.getElementById('error-message');
    const backToUploadBtn = document.getElementById('back-to-upload-btn');
    
    // Quiz Elements
    const questionCounter = document.getElementById('question-counter');
    const timerDisplay = document.getElementById('timer');
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const nextBtn = document.getElementById('next-btn');
    const liveExplanation = document.getElementById('live-explanation');

    // Results Elements
    const totalQuestionsSpan = document.getElementById('total-questions');
    const correctAnswersSpan = document.getElementById('correct-answers');
    const incorrectAnswersSpan = document.getElementById('incorrect-answers');
    const finalScoreSpan = document.getElementById('final-score');
    const resultsChartCanvas = document.getElementById('results-chart');
    const reviewContainer = document.getElementById('review-container');
    const restartBtn = document.getElementById('restart-btn');

    // Flashcard Elements
    const viewFlashcardsBtn = document.getElementById('view-flashcards-btn');
    const flashcardContainer = document.getElementById('flashcard-container');
    const flashcard = document.querySelector('.flashcard');
    const flashcardQuestion = document.getElementById('flashcard-question');
    const flashcardBackContent = document.getElementById('flashcard-back-content'); // Corrected selector
    const prevCardBtn = document.getElementById('prev-card-btn');
    const nextCardBtn = document.getElementById('next-card-btn');
    const flashcardCounter = document.getElementById('flashcard-counter');
    const backToResultsBtn = document.getElementById('back-to-results-btn');
    const downloadCardsBtn = document.getElementById('download-cards-btn');

    // --- State Variables ---
    let quizData = [];
    let userAnswers = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let timerInterval;
    let timeElapsed = 0;
    let uploadedFile = null;
    let currentCardIndex = 0;

    // --- Core Functions ---
    function showStep(stepIndex) {
        steps.forEach((step, index) => {
            step.classList.toggle('active', index === stepIndex);
        });
        currentStep = stepIndex;
    }
    
    function showError(message) {
        errorMessage.textContent = message;
    }

    function updateLoadingMessage(message) {
        const loadingText = loaderContainer.querySelector('p');
        if (loadingText) {
            loadingText.textContent = message;
        }
    }

    // --- Event Listeners ---
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            uploadedFile = fileInput.files[0];
            fileNameDisplay.textContent = uploadedFile.name;
            fileLabelText.textContent = "File Selected!";
            setTimeout(() => showStep(1), 300);
        } else {
            uploadedFile = null;
        }
    });

    backToUploadBtn.addEventListener('click', () => {
        showStep(0);
        fileNameDisplay.textContent = '';
        fileLabelText.textContent = "Click to choose a PDF file";
        uploadedFile = null;
        fileInput.value = '';
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
        generateBtn.disabled = true;
        backToUploadBtn.disabled = true;

        updateLoadingMessage('Analyzing PDF structure...');
        
        try {
            const response = await fetch('/generate-quiz', {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'An unknown server error occurred.');
            
            quizData = data.questions;
            localStorage.setItem('quizData', JSON.stringify(quizData));

            if (quizData && quizData.length > 0) {
                updateLoadingMessage('Quiz generated successfully!');
                setTimeout(() => startQuiz(), 1000);
            } else {
                showError('Failed to generate a valid quiz from the document.');
                showStep(1);
            }
        } catch (error) {
            showError(`Error: ${error.message}`);
            showStep(1);
        } finally {
            loaderContainer.style.display = 'none';
            updateLoadingMessage('AI is thinking... please wait.');
            generateBtn.disabled = false;
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
        localStorage.removeItem('quizData');
        localStorage.removeItem('userAnswers');
        localStorage.removeItem('score');
        resetState();
        showStep(0);
        fileNameDisplay.textContent = '';
        fileLabelText.textContent = "Click to choose a PDF file";
        uploadedFile = null;
        fileInput.value = '';
    });

    viewFlashcardsBtn.addEventListener('click', () => {
        showStep(4);
        initializeFlashcards();
    });

    backToResultsBtn.addEventListener('click', () => showStep(3));

    flashcardContainer.addEventListener('click', () => {
        flashcard.classList.toggle('flipped');
    });

    nextCardBtn.addEventListener('click', () => {
        if (quizData.length === 0) return;
        currentCardIndex = (currentCardIndex + 1) % quizData.length;
        displayFlashcard();
    });

    prevCardBtn.addEventListener('click', () => {
        if (quizData.length === 0) return;
        currentCardIndex = (currentCardIndex - 1 + quizData.length) % quizData.length;
        displayFlashcard();
    });

    downloadCardsBtn.addEventListener('click', downloadFlashcards);

    // --- Main Logic Functions ---
    function resetState() {
        userAnswers = [];
        currentQuestionIndex = 0;
        score = 0;
        clearInterval(timerInterval);
        timeElapsed = 0;
        errorMessage.textContent = '';
        if (reviewContainer) reviewContainer.innerHTML = '';
    }

    function startQuiz() {
        resetState();
        showStep(2);
        startTimer();
        displayQuestion();
    }

    function displayQuestion() {
        const question = quizData[currentQuestionIndex];
        questionCounter.textContent = `Question ${currentQuestionIndex + 1} of ${quizData.length}`;
        questionText.textContent = question.question;
        optionsContainer.innerHTML = '';
        liveExplanation.style.display = 'none';
        liveExplanation.innerHTML = '';
        
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
        const currentQuestion = quizData[currentQuestionIndex];
        const correctAnswer = currentQuestion.answer;
        
        Array.from(optionsContainer.children).forEach(btn => {
            btn.disabled = true;
            btn.classList.add('disabled');
            if (btn.textContent === correctAnswer) btn.classList.add('correct');
        });

        if (selectedOption === correctAnswer) {
            score++;
            event.target.classList.add('correct');
        } else {
            event.target.classList.add('incorrect');
        }

        if (currentQuestion.explanation) {
            liveExplanation.innerHTML = `<div class="explanation-text"><i class="fa-solid fa-lightbulb"></i> Explanation: ${currentQuestion.explanation}</div>`;
            liveExplanation.style.display = 'block';
        }

        nextBtn.textContent = (currentQuestionIndex < quizData.length - 1) ? 'Next Question' : 'Finish & Review';
        nextBtn.style.display = 'block';
    }

    function endQuiz() {
        clearInterval(timerInterval);
        localStorage.setItem('userAnswers', JSON.stringify(userAnswers));
        localStorage.setItem('score', score.toString());
        showStep(3);
        displayResults();
        displayReview();
    }

    function displayResults() {
        if (!quizData || quizData.length === 0) return;

        const totalQuestions = quizData.length;
        const incorrectAnswers = totalQuestions - score;
        const percentage = ((score / totalQuestions) * 100).toFixed(2);

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
                plugins: { legend: { position: 'top', labels: { color: 'var(--text-color)' } } }
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
    
    function initializeFlashcards() {
        currentCardIndex = 0;
        displayFlashcard();
    }

    function displayFlashcard() {
        if (!quizData || quizData.length === 0) return;
        flashcard.classList.remove('flipped');
        
        const card = quizData[currentCardIndex];
        setTimeout(() => {
            flashcardQuestion.textContent = card.question;
            flashcardBackContent.innerHTML = `
                <div class="flashcard-content-wrapper">
                    <p class="flashcard-answer-title">Answer</p>
                    <p class="flashcard-answer-text">${card.answer}</p>
                    <hr class="flashcard-divider">
                    <p class="flashcard-explanation-text">${card.explanation}</p>
                </div>
            `;
            flashcardCounter.textContent = `${currentCardIndex + 1} / ${quizData.length}`;
        }, 150);
    }

    function downloadFlashcards() {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Question,Answer,Explanation\n";

        quizData.forEach(card => {
            const question = `"${card.question.replace(/"/g, '""')}"`;
            const answer = `"${card.answer.replace(/"/g, '""')}"`;
            const explanation = `"${(card.explanation || "").replace(/"/g, '""')}"`;
            csvContent += `${question},${answer},${explanation}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "flashcards_with_explanations.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function initializeApp() {
        const savedQuizData = localStorage.getItem('quizData');
        const savedUserAnswers = localStorage.getItem('userAnswers');
        const savedScore = localStorage.getItem('score');

        if (savedQuizData && savedUserAnswers && savedScore !== null) {
            quizData = JSON.parse(savedQuizData);
            userAnswers = JSON.parse(savedUserAnswers);
            score = parseInt(savedScore, 10);
            showStep(3);
            displayResults();
            displayReview();
        } else {
            showStep(0);
        }
    }
    
    initializeApp();
});