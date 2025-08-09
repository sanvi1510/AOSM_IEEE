/**
 * Main entry point for the application's JavaScript.
 * This function runs when the script is loaded.
 */
document.addEventListener('DOMContentLoaded', function() {
    setupThemeToggle(); // Initialize theme toggle on all pages
    
    // Page-specific initializations
    if (document.getElementById('quiz-generation-form')) {
        setupQuizGenerator();
    } else if (document.getElementById('quiz-data-json')) {
        setupPublicQuiz();
    }
});

/**
 * Sets up the theme toggle button functionality.
 */
function setupThemeToggle() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (!themeToggleBtn) return;

    const darkIcon = document.getElementById('theme-toggle-dark-icon');
    const lightIcon = document.getElementById('theme-toggle-light-icon');

    const updateIcons = (theme) => {
        if (theme === 'dark') {
            darkIcon.style.display = 'none';
            lightIcon.style.display = 'inline-block';
        } else {
            darkIcon.style.display = 'inline-block';
            lightIcon.style.display = 'none';
        }
    };

    // Set initial icon state
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateIcons(currentTheme);

    themeToggleBtn.addEventListener('click', () => {
        const theme = document.documentElement.getAttribute('data-theme');
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateIcons(newTheme);
    });
}


/**
 * Initializes all functionality for the main quiz creation wizard.
 */
function setupQuizGenerator() {
    // --- State Management ---
    let state = {
        uploadedFile: null, // To hold the file object between steps
        quizData: [],
        userAnswers: [],
        currentQuestionIndex: 0,
        timerInterval: null,
        timeElapsed: 0,
        currentCardIndex: 0,
        currentReviewIndex: 0,
        chartInstance: null,
    };
    
    // --- DOM Element Selectors ---
    const DOMElements = {
        // Form
        generationForm: document.getElementById('quiz-generation-form'),
        // Step 1
        pdfFileInput: document.getElementById('pdf-file'),
        fileNameDisplay: document.getElementById('file-name-display'),
        uploadLoader: document.getElementById('upload-loader-container'),
        uploadError: document.getElementById('upload-error-message'),
        // Step 2
        topicsContainer: document.getElementById('topics-container'),
        backToUploadBtn: document.getElementById('back-to-upload-btn'),
        goToConfigureBtn: document.getElementById('go-to-configure-btn'),
        // Step 3
        backToTopicsBtn: document.getElementById('back-to-topics-btn'),
        generateBtn: document.getElementById('generate-btn'),
        loaderContainer: document.getElementById('loader-container'),
        errorMessage: document.getElementById('error-message'),
        // Step 4: Quiz
        questionCounter: document.getElementById('question-counter'),
        timerDisplay: document.getElementById('timer'),
        questionText: document.getElementById('question-text'),
        optionsContainer: document.getElementById('options-container'),
        prevQuestionBtn: document.getElementById('prev-question-btn'),
        nextQuestionBtn: document.getElementById('next-question-btn'),
        // Step 5: Results
        totalQuestionsSpan: document.getElementById('total-questions'),
        correctAnswersSpan: document.getElementById('correct-answers'),
        incorrectAnswersSpan: document.getElementById('incorrect-answers'),
        finalScoreSpan: document.getElementById('final-score'),
        resultsChartCanvas: document.getElementById('results-chart'),
        viewFlashcardsBtn: document.getElementById('view-flashcards-btn'),
        restartBtn: document.getElementById('restart-btn'),
        reviewContainer: document.getElementById('review-container'),
        reviewPrevBtn: document.getElementById('review-prev-btn'),
        reviewNextBtn: document.getElementById('review-next-btn'),
        reviewCounter: document.getElementById('review-counter'),
        // Step 6: Flashcards
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
        // Recommendations
        recommendationsSection: document.getElementById('recommendations-section'),
        recommendationsContainer: document.getElementById('recommendations-container'),
    };

    if (!DOMElements.generationForm) return;

    // --- Wizard Navigation ---
    function showStep(stepId) {
        document.querySelectorAll('.wizard-step').forEach(step => step.classList.remove('active'));
        const activeStep = document.getElementById(stepId);
        if (activeStep) {
            activeStep.classList.add('active');
            if (stepId === 'step-5-results') {
                calculateAndDisplayResults();
            }
        }
    }

    // --- Event Listeners Setup ---

    // STEP 1: Handle File Upload and Topic Extraction
    DOMElements.pdfFileInput.addEventListener('change', async () => {
        if (DOMElements.pdfFileInput.files.length > 0) {
            state.uploadedFile = DOMElements.pdfFileInput.files[0];
            DOMElements.fileNameDisplay.textContent = state.uploadedFile.name;
            DOMElements.uploadLoader.style.display = 'block';
            DOMElements.uploadError.textContent = '';

            const formData = new FormData();
            formData.append('file', state.uploadedFile);

            try {
                const response = await fetch('/extract-topics', { method: 'POST', body: formData });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Failed to analyze file.');
                
                renderTopics(data.topics);
                showStep('step-2-topics');
            } catch (error) {
                DOMElements.uploadError.textContent = `Error: ${error.message}`;
            } finally {
                DOMElements.uploadLoader.style.display = 'none';
            }
        }
    });

    // STEP 2: Handle Topic Selection Navigation
    DOMElements.backToUploadBtn.addEventListener('click', () => {
        DOMElements.generationForm.reset();
        DOMElements.fileNameDisplay.textContent = '';
        DOMElements.topicsContainer.innerHTML = '';
        state.uploadedFile = null;
        showStep('step-1-upload');
    });

    DOMElements.goToConfigureBtn.addEventListener('click', () => {
        showStep('step-3-configure');
    });
    
    // STEP 3: Handle Final Configuration and Generation
    DOMElements.backToTopicsBtn.addEventListener('click', () => {
        showStep('step-2-topics');
    });

    DOMElements.generateBtn.addEventListener('click', async () => {
        if (!state.uploadedFile) {
            alert("Something went wrong, please upload the file again.");
            showStep('step-1-upload');
            return;
        }
        
        DOMElements.loaderContainer.style.display = 'block';
        DOMElements.generateBtn.disabled = true;
        DOMElements.errorMessage.textContent = '';
    
        const formData = new FormData(DOMElements.generationForm);
        formData.append('file', state.uploadedFile);
    
        const selectedTopics = Array.from(DOMElements.topicsContainer.querySelectorAll('input[type="checkbox"]:checked'))
                                    .map(cb => cb.value);
    
        if (selectedTopics.length > 0) {
            formData.append('topics', selectedTopics.join(','));
        }
    
        try {
            const response = await fetch('/generate-mcq', {
                method: 'POST',
                body: formData
            });
    
            // NEW: Check if the request was redirected (e.g., to the login page)
            if (response.redirected) {
                alert("Your session has expired. You will be redirected to the login page.");
                window.location.href = response.url; // Redirect the whole page
                return; // Stop execution
            }
    
            // Check if the response is actually JSON before trying to parse it
            const contentType = response.headers.get("content-type");
            if (!response.ok || !contentType || !contentType.includes("application/json")) {
                // If not OK or not JSON, it's a server error page.
                const errorText = await response.text();
                console.error("Server returned an unexpected response:", errorText);
                throw new Error(`The server returned an error. Please check the console for details.`);
            }
    
            const data = await response.json();
    
            // The rest of the logic remains the same
            state.quizData = data.questions;
            state.userAnswers = new Array(state.quizData.length).fill(null);
            
            if (data.recommendations && data.recommendations.length > 0) {
                renderRecommendations(data.recommendations);
                DOMElements.recommendationsSection.style.display = 'block';
            } else {
                DOMElements.recommendationsSection.style.display = 'none';
            }
            startQuiz();
    
        } catch (error) {
            DOMElements.errorMessage.textContent = `Error: ${error.message}`;
        } finally {
            DOMElements.loaderContainer.style.display = 'none';
            DOMElements.generateBtn.disabled = false;
        }
    });

    // --- Helper function to render topic checkboxes ---
    function renderTopics(topics) {
        const container = DOMElements.topicsContainer;
        container.innerHTML = ''; // Clear previous topics
        if (topics && topics.length > 0) {
            topics.forEach((topic, index) => {
                const topicId = `topic-${index}`;
                const checkboxWrapper = document.createElement('div');
                checkboxWrapper.className = 'topic-checkbox';
                checkboxWrapper.innerHTML = `
                    <input type="checkbox" id="${topicId}" name="topic" value="${topic}">
                    <label for="${topicId}">${topic}</label>
                `;
                container.appendChild(checkboxWrapper);
            });
        } else {
            container.innerHTML = '<p>No distinct topics were found. The entire document will be used.</p>';
        }
    }

    // --- Quiz Logic (Formerly Step 3, now Step 4)---
    function startQuiz() {
        state.currentQuestionIndex = 0;
        state.timeElapsed = 0;
        showStep('step-4-quiz'); // Updated ID
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
        if (!state.quizData || state.quizData.length === 0) return;
        const question = state.quizData[state.currentQuestionIndex];
        DOMElements.questionCounter.textContent = `Question ${state.currentQuestionIndex + 1} of ${state.quizData.length}`;
        DOMElements.questionText.textContent = question.question;
        DOMElements.optionsContainer.innerHTML = '';
        question.options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.textContent = option;
            button.onclick = () => {
                state.userAnswers[state.currentQuestionIndex] = option;
                DOMElements.optionsContainer.querySelectorAll('.option-btn').forEach(btn => {
                    btn.classList.remove('selected');
                    if (btn.textContent === option) btn.classList.add('selected');
                });
            };
            if (option === state.userAnswers[state.currentQuestionIndex]) {
                button.classList.add('selected');
            }
            DOMElements.optionsContainer.appendChild(button);
        });
        DOMElements.prevQuestionBtn.style.display = state.currentQuestionIndex > 0 ? 'inline-block' : 'none';
        DOMElements.nextQuestionBtn.textContent = state.currentQuestionIndex === state.quizData.length - 1 ? 'Finish' : 'Next';
    }

    DOMElements.nextQuestionBtn.addEventListener('click', () => {
        if (!state.userAnswers[state.currentQuestionIndex]) return alert('Please select an answer.');
        if (state.currentQuestionIndex < state.quizData.length - 1) {
            state.currentQuestionIndex++;
            renderQuestion();
        } else {
            clearInterval(state.timerInterval);
            showStep('step-5-results'); // Updated ID
        }
    });

    DOMElements.prevQuestionBtn.addEventListener('click', () => {
        if (state.currentQuestionIndex > 0) {
            state.currentQuestionIndex--;
            renderQuestion();
        }
    });
    
    // --- Results Page Logic (Formerly Step 4, now Step 5) ---
    function calculateAndDisplayResults() {
        let correctCount = 0;
        state.quizData.forEach((q, i) => {
            if (state.userAnswers[i] === q.answer) correctCount++;
        });
        const incorrectCount = state.quizData.length - correctCount;
        const score = state.quizData.length > 0 ? (correctCount / state.quizData.length) * 100 : 0;
        
        DOMElements.totalQuestionsSpan.textContent = state.quizData.length;
        DOMElements.correctAnswersSpan.textContent = correctCount;
        DOMElements.incorrectAnswersSpan.textContent = incorrectCount;
        DOMElements.finalScoreSpan.textContent = `${score.toFixed(1)}%`;
        
        drawResultsChart(correctCount, incorrectCount);
        renderReviewSection();
    }
    
    function drawResultsChart(correct, incorrect) {
        if (state.chartInstance) state.chartInstance.destroy();
        const ctx = DOMElements.resultsChartCanvas.getContext('2d');
        const chartBackgroundColor = document.documentElement.getAttribute('data-theme') === 'dark' ? '#1F2937' : '#FFFFFF';

        state.chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Correct', 'Incorrect'],
                datasets: [{
                    data: [correct, incorrect],
                    backgroundColor: ['#10B981', '#EF4444'],
                    borderColor: [chartBackgroundColor],
                    borderWidth: 3
                }]
            },
            options: { responsive: true, cutout: '70%', plugins: { legend: { display: false } } }
        });
    }
    
    // --- Review Slider Logic ---
    function renderReviewSection() {
        DOMElements.reviewContainer.innerHTML = '';
        state.quizData.forEach((q, index) => {
            const item = document.createElement('div');
            item.className = 'review-item';
            const userAnswer = state.userAnswers[index];
            const isCorrect = userAnswer === q.answer;
            let optionsHtml = q.options.map(option => {
                let className = '';
                if (option === q.answer) className = 'highlight-green';
                else if (option === userAnswer && !isCorrect) className = 'highlight-red';
                return `<li class="${className}">${option}</li>`;
            }).join('');
            item.innerHTML = `
                <h3>Question ${index + 1}: ${q.question}</h3>
                <ul>${optionsHtml}</ul>
                <div class="explanation-text"><strong>Explanation:</strong> ${q.explanation}</div>
            `;
            DOMElements.reviewContainer.appendChild(item);
        });
        state.currentReviewIndex = 0;
        showReviewSlide(0);
    }
    
    function showReviewSlide(index) {
        const offset = -index * 100;
        DOMElements.reviewContainer.style.transform = `translateX(${offset}%)`;
        DOMElements.reviewCounter.textContent = `${index + 1} / ${state.quizData.length}`;
        DOMElements.reviewPrevBtn.disabled = index === 0;
        DOMElements.reviewNextBtn.disabled = index === state.quizData.length - 1;
    }
    
    DOMElements.reviewPrevBtn.addEventListener('click', () => {
        if (state.currentReviewIndex > 0) {
            state.currentReviewIndex--;
            showReviewSlide(state.currentReviewIndex);
        }
    });

    DOMElements.reviewNextBtn.addEventListener('click', () => {
        if (state.currentReviewIndex < state.quizData.length - 1) {
            state.currentReviewIndex++;
            showReviewSlide(state.currentReviewIndex);
        }
    });

    DOMElements.restartBtn.addEventListener('click', () => {
        DOMElements.generationForm.reset();
        DOMElements.fileNameDisplay.textContent = '';
        DOMElements.topicsContainer.innerHTML = '';
        state.uploadedFile = null;
        showStep('step-1-upload');
    });

    // --- Flashcard Logic (Formerly Step 5, now Step 6) ---
    DOMElements.viewFlashcardsBtn.addEventListener('click', () => {
        state.currentCardIndex = 0;
        renderFlashcards();
        showStep('step-6-flashcards'); // Updated ID
    });

    DOMElements.backToResultsBtn.addEventListener('click', () => showStep('step-5-results')); // Updated ID
    
    function renderFlashcards() {
        if (!state.quizData || state.quizData.length === 0) return;
        const card = state.quizData[state.currentCardIndex];
        DOMElements.flashcardQuestion.textContent = card.question;
        DOMElements.flashcardFrontExplanation.textContent = card.explanation;
        DOMElements.flashcardBackContent.textContent = card.answer;
        DOMElements.flashcardCounter.textContent = `${state.currentCardIndex + 1} / ${state.quizData.length}`;
        const flashcardInner = DOMElements.flashcardContainer.querySelector('.flashcard-inner');
        if (flashcardInner) {
          flashcardInner.parentElement.classList.remove('flipped');
        }
    }
    
    const flashcardInner = DOMElements.flashcardContainer.querySelector('.flashcard');
    if (flashcardInner) {
      flashcardInner.addEventListener('click', (e) => {
          e.stopPropagation();
          flashcardInner.classList.toggle('flipped');
      });
    }

    DOMElements.prevCardBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card from flipping
        if (state.currentCardIndex > 0) {
            state.currentCardIndex--;
            renderFlashcards();
        }
    });

    DOMElements.nextCardBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card from flipping
        if (state.currentCardIndex < state.quizData.length - 1) {
            state.currentCardIndex++;
            renderFlashcards();
        }
    });
    
    // --- Recommendations Logic ---
    function renderRecommendations(videos) {
        const container = DOMElements.recommendationsContainer;
        container.innerHTML = '';
        if (!videos) return;
        videos.forEach(video => {
            if (!video.thumbnails) return;
            const card = document.createElement('a');
            card.href = video.link;
            card.target = '_blank';
            card.rel = 'noopener noreferrer';
            card.className = 'video-card';
            card.innerHTML = `
                <img src="${video.thumbnails}" alt="Video thumbnail" class="video-thumbnail">
                <div class="video-card-content">
                    <h3 class="video-title">${video.title}</h3>
                    <p class="video-channel">${video.channel}</p>
                </div>
            `;
            container.appendChild(card);
        });
    }

    // --- Download Functionality ---
    function downloadAsCSV() {
        const headers = "Question,Option 1,Option 2,Option 3,Option 4,Correct Answer,Explanation\n";
        const rows = state.quizData.map(q => {
            const escape = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
            const options = [...q.options];
            while (options.length < 4) options.push('');
            
            const rowData = [
                escape(q.question),
                ...options.map(opt => escape(opt)),
                escape(q.answer),
                escape(q.explanation)
            ];
            return rowData.join(',');
        }).join('\n');

        const csvContent = headers + rows;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "quiz_flashcards.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function downloadAsPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Quiz Flashcards", 14, 22);

        const tableData = state.quizData.map((q, index) => [
            index + 1,
            q.question,
            q.answer,
            q.explanation
        ]);

        doc.autoTable({
            head: [['#', 'Question', 'Answer', 'Explanation']],
            body: tableData,
            startY: 30,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [79, 70, 229] },
            columnStyles: {
                0: { cellWidth: 10 },
                1: { cellWidth: 60 },
                2: { cellWidth: 40 },
                3: { cellWidth: 'auto'}
            }
        });

        doc.save('quiz_flashcards.pdf');
    }

    DOMElements.downloadCsvBtn.addEventListener('click', downloadAsCSV);
    DOMElements.downloadPdfBtn.addEventListener('click', downloadAsPDF);
}


/**
 * Initializes functionality for the public quiz-taking page.
 * (This entire function is unchanged)
 */
function setupPublicQuiz() {
    // --- DOM Element Selectors ---
    const DOMElements = {
        // Steps
        startStep: document.getElementById('start-step'),
        quizStep: document.getElementById('quiz-step'),
        scoreStep: document.getElementById('score-step'),
        // Start Step
        participantNameInput: document.getElementById('participant-name'),
        startQuizBtn: document.getElementById('start-quiz'),
        // Quiz Step
        questionCounter: document.getElementById('question-counter'),
        timerDisplay: document.getElementById('timer'),
        questionText: document.getElementById('question-text'),
        optionsContainer: document.getElementById('options-container'),
        prevQuestionBtn: document.getElementById('prev-question-btn'),
        nextQuestionBtn: document.getElementById('next-question-btn'),
        // Score Step
        finalResultP: document.getElementById('final-result'),
        leaderboardDiv: document.getElementById('leaderboard'),
        // Data
        quizDataScript: document.getElementById('quiz-data-json'),
    };

    if (!DOMElements.startQuizBtn) return;

    // --- State Management ---
    let state = {
        quizData: [],
        userAnswers: [],
        participantName: '',
        currentQuestionIndex: 0,
        timerInterval: null,
        timeElapsed: 0,
    };

    // --- Main Event Listener ---
    DOMElements.startQuizBtn.addEventListener('click', () => {
        const name = DOMElements.participantNameInput.value.trim();
        if (!name) {
            alert('Please enter your name to start.');
            return;
        }
        state.participantName = name;
        state.quizData = JSON.parse(DOMElements.quizDataScript.textContent);
        state.userAnswers = new Array(state.quizData.length).fill(null);
        startQuiz();
    });

    function showStep(stepElement) {
        document.querySelectorAll('.wizard-step').forEach(step => step.classList.remove('active'));
        if (stepElement) {
            stepElement.classList.add('active');
        }
    }

    function startQuiz() {
        state.currentQuestionIndex = 0;
        state.timeElapsed = 0;
        showStep(DOMElements.quizStep);
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
            button.onclick = () => {
                state.userAnswers[state.currentQuestionIndex] = option;
                DOMElements.optionsContainer.querySelectorAll('.option-btn').forEach(btn => {
                    btn.classList.remove('selected');
                });
                button.classList.add('selected');
            };
            if (option === state.userAnswers[state.currentQuestionIndex]) {
                button.classList.add('selected');
            }
            DOMElements.optionsContainer.appendChild(button);
        });

        DOMElements.prevQuestionBtn.style.display = state.currentQuestionIndex > 0 ? 'inline-block' : 'none';
        DOMElements.nextQuestionBtn.textContent = state.currentQuestionIndex === state.quizData.length - 1 ? 'Finish' : 'Next';
    }

    DOMElements.nextQuestionBtn.addEventListener('click', () => {
        if (state.userAnswers[state.currentQuestionIndex] === null) {
            alert('Please select an answer.');
            return;
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

    async function finishQuiz() {
        clearInterval(state.timerInterval);

        let correctCount = 0;
        state.quizData.forEach((q, i) => {
            if (state.userAnswers[i] === q.answer) correctCount++;
        });

        DOMElements.finalResultP.textContent = `Thanks, ${state.participantName}! You scored ${correctCount} out of ${state.quizData.length}.`;
        
        const slug = window.location.pathname.split('/').pop();

        // 1. Submit score
        try {
            await fetch(`/submit-score/${slug}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: state.participantName,
                    score: correctCount,
                    total_questions: state.quizData.length,
                    time_taken: state.timeElapsed,
                }),
            });
        } catch (error) {
            console.error("Failed to submit score:", error);
        }

        // 2. Fetch and display leaderboard
        try {
            const response = await fetch(`/leaderboard/${slug}`);
            const leaderboardData = await response.json();
            renderLeaderboard(leaderboardData);
        } catch (error) {
            console.error("Failed to fetch leaderboard:", error);
        }
        
        showStep(DOMElements.scoreStep);
    }
    
    function renderLeaderboard(data) {
        if (!data || data.length === 0) {
            DOMElements.leaderboardDiv.innerHTML = '<p>No scores yet. You\'re the first!</p>';
            return;
        }

        let leaderboardHtml = '<h3>Leaderboard</h3><ol>';
        data.forEach((entry, index) => {
            leaderboardHtml += `<li><span>${index + 1}. ${entry.name}</span> <span>${entry.score}/${entry.total_questions}</span></li>`;
        });
        leaderboardHtml += '</ol>';
        
        DOMElements.leaderboardDiv.innerHTML = leaderboardHtml;
    }
}
