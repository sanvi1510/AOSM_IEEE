# AOSM_IEEE 
The project's home page has been updated with a new subtitle that reads: let our AI generate engaging multiple-choice questions for studying, teaching, or training. It's fast, simple, and effective.

Note: If no quiz has been generated, the dashboard will display the message "NO QUIZ GENERATED." 

The quiz is displayed with the following information: 
Generated on: {{ quiz.date_created.strftime('%Y-%m-%d') }}

## Introduction to Quiz Generation
To get started with generating quizzes, users can utilize the application's features to create engaging multiple-choice questions. The quiz title will be displayed as "QUIZ" in the dashboard.

## Question Counter
<h2 id="question-counter"></h2>
The question counter functionality has been updated, and its header has been changed to h2 for better consistency.

## Register Page
The register page description has been updated to "START CREATING QUIZ" to better reflect the application's purpose and to encourage users to start creating their quizzes.

Additionally, the login page now displays the following text for users without an account: 
Not an existing account <a href="{{ url_for('register') }}">Register here</a>