/**
 * Main entry point for the application's JavaScript.
 * This function runs after the entire page content is fully loaded,
 * preventing errors from scripts running before the HTML is ready.
 */
window.onload = function() {
    // Determine which page is active by checking for a key element,
    // then run the appropriate setup function.
    if (document.getElementById('quiz-generation-form')) {
        setupQuizGenerator();
    } else if (document.getElementById('quiz-data-json')) {
        setupPublicQuiz();
    }
};

/**
 * Initializes all functionality for the main quiz creation wizard.
 */
function setupQuizGenerator() {
    // --- DOM Element Selectors ---
    const DOMElements = {
        generationForm: document.getElementById('quiz-generation-form'),
        pdfFileInput: document.getElementById('pdf-file'),
        fileLabelText: document.getElementById('file-label-text'),
        fileNameDisplay: document.getElementById('file-name-display'),
        backToUploadBtn: document.getElementById('back-to-upload-btn'),
        generateBtn: document.getElementById('generate-btn'),
        loaderContainer: document.getElementById('loader-container'),
        errorMessage: document.getElementById('error-message'),
        questionCounter: document.getElementById('question-counter'),
        timerDisplay: document.getElementById('timer'),
        questionText: document.getElementById('question-text'),
        optionsContainer: document.getElementById('options-container'),
        prevQuestionBtn: document.getElementById('prev-question-btn'),
        nextQuestionBtn: document.getElementById('next-question-btn'),
        totalQuestionsSpan: document.getElementById('total-questions'),
        correctAnswersSpan: document.getElementById('correct-answers'),
        incorrectAnswersSpan: document.getElementById('incorrect-answers'),
        finalScoreSpan: document.getElementById('final-score'),
        resultsChartCanvas: document.getElementById('results-chart'),
        reviewContainer: document.getElementById('review-container'),
        viewFlashcardsBtn: document.getElementById('view-flashcards-btn'),
        restartBtn: document.getElementById('restart-btn'),
        flashcardContainer: document.getElementById('flashcard-container'),
        flashcardQuestion: document.getElementById('flashcard-question'),
        flashcardFrontExplanation: document.getElementById('flashcard-front-explanation'),
        flashcardBackContent: document.getElementById('flashcard-back-content'),
        prevCardBtn: document.getElementById('prev-card-btn'),
        nextCardBtn: document.getElementById('next-card-btn'),
        flashcardCounter: document.getElementById('flashcard-counter'),
        backToResultsBtn: document.getElementById('back-to-results-btn'),
        downloadCsvBtn: document.getElementById('download-csv-btn'),
        downloadPdfBtn: document.getElementById('download-pdf-btn'),
    };

    if (!DOMElements.generationForm) return;

    // --- State Management ---
    let state = {
        quizData: [],
        userAnswers: [],
        currentQuestionIndex: 0,
        timerInterval: null,
        timeElapsed: 0,
        resultsChart: null,
        currentCardIndex: 0,
    };

    function showStep(stepId) {
        document.querySelectorAll('.wizard-step').forEach(step => {
            step.classList.remove('active');
        });
        const activeStep = document.getElementById(stepId);
        if (activeStep) activeStep.classList.add('active');
    }

    // EVENT LISTENERS
    DOMElements.pdfFileInput.addEventListener('change', () => {
        if (DOMElements.pdfFileInput.files.length > 0) {
            const fileName = DOMElements.pdfFileInput.files[0].name;
            DOMElements.fileLabelText.textContent = 'File Selected:';
            DOMElements.fileNameDisplay.textContent = fileName;
            showStep('step-2-configure');
        }
    });

    DOMElements.backToUploadBtn.addEventListener('click', () => {
        DOMElements.generationForm.reset();
        DOMElements.fileLabelText.textContent = 'Click to choose a PDF file';
        DOMElements.fileNameDisplay.textContent = '';
        showStep('step-1-upload');
    });

    DOMElements.generateBtn.addEventListener('click', async () => {
        if (!DOMElements.generationForm.checkValidity()) {
            DOMElements.generationForm.reportValidity();
            return;
        }
        
        DOMElements.loaderContainer.style.display = 'block';
        DOMElements.generateBtn.disabled = true;
        DOMElements.errorMessage.textContent = '';
        const formData = new FormData(DOMElements.generationForm);
        try {
            const response = await fetch('/generate-mcq', {
                method: 'POST',
                body: formData
            });
            const contentType = response.headers.get("content-type");
            if (response.redirected || !contentType || !contentType.includes("application/json")) {
                window.location.href = '/login';
                return;
            }
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `HTTP error! status: ${response.status}`);
            state.quizData = data;
            state.userAnswers = new Array(state.quizData.length).fill(null);
            startQuiz();
        } catch (error) {
            DOMElements.errorMessage.textContent = `Error: ${error.message}`;
        } finally {
            DOMElements.loaderContainer.style.display = 'none';
            DOMElements.generateBtn.disabled = false;
        }
    });

    // QUIZ LOGIC
    function startQuiz() {
        state.currentQuestionIndex = 0;
        state.timeElapsed = 0;
        DOMElements.generationForm.style.display = 'none';
        showStep('step-3-quiz');
        renderQuestion();
        startTimer();
    }

    function startTimer() {
        clearInterval(state.timerInterval);
        state.timerInterval = setInterval(() => {
            state.timeElapsed++;
            const minutes = String(Math.floor(state.timeElapsed / 60)).padStart(2, '0');
            const seconds = String(state.timeElapsed % 60).padStart(2, '0');
            DOMElements.timerDisplay.innerHTML = `<i class="fa-regular fa-clock"></i> ${minutes}:${seconds}`;
        }, 1000);
    }

    function renderQuestion() {
        const question = state.quizData[state.currentQuestionIndex];
        DOMElements.questionCounter.textContent = `Question ${state.currentQuestionIndex + 1} of ${state.quizData.length}`;
        DOMElements.questionText.textContent = question.question;
        DOMElements.optionsContainer.innerHTML = '';
        question.options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.textContent = option;
            button.onclick = () => selectAnswer(option);
            DOMElements.optionsContainer.appendChild(button);
        });
        if (state.userAnswers[state.currentQuestionIndex]) {
            highlightSelectedOption();
        }
        updateNavButtons();
    }
    
    function selectAnswer(selectedOption) {
        state.userAnswers[state.currentQuestionIndex] = selectedOption;
        highlightSelectedOption();
    }
    
    function highlightSelectedOption() {
        const selectedAnswer = state.userAnswers[state.currentQuestionIndex];
        DOMElements.optionsContainer.querySelectorAll('.option-btn').forEach(btn => {
            btn.classList.remove('selected');
            if (btn.textContent === selectedAnswer) {
                btn.classList.add('selected');
            }
        });
    }

    function updateNavButtons() {
        DOMElements.prevQuestionBtn.style.display = state.currentQuestionIndex > 0 ? 'inline-block' : 'none';
        DOMElements.nextQuestionBtn.textContent = state.currentQuestionIndex === state.quizData.length - 1 ? 'Finish' : 'Next';
    }
    
    DOMElements.nextQuestionBtn.addEventListener('click', () => {
        if (!state.userAnswers[state.currentQuestionIndex]) {
            return alert('Please select an answer.');
        }
        if (state.currentQuestionIndex < state.quizData.length - 1) {
            state.currentQuestionIndex++;
            renderQuestion();
        } else {
            finishQuiz();
        }
    });

    DOMElements.prevQuestionBtn.addEventListener('click', () => {
        if (state.currentQuestionIndex > 0) {
            state.currentQuestionIndex--;
            renderQuestion();
        }
    });

    // RESULTS LOGIC
    function finishQuiz() {
        clearInterval(state.timerInterval);
        showStep('step-4-results');
        calculateAndDisplayResults();
    }
    
    function calculateAndDisplayResults() {
        let correctCount = 0;
        state.quizData.forEach((q, index) => {
            if (state.userAnswers[index] === q.answer) correctCount++;
        });
        const incorrectCount = state.quizData.length - correctCount;
        const score = state.quizData.length > 0 ? (correctCount / state.quizData.length) * 100 : 0;
        DOMElements.totalQuestionsSpan.textContent = state.quizData.length;
        DOMElements.correctAnswersSpan.textContent = correctCount;
        DOMElements.incorrectAnswersSpan.textContent = incorrectCount;
        DOMElements.finalScoreSpan.textContent = `${score.toFixed(1)}%`;
        renderResultsChart(correctCount, incorrectCount);
        renderReviewSection();
    }
    
    function renderResultsChart(correct, incorrect) {
        if (state.resultsChart) state.resultsChart.destroy();
        state.resultsChart = new Chart(DOMElements.resultsChartCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Correct', 'Incorrect'],
                datasets: [{
                    data: [correct, incorrect],
                    backgroundColor: ['#22c55e', '#ef4444'],
                    borderColor: ['#0f172a'],
                    borderWidth: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { position: 'bottom', labels: { color: '#e2e8f0', font: { size: 14 } } } }
            }
        });
    }

    function renderReviewSection() {
        DOMElements.reviewContainer.innerHTML = '<h2>Review Your Answers</h2>';
        state.quizData.forEach((q, index) => {
            const isCorrect = state.userAnswers[index] === q.answer;
            const item = document.createElement('div');
            item.className = 'review-item';
            let optionsHtml = q.options.map(opt => {
                let className = '';
                if (opt === q.answer) className = 'highlight-green';
                if (opt === state.userAnswers[index] && !isCorrect) className = 'highlight-red';
                return `<li class="${className}">${opt}</li>`;
            }).join('');
            item.innerHTML = `
                <h3>Question ${index + 1}: ${q.question}</h3>
                <ul>${optionsHtml}</ul>
                <p>Your answer: <span class="${isCorrect ? 'correct-answer-text' : 'user-answer'}">${state.userAnswers[index] || 'Not answered'}</span></p>
                ${!isCorrect ? `<p>Correct answer: <span class="correct-answer-text">${q.answer}</span></p>` : ''}
                <div class="explanation-text">${q.explanation || 'No explanation provided.'}</div>
            `;
            DOMElements.reviewContainer.appendChild(item);
        });
    }

    DOMElements.restartBtn.addEventListener('click', () => {
        DOMElements.generationForm.reset();
        DOMElements.fileLabelText.textContent = 'Click to choose a PDF file';
        DOMElements.fileNameDisplay.textContent = '';
        DOMElements.generationForm.style.display = 'block';
        showStep('step-1-upload');
    });

    // FLASHCARD LOGIC
    DOMElements.viewFlashcardsBtn.addEventListener('click', () => {
        state.currentCardIndex = 0;
        renderFlashcard();
        showStep('step-5-flashcards');
    });
    
    function renderFlashcard() {
        const item = state.quizData[state.currentCardIndex];
        DOMElements.flashcardQuestion.textContent = item.question;
        DOMElements.flashcardFrontExplanation.textContent = item.explanation || 'No explanation provided.';
        DOMElements.flashcardBackContent.innerHTML = `<p style="font-weight: 700; font-size: 1.2rem;">${item.answer}</p>`;
        DOMElements.flashcardCounter.textContent = `${state.currentCardIndex + 1} / ${state.quizData.length}`;
        DOMElements.flashcardContainer.classList.remove('flipped');
    }
    
    DOMElements.flashcardContainer.addEventListener('click', () => DOMElements.flashcardContainer.classList.toggle('flipped'));
    
    DOMElements.nextCardBtn.addEventListener('click', () => {
        if (state.currentCardIndex < state.quizData.length - 1) {
            state.currentCardIndex++;
            renderFlashcard();
        }
    });

    DOMElements.prevCardBtn.addEventListener('click', () => {
        if (state.currentCardIndex > 0) {
            state.currentCardIndex--;
            renderFlashcard();
        }
    });
    
    DOMElements.backToResultsBtn.addEventListener('click', () => showStep('step-4-results'));
    DOMElements.downloadCsvBtn.addEventListener('click', () => alert('CSV download coming soon!'));
    DOMElements.downloadPdfBtn.addEventListener('click', () => alert('PDF download coming soon!'));
}

/**
 * Initializes all functionality for the public quiz-taking page.
 */
function setupPublicQuiz() {
    const quizData = JSON.parse(document.getElementById('quiz-data-json').textContent);
    let current = 0, score = 0, name = "", time = 0, timer;
    let userAnswers = new Array(quizData.length).fill(null);
    const startBtn = document.getElementById('start-quiz');
    const quizStep = document.getElementById('quiz-step');
    const scoreStep = document.getElementById('score-step');
    const questionCounter = document.getElementById('question-counter');
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const finalResult = document.getElementById('final-result');
    const leaderboard = document.getElementById('leaderboard');
    const nextBtn = document.getElementById('next-question-btn');
    const timerDisplay = document.getElementById('timer');
    const showPublicStep = (stepElement) => {
        document.querySelectorAll('.wizard-step').forEach(el => el.style.display = 'none');
        if(stepElement) {
            stepElement.style.display = 'block';
            stepElement.classList.add('active');
        }
    };
    const startTimer = () => {
        timer = setInterval(() => {
            time++;
            const m = String(Math.floor(time / 60)).padStart(2, '0');
            const s = String(time % 60).padStart(2, '0');
            if(timerDisplay) timerDisplay.innerHTML = `<i class='fa-regular fa-clock'></i> ${m}:${s}`;
        }, 1000);
    };
    const renderQuestion = () => {
        const q = quizData[current];
        questionCounter.textContent = `Question ${current + 1} of ${quizData.length}`;
        questionText.textContent = q.question;
        optionsContainer.innerHTML = '';
        q.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.classList.add('option-btn');
            btn.textContent = opt;
            btn.onclick = () => {
                userAnswers[current] = opt;
                optionsContainer.querySelectorAll('.option-btn').forEach(b => {
                    b.classList.remove('selected');
                });
                btn.classList.add('selected');
            };
            optionsContainer.appendChild(btn);
        });
        if(userAnswers[current]) {
             const selectedBtn = Array.from(optionsContainer.children).find(b => b.textContent === userAnswers[current]);
             if(selectedBtn) {
                 selectedBtn.classList.add('selected');
             }
        }
        nextBtn.textContent = current === quizData.length - 1 ? 'Finish' : 'Next';
    };
    startBtn.onclick = () => {
        name = document.getElementById('participant-name').value.trim();
        if (!name) return alert('Please enter your name.');
        showPublicStep(quizStep);
        startTimer();
        renderQuestion();
    };
    nextBtn.onclick = () => {
        if (!userAnswers[current]) {
            return alert('Please select an answer before proceeding.');
        }
        if (current === quizData.length - 1) {
            finishQuiz();
        } else {
            current++;
            renderQuestion();
        }
    };
    const finishQuiz = () => {
        clearInterval(timer);
        score = 0;
        quizData.forEach((q, index) => {
            if(userAnswers[index] === q.answer) score++;
        });
        showPublicStep(scoreStep);
        finalResult.textContent = `${name}, you scored ${score}/${quizData.length}`;
        const slug = window.location.pathname.split('/').pop();
        fetch(`/submit-score/${slug}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, score, total_questions: quizData.length, time_taken: time })
        });
        fetch(`/leaderboard/${slug}`)
            .then(res => res.json())
            .then(data => {
                if(leaderboard) {
                    leaderboard.innerHTML = '<h3>Leaderboard</h3><ol>' + data.map(e =>
                        `<li><strong>${e.name}</strong> - ${e.score}/${e.total_questions} - ${e.time_taken}s</li>`).join('') + '</ol>';
                }
            });
    };
}