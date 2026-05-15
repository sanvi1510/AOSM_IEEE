# Quiz Generation Project
## Description
This project is a quiz generation application that utilizes natural language processing (NLP) and machine learning (ML) to create quizzes based on user-uploaded documents. The application allows users to select topics, configure quiz settings, and generate quizzes with multiple-choice questions.

## Key Features
* User authentication and authorization
* Document upload and topic extraction
* Quiz configuration and generation
* Multiple-choice question generation using NLP and ML
* Quiz taking and results display

## Architecture / Workflow
The application is built using Flask, a Python web framework, and utilizes various libraries such as PyMuPDF, pytesseract, and langchain for NLP and ML tasks. The workflow involves the following steps:
1. User uploads a document
2. Topics are extracted from the document
3. User selects topics and configures quiz settings
4. Quiz is generated with multiple-choice questions
5. User takes the quiz and results are displayed

## Installation
To install the application, run the following commands:
```bash
pip install -r requirements.txt
```
## Configuration
To configure the application, set the following environment variables:
* `SECRET_KEY`: a secret key for the application
* `GROQ_API_KEY`: an API key for the langchain API

## Usage
To run the application, execute the following command:
```bash
flask run
```
Then, open a web browser and navigate to `http://localhost:5000` to access the application.

## API Reference
The application provides the following API endpoints:
* `/extract-topics`: extracts topics from a user-uploaded document
* `/generate-quiz`: generates a quiz with multiple-choice questions based on user-selected topics and configuration

## Examples
Here is an example of how to extract text from a PDF file using PyMuPDF:
```python
import fitz

def extract_text_from_pdf(file_path):
    try:
        with fitz.open(file_path) as doc:
            text = "".join(page.get_text() for page in doc)
            return text
    except Exception as e:
        print(f"Error: {e}")
        return None

# Example usage:
file_path = "example.pdf"
text = extract_text_from_pdf(file_path)
print(text)
```
Note: Make sure to install PyMuPDF using `pip install pymupdf` before running the example.

## Testing
To test the application, run the following command:
```bash
pytest
```
This will execute the test suite and report any errors or failures.

## License
This project is licensed under the MIT License. See LICENSE for details.