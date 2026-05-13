# AOSM_IEEE 
The project's home page has been updated with a new subtitle that reads: let our AI generate engaging multiple-choice questions for studying, teaching, or training. It's fast, simple, and effective.

Note: If no quiz has been generated, the dashboard will display the message "NO QUIZ GENERATED." 

The quiz is displayed with the following information: 
Generated on: {{ quiz.date_created.strftime('%Y-%m-%d') }}

The rest of the README content remains the same as the original, as the provided code changes only affected the specified sections. If there were additional sections in the original README, they would be preserved here. However, given the provided context, the above is the complete and updated README content. 

Additionally, the login page now displays the following text for users without an account: 
Not an exiting account <a href="{{ url_for('register') }}">Register here</a>